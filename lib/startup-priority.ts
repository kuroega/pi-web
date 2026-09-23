type Cleanup = () => void;

let criticalStartupReady = false;
const listeners = new Set<() => void>();

/** Mark the session/model path ready so nonessential startup work can begin. */
export function markCriticalStartupReady(): void {
  if (criticalStartupReady) return;
  criticalStartupReady = true;
  for (const listener of listeners) listener();
  listeners.clear();
}

/**
 * Run lower-priority work after the model catalog is usable. The timeout keeps
 * welcome screens and failed catalog loads from suppressing background work.
 */
export function runAfterCriticalStartup(callback: () => void, fallbackMs = 30_000): Cleanup {
  let active = true;
  const run = () => {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    listeners.delete(run);
    callback();
  };
  const timer = setTimeout(run, fallbackMs);
  if (criticalStartupReady) queueMicrotask(run);
  else listeners.add(run);
  return () => {
    active = false;
    clearTimeout(timer);
    listeners.delete(run);
  };
}
