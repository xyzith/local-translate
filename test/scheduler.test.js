import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduler } from '../src/content/scheduler.js';

function deferredRunner() {
  const calls = [];
  const run = (item, signal) => new Promise((resolve) => calls.push({ item, signal, resolve }));
  return { calls, run };
}
const tick = () => new Promise((r) => setImmediate(r));

test('visible items run before off-screen ones, in arrival order', async () => {
  const { calls, run } = deferredRunner();
  const s = createScheduler({ run, concurrency: 1 });
  s.enqueue('blocker', { visible: true });
  s.enqueue('offscreen', { visible: false });
  s.enqueue('v1', { visible: true });
  s.enqueue('v2', { visible: true });
  const order = [];
  for (let i = 0; i < 4; i++) { await tick(); order.push(calls.at(-1).item); calls.at(-1).resolve(); }
  assert.deepEqual(order, ['blocker', 'v1', 'v2', 'offscreen']);
});

test('setVisible re-prioritises a queued item', async () => {
  const { calls, run } = deferredRunner();
  const s = createScheduler({ run });
  s.enqueue('blocker', { visible: true });
  s.enqueue('a', { visible: false });
  s.enqueue('b', { visible: true });
  s.setVisible('b', false);
  s.setVisible('a', true);
  await tick(); calls[0].resolve(); await tick();
  assert.equal(calls[1].item, 'a');
});

test('an item is never queued or run twice', async () => {
  const { calls, run } = deferredRunner();
  const s = createScheduler({ run });
  s.enqueue('x', { visible: true });
  s.enqueue('x', { visible: true });
  await tick(); calls[0].resolve(); await tick();
  s.enqueue('x', { visible: true });
  await tick();
  assert.equal(calls.length, 1);
});

test('cancelAll aborts the running job and drops the queue', async () => {
  const { calls, run } = deferredRunner();
  const s = createScheduler({ run });
  s.enqueue('a', { visible: true });
  s.enqueue('b', { visible: true });
  await tick();
  s.cancelAll();
  assert.equal(calls[0].signal.aborted, true);
  calls[0].resolve(); await tick();
  assert.equal(calls.length, 1);
});

test('a failing job does not stall the queue', async () => {
  let n = 0;
  const seen = [];
  const s = createScheduler({ run: async (item) => { seen.push(item); if (n++ === 0) throw new Error('boom'); } });
  s.enqueue('a', { visible: true });
  s.enqueue('b', { visible: true });
  await tick(); await tick(); await tick();
  assert.deepEqual(seen, ['a', 'b']);
});
