# 词创AI · Android 安装包（WebView 套壳）

把改造后的 H5 内核（`词创AI_app.html` + `tailwind.css` + `app-config.js`）放进 `app/src/main/assets/www/`，用 Android Studio 编译出 APK。

## 目录约定
```
app/src/main/assets/www/
  ├─ 词创AI_app.html     # H5 内核（已含真实后端 API 层 + 原生桥接）
  ├─ tailwind.css        # 本地化样式（离线不崩）
  └─ app-config.js       # 后端地址 / 签名密钥（构建前填好）
```

## 配置后端地址（上线前必做）
编辑 `app/src/main/assets/www/app-config.js`：
```js
window.__APP_CONFIG__ = {
  API_BASE: "https://你的后端域名",      // 例如 https://api.cichuang.com
  SIGN_SECRET: "与后端 .env 的 SIGN_SECRET 完全一致"
};
```
若 `API_BASE` 留空，则请求走同源（仅适合本地联调）。

## 首次构建环境准备
1. 安装 [Android Studio](https://developer.android.com/studio) 与 Android SDK（API 34 平台）。
2. 在本目录新建 `local.properties`，写入 SDK 路径（Windows 反斜杠需双写）：
   ```properties
   sdk.dir=C\:\\Users\\你的用户名\\AppData\\Local\\Android\\Sdk
   ```
3. 本仓库已附带 `gradle/wrapper/`（Gradle 8.9）。若目录缺失 wrapper jar，请在 `android/` 下执行 `gradle wrapper --gradle-version 8.9`（需先装 Gradle），或直接用 Android Studio 打开会自动补全。

## 编译 APK
1. 用 Android Studio 打开本 `android/` 目录。
2. 等待 Gradle 同步完成（**AGP 版本已在 `settings.gradle` 的 `pluginManagement` 中声明为 8.5.2**，无需手动指定）。首次会下载依赖：AppCompat / WebKit。
3. 配置签名：菜单 Build → Generate Signed Bundle / APK → 创建/选择 keystore（**release 包必须签名，否则无法安装**）。
4. 选 release，输出 `app/release/app-release.apk`（arm64-v8a + armeabi-v7a 双架构默认包含）。

> 本脚手架已开启 minify（代码混淆）+ 仅 HTTPS。v1.0 调试/自分发阶段端上令牌走私有 SharedPreferences；生产签名 release 包建议切换为 `androidx.security.crypto.EncryptedSharedPreferences` 以符合等保二级"加密存储敏感凭据"要求（见 `AppBridge.java` 注释与《等保二级合规对照与整改报告.md》）。

## 原生桥接说明
`MainActivity` 通过 `addJavascriptInterface(new AppBridge(this), "__NATIVE__")` 注入原生存储：
- `window.__NATIVE__.storageGet/storageSet`：普通本地存储（7 个键）
- `window.__NATIVE__.secureGet/secureSet`：加密存储（access_token / refresh_token）
H5 内核启动时自动据此构桥，升级/重装后数据走云端同步兜底。
