/** Shared by the invariant ratchet and the eval scoreboard: run the checks with the network off. */
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { checkBuild, PER_BUILD, type Violation } from "../src/lib/yard/invariants.ts";

export function offline<T>(f: () => T): T {
  const real = globalThis.fetch;
  globalThis.fetch = (() => { throw new Error("no network: invariants and evals never call xAI"); }) as typeof fetch;
  try { return f(); } finally { globalThis.fetch = real; }
}
export function violations(prompts: string[]): Map<string, string> {
  return offline(() => {
    const out = new Map<string, string>();
    for (const q of prompts) {
      let vs: Pick<Violation, "id" | "msg">[];
      try { vs = checkBuild(generateFromPrompt(q), q); } catch (e) { vs = [{ id: "I1", msg: `build threw: ${String(e).slice(0, 80)}` }]; }
      for (const x of vs) if (!out.has(`${x.id}|${q}`)) out.set(`${x.id}|${q}`, x.msg);
    }
    return out;
  });
}
/** Score = (prompt, invariant) pairs that pass, over the frozen eval prompts. */
export function evalScore(prompts: string[]): { score: number; max: number; failing: string[] } {
  const v = violations(prompts);
  const max = prompts.length * PER_BUILD.length;
  return { score: max - v.size, max, failing: [...v.keys()].sort() };
}
