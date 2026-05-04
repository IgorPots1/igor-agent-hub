import type { TelegramUpdate } from "@/features/telegram/types";

export type ParsedTelegramUpdate = {
  updateId: number;
  chatId: number;
  userId: number | null;
  username: string | null;
  text: string;
  messageId: number;
};

export function parseTelegramUpdate(
  update: TelegramUpdate
): ParsedTelegramUpdate | null {
  const message = update.message;
  const text = message?.text?.trim();

  if (!message || !text) {
    return null;
  }

  return {
    updateId: update.update_id,
    chatId: message.chat.id,
    userId: message.from?.id ?? null,
    username: message.from?.username ?? null,
    text,
    messageId: message.message_id
  };
}
