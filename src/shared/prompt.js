export const DESCRIPTION_CHARS = 300;

const SYSTEM = `你是網路文章的翻譯員。把 <text> 裡的英文段落翻成台灣繁體中文，用台灣網友的口語和用語。
<page> 只是幫你理解這個網頁在講什麼的背景，絕對不要翻譯或輸出它們。
俚語、梗、縮寫（IIRC、TIL、/s 等）要意譯成台灣人懂的說法；專有名詞、模型名、程式碼保留原文。
只輸出 <text> 的譯文本身，不要加說明、引號、標籤或原文。`;

export function buildPageContext(doc) {
  const context = {};
  const title = doc.title.trim();
  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim().slice(0, DESCRIPTION_CHARS);
  if (title) context.pageTitle = title;
  if (description) context.description = description;
  return context;
}

export function buildMessages({ text, context }) {
  const lines = [];
  if (context.pageTitle) lines.push(`<page>${[context.pageTitle, context.description].filter(Boolean).join(' — ')}</page>`);
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
