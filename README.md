# 词创AI · 跨端安装包工程（安卓 APK + 鸿蒙 HAP）

把「词创AI」H5 单页应用改造为可安装到安卓 / 鸿蒙手机的原生安装包，配套真实后端与等保二级安全基线。
技术路线：**混合渐进**——H5 内核 + WebView 套壳（安卓）/ ArkWeb 套壳（鸿蒙）+ 真实云后端。

## 目录导航

| 路径 | 作用 |
|------|------|
| `词创AI_app.html` | 改造后的 H5 内核（真实后端 API 层 + 原生桥接 + 离线降级） |
| `tailwind.css` | 本地化样式（由 `tailwind-build/` 生成，离线不崩） |
| `app-config.js` | 运行配置：`API_BASE`（后端域名）、`SIGN_SECRET`（签名密钥） |
| `tailwind-build/` | Tailwind 本地构建（`npm run build` 重新生成 `tailwind.css`） |
| `backend/` | Node.js 真实后端（鉴权、社区、同步、等保基线），含 CFC 适配 + 15 项 E2E 测试 |
| `android/` | Android WebView 套壳工程（Android Studio 编译 APK） |
| `harmony/` | HarmonyOS NEXT ArkWeb 套壳工程（DevEco Studio 编译 HAP/APP） |
| `download.html` | 自分发下载落地页（分享给朋友用） |
| `部署与运维安全手册.md` | 后端上云、HTTPS、短信、等保二级、运维巡检 |
| `词创AI_APP开发方案_v2.0.md` | 落地版总体方案（已与用户确认） |

## 快速上手

1. **改配置**：编辑 `app-config.js` 填入你的 `API_BASE`（HTTPS 域名）。
2. **起后端**：`cd backend && npm install && cp .env.example .env && npm start`，再 `node test_e2e.mjs` 看 15 项全绿。
3. **出安卓包**：Android Studio 打开 `android/`，按 `android/README.md` 签名编译。
4. **出鸿蒙包**：DevEco Studio 打开 `harmony/`，按 `harmony/README.md` 签名编译。
5. **分发**：把安装包放到对象存储，更新 `download.html` 两个按钮链接，部署该页到 HTTPS 静态托管。

## 安全基线（等保二级，从第一天做起）
接口 HMAC-SHA256 签名防重放 · JWT 双令牌 · AES-256-GCM 加密手机号 · 限流 · 内容审核 · 审计日志 · 强制 HTTPS · 原生令牌加密存储。

> 详见 `部署与运维安全手册.md`。任何「上线确认」项未勾选，不要对外分发。
