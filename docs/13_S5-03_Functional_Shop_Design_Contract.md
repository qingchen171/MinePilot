# S5-03 Functional Shop Authority & Presentation Design Contract

**Status: S5-03 Design FROZEN / READY FOR IMPLEMENTATION after documentation closeout gates.** This is an additive, approved MVP Shop design, not a claim that purchase code or UI already exists. Specification, Protocol, S0-06, frozen Stage 2–4 authority, and the S5-01/S5-02 presentation contracts remain controlling. This document records the Protocol §7.1 change before implementation.

## 1. Approved product facts and scope

The Shop offers all four durable inventory Items: Lucky costs **1** coin, Detection **2**, Revive **4**, and Airplane **8**. One purchase grants exactly one Item. The player may make further **intentional** purchases. Inventory has no product cap; existing safe-integer runtime limits still apply. An unaffordable offer is explained in presentation, and the production purchase rule independently rejects insufficient funds. There are no discounts, refunds, bundles, quantity selector, purchase history, or new economy rule in S5-03.

The Shop is accessible only with `currentAttempt === null`. An active, pending, failed, or won attempt cannot purchase and return to that attempt. S5-03 does not implement Settings/Tutorial persistence, later navigation, Stage 6 bilingual/skins/mobile adaptation, or a second Account or Save authority.

## 2. One legal catalog and purchase authority

- `config` owns the sole declarative four-offer price source. It contains no rule branches or mutable runtime state. `core` owns a pure exact-shape catalog validator, the detached readonly validated-catalog type/construction rule, and the pure purchase legality/candidate rule; **core never imports config**.
- The application composition root validates that one source once and owns the resulting value for its lifetime. It passes the **same validated catalog value** to the production purchase authority and presentation adapter. The adapter uses the core pure query and current Account to derive sanitized offer/affordability facts; `ui` only renders those facts. The two systems capabilities do not import each other. No second price table or Shop Manager is permitted. Invalid config leaves Shop unavailable with a diagnostic and no purchase mutation; it does not reset a save or disable unrelated gameplay. A defensive invocation while Shop is disabled may use existing technical `invalid-request` with zero writes, not a new Shop error taxonomy. `invalid-shop-configuration` is **not** a production-session mutation reason.
- Scene submits only semantic `purchase(item)`. The adapter captures current authoritative `expectedRevision` and `expectedRunId` in an immutable operation envelope. Neither Scene nor request supplies a trusted price. The production rule looks up the validated price, and display affordability is advisory only.
- In the existing Stage 4 composer, the purchase branch belongs **after `start` and before the generic `currentAttempt === null -> no-attempt` guard**. Valid purchase requires account-only state and `expectedRunId === null`. Existing revision/runId guards remain first: a forged/stale runId may reject as `run-id-conflict`; a correctly matched non-null attempt rejects as `shop-requires-account-only`. No phase can bypass the account-only gate.
- A valid candidate atomically subtracts the trusted price and increments exactly the selected inventory Item by one, then validates a complete replacement Account and GameState while preserving completed levels, one-time claims, Benben facts, all other Items, and every unrelated Account fact. Coins/inventory remain nonnegative safe integers; overflow rejects the whole operation, never clamps or partially debits/credits. The existing Save v3 mapper, lease/revision guard, A/B commit, and persist-before-publish path are the only persistence route. Presentation reprojects committed authority before displaying purchase success. No ShopState, purchase ledger, schema field, Save version change, or migration is introduced.

## 3. Reachable result and copy contract

The following are the **only new** production purchase rejection reasons. They extend, rather than rewrite, the S5-02 exact-string whitelist. Existing revision/runId/lease/storage/recovery results retain their S5-02 meanings.

| Exact reason | Category | Central semantic copy key | Commit/envelope policy |
|---|---|---|---|
| `shop-requires-account-only` | domain | `shop.account-only` | No commit; discard; a later purchase needs a new action after account-only authority is reached |
| `invalid-shop-item` | domain | `shop.invalid-item` | No commit; discard invalid choice |
| `insufficient-coins` | domain | `shop.insufficient-coins` | No commit; discard; explain specifically that the balance is insufficient |
| `inventory-overflow` | technical | `shop.inventory-unavailable` | No commit; discard and diagnose; no artificial product cap |

The centralized result/copy mapper selects these keys by **exact reason**, without Scene checks or prefix matching. A disabled-Shop diagnostic may use a Shop-unavailable view/copy key; any defensive production `invalid-request` retains its existing technical classification. Unknown/future reasons remain conservative discard/reload/diagnose. `commit-commit-outcome-uncertain` is never replayed. The existing conservative policy for `commit-persistence-commit-failure` is unchanged absent exhaustive pre-head proof.

## 4. Shop-only purchase-control lifecycle

A presentation-only, non-persisted control at application presentation lifetime has `ready -> submitting -> receipt-disarmed` states. It is **not** Account/Runtime/Save authority and survives Shop Scene reconstruction via that lifetime, not via a Scene-local reset.

- On a valid activation while `ready`, synchronously disarm the original purchase control **before** submitting one immutable envelope. While `submitting`, further purchase/re-arm activations do nothing. S5-02 separately prevents a second envelope while a submission is unresolved; it does not solve a second click arriving after a synchronous commit.
- On committed success, show the receipt from reprojected committed Account and remain `receipt-disarmed`. A distinct, deliberately activated **buy-again** control is required to re-arm. That control must not overlap the former purchase target or inherit its focus/activation. Keyboard auto-repeat cannot trigger re-arm. Re-arm rereads current authority and a subsequent purchase creates a new envelope; it never reuses an old one.
- A terminal rejection may show its reason and require a distinct fresh action before re-arming. A retained proven-precommit operation stays under S5-02 exact-envelope retry/reload policy, not a new Shop submission. Stale authority, lease loss, corrupt/unavailable state, or uncertain outcome blocks re-arm until the required reload/recovery and a new user action; uncertain never replays. Route/Scene reconstruction does not implicitly re-arm. Full page reload starts from persisted authority, not from an intent replay.
- No timing debounce, animation lock, persisted control flag, or purchase history. S5-06 continues to own general board/browser gesture and double-click interpretation; this Shop-specific one-purchase authorization boundary does not redefine that contract.

## 5. Protocol §7.1 frozen-boundary change record

| Required record | Approved S5-03 interpretation |
|---|---|
| Reason | Required MVP functional Shop is absent from the otherwise frozen Stage 4 production mutation surface. |
| Affected contracts | Add one account-only purchase intent/candidate to Stage 4 production mutation/session authority; extend S5-02 semantic intent, exact result/copy mapping, and sanitized Shop projection. Keep Stage 4 full Account, one Runtime, one Save v3 writer, Stage 2 guarded persistence, and S0-06 dependency rules. Historical Stage 4/S5-02 completion evidence remains historical; purchase was not previously implemented. |
| Compatibility | Additive command and four exact reasons only. Existing commands, runId/revision guards, account-only Runtime, prior Save interpretation, and old committed data continue to work. Old tabs/new deployments have no shared quote/version consensus; the production authority always uses its own current validated catalog. Do not claim an in-memory quote solves cross-deployment pricing. |
| Schema/version/migration | **No Save v3 field or version change and no migration.** Existing coins/inventory encode the result. Migrated v1/v2 and native v3 Accounts use the same guarded purchase/reopen path; existing v1/v2 migration defaults remain unchanged. |
| Rollback | Revert the scoped Shop implementation through reviewed Git history if needed; do not reset or delete saves. Existing Save v3 Account values remain readable, and completed purchases are not automatically refunded or repriced. Revert this docs closeout separately if the design is withdrawn before implementation. |
| Regression | Preserve Stage 1–4 and S5-02 quality gates, full Account/Save v3 round-trip, v1/v2 migration, lease/revision/uncertain behavior, and architecture imports. |

## 6. Implementation acceptance and recovery

Future S5-03 tests must prove exact catalog shape/four prices, invalid catalog disabling Shop without affecting saved authority, single validated source supplied to both paths, one-unit and repeated intentional purchases, insufficient balance, invalid Item, all non-null attempt phases, forged/null/stale runId, safe-integer overflow, complete unrelated Account preservation, and zero-write failure atomicity. Integrate real production session/Save v3/reopen for native v3 and migrated v1/v2 Account. Test advisory-only affordability, exact reason-to-copy keys, unknown conservative fallback, duplicate pointer/keyboard activation, Scene reconstruction, explicit buy-again re-arm, storage failure, stale revision, lease loss, and uncertain never-replay.

Mutation sanity must detect Scene-supplied price authority, bypassed account-only gate, non-atomic debit/credit, publish-before-commit, bypassed duplicate disarm, and generic insufficient-funds copy. Claim only mutations actually injected and observed failing. Full `npm run quality`, independent read-only Reviewer, branch/PR/main Linux Quality, and Recovery Test remain required. A new AI must recover this approved design, unchanged production behavior before Implementation, and the unique Next Action from this document plus `PROJECT_STATUS` without chat history.
