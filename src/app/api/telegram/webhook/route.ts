import {
  createBrainItemFromTelegram,
  getLatestBrainItems,
  getSavedTelegramText,
  isListCommand,
  isSaveCommand,
} from "@/features/brain/service";
import { sendTelegramMessage } from "@/features/telegram/telegram-client";
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

function formatBrainItemsList(items: { rawText: string }[]): string {
  const lines = items.map((item, index) => {
    const compactText = item.rawText.replace(/\s+/g, " ").trim();
    return `${index + 1}. ${compactText}`;
  });

  return ["🧠 Последние записи:", ...lines].join("\n");
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

  const isSave = isSaveCommand(parsedMessage.text);
  const isList = isListCommand(parsedMessage.text);

  if (!isSave && !isList) {
    console.info("Telegram message ignored: unsupported command", {
      chatId: parsedMessage.chatId,
      messageId: parsedMessage.messageId,
    });
    return okResponse();
  }

  if (isSave) {
    const rawText = getSavedTelegramText(parsedMessage.text);

    if (!rawText) {
      await sendTelegramMessage(parsedMessage.chatId, "Напиши так: /save идея или мысль");
      return okResponse();
    }

    try {
      const brainItem = await createBrainItemFromTelegram(parsedMessage);
      const chatId = parsedMessage.chatId;

      await sendTelegramMessage(chatId, "✅ Сохранил во второй мозг");

      console.info("Telegram brain item saved", {
        chatId,
        messageId: parsedMessage.messageId,
        brainItemId: brainItem.id,
      });
    } catch (error) {
      console.error("Telegram /save failed", {
        chatId: parsedMessage.chatId,
        messageId: parsedMessage.messageId,
        error,
      });

      await sendTelegramMessage(
        parsedMessage.chatId,
        "Не смог сохранить. Попробуй ещё раз."
      );
    }

    return okResponse();
  }

  try {
    const items = await getLatestBrainItems(5);

    if (items.length === 0) {
      await sendTelegramMessage(
        parsedMessage.chatId,
        "Пока во втором мозге пусто. Добавь первую запись через /save"
      );
      return okResponse();
    }

    await sendTelegramMessage(parsedMessage.chatId, formatBrainItemsList(items));
  } catch (error) {
    console.error("Telegram /list failed", {
      chatId: parsedMessage.chatId,
      messageId: parsedMessage.messageId,
      error,
    });

    await sendTelegramMessage(
      parsedMessage.chatId,
      "Не смог загрузить список. Попробуй позже."
    );
  }

  return okResponse();
}
