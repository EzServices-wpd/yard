/**
 * Structural realism, read from the model's own geometry: every part sits on a load path down to the
 * floor (or the wall a hung piece screws to), carrying members stand on edge the way real beams do,
 * and a tall post that carries people is stout enough to stand. Names only say which parts are beams.
 */
import { boxGap, projectBoxes, type Box } from "./contact";
import type { Panel, YardProject } from "./types";

export type StructureIssue = { code: "floating" | "hanging-support" | "flat-beam" | "slender-post"; part: string; detail: string };

const TOUCH = 1 / 16;
const BEAM = /\b(?:bearers?|joists?|beams?|side rail|centre rail|center rail|aprons?|stringers?)\b/i;
const SUPPORT = /\b(?:bearers?|joists?|beams?|aprons?|stretchers?|cleats?|ledgers?|supports?|battens?|rails?|slats?)\b/i;

type AB = { min: [number, number, number]; max: [number, number, number] };
function aabb(b: Box): AB {
  const ext = [0, 1, 2].map((k) => {
    const key = (["x", "y", "z"] as const)[k];
    return b.h[0] * Math.abs(b.ax[0][key]) + b.h[1] * Math.abs(b.ax[1][key]) + b.h[2] * Math.abs(b.ax[2][key]);
  });
  return { min: [b.c.x - ext[0], b.c.y - ext[1], b.c.z - ext[2]], max: [b.c.x + ext[0], b.c.y + ext[1], b.c.z + ext[2]] };
}
const ov = (A: AB, B: AB, k: number) => Math.min(A.max[k], B.max[k]) - Math.max(A.min[k], B.min[k]);

/** Oriented panel boxes (yaw about Y), so a rotated table leg is its real box. */
function panelBox(p: Panel): Box {
  const yaw = p.yaw ?? 0;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const hx = p.size.width / 2, hz = p.size.depth / 2;
  // Panels yaw about their centre, matching panelWorldCorners.
  const cx = p.position.x + hx;
  const cz = p.position.z + hz;
  return {
    c: { x: cx, y: p.position.y + p.size.height / 2, z: cz },
    ax: [{ x: c, y: 0, z: -s }, { x: 0, y: 1, z: 0 }, { x: s, y: 0, z: c }],
    h: [hx, p.size.height / 2, hz],
    role: p.name,
  };
}

export function structureIssues(project: YardProject): StructureIssue[] {
  const sticks = projectBoxes({ ...project, panels: [] });
  const boxes = [...sticks, ...project.panels.map(panelBox)];
  const n = boxes.length;
  // A window or door unit is set into the wall opening that carries it.
  if (!n || project.windowPkg || project.pocket) return [];
  const isPanel = (i: number) => i >= sticks.length;
  const panelOf = (i: number) => project.panels[i - sticks.length];
  const ab = boxes.map(aabb);
  const axisAligned = (i: number) => isPanel(i) && !(panelOf(i).yaw ?? 0);
  // Real contact: two square boxes share a face (a sliver of edge is not a joint); anything else within a hair.
  const contact = (i: number, j: number): number => {
    const A = ab[i], B = ab[j];
    if (axisAligned(i) && axisAligned(j)) {
      const o = [0, 1, 2].map((k) => ov(A, B, k));
      if (o.every((v) => v > TOUCH)) return 3; // let into each other (a joint)
      const k = o.findIndex((v) => v <= TOUCH && v >= -TOUCH);
      if (k < 0 || o.some((v) => v < -TOUCH)) return -1;
      return [0, 1, 2].filter((q) => q !== k).every((q) => o[q] >= 0.2) ? k : -1;
    }
    const reach = Math.hypot(...boxes[i].h) + Math.hypot(...boxes[j].h);
    if (Math.hypot(boxes[i].c.x - boxes[j].c.x, boxes[i].c.y - boxes[j].c.y, boxes[i].c.z - boxes[j].c.z) > reach + 1) return -1;
    return boxGap(boxes[i], boxes[j]) <= TOUCH * 2 ? 3 : -1;
  };
  const adj: { j: number; axis: number }[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const k = contact(i, j);
    if (k >= 0) {
      adj[i].push({ j, axis: k });
      adj[j].push({ j: i, axis: k });
    }
  }
  const wall = project.assumptions?.installMode === "wall";
  const minZ = Math.min(...ab.map((b) => b.min[2]));
  // A mirror on the back plane hangs on the wall behind the piece, as real ones do.
  const onWall = (i: number) => (wall || (isPanel(i) && panelOf(i).type === "mirror")) && ab[i].min[2] <= minZ + 0.5;
  const grounded = (i: number) => ab[i].min[1] <= 0.1 || onWall(i);
  const seen = new Set<number>();
  const queue = [...Array(n).keys()].filter(grounded);
  queue.forEach((i) => seen.add(i));
  while (queue.length) {
    const i = queue.shift()!;
    for (const { j } of adj[i]) if (!seen.has(j)) { seen.add(j); queue.push(j); }
  }
  const out: StructureIssue[] = [];
  const floatRoles = new Set<string>();
  for (let i = 0; i < n; i++) if (!seen.has(i)) floatRoles.add(boxes[i].role);
  for (const r of floatRoles) out.push({ code: "floating", part: r, detail: "no load path to the floor or wall" });

  for (let i = sticks.length; i < n; i++) {
    const p = panelOf(i);
    const A = ab[i];
    const size = [A.max[0] - A.min[0], A.max[1] - A.min[1], A.max[2] - A.min[2]];
    const horizontal = size[1] < Math.max(size[0], size[2]);
    // A support that only touches what sits on it hangs from its load instead of carrying it.
    if (horizontal && SUPPORT.test(p.name) && grounded(i) === false && adj[i].length) {
      const onTop = adj[i].every(({ j, axis }) => axis === 1 && ab[j].min[1] >= A.max[1] - TOUCH);
      if (onTop) out.push({ code: "hanging-support", part: p.name, detail: "touches only the parts resting on it" });
    }
    // A beam carrying a load across 24" or more stands on edge.
    const span = Math.max(size[0], size[2]);
    const across = Math.min(size[0], size[2]);
    const carries = adj[i].some(({ j, axis }) => axis === 1 && ab[j].min[1] >= A.max[1] - TOUCH);
    if (horizontal && BEAM.test(p.name) && span >= 24 && carries && size[1] + 1e-6 < across && across <= 4) {
      out.push({ code: "flat-beam", part: p.name, detail: `${size[1]}" tall × ${across}" wide lies flat under a load` });
    }
    // A tall post carrying people: post and the posts laminated to it along their full height act as one.
    if (p.type === "upright" && /\b(?:post|leg|column)/i.test(p.name) && size[1] >= 24 && Math.max(size[0], size[2]) <= 4) {
      const mates = adj[i].filter(({ j }) => isPanel(j) && panelOf(j).type === "upright" && Math.abs(ab[j].min[1] - A.min[1]) < 0.1 && Math.abs(ab[j].max[1] - A.max[1]) < 0.1).map(({ j }) => ab[j]);
      const u = [A, ...mates].reduce((acc, b) => ({ min: [0, 1, 2].map((k) => Math.min(acc.min[k], b.min[k])), max: [0, 1, 2].map((k) => Math.max(acc.max[k], b.max[k])) }) as AB, A);
      const least = Math.min(u.max[0] - u.min[0], u.max[2] - u.min[2]);
      // Parts fixed along its height (shelves, rails, rungs) brace it; the longest free stretch is what buckles.
      const marks = [A.min[1], A.max[1], ...adj[i].filter(({ j }) => !mates.includes(ab[j])).map(({ j }) => (Math.max(A.min[1], ab[j].min[1]) + Math.min(A.max[1], ab[j].max[1])) / 2)].sort((a, b) => a - b);
      const free = Math.max(...marks.slice(1).map((m, k) => m - marks[k]));
      // Wood columns stay within L/d 50 (NDS 3.7.1.4); a frame people climb, sit or sleep on is held to 30.
      if (free / least > (project.assumptions?.use === "person" ? 30 : 50)) out.push({ code: "slender-post", part: p.name, detail: `${free}" unbraced on a ${least}" face` });
    }
  }
  return out;
}
