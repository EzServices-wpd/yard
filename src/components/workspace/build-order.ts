import { stepInstanceIds } from "@/lib/yard/assembly";
import { stepKindOf } from "@/lib/yard/stepParts";
import type { AssemblyStep, YardProject } from "@/lib/yard/types";

/**
 * Which build step first places each part (UI animation only). Prep/cut steps and "*" steps are
 * skipped so the box goes up in the order the plan builds it. n = number of placing steps.
 */
export function buildOrder(project: YardProject, steps: AssemblyStep[]): { at: Map<string, number>; n: number } {
  const at = new Map<string, number>();
  let n = 0;
  for (const st of steps) {
    const keys = (st.partsUsed ?? []).map((k) => k.toLowerCase());
    if (keys.includes("*") || keys.includes("all")) continue;
    const all = stepInstanceIds(project, st);
    if (stepKindOf(st, all) !== "build") continue;
    const ids = all.filter((id) => !at.has(id));
    if (!ids.length) continue;
    for (const id of ids) at.set(id, n);
    n++;
  }
  return { at, n };
}
