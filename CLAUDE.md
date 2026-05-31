# CLAUDE.md

Stable operating instructions for Claude Code working in `igor-agent-hub`.

## 1. Project purpose

`igor-agent-hub` powers Igor's personal Second Brain / Agent Hub workflows. It is a real personal productivity system, not a toy or demo repo.

Core capabilities:

- Telegram capture
- reminders
- inbox / list / search flows
- summary commands
- Obsidian export
- project / topic organization
- export hygiene (`no_export`, `ops_log`)

The repo captures Telegram inputs, stores structured data in Supabase, and exports selected knowledge to Obsidian. Default behavior: stay within requested scope, keep changes minimal, and report clearly.

## 2. Risk level

This is a **medium-risk** repo.

Reasons:

- personal notes and context
- Telegram messages
- reminders
- production Supabase data
- Obsidian export
- Vercel runtime
- secrets may exist locally outside git

Treat every change as potentially affecting live personal data or integrations.

## 3. Hard safety rules

1. Never commit unless explicitly asked.
2. Never push unless explicitly asked.
3. Never deploy unless explicitly asked.
4. Never modify `.env`, `.env.local`, `.env.*`, or secret material.
5. Never print secrets, tokens, keys, cookies, or private credentials.
6. Never weaken auth, cron, webhook, Telegram, Supabase, or export protections.
7. Never run destructive database operations.
8. Never run production migrations unless explicitly requested.
9. Do not modify `supabase/migrations/` unless explicitly requested.
10. Never send Telegram messages unless explicitly requested.
11. Never broaden export scope without explicit approval.
12. Never remove `no_export` / `ops_log` protections casually.
13. Do not call production APIs from scripts or code changes unless the task explicitly requires it.
14. Do not add dependencies unless explicitly requested.
15. Prefer dry-run / read-only / local checks when available.

## 4. Second Brain / Obsidian rules

- Obsidian export should stay clean and intentional.
- `no_export` and `ops_log` are important noise filters — do not bypass or weaken them casually.
- Raw sync and curated Second Brain layers should not be mixed casually.
- Avoid creating duplicate noisy notes.
- Preserve project / topic classification behavior unless the task explicitly changes it.
- Export changes should be tested carefully before reporting done.

When relevant, use focused checks from `package.json`:

- `npm run check:obsidian-export`
- `npm run check:ops-log-detector`
- `npm run check:brain-project-topic`

## 5. Telegram rules

- Telegram content may contain private context — treat it as sensitive.
- Do not send messages automatically unless the task explicitly requires it.
- Do not weaken command parsing safety.
- Do not broaden webhook behavior casually.
- Voice / text command handling should preserve existing command routes.
- Reminders should not pollute knowledge / search / export flows.

## 6. Reminders / knowledge separation

- Reminders and knowledge items must stay logically separated.
- `/inbox`, `/search`, `/list`, `/summary`, `/last` should stay knowledge-focused.
- `/reminders` should remain reminder-focused.
- Reminder cleanup should not archive unrelated knowledge items.

## 7. Development workflow

Claude / Cursor should:

1. Start with `git status --short`.
2. Inspect current code before editing.
3. Keep changes narrow; avoid unrelated refactors.
4. Preserve existing behavior unless the task explicitly changes it.
5. Update focused tests for behavior changes.
6. Run the smallest relevant checks first.
7. Report exact files changed and commands run.

### Orchestrator workflow

When an active run packet exists under `.orch/runs/<runId>/`:

1. Read `.orch/runs/<runId>/TASK.md` first.
2. Read `.orch/runs/<runId>/RUN_CONTEXT.md` next.
3. If a scope file exists in the run packet, treat it as authoritative.
4. Work only on files required by the task and allowed by scope.
5. If a needed change is outside scope, stop and ask before editing.
6. Prepare a final report Igor can pass back into the orchestrator.

### Scope discipline

- Treat `.orch/runs/<runId>/` as task context, not product runtime code.
- Do not edit unrelated modules "while here."
- Do not rewrite large docs unless explicitly requested.
- Do not change runtime code when the task is docs / setup only.
- Keep style consistent with surrounding files.
- Avoid generated files in commits (`dist`, build artifacts, caches).

### Default checks

- `npm run lint`
- `npm run build`

When relevant:

- focused scripts / checks from `package.json`
- Obsidian export checks
- Telegram command parser checks
- reminder checks
- Supabase / data checks only in safe / dry-run mode unless explicitly requested

Before final report:

1. Inspect `package.json` scripts to confirm available checks.
2. Run only cheap, documented checks relevant to the task.
3. Do not invent new checks.
4. If a check fails due to pre-existing issues, report it as pre-existing.

## 8. Expected report format

Every task report should include:

1. **Summary of changes** — what was done and why.
2. **Files changed** — list each path with a short reason.
3. **Behavior before / after** — only when behavior changed.
4. **Checks run and results** — command, pass / fail, key output.
5. **Safety confirmation:**
   - no secrets touched
   - no push
   - no deploy
   - no unintended Telegram sends
   - no unintended production data mutations
   - no unintended Obsidian export changes unless requested
6. **Commit hash** — only if explicitly asked to commit.

Use this section structure for orchestrator handoffs:

### Changed files

### Checks run

### Risks

### Follow-up

End with clear status: done / blocked / needs decision.

## 9. What not to build

- no custom multi-agent runtime inside this repo
- no broad autonomous Telegram behavior without review
- no aggressive semantic memory changes without explicit task
- no hidden background jobs that mutate production data without clear cron / auth guards
- no large dashboard / product expansion unless explicitly requested
- no removal of export hygiene filters without explicit approval

## 10. Igor's preferred implementation style

- simple, narrow, production-minded changes
- no big rewrite unless explicitly requested
- avoid clever abstractions
- preserve working flows
- prefer readable code and practical checks
- communicate in clear summaries
- when committing, stage only intended files

### Git workflow

1. If working tree is dirty and task requires clean baseline, stop and report.
2. Stage only intended files.
3. Commit only when explicitly instructed.
4. Push only when explicitly instructed and checks pass.

### Practical defaults

- If requirements conflict, prioritize task packet + explicit user instruction.
- If uncertain about scope, ask once before proceeding.
- Keep responses operational and concise.
