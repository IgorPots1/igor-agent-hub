# Orchestrator Smoke Test Note

This file was added as a tiny docs-only change during the final `igor-dev-orchestrator` launch smoke test using an attended Cursor workflow.

## Primary Workflow (Docs-Only)

Use the primary workflow for safe, small changes:

1. Start with `orch task`.
2. Executor reads the target packet under `.orch/runs/<RUN_ID>/`.
3. Executor applies the docs update and writes `EXECUTOR_REPORT.md`.
4. Igor runs `orch complete --run <RUN_ID> --report-file <REPORT_PATH>`.
5. Orchestrator generates verify/review artifacts, `PR_BODY.md`, and a brain draft.
6. Push happens only after checks and review pass.

`.orch/` is ignored and should never be committed.
