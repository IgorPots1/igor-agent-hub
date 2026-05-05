import type { BrainItem } from "../brain/types";

const MARKDOWN_EXTENSION = ".md";
const CATEGORY_MAX_LENGTH = 80;
const TITLE_MAX_WORDS = 10;
const TITLE_MAX_CHARACTERS = 70;
const FILENAME_MAX_CHARACTERS = 120;
const TAG_LIMIT = 10;
const MAIN_IDEA_MAX_CHARACTERS = 180;

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

function cleanupLeadText(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/^[#>\s]+/g, "")
      .replace(/^[-*•]+\s+/u, "")
      .replace(/^\d+[.)]\s+/u, "")
      .replace(/^[:;,.!?-]+\s*/u, "")
  );
}

function extractMeaningfulLead(rawText: string): string | null {
  const blocks = rawText
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

function formatRawText(rawText: string): string {
  const normalizedNewlines = rawText.replace(/\r\n?/g, "\n").trim();

  if (!normalizedNewlines) {
    return "";
  }

  const withReadableBreaks = normalizedNewlines
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/([^\n])\s+(\d+[.)]\s+)/gu, "$1\n$2")
    .replace(/([^\n])\s+([•*]\s+)/gu, "$1\n$2")
    .replace(/([^\n])\s+(-\s+(?=\p{Letter}|\p{Number}))/gu, "$1\n$2")
    .replace(/\n{3,}/g, "\n\n");

  const paragraphs = withReadableBreaks
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => normalizeWhitespace(line))
        .filter(Boolean)
        .join("\n")
    )
    .filter(Boolean);

  return paragraphs.join("\n\n");
}

function shouldCollapseOriginalNote(value: string): boolean {
  return value.length > 280 || value.split("\n").length > 8;
}

function toDisplayType(value: string): string {
  const localizedTypes: Record<string, string> = {
    note: "заметка",
    summary: "сводка",
    reminder: "напоминание",
    task: "задача",
    idea: "идея",
    insight: "вывод",
    decision: "решение",
    prompt: "промпт",
    bug_fix: "исправление",
    content_idea: "идея контента",
    product_note: "продуктовая заметка",
  };

  return localizedTypes[value] ?? value;
}

function toDisplaySource(value: string): string {
  const localizedSources: Record<string, string> = {
    telegram: "Telegram",
    telegram_voice: "голосовое Telegram",
  };

  return localizedSources[value] ?? value;
}

function toDisplayStatus(value: string): string {
  const localizedStatuses: Record<string, string> = {
    active: "активно",
    failed: "ошибка",
    sent: "отправлено",
  };

  return localizedStatuses[value] ?? value;
}

function formatCreatedAtForDisplay(value: string): string {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value || "н/д";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(parsedDate);
}

function getDisplayTags(tags: string[]): string | null {
  const normalizedTags = getNormalizedObsidianTags(tags);
  return normalizedTags.length > 0 ? normalizedTags.map((tag) => `#${tag}`).join(" ") : null;
}

function getMainIdea(item: BrainItem, title: string, summary: string | null): string | null {
  const lead = extractMeaningfulLead(item.rawText);

  if (!lead) {
    return null;
  }

  const shortenedLead = truncateText(lead, MAIN_IDEA_MAX_CHARACTERS);
  const normalizedLead = normalizeWhitespace(shortenedLead).toLowerCase();
  const normalizedTitle = normalizeWhitespace(title).toLowerCase();
  const normalizedSummary = normalizeWhitespace(summary ?? "").toLowerCase();

  if (!normalizedLead || normalizedLead === normalizedTitle || normalizedLead === normalizedSummary) {
    return null;
  }

  return shortenedLead;
}

export function getShortTitle(item: BrainItem): string {
  const leadFromRawText = extractMeaningfulLead(item.rawText);
  const summary = getSingleLineSummary(item.summary);
  const candidates = [leadFromRawText, summary, item.rawText.trim(), item.id];

  for (const candidate of candidates) {
    const shortened = trimTrailingTitlePunctuation(shortenReadableText(candidate ?? ""));

    if (shortened) {
      return shortened;
    }
  }

  return item.id;
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
    `тип: ${toYamlScalar(toDisplayType(item.type))}`,
    `категория: ${toYamlScalar(item.category)}`,
    ...(normalizedTags.length === 0
      ? ["теги: []"]
      : ["теги:", ...normalizedTags.map((tag) => `  - ${JSON.stringify(tag)}`)]),
    `статус: ${toYamlScalar(toDisplayStatus(item.status))}`,
    `источник: ${toYamlScalar(toDisplaySource(item.source))}`,
    `создано: ${toYamlScalar(item.createdAt)}`,
    ...(summary ? [`кратко: ${JSON.stringify(summary)}`] : []),
    "---",
  ];

  return lines.join("\n");
}

export function toMarkdownDocument(item: BrainItem): string {
  const title = getShortTitle(item);
  const summary = getSingleLineSummary(item.summary);
  const rawText = formatRawText(item.rawText) || item.id;
  const mainIdea = getMainIdea(item, title, summary);
  const displayTags = getDisplayTags(item.tags);
  const originalNoteSection = shouldCollapseOriginalNote(rawText)
    ? [
        "## Исходная запись",
        "",
        "<details>",
        "<summary>Показать исходную запись</summary>",
        "",
        rawText,
        "",
        "</details>",
        "",
      ]
    : ["## Исходная запись", "", rawText, ""];
  const lines = [
    toFrontmatter(item),
    "",
    `# ${title}`,
    "",
    ...(summary ? ["## Кратко", "", summary, ""] : []),
    ...(mainIdea ? ["## Основная мысль", "", mainIdea, ""] : []),
    ...originalNoteSection,
    "## Контекст",
    "",
    `- Категория: ${item.category || "н/д"}`,
    `- Тип: ${toDisplayType(item.type || "н/д")}`,
    `- Источник: ${toDisplaySource(item.source || "н/д")}`,
    `- Создано: ${formatCreatedAtForDisplay(item.createdAt)}`,
    ...(displayTags ? [`- Теги: ${displayTags}`] : []),
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

export function getArchivePath(item: BrainItem): string {
  return `${getSafeCategoryFolder(item)}/${getSafeMarkdownFilename(item)}`;
}
