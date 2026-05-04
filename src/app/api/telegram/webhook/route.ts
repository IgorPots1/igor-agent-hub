import {
  createBrainItemFromTelegram,
  getInboxBrainItems,
  getLatestBrainItem,
  getLatestBrainItems,
  getSavedTelegramText,
  isInboxCommand,
  isLastCommand,
  isListCommand,
  isSaveCommand,
  tryClassifyBrainItem,
} from "@/features/brain/service";
import {
  type BrainItem,
  DEFAULT_BRAIN_ITEM_CATEGORY,
  DEFAULT_BRAIN_ITEM_TYPE,
} from "@/features/brain/types";
import { sendTelegramMessage } from "@/features/telegram/telegram-client";
import { parseTelegramUpdate } from "@/features/telegram/parser";
import type { TelegramUpdate } from "@/features/telegram/types";

const jsonHeaders = {
  "Content-Type": "application/json",
};
const TELEGRAM_ITEM_TEXT_LIMIT = 90;

function okResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: jsonHeaders,
  });
}

export async function GET() {
  return okResponse();
}

function formatBrainItemsList(
  items: { rawText: string; category: string; type: string }[]
): string {
  const lines = items.map((item, index) => {
    const compactText = item.rawText.replace(/\s+/g, " ").trim();
    const category = item.category || DEFAULT_BRAIN_ITEM_CATEGORY;
    const type = item.type || DEFAULT_BRAIN_ITEM_TYPE;

    return `${index + 1}. [${category}/${type}] ${compactText}`;
  });

  return ["🧠 Последние записи:", ...lines].join("\n");
}

function truncateTelegramItemText(text: string, maxLength: number): string {
  const symbols = Array.from(text);

  if (symbols.length <= maxLength) {
    return text;
  }

  return `${symbols.slice(0, maxLength - 1).join("").trimEnd()}…`;
}

function formatInboxItemsList(items: { rawText: string; type: string }[]): string {
  const lines = items.map((item, index) => {
    const compactText = truncateTelegramItemText(
      item.rawText.replace(/\s+/g, " ").trim(),
      TELEGRAM_ITEM_TEXT_LIMIT
    );
    const type = item.type || DEFAULT_BRAIN_ITEM_TYPE;

    return `${index + 1}. [${type}] ${compactText}`;
  });

  return ["📥 Inbox:", ...lines].join("\n");
}

function formatBrainItemValue(value: string | null | undefined, fallback: string): string {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : fallback;
}

function formatBrainItemTags(tags: string[] | null | undefined): string {
  if (!tags || tags.length === 0) {
    return "—";
  }

  const normalizedTags = tags.map((tag) => tag.trim()).filter(Boolean);
  return normalizedTags.length > 0 ? normalizedTags.join(", ") : "—";
}

function formatBrainItemSummary(summary: string | null | undefined): string {
  const normalizedSummary = summary?.trim();
  return normalizedSummary ? normalizedSummary : "—";
}

function formatLatestBrainItem(item: BrainItem): string {
  return [
    "🧠 Последняя запись",
    "",
    "Текст:",
    formatBrainItemValue(item.rawText, "—"),
    "",
    `Категория: ${formatBrainItemValue(item.category, DEFAULT_BRAIN_ITEM_CATEGORY)}`,
    `Тип: ${formatBrainItemValue(item.type, DEFAULT_BRAIN_ITEM_TYPE)}`,
    `Теги: ${formatBrainItemTags(item.tags)}`,
    "Summary:",
    formatBrainItemSummary(item.summary),
  ].join("\n");
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
  const isInbox = isInboxCommand(parsedMessage.text);
  const isLast = isLastCommand(parsedMessage.text);

  if (!isSave && !isList && !isInbox && !isLast) {
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
      await tryClassifyBrainItem(brainItem);

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

  if (isInbox) {
    try {
      const items = await getInboxBrainItems(10);

      if (items.length === 0) {
        await sendTelegramMessage(
          parsedMessage.chatId,
          "📥 Inbox пуст. Новые неразобранные записи появятся здесь."
        );
        return okResponse();
      }

      await sendTelegramMessage(parsedMessage.chatId, formatInboxItemsList(items));
    } catch (error) {
      console.error("Telegram /inbox failed", {
        chatId: parsedMessage.chatId,
        messageId: parsedMessage.messageId,
        error,
      });

      await sendTelegramMessage(
        parsedMessage.chatId,
        "Не смог загрузить Inbox. Попробуй позже."
      );
    }

    return okResponse();
  }

  if (isLast) {
    try {
      const item = await getLatestBrainItem();

      if (!item) {
        await sendTelegramMessage(
          parsedMessage.chatId,
          "Во втором мозге пока нет записей. Добавь первую через /save"
        );
        return okResponse();
      }

      await sendTelegramMessage(parsedMessage.chatId, formatLatestBrainItem(item));
    } catch (error) {
      console.error("Telegram /last failed", {
        chatId: parsedMessage.chatId,
        messageId: parsedMessage.messageId,
        error,
      });

      await sendTelegramMessage(
        parsedMessage.chatId,
        "Не смог загрузить последнюю запись. Попробуй позже."
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
