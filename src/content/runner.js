import { PORT_NAME } from '../shared/protocol.js';
import { attachTranslation, STYLE } from './render.js';
import { createClient } from './client.js';

const STYLE_ID = 'rlt-style';

export function injectStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  doc.head.append(style);
}

export function createRunner({ contextOf, inside = false }) {
  const client = createClient({
    async connect() {
      const res = await chrome.runtime.sendMessage({ type: 'ensure-offscreen' });
      if (res?.error) throw new Error(res.error);
      return chrome.runtime.connect({ name: PORT_NAME });
    },
  });

  return async function run(seg, signal) {
    if (signal.aborted || !seg.el.isConnected) return;
    const view = attachTranslation(seg.el, { inside });
    try {
      await client.translate(
        { text: seg.text, context: contextOf(seg) },
        { signal, onText: (text) => { if (!signal.aborted) view.update(text); } },
      );
      if (!signal.aborted) view.done({ truncated: seg.truncated });
    } catch (err) {
      if (signal.aborted) view.remove();
      else view.fail(err.message);
    }
  };
}
