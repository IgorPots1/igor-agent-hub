import OpenAI, { toFile } from "openai";
import path from "node:path";

import { parseManualReminder } from "@/features/reminders/service";
import type { ParsedTelegramUpdate } from "@/features/telegram/parser";
import { handleTelegramCommand } from "@/features/telegram/command-handler";
import {
  downloadTelegramFile,
  getTelegramFile,
  sendTelegramMessage,
} from "@/features/telegram/telegram-client";

const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const TELEGRAM_VOICE_SOURCE = "telegram_voice";
const TELEGRAM_VOICE_TAG = "voice";
const MAX_TELEGRAM_VOICE_DURATION_SECONDS = 120;
const TRANSCRIPTION_FAILED_MESSAGE =
  "Не смог распознать голосовое. Попробуй ещё раз или напиши текстом.";
const TRANSCRIPTION_UNAVAILABLE_MESSAGE =
  "Голосовые пока недоступны: не настроено распознавание.";
const MAX_TRANSCRIPT_PREVIEW_LENGTH = 90;
const TELEGRAM_VOICE_UPLOAD_FILE_NAME = "voice.ogg";
const TELEGRAM_VOICE_UPLOAD_MIME_TYPE = "audio/ogg";

function getOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  return apiKey;
}

function getTranscriptionModel(): string {
  return process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_OPENAI_TRANSCRIPTION_MODEL;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForMatching(value: string): string {
  return normalizeWhitespace(
    value
      .toLocaleLowerCase("ru")
      .replace(/ё/g, "е")
      .replace(/[.,!?;:()[\]"]/g, " ")
  );
}

function truncateText(text: string, maxLength: number): string {
  const symbols = Array.from(text);

  if (symbols.length <= maxLength) {
    return text;
  }

  return `${symbols.slice(0, maxLength - 1).join("").trimEnd()}…`;
}

function getSanitizedErrorDetails(error: unknown): {
  name: string;
  message: string;
  status: number | string | null;
  code: number | string | null;
} {
  if (error instanceof Error) {
    const errorWithMetadata = error as Error & {
      status?: number | string;
      code?: number | string;
    };

    return {
      name: error.name,
      message: error.message,
      status: errorWithMetadata.status ?? null,
      code: errorWithMetadata.code ?? null,
    };
  }

  return {
    name: "UnknownError",
    message: typeof error === "string" ? error : "Unknown error",
    status: null,
    code: null,
  };
}

function buildVoiceReplyPrefix(transcript: string): string {
  return `🎙️ Распознал: ${truncateText(transcript, MAX_TRANSCRIPT_PREVIEW_LENGTH)}`;
}

function extractCommandPayload(transcript: string, pattern: RegExp): string | null {
  const payload = normalizeWhitespace(transcript.replace(pattern, ""));
  return payload || null;
}

function normalizeSaveVoiceCommand(transcript: string): string | null {
  const payload = extractCommandPayload(
    transcript,
    /^(?:сохрани|запиши|добавь)(?:\s+во\s+второй\s+мозг)?(?:\s+|$)/iu
  );

  if (!payload) {
    return null;
  }

  return `/save ${payload}`;
}

function normalizeSearchVoiceCommand(transcript: string): string | null {
  const payload = extractCommandPayload(transcript, /^(?:найди|поиск|поищи)(?:\s+|$)/iu);

  if (!payload) {
    return null;
  }

  return `/search ${payload}`;
}

function normalizeReminderVoiceCommand(transcript: string): string | null {
  const explicitReminderPatterns = [
    /^(?:пожалуйста\s+напомни)(?:\s+|$)/iu,
    /^(?:напомни\s+пожалуйста)(?:\s+|$)/iu,
    /^(?:напомнить)(?:\s+|$)/iu,
    /^(?:напомни)(?:\s+|$)/iu,
  ];

  for (const pattern of explicitReminderPatterns) {
    const payload = extractCommandPayload(transcript, pattern);

    if (payload) {
      return `/remind ${payload}`;
    }
  }

  if (!parseManualReminder(transcript)) {
    return null;
  }

  return `/remind ${normalizeWhitespace(transcript)}`;
}

function getTelegramVoiceUploadFileName(filePath: string | null | undefined): string {
  const extension = path.extname(filePath ?? "").toLowerCase();

  if (extension === ".oga" || extension === ".ogg") {
    return TELEGRAM_VOICE_UPLOAD_FILE_NAME;
  }

  return TELEGRAM_VOICE_UPLOAD_FILE_NAME;
}

function getTelegramVoiceUploadMimeType(mimeType: string | null | undefined): string {
  const normalizedMimeType = mimeType?.trim().toLowerCase();

  if (!normalizedMimeType || normalizedMimeType === "application/octet-stream") {
    return TELEGRAM_VOICE_UPLOAD_MIME_TYPE;
  }

  return normalizedMimeType;
}

export function normalizeVoiceTranscriptToCommand(transcript: string): string | null {
  const normalizedTranscript = normalizeWhitespace(transcript);
  const normalizedForMatching = normalizeForMatching(normalizedTranscript);

  if (!normalizedTranscript) {
    return null;
  }

  if (
    /^(?:summary|итоги|сводка)(?:\s+за)?\s+сегодня$/iu.test(normalizedForMatching) ||
    /^(?:summary|итоги|сводка)\s+today$/iu.test(normalizedForMatching)
  ) {
    return "/summary today";
  }

  if (
    /^(?:summary|итоги|сводка)(?:\s+за)?\s+(?:эту\s+)?недел(?:ю|я)$/iu.test(
      normalizedForMatching
    ) ||
    /^(?:summary|итоги|сводка)\s+week$/iu.test(normalizedForMatching)
  ) {
    return "/summary week";
  }

  if (
    normalizedForMatching === "покажи напоминания" ||
    normalizedForMatching === "какие есть напоминания" ||
    normalizedForMatching.includes("покажи напоминани") ||
    normalizedForMatching.includes("какие есть напоминани") ||
    normalizedForMatching === "напоминания"
  ) {
    return "/reminders";
  }

  const reminderCommand = normalizeReminderVoiceCommand(normalizedTranscript);

  if (reminderCommand) {
    return reminderCommand;
  }

  if (
    normalizedForMatching.includes("инбокс") ||
    normalizedForMatching.includes("inbox") ||
    normalizedForMatching.includes("неразобран")
  ) {
    return "/inbox";
  }

  if (
    normalizedForMatching === "покажи последнюю запись" ||
    normalizedForMatching === "последняя запись" ||
    (normalizedForMatching.includes("последн") && normalizedForMatching.includes("запис")) ||
    normalizedForMatching === "что я только что сохранил"
  ) {
    return "/last";
  }

  if (
    normalizedForMatching === "покажи последние записи" ||
    normalizedForMatching === "последние записи" ||
    normalizedForMatching.includes("последние записи") ||
    normalizedForMatching === "что я сохранял"
  ) {
    return "/list";
  }

  if (
    normalizedForMatching === "помощь" ||
    normalizedForMatching === "что ты умеешь" ||
    normalizedForMatching === "покажи команды" ||
    normalizedForMatching.includes("что ты умеешь") ||
    normalizedForMatching.includes("покажи команды")
  ) {
    return "/help";
  }

  if (normalizedForMatching.includes("статистика")) {
    return "/stats";
  }

  const searchCommand = normalizeSearchVoiceCommand(normalizedTranscript);

  if (searchCommand) {
    return searchCommand;
  }

  const saveCommand = normalizeSaveVoiceCommand(normalizedTranscript);

  if (saveCommand) {
    return saveCommand;
  }

  return null;
}

async function transcribeTelegramVoice(
  voiceData: Buffer,
  fileName: string,
  mimeType: string | null
): Promise<string> {
  const client = new OpenAI({
    apiKey: getOpenAiApiKey(),
  });
  const audioFile = await toFile(voiceData, fileName, {
    type: mimeType ?? "audio/ogg",
  });
  const response = await client.audio.transcriptions.create({
    file: audioFile,
    model: getTranscriptionModel(),
    language: "ru",
  });

  return normalizeWhitespace(response.text ?? "");
}

export async function handleTelegramVoiceMessage(
  parsedMessage: ParsedTelegramUpdate
): Promise<void> {
  if (!parsedMessage.voice) {
    return;
  }

  if (parsedMessage.voice.duration > MAX_TELEGRAM_VOICE_DURATION_SECONDS) {
    await sendTelegramMessage(
      parsedMessage.chatId,
      "Голосовое слишком длинное для v1. Отправь до 120 секунд или напиши текстом."
    );
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("Telegram voice handling is unavailable: OPENAI_API_KEY is missing");
    await sendTelegramMessage(parsedMessage.chatId, TRANSCRIPTION_UNAVAILABLE_MESSAGE);
    return;
  }

  const transcriptionModel = getTranscriptionModel();
  let hasFilePath = false;
  let downloadedBytes = 0;
  let uploadFileName = TELEGRAM_VOICE_UPLOAD_FILE_NAME;
  let uploadMimeType = TELEGRAM_VOICE_UPLOAD_MIME_TYPE;

  console.info("Telegram voice handling started", {
    duration: parsedMessage.voice.duration,
    fileId: parsedMessage.voice.fileId,
    hasFilePath,
    downloadedBytes,
    transcriptionModel,
  });

  try {
    const telegramFile = await getTelegramFile(parsedMessage.voice.fileId);
    hasFilePath = Boolean(telegramFile.filePath);

    console.info("Telegram voice file resolved", {
      duration: parsedMessage.voice.duration,
      fileId: parsedMessage.voice.fileId,
      hasFilePath,
      downloadedBytes,
      transcriptionModel,
    });

    if (!telegramFile.filePath) {
      throw new Error("Telegram getFile returned no file_path");
    }

    const downloadedFile = await downloadTelegramFile(telegramFile.filePath);
    downloadedBytes = downloadedFile.buffer.byteLength;
    uploadFileName = getTelegramVoiceUploadFileName(telegramFile.filePath);
    uploadMimeType = getTelegramVoiceUploadMimeType(
      parsedMessage.voice.mimeType ?? downloadedFile.contentType
    );

    console.info("Telegram voice file downloaded", {
      duration: parsedMessage.voice.duration,
      fileId: parsedMessage.voice.fileId,
      hasFilePath,
      downloadedBytes,
      uploadFileName,
      uploadMimeType,
      transcriptionModel,
    });

    const transcript = await transcribeTelegramVoice(
      downloadedFile.buffer,
      uploadFileName,
      uploadMimeType
    );

    if (!transcript) {
      throw new Error("OpenAI transcription returned an empty transcript");
    }

    const normalizedCommand = normalizeVoiceTranscriptToCommand(transcript);

    if (!normalizedCommand) {
      await handleTelegramCommand(parsedMessage, {
        fallbackSave: {
          rawText: transcript,
          source: TELEGRAM_VOICE_SOURCE,
          tags: [TELEGRAM_VOICE_TAG],
          successMessage: "🎙️ Расшифровал и сохранил во второй мозг",
          preserveTagsForClassification: [TELEGRAM_VOICE_TAG],
        },
      });
      return;
    }

    const isVoiceSaveCommand = normalizedCommand.startsWith("/save");

    await handleTelegramCommand(parsedMessage, {
      messageText: normalizedCommand,
      brainItemSource: TELEGRAM_VOICE_SOURCE,
      brainItemTags: [TELEGRAM_VOICE_TAG],
      saveSuccessMessage: "🎙️ Расшифровал и сохранил во второй мозг",
      replyPrefix: isVoiceSaveCommand ? null : buildVoiceReplyPrefix(transcript),
    });

    console.info("Telegram voice handling completed", {
      duration: parsedMessage.voice.duration,
      fileId: parsedMessage.voice.fileId,
      hasFilePath,
      downloadedBytes,
      uploadFileName,
      uploadMimeType,
      transcriptionModel,
    });
  } catch (error) {
    console.error("Telegram voice handling failed", {
      chatId: parsedMessage.chatId,
      messageId: parsedMessage.messageId,
      duration: parsedMessage.voice.duration,
      fileId: parsedMessage.voice.fileId,
      hasFilePath,
      downloadedBytes,
      uploadFileName,
      uploadMimeType,
      transcriptionModel,
      error: getSanitizedErrorDetails(error),
    });

    await sendTelegramMessage(parsedMessage.chatId, TRANSCRIPTION_FAILED_MESSAGE);
  }
}
