# 鸿蒙 HarmonyOS NEXT · AppGallery Connect 上架实操手册

> 目标：把 `harmony/` 工程通过华为官方云端构建产出可安装的 HAP/APP，分发给鸿蒙用户。
> 前提：**需要你本人的华为开发者联盟账号（实名认证）**——研发部无法代登，也不应持有你的账号。

---

## 0. 为什么鸿蒙不能像安卓那样用 GitHub Actions 自动出包

HarmonyOS SDK（DevEco / hvigor）是**授权-gated** 的，华为不接受在 GitHub 公共 runner 上安装其 SDK，且缺少华为签名证书无法产出可安装包。因此鸿蒙的"云端编译机"只有两条正路：
- **A. AppGallery Connect 云端构建**（推荐，无需本机装 DevEco）
- **B. 本机 DevEco Studio 构建**（需本机装几 GB SDK）

下面以 A 为主。

---

## 1. 前置：注册并实名

1. 打开 https://developer.huawei.com/consumer/cn/ ，注册华为账号并完成**实名认证**（个人或企业均可，个人即可自分发）。
2. 加入"华为开发者联盟"。

---

## 2. 在 AppGallery Connect 创建应用

1. 登录 https://developer.huawei.com/consumer/cn/appgallery/ （AppGallery Connect，简称 AGC）。
2. 新建项目（如"词创AI"）→ 添加应用：
   - 应用名称：词创AI
   - **应用包名（Bundle name）：`com.cichuang.ai`**（必须与 `harmony/entry/src/main/module.json5` 及 AppScope 中一致，**不可更改**）
   - 应用类型：HarmonyOS 应用（NEXT / API 12+）
3. 记录系统分配的 **APP ID**（形如 `xxxxxxxx`）。

---

## 3. 连接工程代码

`harmony/` 已是标准 HarmonyOS NEXT（Stage 模型）工程：
- `AppScope/app.json5`、`build-profile.json5`、`oh-package.json5`
- `entry/src/main/module.json5`（已声明 `ohos.permission.INTERNET` + EntryAbility）
- `entry/src/main/ets/`（EntryAbility + Index 页 `Web().javaScriptProxy` 注入 `window.__NATIVE__` + NativeBridge）
- `entry/src/main/resources/rawfile/词创AI_app.html`（H5 内核，随包安装、离线可用）

**两种接入方式：**
- **AGC 云端构建**：在 AGC「构建」里选择"从代码仓库构建"，可绑定 GitHub/Gitee 仓库（把 `harmony/` 推上去）；或下载 `harmony/` 目录打包上传 ZIP。
- **本机 DevEco**：用 DevEco Studio 打开 `harmony/` 目录，按提示下载 SDK。

---

## 4. 配置签名（关键，否则装不到手机）

- **推荐：AGC 托管签名**——在 AGC「证书与描述文件」里让华为**自动生成并托管**签名证书和 Profile，最省心，无需本机 keytool。
- 或自签名：本机用 `keytool` 生成 `.p12` + `.csr`，上传到 AGC 申请发布证书与 Profile，下载后配置到工程的签名模块（`build-profile.json5` 的 `signingConfigs`）。

> 自分发阶段，调试/发布 Profile 均可；上架应用市场才需要发布证书。

---

## 5. 触发云端构建并下载

1. AGC → 构建 → 新建构建任务，选择工程/仓库、`entry` 模块、构建类型 **APP**（或 HAP）。
2. 等待构建完成（首次会拉依赖，稍慢）。
3. 下载产物：`.app`（真机可直接安装）或 `.hap`。
   - 真机安装：把 `.app` 传到鸿蒙手机，用文件管理器点按安装；或 `hdc install xxx.app`（需开 USB 调试）。

---

## 6. 分发与安装注意

- 鸿蒙 NEXT 安装"未知来源"应用：设置 → 系统 → 开发者选项 / 或安装时按提示允许。
- 分享给朋友：把 `.app`/`.hap` 放对象存储，改 `download.html` 鸿蒙卡片按钮 `href` 为直链（当前为占位，见文件内注释）。

---

## 7. 与后端联调

H5 内核里的 `app-config.js` 已随包进入 `rawfile/`：
- 上线前把 `API_BASE` 改成你后端 **HTTPS 域名**，`SIGN_SECRET` 与后端 `.env` 一致。
- 原生桥接口（存储/加密令牌）在安卓与鸿蒙**命名一致**（`window.__NATIVE__`），H5 无需区分平台。

---

## 附：本机构建（可选，不依赖 AGC）

装 DevEco Studio → 打开 `harmony/` → 配置签名 → Build → Build Hap(s)/APP(s)。适合反复调试；一次性出包用 AGC 云端构建更省事。
