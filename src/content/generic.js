import { buildPageContext } from '../shared/prompt.js';
import { MAX_CHARS } from './extract.js';
import { blockText } from './block.js';
import { attachTranslation } from './render.js';
import { createPicker } from './picker.js';
import { createScheduler } from './scheduler.js';
import { createRunner, injectStyle } from './runner.js';

const scheduler = createScheduler({ run: createRunner({ contextOf: () => buildPageContext(document), inside: true }) });

const picker = createPicker({
  doc: document,
  translate(block) {
    injectStyle(document);
    const text = blockText(block);
    attachTranslation(block, { inside: true });
    scheduler.enqueue({ el: block, text: text.slice(0, MAX_CHARS), truncated: text.length > MAX_CHARS }, { visible: true });
  },
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'context-translate') picker.command();
});
