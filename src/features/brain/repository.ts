import type {
  BrainItem,
  BrainItemClassification,
  CreateBrainItemInput,
} from "@/features/brain/types";
import {
  DEFAULT_BRAIN_ITEM_CATEGORY,
  DEFAULT_BRAIN_ITEM_SOURCE,
  DEFAULT_BRAIN_ITEM_STATUS,
  DEFAULT_BRAIN_ITEM_TYPE,
} from "@/features/brain/types";
import { createSupabaseServerClient } from "@/features/supabase/server";

type BrainItemRow = {
  id: string;
  raw_text: string;
  cleaned_text: string | null;
  summary: string | null;
  type: string | null;
  category: string | null;
  project: string | null;
  topic: string | null;
  tags: string[] | null;
  source: string | null;
  telegram_chat_id: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  telegram_message_id: string | null;
  no_export: boolean | null;
  status: string | null;
  created_at: string;
};

const REMINDER_BRAIN_ITEM_TYPE = "reminder";
const OPS_LOG_BRAIN_ITEM_TYPE = "ops_log";
const MANUAL_REMINDER_TAG = "напоминание";
const SYSTEM_REMINDER_SOURCES = new Set(["telegram_reminder", "system_reminder"]);

function mapBrainItemRow(row: BrainItemRow): BrainItem {
  return {
    id: row.id,
    rawText: row.raw_text,
    cleanedText: row.cleaned_text,
    summary: row.summary,
    type: row.type ?? DEFAULT_BRAIN_ITEM_TYPE,
    category: row.category ?? DEFAULT_BRAIN_ITEM_CATEGORY,
    project: row.project,
    topic: row.topic,
    tags: row.tags ?? [],
    source: row.source ?? DEFAULT_BRAIN_ITEM_SOURCE,
    telegramChatId: row.telegram_chat_id,
    telegramUserId: row.telegram_user_id,
    telegramUsername: row.telegram_username,
    telegramMessageId: row.telegram_message_id,
    noExport: row.no_export ?? false,
    status: row.status ?? DEFAULT_BRAIN_ITEM_STATUS,
    createdAt: row.created_at,
  };
}

type BrainItemFilterable = Pick<
  BrainItem,
  "category" | "source" | "status" | "tags" | "type" | "noExport"
>;

function normalizeBrainItemValue(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase("ru") ?? "";
}

export function isActiveBrainItem(item: BrainItemFilterable): boolean {
  const normalizedStatus = normalizeBrainItemValue(item.status);
  return !normalizedStatus || normalizedStatus === DEFAULT_BRAIN_ITEM_STATUS;
}

export function isReminderBrainItem(item: BrainItemFilterable): boolean {
  if (normalizeBrainItemValue(item.type) === REMINDER_BRAIN_ITEM_TYPE) {
    return true;
  }

  if (SYSTEM_REMINDER_SOURCES.has(normalizeBrainItemValue(item.source))) {
    return true;
  }

  return item.tags.some((tag) => normalizeBrainItemValue(tag) === MANUAL_REMINDER_TAG);
}

export function isOpsLogBrainItem(item: Pick<BrainItemFilterable, "type">): boolean {
  return normalizeBrainItemValue(item.type) === OPS_LOG_BRAIN_ITEM_TYPE;
}

export function isKnowledgeBrainItem(item: BrainItemFilterable): boolean {
  return (
    isActiveBrainItem(item) &&
    !item.noExport &&
    !isReminderBrainItem(item) &&
    !isOpsLogBrainItem(item)
  );
}

export function isInboxBrainItem(item: BrainItemFilterable): boolean {
  const normalizedCategory = item.category?.trim() || DEFAULT_BRAIN_ITEM_CATEGORY;
  return isKnowledgeBrainItem(item) && normalizedCategory === DEFAULT_BRAIN_ITEM_CATEGORY;
}

function filterKnowledgeBrainItems(items: BrainItem[]): BrainItem[] {
  return items.filter(isKnowledgeBrainItem);
}

async function listLatestFilteredBrainItems(
  limit: number,
  predicate: (item: BrainItem) => boolean
): Promise<BrainItem[]> {
  const supabase = createSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const pageSize = Math.min(Math.max(safeLimit * 3, 20), 100);
  const items: BrainItem[] = [];
  let from = 0;

  while (items.length < safeLimit) {
    const { data, error } = await supabase
      .from("brain_items")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to list latest brain items: ${error.message}`);
    }

    const rows = (data as BrainItemRow[]) ?? [];

    if (rows.length === 0) {
      break;
    }

    items.push(...rows.map(mapBrainItemRow).filter(predicate));

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return items.slice(0, safeLimit);
}

function escapeOrFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildIlikePattern(value: string): string {
  const escapedValue = escapeOrFilterValue(value)
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

  return `"%${escapedValue}%"`;
}

export async function createBrainItem(
  input: CreateBrainItemInput
): Promise<BrainItem> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("brain_items")
    .insert({
      raw_text: input.rawText,
      cleaned_text: input.cleanedText ?? null,
      summary: input.summary ?? null,
      type: input.type ?? DEFAULT_BRAIN_ITEM_TYPE,
      category: input.category ?? DEFAULT_BRAIN_ITEM_CATEGORY,
      project: input.project ?? null,
      topic: input.topic ?? null,
      tags: input.tags ?? [],
      source: input.source ?? DEFAULT_BRAIN_ITEM_SOURCE,
      telegram_chat_id: input.telegramChatId ?? null,
      telegram_user_id: input.telegramUserId ?? null,
      telegram_username: input.telegramUsername ?? null,
      telegram_message_id: input.telegramMessageId ?? null,
      no_export: input.noExport ?? false,
      status: input.status ?? DEFAULT_BRAIN_ITEM_STATUS,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create brain item: ${error.message}`);
  }

  return mapBrainItemRow(data as BrainItemRow);
}

export async function listLatestBrainItems(limit = 5): Promise<BrainItem[]> {
  return listLatestFilteredBrainItems(limit, isActiveBrainItem);
}

export async function listLatestKnowledgeBrainItems(limit = 5): Promise<BrainItem[]> {
  return listLatestFilteredBrainItems(limit, isKnowledgeBrainItem);
}

export async function listActiveBrainItemsSince(
  sinceIso: string,
  limit = 50
): Promise<BrainItem[]> {
  const supabase = createSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const { data, error } = await supabase
    .from("brain_items")
    .select("*")
    .eq("status", DEFAULT_BRAIN_ITEM_STATUS)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Failed to list active brain items since ${sinceIso}: ${error.message}`);
  }

  return (data as BrainItemRow[]).map(mapBrainItemRow);
}

export async function listActiveKnowledgeBrainItemsSince(
  sinceIso: string,
  limit = 50
): Promise<BrainItem[]> {
  const supabase = createSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const pageSize = Math.min(Math.max(safeLimit * 3, 50), 200);
  const items: BrainItem[] = [];
  let from = 0;

  while (items.length < safeLimit) {
    const { data, error } = await supabase
      .from("brain_items")
      .select("*")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(
        `Failed to list active knowledge brain items since ${sinceIso}: ${error.message}`
      );
    }

    const rows = (data as BrainItemRow[]) ?? [];

    if (rows.length === 0) {
      break;
    }

    items.push(...filterKnowledgeBrainItems(rows.map(mapBrainItemRow)));

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return items.slice(0, safeLimit);
}

export async function listActiveBrainItemsForStats(limit = 500): Promise<BrainItem[]> {
  const supabase = createSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 1000);

  const { data, error } = await supabase
    .from("brain_items")
    .select("*")
    .eq("status", DEFAULT_BRAIN_ITEM_STATUS)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Failed to list active brain items for stats: ${error.message}`);
  }

  return (data as BrainItemRow[]).map(mapBrainItemRow);
}

export async function listAllActiveBrainItems(): Promise<BrainItem[]> {
  const supabase = createSupabaseServerClient();
  const pageSize = 1000;
  const items: BrainItem[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("brain_items")
      .select("*")
      .eq("status", DEFAULT_BRAIN_ITEM_STATUS)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to list active brain items for export: ${error.message}`);
    }

    const rows = (data as BrainItemRow[]) ?? [];
    items.push(...rows.map(mapBrainItemRow));

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return items;
}

export async function listAllActiveKnowledgeBrainItems(): Promise<BrainItem[]> {
  const supabase = createSupabaseServerClient();
  const pageSize = 1000;
  const items: BrainItem[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("brain_items")
      .select("*")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to list knowledge brain items for export: ${error.message}`);
    }

    const rows = (data as BrainItemRow[]) ?? [];
    items.push(...filterKnowledgeBrainItems(rows.map(mapBrainItemRow)));

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return items;
}

export async function getLatestBrainItem(): Promise<BrainItem | null> {
  const [item] = await listLatestBrainItems(1);
  return item ?? null;
}

export async function getLatestKnowledgeBrainItem(): Promise<BrainItem | null> {
  const [item] = await listLatestKnowledgeBrainItems(1);
  return item ?? null;
}

export async function listInboxBrainItems(limit = 10): Promise<BrainItem[]> {
  const supabase = createSupabaseServerClient();

  const inboxFilter = [
    `and(category.eq.${DEFAULT_BRAIN_ITEM_CATEGORY},status.eq.${DEFAULT_BRAIN_ITEM_STATUS})`,
    `and(category.is.null,status.eq.${DEFAULT_BRAIN_ITEM_STATUS})`,
    `and(category.eq.${DEFAULT_BRAIN_ITEM_CATEGORY},status.is.null)`,
    "and(category.is.null,status.is.null)",
  ].join(",");

  const { data, error } = await supabase
    .from("brain_items")
    .select("*")
    .or(inboxFilter)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list inbox brain items: ${error.message}`);
  }

  return (data as BrainItemRow[]).map(mapBrainItemRow);
}

export async function listInboxKnowledgeBrainItems(limit = 10): Promise<BrainItem[]> {
  const supabase = createSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const pageSize = Math.min(Math.max(safeLimit * 3, 20), 100);
  const items: BrainItem[] = [];
  let from = 0;

  while (items.length < safeLimit) {
    const { data, error } = await supabase
      .from("brain_items")
      .select("*")
      .or(`category.eq.${DEFAULT_BRAIN_ITEM_CATEGORY},category.is.null`)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to list inbox knowledge brain items: ${error.message}`);
    }

    const rows = (data as BrainItemRow[]) ?? [];

    if (rows.length === 0) {
      break;
    }

    items.push(...rows.map(mapBrainItemRow).filter(isInboxBrainItem));

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return items.slice(0, safeLimit);
}

export async function searchBrainItems(query: string, limit = 10): Promise<BrainItem[]> {
  const supabase = createSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 10);
  const ilikePattern = buildIlikePattern(query);
  const searchFilter = [
    `raw_text.ilike.${ilikePattern}`,
    `summary.ilike.${ilikePattern}`,
    `category.ilike.${ilikePattern}`,
    `type.ilike.${ilikePattern}`,
  ].join(",");

  const { data, error } = await supabase
    .from("brain_items")
    .select("*")
    .eq("status", DEFAULT_BRAIN_ITEM_STATUS)
    .or(searchFilter)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Failed to search brain items: ${error.message}`);
  }

  const directMatches = (data as BrainItemRow[]).map(mapBrainItemRow);

  if (directMatches.length >= safeLimit) {
    return directMatches;
  }

  const { data: tagRows, error: tagError } = await supabase
    .from("brain_items")
    .select("*")
    .eq("status", DEFAULT_BRAIN_ITEM_STATUS)
    .order("created_at", { ascending: false })
    .limit(100);

  if (tagError) {
    throw new Error(`Failed to search brain item tags: ${tagError.message}`);
  }

  const normalizedQuery = query.toLocaleLowerCase();
  const tagMatches = (tagRows as BrainItemRow[])
    .map(mapBrainItemRow)
    .filter((item) =>
      item.tags.some((tag) => tag.toLocaleLowerCase().includes(normalizedQuery))
    );

  const mergedMatches = new Map<string, BrainItem>();

  for (const item of [...directMatches, ...tagMatches]) {
    mergedMatches.set(item.id, item);
  }

  return Array.from(mergedMatches.values())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, safeLimit);
}

export async function searchKnowledgeBrainItems(query: string, limit = 10): Promise<BrainItem[]> {
  const supabase = createSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 10);
  const ilikePattern = buildIlikePattern(query);
  const searchFilter = [
    `raw_text.ilike.${ilikePattern}`,
    `summary.ilike.${ilikePattern}`,
    `category.ilike.${ilikePattern}`,
    `type.ilike.${ilikePattern}`,
  ].join(",");

  const { data, error } = await supabase
    .from("brain_items")
    .select("*")
    .or(searchFilter)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Failed to search knowledge brain items: ${error.message}`);
  }

  const directMatches = filterKnowledgeBrainItems((data as BrainItemRow[]).map(mapBrainItemRow));

  if (directMatches.length >= safeLimit) {
    return directMatches.slice(0, safeLimit);
  }

  const { data: tagRows, error: tagError } = await supabase
    .from("brain_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (tagError) {
    throw new Error(`Failed to search knowledge brain item tags: ${tagError.message}`);
  }

  const normalizedQuery = query.toLocaleLowerCase("ru");
  const tagMatches = filterKnowledgeBrainItems((tagRows as BrainItemRow[]).map(mapBrainItemRow)).filter(
    (item) => item.tags.some((tag) => tag.toLocaleLowerCase("ru").includes(normalizedQuery))
  );

  const mergedMatches = new Map<string, BrainItem>();

  for (const item of [...directMatches, ...tagMatches]) {
    mergedMatches.set(item.id, item);
  }

  return Array.from(mergedMatches.values())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, safeLimit);
}

export async function updateBrainItemClassification(
  id: string,
  classification: BrainItemClassification
): Promise<BrainItem> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("brain_items")
    .update({
      type: classification.type,
      category: classification.category,
      tags: classification.tags,
      summary: classification.summary,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update brain item classification: ${error.message}`);
  }

  return mapBrainItemRow(data as BrainItemRow);
}
