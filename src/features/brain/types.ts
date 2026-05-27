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
  "ops_log",
] as const;

export const BRAIN_ITEM_CATEGORIES = [
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

export const BRAIN_ITEM_PROJECTS = [
  "agent-hub",
  "ai-running-coach",
  "trainingpeaks-coach-os",
  "run-club",
  "run-together",
  "content",
  "students",
  "personal",
  "business",
] as const;

export const DEFAULT_BRAIN_CATEGORIES = BRAIN_ITEM_CATEGORIES;

export type BrainItemType = (typeof BRAIN_ITEM_TYPES)[number];
export type BrainItemCategory = (typeof BRAIN_ITEM_CATEGORIES)[number];
export type BrainItemProject = (typeof BRAIN_ITEM_PROJECTS)[number];

export const DEFAULT_BRAIN_ITEM_TYPE: BrainItemType = "note";
export const DEFAULT_BRAIN_ITEM_CATEGORY: BrainItemCategory = "Inbox";
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
  noExport: boolean;
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
  noExport?: boolean;
  status?: string;
};

export type BrainItemClassification = {
  type: BrainItemType;
  category: BrainItemCategory;
  project: BrainItemProject | null;
  topic: string | null;
  tags: string[];
  summary: string | null;
};
