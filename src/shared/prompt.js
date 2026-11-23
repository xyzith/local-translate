export const PARENT_CHARS = 300;

const SYSTEM = `你是 Reddit 翻譯員。把 <text> 裡的英文段落翻成台灣繁體中文，用台灣網友的口語和用語。
<title> 和 <parent> 只是幫你理解語境的背景，絕對不要翻譯或輸出它們。
俚語、梗、縮寫（IIRC、TIL、/s 等）要意譯成台灣人懂的說法；專有名詞、模型名、程式碼保留原文。
只輸出 <text> 的譯文本身，不要加說明、引號、標籤或原文。`;

function commentText(comment) {
  const slot = [...comment.querySelectorAll('[slot="comment"]')]
    .find((s) => s.closest('shreddit-comment') === comment);
  if (!slot) return '';
  const clone = slot.cloneNode(true);
  clone.querySelectorAll('.rlt-tr').forEach((n) => n.remove());
  return clone.textContent.replace(/\s+/g, ' ').trim();
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

export function buildMessages({ text, context }) {
  const lines = [];
  if (context.postTitle) lines.push(`<title>${context.postTitle}</title>`);
  if (context.parentText) lines.push(`<parent>${context.parentText}</parent>`);
  lines.push(`請翻譯：\n<text>\n${text}`);
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
