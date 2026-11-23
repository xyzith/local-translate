export function createClient({ connect }) {
  let portPromise = null;
  let nextId = 1;
  const pending = new Map();

  function getPort() {
    if (portPromise) return portPromise;
    portPromise = connect().then((port) => {
      port.onMessage.addListener((msg) => {
        const req = pending.get(msg.id);
        if (!req) return;
        if (msg.error) req.reject(new Error(msg.error));
        else if (msg.done) req.resolve({ tps: msg.tps });
        else req.onText(msg.text);
      });
      port.onDisconnect.addListener(() => {
        portPromise = null;
        for (const req of pending.values()) req.reject(new Error('翻譯引擎中斷連線'));
      });
      return port;
    });
    portPromise.catch(() => { portPromise = null; });
    return portPromise;
  }

  return {
    async translate({ text, context }, { onText, signal }) {
      const port = await getPort();
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const finish = (fn) => (value) => {
          pending.delete(id);
          signal.removeEventListener('abort', onAbort);
          fn(value);
        };
        const onAbort = () => {
          try { port.postMessage({ type: 'cancel', id }); } catch { /* port closed */ }
          finish(reject)(new DOMException('aborted', 'AbortError'));
        };
        pending.set(id, { onText, resolve: finish(resolve), reject: finish(reject) });
        signal.addEventListener('abort', onAbort);
        port.postMessage({ type: 'translate', id, text, context });
      });
    },
  };
}
