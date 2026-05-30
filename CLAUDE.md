# CLAUDE.md

## Project purpose

`igor-agent-hub` is a local AI-assisted product repo for Agent Hub / Second Brain.
It captures Telegram inputs, stores structured data in Supabase, and exports selected knowledge to Obsidian.
This file defines how Claude Code should execute orchestrated tasks safely and predictably.
Default behavior: stay within requested scope, keep changes minimal, and report clearly.

## Primary workflow with orchestrator

1. Identify the active run packet under `.orch/runs/<runId>/`.
2. Read `.orch/runs/<runId>/TASK.md` first.
3. Read `.orch/runs/<runId>/RUN_CONTEXT.md` next.
4. If a scope file exists in the run packet, treat it as authoritative.
5. Work only on files required by the task and allowed by scope.
6. If a needed change is outside scope, stop and ask before editing.
7. Keep implementation narrow; avoid opportunistic refactors.
8. Run project checks required by task or repo standards before reporting.
9. Prepare a final report Igor can pass back into orchestrator.

## Scope discipline

- Treat `.orch/runs/<runId>/` as task context, not product runtime code.
- Do not edit unrelated modules "while here."
- Do not rewrite large docs unless explicitly requested.
- Preserve existing behavior unless task explicitly changes behavior.

## Safety rules

1. Do not modify `.env`, `.env.local`, `.env.*`, or secret material.
2. Do not print secrets, tokens, keys, cookies, or private credentials.
3. Do not modify `supabase/migrations/` unless explicitly requested.
4. Do not call production APIs from scripts or code changes.
5. Do not trigger Telegram sends unless task explicitly requires it.
6. Do not deploy anything.
7. Do not push commits unless explicitly instructed.
8. Do not add dependencies unless explicitly requested.

## Editing rules

- Prefer the smallest viable diff.
- Keep changes local to requested files and modules.
- Do not change runtime code when task is docs/setup only.
- Keep style consistent with surrounding files.
- Avoid generated files in commits (`dist`, build artifacts, caches).

## Verification expectations

Before final report:

1. Inspect `package.json` scripts to confirm available checks.
2. Run only cheap, documented checks relevant to the task.
3. Do not invent new checks.
4. If a check fails due to pre-existing issues, report it as pre-existing.

Typical checks for this repo:

- `npm run lint`
- `npm run build`

## Git workflow expectations

1. Start with `git status --short`.
2. If working tree is dirty and task requires clean baseline, stop and report.
3. Stage only intended files.
4. Commit only when explicitly instructed.
5. Push only when explicitly instructed and checks pass.

## Final report format

Use this exact section structure:

### Changed files
- List each changed path.
- Add one short reason per file.

### Checks run
- List each command.
- Report pass/fail and key output summary.

### Risks
- Note any residual risks, assumptions, or unresolved items.

### Follow-up
- Suggest the smallest next actions, if any.

## Practical defaults

- If requirements conflict, prioritize task packet + explicit user instruction.
- If uncertain about scope, ask once before proceeding.
- Keep responses operational and concise.
- End with clear status: done / blocked / needs decision.
