# WORKFLOW

## 目标

把“计划更新 + 代码提交 + 远端推送”变成强约束流程，避免 `PLAN.md`、本地代码、GitHub 不同步。

## 固定决策

- 规范文件独立维护：`WORKFLOW.md`
- 执行节奏：每个阶段完成后，必须执行三步（更新 PLAN、commit、push）
- 提交粒度：一阶段一提交（Phase/子阶段一个 commit）
- 分支策略：继续在 `main` 小步推进
- 远端策略：继续使用 SSH 远端 `origin`

## 阶段完成定义（DoD）

一个阶段“完成”必须同时满足：

1. 代码已实现且本地可验证（至少完成最小回归）。
2. `PLAN.md` 已写入该阶段最新进展（UTC+8 时间戳）。
3. Git 已提交且已推送到 `origin/main`。

## 强制三步（每阶段必须）

1. 更新 `PLAN.md`
2. `git add` + `git commit`（一阶段一提交）
3. `git push origin main`（SSH）

## 提交信息模板

- `feat(phase-x.y): <本阶段目标>`
- `fix(phase-x.y): <本阶段问题修复>`
- `chore(phase-x.y): <规范/脚本/文档同步>`

## PLAN 记录模板（与现有格式兼容）

每条计划记录必须包含：

- 目标
- 改动文件（绝对路径或仓库相对路径）
- 验收标准
- 风险与回滚
- 发布状态（`已提交` / `已推送` + commit hash）

## 推送前检查清单（Pre-push Checklist）

1. `git status` 无意外脏文件（允许明确标记的测试目录）
2. `PLAN.md` 顶部已有本阶段条目
3. 最小验证命令已跑（如 `smoke` / 关键接口 / 页面手测其一）
4. commit message 符合模板

## 异常处理规则

- 若推送失败：在 `PLAN.md` 当前阶段追加“阻塞原因 + 下一动作”
- 若发现非本次改动的异常文件：暂停提交并在 `Need.md` 记录
- 禁止使用破坏性命令清理工作区（无 `reset --hard`）

## 测试目录提交策略

- `test_image/`、`test_output/` 默认不自动纳入提交。
- 仅在该阶段明确需要沉淀样例或产物时才提交。
