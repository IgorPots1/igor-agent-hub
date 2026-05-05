import { createSupabaseServerClient } from "@/features/supabase/server";
import type {
  BrainReminder,
  BrainReminderStatus,
  BrainReminderWithItem,
  CreateBrainReminderInput,
} from "@/features/reminders/types";

type BrainReminderRow = {
  id: string;
  brain_item_id: string;
  telegram_chat_id: string;
  remind_at: string;
  status: BrainReminderStatus;
  attempt_count: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

type BrainReminderWithItemRow = BrainReminderRow & {
  brain_item:
    | { raw_text: string; source: string | null; tags: string[] | null; type: string | null }
    | { raw_text: string; source: string | null; tags: string[] | null; type: string | null }[]
    | null;
};

function mapBrainReminderRow(row: BrainReminderRow): BrainReminder {
  return {
    id: row.id,
    brainItemId: row.brain_item_id,
    telegramChatId: row.telegram_chat_id,
    remindAt: row.remind_at,
    status: row.status,
    attemptCount: row.attempt_count,
    lastAttemptAt: row.last_attempt_at,
    nextAttemptAt: row.next_attempt_at,
    sentAt: row.sent_at,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getJoinedRawText(row: BrainReminderWithItemRow): string {
  if (Array.isArray(row.brain_item)) {
    return row.brain_item[0]?.raw_text ?? "";
  }

  return row.brain_item?.raw_text ?? "";
}

function getJoinedBrainItem(row: BrainReminderWithItemRow) {
  if (Array.isArray(row.brain_item)) {
    return row.brain_item[0] ?? null;
  }

  return row.brain_item;
}

function mapBrainReminderWithItemRow(row: BrainReminderWithItemRow): BrainReminderWithItem {
  const brainItem = getJoinedBrainItem(row);

  return {
    ...mapBrainReminderRow(row),
    rawText: getJoinedRawText(row),
    brainItemSource: brainItem?.source ?? "telegram",
    brainItemTags: brainItem?.tags ?? [],
    brainItemType: brainItem?.type ?? "note",
  };
}

export async function createBrainReminders(
  inputs: CreateBrainReminderInput[]
): Promise<BrainReminder[]> {
  if (inputs.length === 0) {
    return [];
  }

  const supabase = createSupabaseServerClient();
  const rows = inputs.map((input) => ({
    brain_item_id: input.brainItemId,
    telegram_chat_id: input.telegramChatId,
    remind_at: input.remindAt,
    status: input.status ?? "pending",
  }));

  const { data, error } = await supabase.from("brain_reminders").insert(rows).select("*");

  if (error) {
    throw new Error(`Failed to create brain reminders: ${error.message}`);
  }

  return (data as BrainReminderRow[]).map(mapBrainReminderRow);
}

export async function listDueBrainReminders(
  nowIso: string,
  claimedBeforeIso: string,
  limit = 20
): Promise<BrainReminderWithItem[]> {
  const supabase = createSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 20);
  const { data, error } = await supabase
    .from("brain_reminders")
    .select(
      "id, brain_item_id, telegram_chat_id, remind_at, status, attempt_count, last_attempt_at, next_attempt_at, sent_at, error, created_at, updated_at, brain_item:brain_items!inner(raw_text, source, tags, type)"
    )
    .eq("status", "pending")
    .lte("remind_at", nowIso)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .lte("updated_at", claimedBeforeIso)
    .order("remind_at", { ascending: true })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Failed to list due brain reminders: ${error.message}`);
  }

  return (data as BrainReminderWithItemRow[]).map(mapBrainReminderWithItemRow);
}

export async function listUpcomingBrainRemindersForChat(
  telegramChatId: string,
  nowIso: string,
  limit = 10
): Promise<BrainReminderWithItem[]> {
  const supabase = createSupabaseServerClient();
  const safeLimit = Math.min(Math.max(limit, 1), 10);
  const { data, error } = await supabase
    .from("brain_reminders")
    .select(
      "id, brain_item_id, telegram_chat_id, remind_at, status, attempt_count, last_attempt_at, next_attempt_at, sent_at, error, created_at, updated_at, brain_item:brain_items!inner(raw_text, source, tags, type)"
    )
    .eq("telegram_chat_id", telegramChatId)
    .eq("status", "pending")
    .gt("remind_at", nowIso)
    .order("remind_at", { ascending: true })
    .limit(safeLimit);

  if (error) {
    throw new Error(`Failed to list upcoming brain reminders: ${error.message}`);
  }

  return (data as BrainReminderWithItemRow[]).map(mapBrainReminderWithItemRow);
}

export async function claimPendingBrainReminder(
  id: string,
  expectedUpdatedAt: string,
  expectedAttemptCount: number
): Promise<number | null> {
  const supabase = createSupabaseServerClient();
  const claimedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("brain_reminders")
    .update({
      updated_at: claimedAt,
      attempt_count: expectedAttemptCount + 1,
      last_attempt_at: claimedAt,
    })
    .eq("id", id)
    .eq("status", "pending")
    .eq("updated_at", expectedUpdatedAt)
    .eq("attempt_count", expectedAttemptCount)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to claim brain reminder ${id}: ${error.message}`);
  }

  return data ? expectedAttemptCount + 1 : null;
}

export async function markBrainReminderSent(id: string, sentAt: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("brain_reminders")
    .update({
      status: "sent",
      sent_at: sentAt,
      next_attempt_at: null,
      error: null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to mark brain reminder ${id} as sent: ${error.message}`);
  }
}

function truncateReminderError(errorMessage: string): string {
  return errorMessage.slice(0, 300);
}

export async function rescheduleBrainReminder(
  id: string,
  errorMessage: string,
  nextAttemptAt: string
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const shortError = truncateReminderError(errorMessage);
  const { error } = await supabase
    .from("brain_reminders")
    .update({
      status: "pending",
      error: shortError,
      sent_at: null,
      next_attempt_at: nextAttemptAt,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to reschedule brain reminder ${id}: ${error.message}`);
  }
}

export async function markBrainReminderFailed(id: string, errorMessage: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const shortError = truncateReminderError(errorMessage);
  const { error } = await supabase
    .from("brain_reminders")
    .update({
      status: "failed",
      error: shortError,
      sent_at: null,
      next_attempt_at: null,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to mark brain reminder ${id} as failed: ${error.message}`);
  }
}
