import OpenAI, { toFile } from "openai";
import path from "node:path";

import type { ParsedTelegramUpdate } from "@/features/telegram/parser";
import { handleTelegramCommand } from "@/features/telegram/command-handler";
import {
  normalizeWhitespace,
  routeNaturalTelegramText,
} from "@/features/telegram/natural-router";
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
const TRANSCRIPTION_EMPTY_MESSAGE =
  "Не расслышал текст в голосовом. Попробуй ещё раз или напиши текстом.";
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

    const naturalRoute = routeNaturalTelegramText(transcript);

    if (naturalRoute.kind === "ignore") {
      await sendTelegramMessage(parsedMessage.chatId, TRANSCRIPTION_EMPTY_MESSAGE);
      return;
    }

    if (naturalRoute.kind === "save") {
      await handleTelegramCommand(parsedMessage, {
        fallbackSave: {
          rawText: naturalRoute.rawText,
          source: TELEGRAM_VOICE_SOURCE,
          tags: [TELEGRAM_VOICE_TAG],
          successMessage: "🎙️ Расшифровал и сохранил во второй мозг",
          preserveTagsForClassification: [TELEGRAM_VOICE_TAG],
        },
      });
      return;
    }

    const isVoiceSaveCommand = naturalRoute.messageText.startsWith("/save");

    await handleTelegramCommand(parsedMessage, {
      messageText: naturalRoute.messageText,
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
