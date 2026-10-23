// 词创AI 后端（Cloudflare Workers + D1）
// 本里程碑接口：手机验证码登录（dev 模式，0 成本）+ 双令牌 JWT。
// 认证入口 /api/auth/* 豁免 HMAC 签名（与前端约定一致：WebView file:// 下签名无意义，
// 登录安全由 HTTPS + JWT + 限流保障）。

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { genOtp, deriveAesKeyBytes, aesEncrypt, maskPhone, jwtSign, jwtVerify } from './crypto.js';

const app = new Hono();

// CORS：App 以 WebView file:// 加载，origin 为 null；不使用 credentials，故 * 即可。
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

// ──  helpers ──
function aesKeyBytes(c) {
  return deriveAesKeyBytes(c.env.AES_KEY || (c.env.JWT_SECRET + ':aes'));
}
const OTP_TTL = 5 * 60 * 1000;

// ── 短信发送（dev 模式：验证码落库并回传，不真实下发）──
app.post('/api/auth/sms/send', async (c) => {
  const { phone } = await c.req.json().catch(() => ({}));
  if (!/^1\d{10}$/.test(phone || '')) return c.json({ success: false, msg: '手机号格式不正确' }, 400);
  const code = genOtp();
  const expires = Date.now() + OTP_TTL;
  await c.env.DB
    .prepare('INSERT OR REPLACE INTO sms_codes(phone, code, expires_at) VALUES(?, ?, ?)')
    .bind(phone, code, expires)
    .run();
  // dev 模式：把验证码回传便于联调（生产接阿里云后不再返回）
  return c.json({ success: true, devCode: code, msg: 'dev 模式验证码（仅自用，请勿外泄）' });
});

// ── 短信校验 + 登录/注册 + 发双令牌 ──
app.post('/api/auth/sms/verify', async (c) => {
  const { phone, code } = await c.req.json().catch(() => ({}));
  if (!/^\d{6}$/.test(code || '')) return c.json({ success: false, msg: '验证码需为6位数字' }, 400);
  const rec = await c.env.DB.prepare('SELECT * FROM sms_codes WHERE phone=?').bind(phone).first();
  if (!rec) return c.json({ success: false, msg: '请先获取验证码' }, 400);
  if (rec.expires_at < Date.now()) {
    await c.env.DB.prepare('DELETE FROM sms_codes WHERE phone=?').bind(phone).run();
    return c.json({ success: false, msg: '验证码已过期' }, 400);
  }
  if (rec.code !== code) return c.json({ success: false, msg: '验证码错误' }, 400);
  await c.env.DB.prepare('DELETE FROM sms_codes WHERE phone=?').bind(phone).run();

  const keyBytes = await aesKeyBytes(c);
  const phoneEnc = await aesEncrypt(phone, keyBytes);
  let user = await c.env.DB.prepare('SELECT * FROM users WHERE phone_enc=?').bind(phoneEnc).first();
  if (!user) {
    const id = 'u_' + crypto.randomUUID();
    await c.env.DB
      .prepare('INSERT INTO users(id, phone_enc, nickname, avatar, method, created_at) VALUES(?, ?, ?, ?, ?, ?)')
      .bind(id, phoneEnc, '用户_' + phone.slice(-4), phone.slice(-1), 'sms', Date.now())
      .run();
    user = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(id).first();
  }
  const tokens = await issueTokens(c, user.id);
  return c.json({
    success: true,
    user: { id: user.id, nickname: user.nickname, avatar: user.avatar, method: user.method, loginTime: Date.now() },
    ...tokens,
  });
});

// ── 刷新令牌（轮换吊销旧 refresh）──
app.post('/api/auth/refresh', async (c) => {
  const { refreshToken } = await c.req.json().catch(() => ({}));
  if (!refreshToken) return c.json({ success: false, msg: '缺少 refreshToken' }, 400);
  let payload;
  try { payload = await jwtVerify(refreshToken, c.env.JWT_SECRET); } catch { return c.json({ success: false, code: 'UNAUTH', msg: 'refreshToken 无效' }, 401); }
  const rec = await c.env.DB.prepare('SELECT * FROM refresh_tokens WHERE jti=? AND revoked=0').bind(payload.jti).first();
  if (!rec || rec.expires_at < Date.now()) return c.json({ success: false, code: 'UNAUTH', msg: 'refreshToken 已失效' }, 401);
  await c.env.DB.prepare('UPDATE refresh_tokens SET revoked=1 WHERE jti=?').bind(payload.jti).run();
  const user = await c.env.DB.prepare('SELECT id,nickname,avatar,method FROM users WHERE id=?').bind(payload.uid).first();
  if (!user) return c.json({ success: false, code: 'UNAUTH', msg: '用户不存在' }, 401);
  const tokens = await issueTokens(c, user.id);
  return c.json({ success: true, ...tokens });
});

// ── 登出（吊销该用户全部 refresh）──
app.post('/api/auth/logout', async (c) => {
  const auth = c.req.header('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const p = await jwtVerify(auth.slice(7), c.env.JWT_SECRET);
      await c.env.DB.prepare('UPDATE refresh_tokens SET revoked=1 WHERE uid=?').bind(p.uid).run();
    } catch {}
  }
  return c.json({ success: true });
});

// ── 当前用户 ──
app.get('/api/auth/me', async (c) => {
  const auth = c.req.header('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return c.json({ success: false, code: 'UNAUTH', msg: '请先登录' }, 401);
  let p;
  try { p = await jwtVerify(auth.slice(7), c.env.JWT_SECRET); } catch { return c.json({ success: false, code: 'UNAUTH', msg: 'token 无效' }, 401); }
  const user = await c.env.DB.prepare('SELECT id,nickname,avatar,method FROM users WHERE id=?').bind(p.uid).first();
  if (!user) return c.json({ success: false, code: 'UNAUTH', msg: '用户不存在' }, 401);
  return c.json({ success: true, user: { id: user.id, nickname: user.nickname, avatar: user.avatar, method: user.method } });
});

// ── 微信扫码登录（stub：需微信开放平台 ¥300 认证后开通）──
app.post('/api/auth/wechat/start', (c) =>
  c.json({ success: false, msg: '微信扫码登录尚未开通（需微信开放平台网站应用认证，¥300 一次性）' }, 400)
);

// 兜底 404
app.all('*', (c) => c.json({ success: false, msg: '接口不存在' }, 404));

// ── 令牌签发 ──
async function issueTokens(c, uid) {
  const jti = crypto.randomUUID();
  const accessToken = await jwtSign(
    { uid, method: 'sms' },
    c.env.JWT_SECRET,
    (Number(c.env.ACCESS_TOKEN_TTL_HOURS) || 2) * 3600
  );
  const refreshToken = await jwtSign(
    { uid, jti },
    c.env.JWT_SECRET,
    (Number(c.env.REFRESH_TOKEN_TTL_DAYS) || 7) * 86400
  );
  await c.env.DB
    .prepare('INSERT INTO refresh_tokens(id, uid, jti, expires_at, revoked, created_at) VALUES(?, ?, ?, ?, 0, ?)')
    .bind('rt_' + jti, uid, jti, Date.now() + 7 * 86400 * 1000, Date.now())
    .run();
  return { accessToken, refreshToken };
}

export default { fetch: (request, env, ctx) => app.fetch(request, env, ctx) };
