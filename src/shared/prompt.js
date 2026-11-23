export const PARENT_CHARS = 300;

const SYSTEM = `你是 Reddit 翻譯員。把使用者給的英文段落翻成台灣繁體中文，用台灣網友的口語和用語。
俚語、梗、縮寫（IIRC、TIL、/s 等）要意譯成台灣人懂的說法；專有名詞、模型名、程式碼保留原文。
只輸出譯文本身，不要加說明、引號或原文。`;

function commentText(comment) {
  const slot = [...comment.querySelectorAll('[slot="comment"]')]
    .find((s) => s.closest('shreddit-comment') === comment);
  return (slot?.textContent || '').replace(/\s+/g, ' ').trim();
}

export function buildContext({ el, kind }) {
  if (kind === 'title') return {};
  const doc = el.ownerDocument;
  const post = el.closest('shreddit-post') || doc.querySelector('shreddit-post');
  const context = {};
  const postTitle = post?.getAttribute('post-title');
  if (postTitle) context.postTitle = postTitle;
  const parentId = kind === 'comment' && el.closest('shreddit-comment')?.getAttribute('parentid');
  const parent = parentId && [...doc.querySelectorAll('shreddit-comment[thingid]')]
    .find((c) => c.getAttribute('thingid') === parentId);
  if (parent) context.parentText = commentText(parent).slice(0, PARENT_CHARS);
  return context;
}

export function buildMessages({ text, context, modelId }) {
  const lines = [];
  if (context.postTitle) lines.push(`貼文標題（僅供理解，不用翻）：${context.postTitle}`);
  if (context.parentText) lines.push(`這則留言回覆的是（僅供理解，不用翻）：${context.parentText}`);
  lines.push(`要翻譯的段落：\n${text}`);
  if (modelId.startsWith('Qwen3')) lines.push('/no_think');
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: lines.join('\n\n') },
  ];
}

const OPEN = '<think>';

export function stripThink(raw) {
  let s = raw.replace(/<think>[\s\S]*?<\/think>/g, '');
  const open = s.indexOf(OPEN);
  if (open >= 0) s = s.slice(0, open);
  s = s.trim();
  return s && OPEN.startsWith(s) ? '' : s;
}
