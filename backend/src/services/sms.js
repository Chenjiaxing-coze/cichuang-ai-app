import { config } from '../config.js';
import { genOtp } from '../crypto.js';

// 生产守卫：NODE_ENV=production 且仍在用 dev 短信通道时，打印明确告警。
// 注意：dev 通道本就不会真实下发短信（仅控制台打印验证码），此处仅提示风险，
// 不会自动发送任何真实短信。上线前请切换到阿里云等真实服务商。
if (config.nodeEnv === 'production' && config.sms.provider === 'dev') {
  console.warn(
    '[生产告警] 当前 SMS_PROVIDER=dev：生产环境不会真实下发短信，仅向控制台打印验证码，' +
    '用户将无法收到真实验证码。请配置阿里云等真实短信服务商后再上线。'
  );
}

// dev 模式：验证码仅存内存（5 分钟有效），打印到控制台便于本地联调
const devCodes = new Map();
const OTP_TTL = 5 * 60 * 1000;

export async function sendSmsCode(phone) {
  const code = genOtp();
  const expires = Date.now() + OTP_TTL;
  if (config.sms.provider === 'dev') {
    devCodes.set(phone, { code, expires });
    console.log(`[DEV 短信] 向 ${phone} 发送验证码：${code}（生产环境将真实发送）`);
    return { ok: true, devCode: code }; // devCode 仅 dev 模式返回，便于调试
  }
  // 生产：接入阿里云短信（需先在阿里云开通 + 配置以下常量）
  // 建议使用官方 @alicloud/dysmsapi20170525 SDK 替换此处
  if (!config.sms.accessKeyId || !config.sms.templateCode) {
    throw new Error('阿里云短信未配置（accessKeyId / templateCode）');
  }
  // TODO: 调用阿里云 SMS API（ROS 签名 + RPC）。此处留出接入点。
  throw new Error('阿里云短信发送未实现：请在 sms.js 接入 @alicloud/dysmsapi20170525');
}

export function verifySmsCode(phone, code) {
  if (config.sms.provider === 'dev') {
    const rec = devCodes.get(phone);
    if (!rec) return { ok: false, msg: '请先获取验证码' };
    if (Date.now() > rec.expires) { devCodes.delete(phone); return { ok: false, msg: '验证码已过期' }; }
    if (rec.code !== code) return { ok: false, msg: '验证码错误' };
    devCodes.delete(phone);
    return { ok: true };
  }
  // 生产：应与阿里云发送时记录的验证码/或采用“验证码由服务端生成并比对”的方案
  throw new Error('生产环境验证码校验需接入你的短信下发记录服务');
}
