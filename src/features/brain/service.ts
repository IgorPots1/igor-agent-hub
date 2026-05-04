import { createBrainItem } from "@/features/brain/repository";
import type { BrainItem } from "@/features/brain/types";
import type { ParsedTelegramUpdate } from "@/features/telegram/parser";

const SAVE_COMMAND_PATTERN = /^\/save(?:@\w+)?(?:\s+|$)/;

export function isSaveCommand(text: string): boolean {
  return SAVE_COMMAND_PATTERN.test(text);
}

export function getSavedTelegramText(text: string): string {
  return text.replace(SAVE_COMMAND_PATTERN, "").trim();
}

export async function createBrainItemFromTelegram(
  parsedMessage: ParsedTelegramUpdate
): Promise<BrainItem> {
  const rawText = getSavedTelegramText(parsedMessage.text);

  if (!rawText) {
    throw new Error("Telegram /save command is missing note content");
  }

  return createBrainItem({
    rawText,
    source: "telegram",
    status: "inbox",
    telegramChatId: String(parsedMessage.chatId),
    telegramUserId: parsedMessage.userId === null ? null : String(parsedMessage.userId),
    telegramUsername: parsedMessage.username,
    telegramMessageId: String(parsedMessage.messageId),
  });
}
