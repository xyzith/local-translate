export const MAX_CHARS = 2000;

const BLOCKS = ['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const SELECTOR = [
  'shreddit-post [slot="title"]',
  ...BLOCKS.map((b) => `[slot="text-body"] ${b}`),
  ...BLOCKS.map((b) => `shreddit-comment [slot="comment"] ${b}`),
].join(', ');

const URL_ONLY = /^(https?:\/\/\S+\s*)+$/;
const CJK = /[぀-ヿ㐀-鿿가-힯]/g;
const LATIN = /[A-Za-z]/g;

function ownText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('ul, ol, p, .rlt-tr').forEach((n) => n.remove());
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

function isMostlyCjk(text) {
  return (text.match(CJK) || []).length >= (text.match(LATIN) || []).length;
}

function kindOf(el) {
  if (el.getAttribute('slot') === 'title') return 'title';
  return el.closest('[slot="comment"]') ? 'comment' : 'body';
}

export function findSegments(root) {
  const segments = [];
  for (const el of root.querySelectorAll(SELECTOR)) {
    if (el.dataset.rlt || el.closest('pre, code')) continue;
    const text = ownText(el);
    if (!text || URL_ONLY.test(text) || isMostlyCjk(text)) continue;
    const truncated = text.length > MAX_CHARS;
    segments.push({ el, kind: kindOf(el), text: truncated ? text.slice(0, MAX_CHARS) : text, truncated });
  }
  return segments;
}
