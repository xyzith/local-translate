export const STYLE = `
.rlt-tr { display: block; margin: .2em 0 .6em; padding-left: .6em;
  border-left: 2px solid rgba(10, 132, 255, .45); opacity: .88; font-weight: normal; }
.rlt-pending { opacity: .45; }
.rlt-pending:empty::before { content: "翻譯中…"; }
.rlt-error { color: #d93a00; }
`;

const CLASS = 'rlt-tr';

function placesInside(el, inside) {
  return inside || el.hasAttribute('slot') || el.tagName === 'LI';
}

function existingNode(el) {
  const sibling = el.nextElementSibling;
  return el.querySelector(`:scope > .${CLASS}`) || (sibling?.classList.contains(CLASS) ? sibling : null);
}

function createNode(el, inside) {
  const node = el.ownerDocument.createElement(inside ? 'span' : 'div');
  node.className = CLASS;
  node.setAttribute('lang', 'zh-Hant');
  if (inside) el.insertBefore(node, el.querySelector(':scope > ul, :scope > ol'));
  else el.after(node);
  return node;
}

export function attachTranslation(el, { inside = false } = {}) {
  el.dataset.rlt = '1';
  const node = existingNode(el) || createNode(el, placesInside(el, inside));
  node.className = `${CLASS} rlt-pending`;
  node.textContent = '';
  return {
    update(text) { node.textContent = text; },
    done({ truncated = false } = {}) {
      node.classList.remove('rlt-pending');
      if (truncated) node.textContent += '（後略）';
    },
    fail(message) {
      node.classList.remove('rlt-pending');
      node.classList.add('rlt-error');
      node.textContent = `⚠ 翻譯失敗：${message}`;
    },
    remove() {
      node.remove();
      el.removeAttribute('data-rlt');
    },
  };
}

export function removeTranslation(target) {
  if (target.classList.contains(CLASS)) {
    const owner = [target.previousElementSibling, target.parentElement].find((n) => n?.dataset.rlt);
    target.remove();
    owner?.removeAttribute('data-rlt');
    return true;
  }
  if (!target.dataset.rlt) return false;
  existingNode(target)?.remove();
  target.removeAttribute('data-rlt');
  return true;
}

export function detachAll(root) {
  root.querySelectorAll(`.${CLASS}`).forEach((n) => n.remove());
  root.querySelectorAll('[data-rlt]').forEach((el) => el.removeAttribute('data-rlt'));
}
