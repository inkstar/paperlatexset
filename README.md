# 试卷识别与组卷系统

这个项目现在包含两个部分：

- 前端（Vite + React）
- 后端（Express + Prisma + PostgreSQL + MinIO）

## 项目文档

- 产品需求：`PRD.md`
- 实施计划：`PLAN.md`
- 当前执行阶段：`PLAN.md` 顶部最新条目（已进入 M3 第一步：鉴权与 API v1 入口）

## 本地开发

### 1) 准备环境变量

前端：

- `/.env.local`

后端：

- 复制 `/.env.server.example` 为 `/.env.server`
- 填写 PostgreSQL、MinIO、Gemini/GLM API Key
- 若启用 Supabase JWT：
  - 设置 `AUTH_DEV_FALLBACK=false`
  - 填写 `SUPABASE_JWT_SECRET`
  - 可选填写 `SUPABASE_JWT_ISSUER`、`SUPABASE_JWT_AUDIENCE`
  - 可选设置 `SUPABASE_ROLE_CLAIM_PATH`（默认 `app_metadata.role`）

### 2) 安装依赖

```bash
npm install
```

### 3) 生成 Prisma Client 与迁移

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4) 启动前后端

```bash
npm run dev
```

- 前端：`http://localhost:3000`
- 后端：`http://localhost:3100`

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
- `GET /api/v1/health`
- `GET /api/v1/me`
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
- 上传与入库识别链路（如 `/api/papers/upload`、`/api/papers/:id/recognize`）会失败，需先启动/修正 MinIO。

## 错误码排查（M1）

- `BACKEND_UNREACHABLE`
  - 含义：前端无法连接后端。
  - 处理：启动后端（`npm run dev` 或 `npm run preview:full`），确认 `3100` 端口可访问。

- `PROVIDER_NOT_CONFIGURED`
  - 含义：当前识别 provider 未配置 API key。
  - 处理：在 `.env.server` 配置对应 `GEMINI_API_KEY` 或 `GLM_API_KEY`，重启后端。

- `PROVIDER_REQUEST_FAILED`
  - 含义：已连接 provider，但请求失败（限流/网络/参数）。
  - 处理：查看后端日志与返回错误信息，必要时切换 provider 重试。

提示：后端响应头会返回 `x-request-id`，可用于在 `logs/access-YYYY-MM-DD.log` 中定位同一请求。

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
