# Need

## 当前你需要提供（按优先级）

### P0（不提供会卡住联调）

- [x] `DATABASE_URL` 可连接
  - 状态：已提供并验证（2026-02-24）；连通成功，已完成初始化建表
  - 目标值：可直接用于 Prisma 读写的 PostgreSQL 连接串
  - 示例检查：`npm run prisma:generate && npm run prisma:migrate`
- [x] 生产级 `JWT_SECRET`
  - 状态：已提供（2026-02-23）
  - 目标值：长度 >= 32 的强随机字符串（写入 `.env.server`）
  - 风险：使用弱密钥会导致 token 可伪造

### P1（建议本周提供）

- 邮箱验证码通道
  - 状态：待提供
  - 需要：SMTP 或邮件 API 的 host/key/from
  - 当前现状：开发环境返回 `debugCode`
- 手机验证码通道
  - 状态：待提供
  - 需要：短信服务商 appId/appSecret/签名模板
  - 当前现状：开发环境返回 `debugCode`
- 联调测试账号
  - 状态：待提供
  - 需要：`teacher`、`admin` 两类账号（邮箱或手机号）

### P2（微信登录接入前必须提供）

- 微信开放平台配置
  - 状态：待提供
  - 需要：
    - `WECHAT_APP_ID`
    - `WECHAT_APP_SECRET`
    - `WECHAT_REDIRECT_URI`（HTTPS 公网可达）
- 账号合并策略确认
  - 状态：待确认
  - 需要确认：微信首次登录时，是否允许合并到已存在邮箱/手机号账号

## 已完成（无需再提供）

- 前端登录入口（邮箱/验证码）已就位
- 前端角色切换（admin/teacher/viewer）已就位
- 鉴权失败自动引导登录弹窗已就位
