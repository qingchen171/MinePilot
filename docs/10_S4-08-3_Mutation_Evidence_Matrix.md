# S4-08.3 Mutation Evidence Matrix

状态：S4-08.3 实施期证据合同；不宣告 Task PASS，不启用生产 v3 writer。

## 来源与解释

本矩阵只展开 `04_PROJECT_STATUS.md` 中 **S4-08.3 Design Review — PASS / CLOSED** 的 authority、identity、determinism、phase、Reward、Item、Benben、legacy 与 implementation gate 条款；测试可追溯到 `tests/integration/stage4-dormant-mutation.test.ts`（下称 `dormant-mutation`）及注明的既有测试。它不是新的产品规则或按数量补出的 43 项清单。此前 status 中的“A–AQ”没有逐项定义，仓库和 Git 历史均无法恢复其对应项；本文件以已明确冻结的错误类别代替这个不可审计的标签。

“已击杀”表示曾临时注入该类错误、相应定向测试实际 FAIL、随后恢复并核对源码哈希；“测试已通过／未单独注入”表示当前测试证明正向或拒绝语义，但不声称做过该项 mutation experiment。独立 Reviewer 必须据此判断门禁，不能把后一种状态写成已击杀。临时 mutation 不得进入提交。

| Mutation ID | 原始合同（均为 PROJECT_STATUS §S4-08.3） | 错误修改 | 应失败测试 | 捕获测试名称 | 当前状态 |
| --- | --- | --- | --- | --- | --- |
| MUT-01 | authority：commit 成功后才返回可发布 Runtime | 忽略 commit rejection、提前返回 committed | 16 类提交失败均须 FAIL | `dormant-mutation`: `${kind} commit rejection preserves old persisted authority and retry uses the same candidate` | 已击杀：16/16 FAIL；恢复哈希一致 |
| MUT-02 | Reward/aggregate validate → mapper → commit | Reward 校验失败仍继续 commit | 溢出路径须 FAIL | `Reward coin overflow rejects whole Airplane transition before commit` | 已击杀：定向 FAIL；已恢复 |
| MUT-03 | ownership 失败不提交、不发布 | 提交 seam 忽略已变更 lease | ownership-loss 用例须 FAIL | `lease loss after composition rejects commit without publish, then retry rereads authority` | 已击杀：定向 FAIL；仅证明 dormant seam，不声称 Stage2 第二次 ownership read |
| MUT-04 | expectedRevision 必须匹配 committed revision | 跳过 revision gate | stale revision 路径须 FAIL | `waiting Detection is a zero-write rejection and revision/runId gates precede composition` | 测试已通过；未单独注入 |
| MUT-05 | expectedRunId 必须 exact-match committed Attempt | 跳过 runId gate | stale runId 路径须 FAIL | `waiting Detection is a zero-write rejection and revision/runId gates precede composition` | 测试已通过；未单独注入 |
| MUT-06 | 同 intent 失败重试不重抽 seed | failed commit 后递增 generation seed | candidate equality 须 FAIL | `start commit rejection preserves old persisted authority and retry uses the same candidate` | 已击杀：定向 FAIL；已恢复 |
| MUT-07 | new Attempt 的 Board/Rewards 同 seed，重试不重新生成 Reward | failed commit 后改变 Reward 顺序 | candidate equality 须 FAIL | `start commit rejection preserves old persisted authority and retry uses the same candidate` | 已击杀：定向 FAIL；已恢复 |
| MUT-08 | Benben failure eligibility 由 exact levelId/runId 确定 | retry 改变 eligibility 结果 | failed candidate equality 须 FAIL | `third settled failure derives Benben eligibility once; same failed intent retries deterministically` | 测试已通过；未单独注入 |
| MUT-09 | Claim 卡由 exact Attempt 派生，同 intent 稳定 | failed Claim commit 后改变卡种 | candidate equality 须 FAIL | `claim commit rejection preserves old persisted authority and retry uses the same candidate` | 已击杀：定向 FAIL；已恢复 |
| MUT-10 | waiting 可以首次普通移动 | waiting 一律拒绝 movement | 首步 Safe 用例须 FAIL | `ordinary Safe movement claims Reward and wins without a separate terminal write` | 已击杀：定向 FAIL；已恢复 |
| MUT-11 | waiting 可以 Abandon | waiting 一律拒绝 Abandon | waiting Abandon 用例须 FAIL | `distinguishes no-save from revision zero; waiting Flag, Abandon and stale run gate` | 测试已通过；未单独注入 |
| MUT-12 | Replay/Next/dismiss 只按合法 terminal phase 运行 | active 可替换或 dismiss | phase 拒绝用例须 FAIL | `active Attempt rejects terminal replacement and Claim without entitlement without writing` | 测试已通过；未单独注入 |
| MUT-13 | account-only 重玩走 Start，不建 Replay 分支 | account-only Replay 尝试独立构造 | account-only 用例须 FAIL | `account-only replay is not a separate authority path; Start is the only new-attempt entry` | 已击杀：定向 FAIL；已恢复 |
| MUT-14 | newly explored Safe 的 Reward 先于 terminal settlement | 最后 Safe 先 terminal，漏发 Reward | last-Safe 用例须 FAIL | `pays last Safe Reward before terminal settlement in waiting Airplane and preserves Account inventory arithmetic` | 测试已通过；另以 MUT-02 击杀绕过 Reward 拒绝；未单独注入顺序 mutation |
| MUT-15 | 已探索 Safe revisit 不重复领取 Reward | revisit 再次 claim 同一 Reward | revisit 用例须 FAIL | `revisiting an explored Safe moves character without paying its Reward twice` | 测试已通过；未单独注入 |
| MUT-16 | Refresh 只恢复完整 Board/Rewards，不重新生成 | load 时生成新的 Reward 或 gameplay-write | refresh 用例须 FAIL | `refresh reads the same persisted Reward facts without commit or generation` | 测试已通过；未修改冻结的 reader 做 mutation |
| MUT-17 | Lucky 用 encounter 的 first-step fact，不猜 position/hasTakenStep | 用 `hasTakenStep` 取代 encounter fact | first/later Mine 用例须 FAIL | `first Mine atomically Lucky-survives; later Mine stays pending and explicit failure settles` | 测试已通过；未单独注入 |
| MUT-18 | later-step Mine 不消耗 Lucky，不自动 Failure | 对 later Mine 也触发 Lucky | later Mine 用例须 FAIL | `first Mine atomically Lucky-survives; later Mine stays pending and explicit failure settles` | 测试已通过；未单独注入 |
| MUT-19 | matching unconsumed temporary Item 优先 Account | Lucky 忽略临时卡而扣永久库存 | temporary Lucky 用例须 FAIL | `temporary Lucky is consumed before permanent inventory and terminal clears the card` | 已击杀：定向 FAIL；已恢复；Detection/Revive/Airplane 正向用例亦通过 |
| MUT-20 | first-step Lucky 优先于 Revive | Revive 在 Lucky 有效时直接成功 | priority 用例须 FAIL | `Revive cannot bypass Lucky priority on a restored first-step pending encounter` | 测试已通过；未修改冻结 Revive primitive 做 mutation |
| MUT-21 | eligibility 仅在失败 streak roll boundary 派生 | 每次失败都 reroll | 三次失败周期须 FAIL | `third settled failure derives Benben eligibility once; same failed intent retries deterministically` | 测试已通过；未单独注入 |
| MUT-22 | terminal 清理 temporary card | won 后保留卡 | terminal card 用例须 FAIL | `temporary Airplane wins without permanent consumption and expires at terminal` | 已击杀：定向 FAIL；已恢复 |
| MUT-23 | Claim 需要 exact same-level available authority | 无资格也发卡 | no-entitlement 用例须 FAIL | `active Attempt rejects terminal replacement and Claim without entitlement without writing` | 测试已通过；未单独注入 |
| MUT-24 | legacy-excluded 只由可信迁移产生且不可映射写 v3 | legacy 原样绕过 mapper 写 v3 | mapper/legacy 用例须 FAIL | `legacy failed v2 migration with null provenance can Retry using stable base seed, not fake old seed`; `never treats direct committed v3 legacy as trusted from head/head-backup` | 测试已通过；未修改冻结 mapper 做 mutation；合法命令必须先 REMOVE/REPLACE legacy |
| MUT-25 | legacy 不 retro-complete，Replay/Next 要独立 Account 权限 | 仅凭 legacy won 伪造 completion/entitlement | legacy 无权限用例须 FAIL | `trusted legacy won never gains Replay or Next entitlement from the terminal phase alone` | 已击杀 Replay entitlement bypass；正向“legacy 且独立完成权限”不能由当前合法持久化路径构造，不伪造 fixture |
| MUT-26 | null provenance 是合法历史事实，不单独禁止 Retry | 因 provenance=null 拒绝 failed Retry | legacy Retry 用例须 FAIL | `legacy failed v2 migration with null provenance can Retry using stable base seed, not fake old seed` | 已击杀：定向 FAIL；已恢复；Restart 正向用例亦通过 |

## 额外明确错误类别（不增加产品规则）

`PROJECT_STATUS` 同节还明确列出 waiting Airplane/Flag/Claim 过严、seed 与 Mine set 混淆、account-only Replay、legacy 无权限 Replay/Next、当前末关硬编码等错误。对应捕获测试分别为：`waiting Airplane preserves step and can win; terminal Next and Replay follow committed Account`、`distinguishes no-save from revision zero; waiting Flag, Abandon and stale run gate`、`Benben Claim is waiting-only, deterministic and turns available into a temporary card`、`Restart skips a changed seed that collides with the previous actual Mine set`、MUT-13、MUT-25、`Next is catalog-derived and unavailable after the actual final level`。这些九类临时 mutation 已逐项使定向测试 FAIL，随后恢复，源码哈希相同。

完整流程还由 `waiting Airplane can remain active and Claim Benben without taking a step` 证明非终局 Airplane 后仍可 Claim；`historical level absent from current catalog restores and dismisses, but cannot be replaced` 证明缺 catalog 的旧 Attempt 可恢复、终局可 dismiss，而 Restart/Retry/Replay/Next 不会以缺失关卡配置创建替代 Attempt。后者的 Replay 在可信 v2 legacy 状态下先受独立 completion entitlement 拦截；不伪造 entitlement 来强行到达 catalog 分支。这两项为正向/拒绝测试证据，不宣称额外做过 mutation 注入。

## 不可伪造的证据边界

- 当前 dormant commit seam 的 ownership-loss 测试只证明候选构造后、测试提交前失去 ownership 会被拒绝；真实 Stage2 第二次 ownership verification 的 production 绑定属于 S4-08.4。
- v1/v2→v3 migration 不产生 `completedLevelIds`，direct v3 不接受 `legacy-excluded`，mapper 也拒写它。因此“legacy won 且已有独立 Account completion”的正向持久化 fixture 当前不可达；不为满足表格制造非法 authority。
- 本矩阵中的“测试已通过／未单独注入”不得被改写成 mutation 已击杀。Reviewer 如要求逐项实际注入，应保留 BLOCKED，并明确待补项；不得回填虚构的 A–AQ。
