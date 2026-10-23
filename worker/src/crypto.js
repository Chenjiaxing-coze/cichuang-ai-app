// Workers 原生加密：AES-256-GCM（手机号 PII 落库）+ 6 位验证码。
// 使用 Web Crypto（全局 crypto），不依赖 node:crypto，可在 Cloudflare Workers 运行。

const enc = new TextEncoder();
const dec = new TextDecoder();

export function genOtp() {
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

/** 由密钥材料归一化为 32 字节 AES 密钥（SHA-256）。 */
export async function deriveAesKeyBytes(material) {
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(String(material)));
  return new Uint8Array(hash);
}

function b64url(buf) {
  const s = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

/** AES-256-GCM 加密，输出 iv.ct（base64url，无分隔歧义） */
export async function aesEncrypt(plain, keyBytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, enc.encode(String(plain)));
  return b64url(iv) + '.' + b64url(new Uint8Array(ct));
}

export async function aesDecrypt(payload, keyBytes) {
  const [ivB64, dataB64] = payload.split('.');
  if (!ivB64 || !dataB64) throw new Error('密文格式错误');
  const iv = b64urlDecode(ivB64);
  const data = b64urlDecode(dataB64);
  const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
  return dec.decode(pt);
}

/** 手机号中间 4 位脱敏 */
export function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

// ── HS256 JWT（Web Crypto 实现，Workers / Node 通用）──
function strB64url(s) {
  return b64url(enc.encode(s));
}
function constTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}
async function hmacSignBytes(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign({ name: 'HMAC' }, key, enc.encode(data)));
}
/** 签发 HS256 JWT。ttlSeconds：有效期秒数。 */
export async function jwtSign(payload, secret, ttlSeconds) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const seg = strB64url(JSON.stringify(header)) + '.' + strB64url(JSON.stringify(body));
  const sig = await hmacSignBytes(secret, seg);
  return seg + '.' + b64url(sig);
}
/** 校验 HS256 JWT，返回 payload；签名错/过期抛错。 */
export async function jwtVerify(token, secret) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('token 格式错误');
  const expected = await hmacSignBytes(secret, parts[0] + '.' + parts[1]);
  if (!constTimeEqual(b64urlDecode(parts[2]), expected)) throw new Error('签名无效');
  const body = JSON.parse(dec.decode(b64urlDecode(parts[1])));
  if (body.exp && body.exp < Math.floor(Date.now() / 1000)) throw new Error('token 已过期');
  return body;
}
