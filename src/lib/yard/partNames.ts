/**
 * Every part a step names is one part (F12 part ownership). Two parts with the exact same name leave a step's
 * parts list unable to say which one it means (the birdhouse's "Side wall" ×2: the step reveal lit one and
 * left the other with no owning step). Same-named parts take the word for where they sit — left/right,
 * front/back or lower/upper, along the axis that separates them most — or a number when they share a spot.
 */
import type { Panel, YardProject } from "./types";

const AXES: { key: "x" | "y" | "z"; lo: string; hi: string }[] = [
  { key: "x", lo: "Left", hi: "Right" },
  { key: "z", lo: "Back", hi: "Front" },
  { key: "y", lo: "Lower", hi: "Upper" },
];
const centre = (p: Panel, k: "x" | "y" | "z") =>
  p.position[k] + (k === "x" ? p.size.width : k === "y" ? p.size.height : p.size.depth) / 2;
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** Names for a group of same-named parts, in their order. */
function namesFor(group: Panel[], name: string): string[] {
  if (group.length === 2) {
    const [a, b] = group;
    const best = AXES.map((ax) => ({ ax, d: centre(b, ax.key) - centre(a, ax.key) })).sort((p, q) => Math.abs(q.d) - Math.abs(p.d))[0];
    const already = new RegExp(`\\b(${best.ax.lo}|${best.ax.hi})\\b`, "i").test(name);
    if (Math.abs(best.d) > 0.1 && !already) {
      const [loW, hiW] = best.d > 0 ? [best.ax.lo, best.ax.hi] : [best.ax.hi, best.ax.lo];
      return [`${loW} ${lowerFirst(name)}`, `${hiW} ${lowerFirst(name)}`];
    }
  }
  return group.map((_, i) => `${name} ${String.fromCharCode(65 + i)}`.replace(/(\d) ([A-Z])$/, "$1$2"));
}

export function withUniquePartNames(project: YardProject): YardProject {
  const panels = project.panels ?? [];
  const groups = new Map<string, Panel[]>();
  for (const p of panels) groups.set(p.name, [...(groups.get(p.name) ?? []), p]);
  const dup = [...groups].filter(([, g]) => g.length > 1);
  if (!dup.length) return project;
  const rename = new Map<string, string>();
  const taken = new Set(panels.map((p) => p.name));
  for (const [name, g] of dup) {
    const next = namesFor(g, name);
    // Never collide with a part that already carries the new name.
    const safe = next.every((n) => !taken.has(n)) && new Set(next).size === next.length ? next : g.map((_, i) => `${name} (${i + 1})`);
    g.forEach((p, i) => rename.set(p.id, safe[i]));
    safe.forEach((n) => taken.add(n));
  }
  return { ...project, panels: panels.map((p) => (rename.has(p.id) ? { ...p, name: rename.get(p.id)! } : p)) };
}

/** Same-named parts left in a build (an I18 finding). */
export function duplicatePartNames(project: YardProject): string[] {
  const seen = new Map<string, number>();
  for (const p of project.panels ?? []) seen.set(p.name, (seen.get(p.name) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([name, n]) => `${name} ×${n}`);
}
