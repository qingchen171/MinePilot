# Gate B playable L1 handoff (implementation evidence, not product acceptance)

Authority: docs/22, especially §§2–5 and §8. Elio authorized this narrow playable slice. Gate A remains accepted. Gate B hands-on acceptance is PENDING; S5-09 is not CLOSED, Stage 5 remains IN PROGRESS and Stage 6/7 remain LOCKED. PROJECT_STATUS and frozen contracts are unchanged by this implementation.

## Run and inspect

From `D:\eliogames`, use the repository-locked Node/npm versions, `npm ci` if dependencies are absent, then `npm run dev -- --host 127.0.0.1 --port 5181`. Open `http://127.0.0.1:5181/`, choose Levels, then the actual L1 (or Continue an existing Attempt). Only the Game view receives the new style. Do not clear real saved data for inspection.

Elio's check: at 1366×768, 1280×720, 1024×768 and 1920×1080 inspect the explorer, both feet, shadow, head number and Board readability. Move with primary click, Flag with secondary click or focused target + Flag button; use arrow keys to focus without moving, Enter/Space to act. Verify immediate independent actions, F5/Continue, menu return, and music/SFX preferences remain usable. Judge character identity, dimensionality, scale and comfort personally. Automated evidence cannot pass this subjective gate. Random production L1 does not promise any particular illustrative number or encounter; deterministic edge cases are tested separately below.

## Narrow capability and boundaries

- Shared logical square Board geometry plus separately allocated decorative gutters. DOM remains the sole hit/input surface. Phaser draws only sanitized public facts.
- Sixteen separately registered atlas frames (four directions × idle/two-step/observe), uniform aspect-preserving scale and owning-tile feet baseline. Poses appear only at the committed destination; no intermediate gameplay cells or command queue.
- Trusted positive 1–8 badge, no hardcoded reference `2`, no visible duplicate count, hidden in waiting/zero/revealed-Mine occupancy. One coordinate-aware live sentence changes only with meaningful public position/count facts, not redraw.
- Cancelable exact-operation visual cues distinguish requested target, committed destination and effect anchor; existing Retry/uncertain/recovery authority remains unchanged.
- Right rail retains immediate pending Revive/Failure, Flag, four Item cards, legal controls and explicit tutorial acknowledgments in an on-demand drawer. Existing domain availability remains authoritative.
- No gameplay, RNG, production catalog, Account/Save v4, writer/session, Item/Reward/Benben or settings changes. No Home/Levels redesign, full Chinese rollout, new audio or Stage 6 features. Those later obligations remain in docs/22 §8.

## Traceable evidence

| Boundary | Actual automated evidence / provenance |
|---|---|
| Four desktop allocations, min cell and outer gutters | `tests/unit/ui/gate-b-layout.test.ts`; real browser `gate-b-playable.spec.ts`, nine center/edge/corner positions per viewport. These are strict preloaded v4 compatibility snapshots built from genuine generated production L1 Boards, not nine continuous live histories. |
| Dynamic badge and feet | Same browser suite checks trusted fixture number, single badge, ≥14px type, ≥16px line, ≥4.5 contrast, pointer-through overflow; sixteen source-frame lower-paw bands and uncropped bottoms. Independent whole-paw visual inspection supplements this numerical band test; the band test is not a semantic anatomy classifier. |
| Actual Phaser, interruption and accessibility | Browser suite compares actual canvas interior pixels with the registered opaque explorer atlas, after two real committed moves, resize interruption, Home/Continue and F5; revision stays +2 and the owning-cell live region does not change on resize. Pending Revive and Failure are both immediately visible at 1024×768. |
| DOM/Phaser alignment and layout | Existing `s5-09-desktop-layout.spec.ts` extended to all four desktop sizes and DPR2/125% CSS zoom: real flagged-cell pixel samples at corners/edges/center, focus, obstruction and clipping assertions. Native help drawers are opened before inspecting their controls; no obstruction assertion removed. Vertical scrolling is allowed. |
| Input and recovery | Existing `board.spec.ts`, navigation/two-tab/Shop regressions, keyboard focus-loss, double-click/right-click/Flag, rapid distinct targets, waiting/zero/occupancy, historical read-only and uncertain/stale/Recovery tests remain in full quality. |
| Exact effect provenance | Existing guarded-session `s5-08-committed-effects.test.ts` additionally distinguishes pending requested target from the actual previous Lucky occupancy and effect anchor. Existing rewards/Benben/Retry proofs remain in full quality. |
| Scope | Existing architecture and production-write-reachability guards retained, not weakened. No new production test hook or production Level. |

Full local/branch/PR/main Quality and exact final independent Reviewer decision are reported against their actual revisions in the PR evidence. This file does not preclaim future CI, merge, Recovery or product acceptance.

## Asset provenance and limitations

`gate-b-provenance.json` records each new separate atlas/backdrop's prompt, provider, source/output hashes, dimensions, rights basis, unknown model version, use and cost. Gate A archive PNGs are not imported as runtime textures. User-represented reference rights plus OpenAI Output ownership are the recorded basis, not a guarantee of exclusivity or third-party clearance. No paid purchase was initiated. Original generated files and local design drafts are preserved.

The three PNGs total about 5.4 MiB transferred and 18 MiB decoded before GPU/browser overhead; the explorer atlas is about 6 MiB decoded, above the 0.6 MiB 96px planning example. This retains source quality for this small slice, not a completed broad-rollout optimization. Missing textures retain safe geometric fallback, but fallback is not Gate B quality approval. Public markers remain simple drawn overlays, Item icons use minimal authored shapes, and existing English/audio remains until the separately authorized later rollout. No screenshot certifies production gameplay by itself.

Rollback: reviewed revert of this presentation/assets/test commit to pre-slice `7082c18a3f795265f5bd2419c5284ee481cc53d9`; do not reset, downgrade or erase Save v4, rewrite Gate A acceptance, or delete design drafts. The engineering merge, if passed, still stops for Elio's Gate B hands-on result before any broader rollout.
