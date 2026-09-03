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

## 当前阶段

**STAGE 1 IN PROGRESS**

Stage 0 工程骨架 PASS。Stage 1 的 S1-01、S1-02、S1-03 已通过自动门禁和产品经理人工验收；Stage 1 尚未整体 PASS。

## 唯一下一行动

**Stage 1 / Task S1-04 — 角色位置与普通移动目标合法性纯规则。**

目标：在 `core` 层建立最小权威角色位置表达，以及普通移动命令的集中、不可变目标合法性判断与结构化结果；统一落实 Flag、Obstacle、Revealed Mine 和棋盘边界对普通移动的影响。

边界：只冻结普通移动的权威位置、允许/拒绝条件、原地目标语义与不可变结构化结果；必须复用现有 Board/Coordinate/CellState/Flag 事实。不得实现输入/UI、动画、地雷生成、踩雷揭示或复活结算、数字显示、胜负、奖励、存档、道具或 Phaser 表现。开始实现前须依据冻结规格进一步拆清“移动到隐藏雷”的命令结果与状态结算边界；如存在产品歧义必须停止报告。完成物必须包含规则单元测试、本地完整 `npm run quality`、GitHub Actions Linux `Quality` PASS、稳定 commit、回滚与产品经理人工验收步骤；不得自动执行后续 Task。

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

## 用户现在要做什么

把下面指令交给将在本机执行开发的 AI：

```text
请读取 v1.0 五份控制文档、Architecture Baseline 和现有 core 模型。现在只执行 PROJECT_STATUS 的 Stage 1 / Task S1-04：角色位置与普通移动目标合法性纯规则。

只完成：
1) 复核 S1-03 稳定基线与干净工作区；
2) 建立最小权威角色位置表达与不可变普通移动领域命令；
3) 独立验证起点、目标坐标和目标 Cell 当前状态；
4) 统一处理越界、Obstacle、Flagged Cell、Revealed Mine 和原地目标；
5) 明确测试允许与拒绝结果、原状态不变及非目标事实不变；
6) 执行本地完整 `npm run quality`，提交并推送稳定 commit，再确认 GitHub Actions Linux `Quality` PASS。

不要实现 UI/输入、动画、地雷生成、踩雷揭示或复活结算、数字显示、胜负、奖励、存档、关卡、道具或 Phaser 表现。开始前先根据冻结规格明确移动到隐藏雷的结果与结算边界；如有歧义停止报告。按 AI Development Protocol 先提交单任务计划，再执行并输出测试、人工验收与回滚报告。完成后停下，等待我批准；不要执行后续 Task。
```

## 阶段看板

| Stage | 名称 | 状态 | 进入条件 |
|---|---|---|---|
| 0 | 工程骨架 | PASS（S0-01 至 S0-07） | 控制文档冻结 |
| 1 | 核心棋盘 | IN PROGRESS（S1-01/S1-02/S1-03 PASS；S1-04 NEXT） | Stage 0 PASS |
| 2 | State + Save | LOCKED | Stage 1 PASS |
| 3 | 四大道具 | LOCKED | Stage 2 PASS |
| 4 | 关卡/奖励/商店/笨笨 | LOCKED | Stage 3 PASS |
| 5 | 表现层 | LOCKED | Stage 4 PASS |
| 6 | 皮肤框架/中英/移动端 | LOCKED | Stage 5 PASS |
| 7 | RC/约 20 关/部署 | LOCKED | Stage 6 PASS |

## 已知未决

- Windows 10 不在 Playwright 当前官方原生支持矩阵内；本地测试已实测可用，但正式 E2E 结果以 GitHub Actions Linux 为准。
- Phaser 3 基线 bundle 当前超过 Vite 500 KB chunk 提示阈值；属于性能观察项，不在 Stage 0 无数据优化。
- 游戏正式名称与域名未定。
- 平衡参数（掉率、价格、援助阈值、障碍比例最终值）等待可玩原型数据。
- 美术、音乐与音效素材来源等待核心玩法验证后决定。
- 目标浏览器最低版本等待 Stage 0/6 兼容性审查。
- 流程改进候选：现行“同一 Bug 两次修复未通过即 STOP”可能需要区分“未知根因下的连续试错”与“根因已明确的直接连锁修复”；在正式审查并修改 Protocol 前继续严格遵守现行规则，本次不修改 Protocol。

## 状态更新规则

每次只能更新当前 Task。只有自动测试通过且产品经理人工验收 PASS，才可将任务改为 PASS。更新后必须写明：证据、稳定 commit/tag、回滚点、下一项唯一行动。
