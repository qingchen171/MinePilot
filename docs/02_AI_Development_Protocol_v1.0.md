# AI Development Protocol v1.0

**状态：FROZEN**  
**适用对象：所有参与 MinePilot/Minesweeper 开发的 AI**

## 1. 开始工作前

每次新会话必须依次读取：

1. `01_Minesweeper_MVP_Specification_v1.0.md`
2. `02_AI_Development_Protocol_v1.0.md`
3. `03_Product_Manager_Operation_Manual_v1.0.md`
4. `04_PROJECT_STATUS.md`
5. `05_Future_Requirements_Registry.md`

然后只执行 `PROJECT_STATUS` 中的“唯一下一行动”。如果文件互相冲突，停止编码并按权力顺序裁决：Specification（产品规则） > Development Protocol（工程规则） > Operation Manual（操作流程） > PROJECT_STATUS（当前进度） > Future Registry（未来候选）。仍无法裁决则报告阻塞，不自行猜测。

## 2. 单任务变更合同

一次只做一个可验收任务。开始修改前必须输出：

- 当前 Stage / Task ID。
- 任务目标与明确非目标。
- 将读取/修改的文件。
- 影响模块、状态与风险。
- 计划新增/更新的测试。
- 回滚点。

未经用户明确批准，不得把一个任务扩成重构、顺手优化或新功能。

## 3. 禁止行为

- 不得修改任务范围外文件，除非是完成测试/类型/文档同步的必要最小变更。
- 不得擅自新增功能、改产品规则、定平衡数字或改变 MVP 边界。
- 不得大范围重构来“顺便变漂亮”。
- 不得把核心规则写进 Phaser Scene、按钮回调、动画或渲染代码。
- 不得复制粘贴形成多套雷揭示、奖励结算、胜利判断或存档逻辑。
- 不得以“能运行”代替测试与人工验收。
- 不得在测试失败、类型检查失败或构建失败时宣称完成。
- 不得删除、覆盖用户文件或使用破坏性 Git 操作。
- 不得因 Bug 连续试错式改代码；第二次失败后必须停止并做根因分析。
- 不得开始 Stage 1 玩法代码，直到 Stage 0 全部门禁通过。

## 4. 架构约束

推荐边界：

```text
src/
  core/       # board, rules, state, save
  systems/    # movement, items, rewards, levels, inventory, shop, tutorial, assistance, skins
  scenes/     # boot, home, levelMap, game, shop, settings
  config/     # levels, items, themes, text
  ui/
  audio/
  assets/
tests/
  unit/
  integration/
  e2e/
```

这是边界意图，不要求 Stage 0 一次创建所有空目录。只在实际消费者出现时建立模块。

核心原则：纯规则函数优先；显式状态机；配置与逻辑分离；所有持久状态版本化；UI 只发送命令和显示结果；副作用集中；随机源可注入/可复现。

## 5. 状态与存档纪律

- 设计 `GameState`、`BoardState`、`AccountState`、`TutorialState`、`AssistanceState` 的清晰边界。
- 存档必须有 schema version、迁移策略、校验和安全回退。
- 每个资源结算采用“先写状态，再播表现”的顺序。
- 生成新棋盘与恢复旧棋盘必须走不同入口。
- 随机数必须可通过 seed 重放，便于复现 Bug。
- 刷新、崩溃恢复、失败重试、主动重开必须分别测试。

## 6. 测试门禁

每个 Task 至少包括：

- 规则单元测试：输入/输出、边界、非法状态。
- 状态集成测试：跨系统与持久化。
- 若涉及真实交互，增加 Playwright 场景。
- 修 Bug 必须先写能复现问题的失败测试；无法自动化时写清人工复现步骤。

不可跳过的核心回归：

- 障碍不藏雷、不参与胜利需求。
- 探雷不扫描中心格，不重复揭示公开雷。
- Lucky 优先于复活。
- 飞机覆盖旗帜并正确结算奖励。
- 奖励、道具、援助在 F5/重试后不复制。
- 刷新恢复同一棋盘，主动重开生成新棋盘。
- 胜利只由全部安全格实际探索触发。

## 7. Git 与恢复

- 开始任务前确认工作区状态并保护用户现有改动。
- 一个稳定任务一个 commit；提交前必须通过本任务门禁。
- 建议提交格式：`feat(scope): ...`、`fix(scope): ...`、`test(scope): ...`、`docs(scope): ...`。
- 稳定里程碑标签候选：`v0.1-core-board`、`v0.2-save-system`、`v0.3-items`、`v0.4-game-loop`、`v1.0-mvp`。
- 回滚优先使用可恢复、非破坏性方式；未经用户明确要求不得 `reset --hard` 或删除未提交工作。

## 8. Bug 协议

首次修复前：复现 -> 缩小范围 -> 找到根因 -> 建立测试 -> 最小修复 -> 全部相关回归。

若同一 Bug 两次修复未通过：立即 STOP。提交根因分析，至少包含事实、假设、证据、受影响状态、三个候选方案、推荐方案、恢复点；得到批准后才继续。

若 Bug 涉及存档丢失、资源复制、规则不可逆错误、构建/发布链中断，按 P0/P1 处理并禁止推进下一任务。

## 9. 完成报告格式

每次完成必须报告：

1. 做了什么。
2. 没做什么。
3. 修改文件。
4. 自动测试及结果。
5. 仍存风险/未知。
6. 产品经理人工验收步骤。
7. 回滚方法。
8. 是否满足 Task 门禁；若不满足，状态只能是 BLOCKED/IN PROGRESS。

“AI 说完成”不等于完成；只有产品经理执行人工验收并批准，Task 才能在 `PROJECT_STATUS` 标记 PASS。

## 10. 阶段门禁

- Stage 0 工程骨架：Windows 工具链、仓库、构建、类型、测试、Git、CI/本地等价检查、目录边界、决策记录全部可验证。
- Stage 1 核心棋盘：无美术依赖的基本玩法完整可玩。
- Stage 2 State + Save：F5/关闭/重开/迁移稳定。
- Stage 3 道具：Lucky、探雷、复活、飞机逐一实现、逐一验收。
- Stage 4 游戏循环：奖励、库存、商店、关卡、笨笨援助。
- Stage 5 表现层：角色、动画、音频与文案气质。
- Stage 6 框架与适配：皮肤架构、中英、移动端、测试主题。
- Stage 7 RC：约 20 关、完整回归、部署候选。

任何阶段未 PASS，不进入下一阶段。

