import type { CreateBrainItemInput, BrainItem } from "@/features/brain/types";
import { createSupabaseServerClient } from "@/features/supabase/server";

type BrainItemRow = {
  id: string;
  raw_text: string;
  cleaned_text: string | null;
  summary: string | null;
  type: string;
  project: string | null;
  topic: string | null;
  tags: string[];
  source: string;
  telegram_chat_id: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  telegram_message_id: string | null;
  status: string;
  created_at: string;
};

function mapBrainItemRow(row: BrainItemRow): BrainItem {
  return {
    id: row.id,
    rawText: row.raw_text,
    cleanedText: row.cleaned_text,
    summary: row.summary,
    type: row.type,
    project: row.project,
    topic: row.topic,
    tags: row.tags,
    source: row.source,
    telegramChatId: row.telegram_chat_id,
    telegramUserId: row.telegram_user_id,
    telegramUsername: row.telegram_username,
    telegramMessageId: row.telegram_message_id,
    status: row.status,
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
      type: input.type ?? "note",
      project: input.project ?? null,
      topic: input.topic ?? null,
      tags: input.tags ?? [],
      source: input.source ?? "telegram",
      telegram_chat_id: input.telegramChatId ?? null,
      telegram_user_id: input.telegramUserId ?? null,
      telegram_username: input.telegramUsername ?? null,
      telegram_message_id: input.telegramMessageId ?? null,
      status: input.status ?? "inbox",
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
