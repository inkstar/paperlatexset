# 试卷识别与组卷系统

这个项目现在包含两个部分：

- 前端（Vite + React）
- 后端（Express + Prisma + PostgreSQL + MinIO）

## 项目文档

- 产品需求：`PRD.md`
- 实施计划：`PLAN.md`

## 本地开发

### 1) 准备环境变量

前端：

- `/.env.local`

后端：

- 复制 `/.env.server.example` 为 `/.env.server`
- 填写 PostgreSQL、MinIO、Gemini/GLM API Key

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
