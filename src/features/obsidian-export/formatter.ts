import type { BrainItem } from "../brain/types";

const MARKDOWN_EXTENSION = ".md";
const CATEGORY_MAX_LENGTH = 80;
const TITLE_MAX_WORDS = 10;
const TITLE_MAX_CHARACTERS = 70;
const FILENAME_MAX_CHARACTERS = 120;
const TAG_LIMIT = 10;

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

function toSafeCategoryFolderSegment(value: string, maxLength: number): string {
  return value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[^\p{Letter}\p{Number}\- ]+/gu, "")
    .replace(/ /g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}

function sanitizeFilenamePart(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/g, "")
    .replace(/^\.+/g, "");
}

function toYamlScalar(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "null" : JSON.stringify(value);
}

function getSingleLineSummary(summary: string | null): string | null {
  const normalizedSummary = normalizeWhitespace(summary ?? "");
  return normalizedSummary || null;
}

export function getShortTitle(item: BrainItem): string {
  const preferredSource = item.summary?.trim() || item.rawText.trim() || item.id;
  return shortenReadableText(preferredSource) || item.id;
}

export function getNormalizedObsidianTags(tags: string[]): string[] {
  const normalizedTags = new Set<string>();

  for (const tag of tags) {
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

export function getSafeCategoryFolder(item: BrainItem): string {
  return toSafeCategoryFolderSegment(item.category, CATEGORY_MAX_LENGTH) || "Inbox";
}

export function getSafeMarkdownFilename(item: BrainItem): string {
  const datePrefix = item.createdAt.slice(0, 10) || "undated";
  const shortId = item.id.slice(0, 8) || "item";
  const titleBudget =
    FILENAME_MAX_CHARACTERS -
    (datePrefix.length + shortId.length + MARKDOWN_EXTENSION.length + " -  - ".length);
  const safeTitle =
    truncateText(sanitizeFilenamePart(getShortTitle(item)), Math.max(titleBudget, 20)) || shortId;

  return `${datePrefix} - ${safeTitle} - ${shortId}${MARKDOWN_EXTENSION}`;
}

export function toFrontmatter(item: BrainItem): string {
  const normalizedTags = getNormalizedObsidianTags(item.tags);
  const summary = getSingleLineSummary(item.summary);
  const lines = [
    "---",
    `id: ${toYamlScalar(item.id)}`,
    `type: ${toYamlScalar(item.type)}`,
    `category: ${toYamlScalar(item.category)}`,
    ...(normalizedTags.length === 0
      ? ["tags: []"]
      : ["tags:", ...normalizedTags.map((tag) => `  - ${JSON.stringify(tag)}`)]),
    `status: ${toYamlScalar(item.status)}`,
    `source: ${toYamlScalar(item.source)}`,
    `created_at: ${toYamlScalar(item.createdAt)}`,
    ...(summary ? [`summary: ${JSON.stringify(summary)}`] : []),
    "---",
  ];

  return lines.join("\n");
}

export function toMarkdownDocument(item: BrainItem): string {
  const title = getShortTitle(item);
  const summary = getSingleLineSummary(item.summary);
  const rawText = item.rawText.trim() || item.id;
  const lines = [
    toFrontmatter(item),
    "",
    `# ${title}`,
    "",
    ...(summary ? ["## Summary", "", item.summary?.trim() ?? "", ""] : []),
    "## Original note",
    "",
    rawText,
    "",
    "## Context",
    "",
    `- Category: ${item.category || "n/a"}`,
    `- Type: ${item.type || "n/a"}`,
    `- Source: ${item.source || "n/a"}`,
    `- Created: ${item.createdAt || "n/a"}`,
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

export function getArchivePath(item: BrainItem): string {
  return `${getSafeCategoryFolder(item)}/${getSafeMarkdownFilename(item)}`;
}
