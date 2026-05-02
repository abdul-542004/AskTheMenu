import { auth } from "@/app/(auth)/auth";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { getAnonymousUserId } from "@/lib/db/anonymous-user";
import { getDatabaseUrl } from "@/lib/db/url";
import { convertToUIMessages, isUUID } from "@/lib/utils";

const hasDatabase = Boolean(getDatabaseUrl());

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!chatId) {
    return Response.json({ error: "chatId required" }, { status: 400 });
  }

  if (!hasDatabase || !isUUID(chatId)) {
    return Response.json({
      messages: [],
      visibility: "private",
      userId: null,
      isReadonly: false,
    });
  }

  const [session, chat, messages] = await Promise.all([
    auth().catch(() => null),
    getChatById({ id: chatId }),
    getMessagesByChatId({ id: chatId }),
  ]);

  if (!chat) {
    return Response.json({
      messages: [],
      visibility: "private",
      userId: null,
      isReadonly: false,
    });
  }

  // Resolve the current user: authenticated or anonymous
  const currentUserId = session?.user?.id ?? (await getAnonymousUserId());

  if (chat.visibility === "private" && currentUserId !== chat.userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const isReadonly = currentUserId !== chat.userId;

  return Response.json({
    messages: convertToUIMessages(messages),
    visibility: chat.visibility,
    userId: chat.userId,
    isReadonly,
  });
}
