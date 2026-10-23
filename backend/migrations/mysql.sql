-- 生产环境（等保二级 / 高并发）数据库表结构（MySQL 8.0+）
-- 将 src/db.js 的数据访问层替换为 MySQL 驱动（如 mysql2），并执行以下建表。
CREATE DATABASE IF NOT EXISTS cichuang DEFAULT CHARSET utf8mb4;
USE cichuang;

CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  phone_enc VARBINARY(512) NOT NULL,
  nickname VARCHAR(64),
  avatar VARCHAR(8),
  method VARCHAR(16),
  created_at BIGINT,
  UNIQUE KEY uk_phone (phone_enc)
);
CREATE TABLE refresh_tokens (
  id VARCHAR(64) PRIMARY KEY,
  uid VARCHAR(64) NOT NULL,
  jti VARCHAR(64) NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked TINYINT DEFAULT 0,
  created_at BIGINT,
  KEY idx_uid (uid)
);
CREATE TABLE posts (
  id VARCHAR(64) PRIMARY KEY,
  uid VARCHAR(64) NOT NULL,
  type VARCHAR(16),
  title VARCHAR(255),
  content TEXT,
  tags TEXT,
  likes INT DEFAULT 0,
  status VARCHAR(16) DEFAULT 'published',
  created_at BIGINT,
  KEY idx_created (created_at),
  KEY idx_uid (uid)
);
CREATE TABLE comments (
  id VARCHAR(64) PRIMARY KEY,
  post_id VARCHAR(64) NOT NULL,
  uid VARCHAR(64) NOT NULL,
  content TEXT,
  status VARCHAR(16) DEFAULT 'published',
  created_at BIGINT,
  KEY idx_post (post_id)
);
CREATE TABLE likes (
  post_id VARCHAR(64) NOT NULL,
  uid VARCHAR(64) NOT NULL,
  PRIMARY KEY (post_id, uid)
);
CREATE TABLE follows (
  follower_id VARCHAR(64) NOT NULL,
  followee_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);
CREATE TABLE messages (
  id VARCHAR(64) PRIMARY KEY,
  from_uid VARCHAR(64) NOT NULL,
  to_uid VARCHAR(64) NOT NULL,
  content TEXT,
  unread TINYINT DEFAULT 1,
  created_at BIGINT
);
CREATE TABLE reports (
  id VARCHAR(64) PRIMARY KEY,
  target_type VARCHAR(16),
  target_id VARCHAR(64),
  uid VARCHAR(64),
  reason VARCHAR(255),
  status VARCHAR(16) DEFAULT 'pending',
  created_at BIGINT
);
CREATE TABLE sync_data (
  uid VARCHAR(64) PRIMARY KEY,
  payload_enc TEXT,
  updated_at BIGINT
);
CREATE TABLE audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(64),
  action VARCHAR(64),
  ip VARCHAR(64),
  detail TEXT,
  created_at BIGINT,
  KEY idx_action (action),
  KEY idx_created (created_at)
);
