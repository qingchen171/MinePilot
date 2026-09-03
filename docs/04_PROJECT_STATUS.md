# PROJECT_STATUS

**项目：MinePilot / Minesweeper Product**  
**状态更新时间：2026-09-04**  
**控制文档版本：v1.0 FROZEN**  
**正式游戏代码：尚未开始**

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

## 当前阶段

**STAGE 0 IN PROGRESS**

S0-01、S0-02、S0-03、S0-04 已 PASS。Stage 0 尚未整体 PASS，不能开始 Stage 1 核心玩法代码。

## 唯一下一行动

**Stage 0 / Task S0-05 — 本地统一质量门禁与安全执行守卫（不配置远程 CI，不实现游戏玩法）。**

目标：把安装、类型检查、单元测试、production build 和浏览器冒烟测试组织为可重复的一键本地门禁；以最小实现验证写盘命令的工作目录边界，使 Windows 本地检查可作为未来 Linux CI 的等价基础。

完成物：一个简单、跨平台、可测试的工作目录前置检查；统一的本地质量门禁命令；成功与错误目录两类验证；运行说明、稳定 commit 和恢复步骤，以及 S0-06 的唯一建议。S0-05 不实现任何游戏玩法，不创建远程 GitHub 仓库，不配置 GitHub Actions，不决定仓库公开/私有或预算，不进入 S0-06。

## 最近完成任务

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

## 用户现在要做什么

把下面指令交给将在本机执行开发的 AI：

```text
请读取 v1.0 五份控制文档。现在只执行 PROJECT_STATUS 的 Stage 0 / Task S0-05：本地统一质量门禁与安全执行守卫。

不要实现任何游戏玩法，不创建远程 GitHub 仓库，不配置 GitHub Actions，不决定仓库公开/私有或预算。只完成：
1) 复核 S0-04 稳定基线与当前工作区；
2) 用简单、跨平台方式实现写盘命令工作目录前置检查；
3) 将类型检查、单元测试、production build 和 Playwright 冒烟测试组织成统一本地门禁；
4) 验证在 `D:\eliogames` 正常通过，在错误目录安全拒绝且不写入；
5) 更新运行说明并建立本 Task 稳定 commit、恢复步骤；
6) 给出 S0-06 的唯一建议。

按 AI Development Protocol 先提交单任务计划，再执行并输出测试、人工验收与回滚报告。完成后停下，等待我批准；不要进入 S0-06。
```

## 阶段看板

| Stage | 名称 | 状态 | 进入条件 |
|---|---|---|---|
| 0 | 工程骨架 | IN PROGRESS（S0-01/S0-02/S0-03/S0-04 PASS；S0-05 NEXT） | 控制文档冻结 |
| 1 | 核心棋盘 | LOCKED | Stage 0 PASS |
| 2 | State + Save | LOCKED | Stage 1 PASS |
| 3 | 四大道具 | LOCKED | Stage 2 PASS |
| 4 | 关卡/奖励/商店/笨笨 | LOCKED | Stage 3 PASS |
| 5 | 表现层 | LOCKED | Stage 4 PASS |
| 6 | 皮肤框架/中英/移动端 | LOCKED | Stage 5 PASS |
| 7 | RC/约 20 关/部署 | LOCKED | Stage 6 PASS |

## 已知未决

- GitHub 仓库公开或私有：创建远程仓库前由产品经理决定。
- GitHub Actions 预算：启用云端 CI 前由产品经理确认；不得默认产生付费用量。
- Windows 10 不在 Playwright 当前官方原生支持矩阵内；本地测试已实测可用，但正式 E2E 结果以 GitHub Actions Linux 为准。
- Phaser 3 基线 bundle 当前超过 Vite 500 KB chunk 提示阈值；属于性能观察项，不在 Stage 0 无数据优化。
- 游戏正式名称与域名未定。
- 平衡参数（掉率、价格、援助阈值、障碍比例最终值）等待可玩原型数据。
- 美术、音乐与音效素材来源等待核心玩法验证后决定。
- 目标浏览器最低版本等待 Stage 0/6 兼容性审查。

## 状态更新规则

每次只能更新当前 Task。只有自动测试通过且产品经理人工验收 PASS，才可将任务改为 PASS。更新后必须写明：证据、稳定 commit/tag、回滚点、下一项唯一行动。
