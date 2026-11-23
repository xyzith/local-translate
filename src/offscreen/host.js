import { buildMessages, stripThink } from '../shared/prompt.js';
import { cacheKey } from './cache.js';

export function createHost({ createEngine, cache, modelId }) {
  const status = { state: 'idle', modelId, runtimeModelId: null, progress: 0, text: '', tps: null, error: null };
  let enginePromise = null;
  let engine = null;
  let queue = [];
  let running = null;
  let draining = false;

  function ensureEngine() {
    if (enginePromise) return enginePromise;
    Object.assign(status, { state: 'loading', progress: 0, error: null });
    const onProgress = ({ progress, text }) => Object.assign(status, { progress, text });
    const promise = createEngine(status.modelId, onProgress).then(
      (e) => {
        if (promise !== enginePromise) { e.unload?.(); throw new Error('模型已切換'); }
        engine = e;
        Object.assign(status, { state: 'ready', runtimeModelId: e.runtimeModelId ?? status.modelId });
        return e;
      },
      (err) => {
        if (promise === enginePromise) {
          enginePromise = null;
          Object.assign(status, { state: 'error', error: err.message });
        }
        throw err;
      },
    );
    enginePromise = promise;
    return promise;
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
    if (job.cancelled || job.restart) return;
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
      const job = running;
      try {
        await runJob(job);
      } catch (err) {
        if (!job.cancelled && !job.restart) post(job.port, { id: job.msg.id, error: err.message });
      }
      if (job.restart && !job.cancelled) queue.unshift({ port: job.port, msg: job.msg });
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
      if (running) {
        running.restart = true;
        engine?.interrupt();
      }
      engine?.unload?.();
      engine = null;
      enginePromise = null;
      Object.assign(status, { modelId: next, runtimeModelId: null, state: 'idle', progress: 0, text: '', tps: null, error: null });
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
