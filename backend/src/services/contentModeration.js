// 内容审核：dev 仅做关键词过滤；生产建议在此接入 AI 内容审核服务
const BANNED = ['涉政敏感词示例', '暴力', '色情', '赌博', '诈骗', '违禁'];

export function moderate(text) {
  if (!text || typeof text !== 'string') return { ok: true };
  for (const w of BANNED) {
    if (text.includes(w)) return { ok: false, reason: `包含违规内容：${w}` };
  }
  return { ok: true };
}
