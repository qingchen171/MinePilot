# Stage 5 Presentation Architecture Contract

Status: S5-01 accepted design; frozen after closeout Reviewer, PR/main Quality and Recovery gates succeed. No separate S5-01 Implementation phase.

Authority: Specification > Development Protocol > this task contract and PROJECT_STATUS. Stage 0–4 frozen contracts remain authoritative. Design Review, Attack Review and accepted Design Correction culminate in this contract; later product choices below are deferred, not S5-01 blockers.

## 1. Ownership and data flow

The composition root creates exactly one `createProductionStage4Session()` per application/page lifetime. Scenes, overlays and routes receive injected capabilities and never construct sessions. Navigation does not replace the session. Scene shutdown discards presentation state only. Browser reload reads committed authority and never replays an old command. HMR must dispose the entire old presentation root or require full reload; competing sessions are forbidden.

```text
composition root -> single production session
                 -> application adapter -> injected Scene capability
Scene semantic intent -> immutable operation envelope -> session.execute
existing Stage4 command -> validated candidate -> Save v3 -> guarded commit
commit success -> published Runtime -> readonly projection inputs
pure ViewModel projection -> Scene/UI/audio rendering and effects
```

The application adapter coordinates input, technical facts, result classification and recovery. It owns no second Runtime, Board, Account, Inventory, Reward or encounter truth. It must fit S0-06 dependencies: inject a session port rather than directly importing another systems capability; bootstrap wires dependencies only. No Manager/Bus/framework.

## 2. Stable operation envelope

Scenes submit semantic choices, never trusted revision/runId, candidate state or RNG results. At dispatch the adapter reads current session authority and captures expectedRevision and expectedRunId. It obtains required new runId/base seed/version identifiers and Detection initialization seed from injected technical capabilities outside Scenes and outside Stage 1 generation RNG state.

Each logical submission has one deeply immutable envelope. It contains exact intent facts, not generated Board/Reward/Benben/card results. Existing deterministic rules compose those facts. The adapter lifetime exceeds Scene lifetime. Double clicks do not create a second envelope while the operation is unresolved. Animations do not hold the command lock after resolution.

A retry of the same operation preserves every fact. A changed player choice or changed authority closes the old operation. Never retain random facts while silently replacing expectedRevision/runId to apply an old intent to new authority. Envelopes are not saved or automatically restored after browser reload.

## 3. Retry, reload and discard

No automatic retry loops. Classify actual production result reasons explicitly; unknown reasons take the conservative recovery path. Current string reasons may hide lower-level detail, so tests must prove any known-noncommit classification before enabling its retry behavior.

| Result/event | Envelope | Required action |
|---|---|---|
| committed | close/discard | Render session-published Runtime; never replay |
| domain rejection, no-op, invalid input/configuration | close | Friendly feedback; changed choice is a new operation |
| proven failure before commit | retain | User-initiated retry first reloads; reuse exact envelope only if authority still matches |
| revision/runId conflict | discard | Reload; require new user action |
| lease expiry/loss or another writer | discard | Reload; no automatic retry |
| commit-outcome-uncertain/head ambiguity | invalidate permanently | Block mutations; explicit reload determines authority; never replay |
| invalid/corrupt/unavailable persistence or revision mismatch | invalidate | Non-destructive recovery view |
| unknown/unproven failure classification | invalidate | Reload; never infer safe retry |
| duplicate click | no second envelope | Suppress duplicate submission |
| Scene recreation | same adapter retains unresolved operation | Rebuild UI without regenerating facts |
| cancel/route change | close pending retry operation | Does not undo committed facts; future action rereads authority |
| browser/HMR full reload | envelope lost | Boot from committed authority; no intent replay |

Foreground/storage-change notifications invalidate presentation and request session.reload; they never interpret slots/head or execute gameplay. Reload failure keeps mutation blocked. Known committed backup provenance is retained. An uncertain result never supplies a publishable candidate or visual success.

## 4. View models and dependency contract

ViewModels are pure, disposable, readonly display projections, never mutation authority. No mutable alias to domain state. They expose no hidden Mine positions or unclaimed Reward payloads. Unknown Safe and Hidden Mine share public appearance. Exposed facts include explored traces, flags, obstacles, revealed mines, character position and committed assets/usage/outcome.

`ui` imports only ui/assets/config and type-only core; no systems/scenes/Phaser or executable core queries/constructors. The adapter invokes existing domain queries and supplies readonly projection inputs. Current-cell count comes solely from `getCurrentCellMineCount`; UI never scans Board. Available zero becomes safety feedback; occupancy has no number. Do not duplicate victory, eligibility, neighborhood, Reward or Item rules. Missing domain query capability requires explicit scoped review, not a Scene rule.

## 5. Copy, navigation and recovery

All new player-visible text uses stable semantic keys and centralized config resources, including titles, buttons, confirmations, errors, empty states and accessibility labels. Interpolation data is separate. Technical result reasons map centrally to copy keys. Stage 5 provides accepted working-language copy and a resource structure capable of Chinese/English; missing translations remain detectable, never fabricated. Stage 6 owns full translations, switching and bilingual layout verification.

Home/level selection/Game/Shop/Settings/Feedback are ephemeral routes. Pending/won/failed overlays derive from Runtime. Menu navigation never abandons. Cross-level replacement uses precheck -> committed abandon -> start. Terminal return uses applicable dismiss. Revive is pending-only; failed uses Retry. Shop mutation requires account-only authority. Feedback uses the frozen mailto address and uploads nothing automatically.

Corrupt/unavailable saves allow an application shell, feedback and reload, never reset/delete/overwrite/fresh bootstrap. Repeated failed reload retains recovery UI. Effects follow commit and may be interrupted/skipped/reconstructed; no animation callback commits state, claims Reward or triggers victory.

## 6. Deferred product and frozen-boundary prerequisites

Functional Shop remains required MVP scope and is absent from current production command surface. S5-03 Design first requests Elio's offered items, prices, quantity behavior and insufficient-funds behavior. Before production purchase authority, record Protocol §7.1 reason, affected contracts, compatibility impact, version/migration consequences and regression plan. Update the same Account through existing guarded persistence; no ShopState/history/save/commit path.

Settings and tutorial persistence remain required MVP scope, absent from strict frozen Save v3. S5-04 Design first requests exact persisted settings and tutorial-progress facts, then freezes ownership, schema/version/migration defaults and commit semantics. Extend the existing versioned aggregate; no unrelated localStorage key or second save authority, no silent v3 field addition or invented historical progress. New version number is decided in that Task.

These later decisions do not block S5-01 Freeze or S5-02 Design/implementation. Full bilingual delivery, skins, mobile adaptation and test-theme framework remain Stage 6; production Level content remains its approved later boundary.

## 7. Finite Stage 5 sequence

Each capability independently follows Design -> Attack -> Freeze -> Implementation -> Tests -> Review -> CI -> Closeout. Internal engineering slices are not new product milestones.

| Task | Capability | Dependency | Elio decision before Design Freeze | Acceptance boundary |
|---|---|---|---|---|
| S5-02 | Presentation Authority Bridge, Operation Envelope, Pure View Models & Copy-Key Foundation | S5-01 CLOSED | None | Single session; real-session integration; retry matrix; hidden-information isolation; existing schema unchanged |
| S5-03 | Functional Shop Authority & Presentation | S5-02 | Items/prices/quantity/insufficient-funds behavior | Account-only purchases, full Account preserved, guarded commit/failure atomicity, Shop page and frozen-boundary review |
| S5-04 | Persistent Settings/Tutorial Contract & Foundation | S5-02 | Exact settings/tutorial facts | Same versioned aggregate, strict migration/exact restore; no production Level creation |
| S5-05 | Navigation & Non-gameplay Pages | S5-02; functional Shop/Settings require S5-03/S5-04 | No additional required decision | Home/selection/Shop entry/Settings/Feedback; navigation preserves attempt; historical catalog safety |
| S5-06 | Board, Character & Input Presentation | S5-02/S5-05 | No new gameplay decision | Current number/zero/Flag/target input/character reconstruction; animation paths never trigger rules |
| S5-07 | Item, Reward, Benben, Terminal & Tutorial Presentation | S5-03/S5-04/S5-06 | Tutorial facts already frozen in S5-04 | Four Items, Reward/Benben/outcome flows and persisted tutorial progress; post-commit feedback |
| S5-08 | Animation, Audio & Copy Polish | S5-04/S5-06/S5-07 | Asset sourcing/spending approval only when required | Interruptible effects, settings-backed audio, friendly centralized copy, character feedback; no Skin/bilingual expansion |
| S5-09 | Presentation Integration & Stage 5 Freeze Gate | All prior capabilities | None newly required | Desktop complete journey, recovery/failure E2E, representative viewport layout safety, quality/Reviewer/CI/Recovery; no Stage 6 mobile certification |

Shop economy mutation and settings/tutorial schema evolution are separate capabilities with different ownership and frozen-boundary risks. Never combine them merely to reduce task count.

## 8. Required evidence and recovery

Future tests prove: session constructor ownership; no obsolete v2 writes; exact envelope retry/no reroll; stale/uncertain discard/reload; Scene restart/double-click/navigation; immutable hidden-safe projections; centralized text keys; non-destructive corrupt recovery; post-commit rendering and interruption. Reuse Stage 2–4 regressions. Pure unit/integration contracts precede Phaser/browser journeys.

Known limitations remain localStorage without atomic CAS/absolute mutex, string-result classification, HMR lifetime, one production Level, Phaser bundle warning and unchosen assets. No new product rule follows from them.

Recovery requires AGENTS, Specification, Protocol, PROJECT_STATUS, this contract and Git history to identify Stage 0–4 FROZEN, S5-01 design-only CLOSED after gates, single production authority, deferred S5-03/S5-04 decisions, finite S5-02–S5-09 sequence and exactly one next entry: **Stage 5 / S5-02 — Presentation Authority Bridge, Operation Envelope, Pure View Models & Copy-Key Foundation Design Review**. Implementation is not yet authorized.

Closeout evidence lives in its reviewed PR, branch/main Quality runs and Git history; never invent CI identifiers or self-referential baseline hashes. Docs rollback uses a reviewed revert, never moves frozen Stage tags.
