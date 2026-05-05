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
    "Нужно полировать экспорт заметок в Obsidian для Agent Hub. 1. Сделать заголовки читабельнее 2. Убрать лишний английский 3. Разбить сплошной текст на абзацы.\n\n- Сохранить zip-экспорт без изменений\n- Не трогать auth и cron\n- Сохранить исходный raw_text без смысловых искажений\n- Подтянуть локализацию метаданных и секций\n- Проверить несколько заметок вручную после генерации архива",
  cleanedText: null,
  summary: "Polish Obsidian export formatting",
  type: "note",
  category: "Agent Hub",
  project: null,
  topic: null,
  tags: ["Obsidian Export", "Second Brain", "Agent Hub", "obsidian_export"],
  source: "telegram",
  telegramChatId: null,
  telegramUserId: null,
  telegramUsername: null,
  telegramMessageId: null,
  status: "active",
  createdAt: "2026-05-05T10:30:00.000Z",
};

assert.equal(getShortTitle(sampleItem), "Нужно полировать экспорт заметок в Obsidian для Agent Hub");
assert.deepEqual(getNormalizedObsidianTags(sampleItem.tags), [
  "obsidian-export",
  "second-brain",
  "agent-hub",
]);
assert.equal(
  getSafeMarkdownFilename(sampleItem),
  "2026-05-05 - Нужно полировать экспорт заметок в Obsidian для Agent Hub - dd4a3488.md"
);
assert.equal(
  getArchivePath(sampleItem),
  "Agent-Hub/2026-05-05 - Нужно полировать экспорт заметок в Obsidian для Agent Hub - dd4a3488.md"
);

const frontmatter = toFrontmatter(sampleItem);

assert.ok(frontmatter.includes('id: "dd4a3488-1111-2222-3333-444455556666"'));
assert.ok(frontmatter.includes("теги:"));
assert.ok(frontmatter.includes('  - "second-brain"'));
assert.ok(frontmatter.includes('тип: "заметка"'));
assert.ok(frontmatter.includes('кратко: "Polish Obsidian export formatting"'));

const markdown = toMarkdownDocument(sampleItem);

assert.ok(markdown.includes("# Нужно полировать экспорт заметок в Obsidian для Agent Hub"));
assert.ok(markdown.includes("## Кратко"));
assert.ok(markdown.includes("## Исходная запись"));
assert.ok(markdown.includes("## Контекст"));
assert.ok(markdown.includes("- Категория: Agent Hub"));
assert.ok(markdown.includes("- Тип: заметка"));
assert.ok(markdown.includes("- Источник: Telegram"));
assert.ok(markdown.includes("- Теги: #obsidian-export #second-brain #agent-hub"));
assert.ok(markdown.includes("1. Сделать заголовки читабельнее\n2. Убрать лишний английский"));
assert.ok(markdown.includes("<details>"));

console.log("Obsidian export checks passed.");
