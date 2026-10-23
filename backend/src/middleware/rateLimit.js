import { config } from '../config.js';

// 等保二级：限流必须按"真实客户端 IP"统计，并支持按接口分级阈值。
// - 前置 CFC/反向代理时，客户端 IP 取自 X-Forwarded-For 第一个入口
//   （需确认代理会覆盖客户端伪造的 XFF，否则可被绕过）。
// - 内存计数仅适用单机/开发；生产多实例/无状态(CFC)应接共享 Redis
//   （见 config.rateLimit.redisUrl；为空时启动会有告警）。
const WINDOW = 60 * 1000; // 1 分钟滑动窗口
const hits = new Map(); // key -> number[]（命中时间戳）

/** 取真实客户端 IP：信任代理时取 XFF 第一个，否则取 socket 地址 */
function clientId(req) {
  if (config.trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      return xff.split(',')[0].trim();
    }
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

/** 滑动窗口计数：超限返回 true 并记录本次命中 */
function tooMany(key, limit, now) {
  const arr = (hits.get(key) || []).filter((t) => now - t < WINDOW);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  return false;
}

/** 通用全局限流（默认每分钟 config.rateLimitPerMinute 次/客户端） */
export function rateLimit(req, res, next) {
  const now = Date.now();
  if (tooMany('global:' + clientId(req), config.rateLimitPerMinute, now)) {
    return res.status(429).json({ success: false, code: 'RATE_LIMIT', msg: '请求过于频繁，请稍后再试' });
  }
  next();
}

/**
 * 短信发送限流（更严：防短信轰炸 / 验证码爆破）。
 * 同时按「IP」与「IP+手机号」两个维度计数，防止单 IP 不断换号轰炸。
 * 用法：挂到 POST /api/auth/sms/send 路由上（在通用限流之后）。
 */
export function smsRateLimit(req, res, next) {
  const now = Date.now();
  const id = clientId(req);
  const phone = req.body && req.body.phone ? String(req.body.phone) : '';
  if (
    tooMany('sms:ip:' + id, config.rateLimit.smsSendPerMinute, now) ||
    (phone && tooMany('sms:ipPhone:' + id + ':' + phone, config.rateLimit.smsSendPerMinute, now))
  ) {
    return res.status(429).json({ success: false, code: 'RATE_LIMIT', msg: '验证码发送过于频繁，请稍后再试' });
  }
  next();
}
