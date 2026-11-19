/// <reference lib="webworker" />
/**
 * The engine off the main thread (perf fix 1): the exact call the store would make (store.engineCallFor), run here,
 * then the plan and the ignored-words read on the same build. The answer is the engine's own output, passed by
 * structured clone (every corpus build clones to an equal value: scripts/engine-worker.test.ts), so what the bench
 * shows is byte-identical to the main-thread build.
 */
import { generateFromPrompt, ignoredTypedWords } from "./promptMain";
import { buildPlan } from "./report";
import type { EngineAsk, EngineAnswer } from "./engineCache";

export function answer(ask: EngineAsk): EngineAnswer {
  const t0 = performance.now();
  try {
    const project = generateFromPrompt(...ask.args);
    const plan = buildPlan(project);
    const ignored = ask.ignoredFor ? ignoredTypedWords(project, ask.ignoredFor) : null;
    return { id: ask.id, key: ask.key, project, plan, ignored, ms: performance.now() - t0 };
  } catch (err) {
    return { id: ask.id, key: ask.key, error: String(err).slice(0, 200), ms: performance.now() - t0 };
  }
}

const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
if (typeof scope.postMessage === "function" && typeof (scope as { document?: unknown }).document === "undefined") {
  scope.onmessage = (e: MessageEvent<EngineAsk>) => scope.postMessage(answer(e.data));
}
