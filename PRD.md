# PRD V1（执行版）- 试卷识别与组卷系统

## 1. 产品目标
- 把“上传试卷 -> AI识别题目 -> 题库筛选组卷 -> 导出”做成稳定可用的教师工具。
- 将识别结果沉淀为可编辑、可检索、可复用的题库资产。
- 通过日报追踪识别成本与质量，支持持续优化。

## 2. 目标用户
- 教师：上传试卷、识别、组卷、导出。
- 管理员：配置模型提供商、查看质量与成本报表。
- 查看者：只读查看题库和导出结果。

## 3. 核心场景
1. 上传 PDF/图片并触发识别。
2. 审核与编辑识别结果（题号、题型、知识点、来源、LaTeX）。
3. 从题库筛选并批量选题组卷。
4. 导出 LaTeX/Word（PDF 作为增强能力）。
5. 查看每日识别成本与质量报表。

## 4. MVP 范围
- 上传与识别：`POST /api/papers/upload`、`POST /api/papers/:id/recognize`
- 题库管理：`GET /api/questions`、`PATCH /api/questions/:id`
- 组卷与导出：`POST /api/papersets`、`POST /api/papersets/:id/items/batch-select`、导出 latex/word/pdf
- 报表：`GET /api/reports/daily`
- 兼容接口：`POST /api/analyze`、`POST /api/parse-latex`

## 5. 非范围
- 学生端答题与阅卷闭环。
- 复杂租户隔离与组织管理。
- 在线协同编辑与审批流。

## 6. 成功指标
- 端到端（上传到导出）成功率 >= 95%。
- 识别后可直接使用的题目比例 >= 85%。
- 50 题组卷导出 latex/word 响应 < 10s（本地标准环境）。
- 日报任务每日执行成功且支持重建。

## 7. 关键约束
- 前端：Vite + React。
- 后端：Express + Prisma + PostgreSQL + MinIO。
- 模型提供商：Gemini / GLM 可切换。
- 鉴权：短期兼容开发 header，后续切换 Supabase JWT 主路径。

## 8. 里程碑
1. M0：仓库与文档基线（GitHub 首发、PRD/PLAN 固化）。
2. M1：主流程可用（上传识别、题库编辑、组卷导出）。
3. M2：体验与质量提升（前端交互、LaTeX 预览、异常兜底）。
4. M3：鉴权与 API v1（Supabase JWT + `/api/v1/*`）。
5. M4：报表与运维增强（可观测、重试、回溯）。

## 9. 验收场景
1. 正常链路：上传 -> 识别 -> 编辑 -> 组卷 -> 导出。
2. 异常链路：空文件、空选题导出、无权限访问、识别失败。
3. 权限链路：admin/teacher/viewer 的边界正确。
4. 运维链路：日报查询与重建一致可复现。
