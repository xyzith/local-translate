import { PROMPT_VERSION } from '../shared/prompt.js';

const DB_NAME = 'rlt';
const STORE = 'translations';

export async function cacheKey(modelId, text) {
  const bytes = new TextEncoder().encode(`${modelId}\nv${PROMPT_VERSION}\n${text}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function request(db, mode, op) {
  return new Promise((resolve, reject) => {
    const req = op(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function openCache() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      resolve({
        get: (key) => request(db, 'readonly', (s) => s.get(key)),
        put: (key, value) => request(db, 'readwrite', (s) => s.put(value, key)),
      });
    };
  });
}
