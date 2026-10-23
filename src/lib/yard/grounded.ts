/**
 * I1's rule for the usable-size check (usableFloors.ts): every panel reaches the floor or a wall through what it rests on.
 * invariants.ts keeps I1 as the grader's own copy (the engine can't import the grader: invariants.ts imports promptMain);
 * usableFloors.table.test.ts holds the two to the same parts on every probe build, so they can't drift apart.
 */
import { supportsOf } from "./supportGraph";
import type { Panel, YardProject } from "./types";

export function ungroundedParts(p: YardProject): Panel[] {
  if (!p.panels.length) return [];
  const sup = supportsOf(p);
  const wall = p.assumptions?.installMode === "wall" || p.assumptions?.installMode === "alcove";
  const memo = new Map<string, boolean>();
  const grounded = (id: string, seen: Set<string>): boolean => {
    if (memo.has(id)) return memo.get(id)!;
    const s = sup.get(id);
    if (!s) return true; // parts the graph does not track (hardware) are carried by their host
    if (s.how === "floor") return true;
    if (seen.has(id)) return wall; // a closed ring of parts on a wall-hung build hangs on the wall
    seen.add(id);
    const ok = s.on.length > 0 ? s.on.some((o) => grounded(o, seen)) : wall;
    memo.set(id, ok);
    return ok;
  };
  return p.panels.filter((q) => !grounded(q.id, new Set()));
}
