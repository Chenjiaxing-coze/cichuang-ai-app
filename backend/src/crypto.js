import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

/**
 * 接口签名：必须与前端 apiRequest 中的签名串完全一致
 * 签名字段 = `${method}\n${path}\n${timestamp}\n${nonce}`（path 为相对路径，不含 query）
 */
export function hmacSign(secret, method, path, timestamp, nonce) {
  const base = `${method}\n${path}\n${timestamp}\n${nonce}`;
  return crypto.createHmac('sha256', secret).update(base).digest('hex');
}

/** AES-256-GCM 加密（用于手机号等 PII 落库）
 *  优先使用独立的 AES_KEY（生产由启动守卫强制 >=32 字节随机）；
 *  未配置时回退到由 jwtSecret 派生（仅开发便利，生产会被启动守卫拒绝）。
 *  两者都经 sha256 归一为 32 字节，确保 AES-256 密钥长度合规。
 */
const AES_KEY = config.aesKey
  ? crypto.createHash('sha256').update(config.aesKey).digest()
  : crypto.createHash('sha256').update(config.jwtSecret + ':aes').digest();
export function aesEncrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}
export function aesDecrypt(payload) {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', AES_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** 手机号中间 4 位脱敏 */
export function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

/** 签发双令牌 */
export function signAccessToken(user) {
  return jwt.sign(
    { uid: user.id, phone: maskPhone(user.phone || ''), nick: user.nickname, method: user.method },
    config.jwtSecret,
    { expiresIn: `${config.accessTokenTtlHours}h` }
  );
}
export function signRefreshToken(uid, jti) {
  return jwt.sign({ uid, jti }, config.jwtSecret, { expiresIn: `${config.refreshTokenTtlDays}d` });
}
export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

/** 6 位短信验证码 */
export function genOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
