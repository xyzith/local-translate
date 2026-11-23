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

test('switching model mid-job reruns that job on the new model instead of dropping it', async () => {
  const { createEngine, made } = fakeEngineFactory({ chunks: ['a', 'ab', 'abc', 'abcd'] });
  const host = createHost({ createEngine, cache: memoryCache(), modelId: 'A' });
  const { content, hostPort } = await connect(host);
  content.postMessage(job(1));
  content.postMessage(job(2, 'queued'));
  await settle(); await settle();
  host.setModel('B');
  for (let i = 0; i < 20; i++) await settle();
  assert.deepEqual(made.map((e) => e.modelId), ['A', 'B']);
  const doneIds = hostPort.sent.filter((m) => m.done).map((m) => m.id);
  assert.deepEqual(doneIds, [1, 2]);
});

test('status reports the model build the engine actually runs', async () => {
  const createEngine = async () => ({ runtimeModelId: 'm-q4f32_1-MLC', stream: async () => ({ tps: 1 }), interrupt() {} });
  const host = createHost({ createEngine, cache: memoryCache(), modelId: 'm-q4f16_1-MLC' });
  const { content } = await connect(host);
  content.postMessage(job(1));
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(host.status().runtimeModelId, 'm-q4f32_1-MLC');
});

test('non-Error throws still produce a readable error string', async () => {
  const createEngine = async () => { throw 'device lost'; };
  const host = createHost({ createEngine, cache: memoryCache(), modelId: 'm' });
  const { content, hostPort } = await connect(host);
  content.postMessage(job(1));
  await settle(); await settle();
  assert.deepEqual(hostPort.sent.at(-1), { id: 1, error: 'device lost' });
});

test('empty output is not cached; a failing cache write does not fail the job', async () => {
  const { createEngine } = fakeEngineFactory({ chunks: ['  '] });
  const cache = memoryCache();
  const host = createHost({ createEngine, cache, modelId: 'm' });
  const { content, hostPort } = await connect(host);
  content.postMessage(job(1));
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(cache.map.size, 0);

  const broken = { get: async () => undefined, put: async () => { throw new Error('quota'); } };
  const host2 = createHost({ createEngine: fakeEngineFactory().createEngine, cache: broken, modelId: 'm' });
  const c2 = await connect(host2);
  c2.content.postMessage(job(2));
  for (let i = 0; i < 8; i++) await settle();
  assert.ok(c2.hostPort.sent.at(-1).done);
  assert.ok(hostPort.sent.at(-1).done);
});

test('switching model while the old one is still loading does not wait for it', async () => {
  const made = [];
  let progressA;
  const createEngine = (modelId, onProgress) => {
    made.push(modelId);
    if (modelId === 'A') { progressA = onProgress; return new Promise(() => {}); }
    return Promise.resolve({ stream: async () => ({ tps: 3 }), interrupt() {} });
  };
  const host = createHost({ createEngine, cache: memoryCache(), modelId: 'A' });
  const { content, hostPort } = await connect(host);
  content.postMessage(job(1));
  await settle();
  host.setModel('B');
  progressA({ progress: 0.5, text: 'stale' });
  for (let i = 0; i < 5; i++) await settle();
  assert.deepEqual(made, ['A', 'B']);
  assert.deepEqual(hostPort.sent.at(-1), { id: 1, done: true, tps: 3 });
  assert.notEqual(host.status().text, 'stale');
});

test('cache keys change with the prompt version', async () => {
  const { PROMPT_VERSION } = await import('../src/shared/prompt.js');
  const bytes = new TextEncoder().encode(`m\nv${PROMPT_VERSION}\nHello`);
  const expected = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
  assert.equal(await cacheKey('m', 'Hello'), expected);
});

test('output that is not Chinese is retried once with a correction turn', async () => {
  const outputs = ['The spell grants All Access.', '這個法術需要 All Access 會員資格。'];
  const seen = [];
  const createEngine = async () => ({
    async stream(messages, { onText }) { seen.push(messages); onText(outputs[seen.length - 1]); return { tps: 5 }; },
    interrupt() {},
  });
  const cache = memoryCache();
  const host = createHost({ createEngine, cache, modelId: 'm' });
  const { content, hostPort } = await connect(host);
  content.postMessage(job(1, 'The spell auto-grant requires All Access membership.'));
  for (let i = 0; i < 6; i++) await settle();
  assert.equal(seen.length, 2);
  assert.deepEqual(seen[1].slice(-2).map((m) => m.role), ['assistant', 'user']);
  assert.equal(hostPort.sent.filter((m) => 'text' in m).at(-1).text, '這個法術需要 All Access 會員資格。');
  assert.deepEqual([...cache.map.values()], ['這個法術需要 All Access 會員資格。']);
});

test('a second English answer is shown as-is but not cached', async () => {
  let calls = 0;
  const createEngine = async () => ({
    async stream(messages, { onText }) { calls++; onText('Still English.'); return { tps: 5 }; },
    interrupt() {},
  });
  const cache = memoryCache();
  const host = createHost({ createEngine, cache, modelId: 'm' });
  const { content, hostPort } = await connect(host);
  content.postMessage(job(1));
  for (let i = 0; i < 6; i++) await settle();
  assert.equal(calls, 2);
  assert.ok(hostPort.sent.at(-1).done);
  assert.equal(cache.map.size, 0);
});
