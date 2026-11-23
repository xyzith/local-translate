export function createQueue({ run }) {
  const pending = new Map();
  let running = null;

  async function pump() {
    if (running) return;
    const next = pending.entries().next();
    if (next.done) return;
    const [key, job] = next.value;
    running = { key, controller: new AbortController() };
    try {
      await run(job, running.controller.signal);
    } catch {
      /* run() reports its own failures */
    }
    pending.delete(key);
    running = null;
    pump();
  }

  return {
    add(key, item) {
      if (pending.has(key)) return;
      pending.set(key, item);
      pump();
    },
    cancel(key) {
      if (running?.key === key) running.controller.abort();
      else pending.delete(key);
    },
  };
}
