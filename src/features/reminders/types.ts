export const BRAIN_REMINDER_STATUSES = ["pending", "sent", "failed", "cancelled"] as const;

export type BrainReminderStatus = (typeof BRAIN_REMINDER_STATUSES)[number];

export type BrainReminder = {
  id: string;
  brainItemId: string;
  telegramChatId: string;
  remindAt: string;
  status: BrainReminderStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  sentAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BrainReminderWithItem = BrainReminder & {
  rawText: string;
  brainItemSource: string;
  brainItemTags: string[];
  brainItemType: string;
};

export type CreateBrainReminderInput = {
  brainItemId: string;
  telegramChatId: string;
  remindAt: string;
  status?: BrainReminderStatus;
};
