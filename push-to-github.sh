#!/usr/bin/env bash
# ============================================================
# 词创AI · 一键推送到 GitHub 并触发云端构建 APK
# ------------------------------------------------------------
# 为什么需要你跑这一下：
#   研发部这边的 GitHub 连接器"无建仓权限"（403），无法代替你创建仓库；
#   本机到谷歌(Android SDK/Maven)网络不通，也无法在本地编译。
#   所以由你在 GitHub 点一下建仓，再用本脚本推送，剩余全自动。
#
# 用法：
#   bash push-to-github.sh <你的GitHub用户名> <个人访问令牌PAT>
# 例：
#   bash push-to-github.sh Chenjiaxing-coze ghp_xxxxxxxxxxxx
#
# PAT 获取：GitHub → Settings → Developer settings → Personal access tokens
#           → Fine-grained token，勾选 Repository access = 目标仓库，Permissions: Contents = Read and write
#           （用完后可到 GitHub 设置里 Revoke 吊销，更安全）
# ============================================================
set -euo pipefail

USER_ARG="${1:}"
TOKEN="${2:}"
REPO="cichuang-ai-app"

if [ -z "$USER_ARG" ] || [ -z "$TOKEN" ]; then
  echo "用法: bash push-to-github.sh <GitHub用户名> <PAT>"
  exit 1
fi

cd "$(dirname "$0")"

echo "==> 初始化 git 仓库"
git init -q 2>/dev/null || true
git symbolic-ref HEAD refs/heads/main 2>/dev/null || git checkout -b main 2>/dev/null || true

echo "==> 配置本地身份（避免 commit 报错）"
git config user.email "${USER_ARG}@users.noreply.github.com" || true
git config user.name "${USER_ARG}" || true

echo "==> 暂存并提交（.gitignore 已排除 node_modules/.env/.workbuddy/运行库等）"
git add -A
if git diff --cached --quiet; then
  echo "    （没有改动需要提交）"
else
  git commit -q -m "词创AI v1.0.0：安卓 WebView + 鸿蒙 ArkWeb + Node 后端（等保二级基线）"
fi

echo "==> 关联远程仓库"
git remote remove origin 2>/dev/null || true
git remote add origin "https://${USER_ARG}:${TOKEN}@github.com/${USER_ARG}/${REPO}.git"

echo "==> 推送到 main（会触发 GitHub Actions 自动编译）"
git push -u origin main --force

cat <<'DONE'

✅ 已推送完成！接下来全自动：
   1. 打开 https://github.com/<你>/<REPO>/actions 查看 "Build Android APK" 构建进度（首次约 8-15 分钟）。
   2. 构建成功后，APK 会自动发布到仓库的 Releases → "nightly"（tag），可直接下载链接分享给朋友。
      也可在 Actions → Artifacts 下载 app-debug-apk。

⚠️ 安全提醒：令牌含在命令里，建议推送成功后到 GitHub Settings 吊销该 PAT。
   若想更稳妥，可改用 SSH 或凭据管理器，不必在本脚本里明文写令牌。

DONE
