import assert from "node:assert/strict";

import { detectBrainItemOpsLog } from "../src/features/brain/ops-log-detector.ts";

const shouldDetectCases = [
  {
    name: "git diff block",
    text: `
diff --git a/src/app.ts b/src/app.ts
index 123abc..456def 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,6 +10,8 @@ function run() {
+ console.log("new");
- console.log("old");
}
`,
  },
  {
    name: "npm run build output",
    text: `
$ npm run build
> app@1.0.0 build
> next build

Creating an optimized production build...
Failed to compile.
error Command failed with exit code 1.
`,
  },
  {
    name: "eslint output",
    text: `
$ pnpm run lint
src/features/brain/service.ts
  20:5  error  Unexpected any  @typescript-eslint/no-explicit-any
  42:1  warning  Missing return type

✖ 2 problems (1 error, 1 warning)
ESLint found too many errors.
`,
  },
  {
    name: "stack trace",
    text: `
Error: Cannot find module './service'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1077:15)
    at Module._load (node:internal/modules/cjs/loader:922:27)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:81:12)
code: 'ERR_MODULE_NOT_FOUND'
`,
  },
  {
    name: "json dump",
    text: `
{
  "event": "deploy",
  "status": "failed",
  "meta": {
    "project": "agent-hub",
    "attempt": 3,
    "errors": [
      {"code": "E42", "message": "build failed"},
      {"code": "E77", "message": "lint failed"}
    ]
  },
  "timestamp": "2026-05-27T10:10:00.000Z"
}
`,
  },
  {
    name: "file list transcript",
    text: `
src/features/brain/service.ts
src/features/brain/repository.ts
src/features/brain/ai-classifier.ts
src/features/telegram/command-handler.ts
src/features/obsidian-export/service.ts
scripts/check-obsidian-export.mts
supabase/migrations/20260504162000_create_brain_items.sql
supabase/migrations/20260527151500_add_no_export_to_brain_items.sql
tools/obsidian-sync/sync-obsidian-export.mts
README.md
`,
  },
];

for (const sample of shouldDetectCases) {
  const detected = detectBrainItemOpsLog(sample.text);
  assert.equal(detected.isOpsLog, true, `Expected ops_log detection for "${sample.name}"`);
  assert.ok(detected.reasons.length > 0, `Expected reasons for "${sample.name}"`);
}

const shouldNotDetectCases = [
  {
    name: "architecture note",
    text: `
Нужно разделить слой Telegram команд и слой классификации, чтобы проще тестировать.
Оставляем Supabase репозиторий как есть и добавим pre-classifier до AI этапа.
`,
  },
  {
    name: "prompt text",
    text: `
Составь промпт для ИИ-ассистента, который помогает структурировать заметки по проектам.
Важно: не меняй смысл, только формат и краткое summary.
`,
  },
  {
    name: "short technical decision",
    text: `
Решение: no_export флаг оставляем в БД и не трогаем telegram-команды.
Экспорт фильтрует такие записи отдельно.
`,
  },
  {
    name: "product summary with few commands",
    text: `
Сегодня обсудили улучшение /save и /summary week. Команды git status и npm run build
используем только для локальной проверки, но сама задача про UX Telegram-ответов.
`,
  },
  {
    name: "content idea",
    text: `
Идея контента: короткий пост про то, как вести второй мозг и почему полезно
записывать решения сразу после созвона.
`,
  },
];

for (const sample of shouldNotDetectCases) {
  const detected = detectBrainItemOpsLog(sample.text);
  assert.equal(detected.isOpsLog, false, `Did not expect ops_log detection for "${sample.name}"`);
}

console.log(
  `Ops-log detector checks passed: ${shouldDetectCases.length} detected, ${shouldNotDetectCases.length} ignored.`
);
