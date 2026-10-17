/**
 * Run `callback` once the main thread is idle, so background work (chunk
 * prefetch, warming caches) stays out of the way of startup and interaction.
 * `timeoutMs` bounds how long it can be starved. Safari has no
 * requestIdleCallback, so there it falls back to a plain timer. Returns a
 * cancel function.
 */
export function onIdle(callback: () => void, timeoutMs = 3000): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: timeoutMs });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 500);
  return () => window.clearTimeout(id);
}

/**
 * Run `tasks` in order, one per idle slot, so a batch of background work (say
 * ten chunk prefetches) never lands on the main thread at once. Returns a
 * cancel function.
 */
export function runOnePerIdle(tasks: Array<() => void>, firstTimeoutMs = 4000): () => void {
  const queue = [...tasks];
  let cancel = () => {};
  const step = () => {
    const task = queue.shift();
    if (!task) return;
    task();
    cancel = onIdle(step);
  };
  cancel = onIdle(step, firstTimeoutMs);
  return () => cancel();
}

/** True when the user has asked the browser to save data; skip speculative prefetch then. */
export function prefersSavedData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}
