/**
 * Two leaves that meet (a pair of doors, or drawer fronts side by side) leave 1/16" each side of the
 * meeting line — 1/8" total — and together cover the span from one outer edge to the other. Leaf
 * widths land on the 1/8" grid the cut list reads; the meeting line stays centred between the outer edges.
 * Builders size leaves from bays, dividers or a fixed 0.2" trim; this one rule sets every meeting edge.
 */
import type { Panel, YardProject } from "./types";

export const MEETING_GAP = 1 / 8;
const MAX_SEEN_GAP = 3; // leaves further apart than this are separate faces (a knee space between banks)

// A slat, board or batten of a built-up door is part of the leaf, not a leaf.
const isLeaf = (p: Panel) => (p.type === "door" || /\bdoor\b|drawer front/i.test(p.name)) && !/\b(?:slat|board|batten)s?\b/i.test(p.name);
const near = (a: number, b: number, tol = 0.07) => Math.abs(a - b) < tol;
// Sheet cuts read on the 1/8" grid (sheetCutDims); a leaf rounds down so it stays inside its outer edge.
const f8 = (n: number) => Math.floor(n * 8 + 1e-6) / 8;

/** Horizontal gap between two leaves that share a row (same height band and face plane), or null. */
export function meetingGap(a: Panel, b: Panel): number | null {
  if (!near(a.position.y, b.position.y) || !near(a.size.height, b.size.height)) return null;
  if (!near(a.position.z, b.position.z, 0.3)) return null;
  const [l, r] = a.position.x <= b.position.x ? [a, b] : [b, a];
  const gap = r.position.x - (l.position.x + l.size.width);
  return gap > -0.01 && gap < MAX_SEEN_GAP ? gap : null;
}

/** Every meeting pair in the model: [left, right, gap]. */
export function meetingPairs(project: YardProject): [Panel, Panel, number][] {
  const leaves = project.panels.filter(isLeaf).sort((p, q) => p.position.x - q.position.x);
  const out: [Panel, Panel, number][] = [];
  for (let i = 0; i < leaves.length; i++) {
    // The nearest leaf to the right in the same row.
    let best: [Panel, number] | null = null;
    for (let j = 0; j < leaves.length; j++) {
      if (i === j || leaves[j].position.x <= leaves[i].position.x) continue;
      const g = meetingGap(leaves[i], leaves[j]);
      if (g != null && (!best || g < best[1])) best = [leaves[j], g];
    }
    if (best) out.push([leaves[i], best[0], best[1]]);
  }
  return out;
}

export function withPairedLeafReveals(project: YardProject): YardProject {
  if (!project.panels.length) return project;
  const pairs = meetingPairs(project);
  if (!pairs.length) return project;
  const next = new Map<string, Panel>();
  const cur = (p: Panel) => next.get(p.id) ?? p;
  for (const [a0, b0] of pairs) {
    const a = cur(a0), b = cur(b0);
    const gap = b.position.x - (a.position.x + a.size.width);
    if (Math.abs(gap - MEETING_GAP) < 1 / 64 && near(a.size.width, f8(a.size.width), 1e-3) && near(b.size.width, f8(b.size.width), 1e-3)) continue;
    const left = a.position.x, right = b.position.x + b.size.width;
    const mid = (a.position.x + a.size.width + b.position.x) / 2;
    // Each leaf runs from its own outer edge to 1/16" short of the meeting line, on the 1/8" grid.
    const wa = f8(mid - MEETING_GAP / 2 - left);
    const wb = f8(right - (mid + MEETING_GAP / 2));
    next.set(a.id, { ...a, position: { ...a.position, x: mid - MEETING_GAP / 2 - wa }, size: { ...a.size, width: wa } });
    next.set(b.id, { ...b, position: { ...b.position, x: mid + MEETING_GAP / 2 }, size: { ...b.size, width: wb } });
  }
  if (!next.size) return project;
  return { ...project, panels: project.panels.map((p) => next.get(p.id) ?? p) };
}
