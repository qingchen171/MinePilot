# MinePilot AI Entry Point

This file is the permanent repository entry point for coding agents. It does not replace the authoritative documents below.

## Authority

Read before every Task, in this order:

1. `docs/01_Minesweeper_MVP_Specification_v1.0.md` — product and gameplay authority.
2. `docs/02_AI_Development_Protocol_v1.0.md` — engineering and workflow authority.
3. `docs/04_PROJECT_STATUS.md` — current Stage, frozen contracts, and the unique Next Action.
4. `docs/05_Future_Requirements_Registry.md` — deferred ideas only; never implementation authority.

Also read the frozen contracts relevant to the current Task and inspect Git status/history before changing anything.

## Non-negotiable workflow

- Execute one approved Task at a time. Do not start the next Task.
- Confirm the Task matches the unique Next Action. Stop on architecture, schema, authority, or product ambiguity.
- Do not implement Future Registry items or silently change frozen contracts.
- Do not expand scope merely because a test fails.
- Builder implementation must use `task/<task-id>-<short-description>`; never push implementation directly to `main`.
- Before integration, run `npm run quality`; branch Linux `Quality` must pass.
- A separate read-only Reviewer must inspect the actual diff, tests, scope, and frozen contracts. The Builder's own report is not independent review.
- Only Reviewer `PASS` may proceed through a PR to protected `main`; then confirm main Linux `Quality` before recording a stable baseline.
- Reviewer `BLOCKED` returns to the Builder. Reviewer `NEEDS DECISION` returns to the technical/product authority as appropriate.
- Elio owns product decisions and subjective product acceptance, not Git, CI, merge, test-framework, or technical review operations.

Stage 0, Stage 1, and Stage 2 are frozen. Frozen-boundary changes require the explicit change-control evidence defined in the Development Protocol.
