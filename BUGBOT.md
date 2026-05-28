# BUGBOT.md — Agent Hub / Second Brain

Review rules for Bugbot on pull requests in **igor-agent-hub** (Second Brain).

## Repo identity

This is the **Agent Hub / Second Brain** Telegram knowledge-capture app. It is **not**:

- `igor-tp-reports-bot`
- TrainingPeaks Reports Bot (`tools/trainingpeaks-export/`)
- Coach OS
- billing

Flag PRs that mix Second Brain changes with TrainingPeaks export tool changes unless the PR description clearly scopes both.

## Critical invariants

### 1. Knowledge-item filter chain

Items shown in Telegram list/search/inbox/summary/stats and exported to Obsidian must pass `isKnowledgeBrainItem()`:

- `status` is active (or empty)
- `no_export` is false
- not a reminder item (type, source, or `напоминание` tag)
- not `ops_log`

**Flag:** Any query or export path that drops these filters or adds unfiltered `brain_items` reads.

### 2. Ops-log detection before AI classification

`tryClassifyBrainItem()` must run `detectBrainItemOpsLog()` before calling OpenAI. Ops logs get `type=ops_log` and `no_export=true`.

**Flag:** Reordering that sends terminal dumps to the AI classifier, or exports ops logs.

### 3. Reminder delivery safety

`/api/cron/reminders` requires `Authorization: Bearer CRON_SECRET`. Delivery uses claim lease (`REMINDER_CLAIM_LEASE_MS`), retry with cap (`MAX_REMINDER_DELIVERY_ATTEMPTS`), and reschedule on failure.

**Flag:**

- Missing or weakened cron auth
- Removing claim/reschedule logic (duplicate Telegram sends)
- Changing retry limits without discussion

### 4. Export auth

`/api/export/obsidian` requires `Authorization: Bearer EXPORT_SECRET`. Response is `application/zip`, `Cache-Control: no-store`.

**Flag:** Unauthenticated export, caching of export responses, or logging the secret.

### 5. Timezone

Reminder parsing and display use **Europe/Belgrade**. Tests and parsers assume Russian date/time phrases.

**Flag:** Hardcoded UTC/local offsets, or switching timezone without explicit migration plan for existing reminders.

## Expected patterns (not bugs)

- Telegram webhook returns `{ ok: true }` even on ignored/invalid payloads (Telegram retry semantics).
- `GET /api/debug/version` is unauthenticated and returns a static deploy marker.
- External cron replaces Vercel cron for reminders (documented in README).
- `tools/obsidian-sync/` is local-only; Vercel never writes to Obsidian.
- Voice messages transcribe then save; non-text forwards get an unsupported reply.
- Natural-language Russian routing duplicates some slash commands — intentional.
- `src/features/agents/router-agent.ts` is a stub; most routing lives in telegram modules.
- Deterministic project/topic hints override AI for project/topic fields — intentional.

## Files that need extra scrutiny

| Area | Files | Watch for |
|------|-------|-----------|
| Classification | `ops-log-detector.ts`, `ai-classifier.ts`, `project-topic.ts` | False negatives on ops logs; invalid project slugs |
| Export | `obsidian-export/formatter.ts`, `repository.ts` | Path traversal in filenames, leaking non-knowledge items |
| Reminders | `reminders/service.ts`, `repository.ts` | Parser regressions, off-by-one on dates, duplicate sends |
| Telegram | `natural-router.ts`, `command-handler.ts` | Breaking Russian NL patterns or menu keyboard routes |
| Sync | `tools/obsidian-sync/sync-obsidian-export.mts` | Unsafe zip extraction, deleting vault outside target folder |

## Security checklist

- [ ] No secrets in code, logs, or committed env files
- [ ] Supabase access uses service role server-side only
- [ ] Export and cron endpoints stay Bearer-protected
- [ ] Obsidian sync validates zip paths before extraction
- [ ] No new public endpoints exposing brain item data without auth

## Schema changes

Migrations live in `supabase/migrations/`. Current tables: `brain_items`, `brain_reminders`.

**Flag:**

- Hand-editing applied migrations instead of adding new ones
- Missing indexes on filtered columns (`status`, `no_export`, `remind_at`, `next_attempt_at`)
- Breaking NOT NULL/default changes without backfill

## Out of scope — do not block on

- Changes confined to `tools/trainingpeaks-export/` when PR is clearly labeled for that tool
- Static marker strings in `debug/version` or webhook GET (`second-brain-full-2026-05-05`)
- Missing unit tests (project uses check scripts, not a test runner)
- README-only or agent-doc-only PRs with no runtime changes

## Suggested review questions

1. Does this change preserve the knowledge-item export/list filter?
2. Could ops-log or reminder content leak into Obsidian?
3. Does reminder logic still prevent duplicate Telegram delivery under concurrent cron?
4. Are new env vars documented in `.env.example` only when the PR intentionally adds them?
5. Is the diff scoped to Second Brain, not TrainingPeaks Reports Bot?
