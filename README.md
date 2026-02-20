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
