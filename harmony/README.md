# 词创AI · 鸿蒙安装包（HarmonyOS NEXT / ArkWeb 套壳）

把改造后的 H5 内核（`词创AI_app.html` + `tailwind.css` + `app-config.js`）放进 `entry/src/main/resources/rawfile/`，用 **DevEco Studio** 编译出 HAP / APP（.app）。

> 适用目标：HarmonyOS NEXT（API 12，Stage 模型）。"Web-Ability" 在本脚手架中即「承载 ArkWeb 组件的 Page Ability（EntryAbility）」。

## 目录约定
```
entry/src/main/
  ├─ resources/rawfile/
  │    ├─ 词创AI_app.html   # H5 内核（已含真实后端 API 层 + 原生桥接）
  │    ├─ tailwind.css      # 本地化样式（离线不崩）
  │    └─ app-config.js     # 后端地址 / 签名密钥（构建前填好）
  ├─ ets/
  │    ├─ entryability/EntryAbility.ets   # 应用入口
  │    ├─ pages/Index.ets                 # 承载 Web 组件的首页
  │    └─ bridge/NativeBridge.ets         # window.__NATIVE__ 桥接
  └─ module.json5
```

## 配置后端地址（上线前必做）
编辑 `entry/src/main/resources/rawfile/app-config.js`：
```js
window.__APP_CONFIG__ = {
  API_BASE: "https://你的后端域名",      // 例如 https://api.cichuang.com
  SIGN_SECRET: "与后端 .env 的 SIGN_SECRET 完全一致"
};
```
若 `API_BASE` 留空，则请求走同源（仅适合本地联调）。

## 编译 HAP / APP
1. 安装 [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/)（NEXT 版本）并配置 HarmonyOS SDK（API 12）。
2. 打开本 `harmony/` 工程，等待依赖同步（oh-package）。
3. **配置签名**：File → Project Structure → Signing Configs → 登录华为账号自动生成调试证书；发布需在 [AppGallery Connect](https://developer.huawei.com/consumer/cn/service/josp/agc/index.html) 申请发布证书。
4. Build → Build HAP(s) / APP 输出 `entry/build/outputs/` 下的 `entry-default-signed.hap` 或 `.app`。

## 原生桥接说明（与 Android 接口一致）
`Index.ets` 通过 `Web().javaScriptProxy(...)` 把 `NativeBridge` 实例注入为 H5 侧的 `window.__NATIVE__`，方法名与 Android 完全一致：
- `window.__NATIVE__.storageGet/storageSet`：普通本地存储（7 个键）
- `window.__NATIVE__.secureGet/secureSet`：敏感存储（access_token / refresh_token）

> 安全说明：v1.0 基线中 secure 层使用应用沙箱 Preferences（仅本应用可读写）。生产环境建议将 `secureGet/secureSet` 迁移到 **Asset Store Kit**（`@ohos.security.asset`，硬件级加密），本脚手架已在 `NativeBridge.ets` 注释中标注升级点。

## 联网与协议
- `module.json5` 已声明 `ohos.permission.INTERNET`。
- ArkWeb 默认仅允许 HTTPS 资源，后端请使用 HTTPS 域名。

## 自检清单
- [ ] `app-config.js` 的 `API_BASE` 已改为正式 HTTPS 域名
- [ ] `SIGN_SECRET` 与后端 `.env` 完全一致
- [ ] rawfile 下三个文件齐全且为最新版（H5 内核更新后需重新复制）
- [ ] DevEco 已配置签名（否则无法安装到真机）
- [ ] release 构建开启混淆，且 `obfuscation-rules.txt` 保留了 `NativeBridge` / `EntryAbility`
