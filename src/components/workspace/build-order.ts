import { partLetters } from "@/lib/yard/pdfDraw";
import { stepOwners } from "@/lib/yard/planStepPicture";
import { planStepParts } from "@/lib/yard/stepParts";
import type { BuildPlan, YardProject } from "@/lib/yard/types";

/**
 * Which build group places each part (UI animation only), from the same per-step part owners the
 * step pictures use (F12, PR #19): one group per build step, in step order.
 * Parts no step owns land with the last group. n = number of groups.
 */
export function buildOrder(project: YardProject, plan: Pick<BuildPlan, "instructions" | "cutList">): { at: Map<string, number>; n: number; stale: boolean } {
  const steps = plan.instructions;
  const letters = partLetters(project, plan.cutList);
  const parts = planStepParts(project, steps, letters);
  const owner = stepOwners(project, steps, parts);
  const ids = new Set([...project.panels.map((p) => p.id), ...project.instances.map((i) => i.id)]);
  // A plan from the previous build names parts this model does not have: no reveal.
  const stale = [...owner.keys()].some((id) => !ids.has(id));
  // Every step from the first build step on is a beat, in order (cut steps aside); one that places
  // nothing (Level it, staple the cloth, seal) is a short held beat so the rhythm follows the list.
  const first = parts.findIndex((sp) => sp.kind === "build");
  const order = first < 0 ? [] : parts.map((sp, i) => (i >= first && sp.kind !== "cut" ? i : -1)).filter((i) => i >= 0);
  for (const s of owner.values()) if (!order.includes(s)) order.push(s);
  order.sort((a, b) => a - b);
  const rank = new Map(order.map((s, i) => [s, i]));
  const at = new Map<string, number>();
  for (const [id, s] of owner) at.set(id, rank.get(s)!);
  const n = order.length;
  // Parts no step owns (the second side wall, the other roof panel) go in with their twin: the beat
  // of an owned part with the same name minus its number. Failing that, the last beat that places
  // something (never a trailing pause beat), so no beat repeats an earlier beat's label.
  const base = (s: string) => s.replace(/\s*\d+$/, "").replace(/\s+(left|right|front|back|top|bottom)$/i, "").toLowerCase();
  const names = new Map<string, string>([...project.panels.map((p) => [p.id, p.name] as const), ...project.instances.map((i) => [i.id, i.role ?? i.id] as const)]);
  const twinBeat = new Map<string, number>();
  for (const [id, g] of at) {
    const b = base(names.get(id) ?? id);
    if (!twinBeat.has(b)) twinBeat.set(b, g);
  }
  const lastPlacing = at.size ? Math.max(...at.values()) : Math.max(0, n - 1);
  for (const id of names.keys()) if (!at.has(id)) at.set(id, twinBeat.get(base(names.get(id)!)) ?? lastPlacing);
  return { at, n, stale };
}
