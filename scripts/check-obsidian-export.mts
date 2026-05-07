import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
  cleanedText:
    "Нужно полировать экспорт заметок в Obsidian для Agent Hub.\n\nСохранить zip-экспорт без изменений, не трогать auth и cron, проверить несколько заметок вручную после генерации архива.",
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

assert.ok(frontmatter.startsWith("---\n"));
assert.ok(frontmatter.endsWith("\n---"));
assert.ok(frontmatter.includes('type: "note"'));
assert.ok(frontmatter.includes('source: "telegram"'));
assert.ok(frontmatter.includes('status: "active"'));
assert.ok(frontmatter.includes('category: "Agent Hub"'));
assert.ok(frontmatter.includes("project: null"));
assert.ok(frontmatter.includes("topic: null"));
assert.ok(frontmatter.includes('created_at: "2026-05-05T10:30:00.000Z"'));
assert.ok(frontmatter.includes("tags:"));
assert.ok(frontmatter.includes('  - "second-brain"'));

const markdown = toMarkdownDocument(sampleItem);

assert.ok(markdown.includes("# Нужно полировать экспорт заметок в Obsidian для Agent Hub"));
assert.ok(markdown.includes("## Кратко"));
assert.ok(markdown.includes("Нужно полировать экспорт заметок в Obsidian для Agent Hub."));
assert.ok(!markdown.includes("Polish Obsidian export formatting"));
assert.ok(markdown.includes("## Суть"));
assert.ok(markdown.includes("Сохранить zip-экспорт без изменений"));
assert.ok(markdown.includes("## Исходная запись"));
assert.ok(markdown.indexOf("## Исходная запись") < markdown.indexOf(sampleItem.rawText));
assert.ok(markdown.includes(sampleItem.rawText));
assert.ok(!markdown.includes("## Context"));
assert.ok(!markdown.includes("## Контекст"));
assert.ok(markdown.includes("<details>"));
assert.ok(markdown.includes("<summary>Показать исходную запись</summary>"));
assert.ok(markdown.includes("```text"));

const taskItem: BrainItem = {
  ...sampleItem,
  id: "task-1111-2222-3333-444455556666",
  rawText: "Починить экспорт Obsidian для задач",
  cleanedText: null,
  summary: null,
  type: "task",
  source: "telegram_forward",
  tags: ["вечерний обзор", "Obsidian Export"],
};

const taskMarkdown = toMarkdownDocument(taskItem);
assert.ok(taskMarkdown.includes("## Действия"));
assert.ok(taskMarkdown.includes("## Исходная запись"));
assert.ok(taskMarkdown.includes(taskItem.rawText));

const projectItem: BrainItem = {
  ...sampleItem,
  id: "project-1111-2222-3333-444455556666",
  rawText:
    "TrainingPeaks Reports Bot — статус на 2026-05-07 Цель проекта: собрать стабильный Telegram-бот для отчётов TrainingPeaks. Текущий статус: локальный sync уже работает, но Markdown в Obsidian всё ещё выглядит слишком тяжело. Архитектура: Next.js API + Telegram + Supabase. Текущая рабочая связка: webhook - очередь задач - генерация Markdown. Что сделали: подняли локальный sync - привели export к детерминированному виду. Решения: raw_text сохраняем без изменений. Следующие шаги: укоротить заголовки - убрать английский в кратком - сделать исходную запись сворачиваемой.",
  cleanedText: null,
  summary: "Detailed status and architecture of the reports bot export pipeline",
  type: "note",
};

assert.equal(getShortTitle(projectItem), "TrainingPeaks Reports Bot — статус на 2026-05-07");

const projectMarkdown = toMarkdownDocument(projectItem);
assert.ok(projectMarkdown.includes("# TrainingPeaks Reports Bot — статус на 2026-05-07"));
assert.ok(projectMarkdown.includes("## Кратко"));
assert.ok(projectMarkdown.includes("собрать стабильный Telegram-бот для отчётов TrainingPeaks."));
assert.ok(!projectMarkdown.includes(projectItem.summary ?? ""));
assert.ok(projectMarkdown.includes("## Суть"));
assert.ok(projectMarkdown.includes("Markdown в Obsidian всё ещё выглядит слишком тяжело."));
assert.ok(projectMarkdown.includes("## Архитектура"));
assert.ok(projectMarkdown.includes("## Что сделано"));
assert.ok(projectMarkdown.includes("## Важные решения"));
assert.ok(projectMarkdown.includes("## Следующие шаги"));
assert.ok(projectMarkdown.includes("- очередь задач"));
assert.ok(projectMarkdown.includes("<details>"));

const serviceSource = readFileSync(
  new URL("../src/features/obsidian-export/service.ts", import.meta.url),
  "utf8"
);
assert.ok(serviceSource.includes("getAllActiveKnowledgeBrainItems"));
assert.ok(!serviceSource.includes("getAllActiveBrainItems()"));

console.log("Obsidian export checks passed.");
