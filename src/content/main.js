import { buildPageContext } from '../shared/prompt.js';
import { blockText, MAX_CHARS } from './block.js';
import { attachTranslation } from './render.js';
import { createPicker } from './picker.js';
import { createQueue } from './queue.js';
import { createRunner, injectStyle } from './runner.js';

const queue = createQueue({ run: createRunner({ contextOf: () => buildPageContext(document) }) });

const picker = createPicker({
  doc: document,
  translate(block) {
    injectStyle(document);
    const text = blockText(block);
    attachTranslation(block);
    queue.add(block, { el: block, text: text.slice(0, MAX_CHARS), truncated: text.length > MAX_CHARS });
  },
  cancel: (block) => queue.cancel(block),
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'context-translate') picker.command();
});
