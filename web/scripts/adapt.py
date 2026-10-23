#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
adapt.py — 将用户提供的「演示版」单文件 HTML 改造为可静态托管的网页版。

改造点：
1. 移除运行时 Tailwind CDN（https://cdn.tailwindcss.com）——该域名在中国大陆可能被墙/变慢，
   改为引用本地编译好的 ./assets/styles.css，保证大陆用户稳定打开。
2. 移除内联的 tailwind.config（已迁移到 web/tailwind.config.js 由构建管线使用）。
3. 注入本地样式表链接。
4. 注入可配置的 API_BASE（手机验证码登录对接已建好的 Cloudflare Worker 后端），
   为空时登录自动降级为「仅浏览模式」，不影响核心提示词浏览/复制。
"""
import re, io, sys

SRC = "web/index.html"

with io.open(SRC, "r", encoding="utf-8") as f:
    html = f.read()

# 1) 移除 Tailwind CDN 的 preconnect + script（含其后换行）
cdn = '<link rel="preconnect" href="https://cdn.tailwindcss.com" crossorigin>\n<script src="https://cdn.tailwindcss.com"></script>\n'
if cdn in html:
    html = html.replace(cdn, '<link rel="stylesheet" href="./assets/styles.css">\n', 1)
    print("[ok] removed Tailwind CDN script, injected local stylesheet link")
else:
    print("[warn] CDN block not found verbatim; trying flexible match")
    html = re.sub(
        r'<link rel="preconnect" href="https://cdn\.tailwindcss\.com"[^>]*>\s*<script src="https://cdn\.tailwindcss\.com"></script>\s*',
        '<link rel="stylesheet" href="./assets/styles.css">\n',
        html, count=1)

# 2) 移除内联 tailwind.config 脚本块
before = len(html)
html = re.sub(r'<script>\s*tailwind\.config=\{.*?</script>', '', html, flags=re.DOTALL)
if len(html) < before:
    print("[ok] removed inline tailwind.config script block")
else:
    print("[warn] inline tailwind.config block not found")

# 3) 注入 API_BASE 配置（登录对接 Worker；留空则仅浏览模式）
api_cfg = (
    '<script>\n'
    '  // 网页版登录后端（Cloudflare Workers + D1）。部署 Worker 后填入其 URL，例如：\n'
    '  // window.CICHUANG_API_BASE = "https://cichuang-ai.xxx.workers.dev";\n'
    '  window.CICHUANG_API_BASE = window.CICHUANG_API_BASE || "";\n'
    '</script>\n'
)
marker = '<meta name="theme-color" content="#0A0E1A">\n'
if marker in html and 'CICHUANG_API_BASE' not in html:
    html = html.replace(marker, marker + api_cfg, 1)
    print("[ok] injected API_BASE config hook")
else:
    print("[info] API_BASE hook already present or marker missing")

with io.open(SRC, "w", encoding="utf-8") as f:
    f.write(html)

print("[done] web/index.html adapted, size =", len(html))
