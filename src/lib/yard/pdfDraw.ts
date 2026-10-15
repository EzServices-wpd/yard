/**
 * Vector line-art renderer for the plan PDF. Every picture is drawn from the same
 * panels and instances the cut list is built from — no photos, no generated images.
 * Isometric view matches iso.ts (viewer on the +x, +y, +z side).
 */
import type { jsPDF } from "jspdf";
import { getCatalogItem } from "./catalog";
import { panelWorldCorners, toPrimitive } from "./geometry";
import { homeOf } from "./ghost";
import { outlineRingXZ, polygonRings } from "./iso";
import { cutListName } from "./shopPlural";
import type { CutLine, Panel, YardProject } from "./types";
import { KIT, clean, frac, type RGB } from "./pdfKit";

type V3 = { x: number; y: number; z: number };
type Face = { pts: V3[]; n: V3 };
export type Tone = "hot" | "built" | "ghost";

type Solid = {
  id: string;
  faces: Face[];
  min: V3;
  max: V3;
  center: V3;
  stick?: { a: V3; b: V3; w: number };
  /** Face plates: the whole part they came from (its shape decides the order against other parts). */
  of?: Solid;
};

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;
const VIEW: V3 = norm({ x: 1, y: 1, z: 1 });
const LIGHT: V3 = norm({ x: 0.35, y: 1, z: 0.6 });

function iso(p: V3) {
  return { x: (p.x - p.z) * COS30, y: -p.y + (p.x + p.z) * SIN30 };
}
function sub(a: V3, b: V3): V3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function add(a: V3, b: V3): V3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function scale3(a: V3, s: number): V3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}
function dot(a: V3, b: V3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a: V3, b: V3): V3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function norm(a: V3): V3 {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}
function centroid(pts: V3[]): V3 {
  const s = pts.reduce((acc, p) => add(acc, p), { x: 0, y: 0, z: 0 });
  return scale3(s, 1 / Math.max(1, pts.length));
}
function newell(pts: V3[]): V3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    x += (a.y - b.y) * (a.z + b.z);
    y += (a.z - b.z) * (a.x + b.x);
    z += (a.x - b.x) * (a.y + b.y);
  }
  return norm({ x, y, z });
}

/** Round tops and round shelves are drawn as discs (the cut list says "cut round"). */
export function isRoundPlate(project: YardProject, p: Panel): boolean {
  if (p.outline || p.polygon) return false;
  const flat = p.size.height <= Math.min(p.size.width, p.size.depth) * 0.25;
  if (!flat || Math.abs(p.size.width - p.size.depth) > 0.01) return false;
  if (/round|circle|\bdia\b|diameter/i.test(p.name)) return true;
  return project.fitted?.unit?.shape === "round" && /top|shelf/i.test(p.type);
}

function prism(ring0: V3[], ring1: V3[]): Face[] {
  const u = sub(ring1[0], ring0[0]);
  const nr = newell(ring0);
  const sign = dot(nr, u) >= 0 ? 1 : -1;
  const faces: Face[] = [];
  const capDir = norm(u);
  faces.push({ pts: ring0, n: scale3(capDir, -1) });
  faces.push({ pts: ring1, n: capDir });
  for (let i = 0; i < ring0.length; i++) {
    const j = (i + 1) % ring0.length;
    const e = sub(ring0[j], ring0[i]);
    if (Math.hypot(e.x, e.y, e.z) < 1e-6) continue;
    const n = norm(scale3(cross(e, u), sign));
    faces.push({ pts: [ring0[i], ring0[j], ring1[j], ring1[i]], n });
  }
  return faces;
}

function boxFaces(c: V3[]): Face[] {
  const idx = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];
  const ctr = centroid(c);
  return idx.map((q) => {
    const pts = q.map((i) => c[i]);
    let n = newell(pts);
    if (dot(n, sub(centroid(pts), ctr)) < 0) n = scale3(n, -1);
    return { pts, n };
  });
}

function bounds(pts: V3[]) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of pts) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
    max.z = Math.max(max.z, p.z);
  }
  return { min, max };
}

/** A facet with its normal pointing away from `inside`. */
function facet(pts: V3[], inside: V3): Face {
  let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  if (dot(n, sub(centroid(pts), inside)) < 0) n = { x: -n.x, y: -n.y, z: -n.z };
  return { pts, n };
}

/** Cone (open, apex up) or dome (half sphere on its base) filling the part's box, as the 3D view draws them. */
function curvedFaces(p: Panel): Face[] {
  const { x, y, z } = p.position, { width: w, height: h, depth: d } = p.size;
  const c = { x: x + w / 2, y, z: z + d / 2 }, n = 24;
  const at = (t: number, k: number) => ({ x: c.x + (w / 2) * k * Math.cos(t), y: 0, z: c.z + (d / 2) * k * Math.sin(t) });
  const faces: Face[] = [];
  if (p.form === "cone") {
    const apex = { x: c.x, y: y + h, z: c.z }, mid = { x: c.x, y: y + h / 3, z: c.z };
    for (let i = 0; i < n; i++) {
      const a = at((i / n) * 2 * Math.PI, 1), b = at(((i + 1) / n) * 2 * Math.PI, 1);
      faces.push(facet([{ ...a, y }, { ...b, y }, apex], mid));
    }
    return faces;
  }
  const rings = 6, inside = { x: c.x, y, z: c.z };
  for (let j = 0; j < rings; j++) {
    const p0 = (j / rings) * (Math.PI / 2), p1 = ((j + 1) / rings) * (Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * 2 * Math.PI, t1 = ((i + 1) / n) * 2 * Math.PI;
      const q = (t: number, ph: number) => ({ ...at(t, Math.cos(ph)), y: y + h * Math.sin(ph) });
      const pts = j === rings - 1 ? [q(t0, p0), q(t1, p0), q(t0, p1)] : [q(t0, p0), q(t1, p0), q(t1, p1), q(t0, p1)];
      faces.push(facet(pts, inside));
    }
  }
  return faces;
}

function panelSolid(project: YardProject, p: Panel): Solid {
  let faces: Face[];
  if (p.strut) {
    // A round rod from a to b (offsets from the part's corner): drawn as the rod, not its box.
    const o = p.position, { a, b, r } = p.strut;
    const A = { x: o.x + a[0], y: o.y + a[1], z: o.z + a[2] }, B = { x: o.x + b[0], y: o.y + b[1], z: o.z + b[2] };
    return { id: p.id, faces: [], ...bounds([A, B]), center: centroid([A, B]), stick: { a: A, b: B, w: 2 * r } };
  }
  if (p.form === "cone" || p.form === "dome") {
    faces = curvedFaces(p);
  } else if (p.polygon) {
    const [r0, r1] = polygonRings(p);
    faces = prism(r0, r1);
  } else if (p.outline) {
    const ring = outlineRingXZ(p);
    const yb = p.position.y;
    const yt = yb + p.size.height;
    faces = prism(
      ring.map((q) => ({ x: q.x, y: yb, z: q.z })),
      ring.map((q) => ({ x: q.x, y: yt, z: q.z })),
    );
  } else if (isRoundPlate(project, p)) {
    const r = p.size.width / 2;
    const cx = p.position.x + r;
    const cz = p.position.z + p.size.depth / 2;
    const n = 40;
    const ring: { x: number; z: number }[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      ring.push({ x: cx + r * Math.cos(t), z: cz + r * Math.sin(t) });
    }
    const yb = p.position.y;
    const yt = yb + p.size.height;
    faces = prism(
      ring.map((q) => ({ x: q.x, y: yb, z: q.z })),
      ring.map((q) => ({ x: q.x, y: yt, z: q.z })),
    );
  } else {
    faces = boxFaces(panelWorldCorners(p));
  }
  const all = faces.flatMap((f) => f.pts);
  const b = bounds(all);
  return { id: p.id, faces, ...b, center: centroid(all) };
}

function instanceSolid(inst: YardProject["instances"][number]): Solid {
  const item = getCatalogItem(inst.catalogId);
  const prim = item ? toPrimitive(item, inst.cutLength) : null;
  const p = homeOf(inst);
  const half = (prim?.length ?? 4) / 2;
  const a = inst.from ?? { x: p.x - Math.sin(inst.rotation.y) * half, y: p.y, z: p.z - Math.cos(inst.rotation.y) * half };
  const b = inst.to ?? { x: p.x + Math.sin(inst.rotation.y) * half, y: p.y, z: p.z + Math.cos(inst.rotation.y) * half };
  const w = Math.max(0.1, prim?.width ?? 0.375);
  const bb = bounds([a, b]);
  return { id: inst.id, faces: [], ...bb, center: centroid([a, b]), stick: { a, b, w } };
}

export function projectSolids(project: YardProject): Solid[] {
  return [...project.panels.map((p) => panelSolid(project, p)), ...project.instances.map((i) => instanceSolid(i))];
}

/** Width ÷ height of the finished piece on the page (iso view). */
export function projectAspect(project: YardProject): number {
  const pts = projectSolids(project).flatMap((s) => (s.stick ? [s.stick.a, s.stick.b] : s.faces.flatMap((f) => f.pts))).map(iso);
  if (!pts.length) return 1;
  const w = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));
  const h = Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y));
  return w / Math.max(h, 1e-3);
}

function shift(s: Solid, d: V3): Solid {
  if (!d.x && !d.y && !d.z) return s;
  return {
    id: s.id,
    faces: s.faces.map((f) => ({ n: f.n, pts: f.pts.map((p) => add(p, d)) })),
    min: add(s.min, d),
    max: add(s.max, d),
    center: add(s.center, d),
    stick: s.stick ? { a: add(s.stick.a, d), b: add(s.stick.b, d), w: s.stick.w } : undefined,
  };
}

function screenBox(s: Solid) {
  const pts = s.stick ? [s.stick.a, s.stick.b] : s.faces.flatMap((f) => f.pts);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    const q = iso(p);
    x0 = Math.min(x0, q.x);
    y0 = Math.min(y0, q.y);
    x1 = Math.max(x1, q.x);
    y1 = Math.max(y1, q.y);
  }
  return { x0, y0, x1, y1 };
}

/** True when a paints before b for two solids that share volume (seam = least-overlap axis). */
function interpenetrationFirst(a: Solid, b: Solid): boolean {
  let best: "x" | "y" | "z" = "x";
  let least = Infinity;
  for (const k of ["x", "y", "z"] as const) {
    const ov = Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]);
    if (ov < least) {
      least = ov;
      best = k;
    }
  }
  const ca = (a.min[best] + a.max[best]) / 2;
  const cb = (b.min[best] + b.max[best]) / 2;
  if (Math.abs(ca - cb) > 1e-6) return ca < cb;
  return dot(a.center, VIEW) <= dot(b.center, VIEW);
}

/**
 * Separating-axis test on the real convex part shapes (face normals of both), not their boxes.
 * 1: a paints first (b sits on the viewer's side of a separating plane), -1: b first, 0: no plane or edge-on.
 * ponytail: face normals only; edge×edge axes or a per-face z-buffer if a pair still sorts wrong.
 */
/** A part's points: its faces, or a rod's two ends. */
const ptsOf = (s: Solid): V3[] => (s.stick ? [s.stick.a, s.stick.b] : s.faces.flatMap((f) => f.pts));

export function satOrder(a: Solid, b: Solid): number {
  const pa = ptsOf(a), pb = ptsOf(b);
  let best = 0, gap = -1e-3;
  for (const n of [...a.faces, ...b.faces].map((f) => f.n)) {
    const v = dot(n, VIEW);
    if (Math.abs(v) < 1e-4) continue;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const p of pa) { const d = dot(p, n); a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const p of pb) { const d = dot(p, n); b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    const g = Math.max(b0 - a1, a0 - b1);
    if (g <= gap) continue;
    gap = g;
    // b beyond a along n, and n points toward the viewer: a is behind.
    best = (b0 - a1 >= a0 - b1) === v > 0 ? 1 : -1;
  }
  return best;
}

/** True when the two parts' drawings cannot overlap: some projected face edge separates them on screen. */
function apartOnScreen(a: Solid, b: Solid): boolean {
  const pa = ptsOf(a).map(iso), pb = ptsOf(b).map(iso);
  for (const f of [...a.faces, ...b.faces]) {
    const q = f.pts.map(iso);
    for (let k = 0; k < q.length; k++) {
      const e = q[(k + 1) % q.length];
      const nx = q[k].y - e.y, ny = e.x - q[k].x;
      if (Math.hypot(nx, ny) < 1e-9) continue;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const p of pa) { const d = p.x * nx + p.y * ny; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const p of pb) { const d = p.x * nx + p.y * ny; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      if (a1 <= b0 + 1e-6 || b1 <= a0 + 1e-6) return true;
    }
  }
  return false;
}

/** Each front-facing face as its own plate, so the painter orders faces, not whole parts (slanted legs no longer cycle). */
export function faceSolids(solids: Solid[]): Solid[] {
  return solids.flatMap((sol) =>
    sol.stick ? [sol] : sol.faces.filter((f) => dot(f.n, VIEW) > 1e-4).map((f) => {
      const xs = f.pts.map((p) => p.x), ys = f.pts.map((p) => p.y), zs = f.pts.map((p) => p.z);
      return { id: sol.id, of: sol, faces: [f], min: { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) }, max: { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) }, center: centroid(f.pts) };
    }),
  );
}


type P2 = { x: number; y: number };
const area2 = (q: P2[]) => q.reduce((a, p, k) => { const e = q[(k + 1) % q.length]; return a + p.x * e.y - e.x * p.y; }, 0);
/** Clip convex polygon `subj` by convex polygon `clip` (Sutherland–Hodgman). */
function clipConvex(subj: P2[], clip: P2[]): P2[] {
  const c = area2(clip) < 0 ? [...clip].reverse() : clip;
  let out = subj;
  for (let k = 0; k < c.length && out.length; k++) {
    const a = c[k], b = c[(k + 1) % c.length];
    const side = (p: P2) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const inp = out;
    out = [];
    for (let m = 0; m < inp.length; m++) {
      const p = inp[m], q = inp[(m + 1) % inp.length];
      const sp = side(p), sq = side(q);
      if (sp >= 0) out.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
    }
  }
  return out;
}
/** Depth (toward the viewer) of a face's plane under screen point s. */
function planeDepth(f: Face, s: P2): number {
  const a = s.x / COS30, b = s.y / SIN30;
  // iso(B) = s with B.y = 0.
  const B: V3 = { x: (a + b) / 2, y: 0, z: (b - a) / 2 };
  const nv = dot(f.n, VIEW);
  const t = (dot(f.n, f.pts[0]) - dot(f.n, B)) / nv;
  return dot(B, VIEW) + t;
}
/**
 * Exact order of two flat face plates: where their drawings overlap, the nearer plane paints last.
 * 1 = a is behind, -1 = b is behind, 0 = their drawings do not overlap (no constraint).
 */
export function faceOrder(a: Solid, b: Solid): number {
  const fa = a.faces[0], fb = b.faces[0];
  const qa = fa.pts.map(iso), qb = fb.pts.map(iso);
  const sa = area2(qa) < 0 ? [...qa].reverse() : qa;
  const hit = clipConvex(sa, qb);
  if (hit.length < 3 || Math.abs(area2(hit)) < 1e-6) return 0;
  const c = { x: hit.reduce((t, p) => t + p.x, 0) / hit.length, y: hit.reduce((t, p) => t + p.y, 0) / hit.length };
  const da = planeDepth(fa, c), db = planeDepth(fb, c);
  if (Math.abs(da - db) < 1e-6) return 0;
  return da < db ? 1 : -1;
}

/** Painter order: far first. A is behind B when separated along an axis toward the viewer. */
export function paintOrder(solids: Solid[]): Solid[] {
  const n = solids.length;
  if (n > 1500) return [...solids].sort((a, b) => dot(a.center, VIEW) - dot(b.center, VIEW));
  const boxes = solids.map(screenBox);
  const eps = 1e-3;
  const behind = (a: Solid, b: Solid) =>
    a.max.x <= b.min.x + eps || a.max.y <= b.min.y + eps || a.max.z <= b.min.z + eps;
  const indeg = new Array(n).fill(0);
  // Edges proved by a separating axis on the real shapes are hard; box and centre guesses are soft.
  const hardIn = new Array(n).fill(0);
  // Box separation along an axis is firmer than an interpenetration or centre-depth guess.
  const boxIn = new Array(n).fill(0);
  const firm: boolean[][] = solids.map(() => []);
  const out: number[][] = solids.map(() => []);
  const hard: boolean[][] = solids.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const A = boxes[i];
      const B = boxes[j];
      if (A.x1 <= B.x0 || B.x1 <= A.x0 || A.y1 <= B.y0 || B.y1 <= A.y0) continue;
      if (apartOnScreen(solids[i], solids[j])) continue;
      const pi = solids[i].of ?? solids[i], pj = solids[j].of ?? solids[j];
      if (solids[i].of && solids[j].of && !solids[i].stick && !solids[j].stick && solids[i].faces.length === 1 && solids[j].faces.length === 1) {
        // Two flat face plates: the exact depth where they overlap decides; no overlap, no constraint.
        const fo = pi === pj ? 0 : faceOrder(solids[i], solids[j]);
        if (fo) {
          const [f, g] = fo > 0 ? [i, j] : [j, i];
          out[f].push(g); hard[f].push(true); firm[f].push(false); indeg[g]++; hardIn[g]++;
        }
        continue;
      }
      const sat = pi !== pj ? satOrder(solids[i], solids[j]) || satOrder(pi, pj) : satOrder(solids[i], solids[j]);
      if (sat) {
        const [f, g] = sat > 0 ? [i, j] : [j, i];
        out[f].push(g);
        hard[f].push(true);
        firm[f].push(false);
        indeg[g]++;
        hardIn[g]++;
        continue;
      }
      const ij = behind(solids[i], solids[j]);
      const ji = behind(solids[j], solids[i]);
      let first: number | null = null;
      if (ij && !ji) first = i;
      else if (ji && !ij) first = j;
      else if (!ij && !ji) {
        // Parts that share volume (a counter over an upright, a door lapping an edge): the axis
        // with the least overlap is the real seam, so the part whose middle sits nearer the
        // viewer along that axis paints last. Depth-sorting whole slabs here hid counters.
        first = interpenetrationFirst(solids[i], solids[j]) ? i : j;
      } else {
        const di = dot(solids[i].center, VIEW);
        const dj = dot(solids[j].center, VIEW);
        first = di <= dj ? i : j;
      }
      const second = first === i ? j : i;
      out[first].push(second);
      hard[first].push(false);
      const boxed = ij !== ji;
      firm[first].push(boxed);
      if (boxed) boxIn[second]++;
      indeg[second]++;
    }
  }
  const depth = solids.map((s) => dot(s.center, VIEW));
  const nearest = solids.map((s) => Math.max(...ptsOf(s).map((p) => dot(p, VIEW))));
  const done = new Array(n).fill(false);
  const order: Solid[] = [];
  for (let k = 0; k < n; k++) {
    let pick = -1;
    for (let i = 0; i < n; i++) {
      if (done[i] || indeg[i] > 0) continue;
      if (pick < 0 || depth[i] < depth[pick]) pick = i;
    }
    if (pick < 0) {
      // Cycle (parts that pass through each other): paint first the plate whose nearest corner is farthest away;
      // a guessed (soft) edge still breaks before a proved one.
      const worse = (i: number, p: number) => hardIn[i] !== hardIn[p] && (hardIn[i] === 0 || hardIn[p] === 0) ? hardIn[i] < hardIn[p] : nearest[i] < nearest[p];
      for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || worse(i, pick))) pick = i;
    }
    done[pick] = true;
    order.push(solids[pick]);
    out[pick].forEach((j, k) => { indeg[j]--; if (hard[pick][k]) hardIn[j]--; if (firm[pick][k]) boxIn[j]--; });
  }
  return order;
}

export type Frame = { x: number; y: number; w: number; h: number };

export type RenderOpts = {
  /** Tone per solid id; ids not listed are hidden. */
  tones: Map<string, Tone>;
  /** Solids used to fit the camera (defaults to every toned solid). */
  fitIds?: string[];
  /** Push parts away from the center for an exploded view. */
  explode?: number;
  /** Letter bubble per solid id. */
  letters?: Map<string, string>;
  /** Only these letters get bubbles (defaults to hot parts). */
  bubbleIds?: Set<string>;
  dims?: boolean;
  /** Axes the stranger never typed — their dimension labels say "assumed". */
  assumedAxes?: Partial<Record<"width" | "height" | "depth", boolean>>;
  pad?: number;
  /** Placement arrows (reference → part), labelled in fractions — from the same geometry as the step words. */
  measures?: { a: V3; b: V3; label: string; ea?: V3; eb?: V3 }[];
};

function shade(base: RGB, n: V3): RGB {
  const k = 0.7 + 0.3 * Math.max(0, dot(n, LIGHT));
  return [Math.round(base[0] * k + 255 * (1 - k) * 0.12), Math.round(base[1] * k + 255 * (1 - k) * 0.12), Math.round(base[2] * k + 255 * (1 - k) * 0.12)];
}

function toneColors(t: Tone): { fill: RGB; edge: RGB; lw: number } {
  if (t === "hot") return { fill: [246, 170, 104], edge: [150, 64, 12], lw: 0.7 };
  if (t === "ghost") return { fill: KIT.ghost, edge: KIT.ghostEdge, lw: 0.4 };
  return { fill: KIT.wood, edge: KIT.woodEdge, lw: 0.55 };
}

function poly(doc: jsPDF, pts: { x: number; y: number }[], style: "F" | "S" | "FD") {
  if (pts.length < 2) return;
  doc.lines(
    pts.slice(1).map((p, i) => [p.x - pts[i].x, p.y - pts[i].y]),
    pts[0].x,
    pts[0].y,
    [1, 1],
    style,
    true,
  );
}

/** Draw the project (or part of it) into a frame. Returns the screen anchor of each drawn solid. */
export function renderProject(doc: jsPDF, project: YardProject, frame: Frame, opts: RenderOpts) {
  const base = projectSolids(project);
  const ctr = (() => {
    const b = bounds(base.flatMap((s) => [s.min, s.max]));
    return scale3(add(b.min, b.max), 0.5);
  })();
  const ex = opts.explode ?? 0;
  const solids = base
    .filter((s) => opts.tones.has(s.id))
    .map((s) => {
      if (!ex) return s;
      const d = sub(s.center, ctr);
      const size = Math.max(s.max.x - s.min.x, s.max.y - s.min.y, s.max.z - s.min.z);
      void size;
      return shift(s, { x: d.x * ex, y: d.y * ex * 0.9, z: d.z * ex });
    });
  const fitSet = new Set(opts.fitIds ?? [...opts.tones.keys()]);
  const fitSolids = (ex ? solids : base).filter((s) => fitSet.has(s.id));
  const fitPts = (fitSolids.length ? fitSolids : solids).flatMap((s) =>
    s.stick ? [s.stick.a, s.stick.b] : s.faces.flatMap((f) => f.pts),
  );
  const dimsOn = !!opts.dims && !project.instances.length;
  const bb = bounds(fitPts.length ? fitPts : [{ x: 0, y: 0, z: 0 }]);
  const span = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z, 1);
  const off = span * 0.1;
  const extra: V3[] = dimsOn
    ? [
        { x: bb.max.x + off * 1.6, y: bb.min.y, z: bb.min.z },
        { x: bb.min.x, y: bb.min.y, z: bb.max.z + off * 1.6 },
        { x: bb.max.x + off * 1.6, y: bb.max.y, z: bb.min.z },
      ]
    : [];
  const measurePts = (opts.measures ?? []).flatMap((m) => [m.a, m.b]);
  const proj = [...fitPts, ...extra, ...measurePts].map(iso);
  const minX = Math.min(...proj.map((p) => p.x));
  const maxX = Math.max(...proj.map((p) => p.x));
  const minY = Math.min(...proj.map((p) => p.y));
  const maxY = Math.max(...proj.map((p) => p.y));
  const pad = opts.pad ?? 18;
  const s = Math.min((frame.w - pad * 2) / Math.max(maxX - minX, 1e-3), (frame.h - pad * 2) / Math.max(maxY - minY, 1e-3));
  const ox = frame.x + (frame.w - (maxX - minX) * s) / 2;
  const oy = frame.y + (frame.h - (maxY - minY) * s) / 2;
  const map = (p: V3) => {
    const q = iso(p);
    return { x: ox + (q.x - minX) * s, y: oy + (q.y - minY) * s };
  };

  doc.setLineJoin("round");
  doc.setLineCap("round");
  const anchors = new Map<string, { x: number; y: number }>();
  const ink = new Map<string, { x: number; y: number }[]>();
  for (const sol of paintOrder(faceSolids(solids))) {
    const tone = opts.tones.get(sol.id) ?? "built";
    const c = toneColors(tone);
    if (sol.stick) {
      const a = map(sol.stick.a);
      const b = map(sol.stick.b);
      const w = Math.max(tone === "ghost" ? 0.6 : 1.1, Math.min(7, sol.stick.w * s));
      doc.setDrawColor(...c.edge);
      doc.setLineWidth(w + (tone === "ghost" ? 0.3 : 0.9));
      doc.line(a.x, a.y, b.x, b.y);
      doc.setDrawColor(...c.fill);
      doc.setLineWidth(w);
      doc.line(a.x, a.y, b.x, b.y);
      anchors.set(sol.id, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      continue;
    }
    const vis = sol.faces
      .filter((f) => dot(f.n, VIEW) > 1e-4)
      .sort((f, g) => dot(centroid(f.pts), VIEW) - dot(centroid(g.pts), VIEW));
    doc.setLineWidth(c.lw);
    doc.setDrawColor(...c.edge);
    const screenPts: { x: number; y: number }[] = [];
    for (const f of vis) {
      const pts = f.pts.map(map);
      screenPts.push(...pts);
      doc.setFillColor(...(tone === "ghost" ? c.fill : shade(c.fill, f.n)));
      poly(doc, pts, "FD");
    }
    ink.set(sol.id, [...(ink.get(sol.id) ?? []), ...screenPts]);
  }
  for (const [id, pts] of ink) {
    if (pts.length) anchors.set(id, { x: pts.reduce((a, p) => a + p.x, 0) / pts.length, y: pts.reduce((a, p) => a + p.y, 0) / pts.length });
  }

  if (dimsOn) drawDims(doc, project, bb, off, map, s, opts.assumedAxes);
  if (opts.measures?.length) drawMeasures(doc, opts.measures, map);

  if (opts.letters) {
    const want = opts.bubbleIds ?? new Set([...opts.tones.entries()].filter(([, t]) => t === "hot").map(([id]) => id));
    const byLetter = new Map<string, { x: number; y: number }>();
    for (const [id, pt] of anchors) {
      if (!want.has(id)) continue;
      const L = opts.letters.get(id);
      if (!L || byLetter.has(L)) continue;
      byLetter.set(L, pt);
    }
    drawBubbles(doc, frame, byLetter);
  }
  return { anchors, scale: s };
}

/** Small dimension arrows: reference plane → part face, with a fraction label on a white chip. */
function drawMeasures(doc: jsPDF, ms: { a: V3; b: V3; label: string; ea?: V3; eb?: V3 }[], map: (p: V3) => { x: number; y: number }) {
  const blue: RGB = [36, 99, 170];
  const placedLabels: { x: number; y: number; w: number; h: number }[] = [];
  for (const m of ms) {
    const a = map(m.a);
    const b = map(m.b);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 4) continue;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    doc.setDrawColor(...blue);
    // Extension lines from the arrow ends back to the reference surface and the part.
    doc.setLineWidth(0.35);
    if (m.ea) {
      const e = map(m.ea);
      doc.line(a.x, a.y, e.x, e.y);
    }
    if (m.eb) {
      const e = map(m.eb);
      doc.line(b.x, b.y, e.x, e.y);
    }
    doc.setLineWidth(0.7);
    doc.line(a.x, a.y, b.x, b.y);
    // Ticks at both ends, square to the arrow.
    const px = -uy * 3.5;
    const py = ux * 3.5;
    doc.line(a.x - px, a.y - py, a.x + px, a.y + py);
    doc.line(b.x - px, b.y - py, b.x + px, b.y + py);
    // Arrow heads.
    const head = (x: number, y: number, dx: number, dy: number) => {
      doc.setFillColor(...blue);
      doc.triangle(x, y, x - dx * 5 - dy * 2.2, y - dy * 5 + dx * 2.2, x - dx * 5 + dy * 2.2, y - dy * 5 - dx * 2.2, "F");
    };
    head(b.x, b.y, ux, uy);
    head(a.x, a.y, -ux, -uy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const label = clean(m.label);
    const w = doc.getTextWidth(label) + 6;
    const h = 10;
    const lx = (a.x + b.x) / 2 + 4;
    let ly = (a.y + b.y) / 2 - h / 2;
    for (let k = 0; k < 6 && placedLabels.some((r) => lx < r.x + r.w && lx + w > r.x && ly < r.y + r.h && ly + h > r.y); k++) ly += h + 1;
    placedLabels.push({ x: lx, y: ly, w, h });
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.4);
    doc.roundedRect(lx, ly, w, h, 2, 2, "FD");
    doc.setTextColor(...blue);
    doc.text(label, lx + 3, ly + 7.3);
  }
  doc.setTextColor(...KIT.ink);
}

function drawDims(
  doc: jsPDF,
  project: YardProject,
  bb: { min: V3; max: V3 },
  off: number,
  map: (p: V3) => { x: number; y: number },
  s: number,
  assumed: Partial<Record<"width" | "height" | "depth", boolean>> = {},
) {
  const round = project.fitted?.unit?.shape === "round";
  const W = bb.max.x - bb.min.x;
  const H = bb.max.y - bb.min.y;
  const D = bb.max.z - bb.min.z;
  // Only the overall size can be assumed; a label that measures something else stays plain.
  const tag = (axis: "width" | "height" | "depth", v: number, text: string) =>
    assumed[axis] && Math.abs(v - project.overall[axis]) < 0.5 ? `${text} assumed` : text;
  const line = (a: V3, b: V3, label: string, side: V3) => {
    const A = map(a);
    const B = map(b);
    doc.setDrawColor(...KIT.muted);
    doc.setLineWidth(0.5);
    doc.line(A.x, A.y, B.x, B.y);
    // End ticks along the offset direction.
    const t = map(add(a, scale3(side, off * 0.25)));
    const dx = t.x - A.x;
    const dy = t.y - A.y;
    doc.line(A.x - dx, A.y - dy, A.x + dx, A.y + dy);
    doc.line(B.x - dx, B.y - dy, B.x + dx, B.y + dy);
    const mx = (A.x + B.x) / 2 + dx * 2.2;
    const my = (A.y + B.y) / 2 + dy * 2.2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const tw = doc.getTextWidth(label);
    doc.setFillColor(255, 255, 255);
    doc.rect(mx - tw / 2 - 2, my - 6.5, tw + 4, 9, "F");
    doc.setTextColor(...KIT.ink);
    doc.text(label, mx, my, { align: "center" });
  };
  void s;
  const zf = bb.max.z + off;
  const xr = bb.max.x + off;
  if (round) {
    // Diameter across the top face, through the center.
    const zc = (bb.min.z + bb.max.z) / 2;
    line({ x: bb.min.x, y: bb.max.y + 0.05, z: zc }, { x: bb.max.x, y: bb.max.y + 0.05, z: zc }, tag("width", W, `${frac(W)} dia`), { x: 0, y: 0, z: 1 });
  } else {
    line({ x: bb.min.x, y: bb.min.y, z: zf }, { x: bb.max.x, y: bb.min.y, z: zf }, tag("width", W, frac(W)), { x: 0, y: 0, z: 1 });
    line({ x: xr, y: bb.min.y, z: bb.min.z }, { x: xr, y: bb.min.y, z: bb.max.z }, tag("depth", D, frac(D)), { x: 1, y: 0, z: 0 });
  }
  line({ x: xr, y: bb.min.y, z: bb.min.z }, { x: xr, y: bb.max.y, z: bb.min.z }, tag("height", H, frac(H)), { x: 1, y: 0, z: 0 });
}

export function drawBubble(doc: jsPDF, x: number, y: number, letter: string, r = 8.5, muted = false) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...(muted ? KIT.ghostEdge : KIT.accent));
  doc.setLineWidth(1.1);
  const rr = letter.length > 1 ? r + 2 : r;
  doc.circle(x, y, rr, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(letter.length > 1 ? 8.5 : 10);
  doc.setTextColor(...(muted ? KIT.muted : KIT.ink));
  doc.text(letter, x, y + 3.5, { align: "center" });
}

function drawBubbles(doc: jsPDF, frame: Frame, anchors: Map<string, { x: number; y: number }>) {
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  const items = [...anchors.entries()].map(([L, a]) => {
    let dx = a.x - cx;
    let dy = a.y - cy;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    return { L, a, x: a.x + dx * 34, y: a.y + dy * 34 };
  });
  const r = 10;
  const clampIn = (it: { x: number; y: number }) => {
    it.x = Math.min(frame.x + frame.w - r - 2, Math.max(frame.x + r + 2, it.x));
    it.y = Math.min(frame.y + frame.h - r - 2, Math.max(frame.y + r + 2, it.y));
  };
  items.forEach(clampIn);
  for (let iter = 0; iter < 40; iter++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const A = items[i];
        const B = items[j];
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const d = Math.hypot(dx, dy);
        if (d < r * 2.4) {
          const push = (r * 2.4 - d) / 2 + 0.5;
          const ux = d ? dx / d : 1;
          const uy = d ? dy / d : 0;
          A.x -= ux * push;
          A.y -= uy * push;
          B.x += ux * push;
          B.y += uy * push;
          clampIn(A);
          clampIn(B);
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  for (const it of items) {
    doc.setDrawColor(...KIT.ink);
    doc.setLineWidth(0.6);
    doc.line(it.a.x, it.a.y, it.x, it.y);
    doc.setFillColor(...KIT.ink);
    doc.circle(it.a.x, it.a.y, 1.4, "F");
  }
  for (const it of items) drawBubble(doc, it.x, it.y, it.L);
}

// ───────────────────────── part letters ─────────────────────────

function dimsKey(a: number, b: number, c: number) {
  return [a, b, c].map((v) => Math.round(v * 8) / 8).sort((x, y) => y - x);
}

/** Map every panel (and craft instance) to its cut-list letter, by family name and size. */
export function partLetters(project: YardProject, cutList: CutLine[]): Map<string, string> {
  const out = new Map<string, string>();
  const lines = cutList.map((c) => ({ c, key: dimsKey(c.lengthIn, c.widthIn, c.thicknessIn), fam: c.name.toLowerCase() }));
  for (const p of project.panels) {
    const fam = cutListName(p.name, p.type).toLowerCase();
    const key = p.blank
      ? dimsKey(p.blank.lengthIn, p.blank.widthIn, p.blank.thicknessIn)
      : dimsKey(p.size.width, p.size.height, p.size.depth);
    const same = (k: number[]) => k.every((v, i) => Math.abs(v - key[i]) < 0.07);
    const hit =
      lines.find((l) => l.fam === fam && same(l.key)) ??
      lines.find((l) => same(l.key) && (l.fam.includes(fam) || fam.includes(l.fam))) ??
      (lines.filter((l) => l.fam === fam).length === 1 ? lines.find((l) => l.fam === fam) : undefined) ??
      (lines.filter((l) => same(l.key)).length === 1 ? lines.find((l) => same(l.key)) : undefined) ??
      // A panel too big for one sheet is cut as n equal strips — the strips carry its letter.
      lines.find((l) => (l.fam === fam || l.fam.startsWith(`${fam} ·`)) && [2, 3, 4].some((n) => {
        const cands = [[key[0], key[1] / n, key[2]], [key[0] / n, key[1], key[2]]].map((k) => [...k].sort((a, b) => b - a));
        return cands.some((k) => k.every((v, i) => Math.abs(v - l.key[i]) < 0.07));
      }));
    if (hit?.c.label) out.set(p.id, hit.c.label);
  }
  if (project.instances.length && cutList.length === 1 && cutList[0].label) {
    for (const i of project.instances) out.set(i.id, cutList[0].label);
  } else if (project.instances.length) {
    for (const i of project.instances) {
      const item = getCatalogItem(i.catalogId);
      const hit = cutList.find((c) => item && c.name.toLowerCase().includes(item.name.toLowerCase()));
      if (hit?.label) out.set(i.id, hit.label);
    }
  }
  return out;
}

// ───────────────────────── flat part shapes ─────────────────────────

export type Shape2D = { pts: [number, number][]; circle?: number; w: number; h: number; angled: boolean };

/** Face outline of a cut line, long side horizontal, in inches. */
export function partShape(project: YardProject, line: CutLine, letters: Map<string, string>): Shape2D {
  const L = Math.max(line.lengthIn, line.widthIn);
  const W = Math.min(line.lengthIn, line.widthIn);
  const rect: Shape2D = { pts: [[0, 0], [L, 0], [L, W], [0, W]], w: L, h: W, angled: false };
  const panel = project.panels.find((p) => letters.get(p.id) === line.label);
  if (!panel) return rect;
  if (isRoundPlate(project, panel)) return { pts: [], circle: panel.size.width / 2, w: panel.size.width, h: panel.size.width, angled: true };
  let ring: [number, number][] | null = null;
  if (panel.outline) {
    ring = outlineRingXZ(panel).map((q) => [q.x - panel.position.x, q.z - panel.position.z]);
  } else if (panel.polygon) {
    // The outline is the face only when it is extruded by the board's own thickness.
    const thick = panel.polygon.plane === "xz" ? panel.size.height : panel.size.depth;
    const faceIsPoly = Math.abs(thick - line.thicknessIn) < 0.07;
    if (faceIsPoly) ring = panel.polygon.pts.map(([a, b]) => [a, b]);
    else return { ...rect, angled: !!panel.cutNote };
  }
  if (!ring) return rect;
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  let pts = ring.map(([a, b]) => [a - x0, b - y0] as [number, number]);
  let w = Math.max(...xs) - x0;
  let h = Math.max(...ys) - y0;
  if (h > w) {
    pts = pts.map(([a, b]) => [b, a] as [number, number]);
    [w, h] = [h, w];
  }
  // Paper y runs down; flip so "up" in the model is up on the page.
  pts = pts.map(([a, b]) => [a, h - b] as [number, number]);
  return { pts, w, h, angled: true };
}

export function drawShape(doc: jsPDF, sh: Shape2D, x: number, y: number, s: number, fill: RGB, edge: RGB) {
  doc.setFillColor(...fill);
  doc.setDrawColor(...edge);
  doc.setLineWidth(0.7);
  if (sh.circle) {
    doc.circle(x + sh.circle * s, y + sh.circle * s, sh.circle * s, "FD");
    return;
  }
  poly(
    doc,
    sh.pts.map(([a, b]) => ({ x: x + a * s, y: y + b * s })),
    "FD",
  );
}

export function drawShapeInRect(doc: jsPDF, sh: Shape2D, x: number, y: number, w: number, h: number, edge: RGB) {
  // Fit the outline into a nest rectangle (rotate when the rectangle stands tall).
  if (sh.circle) {
    const r = Math.min(w, h) / 2;
    doc.setDrawColor(...edge);
    doc.setLineWidth(0.9);
    doc.setLineDashPattern([3, 2], 0);
    doc.circle(x + w / 2, y + h / 2, r, "S");
    doc.setLineDashPattern([], 0);
    return;
  }
  const tall = h > w;
  const sw = tall ? sh.h : sh.w;
  const shh = tall ? sh.w : sh.h;
  const sx = w / Math.max(sw, 1e-3);
  const sy = h / Math.max(shh, 1e-3);
  const pts = sh.pts.map(([a, b]) => (tall ? { x: x + b * sx, y: y + a * sy } : { x: x + a * sx, y: y + b * sy }));
  doc.setDrawColor(...edge);
  doc.setLineWidth(0.9);
  doc.setLineDashPattern([3, 2], 0);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const onEdge =
      (Math.abs(a.x - b.x) < 0.01 && (Math.abs(a.x - x) < 0.01 || Math.abs(a.x - x - w) < 0.01)) ||
      (Math.abs(a.y - b.y) < 0.01 && (Math.abs(a.y - y) < 0.01 || Math.abs(a.y - y - h) < 0.01));
    if (!onEdge) doc.line(a.x, a.y, b.x, b.y);
  }
  doc.setLineDashPattern([], 0);
}

// ───────────────────────── hardware glyphs ─────────────────────────

export type HardwareKind = "screw" | "hinge" | "pull" | "knob" | "slide" | "glue" | "nail" | "pin" | "bracket" | "anchor" | "caster" | "other";

export function hardwareKind(name: string): HardwareKind {
  const n = name.toLowerCase();
  if (/glue|adhesive|epoxy/.test(n)) return "glue";
  if (/hinge/.test(n)) return "hinge";
  if (/slide/.test(n)) return "slide";
  if (/knob/.test(n)) return "knob";
  if (/pull|handle/.test(n)) return "pull";
  if (/anchor|toggle/.test(n)) return "anchor";
  if (/bracket|l-brace|corner brace|cleat hanger/.test(n)) return "bracket";
  if (/caster|wheel/.test(n)) return "caster";
  if (/shelf pin|dowel pin|\bpins?\b|peg/.test(n)) return "pin";
  if (/nail|brad/.test(n)) return "nail";
  if (/screw|bolt|lag/.test(n)) return "screw";
  return "other";
}

/** Screw length in inches from '#8 x 1-1/4"' style names. */
export function screwLengthIn(name: string): number | null {
  const m = clean(name).match(/\bx\s*(\d+\/\d+|\d+(?:[- ]\d+\/\d+)?)\s*(?:"|in\b|inch)?/i);
  if (!m) return null;
  const tok = m[1].trim();
  let v = 0;
  const mixed = tok.match(/^(\d+)[- ](\d+)\/(\d+)$/);
  const fr = tok.match(/^(\d+)\/(\d+)$/);
  if (mixed) v = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  else if (fr) v = Number(fr[1]) / Number(fr[2]);
  else v = Number(tok);
  return v > 0 && v < 12 ? v : null;
}

/** Draw a hardware glyph with its left edge at x, centered on cy. Returns drawn width. */
export function drawHardware(doc: jsPDF, kind: HardwareKind, x: number, cy: number, opts?: { lengthIn?: number; maxW?: number }) {
  const maxW = opts?.maxW ?? 120;
  doc.setLineJoin("round");
  doc.setLineCap("round");
  if (kind === "screw" || kind === "nail") {
    const len = Math.min(maxW, (opts?.lengthIn ?? 1.25) * 72);
    const head = kind === "screw" ? 7 : 4;
    const shank = kind === "screw" ? 3 : 1.6;
    doc.setFillColor(...KIT.steel);
    doc.setDrawColor(...KIT.steelDark);
    doc.setLineWidth(0.6);
    // head
    doc.lines([[0, head * 2], [2.2, -1], [0, -head * 2 + 2]], x, cy - head, [1, 1], "FD", true);
    // shank with point
    doc.lines([[len - 2.2 - 6, 0], [6, shank], [-6, shank], [-(len - 2.2 - 6), 0]], x + 2.2, cy - shank, [1, 1], "FD", true);
    if (kind === "screw") {
      doc.setLineWidth(0.5);
      for (let t = x + 8; t < x + len - 6; t += 4) doc.line(t, cy - shank - 0.6, t + 2, cy + shank + 0.6);
      doc.setDrawColor(...KIT.ink);
      doc.setLineWidth(0.6);
      doc.line(x + 0.6, cy - 2.5, x + 0.6, cy + 2.5);
    }
    return len;
  }
  if (kind === "hinge") {
    doc.setFillColor(...KIT.steel);
    doc.setDrawColor(...KIT.steelDark);
    doc.setLineWidth(0.7);
    doc.circle(x + 16, cy, 15, "FD");
    doc.roundedRect(x + 26, cy - 8, 34, 16, 3, 3, "FD");
    doc.setFillColor(255, 255, 255);
    doc.circle(x + 50, cy, 2.2, "FD");
    doc.circle(x + 38, cy, 2.2, "FD");
    doc.circle(x + 16, cy, 9, "S");
    return 62;
  }
  if (kind === "pull") {
    doc.setFillColor(...KIT.steel);
    doc.setDrawColor(...KIT.steelDark);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, cy - 3, 72, 6, 3, 3, "FD");
    doc.rect(x + 8, cy + 3, 4, 7, "FD");
    doc.rect(x + 60, cy + 3, 4, 7, "FD");
    return 72;
  }
  if (kind === "knob") {
    doc.setFillColor(...KIT.steel);
    doc.setDrawColor(...KIT.steelDark);
    doc.circle(x + 12, cy, 12, "FD");
    doc.circle(x + 12, cy, 5, "S");
    return 24;
  }
  if (kind === "slide") {
    doc.setFillColor(...KIT.steel);
    doc.setDrawColor(...KIT.steelDark);
    doc.setLineWidth(0.6);
    doc.rect(x, cy - 7, 100, 8, "FD");
    doc.rect(x + 14, cy - 1, 86, 7, "FD");
    for (let t = x + 10; t < x + 96; t += 22) {
      doc.setFillColor(255, 255, 255);
      doc.circle(t, cy - 3, 1.6, "FD");
    }
    return 100;
  }
  if (kind === "glue") {
    doc.setFillColor(250, 250, 246);
    doc.setDrawColor(...KIT.ink);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, cy - 16, 22, 34, 3, 3, "FD");
    doc.setFillColor(...KIT.accent);
    doc.lines([[5, -8], [4, 0], [5, 8]], x + 4, cy - 16, [1, 1], "FD", true);
    doc.setFillColor(...KIT.accentSoft);
    doc.rect(x + 3, cy - 6, 16, 12, "F");
    return 22;
  }
  if (kind === "pin") {
    doc.setFillColor(...KIT.steel);
    doc.setDrawColor(...KIT.steelDark);
    doc.setLineWidth(0.6);
    doc.roundedRect(x, cy - 3, 28, 6, 2, 2, "FD");
    doc.rect(x + 14, cy - 6, 3, 12, "FD");
    return 28;
  }
  if (kind === "bracket") {
    doc.setFillColor(...KIT.steel);
    doc.setDrawColor(...KIT.steelDark);
    doc.setLineWidth(0.7);
    doc.lines([[0, 28], [28, 0], [0, -6], [-22, 0], [0, -22]], x, cy - 14, [1, 1], "FD", true);
    doc.setFillColor(255, 255, 255);
    doc.circle(x + 3, cy - 6, 1.5, "FD");
    doc.circle(x + 20, cy + 11, 1.5, "FD");
    return 28;
  }
  if (kind === "anchor") {
    doc.setFillColor(...KIT.steel);
    doc.setDrawColor(...KIT.steelDark);
    doc.lines([[40, -3], [0, 6], [-40, -3]], x + 4, cy, [1, 1], "FD", true);
    doc.rect(x, cy - 5, 4, 10, "FD");
    return 44;
  }
  if (kind === "caster") {
    doc.setFillColor(...KIT.steel);
    doc.setDrawColor(...KIT.steelDark);
    doc.rect(x, cy - 14, 26, 4, "FD");
    doc.setFillColor(...KIT.ink);
    doc.circle(x + 13, cy + 4, 10, "FD");
    return 26;
  }
  doc.setFillColor(...KIT.steel);
  doc.setDrawColor(...KIT.steelDark);
  doc.roundedRect(x, cy - 8, 24, 16, 3, 3, "FD");
  return 24;
}

// ───────────────────────── tool icons ─────────────────────────

export type ToolKind =
  | "tape"
  | "square"
  | "pencil"
  | "saw"
  | "jigsaw"
  | "drill"
  | "clamp"
  | "level"
  | "studfinder"
  | "sander"
  | "bevel"
  | "glue"
  | "ruler"
  | "hammer";

export const TOOL_LABEL: Record<ToolKind, string> = {
  tape: "Tape measure",
  square: "Square",
  pencil: "Pencil",
  saw: "Circular saw",
  jigsaw: "Jigsaw",
  drill: "Drill / driver",
  clamp: "Clamps",
  level: "Level",
  studfinder: "Stud finder",
  sander: "Sander",
  bevel: "Bevel gauge",
  glue: "Wood glue",
  ruler: "Ruler",
  hammer: "Hammer",
};

/** Simple line icon in a size×size box at (x, y). */
export function drawTool(doc: jsPDF, t: ToolKind, x: number, y: number, size = 34) {
  const k = size / 34;
  const P = (px: number, py: number) => ({ x: x + px * k, y: y + py * k });
  doc.setDrawColor(...KIT.ink);
  doc.setLineWidth(1.2);
  doc.setLineJoin("round");
  doc.setLineCap("round");
  const L = (a: [number, number], b: [number, number]) => {
    const A = P(a[0], a[1]);
    const B = P(b[0], b[1]);
    doc.line(A.x, A.y, B.x, B.y);
  };
  const R = (rx: number, ry: number, rw: number, rh: number, fill?: RGB) => {
    const A = P(rx, ry);
    if (fill) {
      doc.setFillColor(...fill);
      doc.rect(A.x, A.y, rw * k, rh * k, "FD");
    } else doc.rect(A.x, A.y, rw * k, rh * k, "S");
  };
  const C = (cx: number, cy: number, r: number, fill?: RGB) => {
    const A = P(cx, cy);
    if (fill) {
      doc.setFillColor(...fill);
      doc.circle(A.x, A.y, r * k, "FD");
    } else doc.circle(A.x, A.y, r * k, "S");
  };
  switch (t) {
    case "tape":
      R(4, 8, 22, 20, KIT.accentSoft);
      C(15, 18, 5);
      L([26, 24], [32, 24]);
      L([32, 22], [32, 26]);
      break;
    case "square":
      doc.setFillColor(...KIT.accentSoft);
      doc.lines([[0, 26], [26, 0], [0, -6], [-20, 0], [0, -20]].map(([a, b]) => [a * k, b * k]), x + 5 * k, y + 4 * k, [1, 1], "FD", true);
      for (let i = 0; i < 4; i++) L([14 + i * 4, 30], [14 + i * 4, 27]);
      break;
    case "pencil":
      doc.setFillColor(...KIT.accentSoft);
      doc.lines([[20, -20], [5, 5], [-20, 20]].map(([a, b]) => [a * k, b * k]), x + 6 * k, y + 28 * k, [1, 1], "FD", true);
      L([6, 28], [4, 30]);
      break;
    case "saw":
      C(15, 18, 10);
      C(15, 18, 2);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        L([15 + Math.cos(a) * 10, 18 + Math.sin(a) * 10], [15 + Math.cos(a + 0.3) * 12, 18 + Math.sin(a + 0.3) * 12]);
      }
      R(22, 6, 10, 6, KIT.accentSoft);
      break;
    case "jigsaw":
      doc.setFillColor(...KIT.accentSoft);
      doc.roundedRect(x + 4 * k, y + 8 * k, 26 * k, 12 * k, 4 * k, 4 * k, "FD");
      R(8, 20, 20, 4);
      L([14, 24], [14, 32]);
      break;
    case "drill":
      doc.setFillColor(...KIT.accentSoft);
      doc.roundedRect(x + 4 * k, y + 6 * k, 20 * k, 10 * k, 3 * k, 3 * k, "FD");
      R(8, 16, 8, 14, KIT.accentSoft);
      L([24, 11], [32, 11]);
      break;
    case "clamp":
      L([6, 6], [6, 30]);
      L([6, 6], [24, 6]);
      L([6, 30], [16, 30]);
      L([22, 6], [22, 22]);
      R(18, 22, 8, 4, KIT.accentSoft);
      L([22, 26], [22, 32]);
      break;
    case "level":
      doc.setFillColor(...KIT.accentSoft);
      doc.roundedRect(x + 2 * k, y + 12 * k, 30 * k, 10 * k, 2 * k, 2 * k, "FD");
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x + 12 * k, y + 14 * k, 10 * k, 6 * k, 3 * k, 3 * k, "FD");
      C(17, 17, 1.6);
      break;
    case "studfinder":
      doc.setFillColor(...KIT.accentSoft);
      doc.roundedRect(x + 8 * k, y + 4 * k, 18 * k, 26 * k, 4 * k, 4 * k, "FD");
      R(12, 8, 10, 6);
      C(17, 22, 3);
      break;
    case "sander":
      doc.setFillColor(...KIT.accentSoft);
      doc.roundedRect(x + 4 * k, y + 16 * k, 26 * k, 10 * k, 2 * k, 2 * k, "FD");
      doc.roundedRect(x + 10 * k, y + 6 * k, 14 * k, 10 * k, 4 * k, 4 * k, "S");
      break;
    case "bevel":
      L([6, 28], [30, 28]);
      L([6, 28], [24, 6]);
      C(6, 28, 2, KIT.accentSoft);
      break;
    case "glue":
      doc.setFillColor(...KIT.accentSoft);
      doc.roundedRect(x + 10 * k, y + 10 * k, 14 * k, 22 * k, 3 * k, 3 * k, "FD");
      doc.lines([[3, -6], [2, 0], [3, 6]].map(([a, b]) => [a * k, b * k]), x + 13 * k, y + 10 * k, [1, 1], "S", true);
      break;
    case "ruler":
      R(2, 12, 30, 10, KIT.accentSoft);
      for (let i = 0; i < 7; i++) L([5 + i * 4, 12], [5 + i * 4, i % 2 ? 15 : 17]);
      break;
    case "hammer":
      L([10, 30], [20, 10]);
      R(12, 4, 16, 7, KIT.accentSoft);
      break;
  }
}

