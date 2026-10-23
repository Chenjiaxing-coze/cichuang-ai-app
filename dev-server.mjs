// dev-server.mjs —— 词创AI 本地预览服务器（仅开发用，不参与打包）
// 作用：把 H5 页面（词创AI_app.html 等）静态托管在 8080，
//       并把所有 /api/* 请求反向代理到后端（默认 http://127.0.0.1:3000）。
// 好处：H5 里 API_BASE 保持为空（同源 /api），无需改配置、无跨域烦恼。
//
// 用法（需后端已在 :3000 运行）：
//   node dev-server.mjs
//   然后浏览器打开 http://localhost:8080
//
// 环境变量（可选）：
//   PORT=8080          预览端口
//   BACKEND_URL=http://127.0.0.1:3000  后端地址

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:3000';
const PORT = Number(process.env.PORT) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1) /api/* 反向代理到后端
  if (url.pathname.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : null;
    const options = {
      method: req.method,
      headers: { ...req.headers, host: new URL(BACKEND).host }
    };
    const proxy = http.request(BACKEND + url.pathname + url.search, options, (pres) => {
      res.writeHead(pres.statusCode, pres.headers);
      pres.pipe(res);
    });
    proxy.on('error', (e) => {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, msg: '后端未启动或不可达：' + e.message }));
    });
    if (body) proxy.write(body);
    proxy.end();
    return;
  }

  // 2) 静态文件
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/词创AI_app.html';
  const filePath = normalize(join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`✅ 本地预览已启动: http://localhost:${PORT}`);
  console.log(`   (H5 页面托管于此，/api 已代理到后端 ${BACKEND})`);
  console.log(`   请先确保后端在运行：cd backend && npm start`);
});
