import { auth } from "@/app/(auth)/auth";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
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
    auth(),
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

  if (
    chat.visibility === "private" &&
    (!session?.user || session.user.id !== chat.userId)
  ) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const isReadonly = !session?.user || session.user.id !== chat.userId;

  return Response.json({
    messages: convertToUIMessages(messages),
    visibility: chat.visibility,
    userId: chat.userId,
    isReadonly,
  });
}
