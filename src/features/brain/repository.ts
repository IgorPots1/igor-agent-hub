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
  status: string | null;
  created_at: string;
};

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
    status: row.status ?? DEFAULT_BRAIN_ITEM_STATUS,
    createdAt: row.created_at,
  };
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
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("brain_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list brain items: ${error.message}`);
  }

  return (data as BrainItemRow[]).map(mapBrainItemRow);
}

export async function getLatestBrainItem(): Promise<BrainItem | null> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("brain_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get latest brain item: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapBrainItemRow(data as BrainItemRow);
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
