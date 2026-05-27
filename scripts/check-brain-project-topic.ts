import assert from "node:assert/strict";

import {
  inferBrainItemProjectTopic,
  sanitizeBrainItemProject,
  sanitizeBrainItemTopic,
} from "../src/features/brain/project-topic.ts";

function mergeProjectTopic(
  rawText: string,
  category: string | null,
  ai: { project: unknown; topic: unknown }
): { project: string | null; topic: string | null } {
  const deterministic = inferBrainItemProjectTopic(rawText, category ?? undefined);
  const deterministicProject = sanitizeBrainItemProject(deterministic.project);
  const deterministicTopic = sanitizeBrainItemTopic(deterministic.topic);
  const aiProject = sanitizeBrainItemProject(ai.project);
  const aiTopic = sanitizeBrainItemTopic(ai.topic);

  return {
    project: deterministicProject ?? aiProject,
    topic: deterministicTopic ?? aiTopic,
  };
}

assert.equal(sanitizeBrainItemProject("agent-hub"), "agent-hub");
assert.equal(sanitizeBrainItemProject("unknown-project"), null);
assert.equal(sanitizeBrainItemTopic(" Beginner Methodology "), "beginner-methodology");
assert.equal(sanitizeBrainItemTopic("  ###  "), null);
assert.equal(sanitizeBrainItemTopic("training_plan__validation!!!"), "training-plan-validation");

const agentHubHints = inferBrainItemProjectTopic(
  "Second Brain export/obsidian sync for Agent Hub: fix /save and /summary formatting.",
  "Agent Hub"
);
assert.equal(agentHubHints.project, "agent-hub");
assert.ok(
  agentHubHints.topic === "obsidian-sync" || agentHubHints.topic === "export-hygiene",
  "Expected Agent Hub topic to be obsidian-sync or export-hygiene"
);

const tpBillingHints = inferBrainItemProjectTopic(
  "TrainingPeaks Coach OS billing issue: TP Reports Bot weekly reports and case ledger review.",
  "Бизнес"
);
assert.equal(tpBillingHints.project, "trainingpeaks-coach-os");
assert.equal(tpBillingHints.topic, "billing");

const aiRunningCoachHints = inferBrainItemProjectTopic(
  "AI Running Coach beginner methodology update for onboarding and race season planning.",
  "AI Running Coach"
);
assert.equal(aiRunningCoachHints.project, "ai-running-coach");
assert.equal(aiRunningCoachHints.topic, "beginner-methodology");

const contentHints = inferBrainItemProjectTopic(
  "идея: контент про onboarding и hook для поста",
  "Контент"
);
assert.equal(contentHints.project, "content");
assert.equal(contentHints.topic, "content-ideas");

const ambiguousHints = inferBrainItemProjectTopic("Need to review generic note tomorrow.", "Inbox");
assert.equal(ambiguousHints.project, null);
assert.equal(ambiguousHints.topic, null);

const deterministicWins = mergeProjectTopic("Second Brain Obsidian sync status update", "Agent Hub", {
  project: "run-club",
  topic: "weekly-reports",
});
assert.equal(deterministicWins.project, "agent-hub");
assert.equal(deterministicWins.topic, "obsidian-sync");

const aiFallback = mergeProjectTopic("Generic planning note for next week", "Inbox", {
  project: "business",
  topic: "weekly reports",
});
assert.equal(aiFallback.project, "business");
assert.equal(aiFallback.topic, "weekly-reports");

const invalidAiFallback = mergeProjectTopic("Generic planning note for next week", "Inbox", {
  project: "totally-unknown",
  topic: "$$$",
});
assert.equal(invalidAiFallback.project, null);
assert.equal(invalidAiFallback.topic, null);

console.log("Brain project/topic checks passed.");
