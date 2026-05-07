import type { BrainItem } from "@/features/brain/types";

const TITLE_MAX_WORDS = 14;
const TITLE_MAX_CHARACTERS = 80;
const TAG_LIMIT = 10;
const TITLE_SECTION_MARKERS = [
  "Цель проекта",
  "Кратко",
  "Архитектура",
  "Текущий статус",
  "Что сделали",
  "Следующие шаги",
] as const;

export type NormalizedExportFrontmatter = {
  type: string;
  source: string;
  status: string;
  category: string;
  project: string | null;
  topic: string | null;
  created_at: string;
  tags: string[];
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxCharacters: number): string {
  const characters = Array.from(value);

  if (characters.length <= maxCharacters) {
    return value;
  }

  const truncated = characters.slice(0, maxCharacters).join("").trim();
  const lastSpaceIndex = truncated.lastIndexOf(" ");

  if (lastSpaceIndex >= 20) {
    return truncated.slice(0, lastSpaceIndex).trim();
  }

  return truncated;
}

function shortenReadableText(value: string): string {
  const normalizedValue = normalizeWhitespace(value);

  if (!normalizedValue) {
    return "";
  }

  const limitedWords = normalizedValue.split(" ").slice(0, TITLE_MAX_WORDS).join(" ");
  return truncateText(limitedWords, TITLE_MAX_CHARACTERS);
}

function trimTrailingTitlePunctuation(value: string): string {
  return value.replace(/[.:;!?…\-\s]+$/u, "").trim();
}

function getFallbackExportTitle(item: Pick<BrainItem, "createdAt">): string {
  const date = item.createdAt.slice(0, 10) || "без даты";
  return `Заметка от ${date}`;
}

function cleanupLeadText(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/^[#>\s]+/g, "")
      .replace(/^[-*•]+\s+/u, "")
      .replace(/^\d+[.)]\s+/u, "")
      .replace(/^[:;,.!?-]+\s*/u, "")
  );
}

function findFirstTitleBoundary(value: string): number {
  const newlineIndex = value.indexOf("\n");
  let boundaryIndex = newlineIndex >= 0 ? newlineIndex : value.length;

  const numberedListMatch = /\s+\d+[.)]\s+/u.exec(value);

  if (numberedListMatch && typeof numberedListMatch.index === "number") {
    boundaryIndex = Math.min(boundaryIndex, numberedListMatch.index);
  }

  for (const marker of TITLE_SECTION_MARKERS) {
    const match = new RegExp(`(?:^|\\s)${marker}\\s*:`, "iu").exec(value);

    if (match && typeof match.index === "number") {
      boundaryIndex = Math.min(boundaryIndex, match.index);
    }
  }

  return boundaryIndex;
}

function extractCompactTitleLead(value: string): string | null {
  const normalizedValue = (value ?? "").replace(/\r\n?/g, "\n").trim();

  if (!normalizedValue) {
    return null;
  }

  const candidate = cleanupLeadText(normalizedValue.slice(0, findFirstTitleBoundary(normalizedValue)));
  return candidate.length >= 4 ? candidate : null;
}

function extractMeaningfulLead(value: string): string | null {
  const blocks = value
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => cleanupLeadText(block))
    .filter(Boolean);

  for (const block of blocks) {
    const sentence = block.split(/(?<=[.!?…])\s+/u)[0] ?? block;
    const candidate = cleanupLeadText(sentence);

    if (candidate.length >= 8) {
      return candidate;
    }
  }

  return null;
}

function normalizeOptionalSingleLine(value: string | null | undefined): string | null {
  const normalizedValue = normalizeWhitespace(value ?? "");
  return normalizedValue || null;
}

export function normalizeMultilineText(value: string | null | undefined): string | null {
  const normalizedValue = (value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalizedValue || null;
}

export function normalizeExportTitle(item: BrainItem): string {
  const candidates = [
    extractCompactTitleLead(item.rawText),
    extractCompactTitleLead(item.cleanedText ?? ""),
    extractMeaningfulLead(item.cleanedText ?? ""),
    extractMeaningfulLead(item.rawText),
    normalizeExportSummary(item),
  ];

  for (const candidate of candidates) {
    const shortened = trimTrailingTitlePunctuation(shortenReadableText(candidate ?? ""));

    if (shortened) {
      return shortened;
    }
  }

  return getFallbackExportTitle(item);
}

export function normalizeExportBody(item: BrainItem): string | null {
  return normalizeMultilineText(item.cleanedText) ?? normalizeMultilineText(item.rawText);
}

export function normalizeExportSummary(item: BrainItem): string | null {
  return normalizeOptionalSingleLine(item.summary);
}

export function normalizeExportTags(item: Pick<BrainItem, "tags">): string[] {
  const normalizedTags = new Set<string>();

  for (const tag of item.tags) {
    const normalizedTag = tag
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^\p{Letter}\p{Number}\-]+/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!normalizedTag) {
      continue;
    }

    normalizedTags.add(normalizedTag);

    if (normalizedTags.size === TAG_LIMIT) {
      break;
    }
  }

  return Array.from(normalizedTags);
}

export function normalizeExportFrontmatter(item: BrainItem): NormalizedExportFrontmatter {
  return {
    type: normalizeOptionalSingleLine(item.type) ?? "note",
    source: normalizeOptionalSingleLine(item.source) ?? "unknown",
    status: normalizeOptionalSingleLine(item.status) ?? "active",
    category: normalizeOptionalSingleLine(item.category) ?? "Inbox",
    project: normalizeOptionalSingleLine(item.project),
    topic: normalizeOptionalSingleLine(item.topic),
    created_at: normalizeOptionalSingleLine(item.createdAt) ?? "",
    tags: normalizeExportTags(item),
  };
}
