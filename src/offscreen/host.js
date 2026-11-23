import { buildMessages, stripThink } from '../shared/prompt.js';
import { cacheKey } from './cache.js';

export function createHost({ createEngine, cache, modelId }) {
  const status = { state: 'idle', modelId, progress: 0, text: '', tps: null, error: null };
  let enginePromise = null;
  let engine = null;
  let queue = [];
  let running = null;
  let draining = false;

  function ensureEngine() {
    if (enginePromise) return enginePromise;
    Object.assign(status, { state: 'loading', progress: 0, error: null });
    const onProgress = ({ progress, text }) => Object.assign(status, { progress, text });
    enginePromise = createEngine(status.modelId, onProgress).then(
      (e) => { engine = e; status.state = 'ready'; return e; },
      (err) => { enginePromise = null; Object.assign(status, { state: 'error', error: err.message }); throw err; },
    );
    return enginePromise;
  }

  function post(port, msg) {
    try { port.postMessage(msg); } catch { /* tab already gone */ }
  }

  async function runJob(job) {
    const { port, msg: { id, text, context } } = job;
    const { modelId: jobModel } = status;
    const key = await cacheKey(jobModel, text);
    const hit = await cache.get(key);
    if (job.cancelled) return;
    if (hit != null) {
      post(port, { id, text: hit });
      post(port, { id, done: true });
      return;
    }
    const eng = await ensureEngine();
    if (job.cancelled) return;
    let out = '';
    const onText = (raw) => {
      if (job.cancelled) return;
      out = stripThink(raw);
      post(port, { id, text: out });
    };
    const { tps, interrupted } = await eng.stream(buildMessages({ text, context, modelId: jobModel }), { onText });
    if (interrupted || job.cancelled) return;
    await cache.put(key, out);
    status.tps = tps;
    post(port, { id, done: true, tps });
  }

  async function drain() {
    if (draining) return;
    draining = true;
    while (queue.length) {
      running = queue.shift();
      try {
        await runJob(running);
      } catch (err) {
        if (!running.cancelled) post(running.port, { id: running.msg.id, error: err.message });
      }
      running = null;
    }
    draining = false;
  }

  function cancelWhere(match) {
    queue = queue.filter((job) => !match(job));
    if (running && match(running)) {
      running.cancelled = true;
      engine?.interrupt();
    }
  }

  return {
    status: () => ({ ...status }),
    setModel(next) {
      if (next === status.modelId) return;
      cancelWhere(() => true);
      engine?.unload?.();
      engine = null;
      enginePromise = null;
      Object.assign(status, { modelId: next, state: 'idle', progress: 0, text: '', tps: null, error: null });
    },
    handlePort(port) {
      port.onMessage.addListener((msg) => {
        if (msg.type === 'translate') {
          queue.push({ port, msg });
          drain();
        } else if (msg.type === 'cancel') {
          cancelWhere((job) => job.port === port && job.msg.id === msg.id);
        }
      });
      port.onDisconnect.addListener(() => cancelWhere((job) => job.port === port));
    },
  };
}
