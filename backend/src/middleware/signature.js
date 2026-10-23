import crypto from 'node:crypto';
import { config } from '../config.js';
import { hmacSign } from '../crypto.js';

// 已使用 nonce 缓存（5 分钟过期，防重放）
const usedNonces = new Map();
const NONCE_TTL = 5 * 60 * 1000;
const TS_TOLERANCE = 300 * 1000; // 时间戳允许偏差 ±5 分钟

function ts() { return Date.now(); }

export function signatureGuard(req, res, next) {
  // 公开认证入口（短信/微信 OAuth）豁免应用签名：客户端密钥本就内置，
  // 且 WebView 以 file:// 加载时 WebCrypto 不可用，签名无意义；登录安全由 HTTPS+JWT+限流保障。
  if (req.originalUrl.startsWith('/api/auth/')) return next();
  const tsHeader = req.headers['x-timestamp'];
  const nonce = req.headers['x-nonce'];
  const sign = req.headers['x-sign'];
  if (!tsHeader || !nonce || !sign) {
    return res.status(400).json({ success: false, code: 'SIGN_MISSING', msg: '缺少签名参数' });
  }
  const now = ts();
  const diff = Math.abs(now - Number(tsHeader));
  if (Number.isNaN(diff) || diff > TS_TOLERANCE) {
    return res.status(400).json({ success: false, code: 'SIGN_EXPIRED', msg: '请求已过期' });
  }
  // 防重放：nonce 5 分钟内不得重复使用
  const bucket = usedNonces.get(nonce);
  if (bucket && now - bucket < NONCE_TTL) {
    return res.status(429).json({ success: false, code: 'REPLAY', msg: '请求重复' });
  }
  usedNonces.set(nonce, now);
  // 清理过期 nonce
  if (usedNonces.size > 5000) {
    for (const [k, v] of usedNonces) if (now - v > NONCE_TTL) usedNonces.delete(k);
  }

  const method = req.method;
  const path = req.originalUrl.split('?')[0] + (req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : '');
  const expected = hmacSign(config.signSecret, method, req.originalUrl, tsHeader, nonce);
  const a = Buffer.from(sign);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ success: false, code: 'SIGN_INVALID', msg: '签名校验失败' });
  }
  // 白名单：公开接口（发送验证码、校验验证码、社区只读）可放行；其余需登录由 auth 中间件处理
  next();
}
