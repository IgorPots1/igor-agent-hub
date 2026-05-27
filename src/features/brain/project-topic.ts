import { BRAIN_ITEM_PROJECTS } from "./types.ts";
import type { BrainItemProject } from "./types.ts";

const MAX_TOPIC_LENGTH = 64;
const brainProjectSet = new Set<string>(BRAIN_ITEM_PROJECTS);

export type BrainItemProjectTopicHints = {
  project: BrainItemProject | null;
  topic: string | null;
  reasons: string[];
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function containsAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}

export function sanitizeBrainItemProject(value: unknown): BrainItemProject | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedProject = normalizeWhitespace(value).toLowerCase();
  return brainProjectSet.has(normalizedProject) ? (normalizedProject as BrainItemProject) : null;
}

export function sanitizeBrainItemTopic(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedTopic = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’"`]+/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}\-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_TOPIC_LENGTH)
    .trim();

  return normalizedTopic || null;
}

function inferTopicFromNormalizedText(normalizedText: string): string | null {
  if (normalizedText.includes("billing")) {
    return "billing";
  }

  if (containsAny(normalizedText, ["obsidian", "export/obsidian", "obsidian export", "sync obsidian"])) {
    return "obsidian-sync";
  }

  if (containsAny(normalizedText, ["export hygiene", "export-hygiene"])) {
    return "export-hygiene";
  }

  if (containsAny(normalizedText, ["ops_log", "ops log", "ops-log"])) {
    return "ops-log";
  }

  if (containsAny(normalizedText, ["/remind", "/reminders", "reminder"])) {
    return "reminders";
  }

  if (containsAny(normalizedText, ["telegram bot", "/save", "/last", "/list", "/summary", "webhook"])) {
    return "telegram-bot";
  }

  if (containsAny(normalizedText, ["attention digest", "attention-digest"])) {
    return "attention-digest";
  }

  if (containsAny(normalizedText, ["case ledger", "case-ledger"])) {
    return "case-ledger";
  }

  if (containsAny(normalizedText, ["move workout", "move action", "trainingpeaks move"])) {
    return "trainingpeaks-move-action";
  }

  if (containsAny(normalizedText, ["weekly reports", "weekly report"])) {
    return "weekly-reports";
  }

  if (containsAny(normalizedText, ["race prediction", "race-prediction"])) {
    return "race-prediction";
  }

  if (containsAny(normalizedText, ["student registry", "student signal", "coaching signal"])) {
    return "student-signals";
  }

  if (containsAny(normalizedText, ["beginner methodology", "beginner-methodology"])) {
    return "beginner-methodology";
  }

  if (containsAny(normalizedText, ["race season", "race-season"])) {
    return "race-season-planning";
  }

  if (containsAny(normalizedText, ["strava", "strava sync", "strava-sync"])) {
    return "strava-sync";
  }

  if (containsAny(normalizedText, ["weekly plan generator", "plan generator"])) {
    return "weekly-plan-generator";
  }

  if (containsAny(normalizedText, ["plan validation", "plan repair", "validation/repair"])) {
    return "training-plan-validation";
  }

  if (
    containsAny(normalizedText, [
      "content idea",
      "идея:",
      "hook",
      "пост",
      "сценарий",
      "контент",
    ])
  ) {
    return "content-ideas";
  }

  return null;
}

export function inferBrainItemProjectTopic(
  rawText: string,
  existingCategory?: string
): BrainItemProjectTopicHints {
  const normalizedText = normalizeWhitespace(rawText).toLowerCase();
  const normalizedCategory = normalizeWhitespace(existingCategory ?? "");
  const reasons: string[] = [];

  const agentHubMatched = containsAny(normalizedText, [
    "second brain",
    "agent hub",
    "obsidian",
    "brain_items",
    "/save",
    "/last",
    "/list",
    "/summary",
    "/remind",
    "export/obsidian",
  ]);
  if (agentHubMatched) {
    reasons.push("agent-hub-keywords");
  }

  const tpMatched = containsAny(normalizedText, [
    "trainingpeaks",
    "tp reports bot",
    "coach os",
    "attention digest",
    "case ledger",
    "student registry",
    "move workout",
  ]);
  const tpBillingMatched = tpMatched && normalizedText.includes("billing");
  if (tpMatched || tpBillingMatched) {
    reasons.push("trainingpeaks-keywords");
  }

  const aiRunningCoachMatched = containsAny(normalizedText, [
    "ai running coach",
    "onboarding",
    "weekly plan generator",
    "strava",
    "beginner methodology",
    "race season",
    "plan validation",
    "plan repair",
  ]);
  if (aiRunningCoachMatched) {
    reasons.push("ai-running-coach-keywords");
  }

  const runClubMatched = containsAny(normalizedText, [
    "run club",
    "club chat",
    "workout feed",
    "public profile",
    "race screen",
    "likes",
    "notifications",
  ]);
  if (runClubMatched) {
    reasons.push("run-club-keywords");
  }

  const contentStrongMatched =
    normalizedText.startsWith("идея:") || normalizedText.startsWith("content idea");
  const contentMatched =
    contentStrongMatched ||
    containsAny(normalizedText, ["content idea", "hook", "пост", "сценарий", "контент"]);
  if (contentMatched) {
    reasons.push("content-keywords");
  }

  const studentsMatched =
    normalizedCategory === "Ученики" ||
    containsAny(normalizedText, [
      "student signal",
      "coaching signal",
      "athlete signal",
      "pain",
      "health",
      "reporting",
      "расписание",
      "ученик",
      "ученики",
    ]);
  if (studentsMatched) {
    reasons.push("students-keywords");
  }

  const projectHits = [
    agentHubMatched ? "agent-hub" : null,
    tpMatched || tpBillingMatched ? "trainingpeaks-coach-os" : null,
    aiRunningCoachMatched ? "ai-running-coach" : null,
    runClubMatched ? "run-club" : null,
    contentMatched ? "content" : null,
    studentsMatched ? "students" : null,
  ].filter((value): value is BrainItemProject => value !== null);

  const uniqueProjects = Array.from(new Set(projectHits));
  let project: BrainItemProject | null = uniqueProjects.length === 1 ? uniqueProjects[0] : null;

  if (contentStrongMatched) {
    project = "content";
    reasons.push("content-strong-prefix");
  }

  if (uniqueProjects.length > 1) {
    reasons.push("ambiguous-project");
  }

  const hintedTopic = inferTopicFromNormalizedText(normalizedText);
  const topic = sanitizeBrainItemTopic(hintedTopic);

  if (topic) {
    reasons.push(`topic:${topic}`);
  }

  return {
    project,
    topic,
    reasons,
  };
}
