import db from '../db.js';

// 等保二级：审计日志属合规留存，但绝不得记录明文 PII / 令牌。
// 这里做"防御性脱敏"：无论调用方是否已脱敏，落库前统一再处理一遍。
const maskPhones = (s) => String(s == null ? '' : s).replace(/(1[3-9]\d)\d{4}(\d{4})/g, '$1****$2');
const redactSecrets = (s) => String(s == null ? '' : s)
  // JWT（header.payload.signature）
  .replace(/[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[JWT_REDACTED]')
  // 长随机串（>=32 位，可能是密钥/令牌/nonce）
  .replace(/\b[A-Za-z0-9]{32,}\b/g, '[SECRET_REDACTED]');

/** 操作审计日志（等保二级：用户操作 / 接口请求记录；PII 脱敏后落库） */
export function writeAudit({ uid, action, ip, detail }) {
  try {
    const safeDetail = redactSecrets(maskPhones(detail || ''));
    db.prepare('INSERT INTO audit_logs(uid,action,ip,detail,created_at) VALUES(?,?,?,?,?)')
      .run(uid || null, action, ip || '', safeDetail, Date.now());
  } catch (e) {
    console.error('[audit] write failed', e.message);
  }
}
