# AGENTS.md — Agent Hub / Second Brain

Instructions for AI agents working in this repository.

## Identity

| Field | Value |
|-------|-------|
| Repo | `igor-agent-hub` |
| Product | Agent Hub / Second Brain |
| App marker | `second-brain` |
| Primary interface | Telegram bot webhook |
| Database | Supabase (`brain_items`, `brain_reminders`) |
| Export target | Obsidian (Markdown ZIP, not source of truth) |

## Wrong repo?

Stop and re-read scope if the task mentions:

- **igor-tp-reports-bot** or **TrainingPeaks Reports Bot** → use `tools/trainingpeaks-export/`, not Second Brain features
- **Coach OS** → separate product; only referenced as brain-item project `trainingpeaks-coach-os`
- **billing** → separate system

This repo contains a TrainingPeaks export tool under `tools/trainingpeaks-export/` for convenience, but Second Brain agents should not modify it unless the task is explicitly about that tool.

## Architecture (quick)

```
Telegram → /api/telegram/webhook
              ↓
         command-handler / natural-router / voice
              ↓
         brain/service → brain/repository → Supabase
              ↓
         tryClassifyBrainItem (ops-log → AI + project-topic hints)

External cron → /api/cron/reminders → reminders/service → Telegram

Local/machine → /api/export/obsidian → obsidian-export → ZIP
              ↓
         tools/obsidian-sync → Obsidian vault folder
```

## Key modules

### `src/features/brain/`

| File | Role |
|------|------|
| `types.ts` | Item types, categories, projects, shapes |
| `repository.ts` | Supabase CRUD, knowledge-item filters, search |
| `service.ts` | Telegram command helpers, create/classify orchestration |
| `ai-classifier.ts` | OpenAI JSON classification |
| `ops-log-detector.ts` | Detect terminal/build/git dumps → `ops_log` |
| `project-topic.ts` | Deterministic project/topic inference |
| `normalization.ts` | Export text normalization |

Knowledge items exclude: inactive status, `type=reminder`, `type=ops_log`, `no_export=true`, system reminder sources/tags.

### `src/features/reminders/`

Russian natural-language datetime parsing in Belgrade timezone. Evening review for forwarded messages (19:00 and 20:00). Delivery with claim lease, retries (max 3), and stale archive.

### `src/features/obsidian-export/`

`formatter.ts` — Markdown + YAML frontmatter, category folders, section parsing.
`service.ts` — builds `obsidian-export.zip` from knowledge items.

### `src/features/telegram/`

`parser.ts`, `command-handler.ts`, `menu.ts`, `natural-router.ts`, `voice.ts`, `telegram-client.ts`.

### API routes

- `src/app/api/telegram/webhook/route.ts`
- `src/app/api/cron/reminders/route.ts`
- `src/app/api/export/obsidian/route.ts`
- `src/app/api/debug/version/route.ts`

### Migrations (`supabase/migrations/`)

1. `20260504162000_create_brain_items.sql` — base table
2. `20260504193500_add_brain_structure_v1.sql` — category, tags, status defaults
3. `20260504211000_create_brain_reminders.sql` — reminders table
4. `20260505103000_add_brain_reminder_delivery_retries.sql` — retry columns
5. `20260527151500_add_no_export_to_brain_items.sql` — export exclusion flag

Do not create migrations unless explicitly requested.

## Task routing

| If the task is about… | Work in… |
|----------------------|----------|
| Saving, classifying, searching notes | `src/features/brain/` |
| `/remind`, cron delivery, evening review | `src/features/reminders/` |
| Obsidian Markdown/ZIP format | `src/features/obsidian-export/` |
| Telegram UX, commands, NL routing | `src/features/telegram/` |
| Local vault sync | `tools/obsidian-sync/` |
| Schema changes | `supabase/migrations/` (only when asked) |
| TP reports / Coach OS / billing | **Stop — wrong scope** |

## Commands to run

```bash
npm install
npm run lint
npm run build
npm run check:ops-log-detector      # after ops-log-detector changes
npm run check:brain-project-topic   # after project-topic changes
npm run check:obsidian-export       # after export formatter changes
```

## Hard rules

1. **No runtime code changes** when the task is docs-only.
2. **No env changes** — do not edit `.env`, `.env.example`, or deployment secrets unless asked.
3. **No package changes** — do not edit `package.json` / lockfile unless asked.
4. **No migrations** unless explicitly requested.
5. **No commits** unless explicitly requested.
6. **Minimal diffs** — one concern per change; reuse existing abstractions.
7. **Preserve filters** — export and Telegram list/search must keep excluding reminders, ops logs, and `no_export` items.
8. **Keep Belgrade timezone** for reminder parsing unless task says otherwise.

## Testing mindset

There is no full test suite. Rely on:

- `npm run lint` and `npm run build`
- Domain-specific `check:*` scripts in `scripts/`
- Manual Telegram/curl verification for API routes

When adding behavior, prefer extending existing check scripts over ad-hoc test files unless tests are requested.

## Language and UX

- Telegram responses: Russian
- Code, types, logs: English
- Menu keyboard labels: Russian (`Сохранить`, `Напомнить`, `Инбокс`, etc.)

Match existing message formatting (emoji prefixes, truncation limits) in `command-handler.ts` and `reminders/service.ts`.
