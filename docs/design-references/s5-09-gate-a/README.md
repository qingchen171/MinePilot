# S5-09 Gate A — accepted design references and controlled-overflow handoff

This is a **design-reference archive**, not a production asset pack. Elio explicitly accepted Home, Levels and the latest Game direction, including the approximately32% explorer and38% number increases. Approval is recorded from the direct2026-10-27 task statement; it is not an inference from image generation or automated tests. Gate B has not started. Final Stage5 acceptance remains ungranted.

## Exact accepted files

All three archived PNGs are1366×768. Full SHA256 identities and original draft paths are in [reference-manifest.json](reference-manifest.json).
- [Home](home-1366x768.png): CE5AC21729B557AE1961544EF31C310201C4155CE3B996ABA2ECD5B9C76707C0
- [Levels](levels-1366x768.png): CD132E91AFD4B8657A0162D697CC44A1EB0051BAD2813DCA4203C280CE7F1740
- [Final Game](game-1366x768.png): 393FD00202FA62871E2DEEBE882A8F3A081240AC59774939832BE2E9E4CECCD6

Final Game is the file originally at `design-drafts/s5-09-gate-a-game-presence-r1/game-1366x768.png`, **not** the older `game-1366x768-selected-v2.png`. Only these three approved outputs are archived; original drafts, rejected branches, working extracts and supplied reference images are preserved locally and not bulk-added.

## Provenance and permitted archive use

Creator/provider: OpenAI built-in imagegen, with static measured compositing/export. The tool did not disclose its model version; no version is invented. The exact selected generation prompts are below. Home/Levels reused the prior v3 floating-island composition and the single accepted8/10 nearshot as identity/material reference. Game reused a generated backplate and generated transparent extraction from that accepted image. Extraction is not a pixel-identical crop. Source hashes and original tool filenames are in the manifest; earlier supplied references were visual inputs, not shipped Level content.

Elio answered the public-archive rights question on2026-10-27:

> 拥有/已获授权，允许公开设计归档（不代表生产资产批准）

This confirms ownership/permission for the supplied reference materials and these three derived compositions' public design archiving. It is a direct rights-holder representation, not an independent third-party title audit. The checked provider [Terms of Use, Content section](https://openai.com/policies/terms-of-use/) (effective2026-01-01; consulted2026-10-27) assign output rights as between user and provider, subject to applicable law, and leave input-rights responsibility with the user. This archive transparently identifies AI generation; it does not assert uniqueness, independent non-infringement certification or a new license over third-party material.

No new asset purchase/service was used in this freeze; no claim of zero historical account-credit consumption. No project production-asset clearance, commercial-release permission or third-party attribution clearance is inferred. Before Gate B integrates any actual art/frame/audio file, doc22 §5's asset-specific license/attribution/performance manifest remains required. These flattened reference PNGs must not be imported as the playable Board.

## Static assembly and public facts

The accepted Game reuses the same extracted body/number. On its1672×941 source, body source rect(165,330,830,895) is uniformly drawn at height82, left `835-(630-165)*82/895`, top259. Number source rect(521,49,252,297) is uniformly drawn at height22, centered x835, top234. Export to1366×768 is uncropped. Compared with the preceding heights62/16, the factors are1.32258/1.375. This is the user-approved enlarged reference, not a new sprite design.

Recorded static alpha>8/255 lower-body/paws/shadow bounds map to source-canvas x805.86–861.48,y326.80–339.81, or final-image x658.38–703.82,y266.72–277.34. The observed current-tile top was approximately source x794–878,y278–346. This supports the central reference's grounding, not all frames/fringes or future browser behavior. The final image's other pixels were preserved by backplate reuse; previous static comparison recorded changes only in x645–709,y189–288. Original assembly-script SHA is in the manifest.

The image uses the previously recorded strict-v4 public compatibility sample, not a newly executed session here: full L1 remains9×9/10Mines/zero obstacles; explored R1C4,R3C3,R3C4,R3C5,R3C6,R4C3,R4C4; current R3C5/count2; flags R4C2/R7C8; coins0; revive1/detection2/airplane1/lucky1. Count2's historic query provenance is reused reported evidence, not a new gameplay test. Only L1 is playable on Levels; the continuing path is scenery. Home shows account-only entry. Game has no mid-Attempt Shop; Lucky is automatic and Revive is unavailable outside pending.

## Reproducible geometry and evidence boundaries

Run from repository root:

```text
node docs/design-references/s5-09-gate-a/geometry.mjs
```

The checker reads the archived files without writing, verifies all three SHA256/PNG dimensions, and evaluates doc22's normalized bounds at four exact named cell minima and four allocated viewport cell values, each at center/four edges/four corners:36+36 arithmetic cases. It verifies foot support containment, full envelope/viewport/header/rail fit, helmet gap and separation between the number box and adjacent critical-marker boxes. The extra allocated cases account for rounded published minima; they are not72 browser/gameplay tests.

Locally executed2026-10-27: reference hashes/dimensions PASS;36 exact-minimum+36 allocated cases PASS. Geometry table and formulas are specified in the candidate amendment in doc22 §2–3. No real browser, DPR, actual font contrast, frame mask, hit alignment, pointer/keyboard, animation, lifecycle, CI or Recovery result is claimed by this arithmetic. Those remain separately evidenced gates.

## Protocol §7.1 and recovery

Reason: accepted hero presence conflicts with prior entirely-in-cell render boxes. Affected boundaries: Specification §1/§3.2/A14, doc22 §2/§3/§7/§8, and doc19 G8 wording. Only visual drawing ownership/bounds, top/side safe allocation and public-marker/focus layering change. Logical square Board, minimum cells, shared DOM/Phaser geometry and hit targets are unchanged. Savev4, single Runtime/session/guarded writer, RNG, gameplay, Items/Rewards/Benben and production L1 remain untouched; no schema/version/migration.

Future Gate B regression must prove complete registered frames/feet/shadow, all positive query numbers/zero/waiting/occupancy, hidden equivalence, neighbor flags/Mines/claimed marks/focus, safe click-through/native deduplication, all four desktop sizes, DPR/zoom/scroll, route/F5/Recovery and stale/uncertain interruption. Existing S5-02–S5-09 regressions are reused where sufficient. Public marker placement uses public facts only, never hidden candidates.

Review/PR/main Quality and Recovery must actually succeed before declaring this amendment frozen. Final task/status evidence lives in its protected PR history and PROJECT_STATUS. Rollback is a reviewed docs/presentation revert; never overwrite drafts, move frozen tags, reset/downgrade Save or erase Elio's historical Gate A approval.

## Exact selected image-generation prompts

### Home

Original: exec-5b6ca46f-56b5-445f-a3cd-deabf2b14028.png
Workspace: home-source.png → home-1366x768.png

```text
Use case: ui-mockup / identity-preserve edit.
Deliver ONE finished desktop HOME screen visual composition, landscape16:9, intended display1366x768, no browser frame.
Input1: existing HOME screen is the composition/edit target. Preserve its strong joyful floating-island adventure layout, lush islands/waterfalls, bright airy sky, warm wood/gold logo, green primary button, coherent blue glass buttons, flowers as peripheral decoration.
Input2: ACCEPTED8/10 nearshot is the SOLE animal identity/material baseline. Refine the Home explorer to match that same substantial orange-and-cream animal with gold miner headlamp helmet, red scarf and leather backpack, warm fur volume, big friendly dark-brown eyes, complete body and grounded paws. Retain the Home hero's confident welcoming pose and large presence. Do not import the 3x3 board, numeral2 or any nearshot frame into Home; do not create a different animal.
Preserve the layout with large title upper-center, animal lower-left, path into floating islands on right, large green primary CTA near lower-center. First-time account-only Home, so CTA exact text "开始探险"; shop allowed. Render only these functional labels: top-left corner small honest language plaque "语言 · 中文" and second line "English 尚未开放"; left Shop building sign "商店"; top-right envelope button "反馈", gear button "设置". Existing title "萌宠扫雷队" is a visual wordmark candidate; spell exactly. Use comfortably legible, polished Chinese lettering, no extra paragraphs, no placeholder glyphs. Leave safe margins and make all controls accessible-looking, no overlap.
No LV/XP/avatar frame, fake coins, stars, daily gifts, world numbers, diamonds, payment plus, collection encyclopedia, additional product features or claim of playable content. Maintain refined warm cute commercial adventure style and restrained glow. Exactly ONE Home composition; not a contact sheet, not a full set.
```

### Levels

Original: exec-010164cb-d355-42b4-abc4-748618aeff16.png
Workspace: levels-source.png → levels-1366x768.png

```text
Use case: ui-mockup / identity-preserve edit.
Deliver ONE refined desktop LEVEL SELECTION screen, landscape16:9 intended1366x768, no browser border.
Input1 existing Levels screen gives floating-island path arrangement and warm adventurous materials. Input2 is the sole accepted8/10 animal identity/material reference. Input3 is the newly selected Home screen for exact title, light, buttons and art-family continuity.
Recompose Levels for the ACTUAL one-level production catalog: ONE playable green/gold node "1" with small wooden "开始" below, plus an attractive winding stone trail across lush suspended islands continuing into mist. There are NO OTHER numbered nodes, stars or fake locked playable levels; do not duplicate or renumber the L1 node. Remove old nodes2 through10 entirely, not merely their text. Use scenic stepping stones/bridge along the empty future path, not button-like circles. The scene should feel like an inviting first adventure, not an empty list or a spreadsheet.
Place title "萌宠扫雷队" upper-center, slightly smaller than Home. Under title a compact wood heading "选择关卡" and small honest line "当前仅开放第1关". Put the single large level1 node on foreground island around lower-middle, hero standing naturally nearby on the same path, not covering the node. Hero same orange/cream explorer, gold miner headlamp helmet, red scarf, leather backpack, full thick body and paws, warm fur volume. Background castle/airship/waterfalls are decorative scenery only.
Functional buttons: blue house "首页" bottom-left, blue gear "设置" upper-right, small consistent Shop building "商店" left side. Account-only selection state. Keep all buttons within comfortable safe margins and ensure strong readable labels; no excessive help text. Warm golden sunlight, blue sky, lush green/white flower borders, warm wood, gold bevels, blue glass buttons, same coherent commercial-quality cute adventure world as input3.
No LV/XP/avatar/currency/gems/encyclopedia/chapters/reward chest buttons/World2/level14/star ratings. No grid/contact sheet, no additional screens. Exactly one finished Levels composition.
```

### Accepted-group extraction (working derivative, not new nearshot)

Original: exec-be6634a7-7a9e-4205-8be2-387ed7af03fa.png
Workspace: accepted-group-extraction-working.png

```text
Use case: background-extraction. This is a technical extraction of the ACCEPTED art, NOT a new character variant and NOT a new nearshot.
From the supplied accepted3x3 image, extract ONLY the existing single orange explorer AND the existing blue/gold numeral2 directly above it, as ONE transparent group. Preserve their precise identity, pose, expression, full-body proportions, thick fur, gold miner helmet/headlamp, red scarf, backpack, complete hands/paws/tail, existing numeral form and their relative alignment. No redesign or improvements, no new badge/plaque, no additional digits.
Remove all board tiles, floor, pawprint symbols, pickaxe tile markings and background. Genuine transparent alpha. Retain only a subtle neutral semitransparent contact shadow beneath the two feet; remove ivory/brown tile color from the background. Keep complete body/feet/numeral, no crop. Single full group centered with transparent padding. Exact same accepted pose, not waving, not sitting. Do not render any tile, grid or surrounding scenery.
```

### Game right-rail composition

Original: exec-aa0b857b-cc75-4ca7-88c1-96bf07c8c9b4.png
Workspace: game-rail-backplate-source.png → assemble-selected-game.ps1 → game-1366x768-selected-v2.png

```text
Use case: ui-mockup.
One final full desktop GAME composition, landscape16:9 at1366x768 design baseline. References:1 warm floating-island Game art family;2 sole accepted8/10 explorer/tile material;3 Home consistency.
This pass is the layered Game BACKPLATE with functional controls and exact public tile states; leave the current tile EMPTY of animal and number because the accepted original explorer/2 group will be precisely overlaid afterwards. Do NOT draw a new explorer or number anywhere.
Spatial layout on1366x768: square648x648 BOARD at x240,y80, ending x888,y728. The tile grid itself must be SQUARE, exact9ROWS and9COLUMNS, orthographic top/front view, no trapezoid or lost row. Make this large board the strongest focus. Equivalent on1672x941canvas: grid x294,y98,side793. Bevels are included INSIDE cells, never turn square grid into a wide rectangle. Outer frame narrow wood/grass with small white flowers outside hit cells.
Upper header: blue Home button top-left "首页", modest wood title "第一关" centered above Board, coin bar "0" upper-right, blue "设置" gear far upper-right. Right sidebar x930..1230 on1366baseline: two wood controls "插旗" and "帮助" near top, FOUR spacious Item controls on a compact wood rack beneath, preferably2x2 with labels and distinct icons: muted heart "复活 ×1", bright lantern "探测 ×2", bright plane "飞机 ×1", muted clover "幸运 ×1" plus small "自动". Leave rack readable and completely visible. Small separate "重开" left side. No bottom tray: board uses full height. No other fake menu or Shop while active. Keep labels crisp Chinese, safe margins, no tutorial paragraphs.
EXACT public tile matrix:9x9. Cream explored paw-trace tiles ONLY at one-based(1,4),(3,3),(3,4),(3,5),(3,6),(4,3),(4,4). Current tile row3column5 is cream with only subtle paw trace, NO animal/number this backplate pass. Red flags on BROWN tiles(4,2),(7,8). Every other cell BROWN UNKNOWN with small same pickaxe decoration. NO numbers anywhere in board, NO obstacles, revealed mines, gems, Reward icons or extra explored cells. The full L1 remains10mines, do not reveal them. Keep all81cell boundaries explicit and even.
Premium cute warm adventure aesthetic, thick sculpted terracotta/cream tiles matching accepted input2, natural sunlight, blue-sky/remote castles/waterfalls/airship, grass/flowers peripheral. Background quieter than board. No giant promotional animal. No World2/level14, LV/XP, stars, rewards/chapter buttons, fakecurrencies or plus.
Return one polished FULL GAME SCREEN, no nearshot, no alternative animal, no contact sheet.
```
