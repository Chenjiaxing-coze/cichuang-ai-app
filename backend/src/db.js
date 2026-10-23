import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

let db;
if (config.db.type === 'sqlite') {
  const p = path.resolve(config.db.sqlitePath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  db = new Database(p);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} else {
  // 生产环境：请在 README 的指导下改用 MySQL（./migrations/mysql.sql）
  throw new Error('当前构建仅内置 SQLite；生产请按 README 接入 MySQL 并替换本文件的数据访问层。');
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone_enc TEXT UNIQUE,
  nickname TEXT,
  avatar TEXT,
  method TEXT,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  jti TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked INTEGER DEFAULT 0,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  type TEXT,
  title TEXT,
  content TEXT,
  tags TEXT,
  likes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'published',
  created_at INTEGER,
  FOREIGN KEY(uid) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'published',
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS likes (
  post_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  PRIMARY KEY(post_id, uid)
);
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL,
  followee_id TEXT NOT NULL,
  PRIMARY KEY(follower_id, followee_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  from_uid TEXT NOT NULL,
  to_uid TEXT NOT NULL,
  content TEXT,
  unread INTEGER DEFAULT 1,
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  target_type TEXT,
  target_id TEXT,
  uid TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at INTEGER
);
CREATE TABLE IF NOT EXISTS sync_data (
  uid TEXT PRIMARY KEY,
  payload_enc TEXT,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT,
  action TEXT,
  ip TEXT,
  detail TEXT,
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
`;

db.exec(SCHEMA);

export default db;

// ── 基础查询帮助 ──
export const stmt = (sql) => db.prepare(sql);
export const run = (sql, params = []) => db.prepare(sql).run(params);
export const get = (sql, params = []) => db.prepare(sql).get(params);
export const all = (sql, params = []) => db.prepare(sql).all(params);
export const tx = () => db.transaction.bind(db);
