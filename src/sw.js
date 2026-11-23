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
