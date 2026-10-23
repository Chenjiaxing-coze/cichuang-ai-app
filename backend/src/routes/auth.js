import express from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { aesEncrypt, signAccessToken, signRefreshToken, verifyToken, maskPhone } from '../crypto.js';
import { sendSmsCode, verifySmsCode } from '../services/sms.js';
import { writeAudit } from '../middleware/audit.js';
import { smsRateLimit } from '../middleware/rateLimit.js';

const router = express.Router();
const isDev = process.env.SMS_PROVIDER === 'dev';

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

router.post('/auth/sms/send', smsRateLimit, async (req, res) => {
  const { phone } = req.body || {};
  if (!/^1\d{10}$/.test(phone || '')) return res.status(400).json({ success: false, msg: '手机号格式不正确' });
  try {
    const r = await sendSmsCode(phone);
    writeAudit({ action: 'sms_send', ip: req.ip, detail: maskPhone(phone) });
    // dev 模式把验证码回传便于联调；生产绝不返回
    return res.json({ success: true, devCode: isDev ? r.devCode : undefined });
  } catch (e) {
    return res.status(500).json({ success: false, msg: e.message });
  }
});

router.post('/auth/sms/verify', async (req, res) => {
  const { phone, code } = req.body || {};
  const v = verifySmsCode(phone, code);
  if (!v.ok) return res.status(400).json({ success: false, msg: v.msg });

  const phoneEnc = aesEncrypt(phone);
  let user = db.prepare('SELECT * FROM users WHERE phone_enc=?').get(phoneEnc);
  if (!user) {
    const id = 'u_' + crypto.randomUUID();
    db.prepare('INSERT INTO users(id,phone_enc,nickname,avatar,method,created_at) VALUES(?,?,?,?,?,?)')
      .run(id, phoneEnc, '用户_' + phone.slice(-4), phone.slice(-1), 'sms', Date.now());
    user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  }
  const tokens = issueTokens(user.id);
  writeAudit({ uid: user.id, action: 'login_sms', ip: req.ip, detail: maskPhone(phone) });
  return res.json({ success: true, user: makeAppUser(user), ...tokens });
});

router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ success: false, msg: '缺少 refreshToken' });
  let payload;
  try { payload = verifyToken(refreshToken); } catch { return res.status(401).json({ success: false, code: 'UNAUTH', msg: 'refreshToken 无效' }); }
  const rec = db.prepare('SELECT * FROM refresh_tokens WHERE jti=? AND revoked=0').get(payload.jti);
  if (!rec || rec.expires_at < Date.now()) return res.status(401).json({ success: false, code: 'UNAUTH', msg: 'refreshToken 已失效' });
  db.prepare('UPDATE refresh_tokens SET revoked=1 WHERE jti=?').run(payload.jti); // 轮换：吊销旧 token
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(payload.uid);
  if (!user) return res.status(401).json({ success: false, code: 'UNAUTH', msg: '用户不存在' });
  return res.json({ success: true, ...issueTokens(user.id) });
});

router.post('/auth/logout', (req, res) => {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const p = verifyToken(auth.slice(7));
      db.prepare('UPDATE refresh_tokens SET revoked=1 WHERE uid=?').run(p.uid);
      writeAudit({ uid: p.uid, action: 'logout', ip: req.ip, detail: '' });
    } catch {}
  }
  return res.json({ success: true });
});

export default router;
