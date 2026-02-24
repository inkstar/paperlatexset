# PLAN

## 更新规则
- 新增计划必须放在最前面。
- 每条新增计划标题使用 `[UTC+8 YYYY-MM-DD HH:mm]`。
- 废弃计划不删除，使用 `~~删除线~~` 保留历史。
- 每条计划包含：目标、改动文件、验收标准、风险与回滚。

## 计划记录

### [UTC+8 2026-02-24 12:07] Phase 4.25 导出参数可配置化（留白/标题/行距）
- 目标
  - 为 LaTeX 导出增加可选格式参数，支持按场景调整页眉标题、题后留白与行距。
- 改动文件
  - `server/src/services/exportService.ts`
  - `server/src/routes/paperSets.ts`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `POST /api/papersets/:id/export-latex` 支持可选 body：`headerTitle/choiceGap/solutionGap/lineSpacing`。
  - 参数未传时保持默认：`choiceGap=2cm`、`solutionGap=6cm`、`lineSpacing=1.15`、标题为既有规则。
  - 参数校验安全：仅接受合法单位留白与可用行距区间。
- 风险与回滚
  - 风险：非法参数输入可能导致导出格式不符合预期。
  - 回滚：忽略无效参数并回退默认值，不中断导出。
- 发布状态
  - 已提交并推送（commit hash 见本阶段提交）。

### [UTC+8 2026-02-24 12:02] Phase 4.24 发布状态补全（Phase 4.22 / 4.23 hash）
- 目标
  - 补全近期阶段发布状态中的占位描述，统一为明确 commit hash。
- 改动文件
  - `PLAN.md`
- 验收标准
  - Phase 4.22 发布状态为 `d19a88e`。
  - Phase 4.23 发布状态为 `bb6b69e`。
  - `PLAN.md` 顶部保持新增条目在最前。
- 风险与回滚
  - 风险：后续如发生回滚，历史 hash 与线上版本可能短暂不一致。
  - 回滚：追加回滚说明，不改历史 hash。
- 发布状态
  - 已提交并推送（commit hash 见本阶段提交）。

### [UTC+8 2026-02-24 11:47] Phase 4.23 导出文件名对齐后端响应（支持中文）
- 目标
  - 前端导出下载名与后端 `Content-Disposition` 保持一致，避免固定 `paper.tex/docx` 覆盖语义文件名。
- 改动文件
  - `components/ComposerPage.tsx`
  - `PLAN.md`
- 验收标准
  - 导出时优先解析 `filename*`（UTF-8）并回退 `filename`。
  - 未提供响应头时仍使用 `paper.tex/docx` 兜底。
  - 中文文件名可正确下载并保留扩展名。
- 风险与回滚
  - 风险：极个别浏览器对 `Content-Disposition` 解析差异可能导致回退到默认名。
  - 回滚：保留 fallback，不阻断导出流程。
- 发布状态
  - 已提交并推送：`bb6b69e`（origin/main）。

### [UTC+8 2026-02-24 10:45] Phase 4.22 发布状态标准化（补全近期阶段 hash）
- 目标
  - 统一近期阶段发布状态格式，确保 `PLAN.md` 可直接映射到远端提交。
- 改动文件
  - `PLAN.md`
- 验收标准
  - Phase 4.18 ~ 4.21 发布状态全部写入明确 commit hash。
  - 保持计划条目历史不删除，仅追加标准化更新。
- 风险与回滚
  - 风险：若后续发生回滚，计划中的 hash 与当前部署版本可能短暂不一致。
  - 回滚：在相应阶段下追加“回滚记录”而非修改历史 hash。
- 发布状态
  - 已提交并推送：`d19a88e`（origin/main）。

### [UTC+8 2026-02-24 10:42] Phase 4.21 全局清空 Token 入口（不依赖错误态）
- 目标
  - 在头部导航提供常驻“清空Token”入口，避免用户必须进入错误场景或特定断点才能清理 Bearer。
- 改动文件
  - `App.tsx`
  - `PLAN.md`
- 验收标准
  - 顶部导航显示“清空Token”按钮，点击后清空本地 Bearer token。
  - 清理后给出明确提示，后续请求回退为开发角色鉴权。
  - 头部开发鉴权条中的“清除”按钮与该行为一致。
- 风险与回滚
  - 风险：误触可能导致当前 Bearer 鉴权失效。
  - 回滚：保留按钮但增加二次确认弹窗。
- 发布状态
  - 已提交并推送：`d23dcee`（origin/main）。

### [UTC+8 2026-02-24 10:32] Phase 4.20 导出格式回归脚本稳定化（默认静态 + 可选运行时）
- 目标
  - 解决本机 `tsx` 偶发挂起导致回归脚本不稳定的问题，保证默认检查可稳定执行。
- 改动文件
  - `scripts/smoke-export-format.sh`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `npm run smoke:export:format` 默认走静态源码检查并稳定返回 PASS/FAIL。
  - `SMOKE_EXPORT_RUNTIME=1` 时可选执行运行时检查。
  - README 说明默认模式与运行时模式差异。
- 风险与回滚
  - 风险：静态检查无法覆盖运行时拼接细节。
  - 回滚：在 CI 环境保留运行时模式作为补充，不移除默认静态检查。
- 发布状态
  - 已提交并推送：`899825d`（origin/main）。

### [UTC+8 2026-02-24 10:26] Phase 4.19 导出格式回归脚本（题型留白与标题规范）
- 目标
  - 为导出模板关键规范增加自动化回归，防止后续改动破坏题型留白和页眉页脚规则。
- 改动文件
  - `scripts/smoke-export-format.sh`
  - `package.json`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 新增 `npm run smoke:export:format`。
  - 脚本可检查默认日期标题、`choicegap/solutiongap`、`fancyhdr`、题型留白片段。
  - README 提供该脚本的用途与检查项说明。
- 风险与回滚
  - 风险：字符串断言方式对模板文本细节较敏感。
  - 回滚：将强匹配改为关键字段弱匹配，不移除脚本。
- 发布状态
  - 已提交并推送：`6e546d9`（origin/main）。

### [UTC+8 2026-02-24 10:20] Phase 4.18 计划可追溯性增强（发布状态补全 commit hash）
- 目标
  - 将近期阶段的“发布状态”从描述性文本升级为可点击追溯的明确 commit hash。
- 改动文件
  - `PLAN.md`
- 验收标准
  - Phase 4.12 ~ 4.17 条目均写入已推送 commit hash。
  - 计划文档无需额外查找即可定位对应远端代码版本。
- 风险与回滚
  - 风险：后续若发生强制回滚，历史 hash 与当前生产状态可能不一致。
  - 回滚：在对应阶段条目追加“回滚补充记录”，不修改历史 hash。
- 发布状态
  - 已提交并推送：`2ac8376`（origin/main）。

### [UTC+8 2026-02-24 10:17] Phase 4.17 规范自动检查脚本落地（提交前自检）
- 目标
  - 把执行规范从“文档约定”升级为“可执行检查”，降低漏更 PLAN 与提交命名不规范风险。
- 改动文件
  - `scripts/pre-push-check.sh`
  - `package.json`
  - `WORKFLOW.md`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 新增脚本可检查：`PLAN.md` 是否暂存、未跟踪文件白名单、提交信息模板。
  - `package.json` 提供 `workflow:check` 命令。
  - `WORKFLOW.md` 与 `README.md` 有对应使用说明。
- 风险与回滚
  - 风险：严格检查在特殊场景可能阻碍临时调试提交。
  - 回滚：通过环境变量放宽规则（如 `REQUIRE_PLAN_CHANGED=0`）。
- 发布状态
  - 已提交并推送：`58315a4`（origin/main）。

### [UTC+8 2026-02-24 10:06] Phase 4.16 Git 写操作防并发规范落地（三层防御 + 互斥脚本）
- 目标
  - 将 git 锁卡顿问题从“人工排障”升级为“流程与脚本自动治理”。
  - 固化三层防御：行为约束、锁检测自愈、系统级互斥。
- 改动文件
  - `WORKFLOW.md`
  - `scripts/git-write-guard.sh`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `WORKFLOW.md` 明确三层防御规范与串行写操作规则。
  - 存在可执行脚本 `scripts/git-write-guard.sh`，支持 `commit/push` 等 git 子命令互斥执行。
  - `README.md` 增加脚本使用示例，团队可直接复用。
- 风险与回滚
  - 风险：极端情况下锁目录残留可能导致等待超时。
  - 回滚：保留三层文档规范，脚本可回退为只做检测不做互斥。
- 发布状态
  - 已提交并推送：`2ad38cb`（origin/main）。

### [UTC+8 2026-02-24 10:00] Phase 4.15 全量筛选维度接口接入（知识点/来源/题型/年份）
- 目标
  - 将组卷页筛选项从“当前页派生”升级为“后端全量维度”，提升筛选准确性与可用性。
- 改动文件
  - `server/src/routes/questions.ts`
  - `components/ComposerPage.tsx`
  - `PLAN.md`
- 验收标准
  - 新增 `GET /api/questions/facets`，返回 `knowledgePoints/types/sources/years`。
  - 前端组卷页筛选输入优先使用 facets 数据源，不足时回退当前页数据。
  - 年份筛选新增 datalist 候选。
  - 保持现有 `/api/questions` 分页与筛选参数兼容。
- 风险与回滚
  - 风险：facets 接口在大数据量下查询成本上升。
  - 回滚：前端退回当前页派生筛选，保留接口但不启用。
- 发布状态
  - 已提交并推送：`d24678f`（origin/main）。

### [UTC+8 2026-02-24 09:54] Phase 4.14 题库编辑区增强（编辑即预览）
- 目标
  - 在题目编辑表格中提供 LaTeX 即时预览，降低人工校对成本。
- 改动文件
  - `components/QuestionTable.tsx`
  - `PLAN.md`
- 验收标准
  - 每行题干编辑框下方展示 `LaTeX 预览` 区域。
  - 输入题干后可实时看到公式渲染效果，不影响原有 `onUpdate` 编辑回调。
  - 知识点/来源/题号编辑逻辑保持不变。
- 风险与回滚
  - 风险：预览区域增加渲染开销，极大题量时可能影响滚动流畅度。
  - 回滚：保留 `MathText` 组件，按需改为“点击展开预览”模式。
- 发布状态
  - 已提交并推送：`b2a1331`（origin/main）。

### [UTC+8 2026-02-24 09:46] Phase 4.13 导出标题与留白规范对齐（日期默认标题 + 题型留白）
- 目标
  - 让导出页眉标题与正文标题使用同一默认规则（东八区当日日期试卷）。
  - 明确题后留白：选择/填空使用 `\\choicegap`，解答题使用 `\\solutiongap`。
- 改动文件
  - `server/src/services/exportService.ts`
  - `PLAN.md`
- 验收标准
  - 未传标题时，导出的页眉与 `\\section*` 默认显示 `YYYY年MM月DD日试卷`（东八区日期）。
  - `.tex` 导出中题目条目根据题型自动追加对应 `\\vspace{\\choicegap}` / `\\vspace{\\solutiongap}`。
  - 导出 Word 标题默认值与导出 LaTeX 保持一致。
- 风险与回滚
  - 风险：标题默认规则变化可能影响既有下游命名习惯。
  - 回滚：将 `resolvePaperTitle` 回退为“仅使用传入 title”逻辑。
- 发布状态
  - 已提交并推送：`a263508`（origin/main）。

### [UTC+8 2026-02-24 09:30] Phase 4.12 LaTeX 规范清洗统一（参考规则落地）
- 目标
  - 将识别/导入后的 LaTeX 清洗规则统一为单一实现，减少非法前缀、分数写法和小问换行不一致。
  - 前后端同时使用同一套规范，避免“前端修、后端脏”或“后端修、前端显示异常”。
- 改动文件
  - `shared/latexNormalizer.ts`
  - `services/geminiService.ts`
  - `server/src/routes/papers.ts`
  - `shared/recognitionConfig.ts`
  - `PLAN.md`
- 验收标准
  - `analyzeExam` 与 `parseLatexToQuestions` 统一走 `normalizeLatexContent`。
  - 后端 `papers/:id/recognize` 入库前统一走 `normalizeLatexContent`。
  - 清洗规则覆盖：控制字符清理、`/b`/`\\b` 前缀剔除、`//` 与 `\\parallel` 规范化、简单 `a/b` 转 `\\frac{a}{b}`、填空占位规范化、子问换行。
  - 统一提示词中明确：禁止非法前缀、分数必须 `\\frac`、小问需换行。
- 风险与回滚
  - 风险：激进分数替换可能改写极少数非数学斜杠文本。
  - 回滚：只回退 `normalizeFractions` 规则，保留其他稳定清洗项。
- 发布状态
  - 已提交并推送：`a87ab8c`（origin/main）。

### [UTC+8 2026-02-24 09:00] Phase 4.11 组卷页可用性增强（公式渲染 + 交互筛选 + 导出稳定）
- 目标
  - 题库组卷页支持题干 LaTeX 公式渲染，减少 `\frac`、`\sin` 等原始字符串阅读成本。
  - 优化筛选与题目列表交互：可视化筛选状态、快捷标签筛选、选中高亮、就地清空 token。
  - 修复后端导出与重识别稳定性问题：中文文件名导出头、重识别外键阻塞、模板统一与提示词统一。
- 改动文件
  - `components/MathText.tsx`
  - `components/ComposerPage.tsx`
  - `shared/recognitionConfig.ts`
  - `constants.ts`
  - `server/src/services/prompts.ts`
  - `server/src/services/exportService.ts`
  - `server/src/routes/paperSets.ts`
  - `server/src/routes/papers.ts`
  - `tsconfig.server.json`
  - `PLAN.md`
- 验收标准
  - 组卷页题干与试卷篮支持 LaTeX 公式渲染，兼容 `$...$`、`$$...$$`、`\(...\)`、`\[...\]`。
  - 筛选区支持 datalist 候选、快捷标签筛选、清空筛选，题目选中态可视化。
  - 错误提示区支持“一键清空本地 token”。
  - 后端导出 LaTeX 使用 `PREAMBLE_TEMPLATE`，并修复 `Content-Disposition` 中文文件名报错。
  - 重识别流程可先清理 `paperSetItem`，避免 `RECOGNIZE_PERSIST_FAILED`（外键阻塞场景）。
  - 识别提示词与 schema 前后端共享统一配置。
- 风险与回滚
  - 风险：渲染组件引入 KaTeX CDN，弱网下首次渲染会回退为纯文本。
  - 回滚：可退回纯文本展示逻辑；后端导出/识别修复可按文件独立回退。
- 发布状态
  - 本条对应提交已按 `feat(phase-4.11)` 推送到 `origin/main`（见该提交 hash）。

### [UTC+8 2026-02-24 08:54] Phase 4.10 项目执行规范落盘与持续同步
- 目标
  - 新增独立执行规范文档，固化“每阶段更新 PLAN + commit + push”。
  - 在 README 增加规范入口，减少信息分散。
  - 在 Need 增加阻塞项强制记录规则，确保异常处理可追踪。
- 改动文件
  - `WORKFLOW.md`
  - `README.md`
  - `PLAN.md`
  - `Need.md`
- 验收标准
  - 仓库存在 `WORKFLOW.md`，且包含 DoD、三步流程、提交模板、pre-push 清单、异常处理规则。
  - `README.md` 文档清单含 `WORKFLOW.md` 入口。
  - `Need.md` 增加阻塞项记录规则。
  - 本阶段改动已完成一次提交并推送到 `origin/main`（SSH）。
- 风险与回滚
  - 风险：规范落地后若不严格执行，文档与流程仍可能脱节。
  - 回滚：保留规范文件，后续通过 PR 检查项强化执行，不删除历史条目。

### [UTC+8 2026-02-24 03:10] Phase 4.6.1 真实图片回归修复（Gemini 返回格式兼容 + 持久化稳定）
- 目标
  - 用 `test_image` 真实数据验证识别链路，并修复“识别成功但入库失败/题目数为0”的问题。
- 改动文件
  - `server/src/services/providers/geminiProvider.ts`
  - `server/src/routes/papers.ts`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 兼容 Gemini 返回 `[]` 与 `{ questions: [] }` 两种格式。
  - 持久化失败返回 `RECOGNIZE_PERSIST_FAILED`，不再误报 provider 上游错误。
  - 使用 `test_image` 实测：`questionsSaved > 0` 且 `/api/questions` 可查到结果。
- 风险与回滚
  - 风险：顺序写库替代交互事务后，极端故障下可能出现部分写入。
  - 回滚：后续若切回事务模式，需先确认 Supabase pooler 兼容配置。

### [UTC+8 2026-02-24 02:42] Phase 4.6-4.9 识别诊断闭环 + E2E 回归 + 微信换码登录
- 目标
  - 打通 Gemini 首次识别失败定位闭环：结构化日志、稳定错误码、有限重试、首调冷启动标记。
  - 新增 `smoke:recognition` 覆盖上传识别真实链路（非 mock）。
  - 完成微信 `code -> openid -> 系统 token` 登录，并接入前端回调落 token。
- 改动文件
  - `server/src/services/recognitionExecutionService.ts`
  - `server/src/routes/recognition.ts`
  - `server/src/routes/papers.ts`
  - `server/src/middleware/requestLogger.ts`
  - `server/src/services/wechatAuthService.ts`
  - `server/src/routes/auth.ts`
  - `server/src/config/env.ts`
  - `services/authApi.ts`
  - `services/geminiService.ts`
  - `App.tsx`
  - `scripts/smoke-recognition.sh`
  - `package.json`
  - `.env.server.example`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 识别失败返回稳定错误码：`PROVIDER_AUTH_FAILED`、`PROVIDER_RATE_LIMITED`、`PROVIDER_UPSTREAM_ERROR`、`PROVIDER_RESPONSE_INVALID`。
  - 识别日志可回答 `requestId/provider/model/fileCount/fileSizeBand/upstreamStatus/errorCategory`。
  - `npm run smoke:recognition` 成功路径可验证题库入库；失败路径可输出 `errorCode + requestId + log`。
  - 微信授权回调后前端可自动用 `code` 换取系统 token。
- 风险与回滚
  - 风险：微信开放平台接口波动会影响登录稳定性。
  - 回滚：保留邮箱/验证码登录为主路径，微信入口可临时隐藏。

### [UTC+8 2026-02-24 02:14] Phase 4.5 健康检查 readiness 扩展与 smoke 校验
- 目标
  - 将 `/api/v1/health` 从存活探针升级为依赖状态快照（provider/存储/auth/wechat）。
  - 在 `smoke` 中校验 readiness 字段存在，防止结构回归。
- 改动文件
  - `server/src/index.ts`
  - `scripts/smoke.sh`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `/api/v1/health` 返回 `readiness` 字段。
  - `npm run smoke` 可通过 readiness 校验。
- 风险与回滚
  - 风险：返回字段增加可能影响依赖旧结构的外部脚本。
  - 回滚：保留新字段为可选，不移除现有健康字段。

### [UTC+8 2026-02-24 02:07] Phase 4.4 演示数据清理闭环（防止 smoke 数据膨胀）
- 目标
  - 解决 `SMOKE_DEMO` 数据持续追加问题，保持回归数据集可控且可重复。
- 改动文件
  - `scripts/clean-demo-data.mjs`
  - `scripts/smoke-compose.sh`
  - `package.json`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `npm run db:clean:demo` 可清理演示题目及其关联数据。
  - `npm run smoke:compose` 执行前自动清理旧演示数据。
- 风险与回滚
  - 风险：误匹配清理条件可能删到非测试数据。
  - 回滚：清理范围仅限定 `sourceExam=SMOKE_DEMO` 与 `Smoke Compose Set` 空集。

### [UTC+8 2026-02-24 01:59] Phase 4.3 服务能力探测（Capabilities）与前端状态面板
- 目标
  - 提供公开能力探测接口，减少“到底配没配好”的盲调。
  - 在前端登录弹窗展示后端实时能力状态（验证码/微信/存储）。
- 改动文件
  - `server/src/routes/auth.ts`
  - `server/src/services/storageService.ts`
  - `services/authApi.ts`
  - `App.tsx`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `GET /api/auth/capabilities` 返回稳定结构。
  - 前端登录弹窗打开后可展示服务能力，并支持手动刷新。
- 风险与回滚
  - 风险：能力信息公开可能暴露配置状态（不含密钥）。
  - 回滚：将该接口改为仅鉴权用户可见，前端隐藏状态面板。

### [UTC+8 2026-02-24 01:49] Phase 4.2 存储本地降级（MinIO 不可用时上传识别不中断）
- 目标
  - 在开发环境中支持对象存储自动降级，避免 MinIO 不可用阻塞上传识别。
- 改动文件
  - `server/src/config/env.ts`
  - `server/src/services/storageService.ts`
  - `.env.server.example`
  - `README.md`
  - `Need.md`
  - `PLAN.md`
- 验收标准
  - `STORAGE_FALLBACK_LOCAL=true` 且 MinIO 不可用时，`/api/papers/upload` 仍可成功。
  - 上传后的文件可通过识别流程读取（使用本地降级目录）。
  - 文档明确开发/生产配置差异。
- 风险与回滚
  - 风险：本地降级目录会累积文件，需定期清理。
  - 回滚：设置 `STORAGE_FALLBACK_LOCAL=false`，恢复严格依赖 MinIO。

### [UTC+8 2026-02-24 01:45] Phase 4.1 上传识别链路诊断增强 + smoke
- 目标
  - 固化上传识别链路错误码：存储不可用、provider 未配置都可稳定诊断。
  - 补充上传识别专项 smoke，覆盖 `/api/papers/upload` 与 `/api/papers/:id/recognize`。
- 改动文件
  - `server/src/routes/papers.ts`
  - `scripts/smoke-upload.sh`
  - `package.json`
  - `README.md`
  - `Need.md`
  - `PLAN.md`
- 验收标准
  - `/api/papers/upload` 在存储不可用时返回 `STORAGE_UNAVAILABLE`。
  - `/api/papers/:id/recognize` 在 provider 未配置时返回 `PROVIDER_NOT_CONFIGURED`。
  - `npm run smoke:upload` 可跑通并输出 `DONE`。
- 风险与回滚
  - 风险：存储异常时提前返回可能减少识别日志沉淀。
  - 回滚：恢复原始异常上抛路径，仅保留 smoke 脚本。

### [UTC+8 2026-02-24 01:21] Phase 4.0 M1 主链路 smoke（题库编辑 + 组卷导出）
- 目标
  - 固化 M1 核心链路回归：题库查询、组卷、导出、编辑一条命令可验证。
  - 在 MinIO 不可用时保持导出功能可用，避免“能组卷但不能下载”。
- 改动文件
  - `server/src/routes/paperSets.ts`
  - `scripts/seed-demo-data.mjs`
  - `scripts/smoke-compose.sh`
  - `package.json`
  - `README.md`
  - `Need.md`
  - `PLAN.md`
- 验收标准
  - `npm run smoke:compose` 可在默认 `3130` 端口跑通。
  - `export-latex`、`export-word` 在 MinIO 不可用时仍返回可下载内容。
  - 演示数据可通过 `npm run db:seed:demo` 自动生成。
- 风险与回滚
  - 风险：演示数据会持续追加，长期会增加测试库体积。
  - 回滚：改为定期清理 `SMOKE_DEMO` 数据或使用独立测试库。

### [UTC+8 2026-02-24 00:55] Phase 3.9 微信回调入口骨架与统一错误码
- 目标
  - 补齐微信 OAuth 回调入口占位，统一“已配置但未实现换码”的错误语义。
- 改动文件
  - `server/src/routes/auth.ts`
  - `App.tsx`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `GET /api/auth/wechat/callback` 在缺少 `code` 时返回 `AUTH_INPUT_REQUIRED`。
  - 配置完整但未实现换码时，`/api/auth/wechat/login` 与 `/api/auth/wechat/callback` 返回 `AUTH_WECHAT_EXCHANGE_NOT_IMPLEMENTED`。
- 风险与回滚
  - 风险：前端可能误认为微信登录已全量可用。
  - 回滚：隐藏微信入口并恢复原 501 占位文案。

### [UTC+8 2026-02-24 00:50] Phase 3.8 前端微信登录入口接入
- 目标
  - 在现有登录弹窗中补齐微信入口，允许直接获取并打开授权链接。
- 改动文件
  - `services/authApi.ts`
  - `App.tsx`
  - `README.md`
  - `Need.md`
  - `PLAN.md`
- 验收标准
  - 登录弹窗支持“获取微信登录链接”按钮。
  - 后端配置完整时可打开微信授权页面；未配置时显示明确引导文案。
- 风险与回滚
  - 风险：仅完成授权跳转，回调换码仍未实现。
  - 回滚：隐藏微信按钮，不影响邮箱/验证码登录主链路。

### [UTC+8 2026-02-24 00:46] Phase 3.7 微信登录授权 URL 可用化
- 目标
  - 将微信登录从固定占位提升到“可生成标准授权链接”，减少后续 OAuth 接入工作量。
- 改动文件
  - `server/src/config/env.ts`
  - `server/src/routes/auth.ts`
  - `README.md`
  - `Need.md`
  - `PLAN.md`
- 验收标准
  - 配置 `WECHAT_APP_ID/WECHAT_APP_SECRET/WECHAT_REDIRECT_URI` 后，`GET /api/auth/wechat/url` 返回 `authorizeUrl/state`。
  - 未配置时继续返回 `AUTH_WECHAT_NOT_CONFIGURED`。
- 风险与回滚
  - 风险：state 仅本地生成，后续回调阶段需配套防重放校验。
  - 回滚：恢复固定 501 占位逻辑，不影响既有登录方式。

### [UTC+8 2026-02-24 00:44] Phase 3.6 验证码通道专项 smoke 自动化
- 目标
  - 固化验证码通道行为回归：debug 模式可返回 `debugCode`，关闭 debug 后返回稳定未配置错误码。
- 改动文件
  - `scripts/smoke-auth-code.sh`
  - `package.json`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `npm run smoke:auth:code` 自动完成两轮启动并校验：
    - debug 模式：`sent=true` 且存在 `debugCode`
    - debug 关闭：邮箱返回 `AUTH_EMAIL_NOT_CONFIGURED`，手机号返回 `AUTH_SMS_NOT_CONFIGURED`
- 风险与回滚
  - 风险：脚本依赖本机端口可用（默认 3120）。
  - 回滚：保留手工 curl 验证路径，移除独立脚本入口。

### [UTC+8 2026-02-24 00:41] Phase 3.5 前端鉴权错误码文案补齐
- 目标
  - 将验证码通道相关错误码映射为可执行提示，减少用户侧排障成本。
- 改动文件
  - `App.tsx`
  - `PLAN.md`
- 验收标准
  - `AUTH_EMAIL_NOT_CONFIGURED`、`AUTH_SMS_NOT_CONFIGURED`、`AUTH_CODE_DELIVERY_FAILED`、`AUTH_CODE_INVALID`、`AUTH_CODE_EXPIRED` 均显示明确中文提示。
- 风险与回滚
  - 风险：后端新增错误码未同步前端会回退为默认错误文案。
  - 回滚：保留默认 `error.message` 兜底，不影响功能可用性。

### [UTC+8 2026-02-24 00:38] Phase 3.4 验证码通道配置化（webhook + 稳定错误码）
- 目标
  - 将验证码申请从纯开发模式升级为“可配置通道 + 明确失败码”，为真实短信/邮件接入铺路。
  - 保持前端协议不变，继续兼容 `debugCode` 联调路径。
- 改动文件
  - `server/src/config/env.ts`
  - `server/src/services/loginCodeDeliveryService.ts`
  - `server/src/routes/auth.ts`
  - `.env.server.example`
  - `README.md`
  - `Need.md`
  - `PLAN.md`
- 验收标准
  - `POST /api/auth/code/request` 在 `AUTH_CODE_DEBUG=true` 时返回 `debugCode`。
  - 未启用邮箱/短信通道且关闭 debug 时，返回稳定错误码 `AUTH_EMAIL_NOT_CONFIGURED` 或 `AUTH_SMS_NOT_CONFIGURED`。
  - 配置 `AUTH_CODE_WEBHOOK_URL` 且投递失败时返回 `AUTH_CODE_DELIVERY_FAILED`。
- 风险与回滚
  - 风险：webhook 发送慢会增加验证码接口耗时。
  - 回滚：清空 `AUTH_CODE_WEBHOOK_URL` 并保持 `AUTH_CODE_DEBUG=true`。

### [UTC+8 2026-02-24 00:10] Phase 3.3 Supabase 连接打通与建表自愈脚本
- 目标
  - 打通 Supabase pooler 连接并恢复 `questions` 主链路可用。
  - 提供可重复执行的初始化建表脚本，避免 `prisma db push` 在 pooler 场景卡住。
- 改动文件
  - `scripts/bootstrap-db.mjs`
  - `package.json`
  - `README.md`
  - `Need.md`
  - `PLAN.md`
- 验收标准
  - `/api/v1/health` 返回 200。
  - `/api/questions?page=1&pageSize=1` 返回 200（允许空列表）。
  - 可通过 `npm run db:bootstrap` 重放建表，已存在对象自动跳过。
- 风险与回滚
  - 风险：脚本基于 SQL 语句拆分执行，后续若引入复杂 SQL（函数/触发器）需增强解析器。
  - 回滚：保留脚本仅用于初始化，复杂迁移回退到手工 SQL 或专用迁移工具链。

### [UTC+8 2026-02-23 12:25] Phase 3.2 鉴权失败前端可恢复路径 + Need 清单化
- 目标
  - 在组卷页请求遇到 `AUTH_REQUIRED/AUTH_FORBIDDEN` 时，自动引导用户进入登录弹窗，减少“报错后无下一步”问题。
  - 将 `Need.md` 改为可勾选清单，明确“你需要提供”的阻塞项与优先级。
- 改动文件
  - `components/ComposerPage.tsx`
  - `App.tsx`
  - `Need.md`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 组卷页接口返回 `AUTH_REQUIRED` 或 `AUTH_FORBIDDEN` 时，自动弹出“登录/鉴权”弹窗。
  - 组卷页错误提示包含可执行动作（去登录/切角色），不再仅显示原始后端错误。
  - `Need.md` 包含 P0/P1/P2 分级及状态字段，可直接逐项勾选推进。
- 风险与回滚
  - 风险：错误码识别依赖后端返回 `errorCode`；若第三方网关改写响应可能退化。
  - 回滚：保留当前提示文案，去掉自动弹窗，仅手动点“登录/鉴权”入口。

### [UTC+8 2026-02-23 12:21] Phase 3.1 前端登录入口与鉴权头统一接入
- 目标
  - 在前端提供可操作的登录入口（邮箱/验证码），减少手工填 token 的联调成本。
  - 将组卷页接口请求统一接入鉴权头，保证角色切换在全站生效。
- 改动文件
  - `services/authApi.ts`
  - `components/ComposerPage.tsx`
  - `App.tsx`
  - `README.md`
  - `Need.md`
  - `PLAN.md`
- 验收标准
  - 顶部可打开“登录/鉴权”弹窗，支持邮箱注册/登录、验证码登录。
  - 登录成功后自动写入 Bearer token，并可调用 `/api/v1/me` 校验当前身份。
  - `ComposerPage` 的 `/api/questions`、`/api/papersets*` 请求携带统一鉴权头。
- 风险与回滚
  - 风险：前端状态复杂度上升，可能出现 token 与角色切换冲突。
  - 回滚：保留 `authClient` 基础设置，临时隐藏登录弹窗入口。

### [UTC+8 2026-02-23 11:50] Phase 3.0 登录能力起步：邮箱/手机号可用 + 微信预留
- 目标
  - 在现有 JWT 体系中落地可用登录入口，优先支持邮箱与手机号验证码登录。
  - 为微信登录保留标准接口入口，后续可接 OAuth 换码流程。
- 改动文件
  - `server/src/middleware/auth.ts`
  - `server/src/routes/auth.ts`
  - `server/src/services/passwordService.ts`
  - `server/src/services/tokenService.ts`
  - `server/src/index.ts`
  - `.env.server.example`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 严格鉴权模式下，`/api/auth/*` 可访问（不被中间件拦截）。
  - `email/register`、`email/login`、`code/request`、`code/login` 可返回可用 `accessToken`。
  - 微信接口返回明确 `AUTH_WECHAT_NOT_CONFIGURED`，非静默失败。
- 风险与回滚
  - 风险：验证码接口当前为开发版（返回 debugCode），生产环境需替换为短信/邮件服务。
  - 回滚：保留路由定义，临时关闭验证码登录入口，仅保留邮箱密码登录。

### [UTC+8 2026-02-23 11:34] Phase 2.9 前端开发鉴权面板（角色切换 + Bearer）
- 目标
  - 在前端直接支持 `admin/teacher/viewer` 切换，减少后端联调成本。
  - 支持可选 Bearer token 注入，覆盖严格鉴权场景。
- 改动文件
  - `services/authClient.ts`
  - `services/geminiService.ts`
  - `App.tsx`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 前端右上角可切换角色、输入/清除 Bearer token。
  - `/api/analyze`、`/api/parse-latex`、`/api/client-events/open` 请求携带统一鉴权头。
  - 角色和 token 配置可在刷新后保留（localStorage）。
- 风险与回滚
  - 风险：生产环境误用开发鉴权面板配置。
  - 回滚：仅在开发构建显示该面板，生产隐藏。

### [UTC+8 2026-02-23 11:25] Phase 2.8 严格鉴权一键全流程回归脚本
- 目标
  - 提供“单命令完成”严格鉴权回归（启动服务 -> 角色矩阵 -> 自动清理）。
  - 避免占用默认 3100，降低对现有开发流程干扰。
- 改动文件
  - `scripts/smoke-auth-full.sh`
  - `package.json`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `npm run smoke:auth:full` 可在默认 `3110` 端口完成全流程并退出。
  - 启动失败时可输出 `/tmp/paper-auth-full-server.log` 关键日志。
  - 兼容 `SMOKE_SIGNING_SECRET`、`SMOKE_SERVER_PORT`、`SMOKE_API_BASE` 参数。
- 风险与回滚
  - 风险：本地 `SMOKE_SIGNING_SECRET` 与服务端真实配置不一致导致误判。
  - 回滚：继续使用 `smoke:auth:matrix` + 手动启动服务的分步模式。

### [UTC+8 2026-02-23 11:12] Phase 2.7 Auth smoke 自动签发 token 与角色矩阵
- 目标
  - 降低对外部 token 依赖，让严格鉴权回归可在本地一键跑通。
  - 固化 `admin/teacher/viewer` 三角色权限矩阵验证。
- 改动文件
  - `scripts/smoke-auth.sh`
  - `scripts/smoke-auth-matrix.sh`
  - `package.json`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `smoke:auth` 支持 `SMOKE_GENERATE_TOKEN_ROLE + SMOKE_SIGNING_SECRET` 自动签发测试 token。
  - `npm run smoke:auth:matrix` 可顺序验证三角色并在权限异常时失败退出。
  - 保持 `SMOKE_BEARER_TOKEN` 手工 token 路径兼容。
- 风险与回滚
  - 风险：本地签名密钥与服务端验签配置不一致会导致误判为鉴权失败。
  - 回滚：回退到 `SMOKE_BEARER_TOKEN` 人工注入模式，保留脚本框架。

### [UTC+8 2026-02-23 11:08] Phase 2.6 Bearer token 预期角色断言与 claim 对照
- 目标
  - 为 `smoke:auth` 增加预期角色断言，避免 token 角色映射偏差被忽略。
  - 增加 token 原始 claim 角色输出，帮助快速定位“claim 配置 vs 服务映射”不一致问题。
- 改动文件
  - `scripts/smoke-auth.sh`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 支持 `SMOKE_EXPECTED_ROLE` 校验 `/api/v1/me` 映射角色。
  - 支持 `SMOKE_ROLE_CLAIM_PATH` 输出 token 原始 claim 角色（默认 `app_metadata.role`）。
  - 无 token 场景 `AUTH_REQUIRED` 验收不回归。
- 风险与回滚
  - 风险：部分第三方 token payload 非标准 JSON/base64url 结构导致 claim 解析为空。
  - 回滚：claim 对照降级为提示项，不作为失败条件。

### [UTC+8 2026-02-23 10:58] Phase 2.5 Bearer token 角色权限矩阵回归
- 目标
  - 在严格鉴权模式下，补齐有 token 场景的角色权限自动校验。
  - 提供不依赖数据库的 admin-only 诊断端点，稳定验证 `AUTH_FORBIDDEN`。
- 改动文件
  - `server/src/routes/authInfo.ts`
  - `scripts/smoke-auth.sh`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `SMOKE_BEARER_TOKEN` 存在时，`smoke:auth` 能识别 `/api/v1/me` 的 token 角色。
  - `smoke:auth` 自动校验 `/api/v1/authz/admin`：admin 返回 200，非 admin 返回 `AUTH_FORBIDDEN`。
  - 无 token 场景仍维持 `AUTH_REQUIRED` 验收。
- 风险与回滚
  - 风险：不同 token 结构导致角色字段缺失。
  - 回滚：保留 `/api/v1/me` 原始输出，脚本回退为仅校验 bearer 可用性。

### [UTC+8 2026-02-23 10:23] Phase 2.4 启动链路稳定性修复（server tsconfig + 路由导入收敛）
- 目标
  - 修复后端在当前环境中启动无响应的问题，确保 `smoke` 自动拉起稳定可用。
  - 降低前端 `tsconfig` 配置对 Node 后端运行时的干扰。
- 改动文件
  - `tsconfig.server.json`
  - `package.json`
  - `server/src/services/providerService.ts`
  - `server/src/routes/recognition.ts`
  - `server/src/routes/papers.ts`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `SMOKE_AUTO_START=1 npm run smoke` 可自动拉起并通过。
  - `AUTH_DEV_FALLBACK=false` 下 `npm run smoke:auth` 校验 `AUTH_REQUIRED` 通过。
  - 访问日志继续包含 `authMode/authReason`，不影响既有错误码验收。
- 风险与回滚
  - 风险：Provider 改为懒加载后，首次识别请求会有轻微冷启动开销。
  - 回滚：恢复静态加载并在启动阶段预热 provider（仅在启动稳定后执行）。

### [UTC+8 2026-02-23 09:54] Phase 2.3 鉴权可观测性增强（auth mode/reason）
- 目标
  - 让鉴权路径可观测：明确请求是走 Bearer 还是 Dev Fallback。
  - 在日志和自检接口中暴露鉴权上下文，缩短 401/403 排障时间。
- 改动文件
  - `server/src/types.ts`
  - `server/src/middleware/auth.ts`
  - `server/src/middleware/requestLogger.ts`
  - `server/src/routes/clientEvents.ts`
  - `server/src/routes/authInfo.ts`
  - `scripts/smoke.sh`
  - `scripts/smoke-auth.sh`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `/api/v1/me` 响应包含 `auth.mode` 与 `auth.reason`。
  - `logs/access-YYYY-MM-DD.log`、`logs/client-event-YYYY-MM-DD.log` 包含 `authMode`、`authReason`。
  - `npm run smoke` 与 `npm run smoke:auth` 均能校验到对应鉴权模式。
- 风险与回滚
  - 风险：日志字段新增可能影响旧解析脚本。
  - 回滚：新增字段保持可选，不删除原有字段。

### [UTC+8 2026-02-22 08:25] Phase 2.2 健康检查公开化（严格鉴权兼容）
- 目标
  - 在 `AUTH_DEV_FALLBACK=false` 时保持健康检查可用，支持部署探活。
  - 打通 `smoke:auth` 无 token 验证链路。
- 改动文件
  - `server/src/index.ts`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `/api/health`、`/api/v1/health` 在严格鉴权模式下返回 200。
  - `npm run smoke:auth` 可稳定校验 `AUTH_REQUIRED`。
- 风险与回滚
  - 风险：公开健康检查暴露服务存活信息。
  - 回滚：仅在内网或网关层开放健康检查路径。

### [UTC+8 2026-02-22 08:22] Phase 2.1 严格鉴权 smoke 专项脚本
- 目标
  - 提供独立的鉴权专项检查，覆盖 `AUTH_REQUIRED` 与 Bearer token 场景。
  - 将“严格鉴权”与“通用主链路 smoke”解耦，减少联调时误判。
- 改动文件
  - `scripts/smoke-auth.sh`
  - `package.json`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - `npm run smoke:auth` 在无 token 时能校验返回 `AUTH_REQUIRED`。
  - 设置 `SMOKE_BEARER_TOKEN` 后可校验 `/api/v1/me` 鉴权成功。
- 风险与回滚
  - 风险：开发者混用 `smoke` 与 `smoke:auth` 导致理解偏差。
  - 回滚：将 `smoke:auth` 合并回主 `smoke` 并保留开关注释。

### [UTC+8 2026-02-22 08:11] Phase 2.0 M3 严格鉴权联调增强
- 目标
  - 完善 Supabase JWT 角色映射（支持自定义 claim 路径），降低不同项目 JWT 结构差异带来的联调成本。
  - 增强鉴权失败可诊断性，并让 smoke 支持真实 Bearer token 验证。
- 改动文件
  - `server/src/config/env.ts`
  - `server/src/middleware/auth.ts`
  - `.env.server.example`
  - `scripts/smoke.sh`
  - `README.md`
  - `PLAN.md`
- 验收标准
  - 支持通过 `SUPABASE_ROLE_CLAIM_PATH` 指定角色字段路径（默认 `app_metadata.role`）。
  - 权限不足返回稳定错误码 `AUTH_FORBIDDEN`。
  - `SMOKE_BEARER_TOKEN=<token> npm run smoke` 可执行并验证 `/api/v1/me`。
- 风险与回滚
  - 风险：错误的 claim 路径会导致角色退化为 `teacher`。
  - 回滚：清空 `SUPABASE_ROLE_CLAIM_PATH` 并依赖现有默认映射链路。

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
