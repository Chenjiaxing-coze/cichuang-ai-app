import express from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { signAccessToken, signRefreshToken } from '../crypto.js';
import { config } from '../config.js';
import { writeAudit } from '../middleware/audit.js';

const router = express.Router();

/**
 * 微信扫码登录（微信开放平台「网站应用」OAuth，qrconnect 流程）。
 *
 * 流程：
 *  1) App 调用 POST /api/auth/wechat/start（需 HMAC 签名）→ 拿到 qrUrl + state
 *  2) App 在 WebView/浏览器中展示 qrUrl，用户微信扫码并授权
 *  3) 微信 302 重定向到 redirect_uri（即 /api/auth/wechat/callback?code&state），
 *     由用户浏览器发起，无法携带本系统 HMAC 签名头，故该接口在 index.js 中
 *     于签名守卫之前单独挂载，安全性由一次性随机 state 保证。
 *  4) App 轮询 GET /api/auth/wechat/status?state=...（需 HMAC 签名）拿令牌。
 */

// 微信 OAuth 状态机（进程内存；单机/开发足够，生产若多实例需改为共享存储，如 Redis）。
// state -> { status:'pending'|'done'|'error', createdAt, user?, accessToken?, refreshToken? }
const states = new Map();
const STATE_TTL = 5 * 60 * 1000; // 5 分钟

function makeAppUser(user) {
  return { id: user.id, nickname: user.nickname, avatar: user.avatar, method: user.method, loginTime: Date.now() };
}

function issueTokens(uid) {
  const jti = crypto.randomUUID();
  const accessToken = signAccessToken({ id: uid });
  const refreshToken = signRefreshToken(uid, jti);
  db.prepare('INSERT INTO refresh_tokens(id,uid,jti,expires_at,revoked,created_at) VALUES(?,?,?,?,0,?)')
    .run('rt_' + jti, uid, jti, Date.now() + 7 * 86400 * 1000, Date.now());
  return { accessToken, refreshToken };
}

// 清理过期 state；Map 过大时强制清理（防内存泄漏）
function cleanupStates() {
  const now = Date.now();
  if (states.size > 1000) {
    for (const [k, v] of states) if (now - v.createdAt > STATE_TTL) states.delete(k);
  }
}

// fetch 带超时（Node18+ 全局 fetch + AbortController）
async function fetchWithTimeout(url, opts = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function okHtml(title, desc) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f5f5f7;font-family:system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif">
<div style="text-align:center;padding:36px 28px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:80%">
<div style="font-size:52px;line-height:1">${title.includes('成功') ? '✅' : '❌'}</div>
<p style="font-size:19px;color:#1a1a1a;margin:18px 0 6px">${title}</p>
<p style="font-size:14px;color:#888;margin:0">${desc}</p>
</div>
</body>
</html>`;
}

// 1) 发起扫码：返回二维码 URL 与 state
router.post('/auth/wechat/start', (req, res) => {
  const { appid, redirectUri } = config.wechat;
  if (!appid) {
    return res.json({ success: false, msg: '微信登录未配置（需微信开放平台 appid/secret）' });
  }
  cleanupStates();
  const state = crypto.randomUUID();
  states.set(state, { status: 'pending', createdAt: Date.now() });
  const qrUrl =
    `https://open.weixin.qq.com/connect/qrconnect?appid=${appid}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=snsapi_login&state=${state}`;
  return res.json({ success: true, appid, redirectUri, state, qrUrl });
});

// 2) 轮询登录结果（App 侧，需 HMAC 签名）
router.get('/auth/wechat/status', (req, res) => {
  const { state } = req.query || {};
  const rec = state && states.get(state);
  if (!rec || Date.now() - rec.createdAt > STATE_TTL) {
    return res.json({ success: false, msg: '登录失败或已过期，请重试' });
  }
  if (rec.status === 'pending') return res.json({ success: true, pending: true });
  if (rec.status === 'done') {
    return res.json({
      success: true,
      user: rec.user,
      accessToken: rec.accessToken,
      refreshToken: rec.refreshToken
    });
  }
  // error
  return res.json({ success: false, msg: '登录失败或已过期，请重试' });
});

// 3) 微信回调（微信开放平台 302 重定向；浏览器发起，无 HMAC 签名头，见 index.js 单独挂载）
export const wechatCallback = async (req, res) => {
  const { code, state } = req.query || {};
  const rec = state && states.get(state);
  if (!rec || rec.status !== 'pending' || Date.now() - rec.createdAt > STATE_TTL) {
    return res.header('Content-Type', 'text/html; charset=utf-8')
      .send(okHtml('微信登录失败', '登录状态无效或已过期，请在 App 中重试'));
  }
  try {
    const { appid, secret } = config.wechat;
    // 3.1 用 code 换取 access_token + openid
    const tokenUrl =
      `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appid}` +
      `&secret=${secret}&code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    const tokenResp = await fetchWithTimeout(tokenUrl);
    const tokenData = await tokenResp.json();
    if (tokenData.errcode) {
      throw new Error(`微信换取令牌失败: ${tokenData.errmsg || tokenData.errcode}`);
    }
    const { access_token, openid } = tokenData;
    if (!access_token || !openid) throw new Error('微信返回数据缺少 access_token/openid');

    // 3.2 用 access_token + openid 拉取用户信息
    const infoUrl =
      `https://api.weixin.qq.com/sns/userinfo?access_token=${encodeURIComponent(access_token)}` +
      `&openid=${encodeURIComponent(openid)}`;
    const infoResp = await fetchWithTimeout(infoUrl);
    const infoData = await infoResp.json();
    if (infoData.errcode) {
      throw new Error(`微信获取用户信息失败: ${infoData.errmsg || infoData.errcode}`);
    }
    const nickname = infoData.nickname || ('微信用户_' + openid.slice(-4));
    const avatar = infoData.headimgurl || nickname.slice(0, 1);

    // 3.3 以 openid 为主键 upsert 用户（users 表无 openid 列，用 phone_enc 占位区分）
    const phoneEnc = 'wx_' + openid;
    let user = db.prepare('SELECT * FROM users WHERE phone_enc=?').get(phoneEnc);
    if (!user) {
      const id = 'u_' + crypto.randomUUID();
      db.prepare('INSERT INTO users(id,phone_enc,nickname,avatar,method,created_at) VALUES(?,?,?,?,?,?)')
        .run(id, phoneEnc, nickname, avatar, 'wechat', Date.now());
      user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
    } else {
      // 每次登录刷新昵称/头像，保持最新
      db.prepare('UPDATE users SET nickname=?, avatar=? WHERE id=?').run(nickname, avatar, user.id);
      user = db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
    }

    // 3.4 签发双令牌并写回 state
    const tokens = issueTokens(user.id);
    const appUser = makeAppUser(user);
    rec.status = 'done';
    rec.user = appUser;
    rec.accessToken = tokens.accessToken;
    rec.refreshToken = tokens.refreshToken;
    writeAudit({ uid: user.id, action: 'login_wechat', ip: req.ip, detail: 'wx:' + openid.slice(0, 6) + '...' });

    return res.header('Content-Type', 'text/html; charset=utf-8')
      .send(okHtml('微信登录成功', '请返回词创AI App 继续'));
  } catch (e) {
    console.error('[wechat] callback error:', e.message);
    if (rec) rec.status = 'error';
    return res.header('Content-Type', 'text/html; charset=utf-8')
      .send(okHtml('微信登录失败', '请返回词创AI App 重试（' + e.message + '）'));
  }
};

export default router;
