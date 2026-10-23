import { verifyToken } from '../crypto.js';

/** 解析 Bearer Token，挂载 req.user；未带 Token 则放行（具体接口再决定是否要求登录） */
export function attachUser(req, res, next) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(h.slice(7));
    } catch {
      req.user = null;
    }
  }
  next();
}

/** 要求已登录 */
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, code: 'UNAUTH', msg: '请先登录' });
  }
  next();
}
