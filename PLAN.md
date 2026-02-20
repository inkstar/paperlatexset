# PLAN

## 更新规则
- 新增计划必须放在最前面。
- 每条新增计划标题使用 `[UTC+8 YYYY-MM-DD HH:mm]`。
- 废弃计划不删除，使用 `~~删除线~~` 保留历史。
- 每条计划包含：目标、改动文件、验收标准、风险与回滚。

## 计划记录

### [UTC+8 2026-02-21 06:14] Phase 1.2 运行日志与页面打开事件记录
- 目标
  - 在项目根目录固定维护 `logs/` 目录。
  - 每次页面打开时写入客户端事件日志；每次 API 请求写入访问日志。
- 改动文件
  - `.gitignore`
  - `logs/.gitkeep`
  - `server/src/middleware/requestLogger.ts`
  - `server/src/routes/clientEvents.ts`
  - `server/src/index.ts`
  - `App.tsx`
  - `README.md`
- 验收标准
  - 打开网页后，`logs/client-event-YYYY-MM-DD.log` 有新增记录。
  - 请求任意 API 后，`logs/access-YYYY-MM-DD.log` 有新增记录。
  - `preview` 场景下文档能解释 `ECONNREFUSED` 成因与处理方式。
- 风险与回滚
  - 风险：日志写入频率高时影响 I/O 性能。
  - 回滚：临时下线 `requestLogger` 中间件，仅保留客户端关键事件日志。

### [UTC+8 2026-02-21 04:20] Phase 1.1 网页端 LaTeX 渲染增强（KaTeX）
- 目标
  - 在右侧输出区新增“公式预览”能力，保留源码视图。
  - 对渲染失败公式提供错误兜底，确保不会影响整页展示。
- 改动文件
  - `package.json`
  - `components/LatexOutput.tsx`
  - `README.md`
- 验收标准
  - 可在网页端查看识别结果中的数学公式预览。
  - 渲染失败时展示原始公式文本与错误提示。
  - `.tex` 下载、复制、Overleaf 打开能力不回归。
- 风险与回滚
  - 风险：非标准 LaTeX 命令在 KaTeX 下不兼容。
  - 回滚：切换回源码视图为默认并保留预览开关，必要时移除 KaTeX 渲染层。

### [UTC+8 2026-02-21 04:20] Phase 0 项目基线与首发
- 目标
  - 完成仓库首发，固定主分支与基础文档，确保后续迭代有统一入口。
- 改动文件
  - `.git`（初始化与远端）
  - `README.md`
  - `PRD.md`
  - `PLAN.md`
- 验收标准
  - `main` 分支已推送到 `inkstar/paperlatexset`。
  - 文档中能定位产品目标与实施节奏。
- 风险与回滚
  - 风险：推送链路被本地凭据或网络策略阻塞。
  - 回滚：切换 SSH over 443 并保持本地提交可追溯。

### [UTC+8 2026-02-21 03:42] ~~Phase 2 Node API 与 PostgreSQL 模型骨架~~
- 原因
  - 已合并进当前分阶段计划，先保证主流程稳定再推进 API v1 与模型升级。

### [UTC+8 2026-02-21 03:15] ~~Phase 1 组卷核心能力落地~~
- 原因
  - 已并入新计划并扩展为“可运行基线 + 体验增强”的连续迭代。

### [UTC+8 2026-02-21 03:15] ~~Phase 2 多用户与数据库方案确认~~
- 原因
  - 已纳入后续“鉴权与 API v1”阶段，不再单列。

### [UTC+8 2026-02-21 03:15] 历史变更记录
- ~~直接在当前前端仓库立刻执行 Prisma 迁移（`prisma generate`/`prisma migrate`）~~
- 原因
  - 先稳定工程边界和阶段目标，再执行迁移更可控。
