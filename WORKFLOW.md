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

## Git 写操作三层防御（强制）

### 第一层：行为约束（预防并发）

1. 同一仓库内禁止并行执行任何 git 命令。
2. `commit/push/pull/merge/rebase` 执行期间，不开启新终端执行 git。
3. git 写操作必须严格串行：
   - `status -> add -> commit -> push`

### 第二层：锁检测与自愈（自动清理）

在任何 git 写操作前，先检查：

```bash
ps aux | egrep '[g]it|[s]sh|[g]pg'
find .git -name '*.lock'
```

处理规则：

- 若存在活跃 git 进程：等待其结束，不并发执行下一条 git 写命令。
- 若无活跃进程但有 lock 残留：确认后删除 lock，再继续写操作。

### 第三层：系统级互斥（终极稳定）

所有 git 写操作优先使用互斥锁封装执行（推荐脚本）：

```bash
bash scripts/git-write-guard.sh commit -m "feat(...)"
bash scripts/git-write-guard.sh push origin main
```

说明：

- 脚本会自动做进程检查、残留 lock 清理、`flock` 互斥串行。
- 这一步可避免多会话/自动化任务同时触发 git 写操作。

## 规范执行脚本（推荐）

在阶段提交前执行：

```bash
bash scripts/pre-push-check.sh "feat(phase-4.17): ..."
```

检查项：

- 当前阶段是否已更新并暂存 `PLAN.md`
- 是否存在非白名单未跟踪文件（默认允许 `test_image/`、`test_output/`）
- 提交信息是否符合 `feat|fix|chore(phase-x.y)` 模板
