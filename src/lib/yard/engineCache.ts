/**
 * The one answer the engine worker handed back (perf fix 1), waiting for the store to use it. The store takes a build
 * only for the exact call it is about to make, and a plan only for the exact project on the bench; anything else
 * misses and the store computes on the main thread, as before. So a stale or mismatched answer can never show.
 */
import type { BuildPlan, YardProject } from "./types";
import type { generateFromPrompt } from "./promptMain";

export type EngineArgs = Parameters<typeof generateFromPrompt>;
export type EngineAsk = { id: number; key: string; args: EngineArgs; ignoredFor?: string };
export type EngineAnswer = { id: number; key: string; project?: YardProject; plan?: BuildPlan; ignored?: string[] | null; error?: string; ms: number };

/** The call's identity: its arguments as JSON (a form recipe is never sent to the worker, so all are plain data). */
export const callKey = (args: EngineArgs): string => JSON.stringify(args);

let held: { key: string; project: YardProject; json: string | null; plan: BuildPlan | null; ignored: { prompt: string; words: string[] } | null } | null = null;

export function holdAnswer(a: EngineAnswer, ignoredFor?: string): void {
  if (!a.project || a.error) { held = null; return; }
  held = { key: a.key, project: a.project, json: null, plan: a.plan ?? null, ignored: ignoredFor && a.ignored ? { prompt: ignoredFor, words: a.ignored } : null };
}

/** The held build, for exactly this call (a repeat of the same call gets the same build, as the engine would). */
export function takeBuild(args: EngineArgs): YardProject | null {
  if (!held || held.key !== callKey(args)) return null;
  return held.project;
}

const same = (a: YardProject, b: YardProject, bJson: () => string) => a === b || JSON.stringify(a) === bJson();
const heldJson = () => (held!.json ??= JSON.stringify(held!.project));

/** The held plan, for exactly the project on the bench (the same object, or equal as JSON). */
export function takePlan(project: YardProject): BuildPlan | null {
  if (!held?.plan || !same(project, held.project, heldJson)) return null;
  return held.plan;
}

/** The ignored-words read the worker made on this build, for these words. */
export function takeIgnored(project: YardProject, prompt: string): string[] | null {
  if (!held?.ignored || held.ignored.prompt !== prompt || !same(project, held.project, heldJson)) return null;
  return held.ignored.words;
}

export function dropHeld(): void { held = null; }
