# Plans Directory

This directory stores implementation plans for non-trivial work in `igor-agent-hub`.

Plans are design-time documents used to align scope before coding and to preserve context for future contributors.

## What to include in a plan

Each useful plan should include:

1. Goal
2. Scope
3. Allowed files
4. Forbidden files
5. Risks
6. Step-by-step implementation plan
7. Verification commands
8. Rollback strategy

## When to write a plan

Plans are recommended for medium or high-risk changes, cross-file changes, or work with unclear edge cases.

Plans are not mandatory for tiny, low-risk edits where the implementation is obvious.

## Versioning and history

When a plan provides durable context for future work, commit it with the related change so the rationale remains discoverable in git history.
