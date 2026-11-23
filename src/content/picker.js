import { findBlock } from './block.js';
import { removeTranslation } from './render.js';

export function createPicker({ doc, translate }) {
  let target = null;
  doc.addEventListener('contextmenu', (e) => { target = e.target; }, true);
  return {
    command() {
      const el = target?.nodeType === 1 ? target : target?.parentElement;
      target = null;
      if (!el) return 'none';
      const translation = el.closest('.rlt-tr');
      if (translation) {
        removeTranslation(translation);
        return 'removed';
      }
      const block = findBlock(el);
      if (!block) return 'none';
      if (block.dataset.rlt) {
        removeTranslation(block);
        return 'removed';
      }
      translate(block);
      return 'translate';
    },
  };
}
