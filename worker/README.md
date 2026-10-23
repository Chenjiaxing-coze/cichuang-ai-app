# 词创AI 后端 · Cloudflare Workers + D1 部署指南

0 成本、无需信用卡（Cloudflare 免费档）。本里程碑：手机验证码（dev 模式）+ 双令牌 JWT 登录。
社区 / 同步 / 微信登录接口暂不在此部署（微信需 ¥300 开放平台认证，社区日后上线）。

> ⚠️ 中国大陆可达性提示
> Cloudflare 免费/Pro 套餐**无中国大陆节点**。在中国大陆访问 Workers 可能延迟高、偶发不通。
> 应对：① 核心「提示词浏览+复制」完全离线，不受影响；② 登录后端走 Cloudflare，国内偶发不稳时
> 登录会自动降级提示、核心照常；③ 部署时**务必绑定你自己的自定义域名**（比 `*.workers.dev` 稳很多）；
> ④ 若实测国内仍不稳，再考虑加一个中国可达的镜像（那一步非 0 成本）。

## 0. 前置
- 注册 Cloudflare 账号（免费，无需信用卡）。
- 本机装好 Node 18+，进入 `worker/` 目录（依赖已 `npm install`）。

## 1. 登录 Cloudflare（一次性）
```bash
npx wrangler login        # 浏览器授权；企业网络可改用下面的 API Token
# 或：在 CF 控制台 → My Profile → API Tokens 建一个含 D1 + Workers 编辑权限的 Token，
#   然后：export CLOUDFLARE_API_TOKEN=xxxx
```

## 2. 创建 D1 数据库（一次性）
```bash
npx wrangler d1 create cichuang-ai
# 把返回的 uuid 填进 wrangler.toml 的 database_id
```

## 3. 生成并设置强密钥（务必！>=32 字节随机）
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# 用上面输出分别设置 JWT_SECRET 与 AES_KEY（生产请用 secret，不写进文件）：
npx wrangler secret put JWT_SECRET
npx wrangler secret put AES_KEY
# 非敏感开关已在 wrangler.toml 的 [vars]：ALLOW_DEV_SMS=true / NODE_ENV=production
```

## 4. 初始化表结构 + 部署
```bash
npx wrangler d1 execute cichuang-ai --file=./src/schema.sql        # 生产库
npx wrangler deploy                                          # 部署到 *.workers.dev
# 部署成功会输出地址，如 https://cichuang-ai.<你的子域>.workers.dev
```

## 5. 绑定自定义域名（强烈建议，提升国内稳定性）
CF 控制台 → Workers & Pages → cichuang-ai → Settings → Domains → 添加你的域名（需该域名 NS 在 CF）。
绑定后地址变为 `https://你的域名`，把前端 `API_BASE` 设为它。

## 6. 本地联调（无需登录）
```bash
npm run db:init:local      # 初始化本地 D1 表
npm run dev                # http://localhost:8787
# 另开一个终端快速自测：
#   curl -s -X POST localhost:8787/api/auth/sms/send -H 'Content-Type: application/json' -d '{"phone":"13800001234"}'
```

## 7. 联调前端（让 App 真正能登录）
拿到 Worker 地址（步骤 4/5）后，把 `API_BASE` 填入：
- `android/app/src/main/assets/www/app-config.js`
- `harmony/entry/src/main/resources/rawfile/app-config.js`
- `preview/app-config.js`
然后提交并推送 `android/**` → GitHub Actions 自动重建 APK，新包登录即接通。
（也可直接告诉开发者你的 Worker 地址，由开发者改完重出包。）

## 验证（本仓库已内置）
```bash
node test-local.mjs        # 14 项全链路断言：发码/校验/双令牌/刷新/吊销/登出/AES 落库
```
