import "server-only";

import type { ModelMessage } from "ai";
import { generateText } from "ai";
import { DEFAULT_CHAT_MODEL } from "./models";
import { getLanguageModel } from "./providers";
import { traceError, traceLog } from "./trace";

const REWRITE_MODEL = DEFAULT_CHAT_MODEL;

/**
 * Structured result from the query rewriter.
 *
 * - `searchQuery`  — a standalone search query for vector retrieval
 * - `recallItems`  — dish names discussed in earlier turns that should
 *                     remain in the menu context (prevents "amnesia")
 */
export type RewriteResult = {
  searchQuery: string;
  recallItems: string[];
};

const REWRITE_SYSTEM_PROMPT = `You are a search-query rewriter for a restaurant menu chatbot.

Given the recent conversation between a diner and the menu assistant, you must output exactly two lines:

LINE 1 — QUERY: Rewrite the diner's latest message into a single standalone search query that captures the current intent. Include dietary, allergen, budget, cuisine, or spice constraints mentioned earlier only if they are still relevant to the latest message.

LINE 2 — RECALL: List the exact names of specific menu dishes that were explicitly mentioned or recommended earlier in the conversation. Separate names with commas. If none, write "none".

Rules:
- Output ONLY these two lines. No explanations, no extra text.
- Keep the QUERY concise — under 40 words.
- RECALL must contain only dish names that appeared in earlier conversation turns, not the current one.
- If the latest message is the first message or is a greeting, return the message as-is for QUERY and "none" for RECALL.

Examples:

Conversation:
Diner: I'm allergic to dairy
Assistant: Here are some dairy-free options: Kung Pao Chicken, Chicken Cashew Nuts...
Diner: something spicy?
QUERY: spicy dishes without dairy
RECALL: Kung Pao Chicken, Chicken Cashew Nuts

Conversation:
Diner: I am craving for some dish that has nuts in it
Assistant: You have three options: Chicken Cashew Nuts, Kung Pao Chicken, Chicken Korma
Diner: I cant decide between chicken cashew nuts and korma. What do you suggest?
Assistant: Both are specialty dishes. Cashew Nuts is Chinese, Korma is Desi.
Diner: what should I order along with the cashew nuts
QUERY: side dishes or pairings for Chicken Cashew Nuts
RECALL: Chicken Cashew Nuts, Kung Pao Chicken, Chicken Korma

Conversation:
Diner: What pairs well with biryani?
QUERY: What pairs well with biryani?
RECALL: none`;

/**
 * Rewrites the user's latest message into a standalone search query
 * and extracts previously-discussed dish names for context recall.
 *
 * If the conversation has only one message, or the rewrite fails,
 * returns the original text unchanged with no recall items.
 */
export async function rewriteQueryForRetrieval(
  latestUserText: string,
  modelMessages: ModelMessage[]
): Promise<RewriteResult> {
  const emptyResult: RewriteResult = {
    searchQuery: latestUserText,
    recallItems: [],
  };

  // No history to work with — skip the rewrite call entirely
  if (!latestUserText.trim() || modelMessages.length <= 1) {
    traceLog("query_rewrite.skipped", {
      reason: latestUserText.trim() ? "no_history" : "empty_latest_user_text",
      latestUserText,
      messageCount: modelMessages.length,
    });
    return emptyResult;
  }

  // Take the last 10 messages (5 turns) for context
  const recentMessages = modelMessages.slice(-10);

  // Build a compact conversation summary for the rewrite prompt
  const conversationLines = recentMessages
    .map((msg) => {
      const role = msg.role === "user" ? "Diner" : "Assistant";
      const text =
        msg.content && typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content
                .filter(
                  (part): part is { type: "text"; text: string } =>
                    typeof part === "object" &&
                    part !== null &&
                    "type" in part &&
                    part.type === "text"
                )
                .map((part) => part.text)
                .join(" ")
            : "";
      return `${role}: ${text}`;
    })
    .filter((line) => line.length > 10); // skip empty/trivial lines

  if (conversationLines.length <= 1) {
    traceLog("query_rewrite.skipped", {
      reason: "not_enough_text_conversation_lines",
      latestUserText,
      messageCount: modelMessages.length,
      conversationLines,
    });
    return emptyResult;
  }

  try {
    const prompt = `Conversation:\n${conversationLines.join("\n")}\n\nOutput the two lines (QUERY and RECALL):`;

    traceLog("model.groq.request", {
      operation: "query_rewrite",
      model: REWRITE_MODEL,
      system: REWRITE_SYSTEM_PROMPT,
      prompt,
      settings: {
        maxOutputTokens: 120,
        temperature: 0,
      },
    });

    const { text } = await generateText({
      model: getLanguageModel(REWRITE_MODEL),
      system: REWRITE_SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 120,
      temperature: 0,
    });

    const parsed = parseRewriteOutput(text, latestUserText);

    traceLog("model.groq.response", {
      operation: "query_rewrite",
      model: REWRITE_MODEL,
      rawOutput: text,
      parsed,
    });

    traceLog("query_rewrite.completed", {
      latestUserText,
      searchQuery: parsed.searchQuery,
      recallItems: parsed.recallItems,
    });

    return parsed;
  } catch (error) {
    traceError("query_rewrite.failed", {
      latestUserText,
      error,
    });
    console.warn("Query rewrite failed, using original text:", error);
    return emptyResult;
  }
}

/**
 * Parse the two-line output from the rewriter model.
 *
 * Expected format:
 *   QUERY: <search query>
 *   RECALL: <comma-separated dish names | "none">
 *
 * Falls back gracefully if the model doesn't follow the format.
 */
function parseRewriteOutput(raw: string, fallbackQuery: string): RewriteResult {
  const lines = raw.trim().split("\n").filter(Boolean);

  let searchQuery = fallbackQuery;
  let recallItems: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.toUpperCase().startsWith("QUERY:")) {
      const value = trimmed.slice("QUERY:".length).trim();
      if (value.length >= 3) {
        searchQuery = value;
      }
    } else if (trimmed.toUpperCase().startsWith("RECALL:")) {
      const value = trimmed.slice("RECALL:".length).trim();
      if (value.toLowerCase() !== "none" && value.length > 0) {
        recallItems = value
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length >= 3);
      }
    }
  }

  // If no QUERY: line was found, treat the entire output as the query
  // (backwards compat with models that don't follow the format)
  if (searchQuery === fallbackQuery && lines.length > 0) {
    const firstLine = lines[0].trim();
    if (
      firstLine.length >= 3 &&
      !firstLine.toUpperCase().startsWith("RECALL:")
    ) {
      searchQuery = firstLine;
    }
  }

  return { searchQuery, recallItems };
}
