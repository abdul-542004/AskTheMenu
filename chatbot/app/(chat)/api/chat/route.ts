import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  stepCountIs,
  streamText,
} from "ai";
import { checkBotId } from "botid/server";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  allowedModelIds,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
} from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import {
  assertGroqConfigured,
  getLanguageModel,
  isGroqConfigurationError,
} from "@/lib/ai/providers";
import { rewriteQueryForRetrieval } from "@/lib/ai/rewrite-query";
import { placeOrder } from "@/lib/ai/tools/place-order";
import { traceError, traceLog } from "@/lib/ai/trace";
import { isProductionEnvironment } from "@/lib/constants";
import { getAnonymousUserId } from "@/lib/db/anonymous-user";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { getDatabaseUrl } from "@/lib/db/url";
import { ChatbotError } from "@/lib/errors";
import { buildMenuContext } from "@/lib/menu/search";
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";
import {
  convertToUIMessages,
  generateUUID,
  getTextFromMessage,
  isUUID,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

const hasDatabase = Boolean(getDatabaseUrl());
const orderApprovalContinuationPrompt = `An approved placeOrder tool has just been executed.
If the tool output says success is true, respond with only: "Done - your order has been sent to the kitchen."
If the tool output says success is false, apologize briefly and mention the error.
Do not repeat the order, do not ask for confirmation, do not mention tool names, and do not say you are about to place the order.`;

function denyPendingOrderApprovals(messages: ChatMessage[]) {
  return messages.map((msg) => ({
    ...msg,
    parts: msg.parts.map((part) => {
      if (
        part.type !== "tool-placeOrder" ||
        part.state !== "approval-requested"
      ) {
        return part;
      }

      return {
        ...part,
        state: "output-denied" as const,
        approval: {
          id: part.approval.id,
          approved: false,
          reason: "User changed the order before confirming.",
        },
      };
    }),
  })) as ChatMessage[];
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const {
      id,
      tableSlug,
      message,
      messages,
      selectedChatModel,
      selectedVisibilityType,
    } = requestBody;
    const shouldPersistChat = hasDatabase && isUUID(id);
    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    traceLog("chat.request.received", {
      chatId: id,
      tableSlug,
      selectedChatModel,
      effectiveChatModel: chatModel,
      selectedVisibilityType,
      hasIncomingMessages: Boolean(messages?.length),
      incomingMessage: message,
    });

    assertGroqConfigured();

    // Bot check (non-blocking)
    checkBotId().catch(() => null);

    // Try to get an authenticated session; fall back to anonymous for diners
    const session = shouldPersistChat ? await auth().catch(() => null) : null;

    // Resolve the user ID: authenticated user or anonymous diner
    let userId: string | null = session?.user?.id ?? null;
    if (shouldPersistChat && !userId) {
      userId = await getAnonymousUserId();
    }

    await checkIpRateLimit(ipAddress(request));

    if (shouldPersistChat && session?.user) {
      const userType: UserType = session.user.type;

      const messageCount = await getMessageCountByUserId({
        id: session.user.id,
        differenceInHours: 1,
      });

      if (messageCount > entitlementsByUserType[userType].maxMessagesPerHour) {
        return new ChatbotError("rate_limit:chat").toResponse();
      }
    }

    const hasToolApprovalContinuation =
      messages?.some((msg) =>
        msg.parts?.some((part: Record<string, unknown>) => {
          const state = part.state;
          return state === "approval-responded" || state === "output-denied";
        })
      ) ?? false;

    const chat = shouldPersistChat ? await getChatById({ id }) : null;
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      // Allow access if the chat belongs to the authenticated user or the anonymous user
      const isOwner =
        chat.userId === session?.user?.id || chat.userId === userId;
      if (!isOwner) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (shouldPersistChat && userId && message?.role === "user") {
      await saveChat({
        id,
        userId,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (hasToolApprovalContinuation && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      const baseMessages =
        dbMessages.length > 0 ? dbMessages : (messages as ChatMessage[]);
      uiMessages = baseMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else if (messages && messagesFromDb.length === 0) {
      uiMessages = messages as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    if (!hasToolApprovalContinuation && message?.role === "user") {
      uiMessages = denyPendingOrderApprovals(uiMessages);
      if (shouldPersistChat) {
        await Promise.all(
          uiMessages
            .filter((msg) =>
              messagesFromDb.some((dbMessage) => dbMessage.id === msg.id)
            )
            .map((msg) => updateMessage({ id: msg.id, parts: msg.parts }))
        );
      }
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (shouldPersistChat && message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    const modelCapabilities = await getCapabilities();
    const capabilities = modelCapabilities[chatModel];
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;

    const modelMessages = await convertToModelMessages(uiMessages);
    const latestMessage = message ?? uiMessages.at(-1);
    const latestUserText = latestMessage
      ? getTextFromMessage(latestMessage)
      : "";

    // Rewrite the query with conversation context for better RAG retrieval
    const { searchQuery, recallItems } = await rewriteQueryForRetrieval(
      latestUserText,
      modelMessages
    );
    const menuContext = await buildMenuContext(searchQuery);

    // Use the table slug for the system prompt label (e.g. "Table 1")
    const effectiveTableLabel = tableSlug ?? id;
    const chatSystemPrompt = systemPrompt({
      requestHints,
      supportsTools,
      menuContext,
      tableLabel: effectiveTableLabel,
    });

    // Build tools - placeOrder is only available for table-scoped chats.
    const chatTools =
      supportsTools && tableSlug
        ? {
            placeOrder: placeOrder({ tableSlug }),
          }
        : undefined;
    const activeToolNames: "placeOrder"[] = chatTools ? ["placeOrder"] : [];
    const followUpToolNames: "placeOrder"[] = hasToolApprovalContinuation
      ? []
      : activeToolNames;

    traceLog("model.groq.request", {
      operation: "chat_response",
      model: chatModel,
      provider: "groq",
      latestUserText,
      searchQuery,
      recallItems,
      system: chatSystemPrompt,
      messages: modelMessages,
      settings: {
        stopWhen: "stepCountIs(5)",
        tools: Object.keys(chatTools ?? {}),
        activeTools: activeToolNames,
        sendReasoning: isReasoningModel,
      },
    });

    const stream = createUIMessageStream({
      originalMessages: hasToolApprovalContinuation ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: getLanguageModel(chatModel),
          system: chatSystemPrompt,
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          activeTools: activeToolNames,
          prepareStep: hasToolApprovalContinuation
            ? () => ({
                activeTools: followUpToolNames,
                system: orderApprovalContinuationPrompt,
              })
            : undefined,
          tools: chatTools,
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
          onFinish: (event) => {
            traceLog("model.groq.response", {
              operation: "chat_response",
              model: chatModel,
              providerModel: event.model,
              ok: true,
              finishReason: event.finishReason,
              rawFinishReason: event.rawFinishReason,
              output: event.text,
              usage: event.usage,
              totalUsage: event.totalUsage,
              warnings: event.warnings,
              responseId: event.response?.id,
              responseTimestamp: event.response?.timestamp,
              steps: event.steps.map((step) => ({
                stepNumber: step.stepNumber,
                model: step.model,
                finishReason: step.finishReason,
                rawFinishReason: step.rawFinishReason,
                text: step.text,
                usage: step.usage,
                warnings: step.warnings,
                toolCalls: step.toolCalls,
                toolResults: step.toolResults,
              })),
            });
          },
          onError: ({ error }) => {
            traceError("model.groq.error", {
              operation: "chat_response",
              model: chatModel,
              error,
            });
          },
        });

        dataStream.merge(
          result.toUIMessageStream({ sendReasoning: isReasoningModel })
        );

        if (titlePromise) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          if (shouldPersistChat) {
            updateChatTitleById({ chatId: id, title });
          }
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        traceLog("chat.ui_stream.finished", {
          chatId: id,
          shouldPersistChat,
          messageCount: finishedMessages.length,
          messages: finishedMessages,
        });

        if (!shouldPersistChat) {
          return;
        }

        if (hasToolApprovalContinuation) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }
      },
      onError: (error) => {
        traceError("chat.ui_stream.error", {
          chatId: id,
          error,
        });

        if (isGroqConfigurationError(error)) {
          return "Groq is not configured. Add GROQ_API_KEY to chatbot/.env.local and restart the dev server.";
        }
        return "Oops, an error occurred!";
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!(shouldPersistChat && process.env.REDIS_URL)) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    traceError("chat.request.failed", {
      vercelId,
      error,
    });

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    if (isGroqConfigurationError(error)) {
      return new ChatbotError("bad_request:groq").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  if (!isUUID(id)) {
    return Response.json(null, { status: 200 });
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
