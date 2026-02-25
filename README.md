# 试卷识别与组卷系统

这个项目现在包含两个部分：

- 前端（Vite + React）
- 后端（Express + Prisma + PostgreSQL + MinIO）

## 项目文档

- 产品需求：`PRD.md`
- 实施计划：`PLAN.md`
- 执行规范：`WORKFLOW.md`
- 外部依赖清单：`Need.md`
- 你需要提供什么：优先查看 `Need.md` 的 `P0` 勾选项
- 当前执行阶段：`PLAN.md` 顶部最新条目（已进入 M3 第一步：鉴权与 API v1 入口）

## Git 写操作防并发（推荐）

为避免 `HEAD.lock` / `main.lock` 残留导致提交卡住，推荐用互斥脚本执行 git 写操作：

```bash
bash scripts/git-write-guard.sh status
bash scripts/git-write-guard.sh add PLAN.md
bash scripts/git-write-guard.sh commit -m "chore(phase-x.y): ..."
bash scripts/git-write-guard.sh push origin main
```

脚本能力：
- 自动串行化 git 写操作（优先 `flock`，缺失时自动回退 `mkdir` 原子锁）
- 写前检查进程与 lock 残留
- 无活跃 git 进程时自动清理 `.git/*.lock`

规范检查脚本：

```bash
npm run workflow:check -- "feat(phase-4.17): ..."
```

## 本地开发

### 1) 准备环境变量

前端：

- `/.env.local`
- 可选应急识别兜底：
  - `VITE_GEMINI_API_KEY=`（后端不可达时，前端直连 Gemini）
  - `VITE_GEMINI_MODEL=gemini-2.5-flash`（可选，默认该模型）

后端：

- 复制 `/.env.server.example` 为 `/.env.server`
- 填写 PostgreSQL、MinIO、Gemini/GLM API Key
- 若启用 Supabase JWT：
  - 设置 `AUTH_DEV_FALLBACK=false`
  - 填写 `SUPABASE_JWT_SECRET`
  - 可选填写 `SUPABASE_JWT_ISSUER`、`SUPABASE_JWT_AUDIENCE`
  - 可选设置 `SUPABASE_ROLE_CLAIM_PATH`（默认 `app_metadata.role`）
- 验证码登录通道配置（可选）：
  - `AUTH_CODE_DEBUG=true|false`（是否在响应中返回 `debugCode`）
  - `AUTH_CODE_WEBHOOK_URL=`（配置后会把验证码推送到该 webhook）
  - `AUTH_CODE_EMAIL_ENABLED=true|false`
  - `AUTH_CODE_PHONE_ENABLED=true|false`
- 微信登录配置（可选）：
  - `WECHAT_APP_ID=`
  - `WECHAT_APP_SECRET=`
  - `WECHAT_REDIRECT_URI=`（微信平台回调地址）
  - `WECHAT_FRONTEND_REDIRECT_URI=`（可选：后端回调后重定向到前端落 token）
- 存储降级配置（开发建议开启）：
  - `STORAGE_FALLBACK_LOCAL=true|false`（MinIO 不可用时是否自动落盘到本地）
  - `STORAGE_FALLBACK_DIR=.local-storage`（本地落盘目录）

### 2) 安装依赖

```bash
npm install
```

### 3) 生成 Prisma Client 与迁移

```bash
npm run prisma:generate
npm run prisma:migrate
```

如果你使用 Supabase pooler（6543）且本地迁移命令不稳定，可改用：
```bash
npm run db:bootstrap
```
该命令会按 `prisma/schema.prisma` 生成并执行建表 SQL（幂等，已存在对象会跳过）。

### 4) 启动前后端

```bash
npm run dev
```

- 前端：`http://localhost:3000`
- 后端：`http://localhost:3100`

说明：后端启动脚本已固定使用 `tsconfig.server.json`，避免前端 `tsconfig` 选项影响服务启动稳定性。
当后端暂不可达时，前端识别/LaTeX 导入会尝试自动回退到浏览器端 Gemini（需配置 `VITE_GEMINI_API_KEY`）。

前端开发鉴权面板（右上角）：
- 可直接切换 `admin / teacher / viewer`（无 Bearer token 时使用）。
- 可填入 Bearer token（填入后优先使用 Bearer）。
- 配置会保存在浏览器 `localStorage`，用于本地联调。
- 组卷页如果返回 `AUTH_REQUIRED/AUTH_FORBIDDEN`，会自动弹出“登录/鉴权”弹窗。

组卷页筛选（`题库组卷`）：
- 支持按 `知识点 / 题型 / 来源 / 年份` 下拉筛选。
- 顶部会显示已启用筛选标签，可逐个移除单项筛选。
- 快捷筛选按钮支持知识点、题型、来源、年份，点击可切换启用/取消。

### 5) 一键 smoke 验证（可选）

```bash
npm run smoke
```

默认要求后端已启动（`npm run dev` 或 `npm run server:start`）。
如果希望脚本自动尝试拉起后端，可用：
```bash
SMOKE_AUTO_START=1 npm run smoke
```
如果要验证真实 Bearer token（如 Supabase access_token），可用：
```bash
SMOKE_BEARER_TOKEN='<your-access-token>' npm run smoke
```

会自动验证：
- `GET /api/health`
- `GET /api/v1/health`（含 `readiness` 依赖状态）
- `GET /api/v1/me`（返回 `auth.mode/auth.reason`）
- `POST /api/client-events/open`
- `POST /api/parse-latex`（空输入错误码）
- `POST /api/analyze`（无文件错误码）
- 当日东八区日志文件写入

当 `AUTH_DEV_FALLBACK=false` 时，请使用 `SMOKE_BEARER_TOKEN` 执行 smoke。

严格鉴权专项验证（后端需以 `AUTH_DEV_FALLBACK=false` 启动）：
```bash
npm run smoke:auth
```
如果要同时验证有 token 场景：
```bash
SMOKE_BEARER_TOKEN='<your-access-token>' npm run smoke:auth
```
`smoke:auth` 会自动检查：
- 无 token 时返回 `AUTH_REQUIRED`
- 有 token 时 `/api/v1/me` 返回 `auth.mode=bearer`

导出格式专项验证（无需启动后端）：
```bash
npm run smoke:export:format
```
会检查：
- 默认日期标题解析逻辑是否存在（东八区）
- `choicegap=2cm`、`solutiongap=6cm`
- `fancyhdr` 页眉页脚配置存在
- 题型留白分支是否存在（选择/填空 vs 解答）

如需额外运行时检查（可能更慢）：
```bash
SMOKE_EXPORT_RUNTIME=1 npm run smoke:export:format
```

LaTeX 导出可选参数（`POST /api/papersets/:id/export-latex`，JSON body）：
- `headerTitle`: 自定义页眉/标题文本
- `choiceGap`: 选择/填空留白（如 `2cm`）
- `solutionGap`: 解答题留白（如 `6cm`）
- `lineSpacing`: 行距倍率（`0.8` 到 `3`）
- 前端会在本地缓存上述参数（`localStorage`），刷新页面后自动恢复最近一次配置。
- 前端导出前会校验留白单位与行距范围，非法输入会直接提示并阻断请求。
- 基于 token 角色验证 `/api/v1/authz/admin` 权限（admin=200，非 admin=403）
可选参数：
- `SMOKE_EXPECTED_ROLE=admin|teacher|viewer`：断言服务端映射角色。
- `SMOKE_ROLE_CLAIM_PATH=app_metadata.role`：指定 token 原始角色 claim 路径（默认同后端）。
- `SMOKE_GENERATE_TOKEN_ROLE=admin|teacher|viewer`：自动生成本地测试 token（需 `SMOKE_SIGNING_SECRET`）。
- `SMOKE_SIGNING_SECRET=<secret>`：测试 token 的签名密钥（需与服务端验签密钥一致）。

一键角色矩阵（自动生成 `admin/teacher/viewer` 三个 token）：
```bash
SMOKE_SIGNING_SECRET='<JWT secret>' npm run smoke:auth:matrix
```
可选补充：
- `SMOKE_TOKEN_ISSUER=<issuer>`
- `SMOKE_TOKEN_AUDIENCE=<audience>`

一键全流程（自动拉起严格鉴权后端 + 角色矩阵 + 自动清理）：
```bash
SMOKE_SIGNING_SECRET='<JWT secret>' npm run smoke:auth:full
```
可选参数：
- `SMOKE_SERVER_PORT=3110`（默认 3110，避免占用你正在运行的 3100）
- `SMOKE_API_BASE=http://localhost:3110`（自定义基地址）

验证码通道专项回归（自动验证 debug 模式和通道未配置错误码）：
```bash
npm run smoke:auth:code
```

组卷主链路专项回归（自动种子数据 + 题库查询 + 组卷 + 导出 + 编辑）：
```bash
npm run smoke:compose
```
会自动执行：
- `npm run db:clean:demo` 清理上次演示数据
- `npm run db:seed:demo` 写入演示题目
- `GET /api/questions?sourceExam=SMOKE_DEMO`
- `POST /api/papersets` + `batch-select`
- `POST /api/papersets/:id/export-latex`
- `POST /api/papersets/:id/export-word`
- `PATCH /api/questions/:id`

如需手工清理演示数据：
```bash
npm run db:clean:demo
```

说明：导出接口在 MinIO 不可用时也会继续返回下载内容，仅会把归档任务记录为 `failed`。

上传识别链路专项回归（上传 + provider 配置错误码 + 存储不可用错误码）：
```bash
npm run smoke:upload
```
会自动验证：
- `/api/analyze` 在非法 provider 时返回 `PROVIDER_NOT_CONFIGURED`
- `/api/papers/upload` 在存储不可用时返回 `STORAGE_UNAVAILABLE`
- 若上传成功，`/api/papers/:id/recognize` 在非法 provider 时返回 `PROVIDER_NOT_CONFIGURED`

上传识别 E2E 回归（Gemini 基线，非 mock）：
```bash
npm run smoke:recognition
```
会自动执行：
- 上传测试图片到 `/api/papers/upload`
- 调用 `/api/papers/:id/recognize`（默认 provider=gemini）
- 成功路径：校验 `/api/questions` 可查到识别结果
- 失败路径：输出 `errorCode` + `x-request-id` + 日志路径（用于快速定位）

## 日志目录

- 项目根目录固定使用 `logs/`
- 访问日志：`logs/access-YYYY-MM-DD.log`
- 浏览器打开事件日志：`logs/client-event-YYYY-MM-DD.log`

> 说明：日志由后端写入，所以需要后端服务处于运行状态。

## preview 常见报错（ECONNREFUSED）

`npm run preview` 只启动前端预览服务器（默认 `4173`），当前端请求 `/api/*` 时会代理到后端 `3100`。  
如果后端没启动，就会出现你看到的：

- `[vite] http proxy error: /api/...`
- `AggregateError [ECONNREFUSED]`

解决方式：另开一个终端启动后端服务（或直接用 `npm run dev` 一起启动）。

也可以直接使用：

```bash
npm run preview:full
```

如果后端启动时报端口占用（`EADDRINUSE`），先释放 `3100` 端口再重启。

如果启动日志提示 `MinIO is not reachable`，说明对象存储未连接：
- `POST /api/analyze`、`POST /api/parse-latex` 仍可用。
- 若 `STORAGE_FALLBACK_LOCAL=true`，上传与识别会自动降级到本地目录（默认 `.local-storage/`）。
- 若关闭本地降级，上传与入库识别链路会返回 `STORAGE_UNAVAILABLE`。

## 错误码排查（M1）

- `BACKEND_UNREACHABLE`
  - 含义：前端无法连接后端。
  - 处理：启动后端（`npm run dev` 或 `npm run preview:full`），确认 `3100` 端口可访问。

- `PROVIDER_NOT_CONFIGURED`
  - 含义：当前识别 provider 未配置 API key。
  - 处理：在 `.env.server` 配置对应 `GEMINI_API_KEY` 或 `GLM_API_KEY`，重启后端。

- `PROVIDER_AUTH_FAILED`
  - 含义：provider 鉴权失败（401/403）。
  - 处理：检查 API key、权限和配额。

- `PROVIDER_RATE_LIMITED`
  - 含义：provider 限流（429）。
  - 处理：稍后重试，或切换 provider。

- `PROVIDER_UPSTREAM_ERROR`
  - 含义：provider 上游或网络异常（5xx/超时/连接失败）。
  - 处理：重试并结合 `x-request-id` 查看后端日志。

- `PROVIDER_RESPONSE_INVALID`
  - 含义：provider 返回结构异常，解析失败。
  - 处理：重试或切换 provider。

- `PROVIDER_PRECHECK_FAILED`
  - 含义：识别调用前预检失败（配置或模型不匹配）。
  - 处理：检查 provider 配置和模型设置。

- `RECOGNIZE_PERSIST_FAILED`
  - 含义：模型识别成功，但入库持久化失败（数据库事务/约束问题）。
  - 处理：查看后端日志中的 `x-request-id`，优先排查数据库连接与事务超时。

提示：后端响应头会返回 `x-request-id`，可用于在 `logs/access-YYYY-MM-DD.log` 中定位同一请求。
鉴权相关请求会返回 `x-auth-mode`（`bearer` 或 `dev_fallback`），可用于确认当前鉴权路径。

## 核心能力

- 上传 PDF/图片并识别题目
- 结构化题库存储（题号/题型/知识点/来源/LaTeX）
- 题库筛选 + 组卷
- 试卷篮（当前页全选、全部结果全选）
- 导出 LaTeX / Word
- 每日自动汇总成本与质量报表

## 关键 API

- `POST /api/papers/upload`
- `POST /api/papers/:id/recognize`
- `GET /api/questions`
- `GET /api/stats`
- `PATCH /api/questions/:id`
- `POST /api/papersets`
- `POST /api/papersets/:id/items/batch-select`
- `POST /api/papersets/:id/export-pdf`
- `POST /api/papersets/:id/export-latex`
- `POST /api/papersets/:id/export-word`
- `PATCH /api/providers`
- `GET /api/reports/daily`

> 兼容接口（前端当前使用）
>
> - `POST /api/analyze`
> - `POST /api/parse-latex`
>
> API v1 入口（M3）：
>
> - `GET /api/v1/questions`
> - `POST /api/v1/papers/upload`
> - `POST /api/v1/papers/:id/recognize`
> - `GET /api/v1/stats`
> - `GET /api/v1/me`
> - `GET /api/v1/health`（公开探活，不要求 token）
> - `GET /api/v1/authz/admin`（鉴权回归用 admin-only 端点）

## 登录接口（新增）

前端入口：
- 顶部“登录/鉴权”按钮可直接执行邮箱注册、邮箱登录、验证码登录，并自动写入 Bearer token。
- 登录弹窗支持“获取微信登录链接”，会调用后端 `/api/auth/wechat/url`。
- 登录弹窗会读取 `/api/auth/capabilities` 并显示当前服务能力（验证码通道、微信配置、存储模式）。

- 邮箱注册：`POST /api/auth/email/register`
  - body: `{ "email": "...", "password": "...", "name": "..." }`
- 邮箱密码登录：`POST /api/auth/email/login`
  - body: `{ "email": "...", "password": "..." }`
- 邮箱/手机号验证码申请：`POST /api/auth/code/request`
  - body: `{ "email": "..." }` 或 `{ "phone": "..." }`
  - 当 `AUTH_CODE_DEBUG=true` 时响应会返回 `debugCode`
  - 可配 `AUTH_CODE_WEBHOOK_URL` 将验证码投递到外部通道
  - 未启用对应通道时会返回：
    - `AUTH_EMAIL_NOT_CONFIGURED`
    - `AUTH_SMS_NOT_CONFIGURED`
    - `AUTH_CODE_DELIVERY_FAILED`
- 邮箱/手机号验证码登录：`POST /api/auth/code/login`
  - body: `{ "email": "...", "code": "123456" }` 或 `{ "phone": "...", "code": "123456" }`
- 微信登录预留：`GET /api/auth/wechat/url`、`POST /api/auth/wechat/login`
- 微信登录：
  - `GET /api/auth/wechat/url`：配置了 `WECHAT_APP_ID/WECHAT_APP_SECRET/WECHAT_REDIRECT_URI` 后返回可用授权链接。
  - `POST /api/auth/wechat/login`：使用 `code` 进行换码并登录，返回 `accessToken`。
  - `GET /api/auth/wechat/callback`：若设置 `WECHAT_FRONTEND_REDIRECT_URI`，会自动重定向到前端并带上 `code/state`。
- 服务能力探测：`GET /api/auth/capabilities`
  - 返回验证码通道开关、微信配置状态、当前存储模式（`minio`/`local`）。
