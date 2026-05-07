import type { BrainItem } from "../brain/types";
import {
  normalizeExportBody,
  normalizeExportFrontmatter,
  normalizeExportSummary,
  normalizeExportTags,
  normalizeExportTitle,
  normalizeMultilineText,
} from "../brain/normalization.ts";

const MARKDOWN_EXTENSION = ".md";
const CATEGORY_MAX_LENGTH = 80;
const FILENAME_MAX_CHARACTERS = 120;

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

export function getShortTitle(item: BrainItem): string {
  return normalizeExportTitle(item);
}

export function getNormalizedObsidianTags(tags: string[]): string[] {
  return normalizeExportTags({ tags });
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
  const frontmatter = normalizeExportFrontmatter(item);
  const lines = [
    "---",
    `type: ${toYamlScalar(frontmatter.type)}`,
    `source: ${toYamlScalar(frontmatter.source)}`,
    `status: ${toYamlScalar(frontmatter.status)}`,
    `category: ${toYamlScalar(frontmatter.category)}`,
    `project: ${toYamlScalar(frontmatter.project)}`,
    `topic: ${toYamlScalar(frontmatter.topic)}`,
    `created_at: ${toYamlScalar(frontmatter.created_at)}`,
    ...(frontmatter.tags.length === 0
      ? ["tags: []"]
      : ["tags:", ...frontmatter.tags.map((tag) => `  - ${JSON.stringify(tag)}`)]),
    "---",
  ];

  return lines.join("\n");
}

function isSameContent(left: string | null, right: string | null): boolean {
  return normalizeWhitespace(left ?? "") === normalizeWhitespace(right ?? "");
}

function isTaskLikeType(type: string): boolean {
  return type === "task" || type === "bug_fix";
}

function getBodySectionTitle(item: BrainItem): "## Суть" | "## Действия" {
  return isTaskLikeType(item.type) ? "## Действия" : "## Суть";
}

export function toMarkdownDocument(item: BrainItem): string {
  const title = getShortTitle(item);
  const summary = normalizeExportSummary(item);
  const body = normalizeExportBody(item);
  const rawText = normalizeMultilineText(item.rawText);
  const shouldShowBody =
    body !== null &&
    !isSameContent(body, summary) &&
    (!rawText || !isSameContent(body, rawText) || !summary);
  const lines = [
    toFrontmatter(item),
    "",
    `# ${title}`,
    "",
    ...(summary ? ["## Кратко", "", summary, ""] : []),
    ...(shouldShowBody && body ? [getBodySectionTitle(item), "", body, ""] : []),
    ...(rawText ? ["## Исходная запись", "", rawText, ""] : []),
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

export function getArchivePath(item: BrainItem): string {
  return `${getSafeCategoryFolder(item)}/${getSafeMarkdownFilename(item)}`;
}
