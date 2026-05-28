# CLAUDE.md — Agent Hub / Second Brain

This repository is **Agent Hub** (package name: `igor-agent-hub`), also called **Second Brain** (`second-brain` in API markers). It is a personal Telegram-controlled knowledge capture system backed by Supabase, with Obsidian as an export target.

## Not this repo

Do **not** confuse this project with sibling systems:

| Name | Relationship |
|------|--------------|
| `igor-tp-reports-bot` | Separate repo — TrainingPeaks reports bot |
| TrainingPeaks Reports Bot | Lives under `tools/trainingpeaks-export/` here but is **out of scope** for Second Brain work |
| Coach OS | Separate product (`trainingpeaks-coach-os` is only a brain-item project label) |
| billing | Separate system; may appear as a brain-item topic, not as code to change here |

When working on Second Brain, ignore `tools/trainingpeaks-export/` unless the task explicitly targets that tool.

## What this app does

1. **Capture** — Telegram messages (text, voice, forwards, commands, natural Russian phrases) become `brain_items` in Supabase.
2. **Classify** — Ops-log detector runs first; surviving items get AI classification (type, category, project, topic, tags, summary) plus deterministic project/topic hints.
3. **Remind** — Manual `/remind` and forwarded-message evening review flows create `brain_reminders`, delivered via external cron hitting `/api/cron/reminders`.
4. **Export** — Active knowledge items export as Markdown + YAML frontmatter in a ZIP via `/api/export/obsidian`. Local `tools/obsidian-sync/` syncs that ZIP into an Obsidian vault folder.

Supabase is the source of truth. Obsidian is read-only output.

## Stack

- **Next.js 15** (App Router), React 19, TypeScript
- **Supabase** — `brain_items`, `brain_reminders`
- **OpenAI** — item classification (`gpt-4.1-mini`), voice transcription
- **Telegram Bot API** — primary UI
- **JSZip** — Obsidian archive generation

## Directory map

```
src/
  app/api/
    telegram/webhook/     # Main Telegram ingress
    cron/reminders/       # Reminder delivery (Bearer CRON_SECRET)
    export/obsidian/      # ZIP export (Bearer EXPORT_SECRET)
    debug/version/        # Deploy marker (no auth)
  features/
    brain/                # Core domain: items, classification, ops-log detection
    reminders/            # Parsing, scheduling, delivery
    obsidian-export/      # Markdown/ZIP formatting
    telegram/             # Webhook parsing, menu, natural router, voice
    supabase/             # Server client
    agents/               # Lightweight agent routing stub (memory/content/research)
tools/
  obsidian-sync/          # Local vault sync script (not deployed)
  trainingpeaks-export/   # OUT OF SCOPE — separate tool
supabase/migrations/      # Schema for brain_items and brain_reminders
scripts/                  # Offline check scripts for detectors/formatters
```

## Data model

### `brain_items`

Core fields: `raw_text`, `cleaned_text`, `summary`, `type`, `category`, `project`, `topic`, `tags[]`, `source`, Telegram metadata, `status`, `no_export`, `created_at`.

**Knowledge items** (shown in Telegram lists/search and exported to Obsidian) are active items that are not reminders, not `ops_log`, and not `no_export`.

Item types include: `note`, `idea`, `insight`, `decision`, `task`, `reminder`, `summary`, `prompt`, `bug_fix`, `content_idea`, `product_note`, `ops_log`.

Categories include: `Inbox`, `Run Club`, `AI Running Coach`, `Run Together`, `Agent Hub`, `Контент`, `Ученики`, `Бизнес`, `Личное`.

### `brain_reminders`

Linked to `brain_items` via `brain_item_id`. Tracks `remind_at`, delivery `status`, retry `attempt_count`, `next_attempt_at`. Timezone for parsing/display: **Europe/Belgrade**.

## API routes

| Route | Auth | Purpose |
|-------|------|---------|
| `GET/POST /api/telegram/webhook` | Telegram (implicit) | Process updates |
| `GET/POST /api/cron/reminders` | `Bearer CRON_SECRET` | Deliver due reminders |
| `GET /api/export/obsidian` | `Bearer EXPORT_SECRET` | Download ZIP export |
| `GET /api/debug/version` | None | Deploy identity marker |

Reminders use an **external cron** (every ~5 min), not Vercel Hobby cron.

## Telegram commands

| Command | Action |
|---------|--------|
| `/save <text>` | Save note |
| `/list` | Latest knowledge items |
| `/inbox` | Inbox knowledge items |
| `/last` | Most recent knowledge item |
| `/search <query>` | Search knowledge items |
| `/summary today\|week` | Period summary |
| `/stats` | Brain statistics |
| `/remind <when> <text>` | Create manual reminder |
| `/reminders` | Upcoming reminders |
| `/help` | Help text |

Non-command Russian text is routed by `natural-router.ts` (save, remind, search, etc.). Plain text without a match is auto-saved. Forwarded text creates a task with evening-review reminders at 19:00/20:00 Belgrade time.

## Environment variables

See `.env.example`. Required for production:

- `OPENAI_API_KEY`, `OPENAI_TRANSCRIPTION_MODEL`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `CRON_SECRET`, `EXPORT_SECRET`

Never commit secrets. Do not add or modify `.env` files unless explicitly asked.

## Scripts

```bash
npm run dev              # Local Next.js
npm run build            # Production build
npm run lint             # ESLint
npm run check:ops-log-detector
npm run check:brain-project-topic
npm run check:obsidian-export
npm run obsidian:sync    # Local Obsidian vault sync
```

## Conventions

- Feature code lives in `src/features/<domain>/` with `types.ts`, `repository.ts`, `service.ts` split.
- Repositories talk to Supabase; services hold business logic; API routes are thin handlers.
- Classification: ops-log detector → deterministic project/topic hints → OpenAI classifier. Deterministic hints win over AI for project/topic.
- Reminder parsing is Russian-first with Belgrade timezone. Do not silently change timezone or default hours without explicit request.
- Obsidian export uses `getAllActiveKnowledgeBrainItems()` — respect `no_export`, `ops_log`, and reminder filters.
- User-facing Telegram copy is mostly Russian. Keep tone consistent.
- Prefer minimal, focused diffs. Match existing naming and file layout.

## Safe change boundaries

**In scope:** `src/features/brain`, `reminders`, `obsidian-export`, `telegram`, `supabase`, API routes, `tools/obsidian-sync`, related scripts and migrations (when requested).

**Out of scope unless asked:** `tools/trainingpeaks-export/`, billing systems, Coach OS runtime, package dependency changes, env file edits, commits.

## Before finishing

Run `npm run lint` and `npm run build` when changing TypeScript. Run the relevant `check:*` script when touching ops-log detection, project/topic inference, or Obsidian export formatting.
