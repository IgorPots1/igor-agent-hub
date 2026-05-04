import type { TelegramUpdate } from "@/features/telegram/types";

export type ParsedTelegramUpdate = {
  updateId: number;
  chatId: number;
  userId: number | null;
  username: string | null;
  text: string | null;
  voice: {
    fileId: string;
    duration: number;
    mimeType: string | null;
    fileSize: number | null;
  } | null;
  messageId: number;
  isForwarded: boolean;
};

export function parseTelegramUpdate(
  update: TelegramUpdate
): ParsedTelegramUpdate | null {
  const message = update.message;
  const text = message?.text?.trim() || message?.caption?.trim() || null;
  const isForwarded = Boolean(
    message?.forward_origin ||
      message?.forward_from ||
      message?.forward_sender_name ||
      message?.forward_from_chat
  );

  if (!message) {
    return null;
  }

  return {
    updateId: update.update_id,
    chatId: message.chat.id,
    userId: message.from?.id ?? null,
    username: message.from?.username ?? null,
    text,
    voice: message.voice
      ? {
          fileId: message.voice.file_id,
          duration: message.voice.duration,
          mimeType: message.voice.mime_type ?? null,
          fileSize: message.voice.file_size ?? null,
        }
      : null,
    messageId: message.message_id,
    isForwarded,
  };
}
