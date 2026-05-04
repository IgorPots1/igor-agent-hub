import { classifyBrainItem } from "@/features/brain/ai-classifier";
import {
  createBrainItem,
  getLatestBrainItem as getLatestBrainItemFromRepository,
  listInboxBrainItems,
  listLatestBrainItems,
  searchBrainItems as searchBrainItemsFromRepository,
  updateBrainItemClassification,
} from "@/features/brain/repository";
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

export function getSavedTelegramText(text: string): string {
  return text.replace(SAVE_COMMAND_PATTERN, "").trim();
}

export function getSearchQuery(text: string): string {
  return text.replace(SEARCH_COMMAND_PATTERN, "").trim();
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
    type: DEFAULT_BRAIN_ITEM_TYPE,
    category: DEFAULT_BRAIN_ITEM_CATEGORY,
    tags: [],
    source: DEFAULT_BRAIN_ITEM_SOURCE,
    status: DEFAULT_BRAIN_ITEM_STATUS,
    telegramChatId: String(parsedMessage.chatId),
    telegramUserId: parsedMessage.userId === null ? null : String(parsedMessage.userId),
    telegramUsername: parsedMessage.username,
    telegramMessageId: String(parsedMessage.messageId),
  });
}

export async function tryClassifyBrainItem(item: BrainItem): Promise<BrainItem | null> {
  try {
    const classification = await classifyBrainItem(item.rawText);
    return await updateBrainItemClassification(item.id, classification);
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

export async function searchBrainItems(query: string, limit = 10): Promise<BrainItem[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  return searchBrainItemsFromRepository(normalizedQuery, limit);
}
