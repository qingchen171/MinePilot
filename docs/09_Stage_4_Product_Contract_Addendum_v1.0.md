# Stage 4 Product Contract Addendum v1.0

**状态：PRODUCT CONTRACT FROZEN — Elio 已批准 P1–P4；implementation 未授权**

**Task：S4-01B；批准日期：2026-09-10**

**审计起点：063ae81c9d49306f69d5d728ba4fcb03ea9687cc（annotated stage-3-frozen）**

## 1. Authority / change control

本文件是 Specification v1.0 §§5–9 的正式、经产品经理批准的 Stage 4 补充合同，不改写冻结规格原文。仅以下明确补充项以本合同为准；其余 Specification、Stage 0–3 frozen contracts、Development Protocol 继续有效。读取 Stage 4 Task 时必须随 Specification 阅读本文件。S4-01 Architecture Review、S4-01A Product Contract Review 已完成，P1–P4 已批准；这不是玩法、Save v3 或 Benben 已实现的声明。

- Reason：消除关卡解锁、援助寿命/使用、离局以及新经济事实的产品歧义，使后续设计可从仓库恢复。
- Affected contracts：Specification §§5–9 的补充解释；未来 Account/attempt 与 Save v3 扩展方向。Board/Cell、Item、RNG、Save v1/v2 解释及 Stage 2 persistence authority 不变。
- Compatibility/version：未来新增经济事实使用显式 Save v3，不静默扩写 v2；迁移要求见 §6。当前不实现 schema 或字段。
- Regression plan：未来实现必须证明解锁资格、一次性领取/援助、terminal settlement 幂等、失败原子性、read-only migration、exact restore、Restart/Retry 及旧请求拒绝，并回归 Stage 1–3。当前仅文档变更，执行完整 quality、独立 Reviewer、PR/Linux/main gate 与 Recovery Test。
- Recovery：本 closeout 经 PR 合并的文档提交可独立 revert；不移动 frozen tags，不回滚或重解释既有存档。

## 2. P1 — Level Unlock

- 第一关默认开放；完成一关后开放 catalog 中的下一关；末关没有 Next Level。
- completed facts 永久保留；已完成关允许 Replay，Replay 不撤销 progression。
- unlocked 从 catalog + completedLevelIds 推导，不同时保存 highestUnlocked 与 completed 两套真值。
- 权威 start-level command 必须验证进入资格，不能只靠 UI。
- catalog 使用稳定关卡身份；重排/删除不能作为无兼容影响的普通调整。后续设计必须处理其对既有完成/解锁的影响，不靠重复保存 unlocked 掩盖问题。

## 3. P2 — Benben Lifetime

- 援助绑定具体 levelId；同关连续最终失败达到配置阈值后获得一次 entitlement。本轮不规定阈值数值。
- pending、Lucky 成功救济、Revive 成功救济、Restart、abandon 均不算失败。
- 获得 entitlement 后暂不使用不会丢失；不跨关；Refresh/Retry/Restart 不复制。
- 完成该关清零 failure streak，但不撤销已经获得而未使用的 entitlement。
- Benben 成功使用后该 level 永久 used；同一 level 永久最多成功使用一次，Replay 不生成第二份。
- 这是原规格“一次本关临时探雷”“一旦领取并使用，本关不恢复第二份”的批准明确化，不替换为规则聊天助手。“临时”不意味着刷新/重开重新发放。

## 4. P3 — Benben Use

- 允许 active + ordinary on-board / revealed-mine-occupancy；禁止 waiting、pending、failed、won。
- 当前角色八邻域，center excluded、edge clipped；真实 Mine truth 仅用于合法目标选择，最终通过统一 revealMine 产生公开结果。
- 不消耗 Detection inventory，不占 Detection 每局 usage quota。
- 无可新揭示 Hidden Mine：不消耗 entitlement、不改变 used、不推进 Benben 随机生命周期。
- 禁止完整 Mine 列表、保存推荐坐标、地图缓存、Solver、Assistance framework。不得建立第二套 Board truth 或 Benben 保存链。
- 本轮不实现或提前冻结随机字段结构/算法；后续设计须明确复用与所有权，不能隐式污染既有 Detection/generation 随机合同。

## 5. P4 — Active Attempt / Abandon

- 最多一个 resumable/current attempt；返回菜单本身不结束 attempt。
- 进入其他关必须：current attempt -> abandon -> guarded persistence success -> start selected level。
- 开始前先执行所有可无副作用完成的 level existence、unlock eligibility、configuration validity 检查。
- abandon 不算 failed，不增加 Benben failure streak；合法获得的 Account 资产保留。
- 旧 Board、attempt rewards、run item usage 等 attempt facts 不转移；不保存多个 resumable runs。
- 禁止保留 active attempt -> Shop 补货 -> 返回原局继续。
- abandon 已 commit 而 start 失败：保留“当前无 attempt”的 committed authority，不复活旧 attempt。
- 同关 Restart/Retry 仍遵守既有新 attempt、实际不同雷图、revision N+1 合同；旧 attempt 不能配新 revision 覆盖新 authority。

## 6. Frozen technical decisions / migration

- MVP 没有独立 completion payout：Victory 记录 completion、处理真实地图 Reward，不额外凭空增加 Coins/Items；同一 Reward 不能重复结算。
- Stage 4 需要显式 Save v3；Save v1/v2 原解释保持冻结。Save v3 当前尚不存在。
- v2 -> v3 保留合法 Inventory、Board/Run/Item facts；Coins 从新经济起点开始、不追溯补发。不猜 completion、historical Reward、Benben streak/entitlement，不根据 terminal phase 追溯经济结算。
- migration load-only/read-only，不增加 revision、不修改 slot/head；第一次真实 mutation 才写当前 Save version。不得建立 migration framework。
- 唯一权威链继续为 GameState authority -> explicit DTO -> guarded persistence -> Stage 2 revision/lease/A-B authority -> committed -> publish；不存在第二条 persistence。

## 7. Frozen ownership direction — not implemented fields

| Ownership | Facts |
|---|---|
| Account | Inventory、future Coins、completedLevelIds、permanent one-time claims、per-level Benben persistent facts |
| Attempt | Board/Run、RunItemState、Reward placement/payload/claimed、terminal settlement fact |
| Derived | unlocked levels、eligibility queries、shop affordability、remaining quotas |

不得建立 separate LevelProgress aggregate、Reward store、Shop state、Benben save 或 second Account truth。保持 Runtime 与 DTO 分离。nullable attempt 与 Item API 兼容方向见 §9；S4-03 已批准的 persistent facts / Save 编码见 §10，当前均未实现。

## 8. Reward farming / known limitations

Replay 已完成关可获得新的正常随机 Reward；Retry/Restart 产生新 attempt rewards；Failure 保留合法取得的资产。因此部分领取 -> abandon/restart/replay -> 新随机 Reward 是已知 balance/farming risk，不是 duplicate-claim bug。见 Future Registry FR-014。

同一 Reward 在普通路径中重复领取仍必须阻止。不得借本收尾新增 cooldown、reward cap、diminishing return、daily limit 或 server anti-cheat。localStorage 非 atomic CAS、无绝对 mutex、本地篡改限制、4096 generation search budget 与 Phaser >500 KB observation 均保留。

## 9. S4-02 Design Contract — PASS / CLOSED (2026-09-10)

Elio 已人工验收批准 S4-02 Authoritative Aggregate & Lifecycle Foundation Design Review。本节仅记录 DESIGN CONTRACT APPROVED，不修改 P1–P4，不表示 Runtime 或 Save 已实施。

- Runtime authority：未来 GameState 始终含 Account，且仅含一个 `currentAttempt: AttemptState | null`。null 为真实 account-only，object 为完整 attempt；禁止 fake waiting Run、run/runItems 各自 nullable、多个 resumable attempts 或第二套 aggregate。
- Attempt ownership：runId、levelId、RunState、RunItemState 与必要 generation provenance 同属 attempt；Run/RunItemState 同生共存。revision 继续属于 persistence context，不进入 Account/Run/Attempt。
- Frozen-boundary impact：未来 aggregate shape 是显式 Stage 3 TypeScript API change，不是产品语义变化。Board/Cell truth、movement、occupancy、Lucky priority、Detection/Revive/Airplane、RNG、Refresh、Restart/Retry 行为保持不变。实施前须明确 API 迁移、兼容影响与回归；不是“只是重构所以不需 change control”。
- Item compatibility：未来新增 Account facts 后，库存消耗必须保留其余所有账户事实；禁止仅传 inventory 重建并覆盖完整 Account。不得以临时兼容 view 创建第二份长期 authority。
- Account-only：允许 Shop、level selection/start、Replay eligibility/progression query；禁止 movement、四 Item、current-cell gameplay query、Retry。Shop 最小 gate 为 `currentAttempt === null`。
- Lifecycle：返回菜单本身不修改 authority；active/pending abandon 经 guarded commit 成功后为 null。failed Retry 保留既有原子 replacement，不先清空再生成。won/failed 须完成适用的 terminal settlement 处理后才可 dismiss/Retry/Next；Replay 创建新 attempt，不将旧 won 改 active。
- Terminal settlement：Run.phase 是唯一 gameplay outcome truth；未来最小 settlement fact 仅表示经济/progression 处理情况，不复制 won/failed。旧 terminal migration 必须支持 legacy-excluded，防止追溯补经济、进度或 failure streak；该排除语义不是伪造已发生结算。确切编码留 S4-03。
- Save timing：不得开放临时 v3 writer。首次 authoritative v3 write 前先冻结已批准 persistent facts、validation、migration 与合法组合；不采用“一功能一版本”的机械策略，也不加入 reserved metadata/futureData 万能字段。
- Identity defense：未来公共 Stage 4 mutation 不信任任意旧 GameState 配新 revision。接口方向为 intent + expected revision + expected runId/null -> read committed authority -> validate identity -> build pure candidate -> existing guarded commit -> publish。不建立 Repository/Manager/Bus/framework。
- 尚未实现：nullable currentAttempt Runtime、AttemptState、expanded Account、Coins、completedLevelIds、Reward facts、terminal settlement、Benben persistent facts、Save v3、新 Stage 4 mutation boundary。Save v3 尚不可写，本轮不提前冻结 schema 或创建字段。
- Validation/recovery：未来回归须覆盖 Stage 3 Item 行为、Account 非库存字段保留、account-only、旧对象配新 revision、终局幂等/legacy exclusion、Refresh/Restart/Retry。此次 production/test/config/schema changes = 0；文档收尾经 local quality、独立 Reviewer、PR/Linux/main gate。可独立 revert closeout 文档提交，不移动 frozen tags。

## 10. S4-03 Persistent Facts & Save v3 Contract — PASS / CLOSED (2026-09-11)

**DESIGN CONTRACT APPROVED / SAVE V3 CONTRACT FROZEN**。Elio 已人工审计批准设计，并批准本 documentation/freeze closeout。Save v3 implementation = **NOT STARTED**；authoritative write = **DISABLED**；尚未接入 production persistence。以下类型和转换仅是合同，不是已实现能力。

### 10.1 Change control / authority

- 起始基线：`02ec62e0a643679ed68cbfb3d5675744b9034f9e`；Stage 3 annotated frozen tag 仍为 `063ae81c9d49306f69d5d728ba4fcb03ea9687cc`。Stage 0–3 tags 不移动。
- Reason：在新账户/attempt 事实进入 Runtime 前冻结完整持久化解释，避免 inventory-only 重建丢字段、临时 v3、历史结算伪造与旧对象配新 revision。
- Affected boundary：未来 Stage 3 aggregate/API shape 与新的 v3 显式 DTO；不是对 v1/v2 解释、Board/Cell、Item gameplay、RNG 或 Stage 2 authority 的静默变更。P1–P4 不变。
- 本节为唯一 S4-03 合同正文，PROJECT_STATUS 仅索引/摘要；不另建重复 authority，不改 frozen Specification。
- 兼容/迁移、验证/回归和首次 writer gate 见下文；未来实施逐 Task 经过 Design -> Attack -> Freeze -> Implementation -> Test -> Reverse Scan -> independent Reviewer -> PR/CI。
- 本收尾只改 authority/status 文档，production/tests/config/runtime/schema implementation = 0。可独立 revert 文档 PR；不能移动 tags 或通过降级覆盖存档。实际 review/quality/CI 证据由 closeout PR/Git history 检索，不预称通过。

### 10.2 Runtime ownership / persistent fact inventory

未来唯一 Runtime 为 `GameState { account, currentAttempt: AttemptState | null }`。Account 始终存在；null 为真实 account-only，非 null 为唯一完整 current attempt。禁止 fake waiting Run、多 resumable attempts、run/runItems 各自 nullable 或第二套 aggregate。revision 属于 persistence context，不能进入 Account/Attempt/Run。

| Fact / unique owner | Approved consumer / reason to persist | Migration default | Invariant |
|---|---|---|---|
| Account.inventory | 四 Item、Reward、Shop；资产跨局保留 | 保留真实库存 | 四种库存均 nonnegative safe integer |
| Account.coins | Reward、Shop；资产跨局保留 | 0，新经济起点，不补发 | nonnegative safe integer |
| Account.completedLevelIds | P1 解锁、Replay | []，不猜历史 | stable IDs unique |
| Account.oneTimeClaimIds | 首次固定奖励防重复 | []，不猜领取 | stable IDs unique |
| Account.benbenByLevel | P2/P3 按关永久援助资格 | []，无历史 | levelId unique，canonical status/streak |
| Attempt.runId / levelId | 命令身份、同局恢复、新局替换 | 原值 | stable nonempty IDs |
| Attempt.generationProvenance | 既有 generation/Restart/Retry 兼容 | 原值；缺失为 null | seed uint32，version IDs 合法 |
| Attempt.run | Board、position、phase、encounter、first-step | 原样映射 | 复用唯一 Board/Run validators |
| Attempt.runItems | 四 Item 额度、Detection 生命周期 | 原值，包括 null seed | 既有额度/seed invariant |
| Attempt.rewards | 开局固定隐藏奖励及原子领取 | []，不补历史 Reward | 唯一 Safe coordinate、payload、claimed |
| Attempt.terminalDisposition | terminal 处理一次或 legacy exclusion | 按 phase，见迁移表 | 不复制 outcome |

所有事实在 Refresh/reopen 精确保持。Restart/Retry、Next Level、Replay 保留 Account，整体重建 Attempt；同关 Restart/Retry 保留既有不同雷图、新 runId、N+1。abandon 成功后只清 currentAttempt；返回菜单不改变 authority。Run 与 RunItemState 同生共存；run 内 Board/position/phase/encounter 不在 Attempt 再复制。

unlocked levels、affordability、remaining item quotas、Benben eligibility queries 为 derived，不持久化。不增加 best score、purchase/transaction/gameplay/recommendation/multiple-run history、UI tutorial progress、animation state、generic metadata、futureData、extension bag。

### 10.3 Account contract

inventory 和 coins 的每次运算均检查 safe integer/非负；overflow 整笔拒绝，不 clamp、不部分结算。completed/claim IDs 与 Benben level records 不得重复，不静默去重。

stable ID 是非空字符串，沿用既有非空验证含义并保持原值，不通过 trim/改名修复。未知但结构合法的历史 levelId/claim ID 必须保留；catalog 缺失不等于存档结构损坏，不能删除事实。依赖未知/已删除内容的 start/generation/eligibility 必须安全拒绝，不凭空解锁或补历史；catalog 重排/删除需独立兼容评估。

未来 Item 库存更新必须保留 coins、completedLevelIds、oneTimeClaimIds、benbenByLevel。批准小型纯 immutable primitive（如 `replaceInventory(account, inventory)`）加完整 Account 验证；禁止只用 inventory 重建整个扩展 Account，也禁止 AccountManager、patch/deep-merge engine。当前 inventory-only 构造方式尚未在本 Task 修改。

### 10.4 Benben canonical persisted model / deterministic selection

每 level 一条 `{ levelId, failureStreak, status }`，status 仅 `unavailable | available | used`。缺失记录表示无已记录失败/资格，不伪造 history。

- unavailable：failureStreak 为 nonnegative safe integer；**只有此状态继续累计最终 Failure**。达到配置阈值时同次转换为 available，且 failureStreak = 0。
- available：failureStreak **必须为 0**；entitlement 已存在，后续失败不再累计。
- used：failureStreak **必须为 0**；永久 used，后续 Failure/Replay 不得重新发 entitlement。
- 完成该关：streak = 0；available/used 保持。Retry/Restart/abandon/pending/Lucky success/Revive success 不增加 streak。
- load 不根据当前阈值撤销或自动生成 entitlement；canonical 验证不猜过去阈值。旧存档迁移不制造 Benben history。
- 没有独立领取券状态：成功揭雷与 available -> used 同 candidate/commit；暂不使用保留 available。不存完整失败历史、地图缓存、推荐位置、对话。
- 仅 active + on-board/occupancy；统一八邻域排除中心、边缘裁剪，Hidden Mine only；优先未插旗，否则已插旗；每组取 **deterministic row-major 第一个**，通过统一 revealMine。
- 不新增 persisted RNG/seed/version；不消费 Mine RNG、不读取或推进 Detection seed。不把确定性顺序宣称为随机。
- 无目标或 persistence failure：Board/entitlement/used 不变；不扣 Detection 库存、不占 Detection usage。

### 10.5 Reward facts / RNG isolation

- Reward 不进入 Cell。每 attempt 每 coordinate 最多一条；identity 为 `runId + coordinate`，无 rewardId。
- 字段仅 coordinate、payload、claimed、`oneTimeClaimId: string | null`。null 为普通奖励；非 null 连接 Account 永久一次性领取事实，不是扩展袋。
- payload 为 coins + positive safe integer amount，或 item（lucky/detection/airplane/revive）+ positive safe integer quantity。
- coordinate/payload 在 attempt creation 时固定；Refresh 不重抽、不按 catalog/balance 变化重新解释。无 safe/mine/explored 副本，合法性查询同一 Board。
- Reward generation 从实际采用的 generation seed 经固定 domain separation 派生独立 RandomSource 实例，不消费 Mine RandomSource，不改 Stage 1 调用顺序或 golden coordinates。常量/确定性向量留 Reward generation implementation Task 冻结。
- 最终 coordinate + payload 已保存，因此 v3 不保存 reward seed、RNG internal state 或 RNG version。既有 provenance 字段的旧含义不变；缺失 provenance 不补 seed、不生成历史 Reward。

### 10.6 Terminal / legacy contract

Run.phase 是唯一 gameplay outcome。terminalDisposition 仅表示 Stage 4 账户/progression 是否处理，不复制 won/failed。

| Run phase / source | Required disposition |
|---|---|
| active / pending | not-applicable |
| 新 Stage 4 won / failed | settled |
| 旧 v1/v2 migrated won / failed | legacy-excluded |

无正常 committed won/failed + unsettled。新终局在同一 candidate 中完成 Run outcome + 适用 Reward settlement + Account/progression/failure-streak effect + settled；无独立 completion payout。失败不得发布任何半完成 candidate。

legacy-excluded 是“不追溯 Stage 4 settlement”，不是已发奖励/completed/streak 的声明，也不是 pending。reopen 不补历史。legacy terminal 可菜单导航/dismiss；legacy failed Retry 仍受既有资格/生成检查；Replay/start 仍受 P1 资格检查，不能因旧 won 自动补 completed、解锁或改 active。新局不继承 disposition；旧非终局日后真实产生的新 outcome 与追溯旧终局不同。

### 10.7 Complete Save v3 DTO interpretation (contract only)

所有列出字段 required；只有显式 `| null` 可 null。所有对象/联合分支 strict unknown-field rejection，无 arbitrary object。以下记号不是 production TypeScript/validator：N = nonnegative safe integer；P = positive safe integer；U32 = integer 0..4294967295；ID = stable nonempty string。数组不得稀疏或含非法元素。

```text
SaveDocumentV3 {
  saveVersion: literal 3,
  revision: N,
  account: AccountDTO,
  currentAttempt: AttemptDTO | null
}
AccountDTO {
  inventory: { lucky: N, detection: N, airplane: N, revive: N },
  coins: N,
  completedLevelIds: ID[],
  oneTimeClaimIds: ID[],
  benbenByLevel: { levelId: ID, failureStreak: N,
                   status: unavailable | available | used }[]
}
AttemptDTO {
  runId: ID,
  levelId: ID,
  generationProvenance: { seed: U32, rngVersion: ID, generationVersion: ID } | null,
  run: RunDTO,
  runItems: { successfulDetectionUses: integer 0..2,
              successfulAirplaneUses: integer 0..1,
              successfulReviveUses: integer 0..1,
              detectionRandomSeed: U32 | null },
  rewards: RewardDTO[],
  terminalDisposition: not-applicable | settled | legacy-excluded
}
CoordinateDTO { x: N, y: N }
BoardDTO {
  dimensions: { width: P, height: P },
  cells: { terrain: playable | obstacle, containsMine: boolean,
           explored: boolean, mineRevealed: boolean, flagged: boolean }[]
}
RunDTO {
  board: BoardDTO,
  characterPosition:
    { kind: waiting }
    | { kind: on-board, coordinate: CoordinateDTO }
    | { kind: revealed-mine-occupancy, coordinate: CoordinateDTO },
  hasTakenStep: boolean,
  phase:
    { kind: active }
    | { kind: pending-mine-encounter, encounter: EncounterDTO }
    | { kind: failed, encounter: EncounterDTO }
    | { kind: won }
}
EncounterDTO { target: CoordinateDTO, occurredOnFirstStep: boolean }
RewardDTO {
  coordinate: CoordinateDTO,
  payload: { kind: coins, amount: P }
           | { kind: item, item: lucky | detection | airplane | revive, quantity: P },
  claimed: boolean,
  oneTimeClaimId: ID | null
}
```

Board cells 继续 row-major、精确 width * height 数量和现有 dimensions/Cell legality；这些不是第二套规则。NaN/Infinity/fractional/unsafe 数值拒绝。类型记号不能代替 runtime validation。

### 10.8 Strict cross-field validation / reconstruction

- 验证 Account 数值/ID unique/Benben level unique；available/used + 非零 streak 必须拒绝。
- Attempt 必须 null 或完整；Run/RunItem 同时存在，identity/provenance 合法。复用现有 Board validator、Run constructors/invariants、RunItem validation，不复制 legality。
- Reward 必须 inside Board 且位于 Safe；重复 coordinate、重复非 null oneTimeClaimId、非法 payload 拒绝。Reward 不复制底层 truth。
- committed Reward 的 claimed 与该 Safe explored 必须一致。已领取 oneTime Reward 必须有 Account claim；未领取但 Account 已有对应 claim 拒绝。Account 中不属于当前 attempt 的历史 claims 可保留。
- terminalDisposition 与 phase 按上表一致；新 settled won 必须记录该 level completed，当前该 level Benben streak 清零。won 不得留 unclaimed Safe Reward。
- ordinary on-board -> explored Safe；occupancy -> Revealed Mine 且已 step；pending/failed encounter -> 真实未插旗 Hidden Mine；first-step、won 等复用冻结不变量，不从位置重猜历史。
- 非法数据 reject，不 clamp、去重、auto repair、auto reward、auto completion。校验错误携带稳定 code/path，不塞 UX 文案。
- claimed 后资产可能已消费，不能凭余额反推领取历史；原子资产变化由 command/commit 测试证明，不为此造账本。legacy-excluded 的历史真实性也不是本地 JSON 能密码学证明的；正常构造/迁移入口与回归保障，不宣称防篡改。

### 10.9 Read-only migration / explicit mapping

| v2 input | v3 result |
|---|---|
| revision / inventory | 原值完整复制 |
| 新 Account facts | coins = 0；completedLevelIds/oneTimeClaimIds/benbenByLevel = [] |
| activeRun null | currentAttempt null，无假 Run/Board/RunItemState |
| activeRun object | 完整 Attempt；runId/levelId/Board/position/phase/encounter/hasTakenStep/RunItem usage/Detection seed 保留 |
| existing provenance / absent | 原值 / null，不伪造 seed |
| 历史 Reward | rewards = []，不生成/补发 |
| active / pending | not-applicable |
| won / failed | legacy-excluded |

唯一 v2 migration：strict validated v2 -> pure v3 DTO -> strict v3 validation/reconstruction。v1 必须 strict v1 -> existing pure v1→v2 -> strict validated v2 -> pure v2→v3 -> strict v3 -> reconstruction；无 shortcut、registry/graph/generic migration engine。v1→v2、v1/v2 schema/byte interpretation 保持冻结。

Migration 不调用 RNG、不增 revision、不写 storage/slot/head、不补 Reward/completion/assets/Benben history；load 是只读迁移，首次真实 mutation 且 writer gate 已完成后才提交 v3。保留 source version、migration issue 和 backup recovery provenance；invalid/corrupt/unsupported != no-save。

Runtime -> explicit mapper -> DTO -> JSON；load JSON -> version dispatch -> strict version DTO validation -> 必要 migration -> strict current validation -> constructors -> Runtime。禁止 JSON.stringify(GameState)、JSON.parse(...) as GameState/BoardState；arrays/coordinates/payload/Benben records 无 shared mutable aliases。revision 与 storage envelope 一致。

account-only 是完整合法 Save v3；未来支持 Shop/level selection/progression query/start-Replay eligibility，gameplay mutation/Retry/pending resolution 明确拒绝。无当前脚下数字，不伪造 waiting 局。

### 10.10 First writable gate / Stage 3 compatibility / identity

**CONTRACT FROZEN != WRITER ENABLED。本收尾后 authoritative v3 writes 仍 DISABLED。** 当前正式 Runtime/production saves 继续 v2；禁止临时 v3 writer，也禁止新增 Runtime 事实经 v2 丢字段保存。

最终接线 Task 原子切换 Runtime 与完整 v3 persistence。首次 authoritative v3 write 必须完成全部门禁：

1. 完整 DTO、strict structural/cross-field validation。
2. 纯 v2→v3 及既有 v1→v2→v3 路径。
3. Aggregate Runtime、mapper/reconstruction、account-only round-trip。
4. Stage 3 Item 保留完整 Account；Reward/terminal 合法状态无丢失/半保存。
5. 现有 guarded coordinator v3 接入；revision/lease/A-B regression；旧对象配新 revision 防线。
6. full quality、independent Reviewer PASS、Linux Quality Success，按 PR/main gate 验证。

可达转换必须满足本节的原子合法状态；不得用跳过验证/静默丢事实来通过 gate。若后续 Task 实施发现 gate 依赖未具备，停止报告，不提前开放 writer，也不越权实现后续玩法。完整解释在首次真实写入前冻结；写出真实 v3 后不得同号静默改义，真正新持久语义需显式 compatibility/version decision。

Stage 3 保持 Lucky first-step automatic priority、Detection target priority/usage 2/seed lifecycle、Revive pending-only/usage 1、Airplane clipped 3×3/usage 1、occupancy/movement/Victory、Refresh、Restart/Retry 和 Mine RNG golden。任何 inventory update 保留 coins/completed/claims/Benben；无 Item 专属 State/Manager/framework/新 persistence。

Stage 4 public mutation 仅以 intent + expectedRevision + expectedRunId/null -> read committed authority -> validate revision/attempt identity -> build candidate from current authority -> existing guarded commit -> publish after commit。不得接收 arbitrary old GameState + latest revision 覆盖 authority。revision gate 本身不证明 candidate 来源；fresh 0、existing N only N+1、second ownership verification 不变。此处仅接口原则，不实现 Repository/transaction engine/CommandBus。

### 10.11 Approved implementation order / tests / risks

| Task | Scope | Mandatory boundary |
|---|---|---|
| S4-04 | Save v3 DTO + strict structural/cross-field validation + pure v2→v3 migration | 不接 production writer、不切 Runtime；当前 runtime 继续工作、production saves 仍 v2 |
| S4-05 | Aggregate Runtime + AttemptState + Account expansion + mapper/reconstruction + Stage 3 compatibility pure changes | 不开放半成品 writer；不能让 main 权威事实失去无损持久化能力 |
| S4-06 | Runtime/persistence atomic switch；public mutation authority-source defense、coordinator v3 adaptation、authoritative writes、no-loss、old-version rejection | 必须先通过 §10.10 first writable gate，不得降级覆盖 |
| S4-07 | v3 lifecycle / compatibility integration gate | 真实 migration/mutation/reopen/失败原子性证据 |

之后按依赖批准 Level/Reward/Settlement/Shop/Benben 独立 tasks，不在本收尾执行。每个 Task 独立 review/PR/CI；先可独立验证的纯模块，最终原子接线，不能把 main 留成有损/不可用半成品。

未来测试必须覆盖：strict unknown fields/数值/unique、Benben canonical states、Reward Mine/Obstacle/duplicate/claimed 冲突、terminal/legacy 组合、无追溯结算、account-only 无 fake Run、migration 零写盘/零增 revision/无 alias/无 seed 伪造、四 Item 完整 Account 保留、Reward RNG 不改 Mine golden、Benben 不改 Detection seed、旧 runId 配新 revision 拒绝、storage/lease/revision failure 无 candidate、backup provenance、Refresh/Restart/Retry/abandon-start。关键 mutation sanity（未来临时且必须恢复）需证明禁用 exclusion/identity、注入 migration 写盘、inventory-only 丢字段或共享 RNG 会让对应测试失败。

保留限制：localStorage 无 atomic CAS/绝对 mutex、本地篡改不能彻底防止；4096 generation search 可安全耗尽；catalog 兼容需显式治理；farming 风险按 §8/FR-014，Phaser >500 KB 仍 observation。无 best score/history/metadata bags、第二套 Board/encounter truth 或 persistence。首次写 v3 后不能盲目回滚到 v2-only writer；旧版本不得把 unsupported v3 当 no-save 或用旧资产覆盖新数据。

## 11. 唯一后续入口 / Recovery checklist

**Stage 4 / S4-05 — Aggregate Runtime, AttemptState & Runtime↔DTO Foundation Design Review**

S4-02 CLOSED、S4-03 CONTRACT FROZEN、S4-04 PASS/CLOSED（implementation baseline `24724e527e030e49db3bbcca7919d281c74920ef`）。v3 DTO/strict validation/pure migration 已实现，production Runtime 尚未实现，authoritative writer DISABLED，CURRENT_SAVE_VERSION 仍为 2。当前仅 DESIGN REVIEW ONLY / IMPLEMENTATION NOT AUTHORIZED；§10.11 是依赖规划，不跳过 S4-05 的 Design → Attack → Freeze。本 closeout 停止，不执行 S4-05。

新 AI 仅从 AGENTS -> Specification + 本批准合同 -> Protocol -> PROJECT_STATUS -> Git history/tag，必须恢复：Stage 0–3 FROZEN、Stage 4 产品合同、S4-02 CLOSED、S4-03 CONTRACT FROZEN、S4-04 DTO-only CLOSED、未来 GameState/account-only、§10.2 exact facts、Benben canonical model/无 RNG、Reward/独立 RNG、terminal/legacy exclusion、v2 defaults/v1 chain、writer disabled/version 2/旧 Runtime、Stage 3 compatibility、identity/revision principle、S4-04 至 S4-07 依赖顺序及唯一 S4-05 Design Review 入口。Stable ID nonblank 检查不改变原值；legacy-excluded 后续可信 Runtime/load/writer 接线不得放宽普通 v3 验证，具体约束与 implementation evidence 见 PROJECT_STATUS S4-04。缺口只修 authority docs，不借恢复检查开始实施。本节只同步当前进度/入口，不改变 §9–10 frozen schema/authority 合同。
