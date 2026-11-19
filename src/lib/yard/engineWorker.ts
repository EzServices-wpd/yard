/**
 * Runs one engine call in a module Web Worker (perf fix 1) and holds the answer for the store (engineCache.ts).
 * Never required: with no Worker (SSR, tests, an old browser), on a worker error, or past the deadline it resolves
 * false and the store builds on the main thread as before.
 */
import { callKey, holdAnswer, type EngineArgs, type EngineAnswer } from "./engineCache";

const DEADLINE_MS = 15_000;
let worker: Worker | null | undefined;
let seq = 0;
const waiting = new Map<number, (a: EngineAnswer | null) => void>();

function engineWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    if (typeof Worker === "undefined" || typeof window === "undefined") return (worker = null);
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module", name: "yard-engine" });
    worker.onmessage = (e: MessageEvent<EngineAnswer>) => { waiting.get(e.data.id)?.(e.data); waiting.delete(e.data.id); };
    worker.onerror = () => { for (const done of waiting.values()) done(null); waiting.clear(); worker = null; };
  } catch { worker = null; }
  return worker;
}

/** Builds off the main thread and holds the answer. True when the store will find it. */
export function prebuild(args: EngineArgs, ignoredFor?: string): Promise<boolean> {
  const w = engineWorker();
  if (!w || args[2] != null) return Promise.resolve(false); // a form recipe stays on the main thread
  const id = ++seq, key = callKey(args);
  return new Promise((ok) => {
    const timer = setTimeout(() => { waiting.delete(id); ok(false); }, DEADLINE_MS);
    waiting.set(id, (a) => {
      clearTimeout(timer);
      if (!a || a.error || !a.project) return ok(false);
      holdAnswer(a, ignoredFor);
      ok(true);
    });
    try { w.postMessage({ id, key, args, ignoredFor }); } catch { clearTimeout(timer); waiting.delete(id); ok(false); }
  });
}

/**
 * Starts the worker at idle, so its copy of the engine downloads and parses while the page is read or the words are
 * typed, not when the first build is asked for. Does nothing without Worker support.
 */
export function warmEngine(): void {
  if (typeof window === "undefined") return;
  const go = () => { engineWorker(); };
  const idle = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(go, { timeout: 3000 });
  else setTimeout(go, 1500);
}
