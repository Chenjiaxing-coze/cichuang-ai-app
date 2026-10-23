/**
 * 百度智能云 CFC（函数计算）适配层
 * 部署：将本目录作为函数代码，入口 handler 即可。
 * 依赖：CFC 运行环境需安装本目录 node_modules（或改用“层”挂载依赖）。
 * 说明：签名 / 限流 / 数据库在函数中运行；生产建议把 SQLite 换成云数据库（见 README）。
 */
import app from './index.js';

export async function handler(event, context) {
  // CFC 以 HTTP 触发器接入时，event 内含请求信息；这里转成 Express 可处理的 Node 请求形态
  const { requestContext, httpMethod, path, headers = {}, queryString = {}, body } = event;
  const url = (path || '') + (Object.keys(queryString || {}).length ? '?' + new URLSearchParams(queryString).toString() : '');
  const req = {
    method: httpMethod || 'GET',
    url,
    originalUrl: url,
    headers: lowerKeys(headers),
    query: queryString || {},
    ip: (requestContext && requestContext.sourceIp) || 'cfc',
    body: typeof body === 'string' ? (() => { try { return JSON.parse(body); } catch { return body; } })() : body
  };
  const res = makeRes();
  await new Promise((resolve) => {
    app(req, res, () => resolve());
  });
  return res.result;
}

function lowerKeys(obj) {
  const o = {};
  for (const k in obj) o[k.toLowerCase()] = obj[k];
  return o;
}
function makeRes() {
  const headers = {};
  return {
    statusCode: 200,
    result: null,
    headers,
    setHeader(k, v) { headers[k] = v; },
    getHeader(k) { return headers[k]; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.result = { statusCode: this.statusCode, headers, body: JSON.stringify(obj) }; },
    send(msg) { this.result = { statusCode: this.statusCode, headers, body: msg }; },
    sendStatus(code) { this.statusCode = code; this.result = { statusCode: code, headers, body: '' }; }
  };
}
