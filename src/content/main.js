import { PORT_NAME, SETTINGS_DEFAULTS } from '../shared/protocol.js';
import { buildContext } from '../shared/prompt.js';
import { findSegments } from './extract.js';
import { attachTranslation, detachAll, STYLE } from './render.js';
import { createScheduler } from './scheduler.js';
import { createClient } from './client.js';

const SCAN_DEBOUNCE_MS = 300;
const SCAN_MAX_WAIT_MS = 1500;
const PREFETCH_MARGIN = '300px 0px';

const client = createClient({
  async connect() {
    const res = await chrome.runtime.sendMessage({ type: 'ensure-offscreen' });
    if (res?.error) throw new Error(res.error);
    return chrome.runtime.connect({ name: PORT_NAME });
  },
});

async function translateSegment(seg, signal) {
  if (signal.aborted || !seg.el.isConnected) return;
  const view = attachTranslation(seg.el);
  try {
    await client.translate(
      { text: seg.text, context: buildContext(seg) },
      { signal, onText: (text) => { if (!signal.aborted) view.update(text); } },
    );
    if (!signal.aborted) view.done({ truncated: seg.truncated });
  } catch (err) {
    if (signal.aborted) view.remove();
    else view.fail(err.message);
  }
}

const scheduler = createScheduler({ run: translateSegment });
let segOf = new WeakMap();
let enabled = false;
let href = location.href;
let timer = null;
let firstPending = 0;

const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const seg = segOf.get(entry.target);
    if (!seg) continue;
    if (entry.isIntersecting) {
      scheduler.enqueue(seg, { visible: true });
      scheduler.setVisible(seg, true);
    } else {
      scheduler.setVisible(seg, false);
    }
  }
}, { rootMargin: PREFETCH_MARGIN });

function scan() {
  if (!enabled) return;
  for (const seg of findSegments(document)) {
    if (segOf.has(seg.el)) continue;
    segOf.set(seg.el, seg);
    io.observe(seg.el);
  }
}

function stop() {
  scheduler.cancelAll();
  io.disconnect();
  segOf = new WeakMap();
}

function setEnabled(next) {
  if (next === enabled) return;
  enabled = next;
  if (enabled) scan();
  else { stop(); detachAll(document); }
}

const insideTranslation = (m) => (m.target.nodeType === 1 ? m.target : m.target.parentElement)?.closest('.rlt-tr');

new MutationObserver((mutations) => {
  if (location.href !== href) {
    href = location.href;
    stop();
  } else if (mutations.every(insideTranslation)) {
    return;
  }
  firstPending ||= Date.now();
  clearTimeout(timer);
  const wait = Math.max(0, Math.min(SCAN_DEBOUNCE_MS, firstPending + SCAN_MAX_WAIT_MS - Date.now()));
  timer = setTimeout(() => { firstPending = 0; scan(); }, wait);
}).observe(document.body, { childList: true, subtree: true });

const style = document.createElement('style');
style.textContent = STYLE;
document.head.append(style);

chrome.storage.local.get(SETTINGS_DEFAULTS).then(({ enabled: on }) => setEnabled(on));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.enabled) setEnabled(changes.enabled.newValue);
});
