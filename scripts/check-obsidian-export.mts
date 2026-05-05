import assert from "node:assert/strict";

import {
  getArchivePath,
  getNormalizedObsidianTags,
  getSafeMarkdownFilename,
  getShortTitle,
  toFrontmatter,
  toMarkdownDocument,
} from "../src/features/obsidian-export/formatter.ts";
import type { BrainItem } from "../src/features/brain/types";

const sampleItem: BrainItem = {
  id: "dd4a3488-1111-2222-3333-444455556666",
  rawText:
    "Improved reminder parser for spoken dates and env variables.\n\nNeed to make the Obsidian export easier to scan in daily reviews.",
  cleanedText: null,
  summary: "Improved reminder parser for spoken dates and env variables",
  type: "note",
  category: "Agent Hub",
  project: null,
  topic: null,
  tags: ["reminder parser", "spoken dates", "Env Variables", "spoken_dates"],
  source: "telegram",
  telegramChatId: null,
  telegramUserId: null,
  telegramUsername: null,
  telegramMessageId: null,
  status: "active",
  createdAt: "2026-05-05T10:30:00.000Z",
};

assert.equal(getShortTitle(sampleItem), "Improved reminder parser for spoken dates and env variables");
assert.deepEqual(getNormalizedObsidianTags(sampleItem.tags), [
  "reminder-parser",
  "spoken-dates",
  "env-variables",
]);
assert.equal(
  getSafeMarkdownFilename(sampleItem),
  "2026-05-05 - Improved reminder parser for spoken dates and env variables - dd4a3488.md"
);
assert.equal(
  getArchivePath(sampleItem),
  "Agent-Hub/2026-05-05 - Improved reminder parser for spoken dates and env variables - dd4a3488.md"
);

const frontmatter = toFrontmatter(sampleItem);

assert.ok(frontmatter.includes('id: "dd4a3488-1111-2222-3333-444455556666"'));
assert.ok(frontmatter.includes("tags:"));
assert.ok(frontmatter.includes('  - "spoken-dates"'));
assert.ok(frontmatter.includes('summary: "Improved reminder parser for spoken dates and env variables"'));

const markdown = toMarkdownDocument(sampleItem);

assert.ok(markdown.includes("# Improved reminder parser for spoken dates and env variables"));
assert.ok(markdown.includes("## Summary"));
assert.ok(markdown.includes("## Original note"));
assert.ok(markdown.includes("## Context"));
assert.ok(markdown.includes("- Category: Agent Hub"));

console.log("Obsidian export checks passed.");
