import { buildMessages, stripThink } from '../shared/prompt.js';
import { cacheKey } from './cache.js';

const errorText = (err) => String(err?.message || err || '未知錯誤');
const release = (eng) => Promise.resolve(eng?.unload?.()).catch(() => {});

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
    const isCurrent = () => promise === enginePromise;
    const onProgress = ({ progress, text }) => { if (isCurrent()) Object.assign(status, { progress, text }); };
    const promise = Promise.resolve().then(() => createEngine(status.modelId, onProgress)).then(
      (e) => {
        if (!isCurrent()) { release(e); throw new Error('模型已切換'); }
        engine = e;
        Object.assign(status, { state: 'ready', runtimeModelId: e.runtimeModelId ?? status.modelId });
        return e;
      },
      (err) => {
        if (isCurrent()) {
          enginePromise = null;
          Object.assign(status, { state: 'error', error: errorText(err) });
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
    const key = await cacheKey(status.modelId, text);
    const hit = await cache.get(key);
    if (job.cancelled) return;
    if (hit != null) {
      post(port, { id, text: hit });
      post(port, { id, done: true });
      return;
    }
    job.phase = 'loading';
    const restarted = new Promise((resolve) => { job.onRestart = resolve; });
    const eng = await Promise.race([ensureEngine(), restarted]);
    if (job.cancelled || job.restart) return;
    job.phase = 'streaming';
    let out = '';
    const onText = (raw) => {
      if (job.cancelled) return;
      out = stripThink(raw);
      post(port, { id, text: out });
    };
    const { tps, interrupted } = await eng.stream(buildMessages({ text, context }), { onText });
    if (interrupted || job.cancelled || job.restart) return;
    job.phase = 'saving';
    if (out) await cache.put(key, out).catch(() => {});
    status.tps = tps;
    post(port, { id, done: true, tps });
  }

  async function drain() {
    if (draining) return;
    draining = true;
    while (queue.length) {
      const job = queue.shift();
      running = job;
      try {
        await runJob(job);
      } catch (err) {
        if (!job.cancelled && !job.restart) post(job.port, { id: job.msg.id, error: errorText(err) });
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
      running.onRestart?.();
      engine?.interrupt();
    }
  }

  return {
    status: () => ({ ...status }),
    setModel(next) {
      if (next === status.modelId) return;
      if (running && (running.phase === 'loading' || running.phase === 'streaming')) {
        running.restart = true;
        running.onRestart?.();
        engine?.interrupt();
      }
      release(engine);
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
