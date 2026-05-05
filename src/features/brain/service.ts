import { classifyBrainItem } from "@/features/brain/ai-classifier";
import {
  createBrainItem,
  getLatestBrainItem as getLatestBrainItemFromRepository,
  listAllActiveBrainItems,
  listActiveBrainItemsForStats,
  listActiveBrainItemsSince,
  listInboxBrainItems,
  listLatestBrainItems,
  searchBrainItems as searchBrainItemsFromRepository,
  updateBrainItemClassification,
} from "@/features/brain/repository";
import {
  getEveningReviewTag,
  getForwardedTaskCategory,
  getManualReminderTag,
} from "@/features/reminders/service";
import {
  DEFAULT_BRAIN_ITEM_CATEGORY,
  DEFAULT_BRAIN_ITEM_SOURCE,
  DEFAULT_BRAIN_ITEM_STATUS,
  DEFAULT_BRAIN_ITEM_TYPE,
} from "@/features/brain/types";
import type { BrainItem } from "@/features/brain/types";
import type { ParsedTelegramUpdate } from "@/features/telegram/parser";

const SAVE_COMMAND_PATTERN = /^\/save(?:@\w+)?(?:\s+|$)/;
const LIST_COMMAND_PATTERN = /^\/list(?:@\w+)?(?:\s+|$)/;
const INBOX_COMMAND_PATTERN = /^\/inbox(?:@\w+)?(?:\s+|$)/;
const LAST_COMMAND_PATTERN = /^\/last(?:@\w+)?(?:\s+|$)/;
const SEARCH_COMMAND_PATTERN = /^\/search(?:@\w+)?(?:\s+|$)/;
const HELP_COMMAND_PATTERN = /^\/help(?:@\w+)?(?:\s+|$)/;
const SUMMARY_COMMAND_PATTERN = /^\/summary(?:@\w+)?(?:\s+|$)/;
const STATS_COMMAND_PATTERN = /^\/stats(?:@\w+)?(?:\s+|$)/;
const REMIND_COMMAND_PATTERN = /^\/remind(?:@\w+)?(?:\s+|$)/;
const REMINDERS_COMMAND_PATTERN = /^\/reminders(?:@\w+)?(?:\s+|$)/;

type TelegramBrainItemOptions = {
  rawText?: string;
  type?: string;
  category?: string;
  tags?: string[];
  source?: string;
  status?: string;
};

export function isSaveCommand(text: string): boolean {
  return SAVE_COMMAND_PATTERN.test(text);
}

export function isListCommand(text: string): boolean {
  return LIST_COMMAND_PATTERN.test(text);
}

export function isInboxCommand(text: string): boolean {
  return INBOX_COMMAND_PATTERN.test(text);
}

export function isLastCommand(text: string): boolean {
  return LAST_COMMAND_PATTERN.test(text);
}

export function isSearchCommand(text: string): boolean {
  return SEARCH_COMMAND_PATTERN.test(text);
}

export function isHelpCommand(text: string): boolean {
  return HELP_COMMAND_PATTERN.test(text);
}

export function isSummaryCommand(text: string): boolean {
  return SUMMARY_COMMAND_PATTERN.test(text);
}

export function isStatsCommand(text: string): boolean {
  return STATS_COMMAND_PATTERN.test(text);
}

export function isRemindCommand(text: string): boolean {
  return REMIND_COMMAND_PATTERN.test(text);
}

export function isRemindersCommand(text: string): boolean {
  return REMINDERS_COMMAND_PATTERN.test(text);
}

export function getSavedTelegramText(text: string): string {
  return text.replace(SAVE_COMMAND_PATTERN, "").trim();
}

export function getSearchQuery(text: string): string {
  return text.replace(SEARCH_COMMAND_PATTERN, "").trim();
}

export function getReminderCommandText(text: string): string {
  return text.replace(REMIND_COMMAND_PATTERN, "").trim();
}

export function getSummaryPeriod(text: string): "today" | "week" | null {
  const normalizedPeriod = text.replace(SUMMARY_COMMAND_PATTERN, "").trim().toLowerCase();

  if (normalizedPeriod === "today" || normalizedPeriod === "week") {
    return normalizedPeriod;
  }

  return null;
}

function getUniqueTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

export async function createTelegramBrainItem(
  parsedMessage: ParsedTelegramUpdate,
  rawText: string,
  options: TelegramBrainItemOptions = {}
): Promise<BrainItem> {
  const normalizedRawText = rawText.trim();

  if (!normalizedRawText) {
    throw new Error("Telegram brain item is missing note content");
  }

  return createBrainItem({
    rawText: normalizedRawText,
    type: options.type ?? DEFAULT_BRAIN_ITEM_TYPE,
    category: options.category ?? DEFAULT_BRAIN_ITEM_CATEGORY,
    tags: getUniqueTags(options.tags ?? []),
    source: options.source ?? DEFAULT_BRAIN_ITEM_SOURCE,
    status: options.status ?? DEFAULT_BRAIN_ITEM_STATUS,
    telegramChatId: String(parsedMessage.chatId),
    telegramUserId: parsedMessage.userId === null ? null : String(parsedMessage.userId),
    telegramUsername: parsedMessage.username,
    telegramMessageId: String(parsedMessage.messageId),
  });
}

export async function createBrainItemFromTelegram(
  parsedMessage: ParsedTelegramUpdate,
  options: TelegramBrainItemOptions = {}
): Promise<BrainItem> {
  const rawText = options.rawText ?? getSavedTelegramText(parsedMessage.text ?? "");

  if (!rawText) {
    throw new Error("Telegram /save command is missing note content");
  }

  return createTelegramBrainItem(parsedMessage, rawText, options);
}

export async function createForwardedBrainItemFromTelegram(
  parsedMessage: ParsedTelegramUpdate
): Promise<BrainItem> {
  const rawText = parsedMessage.text?.trim();

  if (!rawText) {
    throw new Error("Forwarded Telegram message is missing text content");
  }

  return createBrainItem({
    rawText,
    type: "task",
    category: getForwardedTaskCategory(rawText),
    tags: [getEveningReviewTag()],
    source: "telegram_forward",
    status: DEFAULT_BRAIN_ITEM_STATUS,
    telegramChatId: String(parsedMessage.chatId),
    telegramUserId: parsedMessage.userId === null ? null : String(parsedMessage.userId),
    telegramUsername: parsedMessage.username,
    telegramMessageId: String(parsedMessage.messageId),
  });
}

export async function createReminderBrainItemFromTelegram(
  parsedMessage: ParsedTelegramUpdate,
  rawText: string,
  options: TelegramBrainItemOptions = {}
): Promise<BrainItem> {
  const normalizedText = rawText.trim();

  if (!normalizedText) {
    throw new Error("Telegram /remind command is missing reminder text");
  }

  return createBrainItem({
    rawText: normalizedText,
    type: options.type ?? "reminder",
    category: options.category ?? DEFAULT_BRAIN_ITEM_CATEGORY,
    tags: getUniqueTags([...(options.tags ?? []), getManualReminderTag()]),
    source: options.source ?? DEFAULT_BRAIN_ITEM_SOURCE,
    status: options.status ?? DEFAULT_BRAIN_ITEM_STATUS,
    telegramChatId: String(parsedMessage.chatId),
    telegramUserId: parsedMessage.userId === null ? null : String(parsedMessage.userId),
    telegramUsername: parsedMessage.username,
    telegramMessageId: String(parsedMessage.messageId),
  });
}

export async function tryClassifyBrainItem(
  item: BrainItem,
  options: { preserveTags?: string[] } = {}
): Promise<BrainItem | null> {
  try {
    const classification = await classifyBrainItem(item.rawText);
    const mergedTags = getUniqueTags([...(options.preserveTags ?? []), ...classification.tags]);

    return await updateBrainItemClassification(item.id, {
      ...classification,
      tags: mergedTags,
    });
  } catch (error) {
    console.error("Brain item AI classification failed", {
      brainItemId: item.id,
      error,
    });

    return null;
  }
}

export async function getLatestBrainItems(limit = 5): Promise<BrainItem[]> {
  return listLatestBrainItems(limit);
}

export async function getLatestBrainItem(): Promise<BrainItem | null> {
  return getLatestBrainItemFromRepository();
}

export async function getInboxBrainItems(limit = 10): Promise<BrainItem[]> {
  return listInboxBrainItems(limit);
}

export async function getRecentBrainItems(
  period: "today" | "week",
  limit = 50
): Promise<BrainItem[]> {
  const days = period === "today" ? 1 : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return listActiveBrainItemsSince(since.toISOString(), limit);
}

export async function getBrainItemsForStats(limit = 500): Promise<BrainItem[]> {
  return listActiveBrainItemsForStats(limit);
}

export async function getAllActiveBrainItems(): Promise<BrainItem[]> {
  return listAllActiveBrainItems();
}

export async function searchBrainItems(query: string, limit = 10): Promise<BrainItem[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  return searchBrainItemsFromRepository(normalizedQuery, limit);
}
