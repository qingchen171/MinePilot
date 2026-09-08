# PROJECT_STATUS

**项目：MinePilot / Minesweeper Product**  
**状态更新时间：2026-09-08**
**控制文档版本：v1.0 FROZEN**  
**正式游戏代码：Stage 1 core、Stage 2 persistence、Stage 3 Item foundation/Save v2/统一揭雷、Lucky/Detection/Revive/Airplane 及跨 Item 生命周期集成均已完成。Stage 3 FROZEN CANDIDATE；最终冻结状态按下方标签与门禁规则确认。**

## 当前事实

- 原始产品计划 v0.1：已读取并保留为愿景输入。
- 产品规则审查：完成。
- 61 项产品决策：冻结并编入 Specification 附录 A。
- A-S 技术/范围审查：完成并转化为规格与协议。
- MVP / Future Scope 切割：完成。
- 五份控制文档：完成。
- 交叉审计：PASS，见 `06_Cross_Document_Audit_v1.0.md`。
- Stage 0 / Task S0-01 环境基线审计：产品经理人工验收 PASS（2026-09-04）。
- 正式新项目根目录：`D:\eliogames`。
- `D:\MinePilot` 与 `D:\old_MinePilot`：只读历史参考；不得覆盖，不得直接作为新项目代码基础。
- `D:\saolei`：不存在。
- `D:\eliogames`、`D:\MinePilot`、`D:\old_MinePilot`：审计时均不是 Git 仓库，因此暂无稳定 commit/tag。
- Windows 工具链已核验：Git、Node.js、npm、pnpm、Corepack 与 Edge 可用；常用开发端口无占用。
- Stage 0 / Task S0-02 测试环境兼容性验证：产品经理人工验收 PASS（2026-09-04）。
- Windows 10 原生 Playwright 1.62.1 + Chromium 151 最小兼容性测试通过；单次 1/1 PASS，重复验证 3/3 PASS。
- 正式测试路线：Windows 10 原生 Playwright 用于本地快速测试；GitHub Actions Linux 作为权威 E2E 门禁。
- 当前不安装 WSL Linux 发行版；已启用的 WSL2 仅发现 `docker-desktop` 内部发行版，不作为项目测试环境。
- Stage 0 / Task S0-03 Git 仓库与恢复基线：产品经理人工验收 PASS（2026-09-04）。
- 本地 Git 仓库已建立于 `D:\eliogames`，默认分支为 `main`；提交身份仅配置于本仓库。
- 首个稳定恢复基线 commit：`2be7778eff5f4c2bbe1d9e4058c4d780a832a753`。
- 恢复验证：已从新仓库隔离克隆到临时目录；源与恢复副本 commit/tree 一致、必需文件完整、工作区干净。
- Stage 0 / Task S0-04 最小工程与版本锁定基线：产品经理人工验收 PASS（2026-09-04）。
- S0-04 稳定恢复点：commit `a2261ba9cd0f0773e9622aa75f50c8c4e0f3ba51`，tree `efd0f15b73cb22e71b8dbb1eeeaa5e868d95108d`。
- 工程基线：Node.js 24.16.0、npm 11.13.0、Phaser 3.90.0、Vite 8.2.2、TypeScript 7.0.2、Vitest 5.0.0、Playwright Test 1.62.1；直接依赖与锁文件已固定。
- S0-04 恢复验证：隔离克隆后 `npm ci`、类型检查、单元测试、production build 与 Playwright 浏览器测试全部通过。
- Stage 0 / Task S0-05 本地统一质量门禁与安全执行守卫：产品经理人工验收 PASS（2026-09-04）。
- S0-05 稳定恢复点：commit `1c2ec68f9981493b5d751c886587df23223a6428`，tree `eff799a0d4543ac123611e0385646fb6adeb3772`。
- 后续所有开发 Task 的统一本地质量门禁：在 `D:\eliogames` 执行 `npm run quality`；任一子门禁失败时整体必须失败并停止后续步骤。
- Stage 0 / Task S0-06 工程目录边界与架构决策基线：产品经理人工验收 PASS（2026-09-04）。
- S0-06 稳定恢复点：commit `691ba6d90a71c0dd7e7af304d8538f57b858eee6`。
- 后续开发必须遵守 `08_Architecture_Decision_S0-06.md` 的模块职责、依赖方向、状态唯一事实来源及状态/持久化/动画顺序；`npm run quality` 的第一道自动门禁为 architecture boundary check。
- Stage 0 / Task S0-07 远程仓库与 Linux 权威质量门禁：产品经理人工验收 PASS（2026-09-04）。
- S0-07 稳定恢复点：commit `ddf614bd81f508f3a7927d85c1474c13bf8c586c`，tree `2e7a03dda5aa4db19a7be4cb2b53d0475adac1df`。
- GitHub public repository：`https://github.com/qingchen171/MinePilot`；本地 `main` 跟踪 `origin/main`。
- 远程权威质量门禁：GitHub Actions `Quality` workflow 在标准 `ubuntu-latest` runner 上执行完整 `npm run quality`；本地开发门禁继续是在 `D:\eliogames` 执行 `npm run quality`。
- Stage 1 / Task S1-01 纯领域棋盘模型、坐标与 Cell State 基础不变量：产品经理人工验收 PASS（2026-09-04）。
- S1-01 稳定恢复点：commit `e5db9e3747fdb25271a066e86916c896d1d2f7a7`，tree `b2a12f667e2fba8f24cbde0e2b9809ca6f2038e7`。
- 后续实现约束：外部 JSON、存档与配置进入领域状态时必须经过运行时验证；状态转换必须通过集中纯规则完成，Scene/UI 不得直接修改领域对象；棋盘规则必须继续使用统一坐标/边界 API，不得散落重复索引计算。
- Stage 1 / Task S1-02 八邻域坐标与周围真实雷数纯规则：产品经理人工验收 PASS（2026-09-04）。
- S1-02 稳定恢复点：commit `7940bd2a334a3a4bb10b3cee3fe92943dbccd593`，tree `8d6ddfac25ce77bca6f6e1327a332fc9a9d24f30`。
- 后续邻域约束：所有八邻域规则必须优先复用 `getNeighborCoordinates`；Detection 的随机选择不得利用邻域数组顺序伪装随机；任何修改状态的命令必须独立验证目标合法性，不得把越界空查询当作成功操作。
- Stage 1 / Task S1-03 普通 Flag 的纯状态转换与目标合法性：产品经理人工验收 PASS（2026-09-04）。
- S1-03 稳定恢复点：commit `a503ef13a90977a3061d5f3bba892fd2b47e9d02`，tree `66c53e52a11f1ba2f4e688e5144d49b24924be46`。
- 后续 Flag 约束：Scene/UI 必须调用集中领域转换并消费结构化 Result，不得直接修改 Board；UI、音效与持久化等副作用只能根据真实 transition result 决定，`unchanged` 不得被当作状态变化；Flag 对移动合法性的影响留给后续移动规则；外部 JSON/存档恢复仍须经过运行时验证。
- S1-04 前置产品/技术边界（产品经理批准，2026-09-04）：Hidden Mine 是允许尝试进入但必须返回 `requires-resolution / mine-encounter` 的目标，不是普通 `not-movable`；S1-04 不揭示雷、不判定失败、不处理 Lucky/Revive，也不把角色位置永久提交到该雷。普通移动可选择任意合法坐标，不要求相邻、路径或寻路；Flag 无论真假均作为移动安全锁。
- S1-04 原子边界（产品经理批准，2026-09-04）：普通 Safe 移动在同一纯转换中原子更新最小 `RunState { board, characterPosition }`；未探索目标 Safe 同时转为 explored，已探索目标只更新位置，不允许出现角色已位于 Safe 而该 Cell 仍未 explored 的中间状态。角色开局位置为明确的 `outside-board / waiting`，不得用非法 Coordinate 伪装；首次 Hidden Mine encounter 不提交位置。
- Stage 1 / Task S1-04 角色位置与普通移动目标合法性纯规则：产品经理人工验收 PASS（2026-09-04）。
- S1-04 稳定恢复点：commit `f813f0058e0ca644a81679638718d64166e25e09`，tree `c1b13c007bcaa5ff450fcff67de7609cf647b499`。
- 后续移动约束：未来 Revive 的临时 Revealed Mine 站立必须使用明确特殊领域状态，不得放宽普通 `on-board -> explored Safe` 不变量；Hidden Mine 的最终 encounter/resolution 必须由后续集中规则完成；Scene/UI 只能消费 `moveCharacter` 结构化结果，不得自行移动权威位置；外部 JSON/Save 恢复 RunState 必须运行时验证。
- S1-05 产品/技术边界（产品经理批准，2026-09-04）：Hidden Mine 最终优先级固定为 Lucky 自动结算 > Revive 玩家选择 > Failure；S1-05 只建立权威 pending encounter、first-step 最小事实与无救济介入时的基础 failure 边界，不实现 Lucky/Revive 库存、消耗、选择、揭雷、道具、存档或 UI。
- S1-05 编排约束：pending encounter 期间普通移动必须拒绝；现有 `setFlagged(board, ...)` 不为本 Task 大改，未来 orchestration 必须阻止 Flag 或其他命令绕过/丢失 pending encounter。
- Stage 1 / Task S1-05 Hidden Mine Encounter 的待结算状态与基础失败边界：产品经理人工验收 PASS（2026-09-04）。
- S1-05 稳定恢复点：commit `d6edd50f80433d4d085a2e2fdd13c9d2f87fb1bd`，tree `c1389410906667cfcccf7c38b88c76164544b677`。
- 后续 encounter 约束：Lucky/Revive 必须消费同一 `pending-mine-encounter`，不得另建踩雷判断；Lucky first-step 必须使用 `hasTakenStep` 与 encounter 快照，不得从 characterPosition 重新猜测；Revive 临时站雷必须使用明确特殊位置状态；pending/failed 下未来 Run-level orchestration 必须阻止 Flag/Item 绕过生命周期，但当前不得为 Board-level `setFlagged` 引入 Command Bus 或大规模重构；外部 Save/JSON 恢复生命周期状态必须运行时验证。
- S1-06 编排边界：`won` 必须作为权威 Run phase，普通 `moveCharacter` 必须拒绝 won 后移动；现有 Board-level `setFlagged` 不在本 Task 重构，未来 Run-level orchestration 必须阻止 won 后通过 Flag、Item 或其他命令改变本局权威玩法状态。
- Stage 1 / Task S1-06 全部安全格实际探索的胜利判定与 Run 胜利边界：产品经理人工验收 PASS（2026-09-04）。
- S1-06 稳定恢复点：commit `c4bda35dc5a1efc668cf8b26a3f0c9c36f8e86c1`，tree `a9f8c53c76df0964431baf523aeae290e154b6bf`。
- 后续胜利约束：Airplane 等任何把 Safe 变成 explored 的机制必须复用统一 victory rule；外部 Save/JSON 恢复 won Run 必须运行时验证；won/pending/failed 下未来 Run-level orchestration 必须阻止 Flag/Item 等命令改变本局玩法状态，但当前不得为 Board-level `setFlagged` 引入 Command Bus 或大规模重构；关卡是否允许零 required Safe 属于 Level Config / Board Validator，不属于 Victory 规则。
- Stage 1 / Task S1-07 当前角色脚下数字查询纯规则：产品经理人工验收 PASS（2026-09-04）。
- S1-07 稳定恢复点：commit `6b10844a035b80ebbc6aaad7957223aebac598c5`，tree `c58935909167bb1da9a84f0637ba7e76efb046d3`。
- 后续数字查询约束：未来 Revive 的特殊 Revealed Mine 站立位置必须使 `getCurrentCellMineCount` 返回 unavailable，且不得放宽普通 `on-board -> explored Safe` 不变量；Scene/UI 只能消费统一 query，不得自行扫描 Board；数字显示/隐藏属于 presentation，不得写回 Board State；外部 Save/JSON 恢复仍须运行时验证。
- Stage 1 / Task S1-08 基础 Board Validator 与外部棋盘输入运行时验证边界：产品经理人工验收 PASS（2026-09-04）。
- S1-08 稳定恢复点：commit `a0d43c2347524cca161b5d6aa06bc782015ee296`，tree `6a724885127737544fa5d9580992656bd9a6ff9c`。
- 后续验证约束：Stage 2 Save parser 必须显式映射外部存储结构并复用当前 Board runtime validator，禁止以 `as BoardState` 绕过验证；未来 Level/Generator 产品策略验证必须与当前结构验证分离，不得把比例、可解性、教程规则或体验评分塞入当前 Validator；诊断保持机器可判断且不包含最终 UX 文案；RunState、phase、characterPosition 与 pending encounter 的恢复验证留给 Stage 2。
- Stage 1 / Task S1-09 可重放随机源与基础 Mine Placement 纯规则：产品经理人工验收 PASS（2026-09-04）。
- S1-09 稳定恢复点：commit `ecc217a1ab6248ab2a6b51dc299b3961cbfdd3b7`，tree `4eb65680f71746a7af36fb4e54c97e558dcc55e0`。
- 随机重放兼容合同：PRNG algorithm、seed、`nextInt` 映射算法、RNG 调用顺序、candidate 内容与顺序、placement algorithm、mineCount 共同决定结果；Mulberry32、rejection sampling、row-major/candidate ordering 与 partial Fisher-Yates 均不得作为普通内部实现静默修改。
- Golden compatibility 哨兵：seed `123456789`、row-major `3×3` candidates、mineCount `4` 的 expected coordinates 固定为 `(2,2), (0,0), (0,2), (1,2)`；未来测试失败时不得直接更新 expected，必须先判断是否破坏重放兼容合同。
- Stage 2 Save 约束：设计 Save schema 时重新评估保存最终 Board、保存 seed、引入 RNG/Generation version 及算法升级后的旧存档兼容方式；当前不提前实现这些 Save/versioning 决策。
- Stage 1 / Task S1-10 基础初始 Board 构造纯规则：产品经理人工验收 PASS（2026-09-04）。
- S1-10 稳定恢复点：commit `02b7bdef83de84c4eb2be9688d6aacd398539dd4`，tree `a307c69ff8c47c335145bb8819567d5218f02c9e`。
- Board 生成路径边界：`strategy -> candidates -> S1-09 placement -> S1-10 assembly -> BoardState`；S1-10 只组装上游已明确的 dimensions、Obstacle coordinates 与 Mine coordinates，不承担生成策略。
- 外部 Board 恢复路径边界：`unknown external Board data -> S1-08 validator -> BoardState`；生成路径与外部输入路径最终都必须汇聚到现有 `createCellState` / `createBoard` 权威模型，不得新增第二套 GeneratedBoard/MineCell/ObstacleCell 权威模型。
- Stage 1 / Task S1-11 核心闭环审计与剩余任务冻结：产品经理人工验收 PASS（2026-09-04）；Recovery Test PASS，可仅依赖正式资料恢复 Stage、已完成 Tasks、稳定 baseline、Stage boundary 与 Next Action。
- S1-11 审计 baseline：commit `7da1bf369e62d12c99cb714372c9724fd5676f4e`；source code changes `0`，tests changes `0`；审计期间本地 `npm run quality` PASS，Vitest 14 files、237/237 PASS。
- Stage 1 / Task S1-12 Run-level Flag 命令与生命周期门禁：产品经理人工验收 PASS（2026-09-04）。
- S1-12 稳定恢复点：commit `dac0058c00d7fc225bd8a04f4274b09cea2cc0d7`，tree `6d7a7601817e7f0d44dc31b743bdac268fa4979f`。
- S1-12 gameplay 边界：`setRunFlagged` 是实际 gameplay 的 Run-level Flag 入口；仅 active Run 委托现有 Board-level `setFlagged`，pending/failed/won 在调用 primitive 前结构化拒绝。只有真实 changed 产生保留角色位置、`hasTakenStep` 与 active phase 的新 RunState；rejected/unchanged 不产生伪造状态。
- S1-12 架构约束：Board-level `setFlagged` 继续作为合法 core primitive；未来 gameplay/systems/Scene/UI 不得绕过 Run-level command 直接修改 `run.board`；不得为此引入 Command Bus、GameManager、DI、event bus、generic reducer 或通用 orchestration framework。
- Stage 1 / Task S1-13 Core 生命周期集成与 Freeze Gate：产品经理人工验收 PASS（2026-09-04），结论 `A — READY TO FREEZE`。
- S1-13 最终 implementation baseline：commit `30c8087190fba0327201c2eeb8af45613f9dc6d7`；`src/core` changes `0`，未新增玩法规则或通用 orchestration framework。
- Stage 1 Freeze evidence：正式 `tests/integration/` 层与独立 `npm run test:integration` 已建立；Failure lifecycle、Victory lifecycle、deterministic generation composition 与跨模块不变量完整通过。Unit 253/253、Integration 4/4、Total 257/257、architecture、TypeScript、production build、Playwright 全部 PASS；GitHub Actions Linux `Quality` run `33819177341` Success。
- Stage 1 frozen repository baseline：承载本段 Freeze 状态的 documentation/status-only closeout commit；精确 hash 由 Git history 中 subject `docs(status): freeze Stage 1` 唯一恢复，并在 closeout 报告中记录。implementation baseline `30c8087190fba0327201c2eeb8af45613f9dc6d7` 永久保留。
- Stage 1 最终范围：Board/Cell 权威模型、Coordinate/dimensions、Obstacle 基础语义、八邻域、周围真实雷数、Board-level Flag primitive、Run-level Flag lifecycle gate、waiting/on-board 角色位置、任意合法 Cell 普通移动、Safe 原子探索、Hidden Mine pending encounter、first-step 事实、基础 Failure、Victory/won lifecycle、当前脚下雷数查询、外部 Board runtime validator、确定性可重放 RNG、基础 Mine Placement、初始 Board assembly、正式 Stage 1 lifecycle integration tests。
- Stage 1 冻结架构合同：`BoardState` / `CellState` 是唯一权威棋盘真值；统一构造链为 `createCellState -> createBoard -> BoardState`；生成路径为 `strategy/config -> candidates -> placement -> initial board assembly -> BoardState`；外部输入路径为 `unknown external board data -> runtime validator -> BoardState`；禁止第二套 Board/Cell/Mine 权威模型。
- Stage 1 冻结命令/生命周期合同：`setFlagged` 保留为 Board-level primitive，实际 gameplay Flag 必须通过 Run-level command；普通 `on-board` 必须指向 explored Safe；Hidden Mine 必须先进入 pending encounter，不得隐式 failure/reveal；Victory 只依赖 required Safe exploration；当前脚下数字是统一事实 query，不缓存。
- Stage 1 冻结随机合同：RandomSource、PRNG algorithm、seed、`nextInt` 映射、RNG 调用顺序、candidate 内容与顺序、placement algorithm、mineCount 均为 persistence-sensitive compatibility contract，不得静默破坏 golden test。
- Deferred-by-design 边界：Stage 2 为 State + Save、restore、restart/retry persistence concerns 与 migration/versioning；Stage 3 为 Lucky/Revive/Detection/Airplane；Stage 4 为 Rewards/Inventory/Shop/Tutorial/Benben/Level progression；Stage 5 为 presentation/UI/animation/audio；Stage 6 为 skins/mobile/bilingual；Stage 7 为 production levels/RC/deployment。这些均不是 Stage 1 缺失，不得因 Freeze 提前实现。
- Freeze 后风险约束：Stage 2 Save parser 必须显式 runtime mapping 并复用 Board validator，禁止 `as BoardState`；Stage 2 persistence design 必须正式处理 RNG compatibility/versioning；未来 Revive 必须用独立特殊 character-position state 表达临时站 Revealed Mine，不得破坏普通 `on-board -> explored Safe`；未来 Items 必须复用同一 pending mine encounter，不得另建 mine-hit logic。
- 已知观察/风险：Phaser bundle >500 KB 继续只是 observation；multi-tab duplication、奖励/援助复制与 reward farming 风险继续留待 State/Save、经济与 Future Requirements 对应阶段处理，不是 Stage 1 blocker。
- Stage 2 / Task S2-01 Persistence Boundary & Save Contract Design（只读设计）：产品经理人工验收 PASS（2026-09-04）。设计/审计基线为 Stage 1 frozen repository baseline `156edeecc478be2013ac0f1e691293a747bbce82`；本 Task source/tests/config changes `0`。
- Stage 2 persistence 核心合同：Runtime authoritative state 与 serialized Save DTO 严格分离；Save v1 必须有显式 `saveVersion`；当前 Board 以完整 authoritative facts snapshot 恢复；任何 load 必须经过 parse、validate、explicit map 与现有 constructors/validators 重建后才可成为权威 runtime state，禁止 `JSON.parse(...) as RunState` 或 `as BoardState`。
- Stage 2 persistence 提交/恢复合同：Refresh/reopen 恢复同一 Run 且不得 reroll；Restart/Retry 是未来新 attempt，不得与 restore 混用；required persistence 必须 commit 成功后才能 publish runtime/visual success；浏览器 MVP 采用 crash-safe 双 slot + head commit 边界，localStorage 仅为 adapter，不被视为事务架构。
- Stage 2 corruption/extension 合同：坏存档不得静默删除或自动覆盖；Seed、RNG version、generation version 只作为 provenance/compatibility metadata，不作为普通 F5 restore 的唯一依据；Stage 3/4 尚不存在的 runtime facts 不得提前伪造进 Save schema，未来 Account/Reward/Item facts 必须进入同一 versioned persistence aggregate。
- Stage 2 multi-tab 合同：采用最小 single-writer、revision、session gate；不宣称 localStorage 提供强事务或分布式锁。S2-06 的 session identity 必须与 Stage 1 gameplay deterministic RandomSource 完全隔离，不得复用或污染其 seed、调用序列或兼容合同。
- Stage 2 已批准 Task sequence：S2-02 Save v1 DTO 与纯映射/验证；S2-03 Version dispatcher 与 migration boundary；S2-04 Storage abstraction 与双 slot crash-safe adapter；S2-05 Persistence commit coordinator；S2-06 Single-active-session 与 revision conflict gate；S2-07 Refresh/reopen exact-restore integration；S2-08 Restart/Retry persistence semantics；S2-09 Stage 2 persistence integration 与 Freeze Gate。除唯一 Next Action 外不得提前执行后续 Task。
- S2-03 范围约束：当前只有 v1，只建立最小 version dispatch/migration boundary；不得建立过度抽象 migration framework，也不得虚构多代 migration。
- Stage 2 / Task S2-02 Save v1 DTO 与纯映射/验证：产品经理人工验收 PASS（2026-09-06）。implementation stable point `8e99c41c34ad839d21ab62886c325802846667d3`；GitHub Actions Linux `Quality` run `33991133893` Success。
- Save v1 strict DTO 合同：`serializeSaveDocumentV1(input)` 与 `validateAndLoadSaveDocumentV1(input: unknown)` 保持 Runtime State 与 serialized DTO 分离；load 必须经过 `unknown -> strict DTO validation -> validateBoardInput -> createRunState -> authoritative runtime`，禁止 DTO 直接成为 `RunState` / `BoardState`。
- Save v1 snapshot/reconstruction 合同：保存完整 Board authoritative facts snapshot；Board/Cell legality 继续由 Stage 1 validator/constructors 控制；CharacterPosition、phase、encounter 均显式验证与映射，`occurredOnFirstStep` 保存原事实而不重新推断；derived gameplay facts 不进入 Save。
- Save v1 严格性与隔离合同：unknown fields 一律拒绝；generation provenance 仅为 metadata，不参与 ordinary restore；serialize/load 不与外部 DTO 共享可变引用；Stage 3/4 尚不存在的 runtime facts 不得提前加入 v1。
- S2-02 延后边界：revision orchestration、JSON syntax parsing、storage adapter、version dispatch/migration 与 session coordination 均留给后续已批准 Task；S2-02 不实现这些职责。
- Stage 2 / Task S2-03 Version dispatcher 与 migration boundary：产品经理人工验收 PASS（2026-09-06）。implementation stable point `fd87d54a38b1e8412ab053d61d1e80949d05c9f7`；GitHub Actions Linux `Quality` run `33991965438` Success。
- Save version dispatch 合同：`CURRENT_SAVE_VERSION = 1`；`loadSaveDocument(input: unknown)` 只做最小 document/version inspection 与版本分类，current v1 完整委托 S2-02 `validateAndLoadSaveDocumentV1`，不得复制 Save v1 validation。
- Version classification 合同：missing、invalid、unsupported old、unsupported future 与 current-v1-invalid-document 使用明确结构化结果；`0` 是 unsupported old，negative/fractional/unsafe integer/NaN/Infinity 及非 number 是 invalid；不得把缺失或非法版本猜成 v1。
- Error preservation 合同：current v1 被 S2-02 拒绝时必须保留 `SaveV1ValidationIssue[]`，使后续 pipeline 能区分 unsupported version 与 supported-but-corrupt/inconsistent document。
- Migration boundary 合同：当前没有真实 migration，接缝仅为显式版本分支；未来原则为 `validated old DTO -> pure DTO-to-DTO migration -> current DTO -> current full validation/reconstruction`，migration 不得直接生成或绕过 authoritative Runtime，也不得修改 Stage 1 invariants。
- S2-03 延后边界：JSON syntax parsing 位于 dispatcher 外；storage、revision orchestration、session/multi-tab 尚未实现。当前不得虚构 v0 migration 或建立 migration registry、graph、plugin/schema framework 或 generic migration engine。
- Stage 2 / Task S2-04 Storage abstraction 与双 slot crash-safe adapter：产品经理人工验收 PASS（2026-09-06）。implementation stable point `88cb86a34b4c1bd5684f1251ad9448b977f5fee7`；GitHub Actions Linux `Quality` run `33992963965` Success。
- Storage boundary 合同：storage 层只处理 opaque serialized payload，不理解 Board、Run 或 Save DTO；`StringKeyValueStorage` 是最小 string key/value capability；browser `localStorage` 只存在于 `systems/persistence` adapter。
- Crash-safe layout 合同：使用固定 A/B snapshot slots、`head` 与 `headBackup`；`head` 是正常恢复的 commit authority，`headBackup` 只能恢复已知 committed pointer，不建立无限历史或任意 slot manager。
- Commit protocol 合同：始终执行 inactive slot write -> read-back envelope/slot/revision/payload verify -> protect previous committed pointer -> write new head；successful new-head write 是 persistence commit point，之后的 backup update 仅为 best-effort redundancy maintenance。
- Recovery protocol 合同：valid head 必须优先于另一 slot；head 无效时才尝试 valid committed backup；head/backup 均无法证明 commit 时，即使裸 slot revision 更高也不得自动提升，必须返回 no-save、corruption 或 storage failure 的明确结果。
- Data safety 合同：corruption 不自动 reset/delete；failed new save 不覆盖当前 committed slot，也不改变 authority head，last known committed snapshot 必须仍可恢复；storage unavailable/get/set/remove exception 使用结构化结果。
- S2-04 延后边界：不负责 Save DTO validation、JSON payload parsing、Runtime publish、revision progression/transition、stale-writer/multi-tab conflict 或 gameplay。S2-04 只验证 revision 是非负 safe integer，不判断某 writer 是否有权提交下一 revision。
- Stage 2 / Task S2-05 Persistence commit coordinator：产品经理人工验收 PASS（2026-09-06）。implementation stable point `e6b82fb831db87a24870c7fd39584dbf4c192359`；GitHub Actions Linux `Quality` run `33993518314` Success。
- Candidate commit boundary 合同：`commitCandidateSaveV1(storage, candidate)` 是当前 candidate persistence boundary；调用方只能在 persistence commit 成功并收到 `committed` result 后 publish candidate，任何 persistence failure result 均不得携带 candidate；coordinator 不拥有或替换 global Runtime。
- 正向持久化链：`candidate -> Save v1 serialization -> JSON -> crash-safe snapshot commit -> committed result`；Stage 1 Runtime 不因 persistence convenience 被修改，coordinator 当前不接 Scene、UI 或 gameplay autosave。
- 反向恢复链：`committed snapshot -> JSON parse -> version dispatcher -> Save validation/reconstruction -> authoritative runtime`；JSON syntax failure 与 Save/version failure 必须分离，backup recovery provenance 必须保留，storage-valid backup 仍须通过 Save validation 才能成为成功恢复。
- Cross-layer consistency 合同：storage envelope revision 与 SaveDocument revision 必须一致；successful new-head write 后的 backup update failure 只作为 warning 保留，不撤销已完成 commit。
- Revision/session 未决边界：`structurally valid revision != authorized next revision`。S2-05 尚未处理 expected-current revision、next-revision progression、stale writer、writer ownership 或 multi-tab conflict；这些属于 S2-06。
- Stage 2 / Task S2-06 Single-active-session 与 revision conflict gate：产品经理人工验收 PASS（2026-09-06）。implementation stable point `e1b3d161f7cb8e7211fdd8d3a2e73fc98bcfa2bb`；GitHub Actions Linux `Quality` run `33997625427` Success。
- Session/lease boundary 合同：session identity 与 Stage 1 gameplay deterministic RandomSource 完全隔离；writer lease 是 persistence coordination metadata，不进入 SaveDocument、Board 或 Run；lease ownership 与 revision authority 是两个独立概念。
- Writer lease 合同：writer 必须持有当前未过期且同时匹配 `sessionId + leaseToken` 的 lease；active unexpired owner 不得被静默抢占，expired lease 可 takeover；旧 owner 在 takeover 后不得 renew 或 release 新 owner lease。
- Revision authority 合同：fresh persistence 只允许 `expectedRevision = null` 且 `candidate.revision = 0`；已有 revision N 只允许 `expectedRevision = N` 且 `candidate.revision = N + 1`；same、lower、skipped 或 stale expected revision 均必须拒绝。
- Guarded commit 合同：必须读取真实 committed persistence revision；在 revision 检查前后分别验证 ownership，第二次 verification 位于 S2-05 commit 之前；guard failure 不进入 persistence commit，只有成功结果携带 candidate，实际 commit 继续委托 S2-05 coordinator。
- Persistence safety 合同：valid recovered backup revision 可作为当前 authoritative persisted revision；corrupt、malformed、unsupported persistence 不得被当作 no-save 覆盖；lease/revision/commit failure 均不得产生 publish-capable result。
- Concurrency limitation：当前只保证 `MVP best-effort single writer + stale-write rejection`。localStorage 没有 atomic compare-and-swap；两次 ownership verification 只能缩小普通 race window，不提供数据库级事务隔离、绝对互斥或强分布式锁。
- S2-06 race evidence：第一次 guarded ownership read 观察到 original session；第二次 read 前注入 racer，第二次 verification 正确拒绝；临时移除 second verification 时测试 FAIL，恢复 production 后 PASS，临时 mutation 未进入 implementation commit。
- Stage 2 / Task S2-07 Refresh / reopen exact-restore integration：产品经理人工验收 PASS（2026-09-06）。implementation stable point `53cfc41fb7f6b38c94b31a7843c588d135456f4d`；production code changes `0`；GitHub Actions Linux `Quality` run `33998506569` Success。
- Exact-restore 合同：refresh/reopen 必须从 persisted full authoritative Board 恢复同一 attempt，保留 `runId`、`levelId`、revision、Board dimensions、Mine/Revealed Mine/Obstacle、Safe exploration、正确及错误 Flag、character position、`hasTakenStep`、Run phase、pending target、`occurredOnFirstStep` 与 generation provenance；first-step 与 encounter 事实不得重新推断。
- Restore pipeline 合同：ordinary restore 不调用 gameplay RNG、Mine Placement 或 Initial Board assembly，不写 gameplay snapshot，不递增 revision，也不创建新 runId/new attempt；generation provenance 仅保留为 metadata，不参与 Board 再生成。重建结果必须是新的 immutable authoritative objects，不依赖旧 Runtime reference。
- Reopen session 合同：browser session identity 与 persisted attempt identity 分离，`sessionId` / `leaseToken` 不进入 SaveDocument；新 session 在旧 lease 活跃时可读取但不得取得 writer authority 或提交，lease expiry 后可接管并从 restored revision 执行 `N -> N+1`。
- Recovery/error 合同：backup recovery 必须保留 `recovered-from-backup` provenance；malformed JSON、invalid v1、unsupported future version、unprovable corruption 与真实 `no-save` 必须保持区分；corruption 不得自动 reset、生成新游戏或覆盖旧数据。localStorage 非原子 CAS limitation 与 S2-06 best-effort single-writer/stale-write rejection 边界不变。
- Stage 2 / Task S2-08 Restart / Retry persistence semantics：产品经理人工验收 PASS（2026-09-06）。implementation stable point `356fc477af8fed7b608c21e9c29a1dafb0aab095`；GitHub Actions Linux `Quality` run `34000030504` Success。
- Restart/Retry lifecycle 合同：refresh/reopen 保持 same attempt；explicit Restart 与 post-failure Retry 创建 new attempt。`restartCurrentAttempt` 仅允许 active/pending，`retryFailedAttempt` 仅允许 failed；Retry 对 active、pending、won 结构化拒绝，不发明 won-to-Retry 行为。
- New-attempt 合同：成功后保持同 `levelId`、dimensions、mineCount 与 obstacles，必须产生新 `runId`、revision `N -> N+1` 及与直接上一 attempt 不同的实际 Mine coordinate set；角色回到 waiting、`hasTakenStep = false`、phase active，且不继承 explored、Flag、Revealed Mine 或 pending encounter。
- Generation policy 合同：seed progression 位于 systems/policy 层，从 previous provenance seed 的下一 uint32 seed 开始；每个 candidate 复用冻结的 Mulberry32、rejection sampling 与 partial Fisher-Yates，并比较实际 Mine set。碰撞继续搜索，默认上限 4096；数学唯一布局返回 `no-alternative-mine-layout`，搜索耗尽返回 `generation-search-exhausted`，均不得 commit/publish；成功 provenance 保存实际采用 seed。
- Generation limitation：4096 次 search budget 不保证对所有理论上存在 alternate layout 的 configuration 都找到 alternate；当前安全保证是 exhausted 时明确失败，而不是接受相同雷图。禁止无界循环、仅凭 seed 不同宣称雷图不同，或通过改变 difficulty/mineCount/obstacles 制造差异。
- Identity/atomicity 合同：runId source 与 gameplay RNG 分离，same/invalid runId 必须拒绝；new attempt identity 与 generation identity 分离。流程固定为 old authority -> candidate generation/validation -> guarded persistence commit -> success 后方可 publish；任一步失败均保持旧内存及旧 persisted authority，失败结果不携带 publish-capable candidate。
- Revision/integration 合同：Restart/Retry 不重置 revision；stale expected revision、lost ownership 与 storage failure 继续由 S2-06/S2-05 边界拒绝，不得留下半个 attempt；成功后通过 S2-07 reopen path 只能恢复新的 runId、Board 与 revision，旧 attempt 不得重新成为 authority。
- Future new-attempt boundary：未来 attempt-local reward placement、Lucky/run-local facts、item usage 与 assistance 应接入同一 new-attempt boundary，但 S2-08 不创建假 Reward、Item、Account 或 Stage 3/4 Save 数据。

## 当前阶段

**STAGE 3 FROZEN CANDIDATE；STAGE 0/1/2 FROZEN / PASS**

Stage 0 工程骨架、Stage 1 核心棋盘、Stage 2 State + Save 均已 FROZEN / PASS，既有冻结标签保持不变。Stage 3 四大道具实现与生命周期集成已完成，产品经理批准执行正式 Freeze closeout。最终 implementation baseline 为 `d15add3ba83196c8b0ea6fabaeddf4e76b27eb1a`，不将本轮状态文档变更误记为 gameplay implementation。

### Stage 3 Freeze Closeout — FROZEN CANDIDATE

- 冻结确认规则：本状态提交在 PR/main Linux Quality 成功、独立 Reviewer PASS、Final Recovery Test PASS 后，以 annotated tag `stage-3-frozen` 指向最终 main closeout commit。标签存在且指向包含本段的已验证 closeout commit 时，Stage 3 正式状态为 **FROZEN / PASS**；标签创建前仅为 FROZEN CANDIDATE。通过 `git rev-parse stage-3-frozen^{commit}` 恢复 frozen repository baseline，避免在提交正文中伪造自引用 hash。不得移动或覆盖既有 frozen tag。
- 已完成范围：S3-01 Item boundary；S3-02 GameState/Account inventory/RunItemState/occupancy foundation；S3-03 Save v2 与只读 v1-to-v2 migration；S3-04 unified reveal/survival；S3-05 Detection；S3-06 Revive；S3-07 Airplane；S3-08 Benben boundary review（仅边界，不是实现）；Lucky automatic rescue；Stage 3 Item Lifecycle Integration。不得重新执行上述实现。
- 实现证据：Detection main `b367fa0`（PR #9）；Revive main `3e121ca116af959cba3be1851897dc4baccb24e3`（PR #11）；Airplane main `e104dd02b8dbfdfe174e7477a82d1d00386a00a3`（PR #12）；Lucky main `2d6c63d13664639edd9f3173bffbb2fdc3275364`（PR #14）；集成 main `d15add3ba83196c8b0ea6fabaeddf4e76b27eb1a`（PR #15）。本次统一收尾补齐 Revive、Lucky 与集成的完成记录，不改历史实现。
- 测试证据：最终 implementation baseline 本地完整 quality 为 Unit 522/522、Integration 81/81、Total 603/603 PASS，Architecture/TypeScript/Build/Playwright PASS；main Linux Quality run `34179859313` Success。新增 Stage 3 lifecycle 文件包含 7 个集成用例，使用真实 commands/coordinator/Save v2/guarded persistence，不 mock 权威转换。
- Reviewer evidence：Lucky branch `623c4b6ce3d76fcba254b1c4acf569234bec4668`、集成 branch `65687412d8b78a2ffa445007158a281e19695a45` 均经独立只读 Reviewer PASS 后进入 PR；集成审查核验真实测试断言与底层调用，未声称 Reviewer 重跑了 Builder 全部门禁。本次 closeout Reviewer/CI 必须另行实际执行，不能复用此记录冒充。
- 跨 Item evidence：首步 Lucky -> reopen -> 后续 pending -> Revive；Detection -> reopen -> Airplane -> won -> reopen；四道具消耗后 Restart/Retry 保留账户消耗且重置 attempt-local facts；旧请求不能覆盖新 attempt；Lucky/Revive storage、revision、ownership 失败保持旧 authority。每次成功提交后从完整 Save 重建，load 无写盘。
- Reverse Scan：已实现范围无第二套 Board/Cell/Mine/encounter truth、Item-specific 长期 State、Manager/Bus/framework、独立 Save 或 commit path、UI/Phaser gameplay 泄漏。本次 closeout 限状态文档，production/test/config 修改为 0。

### Stage 3 Frozen Item Contracts

- 共同 ownership：Board/Cell 只拥有真实格子事实；Run 拥有 phase/position/pending/first-step；Account inventory 跨 attempt；RunItemState 仅拥有 Detection/Revive/Airplane successful uses 与 Detection seed。GameState 是统一聚合，不建立 LuckyState、ReviveState、DetectionState、AirplaneState 或第二套 authority。
- Lucky：仅 pending + occurredOnFirstStep + lucky > 0 自动触发；复用 resolvePendingMineEncounterAsSurvived，Lucky -1，Revive 不消耗，不探索 Safe/不判胜/不调用 RNG。成功为 active + revealed-mine-occupancy；实际 gameplay 移动使用 moveCharacterWithAutomaticLucky。not-applicable 不等于无条件允许 Failure；technical error 不回退 Revive/Failure。load 不自动触发 Lucky，已恢复 pending 的 gameplay continuation 使用明确入口。
- Revive：仅 pending；首步且 Lucky 可用时拒绝 lucky-priority；inventory > 0、successfulReviveUses < 1。复用同一 survival primitive，Revive -1、uses +1；不改变 Safe exploration、不判胜。failed 不可 Revive，仍使用 Retry。
- Detection：active on-board/occupancy，非 waiting；周围八格排除中心；优先未插旗 Hidden Mine，否则 flagged Hidden Mine，复用 revealMine。无候选不消耗；每 attempt 最多成功 2 次。seed null 仅在有效候选中初始化，失败不提交 seed；当前选择使用该 seed，下一次 seed 为 uint32 +1，不是 generation RNG continuation，不能静默更改兼容合同。
- Airplane：active 三种位置均可用，pending/failed/won 拒绝；合法中心 + clipped 八邻域，不平移；Hidden Mine reveal 并移旗，Safe explored 并清除错误旗，Obstacle/已揭示雷保持。角色与 hasTakenStep 不变；统一 Victory settlement 可导致 waiting -> won。每 attempt 最多成功 1 次，无收益合法区域仍消耗。
- Occupancy：Lucky/Revive 共用 revealed-mine-occupancy，必须指向真实 Revealed Mine；普通 on-board 仍只能指向 explored Safe。当前数字 unavailable；可离开，不可普通重新进入；Refresh 恢复，Restart/Retry 清除。

### Stage 3 Frozen Save / Persistence / Recovery Contracts

- 唯一写链：GameState candidate -> explicit Save v2 mapper -> DTO/JSON -> existing guarded persistence/coordinator -> A/B committed head -> publish。资源与 Board/Run 在 candidate 内一起变化，禁止 commit 后补扣、UI 提前发布或 Item 直接写 storage。
- 唯一读链：committed snapshot -> JSON parse -> version dispatch -> strict validation/map -> Board/Run/GameState reconstruction。Runtime != DTO；full Board snapshot；unknown fields 拒绝；generation provenance 不用于普通 restore 重生成。
- v1 -> v2 为单一纯 DTO migration：验证 v1 -> DTO migration -> 验证/重建 v2；load 不写 slot/head、不递增 revision。未知 Detection provenance 为 null，不伪造 seed=0。首次真实 mutation 才提交 v2，无 migration framework，也没有待补的假旧 schema。
- Refresh/reopen = same attempt：runId/levelId/revision/Board/position/phase/inventory/usage/seed 原样恢复；不复制库存、不重置 usage。Restart/Retry = new attempt：库存保留真实消耗，本局 usage/position/progress 重置；same level/new runId/实际不同雷图/N+1；禁止用旧状态配新 revision 冒充当前权威。
- Stage 2 authority 不变：fresh revision 0，existing N only N+1；lease/revision gate、second ownership verification、new head commit point、backup committed pointer、非破坏性 corruption handling 继续有效；裸 slot 高 revision 不代表 authority。失败无 publishable candidate，不自动 Failure/reset。
- Known limitations：localStorage 无 atomic CAS/绝对 mutex；4096 generation search budget 可安全耗尽；Detection null seed 失败时只丢弃内部候选，不保证外部 entropy source 未被调用；Phaser >500 KB 为 observation；Reward farming 留风险 registry。本 Stage 不宣称真实 UI 游戏闭环已完成。
- 未来 State 扩展必须进入同一 versioned aggregate，显式说明 schema/version/migration compatibility，并回归 Stage 1/2/3；不得新建 persistence authority 或静默改 RNG/Save/Item 合同。
- Recovery checklist：仅从本文件、Specification、Development Protocol 与 Git history，必须恢复 Stage 0/1/2 frozen tags、Stage 3 完成范围/Item 合同、implementation 与 frozen baseline、限制及 Stage 4 planning 入口。若任一关键事实缺失，停止冻结并报告 GAP，不借聊天补设计。

### Engineering Reliability / ER-01

- ER-01 — Minimal AI Development Reliability Upgrade：独立工程可靠性 Task；不改变 Stage 0/1/2 frozen 状态，不开始 Stage 3 gameplay。
- 永久 AI 入口：repository-root `AGENTS.md` 只定位正式 authority 与不可绕过流程，不复制 Specification 或状态正文。
- Git integration：stable `main` -> `task/<task-id>-<short-description>` -> Builder implementation/tests -> local quality -> branch Linux Quality -> independent read-only Reviewer -> PR -> protected main -> main Linux Quality -> stable baseline -> status closeout。Implementation 不得直接 push 到 `main`。
- Builder/Reviewer gate：Builder 不得自证为 independent review；Reviewer 只读检查实际 diff、tests、scope 与 frozen contracts，输出 PASS/BLOCKED/NEEDS DECISION，不直接 Patch。Elio 不承担 Git、CI、diff、merge 或技术 review。
- Frozen recovery tags：`stage-0-frozen` -> `8b31b011b188914837e20bd68ae0f5082b3ccecd`；`stage-1-frozen` -> `156edeecc478be2013ac0f1e691293a747bbce82`；`stage-2-frozen` -> `1e14a0fff02359658a6b0c8f9e67d5f5576f41cc`。
- `main` 必须由 GitHub protection/ruleset 要求 PR 与 Linux `Quality` 成功后才能正常合入；不要求 Elio code approval，不引入多人、signed commit、linear history 或 conversation-resolution 企业流程。

## 唯一下一行动

**Stage 4 — 定义并批准游戏循环任务拆分，再进入 implementation。**

进入条件：Stage 3 Final Recovery/CI/Reviewer 与 stage-3-frozen 标签全部确认；此前只完成本次 Freeze closeout，不执行 Stage 4。Stage 4 范围为 Reward、Inventory 经济扩展、Shop、Level/progression、Tutorial 与原规格 Benben 临时援助；Benben boundary review 不等于实现，不得替换为只读聊天助手。具体实现 Task 尚未定义，不自行发明。UI/Phaser presentation/animation/audio 属于 Stage 5，本次不提前进入。

## 最近完成任务

### Stage 3 / Task S3-07 — Airplane Implementation PASS

- 验收：implementation 经 PR #12 合并；产品经理接受 Post-merge Acceptance Audit PASS，并批准本次状态收尾。Stage 3 保持 IN PROGRESS。
- Stable implementation baseline：`e104dd02b8dbfdfe174e7477a82d1d00386a00a3`；PR branch `f75d40519bd54c41ebceb434ea86e58d1dd330f8`。Main Linux Quality run `34176075785` Success，完整 quality 步骤已实际核验。
- Authority reuse：`createAirplaneCandidate` / `useAirplane` 复用 Board/Cell truth、RunState、GameState、Account inventory、RunItemState、Save v2 explicit mapper 与 Stage 2 guarded persistence。无 AirplaneState、长期历史、新 position/phase、Save schema change、RNG、Item framework 或新 persistence path。
- Eligibility frozen contract：仅 active 的 waiting/on-board/revealed-mine-occupancy 可用；pending/failed/won 拒绝；inventory.airplane > 0 且 successfulAirplaneUses < 1。
- Region frozen contract：center 必须是棋盘内合法整数坐标，允许 Safe、Hidden/Revealed Mine、Obstacle、Flagged 或未探索 Cell；区域为 center + 既有八邻域，center 只包含一次，超出棋盘部分裁剪，不平移、不要求完整 9 格；不修改 getNeighborCoordinates 排除中心的原语义。
- Transformation frozen contract：Hidden Mine 通过 revealMine 转为 Revealed Mine 并移旗；unexplored Safe 转 explored 且清除错误旗；Obstacle、Revealed Mine、已 explored Safe 保持。Mine identity、区域外 Cell 及 generation 不变，不创建第二套 truth。
- Character/Victory：不调用 moveCharacter，不移动角色，保留 characterPosition 与 hasTakenStep；区域转换全部完成后调用既有 settleRunAsWon，不复制 Victory 判断。允许 waiting + false 在本次原子转换后直接 won。
- Transaction：完整 GameState candidate 同时包含 inventory.airplane -1、successfulAirplaneUses +1、Board 与必要 phase 变化；其他库存/usage/Detection seed 保持。合法无收益区域仍消耗，不返还。Same runId/levelId/provenance、revision N+1，通过 Save v2 与同一 guarded commit 成功后才可 publish。
- Failure atomicity：资格/目标拒绝与 storage/revision/lease failure 不返回 publishable candidate；旧 Runtime 和旧 committed authority 保持。失败可能留下未提交 inactive slot 字节，不将其提升为 authority；不承诺底层存储字节完全未变。
- Audit evidence：实际 diff 仅 2 个实现文件、1 个 helper、2 个测试文件；覆盖三种位置、phase/resource 拒绝、内部/边缘/角落/1x1/窄棋盘、Cell 转换、center 一次、无收益消耗、Victory、一次 guarded commit、三种位置 won reopen 与提交失败恢复。审计只读，未重新运行写盘测试。
- Reverse Scan/limitations：无 Reward/Coins/Tutorial/UI/Phaser 泄漏；无新 schema、RNG、manager/framework 或 storage authority。LocalStorage 非原子 CAS、best-effort single writer 限制不变；Phaser >500 KB 仍为 observation。Active reopen 后再次使用的显式回归可后续增强，当前由 restore 与额度测试组合证明，非 blocker。
- 本次 closeout 仅修改 PROJECT_STATUS，production/test/config/architecture changes = 0。回滚采用独立 revert closeout PR；implementation 可通过 revert 上述 main baseline 的 PR 回滚，不改写 frozen tags。

### Stage 3 / Task S3-05 — Detection Implementation PASS

- 验收：产品经理确认 Implementation、Independent Reviewer、branch/main Linux Quality 均 PASS，并批准状态收尾；Stage 3 保持 IN PROGRESS。
- Detection frozen contract：`createDetectionCandidate` 仅允许 active + on-board 或 revealed-mine-occupancy；waiting/pending/failed/won 拒绝，库存必须大于 0，successfulDetectionUses 必须小于 2。复用统一八邻域且排除中心，只选 Hidden Mine，优先未插旗组，否则从 flagged Hidden Mine 组选择；复用 `revealMine` 揭示并移除目标 Mine Flag，不复制 Cell legality/reveal truth。
- Atomic candidate：经 `createGameState` 验证，原子包含 detection inventory -1、successfulDetectionUses +1、下一次 Detection seed 与一个 Revealed Mine；保持 characterPosition、phase、hasTakenStep、Safe exploration、其他库存/Item facts 不变，不触发 Victory。
- Seed lifecycle frozen contract：`RunItemState.detectionRandomSeed` 为独立 Detection next-use uint32 seed；已有 seed 用冻结的 `createSeededRandomSource(seed).nextInt(candidateCount)` 选择，候选组保留统一邻域顺序；下一次 seed 为 `(selectionSeed + 1) mod 2^32`，不是 Mulberry32 internal continuation。相同 seed/Board/order 可重放；不得静默改变此合同。Stage 1 RNG algorithm、rejection sampling、Mine placement 与 generation RNG/provenance 均未修改。
- Unknown seed：null 不伪造为 0；通过可注入 initializer（生产使用独立 crypto entropy）在临时候选中取样，只有成功 committed authority 才记录初始化及推进后的 seed。状态/库存/额度拒绝或无候选不调用 initializer；commit failure 丢弃临时候选，旧 authoritative seed 仍为 null，不承诺临时 entropy 调用可回滚。
- Save v2 persistence chain：`useDetection` -> GameState candidate -> explicit Save v2 mapper -> existing guarded persistence coordinator -> successful commit -> publish；维持 same runId/levelId/provenance 与 revision N+1。没有新 schema、migration、storage/commit path；refresh/reopen 恢复 Board、inventory、usage 与 Detection seed。
- Failure atomicity：拒绝、无候选、seed failure、storage failure、stale revision 或 lost ownership 均不返回 publishable candidate；commit failure 不公开 target，旧 Board/inventory/usage/seed authority 保持。Core candidate 仅为内部组合材料，不可在 commit 前发布。
- Evidence：新增 unit 22 + integration 7 = 29/29 PASS；Independent Reviewer PASS 并独立复跑 29/29。完整 Unit 476/476、Integration 50/50、Total 526/526，Architecture/TypeScript/Build/Playwright PASS。
- Stable baseline：branch `0a767f0bd398511ecb4b6670b3bb4efe05f4e0d5`；PR #9 合并后 main implementation `b367fa04f80ce3bff954c533c081ec35214e02e4`；branch/PR/main Linux Quality runs `34171926068` / `34172070180` / `34172206171` 全部 Success。
- Reverse Scan：无 DetectionState/Manager、Item/RNG framework、第二套 Board/Mine truth、其他 Item gameplay、UI 或 Stage 4 leakage。Known limitation：沿用 localStorage 非原子 CAS、best-effort single writer + stale-write rejection；不提供绝对互斥。Phaser >500 KB 仍为 observation。
- 本次 closeout 仅修改 PROJECT_STATUS；production/test/config/architecture changes = 0。回滚通过独立 revert closeout PR；implementation 回滚点为上述 main implementation commit，不重写 frozen tags。

### Stage 3 / Task S3-04 — PASS

- 验收：产品经理于 2026-09-08 确认 implementation 通过 Technical Review 并批准 closeout；独立 Reviewer PASS，无 findings。
- revealMine frozen boundary：`revealMine(board, target)` 仅将 Hidden Mine（可带普通 Flag）转换为 Revealed Mine，移除 Flag，保持真实 Mine 身份、Safe exploration 与非目标 Cell 引用；已 Revealed Mine 返回 unchanged，Safe/Obstacle 返回 not-mine，非法或越界目标返回 out-of-bounds，拒绝/unchanged 不产生新 Board。
- Pending survival frozen boundary：`resolvePendingMineEncounterAsSurvived(run)` 只消费当前 pending encounter 的 target，不接受外部任意 target；目标必须仍是未插旗 Hidden Mine。一次构造目标已揭示、position 为 revealed-mine-occupancy、phase active、hasTakenStep 保持 true 的 Run；不得生成 revealed Board 搭配旧 pending phase 的中间状态。active/failed/won 与重复结算拒绝；不触发 Victory，不扣库存或额度。
- Authority ownership：Board/Cell 是 Mine/reveal/Flag 唯一真值；Run 拥有 encounter、position、phase 与 first-step facts；GameState 聚合 account/run/runItems。Primitive 返回值仅为纯组合材料，不是 publishable persistence success；未来 Item command 负责 eligibility、inventory/runItem update 与完整 GameState candidate，再沿既有 guarded coordinator commit 成功后 publish。
- Authority Reuse First：优先复用已有状态、transaction boundary、persistence aggregate；不创建 LuckyState、ReviveState、ItemManager、EncounterManager 或第二套 Mine/Board truth，不建立单 Item 保存、commit 或 migration path。
- Frozen compatibility：Board/Cell truth、RNG、Mine placement、Save v2 schema、Stage 2 coordinator、lease/revision 与 persistence path 均无修改；无新增长期状态或 migration。普通 on-board 仍仅指向 explored Safe；特殊 occupancy 数字 unavailable，离开后不能重新进入 Revealed Mine。
- Tests：新增 unit 19、integration 1，共 20/20 PASS；完整 Unit 454/454、Integration 43/43、Total 497/497 PASS，Architecture、TypeScript、Build、Playwright PASS。覆盖首步/后续/既有 occupancy 的 encounter、拒绝与不可变性、Save v2 explicit mapper round-trip 及无 storage 调用；既有 persistence regression 保持通过。
- Stable baseline：branch `365b03680eb9e854aa9fcff8343f2a3ec7b0b470`，PR #7 合并后 main implementation baseline `0e4c95e04208f10c3f317cc45d3adceaf4d12a25`；branch/PR/main Linux Quality runs `34110395408` / `34110561350` / `34110720466` 均 Success。
- Reverse Scan：无 Item gameplay、UI/animation、Shop/Reward/Stage 4 leakage、通用 framework、新 Save schema 或 persistence path。本次 closeout 仅修改 PROJECT_STATUS；production/test/config changes = 0。
- 回滚：implementation 使用针对 `0e4c95e04208f10c3f317cc45d3adceaf4d12a25` 的 revert PR；本次状态收尾可独立 revert，不改写 frozen tags。

### Stage 3 / Task S3-03 — PASS

- 人工验收与独立审查：产品经理于 2026-09-07 确认 implementation 已通过 Technical Review；独立只读 Reviewer 对实际 diff、tests、scope 与 Stage 1/2 frozen contracts 判定 PASS。
- Save v2 frozen boundary：`CURRENT_SAVE_VERSION = 2`；`SaveDocumentV2` 通过显式 DTO 保存 revision、Account inventory 与可选 active Run 的完整权威事实，包括 full Board snapshot、`CharacterPosition`（含 `revealed-mine-occupancy`）、Run phase、`RunItemState` 与可选 generation provenance。未知 Detection provenance 必须保持 `null`，不得伪造 `seed = 0`。
- Runtime/DTO separation：禁止直接 JSON serialization `GameState`；写入路径固定为 `GameState candidate -> explicit Save v2 mapper -> SaveDocumentV2 DTO -> JSON`。读取必须经 strict DTO validation、Stage 1 Board/Run constructors 与 `createGameState` 重建新的 immutable authoritative Runtime，DTO/Runtime 不共享可变引用。
- v1-to-v2 migration contract：唯一函数 `migrateValidatedSaveDocumentV1ToV2` 只执行纯 DTO-to-DTO migration；流程为 `strict v1 validation -> pure v1-to-v2 migration -> strict v2 validation/reconstruction`。读取 v1 不自动写回、不增加 revision、不修改 A/B slot、head/headBackup，也不发布 migrated save；只有第一次真实 gameplay mutation 才能沿 guarded persistence 路径提交 v2。当前不得建立 migration registry、graph 或 generic migration engine。
- Persistence authority：Stage 2 frozen authority chain 保持唯一且不变；v2 candidate 继续经 JSON serialization、crash-safe A/B snapshot、persistence coordinator、writer lease/revision gate 与 guarded commit，只有 committed success 才可 publish。Storage、commit point、backup recovery、corruption policy、refresh/reopen、Restart/Retry 与 best-effort concurrency contracts 均未被替换；不得建立第二套 gameplay persistence authority。
- 范围控制：未实现 Lucky、Revive、Detection、Airplane gameplay，未新增 Shop、Reward、Tutorial、UI/Phaser 或 migration framework；Stage 1 Board/Cell truth 与 deterministic RNG contract 未修改。
- Tests/evidence：Unit `435/435`、Integration `42/42`、Total `477/477` PASS；Architecture、TypeScript、production build、Playwright 均 PASS。覆盖 v1 read-only migration、migration 后首次真实 mutation 提交 v2 并 refresh/reopen exact restore、DTO/Runtime aliasing、missing Detection provenance、revealed-mine occupancy、strict unknown fields 及 Stage 2 persistence regression。
- Stable points：task branch implementation commit `15bc7aaea46b73b236de0ee5a62701ef327d143f`；Reviewer PASS 后经 PR #5 合并，main implementation baseline `4e850a6be6f963fddb8e31d9db98d55ebe21995b`。
- Linux evidence：branch Quality run `34085547189` Success；PR Quality run `34085974276` Success；main Quality run `34086051800` Success。
- Reverse Scan：未发现第二套 Runtime/Save truth、直接 GameState JSON serialization、fake fallback seed、migration framework、Stage 3 item gameplay 泄漏、Stage 1 RNG 修改或绕过 Stage 2 coordinator 的路径。
- 回滚：通过 PR revert main implementation commit `4e850a6be6f963fddb8e31d9db98d55ebe21995b`；不得放宽 Save v2 strict validation、静默改写 Save v1 或修改 Stage 0/1/2 frozen tags。

### Stage 3 / Task S3-02 — PASS

- 人工验收与独立审查：产品经理于 2026-09-07 验收 PASS；独立只读 Reviewer 对实际 diff、tests、scope 与 frozen contracts 判定 PASS，无 findings。
- Item/Account boundary：`AccountState` 只持有 Lucky、Detection、Airplane、Revive 四种跨 attempt inventory；数量为无人工上限的非负 safe integer，不加入 coins、Shop、Reward 或通用 Account framework。
- Run item boundary：`RunItemState` 只持有 Detection/Airplane/Revive successful-use counters 与显式 Detection uint32 seed；上限继续为 `2/1/1`。Lucky 不新增重复 usage counter；本 Task 不调用、不替换 Stage 1 deterministic RNG，也不建立第二套 RNG 或 item manager。
- GameState boundary：最小 `GameState` 只聚合 `account / run / runItems` 并通过现有 constructors 重建、校验、冻结嵌套 authority；`ItemTransactionResult` 只规定 candidate/rejected 结果形状。只有 candidate 可进入未来 persistence 流程，任何 rejected result 不携带 publishable candidate；不引入 Command Bus、GameManager、DI、event bus 或通用 reducer/framework。
- Revealed Mine occupancy frozen-boundary extension：`CharacterPosition` 新增唯一通用 `revealed-mine-occupancy(coordinate)`；运行时必须位于 Board 内、指向统一 Board truth 中的 Revealed Mine，且 `hasTakenStep = true`。普通 `on-board -> explored Safe` 不变量不变；普通移动可以离开该位置，但不能进入其他 Revealed Mine，离开后不能返回；选择当前占位格为 unchanged；`getCurrentCellMineCount` 返回 unavailable。当前没有实现产生该状态的 Lucky/Revive gameplay。
- Save v1 rejection boundary：Save v1 schema/loader interpretation 保持冻结，`serializeSaveDocumentV1` 遇到 `revealed-mine-occupancy` 必须在 DTO/storage 前结构化返回 `invalid-character-position`，不得静默 downcast、丢失或覆盖新 runtime；coordinator regression test 证明失败不触碰 storage 且不携带 candidate。Account/Run item 新事实必须等待显式 Save v2 接入同一 Stage 2 authority chain。
- Frozen-contract impact：Stage 1 `BoardState`/`CellState` truth、普通 movement/victory/number semantics 均未被替换；Stage 2 storage、revision、lease、commit point、coordinator 与 corruption policies 均未修改。Runtime candidate 仍必须 persist-before-publish。
- Tests：新增 `35` 个 unit tests；定向 `118/118` PASS；最终 Unit `420/420`、Integration `38/38`、Total `458/458` PASS；Architecture、TypeScript、production build 与 Playwright 均 PASS。
- Stable points：task branch implementation commit `41a4827454a9f9d9f341d694ea316d4afe2ac358`；Reviewer PASS 后经 PR #3 合并，main implementation baseline `33fdb3f6fdef741ffb11ba49c628bb9f1c6a5ada`。
- Linux evidence：branch Quality run `34082747494` Success；PR Quality run `34083127157` Success；main Quality run `34083209297` Success。
- 回滚：revert main implementation commit `33fdb3f6fdef741ffb11ba49c628bb9f1c6a5ada`；不得改写 Stage 0/1/2 frozen tags 或通过放宽 Save v1 schema 消除明确 rejection。

### Stage 3 / Task S3-01 — PASS

- 人工验收：产品经理于 2026-09-07 批准 Item Domain、State Ownership 与 Persistence Contract 最终设计；本 Task 为只读设计，production/source/test changes 均为 `0`。
- State ownership：四种 MVP item inventory 是跨 attempt 的 Account authority；Detection/Airplane/Revive successful-use counters 与 Detection deterministic RNG state 是 attempt-local authority；Lucky 不建立普通 usage counter，继续使用冻结的 first-step/pending-encounter 事实。
- Persistence direction：Stage 3 新事实必须进入同一 versioned persistence aggregate；Save v1 interpretation 保持冻结，后续显式引入 Save v2 与 v1-to-v2 pure load-time migration，不建立第二套 Save authority。
- Atomicity：inventory consumption、run-local usage/state、Board/phase/position gameplay result 必须形成单一 candidate，并沿 Stage 2 guarded persistence coordinator 执行 persist-before-publish；任何失败不携带 publishable candidate。
- Frozen-boundary decision：`CharacterPosition` 后续增加唯一通用 `revealed-mine-occupancy(coordinate)` variant，只允许 Lucky/Revive 成功产生且必须指向 Revealed Mine；普通 `on-board -> explored Safe` 不变量与 Revealed Mine 普通不可进入规则保持不变。该状态当前数字 unavailable，refresh 精确恢复，Restart/Retry 清除。
- Lucky product decision：首步踩雷并成功触发 Lucky 后，Mine 变为 Revealed Mine，角色停留在该格并进入通用 revealed-mine occupancy；Lucky 消耗，Revive 不消耗。
- Airplane product decision：active waiting 允许使用，玩家选择合法 target coordinate；角色保持 waiting、`hasTakenStep` 保持 false，3x3 transition 与 Victory 检查保持原子；pending/failed/won 禁止。
- Stage 3 implementation sequence：S3-02 foundation；后续按依赖顺序分别实现 Save v2/migration、统一 reveal primitives、Detection、Airplane、Lucky、Revive，最后执行 Stage 3 integration/freeze gate。除唯一 Next Action 外不得提前执行。
- 审计基线：`8255e0fa25061660e9d982980a7bb93fcb4c323d`；S3-01 无 implementation commit。本 status-only closeout commit 仅记录人工验收、冻结决定与 S3-02 入口。
- 回滚：优先 revert 本 status-only closeout commit；不得修改或重写 Stage 0/1/2 frozen tags。

### Stage 0 / Task S0-01 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`。
- 审计结论：`D:\eliogames` 为正式新项目根目录。
- 保护边界：`D:\MinePilot`、`D:\old_MinePilot` 均为只读历史参考，不得覆盖，不得直接作为新项目代码基础。
- 技术门禁：Windows 10 / Playwright 官方支持问题必须在 S0-02 解决。
- 自动测试：不适用；S0-01 为只读环境审计，无游戏代码。
- 稳定 commit/tag：暂无；审计时 `D:\eliogames` 尚未初始化 Git。
- 回滚点：S0-01 未产生环境或代码写入；审计前磁盘状态保持不变。此次仅更新本状态文档，可通过恢复该文件的上一版本撤销。

### Stage 0 / Task S0-02 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`。
- 本地验证：Windows 10 原生运行 `@playwright/test` 1.62.1 与 Chromium 151；单次 1/1 PASS，重复验证 3/3 PASS。
- 正式路线：Windows 10 原生测试用于开发反馈；GitHub Actions Linux 为权威 E2E 门禁。
- WSL 决策：暂不安装 WSL Linux 发行版；`docker-desktop` 不作为项目测试环境。
- 后续决策：GitHub 仓库公开/私有及 GitHub Actions 预算不在 S0-02 决定，须在创建远程仓库或启用 CI 前由产品经理批准。
- 修改范围：仅在系统临时目录安装隔离的 Playwright 验证依赖和浏览器缓存；未修改项目源码、Windows 功能或 WSL 配置。
- 稳定 commit/tag：暂无；`D:\eliogames` 尚未初始化 Git。
- 回滚点：可移除 `C:\Users\Administrator\AppData\Local\Temp\MinePilot-S0-02`；确认无其他 Playwright 使用后，可清理对应 Playwright 浏览器缓存。

### Stage 0 / Task S0-03 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`。
- 仓库：`D:\eliogames`，默认分支 `main`。
- 本地提交身份：`qingchen171 <293052813+qingchen171@users.noreply.github.com>`；未修改全局 Git 身份。
- 稳定基线 commit：`2be7778eff5f4c2bbe1d9e4058c4d780a832a753`。
- 提交内容：最小 `.gitignore`、六份 Markdown 控制文档和一份 DOCX 控制包；历史目录未纳入仓库。
- 恢复验证：PASS。隔离克隆的 commit 为 `2be7778eff5f4c2bbe1d9e4058c4d780a832a753`，tree 为 `81ba50ea7becb05a9fa150ebad147ea518ce97ef`，必需文件完整且恢复副本工作区干净。
- 后续基线事项：Windows 工作区与 Linux CI 的文本行尾必须通过 `.gitattributes` 明确统一；本轮按产品经理要求不额外修改，交由 S0-04 处理。
- Tag：未创建；Protocol 中的 tag 为后续稳定里程碑候选，S0-03 不需要 tag。
- 回滚方法：使用基线 commit 创建新分支、worktree 或隔离克隆进行非破坏性恢复；不得对用户工作区执行 `reset --hard`。

### Stage 0 / Task S0-04 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`，并接受错误目录执行一次 `npm ci` 的已披露范围偏差。
- 稳定恢复点：commit `a2261ba9cd0f0773e9622aa75f50c8c4e0f3ba51`，tree `efd0f15b73cb22e71b8dbb1eeeaa5e868d95108d`。
- 行尾策略：`.gitattributes` 已统一文本为 LF，Windows 命令脚本允许 CRLF，文档/图片/字体等二进制类型不做文本规范化。
- 锁文件恢复：从隔离克隆运行 `npm ci` 成功；TypeScript、Vitest、Vite build 与 Playwright 浏览器初始化测试全部通过。
- 浏览器证据：Phaser canvas 成功创建，运行时版本为 3.90.0，无 page error。
- 工程流程事故：第一次恢复验证未将命令工作目录切换到新克隆，导致 `npm ci` 在 `C:\Users\Administrator` 既有 Node 项目执行。其 `package.json` 与 `package-lock.json` 未改变，`node_modules` 按既有锁文件重建；若此前存在未声明的额外包，可能已被移除。产品经理知情接受，不要求回滚 S0-04。
- 防错修订：`AI Development Protocol` 已加入工作目录写入门禁；任何可能写盘的项目命令前必须确认当前目录属于 `D:\eliogames`，临时恢复副本必须先核验存在性与 commit/tree 后再显式作为工作目录。
- 性能观察：Phaser production bundle 约 1,198.62 KB（gzip 约 319.57 KB），触发 Vite >500 KB chunk 警告；当前不优化，待真实架构和性能阶段以数据重新评估。
- 未实现内容：没有棋盘、地雷、移动、数字、旗帜、道具、关卡、存档或其他玩法。
- 回滚方法：使用 `a2261ba9cd0f0773e9622aa75f50c8c4e0f3ba51` 做隔离克隆/worktree 恢复；如需撤销本 Task，优先创建 revert commit，不执行 `reset --hard`。

### Stage 0 / Task S0-05 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`。
- 人工证据：在 `D:\eliogames` 执行 `npm run quality` 正常通过；从项目外目录执行质量门禁会被立即拒绝。
- 稳定恢复点：commit `1c2ec68f9981493b5d751c886587df23223a6428`，tree `eff799a0d4543ac123611e0385646fb6adeb3772`。
- 统一门禁：`npm run quality` 依次执行工作目录守卫、TypeScript、Vitest、production bundle 和 Playwright E2E；任一步骤非零即停止并令总体非零退出。
- 自动证据：TypeScript PASS；Vitest 2 个文件、6/6 PASS；Vite build PASS；Playwright 1/1 PASS；完整门禁最终复验耗时 8.536 秒。
- 负向证据：错误目录实际退出码 1 且没有启动 npm 子命令；模拟 `test:unit` 失败时整体退出码 1，build/E2E 未执行。
- 依赖：未新增第三方依赖，冻结版本与 `package-lock.json` 未变化。
- 回滚方法：使用 `1c2ec68f9981493b5d751c886587df23223a6428` 做隔离克隆/worktree 恢复；如需撤销本 Task，优先创建 revert commit，不执行 `reset --hard`。

### Stage 0 / Task S0-06 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；确认 `npm run quality` 完整通过、Phaser baseline 页面正常且没有提前实现游戏玩法。
- 稳定恢复点：commit `691ba6d90a71c0dd7e7af304d8538f57b858eee6`。
- 架构决策：`08_Architecture_Decision_S0-06.md` 冻结 `core / systems / scenes / config / ui / audio / assets` 职责、允许的依赖方向、Game State 唯一事实来源，以及状态、必要持久化先于视觉结果的原则。
- 自动约束：`npm run quality` 首先执行 architecture boundary check；禁止 core 反向依赖表现/编排层、UI/audio 依赖 systems/scenes、不同 systems capability 任意互引，以及 assets 包含可执行源码。
- 自动证据：architecture PASS；TypeScript PASS；Vitest 3 个文件、10/10 PASS；Vite production build PASS；Playwright Chromium 1/1 PASS。
- 最小实现纪律：没有预建无消费者空目录，没有新增第三方依赖，没有实现棋盘、地雷、移动、道具、存档或其他玩法。
- 已知限制：自动门禁检查导入方向，无法替代对“规则是否被隐藏在表现层”的人工审查；非常规运行时模块加载仍需审查。
- 回滚方法：使用 `691ba6d90a71c0dd7e7af304d8538f57b858eee6` 做隔离克隆/worktree 恢复；如需撤销本 Task，优先创建 revert commit，不执行 `reset --hard`。

### Stage 0 / Task S0-07 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`。
- 远程仓库：`qingchen171/MinePilot`，实际 visibility 为 public；remote URL 为 `https://github.com/qingchen171/MinePilot.git`，本地 `main` 跟踪 `origin/main`。
- 稳定恢复点：commit `ddf614bd81f508f3a7927d85c1474c13bf8c586c`，tree `2e7a03dda5aa4db19a7be4cb2b53d0475adac1df`；从公开远程隔离克隆后 commit/tree 一致且恢复工作区干净。
- 远程权威门禁：`.github/workflows/quality.yml` 的 GitHub Actions `Quality` workflow；仅由必要的 `main` push 和面向 `main` 的 Pull Request 触发，无定时任务。
- Linux 实证：run `33798898077` 在标准 `ubuntu-latest`（实际 Ubuntu 24.04.4 LTS）执行成功；Node 24.16.0、npm 11.13.0、architecture PASS、TypeScript PASS、Vitest 3 文件 10/10 PASS、production build PASS、Playwright Chromium 1/1 PASS。
- 权限与成本：workflow 仅授予 `contents: read`；repository secrets 为 0；不使用 larger/GPU/self-hosted runner，不上传 artifact，不使用 Actions cache；public repository 标准 hosted runner 当前成本为 $0。
- 双门禁纪律：Windows 10 本地 `npm run quality` 为每个开发 Task 的日常门禁；GitHub Actions Linux `Quality` 为远程权威门禁。两者均通过后，开发 Task 才可提交人工验收。
- 跨平台结论：Windows/Linux 暂无阻塞性差异；两端均保留 Phaser bundle >500 KB 警告作为观察项。
- 回滚/禁用：优先 revert S0-07 commit 并推送，以保留历史并移除 workflow；也可在 GitHub Actions 页面禁用 workflow。未经明确批准不得删除远程仓库。

### Stage 1 / Task S1-01 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；实际执行本地 `npm run quality`，architecture、TypeScript、Vitest 34/34、production build 与 Playwright Chromium 全部 PASS。
- 稳定恢复点：commit `e5db9e3747fdb25271a066e86916c896d1d2f7a7`，tree `b2a12f667e2fba8f24cbde0e2b9809ca6f2038e7`。
- 领域模型：`Coordinate`、`BoardDimensions`、`CellState`、`BoardState`；统一表达 Obstacle、Safe、Mine、Revealed Mine 和普通 Flag 的权威事实。
- 集中不变量：拒绝 Obstacle/mine、Obstacle/explored、Obstacle/flag、safe/revealed mine、explored safe/flag、mine/explored、Revealed Mine/flag、非法尺寸/坐标及 Cell 数量不匹配等组合。
- 边界规则：`isCoordinateInBoard` 统一判断归属，`getCellAt` 对越界统一返回 `undefined`；Board 创建时复制并冻结 Cell 集合。
- 范围控制：Reward 归属暂不冻结；玩家位置留给未来 Run State；未实现状态转换、随机生成、数字、移动、胜负、存档、道具或 UI。
- 自动证据：本地 architecture PASS、TypeScript PASS、Vitest 4 文件 34/34 PASS、production build PASS、Playwright 1/1 PASS；GitHub Actions Linux `Quality` run `33800633060` Success。
- 后续强制约束：外部 JSON/存档/配置必须运行时验证；领域状态只能由集中纯规则转换；后续棋盘规则必须复用统一坐标/边界 API。
- 回滚方法：优先 revert `e5db9e3747fdb25271a066e86916c896d1d2f7a7` 并推送；也可从其父 commit `8b31b011b188914837e20bd68ae0f5082b3ccecd` 创建隔离分支/worktree，禁止 `reset --hard`。

### Stage 1 / Task S1-02 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；实际执行本地 `npm run quality`，architecture、TypeScript、Vitest 56/56、production build 与 Playwright Chromium 全部 PASS。
- 稳定恢复点：commit `7940bd2a334a3a4bb10b3cee3fe92943dbccd593`，tree `8d6ddfac25ce77bca6f6e1327a332fc9a9d24f30`。
- 统一邻域：`getNeighborCoordinates` 返回中心周围最多 8 个棋盘内坐标，永不包含中心；角落 3 个、非角边缘 5 个、`1×1` 为 0，Obstacle 不改变邻域关系。
- 雷数规则：`countAdjacentMines` 复用统一邻域、`getCellAt` 与 `isMineCell`；Hidden、Revealed、Flagged Mine 均按真实 mine 计数，Wrongly Flagged Safe、Obstacle、explored/unexplored Safe 均不计数。
- 越界语义：合法但位于当前 Board 外的中心坐标返回空邻域/0；修改状态的命令不得沿用空查询作为成功结果，必须独立验证目标。
- 自动证据：本地 architecture PASS、TypeScript PASS、Vitest 5 文件 56/56 PASS、production build PASS、Playwright 1/1 PASS；GitHub Actions Linux `Quality` run `33801841578` Success。
- 后续强制约束：Detection 与其他八邻域规则必须复用统一 API；随机选择必须使用未来可注入、可重放随机源，不得以邻域顺序代替随机。
- 回滚方法：优先 revert `7940bd2a334a3a4bb10b3cee3fe92943dbccd593` 并推送；也可从其父 commit `cd3e1fe35b757b1d07f365281876979bb2922b17` 创建隔离分支/worktree，禁止 `reset --hard`。

### Stage 1 / Task S1-03 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；实际执行本地 `npm run quality`，architecture、TypeScript、Vitest 73/73、production build 与 Playwright Chromium 全部 PASS。
- 稳定恢复点：commit `a503ef13a90977a3061d5f3bba892fd2b47e9d02`，tree `66c53e52a11f1ba2f4e688e5144d49b24924be46`。
- 领域转换：`setFlagged(board, coordinate, desiredFlagged)` 返回 `changed / rejected / unchanged` 结构化结果；成功进一步区分 `placed / removed`，拒绝区分 `out-of-bounds / not-flaggable`，无变化区分 `already-flagged / already-unflagged`。
- Flag 规则：只有未探索 Safe 与 Hidden Mine 可拥有普通 Flag；Obstacle、Explored Safe 与 Revealed Mine 不可 Flag；Flag 只代表玩家猜测，不改变 Cell 的真实 safe/mine 等事实。
- 不可变性：成功转换产生新 Board，原 Board/Cell 不修改且非目标 Cell 引用保持不变；`rejected / unchanged` 不伪造新 Board，防止副作用层误判状态变化。
- 自动证据：本地 architecture PASS、TypeScript PASS、Vitest 6 文件 73/73 PASS、production build PASS、Playwright 1/1 PASS；GitHub Actions Linux `Quality` run `33802972706` Success。
- 后续强制约束：Scene/UI 只能调用领域转换并消费 Result；UI、音效、持久化等副作用只能响应真实 `changed`；Flag 对移动合法性的影响由后续移动规则统一处理；外部 JSON/存档恢复必须运行时验证。
- 回滚方法：优先 revert `a503ef13a90977a3061d5f3bba892fd2b47e9d02` 并推送；也可从其父 commit `e8298a87bdcc55c9290cd1c1519bd9e04ba394ee` 创建隔离分支/worktree，禁止 `reset --hard`。

### Stage 1 / Task S1-04 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；接受 waiting/on-board 角色位置、Safe 移动/探索原子转换、Hidden Mine requires-resolution、Flag 安全锁及不限距离的目标规则。
- 稳定恢复点：commit `f813f0058e0ca644a81679638718d64166e25e09`，tree `c1b13c007bcaa5ff450fcff67de7609cf647b499`。
- 状态模型：最小 `RunState { board, characterPosition }`；角色位置为 `waiting | on-board(coordinate)`，waiting 不伪造棋盘坐标，普通 on-board 只能指向 explored Safe。
- 移动结果：`moveCharacter` 只在 `moved` 时返回新 RunState；Hidden Mine 返回 `requires-resolution: hidden-mine` 且不揭雷、不提交位置；越界、Flagged Cell、Obstacle、Revealed Mine 返回明确 rejected，原地目标返回 unchanged。
- 原子性与距离：首次进入 Safe 时位置与 explored 在同一不可变转换中提交；已 explored Safe 可复用原 Board；目标合法性不使用邻域、距离、路径或中间障碍。
- 自动证据：本地 architecture PASS、TypeScript PASS、Vitest 7 文件 96/96 PASS、production build PASS、Playwright 1/1 PASS；GitHub Actions Linux `Quality` run `33804508118` Success。
- 首次门禁问题：第一次完整 quality 在 TypeScript 阶段发现位置工厂返回类型过宽；通过唯一确定性修复——为 waiting/on-board 工厂补充精确显式返回类型——解决，随后完整 quality 全绿，不构成当前 blocker。
- 后续强制约束：Revive 临时站雷必须增加明确特殊状态，禁止削弱普通位置不变量；Hidden Mine 由后续统一 encounter/resolution 规则处理；Scene/UI 不得直接修改角色位置；外部 JSON/Save 恢复 RunState 必须运行时验证。
- 回滚方法：优先 revert `f813f0058e0ca644a81679638718d64166e25e09` 并推送；也可从其父 commit `9c66ef9cbb3eeb4300654c642931c166d5756d1f` 创建隔离分支/worktree，禁止 `reset --hard`。

### Stage 1 / Task S1-05 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；接受 Run 生命周期、权威 pending encounter、first-step 快照、pending/failed 移动锁与基础 failure 边界。
- 稳定恢复点：commit `d6edd50f80433d4d085a2e2fdd13c9d2f87fb1bd`，tree `c1389410906667cfcccf7c38b88c76164544b677`。
- Run 状态：最小权威事实为 `board / characterPosition / hasTakenStep / phase`；phase 为 `active / pending-mine-encounter / failed`。
- Encounter：保存目标 coordinate 与 `occurredOnFirstStep`；`hasTakenStep` 与 encounter 快照共同冻结历史事实。Encounter 不移动角色、不揭雷、不改变 Board、不消耗道具，且必须指向真实未插旗 Hidden Mine。
- 生命周期门禁：pending/failed Run 不能通过普通 `moveCharacter` 绕过；Hidden Mine 的 requires-resolution 结果携带新的 pending RunState。
- 基础 Failure：`settleMineEncounterAsFailure` 只接受真实 pending encounter；Failure 保留 Board、mine、角色位置与 explored progress，不 restart、不 reroll、不揭雷。
- 自动证据：本地 architecture PASS、TypeScript PASS、Vitest 8 文件 109/109 PASS、production build PASS、Playwright 1/1 PASS；GitHub Actions Linux `Quality` run `33805641623` Success。
- 后续强制约束：Lucky/Revive 消费同一 pending encounter；Lucky 使用权威 first-step 事实；Revive 使用特殊站雷位置；Run-level orchestration 阻止 pending/failed 下的其他命令；不为此提前重构 Board-level Flag API；Save/JSON 必须运行时验证。
- 回滚方法：优先 revert `d6edd50f80433d4d085a2e2fdd13c9d2f87fb1bd` 并推送；也可从其父 commit `24a9e324d56ab4eb9abc960f41732765ca9c8578` 创建隔离分支/worktree，禁止 `reset --hard`。

### Stage 1 / Task S1-06 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；接受统一胜利判定、`won` Run phase、原子胜利转换及零 required Safe 的分层边界。
- 稳定恢复点：commit `c4bda35dc5a1efc668cf8b26a3f0c9c36f8e86c1`，tree `a9f8c53c76df0964431baf523aeae290e154b6bf`。
- 胜利事实：`areAllRequiredSafeCellsExplored(board)` 只依据 Safe/explored 权威事实；Obstacle、Hidden Mine、Revealed Mine 不属于 required exploration，Flag 不提供胜利贡献。
- Run 生命周期：`RunPhase` 增加 `won`；`settleRunAsWon(run)` 只允许 active 且满足统一胜利条件的 Run 进入 won，pending/failed 不能转 won，won 后普通移动被拒绝。
- 原子转换：`moveCharacter` 首次探索最后一个 required Safe 时，在同一次纯转换中直接返回 won Run；Hidden Mine encounter 不触发 victory。
- 自动证据：S1-06 提交前本地完整 `npm run quality` PASS，Vitest 9 个文件、126/126 PASS，production build 与 Playwright Chromium PASS；GitHub Actions Linux `Quality` run `33806653905` Success。状态收尾提交将再次执行本地与远程完整门禁。
- 后续强制约束：未来所有 explored Safe 转换复用统一 victory rule；Save/JSON 恢复 won Run 必须运行时验证；Run-level orchestration 阻止 won/pending/failed 下的其他命令；不得提前大改 Board-level Flag API；零 required Safe 的关卡合法性由 Level Config / Board Validator 决定。
- 回滚方法：优先 revert `c4bda35dc5a1efc668cf8b26a3f0c9c36f8e86c1` 并推送；也可从其父 commit `e35293e759b22d8399ef5d4cdc0c72786e427cfa` 创建隔离分支/worktree，禁止 `reset --hard`。

### Stage 1 / Task S1-07 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；接受统一当前脚下数字查询、结构化 available/unavailable 结果、合法 0 的明确表达及所有 phase 下的事实查询边界。
- 稳定恢复点：commit `6b10844a035b80ebbc6aaad7957223aebac598c5`，tree `c58935909167bb1da9a84f0637ba7e76efb046d3`。
- 统一查询：`getCurrentCellMineCount(run)` 仅在角色位于合法 explored Safe 时返回 `{ status: 'available', mineCount }`；waiting 返回 `{ status: 'unavailable' }`，合法数字 0 不与无数字混淆。
- 规则复用：查询直接调用 `countAdjacentMines`；Hidden、Revealed、Flagged Mine 均按真实 Mine 事实计数，Wrong Flag、Safe、Obstacle 不计数，中心格不参与。
- 生命周期与状态：pending/failed/won 不由 query 层按 phase 屏蔽；数字不缓存进 Cell、Board 或 Run State，查询无副作用。
- 自动证据：本地 architecture、TypeScript、Vitest 10 文件 139/139、production build 与 Playwright Chromium 全部 PASS；GitHub Actions Linux `Quality` run `33807509370` Success。
- 后续强制约束：Revive 特殊站雷位置必须返回 unavailable；不得削弱普通位置不变量；Scene/UI 只能消费统一 query；显示/隐藏是 presentation；Save/JSON 恢复必须运行时验证。
- 回滚方法：优先 revert `6b10844a035b80ebbc6aaad7957223aebac598c5` 并推送；也可从其父 commit `e3745f0398639ecabae453ed925ed082738ff10f` 创建隔离分支/worktree，禁止 `reset --hard`。

### Stage 1 / Task S1-08 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；接受统一 Board runtime validation 边界、结构化机器错误、权威构造复用及策略层留空。
- 稳定恢复点：commit `a0d43c2347524cca161b5d6aa06bc782015ee296`，tree `6a724885127737544fa5d9580992656bd9a6ff9c`。
- 统一入口：`validateBoardInput(input: unknown)` 对外部 `{ dimensions, cells: CellFacts[] }` 做运行时结构验证；valid 返回已构造的 `BoardState`，invalid 返回 `BoardValidationIssue[]`。
- 错误模型：稳定 code 为 `invalid-input / invalid-dimensions / invalid-cell-count / invalid-cell / invalid-cell-state`，可携带 field/cellIndex，不包含最终用户 UX 文案。
- 权威复用：外部字段检查后逐格调用 `createCellState`，最终调用 `createBoard`；没有复制第二套 Cell/Board legality rules，也没有使用 `as BoardState` 绕过验证。
- 隔离性：Validator 不修改原 input；成功 Board 继续遵守复制/freeze 约束，不受原 input 后续 mutation 污染。
- 策略留空：未加入 mine/obstacle 比例、minimum safe/mine、全 Obstacle/零 required Safe 禁令、连通性、可解性、首击安全、教程规则、体验评分或防刷策略。
- 自动证据：本地 architecture、TypeScript、Vitest 11 文件 178/178、production build 与 Playwright Chromium 全部 PASS；GitHub Actions Linux `Quality` run `33809961319` Success。
- 后续强制约束：Save parser 显式映射并复用 Validator；Level/Generator 策略验证保持独立；机器诊断不混入 UX；完整 RunState 恢复验证留给 Stage 2。
- 回滚方法：优先 revert `a0d43c2347524cca161b5d6aa06bc782015ee296` 并推送；也可从其父 commit `fa1e1c0451e0b266ca7d0c61dc7ed7de6d0f3f4d` 创建隔离分支/worktree，禁止 `reset --hard`。

### Stage 1 / Task S1-09 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；接受显式 RandomSource、固定 Mulberry32、uint32 seed、rejection-sampling `nextInt`、partial Fisher-Yates 与 candidate-order 重放合同。
- 稳定恢复点：commit `ecc217a1ab6248ab2a6b51dc299b3961cbfdd3b7`，tree `4eb65680f71746a7af36fb4e54c97e558dcc55e0`。
- 随机源：`createSeededRandomSource(seed)` 接受 `0..4294967295`；`RandomSource.nextInt(maxExclusive)` 显式注入，不调用 `Math.random()`，同 seed/同调用顺序可跨环境重放。
- Mine Placement：`selectMineCoordinates(candidates, mineCount, random)` 只做无重复坐标采样；0 与全选合法，候选不足不 clamp，输入不修改，输出冻结，不修改或生成 Board。
- 结构化拒绝：`invalid-mine-count / mine-count-exceeds-candidates / invalid-candidate / duplicate-candidate`；Random seed 与 maxExclusive 构造不变量使用明确 RangeError。
- 完整重放合同：算法、seed、映射、调用顺序、candidate 内容/顺序、placement、mineCount 任一变化都可能改变结果，未来必须版本化评估而非静默修改。
- Golden test：seed `123456789`、row-major `3×3`、mineCount `4` 固定得到 `(2,2), (0,0), (0,2), (1,2)`，是 Save/replay compatibility 哨兵。
- 自动证据：本地 architecture、TypeScript、Vitest 13 文件 216/216、production build 与 Playwright Chromium 全部 PASS；GitHub Actions Linux `Quality` run `33811343440` Success。
- Stage 2 决策留白：最终 Board/seed 保存策略、RNG/Generation version 及旧存档迁移必须在 Save schema Task 重新评估，本轮未提前冻结。
- 回滚方法：优先 revert `ecc217a1ab6248ab2a6b51dc299b3961cbfdd3b7` 并推送；也可从其父 commit `59988df770d742b53940f16177227e6de4495ddf` 创建隔离分支/worktree，禁止 `reset --hard`。

### Stage 1 / Task S1-10 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；接受 `createInitialBoard(input)` 的纯组装职责、初始 Cell 事实、结构化冲突拒绝、稳定 row-major 输出及 S1-09 -> S1-10 小型组合测试。
- 稳定恢复点：commit `02b7bdef83de84c4eb2be9688d6aacd398539dd4`，tree `a307c69ff8c47c335145bb8819567d5218f02c9e`。
- 统一入口：`createInitialBoard(input)` 只把明确 dimensions、Obstacle coordinates 与已选择 Mine coordinates 组装为 `BoardState`；不选择 Mine、不生成 Obstacle、不调用 RNG。
- 初始事实：普通 Safe 为 unexplored/unflagged，Mine 为 hidden/unflagged，Obstacle 永远不是 Mine；初始 Board 不产生 explored Safe、Flag 或 Revealed Mine。
- 结构拒绝：invalid dimensions、Obstacle/Mine 越界、各自重复及 Mine/Obstacle overlap 均明确拒绝；不静默去重、忽略、移动或覆盖冲突坐标。
- 权威复用与顺序：逐格调用 `createCellState`，最终调用 `createBoard`；cells 固定为 row-major，输入坐标数组顺序不改变最终 Board facts，原输入及其后续 mutation 不污染 Board。
- 双路径边界：生成路径为 `strategy -> candidates -> S1-09 placement -> S1-10 assembly -> BoardState`；外部恢复路径为 `unknown external Board data -> S1-08 validator -> BoardState`。两者汇聚到同一权威 Board/Cell 模型，禁止建立第二套 GeneratedBoard/MineCell/ObstacleCell 模型。
- 策略留空：正式 Level 的 density、Obstacle ratio、首击安全、教程、奖励、difficulty、连通性与可解性仍属于后续独立策略层。
- 自动证据：本地 architecture、TypeScript、Vitest 14 文件 237/237、production build 与 Playwright Chromium 全部 PASS；GitHub Actions Linux `Quality` run `33813850082` Success。
- 回滚方法：优先 revert `02b7bdef83de84c4eb2be9688d6aacd398539dd4` 并推送；也可从其父 commit `cd4e729c579ad1d84c1bdcb8161ce543562fd79e` 创建隔离分支/worktree，禁止 `reset --hard`。

### Stage 1 / Task S1-11 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；接受结论 `B — STAGE 1 NEEDS REMAINING TASKS`，并批准 S1-12 与 S1-13 两个最小剩余 Task。
- Recovery Test：PASS。仅凭当前 Git repository、正式控制文档、source、tests 与 Git history，可以恢复当前 Stage、S1-01 至 S1-10 完成状态、稳定 baseline、Stage boundary 与唯一 Next Action；无关键 `RECOVERY GAP`。
- 审计 baseline：commit `7da1bf369e62d12c99cb714372c9724fd5676f4e`；本 Task 未修改 source code 或 tests。
- 自动证据：审计期间 `npm run quality` PASS；architecture、TypeScript、Vitest 14 files 237/237、production build 与 Playwright Chromium 全部 PASS。
- 唯一 gameplay implementation gap：Board-level `setFlagged` 缺少 Run lifecycle gate，无法自行阻止 pending/failed/won Run 继续改变 Board；S1-12 以最小 Run-level command 修复该边界。
- Freeze evidence gap：当前缺少贯穿 Initial Board、waiting、Safe movement/exploration、number query、revisit、Flag protection、Hidden Mine/Failure 与 final-Safe/Victory 的完整 core lifecycle integration；S1-13 负责该证据与 Stage 1 Freeze Gate。
- 范围纪律：S1-12/S1-13 不授权 Save、Retry、Lucky、Revive、Detection、Airplane、Rewards、Inventory、Shop、Tutorial、Benben、Level progression、presentation/UI/animation/audio 或其他后续 Stage 功能。
- 架构纪律：无需且禁止为两个剩余 Task 引入 Command Bus、GameManager、DI、event bus 或通用 orchestration framework；`createRunState` 外部 Save runtime validation 留给 Stage 2。
- 已知观察：Phaser bundle >500 KB 继续保留为 observation，不是 Stage 1 blocker。
- 回滚方法：S1-11 为只读审计；状态收尾仅修改本文件，优先 revert 对应 documentation/status-only closeout commit，不执行 `reset --hard`。

### Stage 1 / Task S1-12 — PASS

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；接受 `setRunFlagged(run, coordinate, desiredFlagged)` 为实际 gameplay 的 Run-level Flag 入口。
- 稳定恢复点：commit `dac0058c00d7fc225bd8a04f4274b09cea2cc0d7`，tree `6d7a7601817e7f0d44dc31b743bdac268fa4979f`。
- 生命周期门禁：仅 active Run 可以委托现有 `setFlagged`；pending-mine-encounter、failed、won 在 Board primitive 调用前结构化拒绝。
- 状态转换：只有 Board-level changed 产生新 RunState，并保留 `characterPosition`、`hasTakenStep` 与 active phase；rejected/unchanged 不携带伪造的新 Run。
- 玩法边界：Flag 不触发 Victory、Failure 或 Mine encounter，也不是 step；Cell legality 完全复用既有 Board primitive。
- 架构边界：Board-level `setFlagged` 保留为合法 core primitive；未来实际 gameplay/systems/Scene/UI 必须使用 Run-level command，且不引入通用 orchestration framework。
- 自动证据：本地 `npm run quality` PASS；architecture、TypeScript、Vitest 15 files 253/253、production build 与 Playwright Chromium 全部 PASS；GitHub Actions Linux `Quality` run `33817750530` Success。
- 回滚方法：优先 revert `dac0058c00d7fc225bd8a04f4274b09cea2cc0d7` 并推送；禁止 `reset --hard`。

### Stage 1 / Task S1-13 — PASS / FREEZE GATE

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS` 并接受最终结论 `A — READY TO FREEZE`。
- implementation baseline：commit `30c8087190fba0327201c2eeb8af45613f9dc6d7`；S1-13 对 `src/core` 零修改，仅新增 integration tests 与必要的测试收集/质量门禁配置。
- Integration layer：`tests/integration/stage-1-core-lifecycle.test.ts`；独立入口 `npm run test:integration`，且 `npm run quality` 强制依次执行 unit 与 integration，任一失败则总体失败。
- Failure lifecycle：Initial Board、waiting、Safe 原子探索、当前数字、revisit、Flag 锁与移除、Hidden Mine pending encounter、pending lifecycle gates、基础 Failure、failed lifecycle gates 全部闭环，无 UI/Scene/Phaser 依赖。
- Victory lifecycle：required Safe 逐个探索、错误 Flag 阻止探索、移除后最后 Safe 原子进入 won、Obstacle/Mine/Flag 不提供胜利贡献、won lifecycle gates 与 won 后事实 query 全部闭环。
- Deterministic composition：`createSeededRandomSource -> selectMineCoordinates -> createInitialBoard -> BoardState` 通过；seed `123456789` golden coordinates 保持 `(2,2), (0,0), (0,2), (1,2)`。
- Cross-module evidence：`on-board -> explored Safe`、pending/failed/won movement 与 Run-level Flag gates、统一 victory/number/mine truth、Revealed Mine 真实计数、不可变转换及统一 Board truth 均在 integration 层再次验证。
- 反向扫描：未发现 `Math.random`、global RNG、random sort、重复 neighborhood/victory/Cell legality、第二套 Board truth、Scene/UI gameplay rule、core 平台依赖、`as BoardState`、通用 orchestration framework 或 Stage 2+ feature leakage。
- Freeze test evidence：Unit 253/253、Integration 4/4、Total 257/257、architecture PASS、TypeScript PASS、production build PASS、Playwright PASS；GitHub Actions Linux `Quality` run `33819177341` Success。
- 回滚方法：优先 revert `30c8087190fba0327201c2eeb8af45613f9dc6d7` 并推送；Freeze closeout 文档使用独立 documentation/status-only commit 回滚，禁止 `reset --hard`。

### Stage 2 / Task S2-01 — PASS（只读设计）

- 人工验收：产品经理于 2026-09-04 明确确认 `PASS`；接受最终结论 `READY FOR STAGE 2 IMPLEMENTATION` 及 S2-02 至 S2-09 的最小 Task sequence。
- 设计基线：Stage 1 frozen repository baseline `156edeecc478be2013ac0f1e691293a747bbce82`；本 Task 未修改 source、tests、package configuration 或 `PROJECT_STATUS` implementation facts。
- Runtime/DTO 边界：Runtime authoritative state 不等于 serialized DTO；禁止直接 stringify runtime object 作为正式协议，禁止 parse 后以类型断言绕过运行时验证。Load 必须 validate/map/reconstruct 并复用 Stage 1 Board validator 与 Run constructors。
- Board/RNG 决策：Save v1 保存完整当前 Board facts；seed/RNG/generation version 仅为 provenance/compatibility metadata，不作为 F5 restore 的唯一依据。
- 生命周期语义：Refresh/reopen 恢复同一 Run；Restart/Retry 是未来新 attempt。两者入口必须分离，当前不实现 Restart/Retry。
- 持久化顺序：candidate authoritative aggregate -> persistence commit -> runtime publish -> presentation；写入失败不得先宣称成功。浏览器方向为双 slot + head commit，最后一个有效快照必须可恢复。
- 数据安全：坏存档非破坏性处理，不静默删除/覆盖；Stage 3/4 facts 只在真实 runtime model 出现后通过同一 versioned aggregate 扩展。
- Multi-tab：最小 single-writer/revision/session gate；明确不提供强事务/分布式锁保证，session identity 与 gameplay deterministic RNG 严格隔离。
- 自动证据：设计完成后本地 `npm run quality` PASS；architecture、TypeScript、Unit 253/253、Integration 4/4、production build 与 Playwright 全部 PASS。
- 回滚方法：S2-01 为只读设计；状态收尾仅修改本文件，优先 revert 对应 documentation/status-only closeout commit，禁止 `reset --hard`。

### Stage 2 / Task S2-02 — PASS

- 人工验收：产品经理于 2026-09-06 明确确认 `PASS`；接受 Save v1 DTO、纯显式 serialize/load mapping、严格 unknown-field policy 与 Stage 1 权威重建边界。
- implementation stable point：commit `8e99c41c34ad839d21ab62886c325802846667d3`。
- 公开边界：`serializeSaveDocumentV1(input)` 与 `validateAndLoadSaveDocumentV1(input: unknown)`；Runtime State 与 Save DTO 独立，Save v1 保存完整 Board authoritative facts snapshot。
- 加载链：`unknown -> strict DTO validation -> validateBoardInput -> createRunState -> authoritative runtime`；DTO 不得直接成为 `RunState` / `BoardState`，Board/Cell legality 继续由 Stage 1 权威 validator/constructors 控制。
- 语义合同：CharacterPosition、phase、encounter 显式验证和映射；`occurredOnFirstStep` 保存原事实；derived gameplay facts 不进入 Save；generation provenance 仅为 metadata，不参与 ordinary restore。
- 安全合同：unknown fields 严格拒绝；serialize/load 不共享可变引用；Stage 3/4 尚不存在的状态不加入 v1。
- 延后职责：JSON syntax parsing、storage、revision orchestration、version dispatch/migration 与 session 不属于 S2-02。
- 自动证据：Architecture PASS、TypeScript PASS、Unit 291/291、Integration 4/4、Total 295/295、production build 与 Playwright PASS；GitHub Actions Linux `Quality` run `33991133893` Success。
- 回滚方法：优先 revert `8e99c41c34ad839d21ab62886c325802846667d3` 并推送；状态收尾使用独立 documentation/status-only commit 回滚，禁止 `reset --hard`。

### Stage 2 / Task S2-03 — PASS

- 人工验收：产品经理于 2026-09-06 明确确认 `PASS`；接受最小 version dispatcher、结构化版本分类、v1 完整委托与无真实 migration 的边界。
- implementation stable point：commit `fd87d54a38b1e8412ab053d61d1e80949d05c9f7`。
- 公开边界：`CURRENT_SAVE_VERSION = 1`；`loadSaveDocument(input: unknown)` 在 JSON syntax parsing 后接收未知 JS value，只检查足以分类版本的最小事实。
- 分发合同：current v1 完整委托 `validateAndLoadSaveDocumentV1`；v1 Board/Run/phase/encounter/provenance/unknown-field validation 不在 dispatcher 复制。
- 结果合同：明确区分 loaded、missing version、invalid type/number、unsupported old/future version 与 invalid current-version document；v1 validation issues 原样保留。
- Migration 接缝：当前仅为显式版本分支，没有 v0 schema、真实 migration、registry、graph 或通用 migration framework。未来 migration 只允许 validated old DTO 到 current DTO 的纯转换，随后走 current full validation/reconstruction。
- 延后职责：JSON parsing、storage、revision/session orchestration 与 multi-tab 不属于 S2-03。
- 自动证据：Architecture PASS、TypeScript PASS、Unit 315/315、Integration 4/4、Total 319/319、production build 与 Playwright PASS；GitHub Actions Linux `Quality` run `33991965438` Success。
- 回滚方法：优先 revert `fd87d54a38b1e8412ab053d61d1e80949d05c9f7` 并推送；状态收尾使用独立 documentation/status-only commit 回滚，禁止 `reset --hard`。

### Stage 2 / Task S2-04 — PASS

- 人工验收：产品经理于 2026-09-06 明确确认 `PASS`；接受 opaque string storage boundary、固定 A/B slots、head/headBackup authority 与 crash-safe write/read protocol。
- implementation stable point：commit `88cb86a34b4c1bd5684f1251ad9448b977f5fee7`。
- Capability/adapter：`StringKeyValueStorage` 提供最小 read/write/remove string API；localStorage adapter 位于 `systems/persistence`，将 unavailable 与 get/set/remove exception 转成结构化 failure，不理解 gameplay 或 Save DTO。
- Storage layout：固定 namespaced A/B slot、head、headBackup；slot envelope 仅保存 storage format、slot、revision 与 opaque serialized payload。
- Commit authority：写 inactive slot并 read-back verify，保护旧 committed pointer 后写新 head；successful new-head write 是唯一 commit point，commit 后 backup update 为 best-effort。
- Recovery authority：有效 head 胜过另一 slot；head 无效才使用有效 backup；裸 slot 不因 revision 更高被提升。无法由 head/backup 证明 commit 时非破坏性返回 corruption/no-save/storage failure。
- Failure safety：inactive write/read-back/verification、backup/head write 与 storage exception 均结构化处理；失败的新 save 不破坏 last known committed snapshot；corruption 不自动删除或 reset。
- Revision 未决边界：S2-04 只验证 revision 格式，不验证 revision transition 或 stale-writer semantics。后续必须区分 `revision is structurally valid` 与 `this writer is allowed to commit the next revision`。
- 延后职责：Save DTO validation、JSON payload parsing、Runtime publish、revision progression、multi-tab conflict 与 gameplay 不属于 S2-04。
- 自动证据：Architecture PASS、TypeScript PASS、Unit 355/355、Integration 4/4、Total 359/359、production build 与 Playwright PASS；GitHub Actions Linux `Quality` run `33992963965` Success。
- 回滚方法：优先 revert `88cb86a34b4c1bd5684f1251ad9448b977f5fee7` 并推送；状态收尾使用独立 documentation/status-only commit 回滚，禁止 `reset --hard`。

### Stage 2 / Task S2-05 — PASS

- 人工验收：产品经理于 2026-09-06 明确确认 `PASS`；接受 candidate persistence boundary、persist-before-publish、JSON/load orchestration 与 backup recovery provenance 合同。
- implementation stable point：commit `e6b82fb831db87a24870c7fd39584dbf4c192359`。
- Commit API：`commitCandidateSaveV1(storage, candidate)` 组合 Save v1 serialization、JSON serialization 与 S2-04 crash-safe commit；只有 `committed` result 携带 candidate，使调用方获得合法 publish 路径，失败不携带 candidate。
- Runtime ownership：coordinator 不拥有、不替换 global Runtime，也不执行 movement、Flag、Victory/Failure 或其他 gameplay；Stage 1 Runtime 模型保持不变。
- Load API：`loadPersistedSave(storage)` 组合 committed snapshot、JSON parse、S2-03 version dispatch 与 S2-02 validation/reconstruction；明确区分 no-save、storage failure/corruption、malformed JSON、version failure、invalid current document、revision mismatch、normal load 与 backup recovery。
- Recovery correctness：backup 来源在成功结果中保真；storage-valid backup 的 payload 若 JSON 或 Save validation 失败，不得称为成功恢复，也不得继续提升裸 slot。
- Commit correctness：storage revision 与 SaveDocument revision 必须一致；post-commit backup update failure 保留 warning，但 successful new-head commit 仍有效。
- Revision 延后边界：`structurally valid revision != authorized next revision`；expected-current、next-revision progression、stale writer、writer ownership 与 multi-tab conflict 留给 S2-06，S2-05 未引入 session/lease。
- 自动证据：Architecture PASS、TypeScript PASS、Unit 364/364、Integration 15/15、Total 379/379、production build 与 Playwright PASS；GitHub Actions Linux `Quality` run `33993518314` Success。
- 回滚方法：优先 revert `e6b82fb831db87a24870c7fd39584dbf4c192359` 并推送；状态收尾使用独立 documentation/status-only commit 回滚，禁止 `reset --hard`。

### Stage 2 / Task S2-06 — PASS

- 人工验收：产品经理于 2026-09-06 明确确认 `PASS`；接受 best-effort single writer、writer lease、authoritative revision progression 与 guarded commit contracts。
- implementation stable point：commit `e1b3d161f7cb8e7211fdd8d3a2e73fc98bcfa2bb`。
- Session identity：生产 session/lease identity 使用独立 UUID capability，测试可注入固定 identity；不得调用或污染 Stage 1 deterministic RandomSource，且 session/lease 不进入 SaveDocument、Board 或 Run。
- Lease API：提供 inspect/acquire/renew/release；固定 namespaced lease key，使用可注入 clock；write 后必须 read-back verify；仅 matching live `sessionId + leaseToken` 可 renew/release，expiry 是 crash fallback。
- Revision gate：无 save 时只接受 expected null/candidate 0；已有 N 时只接受 expected N/candidate N+1；guarded commit 实际加载 committed save，拒绝 stale、same、lower、skipped revision 以及 corrupt/malformed/unsupported persistence。
- Ownership gate：revision 检查前验证 live ownership，并在调用 S2-05 前再次验证；第二次检查用于缩小检查到 commit 之间的普通 race window，但不被描述为原子锁。
- Persist-before-publish：guard failure 不调用 S2-05；underlying commit failure 沿用 S2-05 failure；只有最终 committed result 携带 candidate。Recovered backup 的 revision 可继续作为 authority，并在结果中保留 `head-backup` provenance。
- Race regression evidence：first guarded lease read 为 original session，第二次 read 前 deterministic hook 注入 racer，second verification 拒绝且旧 committed snapshot 保持；mutation sanity check 证明移除 second verification 时测试 FAIL，恢复 production 后 PASS，生产文件哈希恢复且 mutation 未提交。
- Concurrency limitation：localStorage 无 atomic CAS；当前只能提供 MVP best-effort ownership gate 与 stale-write rejection，不提供 race-free mutex、强事务或分布式锁。
- 自动证据：Architecture PASS、TypeScript PASS、Unit 385/385、Integration 16/16、Total 401/401、production build 与 Playwright PASS；GitHub Actions Linux `Quality` run `33997625427` Success。
- 回滚方法：优先 revert `e1b3d161f7cb8e7211fdd8d3a2e73fc98bcfa2bb` 并推送；状态收尾使用独立 documentation/status-only commit 回滚，禁止 `reset --hard`。

### Stage 2 / Task S2-07 — PASS

- 人工验收：产品经理于 2026-09-06 明确确认 `PASS`；接受 refresh/reopen exact-restore contracts 与 integration evidence。
- implementation stable point：commit `53cfc41fb7f6b38c94b31a7843c588d135456f4d`；本 Task production code changes `0`，未新增 production abstraction。
- Same-attempt restore：从 committed full Board snapshot 恢复同一 `runId`、`levelId` 与 revision；完整保留 Board/Cell facts、Flag、character position、`hasTakenStep`、phase、pending encounter/first-step snapshot 及 provenance，不重新推断或生成。
- No-regeneration evidence：restore 不调用 gameplay RNG、Mine Placement 或 Initial Board assembly；load 不写 snapshot/head、不 increment revision、不创建新 attempt；重建 Runtime 是新的 immutable authoritative object graph。
- Session/revision evidence：新 session 在旧 lease 活跃时只读且不能提交；lease expiry 后可 takeover，并从 restored revision 合法提交 `N -> N+1`；session identity 不进入 SaveDocument。
- Recovery/error evidence：backup 成功恢复保留 `recovered-from-backup`；malformed JSON、invalid v1、unsupported future version、unprovable corruption 与 no-save 保持不同结果，失败路径不 reset、不新建游戏、不覆盖旧数据。
- 自动证据：新增 Integration 9；Architecture PASS、TypeScript PASS、Unit 385/385、Integration 25/25、Total 410/410、production build 与 Playwright PASS；GitHub Actions Linux `Quality` run `33998506569` Success。
- 并发限制：localStorage 非原子 CAS limitation 不变；S2-06 仍只保证 best-effort single writer 与 stale-write rejection。
- 回滚方法：优先 revert `53cfc41fb7f6b38c94b31a7843c588d135456f4d` 并推送；状态收尾使用独立 documentation/status-only commit 回滚，禁止 `reset --hard`。

### Stage 2 / Task S2-08 — PASS

- 人工验收：产品经理于 2026-09-06 明确确认 `PASS`；接受 Restart/Retry new-attempt semantics、bounded generation policy、persist-before-publish 与并发失败边界。
- implementation stable point：commit `356fc477af8fed7b608c21e9c29a1dafb0aab095`。
- API/phase：`restartCurrentAttempt` 仅允许 active/pending；`retryFailedAttempt` 仅允许 failed，active/pending/won 均拒绝。Refresh/reopen 继续是 same attempt，Restart/Retry 才是显式 new attempt。
- Successful new attempt：same level/config/obstacles，new runId，revision N+1，实际 Mine set 必须不同；新 Run 为 waiting、未走步、active，且无上一 attempt 的 explored/Flag/Revealed Mine/pending facts。
- Generation：systems/policy 执行 uint32 seed progression，复用 Stage 1 frozen RNG/placement；逐次比较实际 Mine set。默认 bounded budget 4096；唯一布局与搜索耗尽均结构化失败且不 commit。4096 budget 不保证在所有理论可替代 configuration 中找到 alternate，但保证绝不接受相同布局。
- Persist-before-publish/concurrency：generation、runId、revision、ownership 或 storage 任一步失败时旧内存和旧 persisted snapshot 保持，结果不可 publish；stale tab 不能覆盖新 attempt。成功后 S2-07 reopen 只恢复新 runId、Board、revision。
- Mutation evidence：临时绕过 previous-layout rejection 后 deterministic collision test FAIL；恢复 production 后 PASS，临时 mutation 未提交。
- 自动证据：Architecture PASS、TypeScript PASS、Unit 385/385、Integration 34/34、Total 419/419、production build 与 Playwright PASS；GitHub Actions Linux `Quality` run `34000030504` Success。
- Future boundary：attempt-local rewards、Lucky/run-local facts、item usage 与 assistance 后续接入同一 boundary；当前未新增 Reward/Item/Account 或 Stage 3/4 Save facts。
- 回滚方法：优先 revert `356fc477af8fed7b608c21e9c29a1dafb0aab095` 并推送；状态收尾使用独立 documentation/status-only commit 回滚，禁止 `reset --hard`。

### Stage 2 / Task S2-09 — PASS / STAGE 2 FREEZE GATE

- 人工验收：产品经理于 2026-09-06 明确确认 `PASS` 与 `READY FOR STAGE 2 FREEZE`。
- Freeze Candidate / implementation evidence：commit `c549ef847b8a85f0a143772c15228d9283dfa915`；production code changes `0`；新增 4 个 Stage 2 freeze integration tests。
- 自动证据：Architecture、TypeScript、production build、Playwright 全部 PASS；Unit 385/385、Integration 38/38、Total 423/423 PASS；GitHub Actions Linux `Quality` run `34001125054` Success。
- Recovery Test：PASS。仅依据 repository、控制文档、`PROJECT_STATUS`、tests 与 Git history，可以恢复 Stage 0/1/2 状态、Stage 2 authority chain、兼容合同、限制、未来 persistence obligations 与唯一 Next Action。
- Stage 2 frozen repository baseline：本次 Stage 2 Freeze closeout documentation/status-only commit；同时保留 `c549ef847b8a85f0a143772c15228d9283dfa915` 作为 S2-09 Freeze Candidate。

### Stage 2 Frozen Authority Chain

`Runtime authoritative state -> Save v1 DTO -> JSON serialization -> version dispatcher -> crash-safe A/B snapshot storage -> persistence coordinator -> writer lease + revision gate -> guarded commit -> committed persisted authority -> validation/reconstruction -> authoritative Runtime`

- 任何未来 persistence feature 必须接入该权威链，不得建立第二套 gameplay persistence authority、Save system 或绕过 validation/reconstruction 的恢复路径。

### Stage 2 Frozen Compatibility Contracts

- Runtime State 不等于 Serialized DTO；Save v1 保存完整 authoritative Board snapshot，Board row-major 顺序属于兼容合同。
- SaveDocument revision 属于 persisted authority：fresh save revision 固定为 `0`；已有 revision `N` 只允许提交 `N + 1`。
- `saveVersion`、`rngVersion` 与 `generationVersion` 彼此独立；Stage 1 deterministic RNG golden behavior、candidate ordering 与 generation compatibility 不得静默修改。
- crash-safe storage commit point 是 successful new-head write；post-commit backup maintenance 失败不撤销已经完成的 commit。
- revision 更高的裸 slot 不代表 authority；backup recovery 必须由可证明的 committed pointer 授权。
- storage recovery 与 payload semantic validation 是不同层；corrupt、invalid 或 unsupported persistence 不等于 no-save，且不得自动 reset、delete、overwrite 或生成新游戏。
- load/reopen 不执行 gameplay write、不递增 revision、不重新生成 Board；Refresh/reopen 是 same attempt。
- Restart/Retry 是 new attempt；成功结果必须保持同一 `levelId`，产生 new `runId`、实际不同 Mine layout 与 revision `N + 1`。
- 仅 seed 变化不能证明 Mine layout 变化；same Mine layout 永远不得接受。`no-alternative-mine-layout` 与 `generation-search-exhausted` 均为安全失败。
- new-attempt generation 使用 deterministic bounded search；任一 generation、identity、revision、ownership 或 storage failure 都必须保留旧 authority。
- persist-before-publish：只有 persistence commit 成功后的 candidate 才可成为 runtime/visual authority；失败结果不携带 publish-capable candidate。
- writer lease 是 persistence coordination metadata，不进入 SaveDocument；session identity 与 gameplay attempt identity、gameplay RNG 相互独立。
- localStorage lease 仅提供 best-effort coordination 与 stale-write rejection，不是 atomic CAS；第二次 ownership verification 只缩小 race window，不提供绝对 mutex。

### Stage 2 Frozen Limitations

- localStorage 没有 atomic CAS，也不提供 database-level mutual exclusion。
- 默认 4096 次 generation search budget 可能在理论存在 alternative layout 时安全耗尽；此时明确失败，不违反“新 attempt 雷图必须不同”的合同。
- Save v1 当前没有真实 migration history；未来 schema 演进必须显式处理 version compatibility 与 migration。
- Phaser production bundle 超过 Vite 500 KB warning threshold，继续仅作为 observation，不是 Stage 2 blocker。

### Future Persistence Obligations

- Stage 3/4 未来真实的 inventory、item consumption/per-run caps、Lucky、Revive、Detection、Airplane、rewards/reward claims、coins/account facts、Benben assistance、tutorial 与 skins 状态，必须扩展同一个 versioned persistence aggregate，不得建立第二套 Save system。
- 每次扩展必须作出明确 schema/version compatibility decision，继续执行 persist-before-publish 与 refresh exact restore，并正确区分 Restart/Retry 的 run-local facts 和 account-persistent facts。
- 涉及上述扩展时必须重新运行完整 Stage 2 persistence regression suite。

### Stage 2 Freeze Change Control

- 修改 Save v1 interpretation、persistence authority chain、A/B snapshot format、commit point、revision/lease ownership semantics、refresh/reopen、Restart/Retry、RNG/generation compatibility 或 corruption recovery policy，均属于 frozen-boundary change。
- 未来确需修改时，必须显式记录 reason、affected frozen contract、compatibility impact、migration/version requirement 与 regression plan；不得静默修改。

## 用户现在要做什么

把下面指令交给将在本机执行开发的 AI：

```text
请读取最新控制文档与冻结标签，确认 Stage 3 已完成正式冻结后，只提出 Stage 4 游戏循环的任务拆分供产品经理批准；不要编码，不要重新执行 Stage 0/1/2/3 已完成实现。
```

## 阶段看板

| Stage | 名称 | 状态 | 进入条件 |
|---|---|---|---|
| 0 | 工程骨架 | FROZEN / PASS（S0-01 至 S0-07） | 控制文档冻结 |
| 1 | 核心棋盘 | FROZEN / PASS（S1-01 至 S1-13） | Stage 0 PASS |
| 2 | State + Save | FROZEN / PASS（S2-01 至 S2-09） | Stage 1 FROZEN / PASS |
| 3 | 四大道具 | FROZEN CANDIDATE；已验证 annotated stage-3-frozen 标签成立后为 FROZEN / PASS | Stage 2 FROZEN / PASS |
| 4 | 关卡/奖励/商店/笨笨 | PLANNING ENTRY ONLY；implementation 未授权 | Stage 3 正式 FROZEN；Task 拆分需批准 |
| 5 | 表现层 | LOCKED | Stage 4 PASS |
| 6 | 皮肤框架/中英/移动端 | LOCKED | Stage 5 PASS |
| 7 | RC/约 20 关/部署 | LOCKED | Stage 6 PASS |

## 已知未决

- Windows 10 不在 Playwright 当前官方原生支持矩阵内；本地测试已实测可用，但正式 E2E 结果以 GitHub Actions Linux 为准。
- Phaser 3 基线 bundle 当前超过 Vite 500 KB chunk 提示阈值；属于性能观察项，不在 Stage 0 无数据优化。
- Stage 2 的 S2-01 至 S2-09 已全部 PASS 并 FROZEN；不得重新执行。未来奖励、道具与援助的持久化扩展必须遵守 Stage 2 Frozen contracts，防止刷新/恢复复制，并不得建立第二套 persistence authority。
- localStorage 不提供 atomic CAS；S2-06 的 best-effort lease 与两次 ownership verification 不能消除所有精确并发 race。若未来实测不足，必须单独评估更强协调机制，不得把当前实现描述为强事务或绝对互斥。
- Reward farming/反自动化继续保留于 Future Requirements Registry；在出现真实经济破坏证据前不提前实现复杂防刷系统。
- 游戏正式名称与域名未定。
- 平衡参数（掉率、价格、援助阈值、障碍比例最终值）等待可玩原型数据。
- 美术、音乐与音效素材来源等待核心玩法验证后决定。
- 目标浏览器最低版本等待 Stage 0/6 兼容性审查。
- 流程改进候选：现行“同一 Bug 两次修复未通过即 STOP”可能需要区分“未知根因下的连续试错”与“根因已明确的直接连锁修复”；在正式审查并修改 Protocol 前继续严格遵守现行规则，本次不修改 Protocol。

## 状态更新规则

每次只能更新当前 Task。只有自动测试通过且产品经理人工验收 PASS，才可将任务改为 PASS。更新后必须写明：证据、稳定 commit/tag、回滚点、下一项唯一行动。
