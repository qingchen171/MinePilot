# S5-09 Product Acceptance Remediation — Desktop Presentation Redesign Design Contract

**Status: accepted Design Freeze candidate until the independent documentation Reviewer, protected PR, branch/PR/main Linux Quality and final Recovery gates succeed.** This is a docs-only extension to the existing S5-09 integration contract, not a new product Task, implementation, asset purchase, Elio hands-on PASS or Stage 5 frozen tag. Specification and Protocol retain precedence; `PROJECT_STATUS` determines the effective single Next Action. Elio's approval of this corrected product direction does not substitute for Gate A, Gate B or final product acceptance. The prior PR #90 and G1–G9 technical evidence remain valid; Stage 5 product acceptance remains **FAILED**.

## 1. Scope and authority

Reason for remediation: Elio rejected the existing visual/audio experience despite accepting its technical evidence. Only desktop presentation, centralized working-language copy, licensed asset content and the narrow presentation-only interface clarifications below are in scope. The single production session/Runtime, guarded Save v4 writer, Stage 1–4 gameplay/RNG/Item/Reward/Benben contracts, and production `level-001` 9×9/10-Mine/zero-obstacle facts are unchanged. No hidden Board/Reward data reaches Scene or UI. Only production L1 is shipped; controlled catalogs and strictly validated preloaded-v4 fixtures remain test provenance, not released content.

This contract resolves five Attack findings: (1) no executable desktop spatial layout, (2) no measured character/head-number fit, (3) possible conflation of requested target with committed position, (4) no traceable layered asset/budget plan, and (5) incomplete Chinese/audio product-quality criteria. No source, test, asset or audio change is made by this Design Freeze.

## 2. Four-viewport spatial contract

Measurements are CSS pixels at 100% browser zoom. The page header includes navigation; the HUD contains concise public status without a second visible current-cell number. The Game Board outer container is square, with the existing 8px inset per side; shared DOM and Phaser layout uses `(side - 16) / 9` for production L1 cells. Decorative full-viewport backgrounds are separate from this logical rectangle, contain no hit targets and cannot reduce Board allocation.

| Viewport | Header / HUD | Square Board: left, top, side | L1 cell | Right rail: left, width, height | Bottom free space |
|---|---:|---|---:|---|---:|
| 1366×768 primary | 64 / 48 | 211, 112, 600 | 64.9 | 835, 320, 600 | 56 |
| 1280×720 safety | 56 / 48 | 200, 104, 560 | 60.4 | 780, 300, 560 | 56 |
| 1024×768 constrained | 56 / 48 | 100, 104, 528 | 56.9 | 644, 280, 528 | 136 |
| 1920×1080 large | 80 / 56 | 364, 136, 800 | 87.1 | 1196, 360, 800 | 144 |

These are target allocations, **not fixed clipping**. Responsive CSS computes the square Board from the actual available width/height; DOM hit grid and Phaser artwork consume one measured `BoardLayout`. At effective desktop widths too narrow for Board+rail, put the rail beneath the Board with ordinary vertical scrolling, keep cell size at least 48px while practical, and never claim this fallback as Stage 6 mobile certification. The four named viewports must meet or exceed their tabled cell size. Header/HUD and page content may scroll vertically; no horizontal document overflow is permitted. The Board must remain the primary visual focus rather than a small 16:9 stage inside a text page.

Rail order: the top approximately 160px reserves immediately required pending/Revive/failed/won decisions or active target/Flag and legal actions. Item controls follow. Tutorial/Help and claimed-Reward history are collapsed/on-demand drawers below; expansion scrolls within the rail, not over the Board or decision controls. Focused controls scroll into unobscured view; the decision area's sticky/fixed treatment, if used, must leave focus visible. Restart/leave/replacement confirmation has explicit confirm/cancel and never triggers on navigation. Production L1's complete 9×9 Board, character, HUD and current decision must fit without clipping at all four viewports. Home/Levels use the same page language but list only actual production content as playable; Shop/Settings receive coherent initial styling without discharging FR-021's later equal-quality refinement.

Browser failure conditions: any horizontal overflow; actionable control clipped, overlapped or unreachable; invisible keyboard focus; non-square Board; DOM hit versus Phaser art mismatch over 1 CSS px at four corners, edges and center after resize/zoom/DPR/scroll; Board diminished below the tabled size by decorative art; or public L1 shown as unavailable while test-only Levels appear playable. Normal vertical scrolling is allowed.

## 3. In-cell explorer and current-number composition

For the smallest named cell (56.9×56.9px): tile border approximately 1.5px; inset focus ring 2px; safe content bounds `x/y = 4…52.9`. The sole visible positive count badge is 24×17px at `x = 16.45…40.45, y = 4…21`, with 14px type, 16px line-height and measured text/background contrast at least 4.5:1. The animal sprite's occupied visible box is 32×30px at `x = 12.45…44.45, y = 22…52`; head above body, feet at the bottom, 1px minimum gap below the badge. Direction/pose frames retain these bounds. Badge, animal and focus never bleed outside top/side/corner tiles; two-DPR rendering uses an appropriate 2× source, not scaled logical hit geometry.

Current safe positive number is shown only in this badge **above the animal's head within its actual committed cell**. There is no second persistent visible number beneath the Board or in a HUD panel. The count comes solely from the trusted existing current-cell query in the sanitized projection, never UI recounting. On departure the old badge disappears; zero produces a gentle safety cue without printing `0`; waiting and revealed-Mine occupancy show no number. The latter keeps already-public danger visible behind/around the animal but reveals nothing hidden. A selected/focused cell uses a behind-content ring; a flag cannot coexist on the occupied safe cell. A claimed public Reward marker may occupy a non-overlapping tile corner; an unclaimed Reward has no visible or ARIA marker. Unknown Safe and hidden Mine remain identical in art, labels, hover, disabled state and pre-commit response.

One centralized screen-reader sentence conveys the current cell and count/zero when committed facts change; repeated redraw does not reannounce it. The occupied cell may reference that sentence rather than duplicating it. Test normal/high DPI, contrasting public tile backgrounds, four corners, all top/side edges, center, selection/focus, flag and claimed-Reward cases. A static illustration alone cannot pass the later playable Gate B.

## 4. Committed-result movement, encounter and effect contract

The existing one-shot sanitized handoff retains its original immutable operation ID across an exact retained Retry. A pure presentation cue must distinguish `requestedTarget`, `committedDestination` derived only from that operation's detached `after.position`, and `effectAnchor`; any narrow cue/output type change stays in the existing UI/Scene handoff. None becomes a gameplay, Board or Save fact. The base animal, Board and stable accessible status synchronously reproject committed authority **before** optional effect dispatch. A generic saved message is sufficient when a specialized proof is absent.

| Situation | Authoritative character / target | Permitted effect and stable feedback | Prohibited inference |
|---|---|---|---|
| Initial waiting | Character off-board; selected target is only a choice | Brief start guidance; no count | Premature board occupancy |
| Committed adjacent or non-adjacent Safe | Immediately show `after.position`; target indicator is ephemeral | In-cell landing/turn/observe and short non-authoritative directional decoration; current count from query | Intermediate cell exploration, Mine encounter or saved position |
| Committed winning move | Actual destination and won controls immediately | One victory celebration after stable win status | Delaying Victory until animation completes |
| Committed pending Mine | Position remains old/waiting; operation target may have a brief danger cue | Pending/Revive decision and stable warning; target is not shown as an arrived position or revealed Mine absent public truth | Fictional Mine occupancy or automatic failure |
| Automatic Lucky | Use committed revealed-Mine occupancy/Board; no count | Proven one-shot protection cue | Revive consumption, repeat Lucky or false count |
| Committed Revive | Use committed revealed-Mine occupancy; no count | One-shot revive cue and readable status | Ordinary Safe occupancy or return to revealed Mine |
| Committed Failure | Use exact published position/Board/phase | Failure decision and calm, short cue | Inferred resource, position or settlement |
| Rejected/proven pre-commit failure | Existing verified authority only | Exact error/Retry policy | Success cue, asset or movement |
| Uncertain outcome | Mark view unverified; require explicit safe reload | Non-destructive warning; no success effect | Auto-replay or old view asserted as final truth |
| New commit interrupts earlier cue | Immediately show newest committed position | Cancel prior effect epoch; optional new cue | Queued old motion obscuring new state |
| F5, route, resize, Recovery, reduced motion | Reconstruct from current committed projection, or Recovery shell | Cancel/discard cues; preserve stable text; reduced motion omits spatial animation | Reissue Reward/command/sound or animate stale state |

Pending Mine retains the old/waiting character position in the current core. Decorative path coordinates never trigger gameplay, reveal hidden data, or take pointer input. To keep the playable animal visibly in the actual current cell, explorer movement uses direction/landing/observation poses and cancelable non-character accents; it does not make a second authoritative sprite stand on intermediate cells. Each new commit, authority-dirty signal, route/Scene disposal, layout change, reload and Recovery invalidates older visual and one-shot sound epochs. The existing exact retained-envelope/reload/uncertain policy is unchanged; presentation cleanup never silently cancels an unrelated Game, Shop or replacement Retry.

## 5. Layered asset plan, provenance and cost

Every asset family has its own replaceable layer/manifest entry, not one flattened AI image. Each entry must record creator/provider and, for AI, model/prompt/version; source URL/date or local source; source/output SHA-256; license text, commercial redistribution/derivative/attribution rights; human edits; actual cost; and in-game use. Unproved license means no inclusion. Proposed dimensions below are art planning targets, not files already produced or quotes.

| Family / separate purpose | Source and 2× export; alpha / states | Planning effort and performance / safe missing fallback |
|---|---|---|
| Home background and foreground | Editable 1920×1080 composition; 3840×2160 if measured necessary; opaque backdrop plus alpha ornaments | 2–3 review rounds; one 2× full image decodes near 32MiB, load only relevant route; warm CSS fallback |
| Level route/map and actual nodes | Same composition; 48/96px alpha nodes from trusted level list | 2–3 rounds; lazy load; semantic L1 card fallback, no fictitious playable nodes |
| Game backdrop | Independent desktop backdrop/foreground, same source/2× strategy; never bakes hit coordinates | 2–3 rounds; unload hidden backgrounds; clean Board fallback |
| Board tile/markers | 96/192px tile atlas; alpha overlays for public unknown, flagged, explored, obstacle, revealed Mine | 2–4 rounds; unknown Safe/Mine identical; existing geometry fallback |
| Current explorer | 48/96px transparent frame; Gate B minimum four directions × idle/2-step/observe = 16 registered frames, same feet/bounds | 3–5 rounds; about 0.6MiB decoded for 16 96px RGBA frames; safe placeholder if unavailable, but Gate B quality not passed |
| Four approved Item icons | Each 48/96px alpha; available/unavailable/temporary/consumed treatment from public facts | 2–3 rounds; atlas preferred; textual name/count/command fallback |
| HUD, navigation and buttons | Scalable vector/9-slice; 2× raster fallback; transparent edges | 2–3 rounds; retain focusable semantic controls if art missing |
| Dialog, Help and tutorial drawers | Scalable panels and alpha ornaments with 2× export | 2–3 rounds; plain accessible confirm/cancel/help fallback |
| Reward, Benben, pending and terminal effects | 64/128px transparent symbols/short frames; only publicly proven/committed variants | 2–4 rounds; stable status/actions fallback, no unclaimed Reward disclosure |
| Music and SFX | Licensed audio master plus measured browser encodes; 2×/alpha not applicable; one loopable BGM and coherent event sounds | 2–4 listening/edit rounds; measure transfer, loop click and playback load; silence when missing/unlicensed |

Sequence: **A** zero-purchase static visual prototype after separate future authorization; **B** Elio-approved smallest playable production-L1 slice; **C** later expanded art/audio. No bulk art before Gate A, no broad rollout before Gate B. The earlier `$0–$80` is a non-binding, unverified scenario, not a quote. Before *every* paid tool, artist, sound or asset purchase, obtain actual price, license, attribution, expected download/decoded-memory cost, revision allowance and cumulative spend, then Elio's prior approval. Specification target total is ≤$100 and absolute ceiling $200; neither limit itself authorizes spending. Missing licensed audio remains silence, not oscillator beeps presented as finished music.

## 6. Chinese-first copy, honest language entry, audio and information hierarchy

One existing semantic key/template resource owns complete visible and accessible sentences. Stage 5 active copy is Chinese; `index.html` language/metadata must match `zh-CN` when delivered. Home corner has an honest informational entry: Chinese available, English forthcoming. It performs no fake switch and persists no locale. Stage 6 remains responsible for full English, real switching/saved choice and bilingual layout.

| Reachable surface | Required central-key coverage |
|---|---|
| Home / Levels / navigation | Continue, start, actual level availability/current Attempt, replacement and partial-success confirmations, truthful language information |
| Game / Board / HUD | Selected row/column, five public appearances, character position, current number/zero, Flag/mode, Item inventory and use limits |
| Shop / Settings / Feedback | Four offers/prices/owned/balance/insufficient/buy-again, two committed settings, user-initiated mailto and privacy notice |
| Recovery / errors | Corrupt/unavailable/historical read-only, domain/stale/retainable Retry/unknown/uncertain, Reload and no-reset explanation |
| Items / Reward / Benben / terminal | Lucky, temporary resource, claimed/one-time Reward, pending, Revive, Failure, Retry, Replay, Next, won and legal return |
| Tutorial | All nine exact S5-04 milestone IDs, contextual prompt and explicit acknowledgment; no inferred completion |

Dynamic coordinates, quantities, resource names, Reward summaries, confirmation sentences, ARIA labels and live status remain typed full-sentence templates. Long Chinese text wraps in drawers and at 1024px/200% zoom without clipping. Normal play always shows immediate choices, count badge, usable resource and required status; current committed event feedback is contextual and short; extended help and claimed history are expandable; screen-reader-only count/status remains complete. Removing persistent paragraphs never removes a legal button, explicit leave confirmation, nine tutorial acknowledgments, exact Retry ownership, account-only Shop restriction or non-destructive Recovery.

Product audio acceptance requires a truly licensed, listenable, smoothly loopable BGM track and a coherent cartoon SFX set. At minimum the first-pass **Airplane bombardment, Lucky protection, Revive, Mine step/pending danger and Victory** each have cute visual **and audio** feedback tied only to the proven committed operation; stable authoritative text/status persists when effects are disabled, missing or interrupted. Existing independent persisted music/SFX booleans remain the only settings. The page-lifetime audio adapter handles user gesture/autoplay denial, hidden page, route changes, cross-tab authority invalidation, Recovery, async `play()` cancellation, bounded voices and disposal. BGM may span normal routes while enabled; one-shot SFX never replays after F5/reload. Missing or unlicensed audio is safe silence, not false finished quality. Elio must actually listen and approve comfort, level and loop quality; automated playback success alone cannot pass product acceptance.

## 7. Protocol §7.1 narrow change-control record

| Reason / exact frozen boundary | Compatibility and version/migration impact | Required regression and rollback |
|---|---|---|
| Rejected presentation: Specification §1, §3.2 and Appendix A item 14 reconcile “脚下” with one current-safe-cell number visually inside the cell above the animal's head. | Ownership/count/zero/occupancy and eight-neighbor gameplay unchanged; no Save/schema/migration impact. | Trusted query, one badge, old-number hiding, zero, waiting/occupancy and hidden-information tests; reviewed visual-only revert if needed, never alter committed Board. |
| First-redesign Home language entry: Stage 5 contract §5 and S5-05 §1; Chinese-first informational control precedes Stage 6 functional bilingual work. | Existing routes, Account/Attempt and Save v4 unchanged; no locale field or migration. | Home visibility, accessible honest unavailable-English message, no mutation/fake switch, navigation/Recovery/Shop regressions; revert presentation entry without erasing Stage 6 obligation. |
| S5-08 §2 one-shot cue output: separate requested target, committed destination and decorative anchor using existing sanitized before/after proof. | Additive presentation-only type/call change; unchanged operation envelope, raw-authority/secret boundary, session/Save and migration. | Pending old position, Lucky/Revive occupancy, non-adjacent move, interruption, F5/reload, no hidden leak or false effect; revert cue art/type together while retaining old committed base rendering. |
| S5-09 G7–G9: add Chinese, real audio, four-view desktop, measured in-cell explorer, Gate A/B and later final acceptance. | Adds criteria without invalidating prior G1–G9 technical evidence or reducing 1280/1024/engineering/Recovery gates; no Save/version/migration. | Updated browser/layout/accessibility, licensed asset/audio provenance, real production L1, Elio two early approvals and final hands-on approval; reviewed presentation rollback preserves product FAILED until new acceptance. |

No Stage 0–4 authority, RNG, Item/Reward/Benben, production L1 configuration, Save v4 writer or schema is amended. Any implementation requiring raw Runtime in UI, new result reasons, another persistence path, altered gameplay or broader frozen interface must STOP for a separate approved §7.1 assessment.

## 8. Two rejectable Elio gates and implementation evidence order

1. **This docs-only Freeze** requires independent Reviewer, protected PR, applicable branch/PR/main Linux Quality and Recovery. It authorizes only a later separately executed remediation Implementation, not an asset or product PASS.
2. **Gate A — visual compositions:** in a future separately authorized internal implementation slice, create actual 1366×768 Home/Levels/Game screens plus normal/edge/corner measured explorer-and-badge cases using real production content and realistic controls. Elio explicitly accepts or rejects the visual direction. Rejection stops bulk asset creation. These are not a playable claim.
3. **Gate B — small playable production-L1 slice:** only after A, implement a real interactive 9×9 L1 with Board, explorer, head badge and minimum HUD; test 1366×768, 1280×720 and 1024×768, including movement, number, focus, hit alignment and interruption. Elio independently accepts or rejects readability, movement and visual quality. Rejection stops broad rollout. This is not final Stage 5 acceptance.
4. After B, integrate remaining Home/Levels, contextual Item/Reward/Benben/terminal/tutorial feedback, coherent first-pass Shop/Settings/Feedback styling, complete Chinese copy and licensed audio. FR-021's later **equal-quality** refinement of secondary pages/modals remains separately required; coherent first pass does not close it. Stage 6 bilingual/mobile/skins and Stage 7 production content/deployment remain locked.
5. Re-run applicable existing S5-02–S5-09/Stage 1–4 regressions plus genuinely new geometry, badge, proof, audio and browser cases. Use production L1 for shipped claims; label controlled-catalog and strict-v4 compatibility fixtures separately. Require targeted/full quality, independent full-diff Reviewer, protected branch/PR/main Linux Quality, Recovery, no unresolved P0/P1 and P2 dispositions. Then Elio must perform **final** hands-on Stage 5 product acceptance. Only a later separately authorized Formal Closeout may consider S5-09 PASS/CLOSED, Stage 5 FROZEN and an annotated frozen tag.

Rollback point before implementation is the verified pre-remediation main recorded in Git history; docs amendments can be reviewed/reverted without touching saved games. After implementation, rollback must preserve readable Save v4 and committed assets, never reset/downgrade saves or pretend the prior rejected experience was accepted. A new AI must recover the product FAILED hold, this contract and amendments, A/B/final gates, single production authority, FR-021 and the unique Next Action from `PROJECT_STATUS` without chat history.
