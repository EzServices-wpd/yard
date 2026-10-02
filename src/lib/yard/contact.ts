/**
 * Real contact: which pieces of a build actually touch, read from each piece's true box
 * (length × width × thickness for a stick, the panel box for a sheet part) — not a join
 * tolerance. A figure or animal is one piece only when every part touches the rest.
 */
import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import type { Vec3, YardProject } from "./types";

/** Two faces glued together sit within this gap (inches). */
export const CONTACT_GAP = 1 / 32;

export type Box = { c: Vec3; ax: [Vec3, Vec3, Vec3]; h: [number, number, number]; role: string };

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

function stickBoxes(project: YardProject): Box[] {
  const item = getCatalogItem(project.primaryMaterialId);
  if (!item) return [];
  const out: Box[] = [];
  for (const inst of project.instances) {
    if (!inst.from || !inst.to) continue;
    const it = getCatalogItem(inst.catalogId) ?? item;
    const prim = toPrimitive(it, inst.cutLength);
    const d = norm(sub(inst.to, inst.from));
    const span = Math.hypot(inst.to.x - inst.from.x, inst.to.y - inst.from.y, inst.to.z - inst.from.z);
    // A disc (wheel, face) is its diameter across and its thickness along from → to; a ball is its diameter.
    const disc = inst.round ?? (it.shape === "ball" ? it.dims.diameter ?? prim.width : undefined);
    const L = disc ? span : Math.max(span, inst.cutLength ?? 0);
    const round = prim.radius != null && !inst.section;
    let f = inst.face ? norm(inst.face) : Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    // Face normal square to the length.
    f = norm(sub(f, { x: d.x * dot(f, d), y: d.y * dot(f, d), z: d.z * dot(f, d) }));
    const w = norm(cross(d, f));
    const half: [number, number, number] = disc
      ? [Math.max(L, it.shape === "ball" ? disc : 0) / 2, disc / 2, disc / 2]
      : inst.section
        ? [L / 2, inst.section.width / 2, inst.section.height / 2]
        : round
          ? [L / 2, prim.width / 2, prim.width / 2]
          : [L / 2, prim.width / 2, prim.height / 2];
    out.push({ c: { x: (inst.from.x + inst.to.x) / 2, y: (inst.from.y + inst.to.y) / 2, z: (inst.from.z + inst.to.z) / 2 }, ax: [d, w, f], h: half, role: inst.role ?? "member" });
  }
  return out;
}

function panelBoxes(project: YardProject): Box[] {
  return project.panels.map((p) => ({
    c: { x: p.position.x + p.size.width / 2, y: p.position.y + p.size.height / 2, z: p.position.z + p.size.depth / 2 },
    ax: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }],
    h: [p.size.width / 2, p.size.height / 2, p.size.depth / 2],
    role: p.name,
  }));
}

/** Largest gap along any separating axis (≤ 0 means the boxes overlap or touch). */
export function boxGap(A: Box, B: Box): number {
  const axes: Vec3[] = [...A.ax, ...B.ax];
  for (const a of A.ax) for (const b of B.ax) {
    const c = cross(a, b);
    if (Math.hypot(c.x, c.y, c.z) > 1e-6) axes.push(norm(c));
  }
  const t = sub(B.c, A.c);
  let gap = -Infinity;
  for (const ax of axes) {
    const ra = A.h[0] * Math.abs(dot(A.ax[0], ax)) + A.h[1] * Math.abs(dot(A.ax[1], ax)) + A.h[2] * Math.abs(dot(A.ax[2], ax));
    const rb = B.h[0] * Math.abs(dot(B.ax[0], ax)) + B.h[1] * Math.abs(dot(B.ax[1], ax)) + B.h[2] * Math.abs(dot(B.ax[2], ax));
    gap = Math.max(gap, Math.abs(dot(t, ax)) - ra - rb);
  }
  return gap;
}

export type ContactReport = {
  pieces: number;
  components: number;
  parts: { role: string; touches: boolean; gap: number }[];
  /** Named parts joined by real contact: one group means every part touches the rest. */
  partGroups: string[][];
  /** Each touching cluster: its piece count and the parts in it (largest first). */
  clusters: { size: number; roles: string[]; gap: number }[];
};

/**
 * Every piece's real box against every other: components of the touch graph, and for each named
 * part (role) whether it touches the rest of the build, with its smallest gap to the rest.
 */
/** Every piece's true box (sticks, discs, balls, panels), in instance order then panel order. */
export function projectBoxes(project: YardProject): Box[] {
  return [...stickBoxes(project), ...panelBoxes(project)];
}

export function contactReport(project: YardProject, gapTol = CONTACT_GAP): ContactReport {
  const boxes = projectBoxes(project);
  const n = boxes.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const roles = [...new Set(boxes.map((b) => b.role))];
  const roleGap = new Map<string, number>(roles.map((r) => [r, Infinity]));
  const rParent = new Map<string, string>(roles.map((r) => [r, r]));
  const rFind = (r: string): string => (rParent.get(r) === r ? r : rFind(rParent.get(r)!));
  const reach = boxes.map((b) => Math.hypot(...b.h));
  const pairGaps: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const A = boxes[i], B = boxes[j];
      const dc = Math.hypot(A.c.x - B.c.x, A.c.y - B.c.y, A.c.z - B.c.z);
      if (dc - reach[i] - reach[j] > 1) continue;
      const g = boxGap(A, B);
      if (g <= gapTol) parent[find(i)] = find(j);
      else if (g < 2) pairGaps.push([i, j, g]);
      if (A.role !== B.role && g <= gapTol) rParent.set(rFind(A.role), rFind(B.role));
      if (A.role !== B.role) {
        roleGap.set(A.role, Math.min(roleGap.get(A.role)!, g));
        roleGap.set(B.role, Math.min(roleGap.get(B.role)!, g));
      }
    }
  }
  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r)!.push(i);
  }
  const cGap = new Map<number, number>();
  for (const [i, j, g] of pairGaps) {
    const a = find(i), b = find(j);
    if (a === b) continue;
    cGap.set(a, Math.min(cGap.get(a) ?? Infinity, g));
    cGap.set(b, Math.min(cGap.get(b) ?? Infinity, g));
  }
  const clusters = [...byRoot.entries()]
    .map(([root, ix]) => ({ size: ix.length, roles: [...new Set(ix.map((i) => boxes[i].role))], gap: byRoot.size === 1 ? 0 : cGap.get(root) ?? Infinity }))
    .sort((a, b) => b.size - a.size);
  const pg = new Map<string, string[]>();
  for (const r of roles) {
    const k = rFind(r);
    if (!pg.has(k)) pg.set(k, []);
    pg.get(k)!.push(r);
  }
  return {
    pieces: n,
    components: byRoot.size,
    partGroups: [...pg.values()].sort((a, b) => b.length - a.length),
    clusters,
    parts: roles.map((r) => ({ role: r, touches: roles.length === 1 || roleGap.get(r)! <= gapTol, gap: roleGap.get(r)! })),
  };
}
