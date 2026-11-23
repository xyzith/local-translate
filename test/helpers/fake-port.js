export function fakePortPair() {
  const listeners = { a: [], b: [], aDisc: [], bDisc: [] };
  const make = (self, other, selfDisc, otherDisc) => ({
    sent: [],
    postMessage(msg) { this.sent.push(msg); queueMicrotask(() => listeners[other].forEach((f) => f(msg))); },
    onMessage: { addListener: (f) => listeners[self].push(f) },
    onDisconnect: { addListener: (f) => listeners[selfDisc].push(f) },
    disconnect() { listeners[otherDisc].forEach((f) => f()); },
  });
  return { content: make('a', 'b', 'aDisc', 'bDisc'), host: make('b', 'a', 'bDisc', 'aDisc') };
}

export const settle = () => new Promise((r) => setTimeout(r, 5));
