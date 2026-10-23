import express from 'express';
import { config } from './config.js';
import { securityHeaders } from './middleware/security.js';
import { signatureGuard } from './middleware/signature.js';
import { attachUser } from './middleware/auth.js';
import { rateLimit } from './middleware/rateLimit.js';
import authRouter from './routes/auth.js';
import communityRouter from './routes/community.js';
import syncRouter from './routes/sync.js';
import wechatRouter, { wechatCallback } from './routes/wechat.js';

const app = express();

app.use(securityHeaders);
// 请求体大小限制，防滥用（超限由全局错误处理返回 413）
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(rateLimit);

app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// 微信扫码登录回调：由微信开放平台在用户授权后 302 跳转到 redirect_uri，
// 由用户浏览器发起，无法（也不应）携带本系统 HMAC 签名头；其安全性由一次性
// 随机 state 保证（见 routes/wechat.js），故必须在签名守卫之前单独挂载。
app.get('/api/auth/wechat/callback', wechatCallback);

// 签名验签 + 防重放（作用于 /api 下所有接口）
app.use('/api', signatureGuard);
app.use('/api', attachUser);

app.use('/api', authRouter);
app.use('/api', wechatRouter);
app.use('/api', communityRouter);
app.use('/api', syncRouter);

// 兜底 404
app.use('/api', (req, res) => res.status(404).json({ success: false, msg: '接口不存在' }));

// 全局错误处理（不泄露堆栈）
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  if (err.type === 'entity.too.large') return res.status(413).json({ success: false, msg: '请求体过大' });
  res.status(500).json({ success: false, msg: '服务器内部错误' });
});

app.listen(config.port, () => {
  console.log(`✅ 词创AI 后端已启动: http://localhost:${config.port}  (db=${config.db.type}, sms=${config.sms.provider})`);
});

export default app;
