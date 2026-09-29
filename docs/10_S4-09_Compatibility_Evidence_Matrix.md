# S4-09 Compatibility Evidence Matrix

This file records implementation evidence for the frozen C1-C14 contract in
`docs/09_Stage_4_Product_Contract_Addendum_v1.0.md`. It does not add product
rules or replace the authoritative contract.

| ID | Evidence classification | Repository evidence |
|---|---|---|
| C1 | Existing evidence referenced | `stage4-production-activation.test.ts`: production session fresh boot, zero-write read, first v3 revision 0, reopen. |
| C2 | New integration evidence added; behavior-only | `stage4-production-activation.test.ts` rich-v1 production session proves read-only migration, gameplay continuity, and first v3 N+1 mutation. Existing strict migration tests remain referenced. |
| C3 | New integration evidence added; behavior-only | `stage4-production-activation.test.ts` rich-v2 production session proves Board/position/phase/inventory/RunItems/provenance continuity through mutation and v3 reopen. |
| C4 | Existing evidence referenced | Dormant trusted-legacy terminal tests prove forbidden writes and legal clearing paths. |
| C5 | New integration evidence added; behavior-only | Production session direct-v3 one-time Reward mutation/reopen proves Reward/Account claim synchronization and no duplicate ID. |
| C6 | Existing evidence referenced; behavior-only | Dormant repeated settled Failure, eligibility, reopen, and Claim chain. |
| C7 | Existing evidence referenced; mutation actually injected | Dormant temporary-card Item/terminal chain and temporary-priority/card-expiry mutation evidence. |
| C8 | Existing evidence referenced; mutation actually injected | Production Reward-before-terminal/Replay plus dormant reward ordering and regeneration mutation evidence. |
| C9 | New integration evidence added; behavior-only | Two real production sessions prove expired-lease takeover, stale-session rejection, and explicit reload. |
| C10 | Existing evidence referenced; mutation actually injected | Production storage, ownership, revision, and run-ID rejection plus dormant all-command commit-failure matrix. |
| C11 | New integration evidence added; mutation actually injected | Lost head-write acknowledgement proves cached session authority remains unchanged until explicit reload. |
| C12 | Existing evidence referenced; mutation actually injected | Frozen strict loader/storage corruption suites distinguish malformed/invalid/future/revision/unprovable states from no-save and kill corrupt-as-no-save. |
| C13 | Existing evidence referenced; mutation actually injected | Production corrupt-head/provable-v2-backup recovery proves retained source/revision, N+1 v3 write, and no bare-slot promotion. |
| C14 | New architecture evidence added; behavior-only | Production-root relative-import closure permits shared Stage 2 read/lease/A-B infrastructure while rejecting imports of obsolete v2 write symbols/wrappers. |

Mandatory compatibility supplements:

- New production-session evidence restores an Attempt whose `levelId` is absent
  from the production catalog, rejects catalog-dependent replacement without
  changing authority, and permits legal terminal dismissal into v3.
- New production-session evidence preserves one-time Reward and Account claim
  synchronization across mutation and reopen without duplicating the claim ID.
- Successful multi-level Next remains covered only by the existing injected-
  catalog dormant evidence. Production retains the frozen `next-unavailable`
  behavior and no Level is added for this gate.

Mutation classification is literal: only tests that alter or fault an expected
implementation/storage behavior are called mutation evidence. Positive-path
assertions are recorded as behavior-only coverage.
