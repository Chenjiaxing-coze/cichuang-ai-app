import dotenv from 'dotenv';
dotenv.config();

const bool = (v, d = false) => (v === undefined ? d : v === 'true' || v === '1');

const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();

export const config = {
  nodeEnv,
  port: Number(process.env.PORT) || 3000,
  // CORS：逗号分隔的允许源列表。
  //  - 显式设置（如 http://a.com,http://b.com）→ 严格回显命中的源
  //  - 显式设置 '*' → 允许全部（仅开发便利）
  //  - 未设置 → security.js 回退为 '*'
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
    : null,
  signSecret: process.env.SIGN_SECRET || 'wc_anon_secret_2026_dev',
  jwtSecret: process.env.JWT_SECRET || 'dev_jwt_secret',
  // AES-256-GCM 加密密钥（生产必填，>=32 字节）。
  // 注：crypto.js 当前由 jwtSecret 派生 AES 密钥；此处保留独立 AES_KEY，
  // 便于生产环境单独轮换，并由下方生产守卫强制校验强度。
  aesKey: process.env.AES_KEY || '',
  accessTokenTtlHours: Number(process.env.ACCESS_TOKEN_TTL_HOURS) || 2,
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 7,
  db: {
    type: process.env.DB_TYPE || 'sqlite',
    sqlitePath: process.env.DB_SQLITE_PATH || './data/app.db',
    mysqlUrl: process.env.DB_MYSQL_URL || ''
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'dev',
    accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || '',
    signName: process.env.ALIYUN_SMS_SIGN_NAME || '词创AI',
    templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE || ''
  },
  contentModeration: process.env.CONTENT_MODERATION || 'keyword',
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE) || 60,
  // 是否信任前置代理写入的 X-Forwarded-For（CFC/反代后应开启，否则限流 IP 取错）。
  // 注意：开启后取 XFF 第一个 IP；需确保前置代理会覆盖客户端伪造的 XFF。
  trustProxy: bool(process.env.TRUST_PROXY, nodeEnv === 'production'),
  rateLimit: {
    perMinute: Number(process.env.RATE_LIMIT_PER_MINUTE) || 60,
    // 短信发送限流更严：防短信轰炸/验证码爆破（每 客户端标识 1 分钟次数）
    smsSendPerMinute: Number(process.env.SMS_SEND_PER_MINUTE) || 5,
    // 生产多实例/CFC 无状态需共享计数，配 Redis；为空则用进程内存（仅单机/开发）
    redisUrl: process.env.RATE_LIMIT_REDIS_URL || ''
  },
  logLevel: process.env.LOG_LEVEL || 'info'
};

// ── 生产守卫：启动即校验关键密钥强度，缺失或过短直接抛错退出 ──
if (config.nodeEnv === 'production') {
  const MIN_KEY_BYTES = 32;
  const weakSecrets = [
    ['JWT_SECRET', config.jwtSecret],
    ['SIGN_SECRET', config.signSecret],
    ['AES_KEY', config.aesKey]
  ].filter(([, v]) => !v || Buffer.byteLength(String(v), 'utf8') < MIN_KEY_BYTES);

  if (weakSecrets.length) {
    throw new Error(
      `[启动失败] 生产环境检测到缺失或过短的密钥（需 >= ${MIN_KEY_BYTES} 字节）：` +
      weakSecrets.map(([name]) => name).join(', ') +
      '。请通过环境变量配置强随机密钥后再启动，避免弱密钥上线。'
    );
  }

  // 生产环境：短信仍走 dev 通道 = 零密钥账户接管（任何人可拿 devCode 登录），必须拒绝启动。
  if (config.sms.provider === 'dev') {
    throw new Error(
      '[启动失败] 生产环境 SMS_PROVIDER 仍为 dev：不会真实下发短信，' +
      '且 dev 模式会向客户端回传验证码，任何人可零密钥接管任意手机号账户。' +
      '请切换为 aliyun 并配置密钥后再启动。'
    );
  }

  // 生产环境：sqlite 在 CFC 等无状态/易逝环境冷启动即清空数据、验证码、审计、令牌，
  // 既破坏可用性也破坏合规（审计留存、账户体系）。生产必须用托管 MySQL。
  if (config.db.type === 'sqlite') {
    throw new Error(
      '[启动失败] 生产环境 DB_TYPE 仍为 sqlite：CFC/Serverless 冷启动会清空数据、验证码与审计日志，' +
      '破坏合规与可用性。请配置 MySQL（DB_TYPE=mysql, DB_MYSQL_URL=...）后再启动。'
    );
  }

  // —— 生产告警（不阻断启动，仅提示合规风险）——
  if (process.env.TRUST_PROXY === undefined) {
    console.warn('[安全告警] 生产环境未显式设置 TRUST_PROXY（已默认 true）。若前置 CFC/反向代理未覆盖客户端伪造的 X-Forwarded-For，限流可能被绕过，请确认代理会重写该头。');
  }
  if (!config.rateLimit.redisUrl) {
    console.warn('[安全告警] 生产环境限流/nonce 使用进程内存计数：多实例或 CFC 冷启动会重置计数，防重放与限流可能被绕过。建议配置 RATE_LIMIT_REDIS_URL 接入共享 Redis。');
  }
}
