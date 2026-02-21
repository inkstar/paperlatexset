# PLAN

## 更新规则
- 新增计划必须放在最前面。
- 每条新增计划标题使用 `[UTC+8 YYYY-MM-DD HH:mm]`。
- 废弃计划不删除，使用 `~~删除线~~` 保留历史。
- 每条计划包含：目标、改动文件、验收标准、风险与回滚。

## 计划记录

### [UTC+8 2026-02-22 04:36] Phase 1.9 smoke 启动策略稳态化
- 目标
  - 解决无 TTY 场景下 `smoke` 自动拉起后端不稳定的问题。
  - 将默认模式切回“检查已运行服务”，自动拉起改为显式开关。
- 改动文件
  - `scripts/smoke.sh`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 未启动后端时，`npm run smoke` 给出明确引导而不是长时间等待失败。
  - `SMOKE_AUTO_START=1 npm run smoke` 保持可选自动拉起路径。
- 风险与回滚
  - 风险：习惯旧行为的使用者需调整执行方式。
  - 回滚：将 `SMOKE_AUTO_START` 默认值改回 `1`。

### [UTC+8 2026-02-22 04:29] Phase 1.8 启动可观测性：MinIO 错误可执行提示
- 目标
  - 把 MinIO 启动失败日志从底层异常改为可执行提示，减少“服务卡住”误判。
  - 明确哪些接口在 MinIO 不可用时仍可继续使用。
- 改动文件
  - `server/src/index.ts`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 后端启动时 MinIO 不可达会输出 endpoint + 影响范围 + 下一步操作。
  - `README.md` 明确标注 MinIO 失败时的可用/不可用接口。
- 风险与回滚
  - 风险：简化日志后排查底层协议问题信息不足。
  - 回滚：在开发模式下附带原始错误栈，生产保持简化提示。

### [UTC+8 2026-02-22 04:25] Phase 1.7 M3 鉴权自检端点与 smoke 扩展
- 目标
  - 提供不依赖数据库的鉴权自检端点，快速确认 JWT 用户映射是否正常。
  - 将 M3 新入口纳入 smoke 检查，降低后续回归遗漏。
- 改动文件
  - `server/src/routes/authInfo.ts`
  - `server/src/index.ts`
  - `scripts/smoke.sh`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 可访问 `GET /api/v1/health` 与 `GET /api/v1/me`。
  - `npm run smoke` 输出包含 v1 health 与 v1 me PASS。
  - 现有日志与识别兼容接口检查不回归。
- 风险与回滚
  - 风险：后续关闭 dev fallback 时，smoke 依赖默认身份将失效。
  - 回滚：给 smoke 增加可选 Bearer token 参数，或在 CI 中保留 dev fallback 专用配置。

### [UTC+8 2026-02-22 04:14] Phase 1.6 M3 首步：Supabase JWT 与 API v1 入口
- 目标
  - 接入 Supabase Bearer JWT 校验路径，并保留可配置开发回退。
  - 提供 `/api/v1/questions`、`/api/v1/papers`、`/api/v1/stats` 入口，保持旧接口兼容。
- 改动文件
  - `server/src/config/env.ts`
  - `server/src/middleware/auth.ts`
  - `server/src/routes/stats.ts`
  - `server/src/index.ts`
  - `.env.server.example`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 设置 `SUPABASE_JWT_SECRET` 后可通过 Bearer token 解析用户身份与角色。
  - 当 `AUTH_DEV_FALLBACK=false` 且 token 缺失/无效时返回 401 与稳定错误码。
  - `/api/v1/questions`、`/api/v1/papers`、`/api/v1/stats` 可访问且不影响 `/api/*` 旧路径。
- 风险与回滚
  - 风险：不同 JWT claim 结构可能导致角色映射偏差。
  - 回滚：保留 dev fallback，角色映射失败默认 `teacher`，必要时恢复仅开发 header 模式。

### [UTC+8 2026-02-22 03:56] Phase 1.5 自动化 smoke 验证脚本
- 目标
  - 提供无 UI 依赖的一键主链路自检能力，降低回归成本。
  - 固化错误码与日志验收步骤，作为阶段发布前检查。
- 改动文件
  - `scripts/smoke.sh`
  - `package.json`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 执行 `npm run smoke` 可输出健康检查、错误码检查、日志检查结果。
  - 当后端未启动时脚本可尝试拉起后端并在结束后清理进程。
  - 检查点包含 `LATEX_REQUIRED`、`NO_FILES`、东八区日志文件写入。
- 风险与回滚
  - 风险：本机端口/环境差异导致脚本失败。
  - 回滚：脚本降级为“仅检查已运行服务”，去除自动拉起逻辑。

### [UTC+8 2026-02-22 02:29] Phase 1.4 主链路错误码与日志可追踪增强
- 目标
  - 完成阶段B/C：识别链路失败可诊断，日志具备请求追踪能力。
  - 保持兼容接口不变（`/api/analyze`、`/api/parse-latex`）。
- 改动文件
  - `services/geminiService.ts`
  - `App.tsx`
  - `server/src/routes/recognition.ts`
  - `server/src/utils/http.ts`
  - `server/src/middleware/requestLogger.ts`
  - `server/src/routes/clientEvents.ts`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 后端识别失败返回 `errorCode` 且保留 `error`。
  - 前端按错误码输出可执行提示（后端不可达/provider 未配置/provider 请求失败）。
  - 访问日志包含 `requestId`、`eventType`、`errorCode`，客户端事件日志包含关联 `requestId`。
- 风险与回滚
  - 风险：新增错误码字段影响旧端解析。
  - 回滚：保持 `error` 文本兼容，前端回退到旧兜底文案。

### [UTC+8 2026-02-22 02:27] 整体路线总览（M0-M4）与未来4小时执行窗
- 目标
  - 固化项目整体路线：M0 基线、M1 主链路、M2 体验质量、M3 鉴权平台化、M4 运维报表。
  - 锁定未来4小时连续执行窗口，避免中断在讨论态。
- 改动文件
  - `PLAN.md`
  - `README.md`
- 验收标准
  - `PLAN.md` 顶部包含 M0-M4 总览与分时执行窗（A/B/C 阶段）。
  - `README.md` 可直接定位计划入口和当前执行阶段。
  - 既有历史条目完整保留。
- 风险与回滚
  - 风险：计划粒度不足导致执行中反复决策。
  - 回滚：补充每阶段“接口变更、测试、回滚动作”到同一条计划中，不拆散历史。

### [UTC+8 2026-02-22 02:27] 未来4小时执行窗口（连续实施）
- 目标
  - 阶段A（0-1h）：收口当前改动并发布，清理 git 锁残留风险。
  - 阶段B（1-3h）：主链路错误可诊断（网络/后端/provider/识别失败）。
  - 阶段C（3-4h）：日志质量增强（requestId、errorCode、eventType）与去噪。
- 改动文件
  - `App.tsx`
  - `services/geminiService.ts`
  - `server/src/services/providerService.ts`
  - `server/src/routes/recognition.ts`
  - `server/src/middleware/requestLogger.ts`
  - `server/src/routes/clientEvents.ts`
  - `server/src/utils/http.ts`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `git status` 仅保留可预期未跟踪项（如 `package-lock.json`）。
  - 识别失败返回含稳定 `errorCode`，前端提示可执行。
  - 日志可回答“谁/何时/接口/结果/失败原因”。
- 风险与回滚
  - 风险：错误码改造影响旧逻辑或日志解析。
  - 回滚：保留兼容字段 `error`，新增字段可选，不删除旧日志字段。

### [UTC+8 2026-02-22 02:14] Phase 1.3 日志去重与启动稳定性增强
- 目标
  - 避免同一浏览器标签页重复写入 `page_open` 事件。
  - 后端端口冲突时输出明确错误信息并快速失败退出。
- 改动文件
  - `App.tsx`
  - `server/src/index.ts`
  - `PLAN.md`
- 验收标准
  - 同一标签页刷新前，`page_open` 日志最多写入一次。
  - 端口被占用时启动日志明确提示 `EADDRINUSE` 处理建议。
  - 正常情况下服务启动流程不回归。
- 风险与回滚
  - 风险：会话去重导致极端场景漏记一次打开事件。
  - 回滚：去掉 sessionStorage 去重逻辑，恢复每次挂载均上报。
- 执行清单（进行中）
  - [x] 同标签页 `page_open` 去重逻辑
  - [x] `EADDRINUSE` 明确提示
  - [ ] 提交并推送阶段改动

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
