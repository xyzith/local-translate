import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue } from '../src/content/queue.js';

function deferredRunner() {
  const calls = [];
  const run = (item, signal) => new Promise((resolve) => calls.push({ item, signal, resolve }));
  return { calls, run };
}
const tick = () => new Promise((r) => setImmediate(r));

test('runs one item at a time in click order', async () => {
  const { calls, run } = deferredRunner();
  const q = createQueue({ run });
  q.add('a', 'A'); q.add('b', 'B'); q.add('c', 'C');
  const order = [];
  for (let i = 0; i < 3; i++) { await tick(); assert.equal(calls.length, i + 1); order.push(calls[i].item); calls[i].resolve(); }
  assert.deepEqual(order, ['A', 'B', 'C']);
});

test('the same key is not queued twice while pending', async () => {
  const { calls, run } = deferredRunner();
  const q = createQueue({ run });
  q.add('a', 'A1'); q.add('a', 'A2');
  await tick(); calls[0].resolve(); await tick();
  assert.equal(calls.length, 1);
  q.add('a', 'A3');
  await tick();
  assert.equal(calls[1].item, 'A3');
});

test('cancel drops a queued item and aborts a running one', async () => {
  const { calls, run } = deferredRunner();
  const q = createQueue({ run });
  q.add('a', 'A'); q.add('b', 'B'); q.add('c', 'C');
  await tick();
  q.cancel('b');
  q.cancel('a');
  assert.equal(calls[0].signal.aborted, true);
  calls[0].resolve(); await tick();
  assert.deepEqual(calls.map((c) => c.item), ['A', 'C']);
});

test('a failing item does not stall the queue', async () => {
  const seen = [];
  const q = createQueue({ run: async (item) => { seen.push(item); if (item === 'A') throw new Error('boom'); } });
  q.add('a', 'A'); q.add('b', 'B');
  await tick(); await tick(); await tick();
  assert.deepEqual(seen, ['A', 'B']);
});
