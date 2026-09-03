# S0-04 Engineering Baseline

This document records the reproducible toolchain selected for the MinePilot engineering baseline.

## Locked runtime and package manager

- Node.js: `24.16.0` (Node 24 LTS line)
- npm: `11.13.0`
- Package manager declaration: `npm@11.13.0`
- Install command: `npm ci`

The repository uses `.node-version`, package engine constraints, exact direct dependency versions, and a committed `package-lock.json`. No alternative lockfile is permitted unless a later approved Task changes this decision.

## Locked direct dependencies

- Phaser: `3.90.0`
- Vite: `8.2.2`
- TypeScript: `7.0.2`
- Vitest: `5.0.0`
- Playwright Test: `1.62.1`
- Node.js type definitions: `24.13.3`

Phaser remains on major version 3 because the frozen MVP Specification requires Phaser 3. Phaser 4 is outside the approved technical scope.

TypeScript checks project source in strict mode. `skipLibCheck` is enabled only to avoid re-checking third-party declaration internals, including Phaser 3 legacy-browser declarations; application source and configuration files remain type-checked.

## Commands

- `npm ci`: reproduce the locked dependency tree.
- `npm run dev`: start the local Vite development server at `http://127.0.0.1:5173`.
- `npm run preview`: serve the production build at `http://127.0.0.1:4173`.
- `npm run quality`: run the reusable local quality gate: working-directory guard, TypeScript, Vitest, production bundle, and Playwright E2E.
- `npm run typecheck`: run strict TypeScript checks without emitting files.
- `npm run test:unit`: run the minimal Vitest engineering-baseline test.
- `npm run test:e2e`: start Vite and verify Phaser initialization in Chromium.
- `npm run build`: type-check and create the production build in `dist/`.

## Cross-platform text policy

`.gitattributes` stores text as LF for consistent Windows/Linux development and CI. Windows command scripts may use CRLF. Binary document, image, and font formats are explicitly excluded from text normalization.

## Scope boundary

The displayed Phaser scene is an engineering health check only. It contains no board, mines, movement, numbers, flags, items, levels, persistence, rewards, or other MinePilot gameplay.

## Safe command execution

Project commands that can write to disk must be started from `D:\eliogames` or one of its descendants. The unified quality command checks the resolved working directory before running any child command and then runs every child explicitly from the repository root. A directory outside the repository is rejected with a non-zero exit code before any quality step starts.
