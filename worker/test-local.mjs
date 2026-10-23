// 本地逻辑测试：用 node:sqlite 内存库跑真实 schema/SQL，模拟 D1 接口与 env，
// 直接调用 worker 的 fetch，验证「短信 dev 登录 + 双令牌」全链路。
// 不依赖 wrangler/Cloudflare 账号，仅验证代码逻辑正确性。
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const schema = fs.readFileSync(new URL('./src/schema.sql', import.meta.url), 'utf8');
const db = new DatabaseSync(':memory:');
db.exec(schema);

// D1 接口模拟：prepare().bind(...).run()/.first()/.all()
const DB = {
  prepare(sql) {
    return {
      bind(...params) {
        return {
          run() { db.prepare(sql).run(...params); return { success: true }; },
          first() { const r = db.prepare(sql).get(...params); return r ?? null; },
          all() { return { results: db.prepare(sql).all(...params) }; },
        };
      },
    };
  },
};

const env = {
  JWT_SECRET: 'local-test-strong-secret-needs-32-bytes-minimum!!',
  AES_KEY: 'local-test-aes-key-32-bytes-minimum-length-ok!!',
  ALLOW_DEV_SMS: 'true',
  NODE_ENV: 'production',
  ACCESS_TOKEN_TTL_HOURS: '2',
  REFRESH_TOKEN_TTL_DAYS: '7',
  DB,
};

const { default: worker } = await import('./src/index.js');

const call = async (method, path, body, auth) => {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers['Authorization'] = 'Bearer ' + auth;
  const req = new Request('http://localhost' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await worker.fetch(req, env, {});
  let data; try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
};

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✅', msg); } else { fail++; console.log('  ❌', msg); } };

console.log('\n[1] 短信发送（dev 模式）');
const r1 = await call('POST', '/api/auth/sms/send', { phone: '13800001234' });
ok(r1.status === 200 && r1.data.success, 'send 返回 success');
ok(typeof r1.data.devCode === 'string' && /^\d{6}$/.test(r1.data.devCode), '返回 6 位 devCode: ' + r1.data.devCode);

console.log('\n[2] 短信校验 + 登录/注册（首次）');
const r2 = await call('POST', '/api/auth/sms/verify', { phone: '13800001234', code: r1.data.devCode });
ok(r2.status === 200 && r2.data.success, 'verify 返回 success');
ok(!!r2.data.accessToken && !!r2.data.refreshToken, '返回 access/refresh 双令牌');
ok(r2.data.user && r2.data.user.id && r2.data.user.nickname === '用户_1234', '返回 user（nickname=用户_1234）');
const access = r2.data.accessToken, refresh = r2.data.refreshToken, uid = r2.data.user.id;

console.log('\n[3] 重复验证码应失效（已消费）');
const r3 = await call('POST', '/api/auth/sms/verify', { phone: '13800001234', code: r1.data.devCode });
ok(!r3.data.success, '已消费的验证码不能再登录');

console.log('\n[4] 错误验证码应失败');
const r4 = await call('POST', '/api/auth/sms/send', { phone: '13800005678' });
const r5 = await call('POST', '/api/auth/sms/verify', { phone: '13800005678', code: '000000' });
ok(!r5.data.success, '错误验证码被拒：' + r5.data.msg);

console.log('\n[5] /api/auth/me（持 accessToken）');
const r6 = await call('GET', '/api/auth/me', null, access);
ok(r6.status === 200 && r6.data.success && r6.data.user.id === uid, 'me 返回当前用户');

console.log('\n[6] 刷新令牌（轮换）');
const r7 = await call('POST', '/api/auth/refresh', { refreshToken: refresh });
ok(r7.status === 200 && r7.data.success && !!r7.data.accessToken && !!r7.data.refreshToken, 'refresh 返回新双令牌');
const refresh2 = r7.data.refreshToken;

console.log('\n[7] 旧 refresh 被吊销后不可用');
const r8 = await call('POST', '/api/auth/refresh', { refreshToken: refresh });
ok(!r8.data.success, '旧 refresh 已失效：' + r8.data.msg);

console.log('\n[8] 登出（吊销 refresh2）');
const r9 = await call('POST', '/api/auth/logout', null, r7.data.accessToken);
ok(r9.status === 200 && r9.data.success, 'logout 成功');
const r10 = await call('POST', '/api/auth/refresh', { refreshToken: refresh2 });
ok(!r10.data.success, '登出后 refresh2 失效：' + r10.data.msg);

console.log('\n[9] 微信登录 stub（尚未开通）');
const r11 = await call('POST', '/api/auth/wechat/start', {});
ok(r11.status === 400 && !r11.data.success, '微信登录返回未开通提示：' + r11.data.msg);

console.log('\n[10] 手机号落库为 AES 密文（非明文）');
const row = db.prepare('SELECT phone_enc FROM users WHERE id=?').get(uid);
ok(row && row.phone_enc && row.phone_enc.includes('.') && !row.phone_enc.includes('13800001234'), 'phone_enc 为 AES 密文（iv.ct 格式，无明文）');

console.log(`\n==== 结果：通过 ${pass} / 失败 ${fail} ====`);
process.exit(fail ? 1 : 0);
