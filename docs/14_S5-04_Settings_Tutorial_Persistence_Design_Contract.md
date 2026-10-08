# S5-04 Persistent Settings/Tutorial Contract & Foundation Design Contract

**Status: S5-04 Design FROZEN / READY FOR IMPLEMENTATION after documentation closeout gates.** This is a product, Runtime and persistence design contract, not a claim that Save v4 or either command is implemented. Specification, Protocol, S0-06, frozen Stage 2–4 authority, and S5-01/S5-02 presentation contracts remain controlling. S5-04 is one Task; internal implementation slices do not create extra milestones.

## 1. Approved product facts and ownership

- Persist exactly two independent preferences: `musicEnabled: boolean` and `soundEffectsEnabled: boolean`. Both default to `true` for fresh and migrated legacy data. They express user preference only; browser autoplay and user-gesture restrictions remain presentation/platform concerns. No volume, language, vibration, reduced-motion, Skin or other setting is added.
- Persist acknowledgment/completion, not mere display, of the nine semantic tutorial milestones listed in §4. Fresh and v1/v2/v3 saves have no acknowledged milestones. Neither completed Levels nor Reward, Inventory, Account or gameplay facts imply tutorial completion. MVP has no progress reset. Later read-only help/replay may show a milestone again but cannot clear progress or repeat L4 rewards. S5-07 owns the actual presentation and completion interaction.
- The single authoritative Runtime retains the historical `Stage4GameState` name and gains four **required** root facts: `account`, `currentAttempt`, `settings`, `tutorialProgress`. Settings/tutorial are not economy Account facts, nor a second Runtime or Scene state. S0-06 Local State remains the single versioned persisted representation of that Runtime.
- The normal Runtime constructor validates all four required facts, rejects omission/invalid values at runtime, and never inserts convenience defaults. Only fresh construction and validated legacy migration supply the approved defaults. Ordinary gameplay, Shop, Reward, Item, Benben and lifecycle candidates construct a complete root from prior validated authority, explicitly preserving `settings` and `tutorialProgress`. Settings/tutorial commands preserve every Account and Attempt fact. Compile-time required fields, constructor checks, and candidate-family tests enforce this rather than convention. The exceptional trusted historical reconstruction path must also produce a complete validated root; it cannot silently return only `{ account, currentAttempt }`.

## 2. Save v4 DTO and read-only compatibility

`SaveDocumentV4` has exactly `saveVersion: 4`, `revision`, `account`, `currentAttempt`, `settings: { musicEnabled, soundEffectsEnabled }`, and `tutorialProgress: { acknowledgedMilestoneIds }` at the root. The Account/Attempt/Board/Reward/Item facts retain their existing authoritative interpretation. DTO != Runtime; serialization is explicit, detached and strictly validated. Unknown/missing fields, non-boolean settings, unknown or duplicate milestone IDs, inconsistent old facts, and malformed numeric/version values reject non-destructively. No settings/tutorial-specific storage key or second persistence authority exists.

| Input | Required read behavior | Source version |
|---|---|---|
| No committed save | Construct one account-only Runtime with `true/true` and empty acknowledged set; no write | none |
| v1/v2 | Existing strict historical validation and authentic trusted migration, then private v4 migration with defaults; read-only | original 1/2 |
| v3 | Existing strict external v3 validation **before** pure v3-to-v4 mapping and current validation/reconstruction; defaults only for new facts; read-only | 3 |
| Direct v4 | Strict external v4 validation and current Runtime reconstruction; no historical trust opt-in | 4 |
| Malformed, corrupt, invalid or unsupported/future | Explicit non-destructive rejection/recovery; never classify as no-save, reset, overwrite or downgrade | as diagnosed |

The dispatcher classifies the original version first. A private v4 old-version path carries the **actual authenticated** v1/v2-to-v3 migration result through to reconstruction, checking its existing opaque authenticity and immutable snapshot; it never infers trust from a serialized `legacy-excluded` field, public boolean or ordinary DTO. Direct v4 cannot opt into historical-only `legacy-excluded`; direct v3 retains its existing strict rejection. The v4 module may depend on the historical v3/legacy readers, but historical validators must not import the current dispatcher, avoiding a circular version dependency. No generic migration registry or engine is introduced.

Historical migrated `legacy-excluded` terminal Attempts remain readable with exact old facts, but are not normally writable. `set-setting` and `acknowledge-tutorial` return the **existing** `not-writable` boundary before evaluating no-op while such an Attempt remains. They do not dismiss, settle, normalize or rewrite it. An explicit legal lifecycle dismissal/replacement can clear the Attempt; subsequent preference/progress writes then use the normal path. This is the compatibility exception to these commands' normal availability in account-only and active/pending/failed/won Runtime.

Migration reads never write a slot/head, publish a migrated save, increment revision, regenerate gameplay facts or acknowledge milestones. The first **real** mutation writes v4 at revision `0` from no-save or `N+1` from committed revision `N`, through the existing guarded lease/revision/A-B head commit and persist-before-publish path. A no-op never upgrades a save version. Reload/reopen reconstructs the same authoritative facts and reports the original `sourceSaveVersion` (1/2/3/4), then 4 after a successful v4 write.

## 3. One atomic production activation and rollback

S5-04 Implementation is one reviewed cutover: required Runtime root and constructors; strict v4 validator, mapper and reconstruction; v1/v2/v3 read migration; source-version reporting; `CURRENT_SAVE_VERSION = 4`; production reader; **sole** guarded v4 writer; mutation/session intents and results; S5-02 structural port and sanitized public projection; architecture and production-write-reachability guards. No production path may read v4 while writing v3, write v4 while another approved entry writes v3, emit wrong source version, reconstruct the old root, or fall back to a v3 writer. Historical v1/v2/v3 modules remain for strict reading, migration and regression only, not production mutation.

Before that complete gate passes, production remains on its current Stage 4 Runtime/Save v3 authority. Implementation must test the assembled production root, not only dormant components. Existing committed-head, backup, lease/revision, uncertainty and non-destructive corruption policies are unchanged; localStorage still has no atomic CAS or absolute mutex.

An old v3-only build sees v4 as an unsupported future version and must safely refuse it without overwrite. Before the first v4 commit a reviewed code revert remains possible; after that commit, v3-only code is **not** a valid rollback writer. Recovery requires a forward-compatible fix or separately reviewed compatibility work, never automatic Save downgrade/reset or moving frozen tags.

## 4. Tutorial representation and mutation commands

The approved ID set and **canonical writer order** are:

1. `l1-movement-current-number`
2. `l2-number-hides-on-leave`
3. `l3-flag-misclick-protection`
4. `l4-one-time-coin-reward`
5. `l5-failure-retry-first-step-safety`
6. `first-lucky`
7. `first-obstacle`
8. `first-items`
9. `first-shop`

`acknowledgedMilestoneIds` is semantically a set. A strict validator rejects unknown and duplicate IDs but accepts any order of otherwise valid IDs, producing detached canonical order; the writer always emits that order. An acknowledgment adds one approved ID and canonicalizes. IDs encode no Scene, copy text, modal state or inferred Level completion. Acknowledgment cannot mutate coins, inventory, Rewards, one-time claims, completed levels or Attempt facts.

The semantic commands are `set-setting(key, enabled)` (one of the two exact keys and a boolean, changing only that setting) and `acknowledge-tutorial(milestoneId)` (one exact approved ID). Raw JavaScript input must be validated even when TypeScript structural types exist. They are available in account-only and all normal active/pending/failed/won Attempts. Both preserve unchanged authoritative facts, including runId, Board, Reward and Account, and cannot change gameplay eligibility. Invalid key/value/ID may use existing technical `invalid-request`; historical legacy exclusion uses existing `not-writable`.

Both commands use the existing production writer-authority path: acquire/renew lease -> reread committed authority -> validate expected revision/runId -> reject historical not-writable or invalid input as applicable -> evaluate pure rule -> construct full candidate **only on change** -> Save v4 map/validate -> guarded commit -> publish. A stale revision/runId rejects before no-op. There is no separate lease-free or UI-local mutation path.

The exact no-op reasons are `settings-unchanged` and `tutorial-already-acknowledged`. They are terminal domain/no-op `rejected` results in the existing production result shape, with no candidate, Save mapping, snapshot slot/head write, revision increment or runtime publish. Lease acquisition/renewal may write **coordination metadata**; no-op does not promise zero storage I/O. It is an observation at the validated committed revision, not an absolute multi-tab guarantee.

S5-02 adds these two exact strings to its domain/no-op whitelist and maps them to neutral dedicated copy keys `settings.already-set` and `tutorial.already-acknowledged`. Neither is a successful-save receipt, retryable error or reload requirement. After such a result, presentation reprojects through its existing adapter `read()` of the verified authority; it never renders the rejected candidate or claims a commit. Normal storage-change/stale detection can subsequently require explicit reload. `not-writable` retains its existing technical/no-commit classification and receives explanatory centralized copy if surfaced to a player. Existing stale, lease, storage, uncertain and unknown policies remain conservative and unchanged; classification is exact-string only.

## 5. Protocol §7.1 change control and implementation gate

| Required record | S5-04 approved interpretation |
|---|---|
| Reason | MVP Specification requires persisted settings and tutorial completion, absent from strict production Save v3 and Runtime. |
| Affected frozen contracts | Add required facts to the singular Stage 4 Runtime aggregate; advance its explicit versioned Save authority v3 -> v4; extend production mutation/session and S5-02 semantic intents, sanitized public facts, exact reason/copy mapping. Stage 1 Board/Run/gameplay, Stage 2 A/B commit/revision/lease authority, Stage 3 Items and Stage 4 Account/economy/Reward rules remain unchanged. No second state/save authority. |
| Compatibility and migration | Strict v1/v2/v3 interpretation remains intact. Old reads are pure/read-only with `true/true` and zero acknowledged milestones; authentic historical trust persists privately, direct v4 cannot forge it. Exact Account/Attempt facts, revisions and provenance remain. Normal writes become v4 only at the atomic production cutover. |
| Rollback | No automatic downgrade or reset. A v3-only build rejects v4 and must not overwrite it; after first v4 commit use a reviewed forward-compatible recovery or separately approved migration/compatibility change. Revert this docs-only closeout separately if withdrawn before implementation. |
| Regression / mutation sanity | Full Stage 1–5 quality plus strict v4, old migration/read-only, Runtime field preservation, no-op/stale/lease/uncertain, exact reopen, one-writer reachability and old-client refusal. Claim only mutations actually injected and observed failing. |

Future Implementation evidence must exercise candidate preservation across Start/Abandon/Dismiss/Restart/Retry/Replay/Next, Shop, Flag/movement, Detection/Airplane/Revive/Lucky, Reward/Claim, Benben and terminal settlement; normal Attempt phases and account-only; strict v4 malformed/unknown/duplicate fields; direct v4 legacy forgery rejection; v1/v2 trusted and direct v3 paths; fresh/legacy defaults; set-like canonicalization; zero invented completion; exact reopen; no-op with no Save/revision write but permitted lease metadata; stale guards before no-op; failure atomicity; v4 first write; v3-only refusal; and no production v3/fallback writer reachability. Unit, real production-session integration, architecture checks, full `npm run quality`, independent read-only Reviewer, branch/PR/main Linux Quality, and Recovery Test are mandatory. Mutation sanity targets real risks such as dropping sibling facts, forged migration trust, v3 writer reachability, no-op head write, stale bypass or publish-before-commit; it is future work, not evidence claimed by this documentation Task.

## 6. Scope and recovery

This Design Freeze changes no source, tests, Save implementation, production version or authority, Settings/Tutorial UI, audio, production Levels, Stage 6 features or frozen tags. S5-05 is not authorized. A new AI using this contract, `PROJECT_STATUS`, frozen control documents, source and Git history must recover: approved product facts; nine exact IDs; Runtime ownership; current production still v3 until S5-04 Implementation; trusted migration and historical read-only exception; one atomic v4 gate; no-op/result semantics; rollback; required evidence; and the unique Implementation Next Action. This design is marked FROZEN only after docs review, branch/PR/main Quality and Recovery gates actually succeed; Git/CI identifiers are not fabricated in advance.
