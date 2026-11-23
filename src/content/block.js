const BLOCK_TAGS = new Set(['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'TD', 'TH', 'DD', 'DT', 'FIGCAPTION', 'SUMMARY', 'CAPTION']);
const INLINE_TAGS = new Set(['A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'CITE', 'CODE', 'DATA', 'DFN', 'EM', 'FONT', 'I', 'IMG', 'KBD', 'LABEL', 'MARK', 'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR', 'WBR']);
const SKIP = 'pre, code, nav, script, style, textarea, input, select, button, [contenteditable=""], [contenteditable="true"], .rlt-tr';

const isTextDiv = (el) => el.tagName === 'DIV' && [...el.children].every((c) => INLINE_TAGS.has(c.tagName));

export function blockText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.rlt-tr').forEach((n) => n.remove());
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

export function findBlock(node) {
  let el = node?.nodeType === 1 ? node : node?.parentElement;
  if (!el || el.closest(SKIP)) return null;
  for (; el && el !== el.ownerDocument.body; el = el.parentElement) {
    if (BLOCK_TAGS.has(el.tagName) || isTextDiv(el)) return blockText(el) ? el : null;
  }
  return null;
}
