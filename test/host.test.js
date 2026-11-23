import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHost } from '../src/offscreen/host.js';
import { openCache, cacheKey } from '../src/offscreen/cache.js';
import { fakePortPair, settle } from './helpers/fake-port.js';

function fakeEngineFactory({ fail = false, chunks = ['<think></think>', '你', '你好'] } = {}) {
  const made = [];
  const createEngine = async (modelId, onProgress) => {
    if (fail) throw new Error('WebGPU 不可用');
    onProgress({ progress: 1, text: 'loaded' });
    const engine = {
      modelId, calls: 0, interrupted: false,
      async stream(messages, { onText }) {
        engine.calls++;
        for (const c of chunks) { if (engine.interrupted) break; onText(c); await settle(); }
        return { tps: 12.5, interrupted: engine.interrupted };
      },
      interrupt() { engine.interrupted = true; },
    };
    made.push(engine);
    return engine;
  };
  return { createEngine, made };
}

function memoryCache() {
  const m = new Map();
  return { get: async (k) => m.get(k), put: async (k, v) => { m.set(k, v); }, map: m };
}

const job = (id, text = 'Hello') => ({ type: 'translate', id, text, context: {} });

async function connect(host) {
  const { content, host: hostPort } = fakePortPair();
  host.handlePort(hostPort);
  return { content, hostPort };
}

test('streams stripped text, then done with tokens/s, and caches the result', async () => {
  const { createEngine } = fakeEngineFactory();
  const cache = memoryCache();
  const host = createHost({ createEngine, cache, modelId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC' });
  const { content, hostPort } = await connect(host);
  content.postMessage(job(1));
  for (let i = 0; i < 10; i++) await settle();
  const msgs = hostPort.sent;
  assert.deepEqual(msgs.filter((m) => 'text' in m).map((m) => m.text), ['', '你', '你好']);
  assert.deepEqual(msgs.at(-1), { id: 1, done: true, tps: 12.5 });
  assert.equal(cache.map.size, 1);
  assert.equal(host.status().state, 'ready');
  assert.equal(host.status().tps, 12.5);
});

test('a cache hit skips the engine', async () => {
  const { createEngine, made } = fakeEngineFactory();
  const cache = memoryCache();
  const modelId = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
  await cache.put(await cacheKey(modelId, 'Hello'), '快取的');
  const host = createHost({ createEngine, cache, modelId });
  const { content, hostPort } = await connect(host);
  content.postMessage(job(7));
  await settle(); await settle();
  assert.deepEqual(hostPort.sent, [{ id: 7, text: '快取的' }, { id: 7, done: true }]);
  assert.equal(made.length, 0);
});

test('cache keys differ per model', async () => {
  assert.notEqual(await cacheKey('A', 'Hello'), await cacheKey('B', 'Hello'));
});

test('engine load failure is reported per request and in status', async () => {
  const { createEngine } = fakeEngineFactory({ fail: true });
  const host = createHost({ createEngine, cache: memoryCache(), modelId: 'm' });
  const { content, hostPort } = await connect(host);
  content.postMessage(job(2));
  await settle(); await settle();
  assert.deepEqual(hostPort.sent.at(-1), { id: 2, error: 'WebGPU 不可用' });
  assert.equal(host.status().state, 'error');
  assert.equal(host.status().error, 'WebGPU 不可用');
});

test('cancel interrupts the running job, drops queued ones, and nothing is cached', async () => {
  const { createEngine, made } = fakeEngineFactory({ chunks: ['a', 'b', 'c', 'd', 'e'] });
  const cache = memoryCache();
  const host = createHost({ createEngine, cache, modelId: 'm' });
  const { content, hostPort } = await connect(host);
  content.postMessage(job(1, 'one'));
  content.postMessage(job(2, 'two'));
  await settle();
  content.postMessage({ type: 'cancel', id: 1 });
  content.postMessage({ type: 'cancel', id: 2 });
  for (let i = 0; i < 10; i++) await settle();
  assert.equal(made[0].calls, 1);
  assert.equal(cache.map.size, 0);
  assert.ok(!hostPort.sent.some((m) => m.id === 2));
});

test('a disconnected tab does not keep the engine busy', async () => {
  const { createEngine, made } = fakeEngineFactory({ chunks: ['a', 'b', 'c', 'd'] });
  const host = createHost({ createEngine, cache: memoryCache(), modelId: 'm' });
  const { content } = await connect(host);
  content.postMessage(job(1, 'one'));
  content.postMessage(job(2, 'two'));
  await settle();
  content.disconnect();
  for (let i = 0; i < 10; i++) await settle();
  assert.equal(made[0].calls, 1);
  assert.equal(made[0].interrupted, true);
});

test('switching model reloads the engine for the next job', async () => {
  const { createEngine, made } = fakeEngineFactory();
  const host = createHost({ createEngine, cache: memoryCache(), modelId: 'A' });
  const { content } = await connect(host);
  content.postMessage(job(1));
  for (let i = 0; i < 6; i++) await settle();
  host.setModel('B');
  content.postMessage(job(2, 'Other'));
  for (let i = 0; i < 6; i++) await settle();
  assert.deepEqual(made.map((e) => e.modelId), ['A', 'B']);
  assert.equal(host.status().modelId, 'B');
});

test('idb cache round-trips', async () => {
  const cache = await openCache();
  await cache.put('k', '值');
  assert.equal(await cache.get('k'), '值');
  assert.equal(await cache.get('missing'), undefined);
});
