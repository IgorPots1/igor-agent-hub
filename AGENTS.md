# AGENTS.md

## Agent contract

This repository uses human-approved, AI-assisted development.
Agents help with implementation and docs, but humans keep final authority.
Every change should be narrow, reviewable, and tied to an explicit task.

## Mandatory start

1. Run `git status --short` before editing.
2. If the task requires a clean baseline and tree is dirty, stop and report.
3. Read task instructions fully before modifying files.

## Orchestrator context

- Respect `.orch/runs/<runId>/` as the source of task context.
- Read `TASK.md` and `RUN_CONTEXT.md` for the active run.
- Follow allowed scope if provided in the run packet.
- Do not edit outside approved scope without explicit approval.

## Dev Orchestrator handoff workflow

- Check `.orch/runs/<RUN_ID>/` when present.
- Read `TASK.md` first.
- Read `SCOPE.md` if present.
- Use `EXECUTOR_HANDOFF.md` for paths and safety rules.
- Keep changes inside declared scope unless explicitly justified.
- Write `EXECUTOR_REPORT.md` before returning control.
- `COMPLETE_COMMAND.sh` only closes the orchestrator run; it does not authorize commit, push, deploy, or any target-repo release action.
- Do not commit, push, or deploy unless explicitly instructed.

## Change policy

- Prefer small scoped diffs over broad refactors.
- No "while we are here" rewrites.
- Keep naming and structure consistent with existing code.
- Docs/setup tasks must not include runtime behavior changes.

## Safety and security

1. Never edit `.env*` files unless explicitly instructed.
2. Never print, copy, or expose secrets in logs or reports.
3. Never call production APIs unless explicitly requested.
4. Never send Telegram messages unless explicitly requested.
5. Never modify migrations unless explicitly requested.

## Verification policy

- Run checks before final report whenever suitable scripts exist.
- Use documented project scripts only.
- Report command results clearly (pass/fail + brief context).
- If failure appears pre-existing, report it as pre-existing.

## Git policy

1. Commit only if explicitly instructed.
2. Push only if explicitly instructed.
3. Stage only intended files.
4. Do not bundle unrelated edits into the same commit.

## Final report expectations

Include:

- files changed
- checks run and outcomes
- residual risks
- follow-up actions or decisions needed
