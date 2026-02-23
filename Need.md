# Need

## 1) 当前阶段（邮箱/手机号登录可用）你需要提供

- PostgreSQL 连接可用
  - 确认 `DATABASE_URL` 对应的数据库已启动并可连接。
- 生产 JWT 密钥
  - 在 `.env.server` 设置强随机 `JWT_SECRET`（不要使用示例值）。
- （可选）验证码通道配置（当前开发版会返回 `debugCode`）
  - 短信服务商账号与签名（用于手机号验证码）。
  - 邮件服务 SMTP/邮件 API（用于邮箱验证码）。

## 2) 微信登录（下一阶段）你需要提供

- 微信开放平台应用信息
  - `WECHAT_APP_ID`
  - `WECHAT_APP_SECRET`
  - `WECHAT_REDIRECT_URI`
- 回调域名与路径
  - 确认可公网访问的回调地址（HTTPS）。
- 绑定策略确认
  - 微信首次登录后，是否允许与已存在邮箱/手机号账号合并。

## 3) 前端联调信息（建议）

- 预置测试账号（邮箱 + 密码）各 1 组
- 预置测试手机号各 1 组（teacher/admin）
- 是否启用严格鉴权默认开关
  - 建议开发环境：`AUTH_DEV_FALLBACK=true`
  - 建议联调环境：`AUTH_DEV_FALLBACK=false`
