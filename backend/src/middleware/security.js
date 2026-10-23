import { config } from '../config.js';

const ALLOW_METHODS = 'GET,POST,OPTIONS';
const ALLOW_HEADERS = 'Content-Type,Authorization,X-Timestamp,X-Nonce,X-Sign,X-Client';

/** 安全响应头 + CORS（支持 file:// 的 null origin 与本地调试） */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'");

  const origin = req.headers.origin;
  const allowed = config.corsOrigin; // null 表示未设置

  if (!allowed) {
    // 未配置 CORS_ORIGIN：回退为允许全部（宽松默认，建议生产显式配置）
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (allowed.includes('*')) {
    // 显式配置 '*'：允许全部（开发便利）
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (origin && allowed.includes(origin)) {
    // 严格模式：仅回显命中列表的对应源（不回退 '*'）
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // 命中上述任一分支时才下发 CORS 头；严格模式下非白名单源不回显，浏览器会自行拦截

  if (req.method === 'OPTIONS') {
    // 预检请求：始终回显方法与头，便于跨域探测
    res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
    return res.sendStatus(204);
  }
  next();
}
