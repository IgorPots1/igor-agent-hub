import { createBrainItemFromTelegram, isSaveCommand } from "@/features/brain/service";
import { parseTelegramUpdate } from "@/features/telegram/parser";
import type { TelegramUpdate } from "@/features/telegram/types";

const jsonHeaders = {
  "Content-Type": "application/json",
};

function okResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: jsonHeaders,
  });
}

export async function GET() {
  return okResponse();
}

export async function POST(request: Request) {
  let update: TelegramUpdate | null = null;

  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    console.warn("Telegram webhook received invalid JSON payload");
    return okResponse();
  }

  const parsedMessage = parseTelegramUpdate(update);

  if (!parsedMessage) {
    console.info("Telegram update ignored: no text message");
    return okResponse();
  }

  if (!isSaveCommand(parsedMessage.text)) {
    console.info("Telegram message ignored: unsupported command", {
      chatId: parsedMessage.chatId,
      messageId: parsedMessage.messageId,
    });
    return okResponse();
  }

  try {
    const brainItem = await createBrainItemFromTelegram(parsedMessage);

    console.info("Telegram brain item saved", {
      chatId: parsedMessage.chatId,
      messageId: parsedMessage.messageId,
      brainItemId: brainItem.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while saving Telegram note";

    console.error("Telegram /save failed", {
      chatId: parsedMessage.chatId,
      messageId: parsedMessage.messageId,
      error: message,
    });
  }

  return okResponse();
}
