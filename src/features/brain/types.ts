export type BrainItem = {
  id: string;
  rawText: string;
  cleanedText: string | null;
  summary: string | null;
  type: string;
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
