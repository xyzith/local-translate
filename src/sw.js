import { SETTINGS_DEFAULTS } from './shared/protocol.js';

let creating = null;

function ensureOffscreen() {
  creating ??= (async () => {
    if (await chrome.offscreen.hasDocument()) return;
    const { modelId } = await chrome.storage.local.get(SETTINGS_DEFAULTS);
    await chrome.offscreen.createDocument({
      url: `offscreen.html?model=${encodeURIComponent(modelId)}`,
      reasons: ['WORKERS'],
      justification: 'Run the local translation model on WebGPU',
    });
  })().finally(() => { creating = null; });
  return creating;
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'ensure-offscreen') {
    ensureOffscreen().then(() => reply({ ok: true }), (err) => reply({ error: err.message }));
    return true;
  }
  return false;
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.modelId) return;
  chrome.runtime.sendMessage({ type: 'set-model', modelId: changes.modelId.newValue }).catch(() => {});
});

const MENU_ID = 'translate-block';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: '翻譯這一段（再按一次取消）', contexts: ['page', 'selection', 'link'] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || !tab?.id || info.frameId !== 0) return;
  chrome.tabs.sendMessage(tab.id, { type: 'context-translate' }, { frameId: 0 }).catch(() => {});
});
