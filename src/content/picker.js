import { findBlock, findBlocksInRange } from './block.js';
import { removeTranslation } from './render.js';

export function createPicker({ doc, translate, cancel }) {
  let target = null;
  doc.addEventListener('contextmenu', (e) => { target = e.target; }, true);

  const untranslate = (block) => {
    cancel(block);
    removeTranslation(block);
  };

  function selectedBlocks(el) {
    const sel = doc.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return [];
    const range = sel.getRangeAt(0);
    return range.intersectsNode(el) ? findBlocksInRange(range) : [];
  }

  return {
    command() {
      const el = target?.nodeType === 1 ? target : target?.parentElement;
      target = null;
      if (!el) return 'none';
      const translation = el.closest('.rlt-tr');
      if (translation) {
        untranslate(translation.parentElement);
        return 'removed';
      }
      const selected = selectedBlocks(el);
      const blocks = selected.length ? selected : [findBlock(el)].filter(Boolean);
      if (!blocks.length) return 'none';
      const fresh = blocks.filter((b) => !b.dataset.rlt);
      if (!fresh.length) {
        blocks.forEach(untranslate);
        return 'removed';
      }
      fresh.forEach(translate);
      return 'translate';
    },
  };
}
