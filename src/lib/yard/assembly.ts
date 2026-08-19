import type { AssemblyStep, Vec3, YardInstance, YardProject } from "./types";
import { dist3, homeOf } from "./ghost";

export const SNAP_IN = 2.15;

export function withHome(instances: YardInstance[]): YardInstance[] {
  return instances.map((i) => ({
    ...i,
    home: i.home ?? { ...i.position },
  }));
}

export function stepInstanceIds(project: YardProject, step: AssemblyStep): string[] {
  const keys = (step.partsUsed ?? []).map((s) => s.toLowerCase());
  if (!keys.length) return [];
  const ids: string[] = [];
  for (const inst of project.instances) {
    const role = (inst.role ?? "member").toLowerCase();
    if (keys.some((k) => k === role || k.includes(role) || role.includes(k))) ids.push(inst.id);
  }
  for (const p of project.panels) {
    const name = p.name.toLowerCase();
    const type = p.type.toLowerCase();
    if (keys.some((k) => name.includes(k) || k.includes(name) || k.includes(type) || type.includes(k))) {
      ids.push(p.id);
    }
  }
  return ids;
}

export function firstBuildableStep(steps: AssemblyStep[], project: YardProject) {
  return steps.find((s) => stepInstanceIds(project, s).length > 0) ?? steps[0] ?? null;
}

export function pilePosition(index: number, count: number, overall: { width: number; depth: number }): Vec3 {
  const cols = Math.min(14, Math.max(8, Math.ceil(Math.sqrt(Math.max(count, 1)) * 1.1)));
  const col = index % cols;
  const row = Math.floor(index % cols === 0 && false ? 0 : Math.floor(index / cols));
  return {
    x: overall.width * 0.52 + 5 + col * 1.15,
    y: 0.32,
    z: -Math.min(overall.depth, 18) * 0.42 + row * 1.05,
  };
}

export function maybeSnap(pos: Vec3, home: Vec3): Vec3 {
  return dist3(pos, home) <= SNAP_IN ? { ...home } : pos;
}

export function nearHome(pos: Vec3, home: Vec3) {
  return dist3(pos, home) <= SNAP_IN;
}

export { homeOf };
