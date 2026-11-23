import { DEFAULT_MODEL, PORT_NAME } from '../shared/protocol.js';
import { createHost } from './host.js';
import { openCache } from './cache.js';
import { createWebLLMEngine } from './webllm.js';

const opened = openCache();
const cache = {
  get: (key) => opened.then((c) => c.get(key)),
  put: (key, value) => opened.then((c) => c.put(key, value)),
};
const modelId = new URLSearchParams(location.search).get('model') || DEFAULT_MODEL;
const host = createHost({ createEngine: createWebLLMEngine, cache, modelId });

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === PORT_NAME) host.handlePort(port);
});

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'status') reply(host.status());
  else if (msg.type === 'set-model') host.setModel(msg.modelId);
});
