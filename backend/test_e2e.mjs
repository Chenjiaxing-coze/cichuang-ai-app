import crypto from 'node:crypto';
const BASE = 'http://127.0.0.1:3000';
const SECRET = 'wc_anon_secret_2026_dev';

function sign(method, path, ts, nonce) {
  return crypto.createHmac('sha256', SECRET).update(`${method}\n${path}\n${ts}\n${nonce}`).digest('hex');
}
async function call(path, { method = 'GET', body = null, token = null, badSign = false, noSign = false } = {}) {
  const ts = Date.now();
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const headers = { 'Content-Type': 'application/json', 'X-Timestamp': String(ts), 'X-Nonce': nonce, 'X-Client': 'test' };
  if (!noSign) headers['X-Sign'] = badSign ? 'deadbeef' : sign(method, path, ts, nonce);
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };

const phone = '13800001234';
console.log('1) 发送验证码（dev 返回 devCode）');
const s1 = await call('/api/auth/sms/send', { method: 'POST', body: { phone } });
ok(s1.data.success && s1.data.devCode, 'sendSmsCode 成功并返回 devCode');
const code = s1.data.devCode;

console.log('2) 验证码登录换取双令牌');
const s2 = await call('/api/auth/sms/verify', { method: 'POST', body: { phone, code } });
ok(s2.data.success && s2.data.accessToken && s2.data.refreshToken, 'verifySmsCode 返回 access/refresh token');
const token = s2.data.accessToken, refresh = s2.data.refreshToken;
ok(s2.data.user && s2.data.user.id, '返回 user 对象');

console.log('3) 社区只读列表（公开）');
const s3 = await call('/api/community/posts?tab=latest');
ok(s3.data.success && Array.isArray(s3.data.posts), 'GET posts 返回数组');

console.log('4) 发布帖子（需登录 + 内容审核）');
const s4 = await call('/api/community/posts', { method: 'POST', token, body: { type: 'share', title: '测试帖', content: '这是一条测试内容', tags: ['测试'] } });
ok(s4.data.success && s4.data.post?.id, 'createPost 成功');
const postId = s4.data.post?.id;

console.log('5) 点赞');
const s5 = await call(`/api/community/posts/${postId}/like`, { method: 'POST', token });
ok(s5.data.success && s5.data.liked === true && s5.data.likes === 1, 'like 返回 liked=true likes=1');

console.log('6) 评论');
const s6 = await call(`/api/community/posts/${postId}/comment`, { method: 'POST', token, body: { content: '沙发' } });
ok(s6.data.success && s6.data.comment?.id, 'comment 成功');

console.log('7) 帖子详情含评论');
const s7 = await call(`/api/community/posts/${postId}`);
ok(s7.data.success && s7.data.post?.comments?.length === 1, '详情含 1 条评论');

console.log('8) 内容审核拦截');
const s8 = await call('/api/community/posts', { method: 'POST', token, body: { type: 'share', title: '色情', content: '违规内容测试' } });
ok(!s8.data.success, '命中敏感词被拦截');

console.log('9) 云端同步 上传/下载');
const payload = { favorites: ['p6'], custom: [{ id: 'c1', title: '我的模板' }], stats: { copy: 3 }, community: [] };
const s9 = await call('/api/sync', { method: 'POST', token, body: payload });
ok(s9.data.success, 'sync 上传成功');
const s9b = await call('/api/sync', { token });
ok(s9b.data.success && s9b.data.payload?.favorites?.[0] === 'p6', 'sync 下载取回数据');

console.log('10) refresh 轮换令牌');
const s10 = await call('/api/auth/refresh', { method: 'POST', body: { refreshToken: refresh } });
ok(s10.data.success && s10.data.accessToken, 'refresh 返回新 accessToken');

console.log('11) 安全：缺签名 → 400；错签名 → 401；重放 nonce → 429');
const s11a = await call('/api/community/posts?tab=latest', { noSign: true });
ok(s11a.status === 400, '缺签名被拒(400)');
const s11b = await call('/api/community/posts?tab=latest', { badSign: true });
ok(s11b.status === 401, '错签名被拒(401)');
const ts = Date.now(), nonce = crypto.randomUUID().replace(/-/g, '');
const h = { 'Content-Type': 'application/json', 'X-Timestamp': String(ts), 'X-Nonce': nonce, 'X-Sign': sign('GET', '/api/community/posts?tab=latest', ts, nonce), 'X-Client': 'test' };
await fetch(BASE + '/api/community/posts?tab=latest', { headers: h });
const s11c = await fetch(BASE + '/api/community/posts?tab=latest', { headers: h });
const r11c = await s11c.json().catch(() => ({}));
ok(s11c.status === 429, '重复 nonce 被拒(429 防重放)');

console.log(`\n结果：通过 ${pass} / 失败 ${fail}`);
process.exit(fail ? 1 : 0);
