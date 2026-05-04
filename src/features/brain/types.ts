export const BRAIN_ITEM_TYPES = [
  "note",
  "idea",
  "insight",
  "decision",
  "task",
  "reminder",
  "summary",
  "prompt",
  "bug_fix",
  "content_idea",
  "product_note",
] as const;

export const DEFAULT_BRAIN_CATEGORIES = [
  "Inbox",
  "Run Club",
  "AI Running Coach",
  "Run Together",
  "Agent Hub",
  "Контент",
  "Ученики",
  "Бизнес",
  "Личное",
] as const;

export const DEFAULT_BRAIN_ITEM_TYPE = "note";
export const DEFAULT_BRAIN_ITEM_CATEGORY = "Inbox";
export const DEFAULT_BRAIN_ITEM_STATUS = "active";
export const DEFAULT_BRAIN_ITEM_SOURCE = "telegram";

export type BrainItem = {
  id: string;
  rawText: string;
  cleanedText: string | null;
  summary: string | null;
  type: string;
  category: string;
  project: string | null;
  topic: string | null;
  tags: string[];
  source: string;
  telegramChatId: string | null;
  telegramUserId: string | null;
  telegramUsername: string | null;
  telegramMessageId: string | null;
  status: string;
  createdAt: string;
};

export type CreateBrainItemInput = {
  rawText: string;
  cleanedText?: string | null;
  summary?: string | null;
  type?: string;
  category?: string;
  project?: string | null;
  topic?: string | null;
  tags?: string[];
  source?: string;
  telegramChatId?: string | null;
  telegramUserId?: string | null;
  telegramUsername?: string | null;
  telegramMessageId?: string | null;
  status?: string;
};
