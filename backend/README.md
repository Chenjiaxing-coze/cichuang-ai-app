# 词创AI 后端服务（v1.0）

手机验证码登录 · 社区（发布/点赞/评论/举报）· 云端数据同步。零构建、可本地直跑（SQLite），生产可切云数据库（MySQL）+ 百度云函数（CFC）。

## 技术栈
- Node.js ≥ 18（ESM）
- Express 4
- better-sqlite3（开发/自托管；生产参考 `migrations/mysql.sql` 切 MySQL）
- jsonwebtoken（双令牌）· bcryptjs（预留密码场景）· zod（入参校验预留）· 自研 AES-256-GCM（PII 加密）

## 安全基线（等保二级）
- 全站签名校验：客户端 HMAC-SHA256（`method\npath\ntimestamp\nnonce`），服务端验签 + 时间戳容差 ±5min + nonce 5min 防重放。
- 双令牌：accessToken 2h / refreshToken 7d，refresh 时旧令牌立即吊销（轮换）。
- PII 加密：手机号 AES-256-GCM 落库；接口返回脱敏（`138****8888`）。
- 限流：单 IP 单分钟 60 次（生产建议 Redis）。
- 内容审核：发布/评论走关键词过滤（生产建议接 AI 审核）。
- 审计日志：登录、发帖、评论、同步均落 `audit_logs`。
- 安全响应头 + CORS 白名单 + 1MB 请求体限制。

> 注意：签名密钥 `SIGN_SECRET` 同时存在于前端 `window.__APP_CONFIG__.SIGN_SECRET` 与后端 `.env`，上线前务必改为随机长串并对齐。本密钥用于接口完整性/防重放，**不是**数据加密密钥。

## 快速开始（本地）
```bash
cd backend
cp .env.example .env      # 按需修改（开发默认值即可跑通）
npm install
npm start                 # http://localhost:3000
```
健康检查：`GET /health` → `{ok:true}`。

## 环境变量（.env）
见 `.env.example`，关键项：
- `SIGN_SECRET` / `JWT_SECRET`：上线前改为强随机串
- `DB_TYPE=sqlite` 或 `mysql`（`DB_MYSQL_URL`）
- `SMS_PROVIDER=dev`（控制台打印验证码）或 `aliyun`（需填阿里云密钥）
- `CORS_ORIGIN`：前端调试/下载页域名

## API 清单
| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | `/api/auth/sms/send` | 否（签名） | 发送验证码（dev 返回 `devCode`） |
| POST | `/api/auth/sms/verify` | 否（签名） | 校验并登录，返回双令牌 + 用户 |
| POST | `/api/auth/refresh` | 刷新令牌 | 轮换签发新双令牌 |
| POST | `/api/auth/logout` | accessToken | 吊销 refreshToken |
| GET | `/api/community/posts?tab=latest\|hot\|mine` | 否 / 登录(mine) | 帖子列表 |
| GET | `/api/community/posts/:id` | 否 | 帖子详情+评论 |
| POST | `/api/community/posts` | 是 | 发布（内容审核） |
| POST | `/api/community/posts/:id/like` | 是 | 点赞/取消 |
| POST | `/api/community/posts/:id/comment` | 是 | 评论 |
| POST | `/api/community/report` | 否 | 举报 |
| GET | `/api/sync` | 是 | 拉取云端备份（解密） |
| POST | `/api/sync` | 是 | 上传云端备份（加密） |

## 部署到百度智能云 CFC
1. 在 CFC 创建「Node.js 18」函数，HTTP 触发器。
2. 将 `backend/` 打包上传（含 `node_modules`，或改用「层」挂载依赖）。
3. 入口：`src/cfc.js` 的 `handler`。
4. 环境变量在 CFC 控制台配置（`SIGN_SECRET`/`JWT_SECRET`/`DB_*`/`SMS_*`）。
5. 生产建议把 `src/db.js` 数据访问层替换为 `migrations/mysql.sql` 的 MySQL（云数据库，开启自动备份 + SQL 审计）。

## 前端对接要点（H5 / 原生壳）
- 原生壳需注入 `window.__APP_CONFIG__ = { API_BASE: 'https://你的后端域名', SIGN_SECRET: '与后端一致' }`。
- 浏览器本地调试若不注入，默认 `API_BASE=''`（同源）、`SIGN_SECRET='wc_anon_secret_2026_dev'`，需将后端 `.env` 的 `SIGN_SECRET` 也设为该值。
- 离线时社区/同步自动降级到本地缓存，不白屏。
