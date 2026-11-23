import { MODELS, SETTINGS_DEFAULTS } from '../shared/protocol.js';

const POLL_MS = 1000;
const $ = (id) => document.getElementById(id);

function describe(status) {
  if (!navigator.gpu) return { text: '這個瀏覽器沒有 WebGPU，無法在本機跑模型。', error: true };
  if (!status) return { text: '引擎尚未啟動。打開 Reddit 頁面後會自動載入模型。' };
  switch (status.state) {
    case 'loading':
      return { text: `下載／載入模型中 ${Math.round(status.progress * 100)}%\n${status.text}`, progress: status.progress };
    case 'ready':
      return { text: status.tps ? `就緒・最近一段 ${status.tps.toFixed(1)} tokens/s` : '就緒' };
    case 'error':
      return { text: `錯誤：${status.error}`, error: true };
    default:
      return { text: '模型尚未載入，捲動 Reddit 頁面時會開始。' };
  }
}

async function refresh() {
  const status = await chrome.runtime.sendMessage({ type: 'status' }).catch(() => null);
  const { text, error, progress } = describe(status);
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('error', Boolean(error));
  if (progress != null) {
    const bar = document.createElement('progress');
    bar.value = progress;
    el.append(bar);
  }
}

async function init() {
  const settings = await chrome.storage.local.get(SETTINGS_DEFAULTS);
  $('enabled').checked = settings.enabled;
  $('model').append(...MODELS.map((id) => new Option(id.replace('-q4f16_1-MLC', ''), id, false, id === settings.modelId)));
  $('enabled').addEventListener('change', (e) => chrome.storage.local.set({ enabled: e.target.checked }));
  $('model').addEventListener('change', (e) => chrome.storage.local.set({ modelId: e.target.value }));
  refresh();
  setInterval(refresh, POLL_MS);
}

init();
