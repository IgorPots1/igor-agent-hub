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
const SUMMARY_MAX_CHARACTERS = 220;

type ParsedSectionKey =
  | "lead"
  | "essence"
  | "architecture"
  | "done"
  | "decisions"
  | "nextSteps"
  | "risks";

type ParsedSections = Record<ParsedSectionKey, string[]>;

type RenderedSection = {
  heading: string;
  content: string;
};

const LABELED_SECTION_DEFINITIONS: Array<{ label: string; key: ParsedSectionKey }> = [
  { label: "Цель проекта", key: "essence" },
  { label: "Архитектура", key: "architecture" },
  { label: "Текущая рабочая связка", key: "architecture" },
  { label: "Важное открытие", key: "decisions" },
  { label: "Текущий статус", key: "essence" },
  { label: "Следующий шаг", key: "nextSteps" },
  { label: "Следующие шаги", key: "nextSteps" },
  { label: "Что сделали", key: "done" },
  { label: "Риски", key: "risks" },
  { label: "Решения", key: "decisions" },
];

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

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasCyrillic(value: string): boolean {
  return /[\u0400-\u04ff]/u.test(value);
}

function countLatinLetters(value: string): number {
  return (value.match(/[A-Za-z]/g) ?? []).length;
}

function countCyrillicLetters(value: string): number {
  return (value.match(/[\u0400-\u04ff]/gu) ?? []).length;
}

function isMostlyLatinText(value: string): boolean {
  const latinLetters = countLatinLetters(value);
  const cyrillicLetters = countCyrillicLetters(value);

  return latinLetters >= 8 && latinLetters > cyrillicLetters * 2;
}

function shouldIgnoreExportSummary(summary: string | null, rawText: string | null): boolean {
  if (!summary || !rawText) {
    return false;
  }

  return hasCyrillic(rawText) && isMostlyLatinText(summary);
}

function createEmptyParsedSections(): ParsedSections {
  return {
    lead: [],
    essence: [],
    architecture: [],
    done: [],
    decisions: [],
    nextSteps: [],
    risks: [],
  };
}

function getLabeledSectionPattern(): RegExp {
  return new RegExp(
    `(${LABELED_SECTION_DEFINITIONS.map(({ label }) => escapeForRegex(label)).join("|")})\\s*:`,
    "gu"
  );
}

function getSectionKeyByLabel(label: string): ParsedSectionKey | null {
  return LABELED_SECTION_DEFINITIONS.find((definition) => definition.label === label)?.key ?? null;
}

function appendUniqueSectionValue(target: string[], value: string): void {
  const normalizedValue = normalizeMultilineText(value);

  if (!normalizedValue) {
    return;
  }

  if (!target.some((existingValue) => isSameContent(existingValue, normalizedValue))) {
    target.push(normalizedValue);
  }
}

function parseLabeledSections(rawText: string | null): ParsedSections | null {
  const normalizedRawText = normalizeMultilineText(rawText);

  if (!normalizedRawText) {
    return null;
  }

  const matches = Array.from(normalizedRawText.matchAll(getLabeledSectionPattern()));

  if (matches.length === 0) {
    return null;
  }

  const parsedSections = createEmptyParsedSections();
  const leadingText = normalizedRawText.slice(0, matches[0]?.index ?? 0);
  appendUniqueSectionValue(parsedSections.lead, leadingText);

  for (const [index, match] of matches.entries()) {
    const label = match[1];
    const sectionKey = getSectionKeyByLabel(label);

    if (!sectionKey || typeof match.index !== "number") {
      continue;
    }

    const startIndex = match.index + match[0].length;
    const endIndex = matches[index + 1]?.index ?? normalizedRawText.length;
    const sectionContent = normalizedRawText.slice(startIndex, endIndex);
    appendUniqueSectionValue(parsedSections[sectionKey], sectionContent);
  }

  return parsedSections;
}

function stripRepeatedTitlePrefix(value: string, title: string): string {
  const normalizedValue = normalizeWhitespace(value);
  const normalizedTitle = normalizeWhitespace(title);

  if (!normalizedValue || !normalizedTitle) {
    return normalizedValue;
  }

  if (normalizedValue === normalizedTitle) {
    return "";
  }

  if (normalizedValue.startsWith(`${normalizedTitle} `)) {
    return normalizedValue.slice(normalizedTitle.length).trim();
  }

  return normalizedValue;
}

function joinUniqueParts(parts: Array<string | null | undefined>): string | null {
  const uniqueParts: string[] = [];

  for (const part of parts) {
    const normalizedPart = normalizeMultilineText(part);

    if (!normalizedPart) {
      continue;
    }

    if (!uniqueParts.some((existingPart) => isSameContent(existingPart, normalizedPart))) {
      uniqueParts.push(normalizedPart);
    }
  }

  return uniqueParts.length > 0 ? uniqueParts.join("\n\n") : null;
}

function normalizeListLine(line: string): string {
  return line.replace(/^\s*•\s+/u, "- ").replace(/\s+$/g, "");
}

function toCompactSentenceText(value: string): string {
  return normalizeWhitespace(value.replace(/^\s*[-*•]+\s+/gmu, "").replace(/\n+/g, " "));
}

function maybeConvertInlineBullets(value: string, preferBullets: boolean): string | null {
  const singleLine = normalizeWhitespace(value.replace(/\n+/g, " "));
  const parts = singleLine
    .split(/\s+-\s+/u)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  if (!preferBullets && parts.length < 3) {
    return null;
  }

  return parts.map((part) => `- ${part}`).join("\n");
}

function formatSectionContent(
  value: string | null | undefined,
  options: { preferBullets?: boolean } = {}
): string | null {
  const normalizedValue = normalizeMultilineText(value);

  if (!normalizedValue) {
    return null;
  }

  const paragraphs = normalizedValue
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const lines = paragraph.split("\n");

      if (lines.some((line) => /^\s*([-*•]|\d+[.)])\s+/.test(line))) {
        return lines.map(normalizeListLine).join("\n");
      }

      return maybeConvertInlineBullets(paragraph, options.preferBullets ?? false) ?? paragraph;
    });

  return paragraphs.join("\n\n").trim() || null;
}

function getLeadBeforeStructuredSections(rawText: string): string | null {
  const normalizedRawText = normalizeMultilineText(rawText);

  if (!normalizedRawText) {
    return null;
  }

  const firstSectionMatch = getLabeledSectionPattern().exec(normalizedRawText);
  const firstParagraphBreak = normalizedRawText.indexOf("\n\n");
  const boundaryCandidates = [
    typeof firstSectionMatch?.index === "number" ? firstSectionMatch.index : normalizedRawText.length,
    firstParagraphBreak >= 0 ? firstParagraphBreak : normalizedRawText.length,
  ];
  const boundaryIndex = Math.min(...boundaryCandidates);

  return normalizedRawText.slice(0, boundaryIndex).trim() || normalizedRawText;
}

function buildCompactRussianSummary(candidate: string | null | undefined): string | null {
  const compactText = toCompactSentenceText(candidate ?? "");

  if (!compactText || !hasCyrillic(compactText)) {
    return null;
  }

  const sentences = compactText.split(/(?<=[.!?…])\s+/u).filter(Boolean);

  if (sentences.length > 0) {
    return truncateText(sentences.slice(0, 2).join(" "), SUMMARY_MAX_CHARACTERS);
  }

  return truncateText(compactText, SUMMARY_MAX_CHARACTERS);
}

function deriveSummaryFromRawText(
  rawText: string | null,
  title: string,
  parsedSections: ParsedSections | null
): string | null {
  if (!rawText) {
    return null;
  }

  const summaryCandidates = [
    stripRepeatedTitlePrefix(parsedSections?.lead[0] ?? "", title),
    parsedSections?.essence[0] ?? null,
    parsedSections?.decisions[0] ?? null,
    getLeadBeforeStructuredSections(rawText),
    rawText,
  ];

  for (const candidate of summaryCandidates) {
    const summary = buildCompactRussianSummary(candidate);

    if (summary) {
      return summary;
    }
  }

  return null;
}

function getExportSummary(
  item: BrainItem,
  title: string,
  rawText: string | null,
  parsedSections: ParsedSections | null
): string | null {
  const normalizedSummary = normalizeExportSummary(item);

  if (normalizedSummary && !shouldIgnoreExportSummary(normalizedSummary, rawText)) {
    return normalizedSummary;
  }

  return deriveSummaryFromRawText(rawText, title, parsedSections);
}

function getRenderedStructuredSections(
  item: BrainItem,
  title: string,
  summary: string | null,
  body: string | null,
  rawText: string | null,
  parsedSections: ParsedSections | null
): RenderedSection[] {
  const sections: RenderedSection[] = [];
  const seenContent = new Set<string>();
  const allowTaskBodyFallback = isTaskLikeType(item.type);
  const fallbackBody =
    body &&
    (!isSameContent(body, summary) || allowTaskBodyFallback) &&
    (!rawText || !isSameContent(body, rawText) || !summary || allowTaskBodyFallback)
      ? formatSectionContent(body, { preferBullets: false })
      : null;

  const addSection = (
    heading: string,
    content: string | null | undefined,
    options: { allowSameAsSummary?: boolean; preferBullets?: boolean } = {}
  ): void => {
    const formattedContent = formatSectionContent(content, options);
    const normalizedContent = normalizeWhitespace(formattedContent ?? "");

    if (!formattedContent || !normalizedContent) {
      return;
    }

    if (!options.allowSameAsSummary && summary && isSameContent(formattedContent, summary)) {
      return;
    }

    if (seenContent.has(normalizedContent)) {
      return;
    }

    seenContent.add(normalizedContent);
    sections.push({ heading, content: formattedContent });
  };

  if (parsedSections) {
    addSection(
      "## Суть",
      joinUniqueParts([
        stripRepeatedTitlePrefix(parsedSections.lead[0] ?? "", title),
        ...parsedSections.essence,
      ])
    );
    addSection("## Архитектура", joinUniqueParts(parsedSections.architecture));
    addSection("## Что сделано", joinUniqueParts(parsedSections.done), { preferBullets: true });
    addSection("## Важные решения", joinUniqueParts(parsedSections.decisions));
    addSection("## Риски", joinUniqueParts(parsedSections.risks), { preferBullets: true });
    addSection("## Следующие шаги", joinUniqueParts(parsedSections.nextSteps), { preferBullets: true });
  }

  if (sections.length === 0 && fallbackBody) {
    addSection(getBodySectionTitle(item), fallbackBody, {
      allowSameAsSummary: allowTaskBodyFallback,
    });
  } else if (
    sections.length > 0 &&
    fallbackBody &&
    !seenContent.has(normalizeWhitespace(fallbackBody)) &&
    !parsedSections?.essence.length
  ) {
    addSection("## Суть", fallbackBody);
  }

  return sections;
}

function getCodeFence(value: string): string {
  return value.includes("```") ? "````" : "```";
}

function renderRawTextSection(rawText: string | null): string[] {
  if (!rawText) {
    return [];
  }

  const fence = getCodeFence(rawText);
  return [
    "## Исходная запись",
    "",
    "<details>",
    "<summary>Показать исходную запись</summary>",
    "",
    `${fence}text`,
    rawText,
    fence,
    "",
    "</details>",
    "",
  ];
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
  const rawText = normalizeMultilineText(item.rawText);
  const body = normalizeExportBody(item);
  const parsedSections = parseLabeledSections(rawText);
  const summary = getExportSummary(item, title, rawText, parsedSections);
  const renderedSections = getRenderedStructuredSections(item, title, summary, body, rawText, parsedSections);
  const lines = [
    toFrontmatter(item),
    "",
    `# ${title}`,
    "",
    ...(summary ? ["## Кратко", "", summary, ""] : []),
    ...renderedSections.flatMap((section) => [section.heading, "", section.content, ""]),
    ...renderRawTextSection(rawText),
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}

export function getArchivePath(item: BrainItem): string {
  return `${getSafeCategoryFolder(item)}/${getSafeMarkdownFilename(item)}`;
}
