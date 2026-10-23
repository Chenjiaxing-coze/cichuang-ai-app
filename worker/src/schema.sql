-- 词创AI D1（SQLite 内核）表结构
-- 由 backend/src/db.js 的 SCHEMA 适配：AUTO_INCREMENT → INTEGER PRIMARY KEY AUTOINCREMENT；
-- 类型统一为 TEXT / INTEGER；外键在 Serverless SQLite 下省略（应用层保证）。
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
-- 短信验证码（dev 模式落库，5 分钟有效；替代原 Express 版的内存 Map，因 Workers 无状态）
CREATE TABLE IF NOT EXISTS sms_codes (
  phone TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_jti ON refresh_tokens(jti);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_enc);
