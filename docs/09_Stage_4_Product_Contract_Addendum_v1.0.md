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

不得建立 separate LevelProgress aggregate、Reward store、Shop state、Benben save 或 second Account truth。保持 Runtime 与 DTO 分离。具体 nullable attempt、字段结构及 frozen Item API 兼容方案留给 S4-02 设计，不在本轮决定。

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

## 10. 唯一后续入口 / Recovery checklist

**Stage 4 / S4-03 — Persistent Facts & Save v3 Contract Design Review**

DESIGN ONLY / IMPLEMENTATION NOT AUTHORIZED。S4-02 已关闭，本次仅同步批准结论，不执行 S4-03 设计。

新 AI 从 AGENTS -> Specification + 本批准合同 -> Protocol -> PROJECT_STATUS -> Git history/tag，应能恢复 Stage 0–3 FROZEN、Stage 3 baseline、Stage 4 产品合同、S4-02 PASS、future account + nullable currentAttempt、无 fake Run、Stage 3 行为不变、settlement 不复制 outcome、Save v3 未实现且不可写，以及唯一 S4-03 设计入口。既有 P1–P4、迁移方向和 farming 风险继续有效。
