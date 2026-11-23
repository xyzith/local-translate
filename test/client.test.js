import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../src/content/client.js';
import { fakePortPair, settle } from './helpers/fake-port.js';

function setup(respond) {
  const pairs = [];
  const connect = async () => {
    const pair = fakePortPair();
    pair.host.onMessage.addListener((msg) => respond(msg, pair.host));
    pairs.push(pair);
    return pair.content;
  };
  return { client: createClient({ connect }), pairs };
}

test('resolves with tokens/s after streaming text', async () => {
  const { client } = setup((msg, port) => {
    if (msg.type !== 'translate') return;
    port.postMessage({ id: msg.id, text: '你' });
    port.postMessage({ id: msg.id, text: '你好' });
    port.postMessage({ id: msg.id, done: true, tps: 9 });
  });
  const seen = [];
  const result = await client.translate({ text: 'hi', context: {} }, { onText: (t) => seen.push(t), signal: new AbortController().signal });
  assert.deepEqual(seen, ['你', '你好']);
  assert.deepEqual(result, { tps: 9 });
});

test('rejects with the engine error message', async () => {
  const { client } = setup((msg, port) => port.postMessage({ id: msg.id, error: 'WebGPU 不可用' }));
  await assert.rejects(client.translate({ text: 'x', context: {} }, { onText() {}, signal: new AbortController().signal }), /WebGPU 不可用/);
});

test('abort sends cancel and rejects', async () => {
  const got = [];
  const { client } = setup((msg) => got.push(msg));
  const ac = new AbortController();
  const p = client.translate({ text: 'x', context: {} }, { onText() {}, signal: ac.signal });
  await settle();
  ac.abort();
  await assert.rejects(p, { name: 'AbortError' });
  await settle();
  assert.deepEqual(got.map((m) => m.type), ['translate', 'cancel']);
});

test('host disconnect fails pending requests and the next call reconnects', async () => {
  const { client, pairs } = setup((msg, port) => {
    if (pairs.length > 1) port.postMessage({ id: msg.id, done: true, tps: 1 });
  });
  const p = client.translate({ text: 'x', context: {} }, { onText() {}, signal: new AbortController().signal });
  await settle();
  pairs[0].host.disconnect();
  await assert.rejects(p, /中斷/);
  const again = await client.translate({ text: 'y', context: {} }, { onText() {}, signal: new AbortController().signal });
  assert.deepEqual(again, { tps: 1 });
  assert.equal(pairs.length, 2);
});
