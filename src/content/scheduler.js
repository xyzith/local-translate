export function createScheduler({ run, concurrency = 1 }) {
  let queue = [];
  let seen = new Set();
  let controller = new AbortController();
  let active = 0;

  function pump() {
    while (active < concurrency && queue.length) {
      const idx = Math.max(0, queue.findIndex((q) => q.visible));
      const [{ item }] = queue.splice(idx, 1);
      const { signal } = controller;
      active++;
      Promise.resolve()
        .then(() => run(item, signal))
        .catch(() => {})
        .finally(() => {
          if (signal !== controller.signal) return;
          active--;
          pump();
        });
    }
  }

  return {
    enqueue(item, { visible }) {
      if (seen.has(item)) return;
      seen.add(item);
      queue.push({ item, visible });
      pump();
    },
    setVisible(item, visible) {
      const entry = queue.find((q) => q.item === item);
      if (!entry) return;
      queue = [...queue.filter((q) => q !== entry), { item, visible }];
    },
    cancelAll() {
      controller.abort();
      controller = new AbortController();
      queue = [];
      seen = new Set();
      active = 0;
    },
  };
}
