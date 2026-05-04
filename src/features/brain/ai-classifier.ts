import OpenAI from "openai";

import {
  BRAIN_ITEM_CATEGORIES,
  BRAIN_ITEM_TYPES,
  DEFAULT_BRAIN_ITEM_CATEGORY,
  DEFAULT_BRAIN_ITEM_TYPE,
} from "@/features/brain/types";
import type { BrainItemClassification } from "@/features/brain/types";

const AI_CLASSIFIER_MODEL = "gpt-4.1-mini";
const AI_CLASSIFIER_TIMEOUT_MS = 8_000;
const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 24;
const MAX_SUMMARY_LENGTH = 160;

const typeSet = new Set<string>(BRAIN_ITEM_TYPES);
const categorySet = new Set<string>(BRAIN_ITEM_CATEGORIES);

type AiClassificationResponse = {
  type?: unknown;
  category?: unknown;
  tags?: unknown;
  summary?: unknown;
};

function getOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing required environment variable: OPENAI_API_KEY");
  }

  return apiKey;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeType(value: unknown): BrainItemClassification["type"] {
  return typeof value === "string" && typeSet.has(value)
    ? (value as BrainItemClassification["type"])
    : DEFAULT_BRAIN_ITEM_TYPE;
}

function sanitizeCategory(value: unknown): BrainItemClassification["category"] {
  return typeof value === "string" && categorySet.has(value)
    ? (value as BrainItemClassification["category"])
    : DEFAULT_BRAIN_ITEM_CATEGORY;
}

function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const uniqueTags = new Set<string>();

  for (const tag of value) {
    if (typeof tag !== "string") {
      continue;
    }

    const normalizedTag = normalizeText(tag.replace(/^#+/, "")).slice(0, MAX_TAG_LENGTH);

    if (!normalizedTag) {
      continue;
    }

    uniqueTags.add(normalizedTag);

    if (uniqueTags.size >= MAX_TAGS) {
      break;
    }
  }

  return Array.from(uniqueTags);
}

function sanitizeSummary(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedSummary = normalizeText(value);

  if (!normalizedSummary) {
    return null;
  }

  const firstSentenceMatch = normalizedSummary.match(/^(.{1,160}?[.!?])(?:\s|$)/u);
  const firstSentence = firstSentenceMatch?.[1] ?? normalizedSummary;

  return firstSentence.slice(0, MAX_SUMMARY_LENGTH).trim();
}

function buildPrompt(rawText: string): string {
  return [
    "Classify this second-brain item for a Telegram bot.",
    "Return strict JSON only.",
    `Allowed type values: ${BRAIN_ITEM_TYPES.join(", ")}`,
    `Allowed category values: ${BRAIN_ITEM_CATEGORIES.join(", ")}`,
    "Rules:",
    "- Use the original user text as the source of truth.",
    "- tags must be a JSON array with up to 5 short strings.",
    "- summary must be short and one sentence.",
    "- If unsure, prefer type=note and category=Inbox.",
    "",
    `Text: ${rawText}`,
  ].join("\n");
}

export async function classifyBrainItem(rawText: string): Promise<BrainItemClassification> {
  const client = new OpenAI({
    apiKey: getOpenAiApiKey(),
  });

  const response = await client.chat.completions.create(
    {
      model: AI_CLASSIFIER_MODEL,
      temperature: 0.2,
      max_tokens: 200,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content:
            "You classify second-brain notes. Output strict JSON with keys type, category, tags, summary.",
        },
        {
          role: "user",
          content: buildPrompt(rawText),
        },
      ],
    },
    {
      signal: AbortSignal.timeout(AI_CLASSIFIER_TIMEOUT_MS),
    }
  );

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI classifier returned an empty response");
  }

  let parsed: AiClassificationResponse;

  try {
    parsed = JSON.parse(content) as AiClassificationResponse;
  } catch (error) {
    throw new Error(`OpenAI classifier returned invalid JSON: ${String(error)}`);
  }

  return {
    type: sanitizeType(parsed.type),
    category: sanitizeCategory(parsed.category),
    tags: sanitizeTags(parsed.tags),
    summary: sanitizeSummary(parsed.summary),
  };
}
