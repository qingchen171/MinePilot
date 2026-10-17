# S5-09 Product Acceptance Rejection — Controlled Roadmap and Change Intake

**Decision date: 2026-10-18. Scope: documentation and governance only.** Elio explicitly accepts the previous technical implementation evidence but rejects the current Stage 5 presentation experience. This record does not amend frozen gameplay/presentation contracts or authorize implementation. Specification > Development Protocol > Product Manager Operation Manual > PROJECT_STATUS > Future Requirements Registry remains the controlling hierarchy; task contracts apply within it.

## 1. Approved source and present product hold

The approved product-direction source is preserved verbatim in [MinePilot Master Roadmap v1.0](MinePilot_Master_Roadmap_v1.0_Confirmed.md). Original attachment: `MinePilot_Master_Roadmap_v1.0_Confirmed.md`, supplied by Elio from the Desktop `扫雷辅助文档` folder. Source and imported file SHA-256 are both `bd4613f2689d36fa51bac3c21860b01826b3a95fb03f7095e8ffea286ea7b4a8`; no decision, paragraph or source caveat was removed or rewritten.

The roadmap is a versioned, product-approved **navigation document**, not Specification, a frozen design, implementation permission or a new authority tier. Its statements “待受控入库”, “尚未写回 GitHub” and R0 “尚未获仓库批准” describe the source snapshot before this intake. They are intentionally preserved, not current status assertions after this intake merges. PROJECT_STATUS and this intake record govern current phase; later revisions must be separately versioned/reviewed and retain the v1.0 source in Git history. The source's historical Stage summaries do not relocate Shop/Settings implementation from their actual S5-03/S5-04 history.

Elio's explicit decision, recorded without substituting automated tests for taste:

- **Stage 5 hands-on product acceptance: FAILED.** Current visual and audio quality is unacceptable; this is a product-acceptance blocker, not a newly proven production-code defect.
- S5-09 implementation technical evidence remains valid at its accepted revision. PR #90, the G1–G9 technical evidence, Save v4 and all frozen gameplay contracts are preserved.
- **S5-09 Formal Closeout cannot proceed.** S5-09 is not PASS/CLOSED; Stage 5 remains **IN PROGRESS** and is not FROZEN/PASS. S5-01–S5-08 historical engineering closeouts are not erased or reinterpreted as acceptance of the revised visual direction.
- Stage 6 and Stage 7 remain **LOCKED**. No Stage 5 frozen tag is created or moved. Elio's approval of the roadmap is not approval of an unbuilt redesign or a later product-acceptance PASS.

## 2. Preserved technical baseline and evidence provenance

Reality Sync found clean `D:\eliogames` detached at `04baf1ce2a2938d0d38ced418f63d9dfba5d6bcd`, equal to local main, origin/main and remote main. The detached checkout was not a lost implementation; a scoped documentation branch starts from that verified commit.

| Evidence | Verified scope / limitation |
|---|---|
| [PR #90](https://github.com/qingchen171/MinePilot/pull/90) | Merged main `04baf1ce2a2938d0d38ced418f63d9dfba5d6bcd`; implementation head `445c045dc38112c9cb71d7739b842aa226a38780`, base `c2c2c76a798f699cf710beb57911a270ef7863da`. Eight-file diff: tests and `20_S5-09_Presentation_Integration_Evidence_Ledger.md` only; no production/config/schema change. |
| Linux Quality | GitHub records Success for [branch 38983955824](https://github.com/qingchen171/MinePilot/actions/runs/38983955824) and [PR 38984602019](https://github.com/qingchen171/MinePilot/actions/runs/38984602019) at head `445c045…`; [main 38985418497](https://github.com/qingchen171/MinePilot/actions/runs/38985418497) at `04baf1c…`. These are implementation evidence, not the future intake branch/PR/main gates. |
| G1–G9 | Frozen contract `19_S5-09_Presentation_Integration_Freeze_Gate_Design_Contract.md` and evidence ledger `20_S5-09_Presentation_Integration_Evidence_Ledger.md` remain unchanged. Production L1, controlled catalogs and strict preloaded-v4 compatibility evidence remain distinct. G7 subjective quality and G9 Elio acceptance are **not passed** by those automated results. |
| Implementation Reviewer | Prior independent full-diff PASS is accepted/reported by Elio's task authorization. Do not represent this as a GitHub approval or a new review executed by this intake. This documentation diff requires its own independent read-only Reviewer. |
| Current production boundary | Single Stage 4 Runtime/session; guarded Save v4; production `level-001` is 9×9, 10 Mines, no obstacles. Controlled L2–L5/one-time fixtures are not shipped content. |

No new P0/P1 code defect is asserted by this intake. The product rejection is an unresolved acceptance hold regardless of the technical defect count. Existing non-atomic localStorage lease, one-Level production catalog, one-shot feedback missed by immediate F5, browser audio-policy variability and Phaser bundle warning remain known limitations; they neither excuse rejected visual/audio quality nor authorize broader repairs.

## 3. Exact product decisions received

These are confirmed direction/acceptance requirements, **not implementation permission**:

1. Desktop landscape first, **1366×768 design baseline**. It is a layout baseline, not fixed clipping; preserve representative 1280×720 and 1024×768 safety and consider the roadmap's 1920×1080 desktop layout.
2. High-quality AI placeholder art is acceptable, with a **unified cute, warm, colorful cartoon adventure style**. Animal species is not fixed. A flat promotional image is not a usable layered interactive asset set.
3. Core gameplay rules are preserved. Do not change the frozen L1 Mine count or difficulty merely because only a few Mines are visible.
4. The playable animal occupies the **actual current cell**. The current adjacent-Mine number appears **above the animal's head**, not underneath it or in a text panel. Preserve the trusted current-cell query, old-number hiding, zero safety feedback and revealed-Mine occupancy exception. The animal must look and move like an explorer, not merely appear as promotional artwork.
5. The **Board is the primary visual focus**. Home, Level Selection and Game receive first priority; no invented playable Levels or new gameplay adornments masquerading as real mechanics.
6. Shop and Settings receive a coherent initial style, but **REQUIRE later full-quality visual refinement**. Roadmap §5 also retains equal-quality Feedback, modals and auxiliary-page refinement. Basic stylistic consistency does not discharge that obligation.
7. Excessive persistent help text is removed from the intended normal-game presentation design, using concise contextual/on-demand presentation without silently deleting required tutorial acknowledgment, recovery or accessible feedback.
8. Rewards, Items, victories and failures require clear visual feedback. Committed state precedes effects; interruption/F5 never grants assets or replays a claim.
9. **Genuine comfortable BGM and cartoon sound effects are required; synthesized beeps are not sufficient.** Preserve independent committed music/SFX preferences, autoplay handling, interruption and reduced-motion behavior. No asset generation, replacement or purchase occurs in this intake.
10. **Chinese-first user experience.** A visible language entry is required in the Home screen corner **from the first visual redesign**. Incomplete English support must not be disguised as a functioning language switch; indicate actual availability and English not yet available.
11. Full bilingual delivery and dedicated mobile portrait layout remain explicit later deliverables. No Stage 6 implementation or certification is authorized. Future saved language choice requires the existing versioned persistence/change-control process, not a convenience storage key.

## 4. Protocol §7.1 impact intake — not a frozen-contract amendment

**Reason:** Elio's subjective product acceptance failed although engineering evidence passed. The direction must be assessed before changing frozen presentation interfaces or Stage boundaries. This intake changes only navigation/status documentation. The following is the required impact register for the next Design Review; it does not grant blanket change-control approval.

| Requirement / exact boundary | Within existing presentation authority | Approval still required before a conflicting implementation |
|---|---|---|
| Art, explorer identity, Board prominence; Home/Levels/Game first | Replace visual resources/layout while consuming existing sanitized facts, one root and semantic commands (S0-06; S5-02/05/06). No new gameplay/Save meaning is needed. | Any altered projection/handoff, geometry/input semantics, route lifetime or retained-owner interface must identify the exact clauses in docs/08, /12, /15, /16 and receive scoped §7.1 approval. Presentation styling alone does not reopen gameplay. |
| Above-head current number | Existing trusted current-cell query is preserved; positive number/zero/unavailable semantics do not change. S5-06 §2 does not require a particular pixel offset. | Specification §1/§3 “脚下” wording and appendix current-cell rule must not be silently rewritten or used to justify stale/multiple numbers. The next review must explicitly reconcile spatial wording with above-head placement; if literal display-location clarification is required, propose the exact Specification clarification for Elio approval before amendment. No neighbor recount in UI. |
| 1366×768 desktop baseline | Add a design reference, not fixed cropping or new responsive authority. Existing S5-09 G8 1280×720/1024×768 safety remains mandatory; vertical scroll remains legal. | Any replacement/reduction of frozen desktop acceptance criteria requires docs/19 change control; none is approved here. Mobile portrait is deferred Stage 6, not certification by desktop scaling. |
| Less persistent help; clear Reward/Item/terminal feedback | Concise centralized text and contextual help can retain existing explicit nine milestone acknowledgments, committed public summaries and stable accessible status (S5-04/07/08). | Changes to context/acknowledgment semantics, proof/receipt lifetime, exact result policy or accessibility contract require specific docs/12, /14, /17, /18 approval. New persisted progress or settings would require separate schema/version/migration review; not requested or permitted here. |
| Comfortable real BGM/cartoon SFX | Replace sound content within S5-08 page-lifetime adapter, current two preferences and asynchronous invalidation rules. No new preference or writer is needed. | Any playback/ownership policy change requires docs/18 review. External/AI assets require source, author/provider, license/use/attribution/transform provenance; all spending requires prior Elio approval. Existing self-made beep provenance is not an endorsement of its product quality. |
| Chinese-first and first-redesign Home language entry | Chinese working copy fits centralized resources and the Specification's bilingual goal. An honest informational entry is not functioning bilingual delivery. | First-redesign entry is a new Stage 5 navigation requirement relative to docs/11 §5 and S5-05 scope; the next review must propose the narrow Stage 5/6 timing/interface clarification and obtain approval before amending frozen docs. Full translation, switching, bilingual overflow and saved language remain Stage 6; current Save v4 has no locale field. |
| Secondary-page full refinement | Preserve as a required later delivery, not an optional idea or “already done” by coherent initial colors. | The next approved design/decomposition must assign its acceptance checkpoint; this intake creates no additional product Task ID or code authorization. See FR-021. |

**Compatibility / version / migration:** this documentation intake has none. Save v4, Runtime, Account, Item/Reward/Benben, RNG, current catalog and persistence are untouched. The next review must enumerate any exact proposed interface amendment and its compatibility, version/migration consequences, regressions and rollback before approval; “visual redesign” is not a permission to weaken validators, add a second state authority or rewrite frozen contracts.

**Future regression obligations:** preserve S5-02 exact envelope/result/retry and hidden-info isolation; S5-03 account-only Shop/explicit Buy Again; S5-04 two settings/nine milestone persistence; S5-05 route/leave/reload/recovery; S5-06 DOM/Phaser geometry and native input; S5-07 exact committed receipts/Benben/terminal; S5-08 effect/audio invalidation; S5-09 G1–G9 provenance, desktop safety and Elio actual reacceptance. Updated visual assertions must be reviewed, not blindly rewritten to turn CI green.

**Rollback:** reviewed docs-only revert can withdraw this intake without changing code, saved assets or frozen tags. A rollback must not erase the fact of Elio's rejection or reinstate product PASS without a new explicit decision. Future presentation rollback must preserve compatible Save v4 reading/writing and committed assets; no downgrade/reset. Technical recovery point remains `04baf1ce2a2938d0d38ced418f63d9dfba5d6bcd`, not a product-accepted release.

## 5. Preserved future obligations and the single successor entry

Roadmap §5 is retained in full. FR-021 tracks required Shop/Settings/Feedback/modal/auxiliary-page refinement after the three core pages' direction is stable. Existing Stage 6 full Chinese/English, actual language switching/saved choice, bilingual layout, dedicated mobile portrait/tablet verification and Skin/test-theme obligations are cross-referenced, **not duplicated as optional Future Registry ideas**. Stage 7 content/RC/deployment and long-term Registry items remain gated. No production L2–L5/20-Level delivery is claimed.

The authorized successor, effective only after this docs-only intake's review, protected branch/PR/main Quality and final Recovery succeed, is:

**Stage 5 / S5-09 Product Acceptance Remediation — Desktop Presentation Redesign & Frozen-Boundary Change Design Review**

This is one design/change-intake continuation of the failed S5-09 product gate, not a newly invented S5-10 or Stage 6 Task. It must propose the smallest presentation design and exact §7.1 approvals; account for all §3 decisions, three key-page visual review before an interactive slice, real L1 feasibility, asset/license/cost gates, secondary-page obligation and regression/rollback. R0–R5 in the roadmap are proposed work packages, not independently authorized product milestones. The successor does not itself authorize asset generation, code, audio replacement, Design Freeze or implementation. Its subsequent phases require separate approval and the normal Design → Attack → Freeze → Implementation → Tests → Review → CI → Recovery → acceptance/Closeout gates.

Until the intake gates pass, the effective phase remains this documentation/governance intake. After they pass, this run stops; it does not execute the successor. S5-09 Formal Closeout remains blocked until a future actual Elio hands-on PASS and all applicable engineering/documentation gates; no tag or Stage 6 entry follows from the current roadmap approval.

## 6. Intake evidence and Recovery checklist

This record deliberately does not preclaim its own Reviewer, Quality, PR, merge or Recovery. Those results must be recorded against the exact reviewed commit in the protected PR and final handoff. The existing implementation CI in §2 cannot substitute for these documentation gates. PROJECT_STATUS records the actual product decision now and conditions the successor entry on completed intake gates; no separate S5-09 Formal Closeout is performed.

A read-only reviewer/new AI must recover from repository authority and Git/PR evidence alone:

- Source roadmap v1.0 is exact, subordinate navigation; its pre-intake caveats are historical, not an instruction to repeat intake.
- PR #90/G1–G9 technical evidence is preserved, but Elio Stage 5 acceptance is FAILED; S5-09 is open, Stage 5 IN PROGRESS, Stage 6/7 LOCKED and no Stage 5 frozen tag.
- All eleven grouped product-decision entries in §3, required later refinement and unchanged L1/Save v4/gameplay boundaries.
- §4 is an impact register, not approved frozen-interface changes. No code/assets/audio were changed by intake.
- Exactly one next design-only action in PROJECT_STATUS, with no implementation, formal closeout or Stage 6 permission.
- The actual reviewed revision, branch/PR/main CI and final clean synchronized baseline from this intake's PR/Git history; any missing gate keeps intake open.
