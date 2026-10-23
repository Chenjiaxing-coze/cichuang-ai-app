# 词创AI · 跨端 AI 提示词平台

内置 100 条专业 AI 提示词，用户复制后可在豆包 / 通义 / 文心 / DeepSeek 等任意 AI 中使用。
提供**安卓 / 鸿蒙安装包**与**网页版**两种形态，**0 成本部署**，安全基线从第一天做起（等保二级思路）。

## 目录导航

| 路径 | 作用 |
|------|------|
| `词创AI_app.html` | H5 内核（提示词库 + 原生桥接 + 离线降级），三端共用的单一事实源 |
| `tailwind.css` | H5 内核本地化样式（离线不崩） |
| `app-config.js` | 运行配置：`API_BASE`（后端域名）、`SIGN_SECRET`（签名密钥） |
| `worker/` | 后端：Cloudflare Workers + D1（0 成本、免信用卡），短信验证码(dev) + JWT 双令牌 |
| `backend/` | Node.js 备用后端（含 E2E 测试），用于自托管 / 等保二级进阶 |
| `android/` | Android WebView 套壳工程（GitHub Actions 自动出 APK） |
| `harmony/` | HarmonyOS NEXT ArkWeb 套壳工程（华为 AGC 云端构建） |
| `web/` | 网页版（静态站点，Cloudflare Pages 部署，朋友打开链接即用） |
| `preview/` | 离线预览工程 |

## 快速上手

### 后端（Cloudflare Workers + D1，0 成本）
1. 安装并登录：`npm i -g wrangler && wrangler login`
2. 建库：`wrangler d1 create cichuang-ai`（把返回的 id 填入 `worker/wrangler.toml`）
3. 注入强密钥：`wrangler secret put JWT_SECRET` / `wrangler secret put AES_KEY` / `wrangler secret put SMS_DEV_CODE`
4. 建表：`wrangler d1 execute cichuang-ai --local --file=worker/src/schema.sql`，再去掉 `--local` 对生产库执行一次
5. 部署：`cd worker && wrangler deploy`
6. 把 Worker 地址填入三处 `app-config.js` 的 `API_BASE`，推送 GitHub 触发 APK 重建

### 网页版（Cloudflare Pages，0 成本、无需备案）
网页版为纯静态站点（`web/index.html` + 本地 `web/assets/styles.css`），**无需后端即可浏览 / 复制 / 收藏**。
1. 在仓库 **Settings → Secrets** 添加 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`
2. 推送到 `main`（改动 `web/**` 自动触发 `.github/workflows/deploy-web.yml`）
3. 首次部署自动创建 Pages 项目 `cichuang-ai-web`，得到 `https://cichuang-ai-web.pages.dev` 链接，分享给朋友即可
4. 登录（手机验证码）对接上面的 Worker：在 `web/index.html` 顶部设置 `window.CICHUANG_API_BASE = "https://<你的worker>.workers.dev"`；未设置时自动降级为本地演示模式

> **中国大陆访问说明**：Cloudflare 无中国大陆节点，`*.pages.dev` 通常可用但偶发偏慢；核心提示词浏览 / 复制不依赖后端，离线也能用。如需更稳定，可在 Cloudflare 绑定自定义域名并开启 China CDN（付费），或改用国内静态托管镜像（需实名 / 备案）。

## 安全基线（等保二级思路，从第一天做起）
接口 HMAC-SHA256 签名防重放 · JWT 双令牌 · AES-256-GCM 加密手机号 · 限流 · 内容审核 · 审计日志 · 强制 HTTPS · 前端全量转义 · 原生令牌加密存储。详见 `部署与运维安全手册.md`。

> 任何「上线确认」项未勾选，不要对外分发。
