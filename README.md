# perler-beads

拼豆图纸微信小程序 MVP，包含：

- `apps/api`：Fastify + Prisma API
- `apps/miniapp`：原生微信小程序前端
- `packages/shared`：前后端共享契约
- `packages/pattern-core`：图纸生成与导出核心逻辑

## 环境准备

建议环境：

- Node.js 25+
- npm 11+
- `sqlite3`
- 微信开发者工具

安装依赖：

```bash
npm install
```

## 本地启动 API

可参考 [`./.env.example`](./.env.example) 配置环境变量。开发模式下 API 默认：

- `PORT=3000`
- `DATABASE_URL=file:./dev.db`
- `STORAGE_ROOT=./.data`

启动方式：

```bash
npm run dev:api
```

如果只是验证测试，不需要先手动建库；API 测试会使用临时 SQLite 数据库和临时存储目录自举。

## 测试

运行全部工作区测试：

```bash
npm test --workspaces --if-present
```

单独运行 API 集成测试：

```bash
npm test -w @perler/api -- src/test/app.test.ts
```

单独运行小程序纯逻辑测试：

```bash
npm test -w @perler/miniapp
```

## 微信小程序本地调试

1. 打开微信开发者工具。
2. 选择 [`apps/miniapp/project.config.json`](./apps/miniapp/project.config.json) 作为项目配置。
3. 确认小程序当前请求的 API 地址为 `http://183.66.27.19:27099`。
4. 在开发环境中，当前登录链路使用后端内置的 `demo-code` 开发登录。
5. 按主链路手工验证：
   - 创作页选图
   - 上传并生成
   - 进入编辑页改格子
   - 保存为新版本
   - 导出图片到相册
   - 返回作品页确认 `currentVersionId` 已刷新

注意：`http://183.66.27.19:27099` 是当前联调地址。微信小程序正式发布前，请切换为已备案并配置到小程序合法域名里的 HTTPS 域名；HTTP IP 只能用于开发阶段或受限调试场景。

如果你把 API 部署到非开发环境，但暂时还没接入真实微信登录，请在服务端环境变量中显式设置 `ALLOW_DEMO_LOGIN=true`，否则小程序当前发送的 `demo-code` 会被后端拒绝，并显示 `Invalid code` 或 `Demo login disabled`。

## 当前 MVP 范围

已覆盖的核心链路：

- 登录
- 图片上传
- 生成拼豆图纸
- 编辑并保存新版本
- 收藏作品
- 导出当前版本

明确不在当前 MVP 的内容：

- 版本树
- 操作日志持久化
- 微信分享卡片
- 异步任务队列
- 品牌色卡强绑定
