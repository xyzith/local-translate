export const PROMPT_VERSION = 3;

const SYSTEM = `你是網路文章的翻譯員。把使用者給的英文段落翻成台灣繁體中文，用台灣的口語和用語。
俚語、梗、縮寫要意譯成台灣人懂的說法；專有名詞、產品名、程式碼保留原文。
只輸出譯文本身，不要加說明、引號或原文。`;

export function buildPageContext(doc) {
  const title = doc.title.trim();
  return title ? { pageTitle: title } : {};
}

const ASK = '請把下面這段翻成台灣繁體中文：\n\n';
const EXAMPLE = [
  { role: 'user', content: `${ASK}Fixed a typo in the login page. Please restart the client to apply it.` },
  { role: 'assistant', content: '修正了登入頁面的錯字。請重新啟動客戶端來套用。' },
];
export const RETRY_PROMPT = '這不是繁體中文翻譯。請只輸出上一段英文的台灣繁體中文譯文。';

const CJK = /[\u3400-\u9fff]/g;
const LATIN_WORD = /[A-Za-z]+/g;
const MIN_CHINESE_RATIO = 0.3;

export function looksUntranslated(output) {
  const cjk = (output.match(CJK) || []).length;
  const words = (output.match(LATIN_WORD) || []).length;
  return cjk === 0 || cjk / (cjk + words) < MIN_CHINESE_RATIO;
}

export function buildMessages({ text, context }) {
  const background = context.pageTitle ? `\n\n背景（只供理解用語，不要翻譯或輸出）：網頁標題是「${context.pageTitle}」。` : '';
  return [
    { role: 'system', content: SYSTEM + background },
    ...EXAMPLE,
    { role: 'user', content: ASK + text },
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
