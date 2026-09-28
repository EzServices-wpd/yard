/**
 * Interference check: do two solid parts share space?
 *
 * Every panel becomes one or more convex prisms (a flat 2D outline pushed straight
 * out by its thickness, then yawed like PanelMesh). Two prisms overlap only if no
 * separating axis exists (face normals of both + edge cross products). The overlap
 * depth is the smallest push that would part them; touching faces (depth ≤ 1/32")
 * are fine — that is how glued joints meet.
 */
import type { Panel, YardProject } from "./types";

type V = { x: number; y: number; z: number };
type Prism = { verts: V[]; normals: V[]; edges: V[] };

export const INTERFERENCE_TOL = 1 / 32;

const cross = (a: V, b: V): V => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: V) => Math.hypot(a.x, a.y, a.z);

function area2(pts: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = pts[i];
    const [c, d] = pts[(i + 1) % pts.length];
    s += a * d - c * b;
  }
  return s / 2;
}

function isConvex(pts: [number, number][]): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const [cx, cy] = pts[(i + 2) % pts.length];
    const z = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(z) < 1e-9) continue;
    const s = Math.sign(z);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

/** Ear-clip a simple polygon into triangles (for L-shaped and notched odd-shape plates). */
function triangulate(src: [number, number][]): [number, number][][] {
  const pts = src.slice();
  if (area2(pts) < 0) pts.reverse();
  const out: [number, number][][] = [];
  let guard = 0;
  while (pts.length > 3 && guard++ < 500) {
    let clipped = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (z <= 1e-9) continue;
      const inside = pts.some((p) => {
        if (p === a || p === b || p === c) return false;
        const s1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        const s2 = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0]);
        const s3 = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0]);
        return s1 > 1e-9 && s2 > 1e-9 && s3 > 1e-9;
      });
      if (inside) continue;
      out.push([a, b, c]);
      pts.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  out.push(pts);
  return out;
}

/** 2D outline(s) in the panel's own plane, and which plane that is. */
function outlines(p: Panel): { plane: "xz" | "xy"; rings: [number, number][][] } {
  const { width: w, height: h, depth: d } = p.size;
  if (p.polygon) {
    const pts = p.polygon.pts as [number, number][];
    return { plane: p.polygon.plane, rings: isConvex(pts) ? [pts] : triangulate(pts) };
  }
  if (p.outline === "right-triangle") return { plane: "xz", rings: [[[0, 0], [w, 0], [0, d]]] };
  if (p.outline === "quarter-round") {
    const r = Math.min(w, d);
    const ring: [number, number][] = [[0, 0]];
    for (let i = 0; i <= 12; i++) ring.push([r * Math.cos((i / 12) * Math.PI / 2), r * Math.sin((i / 12) * Math.PI / 2)]);
    return { plane: "xz", rings: [ring] };
  }
  void h;
  return { plane: "xz", rings: [[[0, 0], [w, 0], [w, d], [0, d]]] };
}

export function panelPrisms(p: Panel): Prism[] {
  const { x, y, z } = p.position;
  const { width: w, height: h, depth: d } = p.size;
  const yaw = p.yaw ?? 0;
  const cx = x + w / 2;
  const cz = z + d / 2;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const rotV = (v: V): V => (yaw ? { x: v.x * c + v.z * s, y: v.y, z: -v.x * s + v.z * c } : v);
  const rotP = (q: V): V => {
    if (!yaw) return q;
    const dx = q.x - cx;
    const dz = q.z - cz;
    return { x: cx + dx * c + dz * s, y: q.y, z: cz - dx * s + dz * c };
  };
  const { plane, rings } = outlines(p);
  return rings.map((ring) => {
    const verts: V[] = [];
    const normals: V[] = [];
    const edges: V[] = [];
    if (plane === "xz") {
      for (const t of [0, h]) for (const [u, v] of ring) verts.push(rotP({ x: x + u, y: y + t, z: z + v }));
      normals.push({ x: 0, y: 1, z: 0 });
      edges.push({ x: 0, y: 1, z: 0 });
      ring.forEach(([u, v], i) => {
        const [u2, v2] = ring[(i + 1) % ring.length];
        normals.push(rotV({ x: v2 - v, y: 0, z: -(u2 - u) }));
        edges.push(rotV({ x: u2 - u, y: 0, z: v2 - v }));
      });
    } else {
      for (const t of [0, d]) for (const [u, v] of ring) verts.push(rotP({ x: x + u, y: y + v, z: z + t }));
      normals.push(rotV({ x: 0, y: 0, z: 1 }));
      edges.push(rotV({ x: 0, y: 0, z: 1 }));
      ring.forEach(([u, v], i) => {
        const [u2, v2] = ring[(i + 1) % ring.length];
        normals.push(rotV({ x: v2 - v, y: -(u2 - u), z: 0 }));
        edges.push(rotV({ x: u2 - u, y: v2 - v, z: 0 }));
      });
    }
    return { verts, normals, edges };
  });
}

/** Smallest separating push between two convex prisms; ≤ 0 means apart. */
function penetration(a: Prism, b: Prism): number {
  const axes: V[] = [...a.normals, ...b.normals];
  for (const ea of a.edges) for (const eb of b.edges) axes.push(cross(ea, eb));
  let best = Infinity;
  for (const raw of axes) {
    const l = len(raw);
    if (l < 1e-9) continue;
    const n = { x: raw.x / l, y: raw.y / l, z: raw.z / l };
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const v of a.verts) { const t = dot(v, n); a0 = Math.min(a0, t); a1 = Math.max(a1, t); }
    for (const v of b.verts) { const t = dot(v, n); b0 = Math.min(b0, t); b1 = Math.max(b1, t); }
    const o = Math.min(a1, b1) - Math.max(a0, b0);
    if (o <= 0) return o;
    best = Math.min(best, o);
  }
  return best;
}

export type Interference = { a: Panel; b: Panel; depth: number };

/**
 * Joints the model declares on purpose (a dado, rabbet or lap where one part is let into
 * another). Only these may share space; anything else is a drawing error.
 */
export function declaredJoint(a: Panel, b: Panel): boolean {
  return !!(a.joints?.some((j) => j.with === b.id) || b.joints?.some((j) => j.with === a.id));
}

/** Every pair of solid parts that runs into each other deeper than 1/32". */
export function findInterference(project: Pick<YardProject, "panels">, tol = INTERFERENCE_TOL): Interference[] {
  const solids = project.panels.filter((p) => p.size.width > 0 && p.size.height > 0 && p.size.depth > 0);
  const prisms = new Map(solids.map((p) => [p.id, panelPrisms(p)]));
  const boxes = new Map(
    solids.map((p) => {
      const vs = prisms.get(p.id)!.flatMap((q) => q.verts);
      return [p.id, {
        x0: Math.min(...vs.map((v) => v.x)), x1: Math.max(...vs.map((v) => v.x)),
        y0: Math.min(...vs.map((v) => v.y)), y1: Math.max(...vs.map((v) => v.y)),
        z0: Math.min(...vs.map((v) => v.z)), z1: Math.max(...vs.map((v) => v.z)),
      }];
    }),
  );
  const out: Interference[] = [];
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i];
      const b = solids[j];
      const A = boxes.get(a.id)!;
      const B = boxes.get(b.id)!;
      if (Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) <= tol) continue;
      if (Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) <= tol) continue;
      if (Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0) <= tol) continue;
      if (declaredJoint(a, b)) continue;
      let depth = 0;
      for (const pa of prisms.get(a.id)!) for (const pb of prisms.get(b.id)!) depth = Math.max(depth, penetration(pa, pb));
      if (depth > tol) out.push({ a, b, depth });
    }
  }
  return out;
}
