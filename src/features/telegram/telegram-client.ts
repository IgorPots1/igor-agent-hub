const TELEGRAM_API_BASE_URL = "https://api.telegram.org";

export type TelegramReplyKeyboardMarkup = {
  keyboard: string[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  is_persistent?: boolean;
  input_field_placeholder?: string;
  selective?: boolean;
};

type TelegramApiSuccess<T> = {
  ok: true;
  result: T;
};

type TelegramApiFailure = {
  ok: false;
  description?: string;
};

type TelegramApiResponse<T> = TelegramApiSuccess<T> | TelegramApiFailure;

type TelegramFile = {
  file_id: string;
  file_unique_id: string;
  file_path?: string;
  file_size?: number;
};

function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set");
  }

  return token;
}

type SendTelegramMessageOptions = {
  replyMarkup?: TelegramReplyKeyboardMarkup;
};

async function postTelegramMessage(
  chatId: string | number,
  text: string,
  options: SendTelegramMessageOptions = {}
): Promise<void> {
  const token = getTelegramBotToken();

  const response = await fetch(`${TELEGRAM_API_BASE_URL}/bot${token}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: options.replyMarkup,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram sendMessage failed (${response.status}): ${errorText}`);
  }
}

async function callTelegramApi<T>(
  method: string,
  body: Record<string, unknown>
): Promise<T> {
  const token = getTelegramBotToken();

  const response = await fetch(`${TELEGRAM_API_BASE_URL}/bot${token}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram ${method} failed (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as TelegramApiResponse<T>;

  if (!payload.ok) {
    throw new Error(`Telegram ${method} failed: ${payload.description ?? "Unknown error"}`);
  }

  return payload.result;
}

export async function getTelegramFile(fileId: string): Promise<{
  fileId: string;
  fileUniqueId: string;
  filePath: string | null;
  fileSize: number | null;
}> {
  const result = await callTelegramApi<TelegramFile>("getFile", {
    file_id: fileId,
  });

  return {
    fileId: result.file_id,
    fileUniqueId: result.file_unique_id,
    filePath: result.file_path ?? null,
    fileSize: result.file_size ?? null,
  };
}

export async function downloadTelegramFile(filePath: string): Promise<{
  buffer: Buffer;
  contentType: string | null;
}> {
  const token = getTelegramBotToken();
  const response = await fetch(`${TELEGRAM_API_BASE_URL}/file/bot${token}/${encodeURI(filePath)}`);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram file download failed (${response.status}): ${errorText}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type"),
  };
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: SendTelegramMessageOptions = {}
) {
  try {
    await postTelegramMessage(chatId, text, options);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while sending Telegram message";

    console.error("Telegram sendMessage request failed", {
      chatId,
      error: message,
    });
  }
}

export async function sendTelegramMessageOrThrow(
  chatId: string | number,
  text: string,
  options: SendTelegramMessageOptions = {}
) {
  await postTelegramMessage(chatId, text, options);
}
