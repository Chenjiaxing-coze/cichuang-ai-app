import express from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { moderate } from '../services/contentModeration.js';
import { writeAudit } from '../middleware/audit.js';

const router = express.Router();

function authorOf(uid) {
  const u = db.prepare('SELECT id,nickname,avatar FROM users WHERE id=?').get(uid);
  return u || { id: uid, nickname: '已注销用户', avatar: '匿' };
}
function serializePost(row, uid) {
  const author = authorOf(row.uid);
  const comments = db.prepare(
    `SELECT c.id,c.content,c.created_at,c.uid FROM comments c WHERE c.post_id=? AND c.status='published' ORDER BY c.created_at ASC`
  ).all(row.id).map(c => ({ id: c.id, content: c.content, createdAt: c.created_at, author: { nickname: authorOf(c.uid).nickname, avatar: authorOf(c.uid).avatar } }));
  let liked = false;
  if (uid) { liked = !!db.prepare('SELECT 1 FROM likes WHERE post_id=? AND uid=?').get(row.id, uid); }
  let tags = [];
  try { tags = JSON.parse(row.tags || '[]'); } catch {}
  return {
    id: row.id, type: row.type, title: row.title, content: row.content,
    tags, likes: row.likes || 0, comments, liked,
    author: { id: author.id, nickname: author.nickname, avatar: author.avatar },
    createdAt: row.created_at
  };
}

router.get('/community/posts', (req, res) => {
  const tab = req.query.tab || 'latest';
  const uid = req.user?.uid;
  let rows;
  if (tab === 'hot') {
    rows = db.prepare(`SELECT * FROM posts WHERE status='published' ORDER BY likes DESC, created_at DESC LIMIT 200`).all();
  } else if (tab === 'mine') {
    if (!uid) return res.status(401).json({ success: false, code: 'UNAUTH', msg: '请先登录' });
    rows = db.prepare(`SELECT * FROM posts WHERE status='published' AND uid=? ORDER BY created_at DESC`).all(uid);
  } else {
    rows = db.prepare(`SELECT * FROM posts WHERE status='published' ORDER BY created_at DESC LIMIT 200`).all();
  }
  return res.json({ success: true, posts: rows.map(r => serializePost(r, uid)) });
});

router.get('/community/posts/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, msg: '帖子不存在' });
  return res.json({ success: true, post: serializePost(row, req.user?.uid) });
});

router.post('/community/posts', (req, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ success: false, code: 'UNAUTH', msg: '请先登录' });
  const { type = 'share', title = '', content = '', tags = [] } = req.body || {};
  if (!title.trim() || !content.trim()) return res.status(400).json({ success: false, msg: '标题与内容不能为空' });
  const m1 = moderate(title); if (!m1.ok) return res.status(400).json({ success: false, msg: m1.reason });
  const m2 = moderate(content); if (!m2.ok) return res.status(400).json({ success: false, msg: m2.reason });
  const id = 'p_' + crypto.randomUUID();
  const tagStr = JSON.stringify(Array.isArray(tags) ? tags.slice(0, 10) : []);
  db.prepare('INSERT INTO posts(id,uid,type,title,content,tags,likes,status,created_at) VALUES(?,?,?,?,?,?,0,\'published\',?)')
    .run(id, uid, type, title, content, tagStr, Date.now());
  writeAudit({ uid, action: 'post_create', ip: req.ip, detail: id });
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(id);
  return res.json({ success: true, post: serializePost(row, uid) });
});

router.post('/community/posts/:id/like', (req, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ success: false, code: 'UNAUTH', msg: '请先登录' });
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, msg: '帖子不存在' });
  const existing = db.prepare('SELECT 1 FROM likes WHERE post_id=? AND uid=?').get(req.params.id, uid);
  let liked;
  if (existing) {
    db.prepare('DELETE FROM likes WHERE post_id=? AND uid=?').run(req.params.id, uid);
    db.prepare('UPDATE posts SET likes=likes-1 WHERE id=? AND likes>0').run(req.params.id);
    liked = false;
  } else {
    db.prepare('INSERT OR IGNORE INTO likes(post_id,uid) VALUES(?,?)').run(req.params.id, uid);
    db.prepare('UPDATE posts SET likes=likes+1 WHERE id=?').run(req.params.id);
    liked = true;
  }
  const likes = db.prepare('SELECT likes FROM posts WHERE id=?').get(req.params.id).likes;
  return res.json({ success: true, liked, likes });
});

router.post('/community/posts/:id/comment', (req, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ success: false, code: 'UNAUTH', msg: '请先登录' });
  const { content = '' } = req.body || {};
  if (!content.trim()) return res.status(400).json({ success: false, msg: '评论内容不能为空' });
  const m = moderate(content); if (!m.ok) return res.status(400).json({ success: false, msg: m.reason });
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ success: false, msg: '帖子不存在' });
  const id = 'c_' + crypto.randomUUID();
  db.prepare('INSERT INTO comments(id,post_id,uid,content,status,created_at) VALUES(?,?,?,?,\'published\',?)')
    .run(id, req.params.id, uid, content, Date.now());
  writeAudit({ uid, action: 'post_comment', ip: req.ip, detail: req.params.id });
  const c = db.prepare('SELECT * FROM comments WHERE id=?').get(id);
  const author = authorOf(uid);
  return res.json({ success: true, comment: { id, content, createdAt: c.created_at, author: { nickname: author.nickname, avatar: author.avatar } } });
});

router.post('/community/report', (req, res) => {
  const uid = req.user?.uid;
  const { targetType = '', targetId = '', reason = '' } = req.body || {};
  const id = 'r_' + crypto.randomUUID();
  db.prepare('INSERT INTO reports(id,target_type,target_id,uid,reason,status,created_at) VALUES(?,?,?,?,?,\'pending\',?)')
    .run(id, targetType, targetId, uid || null, reason, Date.now());
  return res.json({ success: true, msg: '举报已提交，我们将在 24 小时内处理' });
});

export default router;
