import type { BrainItemDraft } from "@/features/brain/types";

export function createBrainItemDraft(rawText: string): BrainItemDraft {
  return {
    rawText,
    source: "telegram",
    createdAt: new Date().toISOString()
  };
}
