import express from 'express';
import db from '../db.js';
import { aesEncrypt, aesDecrypt } from '../crypto.js';
import { writeAudit } from '../middleware/audit.js';

const router = express.Router();

// 拉取：返回该用户已加密备份（解密后）
router.get('/sync', (req, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ success: false, code: 'UNAUTH', msg: '请先登录' });
  const row = db.prepare('SELECT payload_enc FROM sync_data WHERE uid=?').get(uid);
  let payload = null;
  if (row && row.payload_enc) {
    try { payload = JSON.parse(aesDecrypt(row.payload_enc)); } catch { payload = null; }
  }
  return res.json({ success: true, payload });
});

// 上传：加密存储用户数据（ favorites / custom / stats / community ）
const ALLOWED_KEYS = ['favorites', 'custom', 'stats', 'community'];
router.post('/sync', (req, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ success: false, code: 'UNAUTH', msg: '请先登录' });
  const body = req.body || {};
  const clean = {};
  for (const k of ALLOWED_KEYS) if (k in body) clean[k] = body[k];
  const enc = aesEncrypt(JSON.stringify(clean));
  db.prepare('INSERT INTO sync_data(uid,payload_enc,updated_at) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET payload_enc=excluded.payload_enc, updated_at=excluded.updated_at')
    .run(uid, enc, Date.now());
  writeAudit({ uid, action: 'sync_upload', ip: req.ip, detail: '' });
  return res.json({ success: true });
});

export default router;
