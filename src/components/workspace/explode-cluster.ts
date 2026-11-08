/**
 * See inside: the readable cluster (Critic #98 round 2: the smallest visible piece is at least 200 CSS px² in the
 * one exploded frame, for every build, at every viewport; no per-build exemptions).
 *
 * One rule: when a mover's pieces are still too small to read once the explode is solved (a 102" tower frames at
 * ~3 px/in, so a 4"-wide drawer's back is a speck), that mover leaves the assembly for a cluster beside it, brought
 * nearer the camera so it reads at a larger scale (up to CLUSTER_GAIN_MAX). Each mover is one block of the cluster's
 * grid (a drawer bank is a column, top drawer first), and inside a block its pieces spread apart on screen from their
 * built places just far enough that none covers another: a drawer reads as its front, sides, back and bottom, each
 * whole, in its built orientation. The assembly gives up a share of the free stage (beside it on a wide stage, above
 * or below it on a tall one); the share and side that make the smallest piece of the whole frame largest win.
 *
 * Pure and renderer-free: the frame math is explode-frame.ts's fitPoints (the camera the user sees), so the cluster
 * lands inside the free stage by construction. Read-only on the engine: no part, size, price or Buy changes.
 */
import type { BenchView, Rect } from "@/lib/yard/benchFrame";
import { fitPoints } from "@/components/workspace/explode-frame";
import { CLUSTER_WINDOW, cornersOf, tweenCollides, type ExplodePart, type Layout, type Mover, type Pose, type V3 } from "@/components/workspace/explode-layout";

/** The cluster comes at most this much nearer than the assembly (linear scale on screen). */
export const CLUSTER_GAIN_MAX = 3;
/** The placement aims for every piece at least this many CSS px² (the e2e's 200, with room for the estimate): the
 * smallest share of the stage that gets there wins, so the assembly keeps as much of the stage as it can. */
export const CLUSTER_TARGET = 320;

export type ClusterFrame = { view: BenchView; viewport: { w: number; h: number }; overlays: Rect[]; fov: number };

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

type M3 = number[]; // row-major 3×3
function rotM(axis: V3, ang: number): M3 {
  const [x, y, z] = norm(axis), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mulM = (a: M3, b: M3): M3 => {
  const o = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) o[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return o;
};
const app = (m: M3, v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
/** Axis and angle of a rotation matrix (angle in [0, π]). */
export function axisAngleOf(m: M3): { axis: V3; ang: number } {
  const tr = m[0] + m[4] + m[8];
  const ang = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
  if (ang < 1e-9) return { axis: [0, 1, 0], ang: 0 };
  if (Math.PI - ang < 1e-6) {
    // 180°: the axis is the column of (M + I) with the largest norm.
    const cols: V3[] = [[m[0] + 1, m[3], m[6]], [m[1], m[4] + 1, m[7]], [m[2], m[5], m[8] + 1]];
    cols.sort((a, b) => Math.hypot(...b) - Math.hypot(...a));
    return { axis: norm(cols[0]), ang };
  }
  return { axis: norm([m[7] - m[5], m[2] - m[6], m[3] - m[1]]), ang };
}

/** Closes a set of mover keys: one drawer brings every drawer (the banks stay alike), a linked mover its partners. */
export function closeMembers(L: Layout, keys: Iterable<string>): Set<string> {
  const out = new Set<string>();
  const want = new Set(keys);
  const anyDrawer = [...want].some((k) => k.startsWith("D:"));
  const links = new Set([...want].map((k) => L.movers.get(k)?.link).filter((x): x is string => !!x && !x.startsWith("drawer:")));
  for (const m of L.movers.values()) {
    if (m.key === "anchor") continue;
    if (want.has(m.key) || (anyDrawer && m.key.startsWith("D:")) || (m.link && links.has(m.link))) out.add(m.key);
  }
  return out;
}

type Cam = { eye: V3; back: V3; x: V3; y: V3; f: number; scx: number; scy: number; safe: Rect };
function camOf(points: V3[], F: ClusterFrame, safe?: Rect): Cam {
  const frame = fitPoints({ points, view: F.view, viewport: F.viewport, overlays: F.overlays, fovDeg: F.fov, safe });
  const az = (F.view.azimuthDeg * Math.PI) / 180, el = (F.view.elevationDeg * Math.PI) / 180;
  const back: V3 = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  const x = norm(cross([0, 1, 0], back));
  const y = cross(back, x);
  const f = F.viewport.h / 2 / Math.tan(((F.fov / 2) * Math.PI) / 180);
  const s = frame.safe;
  return { eye: frame.position as V3, back, x, y, f, scx: (s.left + s.right) / 2, scy: (s.top + s.bottom) / 2, safe: s };
}
const depthOf = (c: Cam, p: V3) => -dot(sub(p, c.eye), c.back);
function project(c: Cam, p: V3): [number, number] {
  const r = sub(p, c.eye), z = Math.max(1e-6, -dot(r, c.back));
  return [c.scx + (c.f * dot(r, c.x)) / z, c.scy - (c.f * dot(r, c.y)) / z];
}
function hullArea(pts: [number, number][]): number {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], up: [number, number][] = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const h = lo.slice(0, -1).concat(up.slice(0, -1));
  let a = 0;
  for (let i = 0; i < h.length; i++) { const p = h[i], q = h[(i + 1) % h.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
}

/**
 * The smallest piece's readable size (CSS px²) in the frame the user will see for these poses: each part's
 * projected footprint × the share of it the solver last saw unhidden (L.visFrac; 1 when not measured yet, and for
 * the cluster's pieces, which nothing covers by construction).
 */
export function minReadable(L: Layout, poses: Map<string, Pose>, F: ClusterFrame, clear?: Set<string>): number {
  const all: V3[] = [];
  for (const p of L.parts) all.push(...cornersOf(p, poses.get(p.id)));
  const cam = camOf(all, F);
  let min = Infinity;
  for (const p of L.parts) {
    // Hardware renders as its own model, not its box (a hinge reads ~4× its box), so its box says nothing here.
    if (p.role === "hardware") continue;
    const a = hullArea(cornersOf(p, poses.get(p.id)).map((q) => project(cam, q))) * (clear?.has(p.id) ? 1 : L.visFrac?.get(p.id) ?? 1);
    if (a < min) min = a;
  }
  return min;
}

/** Where the cluster goes: a side of the free stage and the share of it the cluster takes. */
export type ClusterPick = { side: "left" | "right" | "top" | "bottom"; share: number };
const SHARES = [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65];

type Piece = { p: ExplodePart; rot?: { axis: V3; ang: number }; c: V3; u: number; v: number; hw: number; hh: number; hd: number };
/** ex / ey: packed size in inches; wt: 1 / √(its smallest piece's face on screen, in²), the block's scale weight. */
type Block = { key: string; pieces: Piece[]; order: [number, number, number]; ex: number; ey: number; ez: number; wt: number; sx: number; sy: number };

/**
 * How a piece turns in the cluster, about the vertical only (standing pieces stand, lying pieces lie, so a drawer's
 * bottom keeps its inside up): a standing panel turns its broad face to the camera's heading, a lying one turns its
 * long edge square to it (level on screen). The smaller of the two turns that do it.
 */
export function clusterYaw(p: Pick<ExplodePart, "w" | "h" | "d">, azimuthDeg: number): number {
  const az = (azimuthDeg * Math.PI) / 180;
  const wrap = (a: number) => { while (a > Math.PI / 2) a -= Math.PI; while (a < -Math.PI / 2) a += Math.PI; return a; };
  const thin = Math.min(p.w, p.h, p.d);
  if (thin === p.h) return wrap(p.w >= p.d ? az : az - Math.PI / 2);
  return wrap(thin === p.w ? az - Math.PI / 2 : az);
}

/**
 * A block (one mover: a drawer, a toekick, a divider) packed as a small parts sheet in the camera's plane: its
 * pieces, each turned by clusterYaw, in 1–3 rows (longest first, each into the shortest row), whichever packs
 * squarest. Nothing in a block covers anything else.
 */
function blockOf(m: Mover, cam: Cam, az: number, order: [number, number, number]): Block {
  const heading: V3 = norm([cam.back[0], 0, cam.back[2]]);
  const pitchAxis = norm(cross(heading, cam.back));
  const pitch = Math.acos(Math.max(-1, Math.min(1, dot(heading, cam.back))));
  const raw = m.parts.map((p) => {
    const yaw = clusterYaw(p, az);
    const c: V3 = [p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2];
    // A standing piece also leans back square to the camera (its whole face reads); a lying one stays level.
    const standing = Math.min(p.w, p.h, p.d) !== p.h;
    const Rm = standing && pitch > 1e-6 ? mulM(rotM(pitchAxis, pitch), rotM([0, 1, 0], yaw)) : rotM([0, 1, 0], yaw);
    const aa = axisAngleOf(Rm);
    const rot = aa.ang > 1e-9 ? aa : undefined;
    const cs = cornersOf(p, rot ? { t: [0, 0, 0], rot: { ...rot, pivot: c } } : undefined);
    const ax = cs.map((q) => dot(q, cam.x)), ay = cs.map((q) => dot(q, cam.y)), ab = cs.map((q) => dot(q, cam.back));
    return { p, rot, c, u: 0, v: 0, hw: (Math.max(...ax) - Math.min(...ax)) / 2, hh: (Math.max(...ay) - Math.min(...ay)) / 2, hd: (Math.max(...ab) - Math.min(...ab)) / 2 };
  });
  const gap = Math.max(0.25, 0.1 * Math.min(...raw.map((q) => Math.min(q.hw, q.hh) * 2)));
  let best: { area: number; rows: Piece[][] } | null = null;
  for (let r = 1; r <= Math.min(3, raw.length); r++) {
    const rows: Piece[][] = Array.from({ length: r }, () => []);
    const width = new Array(r).fill(0);
    for (const q of raw.slice().sort((x, y) => y.hw - x.hw)) {
      const i = width.indexOf(Math.min(...width));
      rows[i].push(q); width[i] += 2 * q.hw + gap;
    }
    const W = Math.max(...width) - gap;
    const H = rows.reduce((a, row) => a + 2 * Math.max(...row.map((q) => q.hh)), 0) + gap * (r - 1);
    const area = W * H * Math.max(W / H, H / W) ** 0.5;
    if (!best || area < best.area) best = { area, rows };
  }
  const rows = best!.rows;
  const W = Math.max(...rows.map((row) => row.reduce((a, q) => a + 2 * q.hw + gap, -gap)));
  const H = rows.reduce((a, row) => a + 2 * Math.max(...row.map((q) => q.hh)), 0) + gap * (rows.length - 1);
  let y = H / 2;
  for (const row of rows) {
    const rh = Math.max(...row.map((q) => q.hh));
    const rw = row.reduce((a, q) => a + 2 * q.hw + gap, -gap);
    let x = -rw / 2;
    for (const q of row) { q.u = x + q.hw; q.v = y - rh; x += 2 * q.hw + gap; }
    y -= 2 * rh + gap;
  }
  const minFace = Math.max(1e-3, Math.min(...raw.map((q) => {
    const cs = cornersOf(q.p, q.rot ? { t: [0, 0, 0], rot: { ...q.rot, pivot: q.c } } : undefined);
    return hullArea(cs.map((k) => [dot(k, cam.x), dot(k, cam.y)] as [number, number]));
  })));
  return { key: m.key, pieces: rows.flat(), order, ex: W, ey: H, ez: 2 * Math.max(...raw.map((q) => q.hd)), wt: 1 / Math.sqrt(minFace), sx: W, sy: H };
}

/**
 * A piece's pose in the cluster: turned by its yaw about its own centre, centred on `target`. The slide-out stays in
 * the move window and its sideways step and spread (`lat`) follow as before (built orientation: a hollow drawer no
 * longer tips); then it travels straight to its place (`cl`) inside its block's slice `clu` of CLUSTER_WINDOW.
 */
function poseTo(q: Piece, base: Pose | undefined, target: V3, clu: [number, number]): Pose {
  const b: Pose = base ?? { t: [0, 0, 0] };
  const t = sub(target, q.c);
  const out: Pose = { t, lat: b.lat, cl: sub(t, b.t), clu, stage: b.stage };
  if (q.rot) out.rot = { ...q.rot, pivot: q.c };
  return out;
}

/**
 * Lays the cluster out for this camera and writes the posed result into `poses` (in place). Every placement (each
 * side of the free stage, several shares of it) is scored by the smallest readable piece of the whole frame; the
 * best one that keeps the tween clear wins, and the pick is kept while the cluster's members stay the same. Returns
 * whether it moved anything (nothing moves when no placement reads better than the plain explode).
 */
export function applyCluster(L: Layout, poses: Map<string, Pose>, F: ClusterFrame): boolean {
  const members = L.cluster;
  if (!members || !members.size) return false;
  const inCl = (p: ExplodePart) => {
    const m = L.owner.get(p.id) ?? (p.host ? L.owner.get(p.host) : undefined);
    return !!m && members.has(m.key);
  };
  const mainPts: V3[] = [], allPts: V3[] = [];
  for (const p of L.parts) { const cs = cornersOf(p, poses.get(p.id)); allPts.push(...cs); if (!inCl(p)) mainPts.push(...cs); }
  if (!mainPts.length) return false;
  const full = camOf(allPts, F);
  const fullMain = camOf(mainPts, F);
  // Blocks in reading order: drawer banks left to right (each top drawer first), then the rest left to right.
  const list: Block[] = [];
  for (const m of L.movers.values()) {
    if (!members.has(m.key)) continue;
    const mid = m.parts.reduce((a, p) => add(a, [p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2]), [0, 0, 0] as V3);
    const [sx] = project(full, mul(mid, 1 / m.parts.length));
    list.push(blockOf(m, full, F.view.azimuthDeg, m.bank ? [0, m.dir ?? 0, m.k ?? 0] : [1, sx, 0]));
  }
  if (!list.length) return false;
  list.sort((a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2]);
  // A block with smaller pieces comes nearer (reads larger): every block's smallest piece gets the same screen size,
  // up to 3× between blocks (the block with the smallest piece is the scale reference).
  const wMax = Math.max(...list.map((b) => b.wt));
  for (const b of list) { const w = Math.max(1 / 3, b.wt / wMax); b.wt = w; b.sx = b.ex * w; b.sy = b.ey * w; }
  const s = full.safe;
  const sw = Math.max(40, s.right - s.left), sh = Math.max(40, s.bottom - s.top);
  const margin = Math.max(22, Math.min(sw, sh) * 0.1);
  const G = Math.max(8, 0.04 * Math.min(sw, sh));
  const gapIn = Math.max(0.5, 0.1 * Math.min(...list.map((b) => Math.min(b.ex, b.ey))));
  const ezMax = Math.max(...list.map((b) => b.ez));
  let mx0 = Infinity, mx1 = -Infinity, my0 = Infinity, my1 = -Infinity;
  for (const q of mainPts) { const [a, b] = project(fullMain, q); mx0 = Math.min(mx0, a); mx1 = Math.max(mx1, a); my0 = Math.min(my0, b); my1 = Math.max(my1, b); }
  const clusterX = list.reduce((a, b) => a + project(full, b.pieces[0].c)[0], 0) / list.length;
  const clusterY = list.reduce((a, b) => a + project(full, b.pieces[0].c)[1], 0) / list.length;
  const mcx = (mx0 + mx1) / 2, mcy = (my0 + my1) / 2;
  const sideH: ClusterPick["side"] = clusterX >= mcx ? "right" : "left", sideV: ClusterPick["side"] = clusterY >= mcy ? "bottom" : "top";
  const stripH = 1 - (mx1 - mx0 + 2 * margin + G) / sw, stripV = 1 - (my1 - my0 + 2 * margin + G) / sh;
  const sig = [...members].sort().join("|") + `@${F.viewport.w}x${F.viewport.h}`;
  let cands: ClusterPick[];
  if (L.clusterPick?.sig === sig) cands = L.clusterPick.pick ? [L.clusterPick.pick] : [];
  else {
    cands = [];
    for (const side of [sideH, sideV]) {
      const strip = side === sideH ? stripH : stripV;
      for (const share of [...SHARES, strip]) if (share > 0.12 && share < 0.75) cands.push({ side, share });
    }
  }
  const ids = new Set<string>();
  for (const b of list) for (const q of b.pieces) ids.add(q.p.id);
  const place = (c: ClusterPick): Map<string, Pose> | null => {
    const horiz = c.side === "left" || c.side === "right";
    const cut = horiz ? c.share * sw : c.share * sh;
    const mainRect: Rect = { ...s }, region: Rect = { ...s };
    if (c.side === "right") { mainRect.right = s.right - cut; region.left = s.right - cut; }
    if (c.side === "left") { mainRect.left = s.left + cut; region.right = s.left + cut; }
    if (c.side === "bottom") { mainRect.bottom = s.bottom - cut; region.top = s.bottom - cut; }
    if (c.side === "top") { mainRect.top = s.top + cut; region.bottom = s.top + cut; }
    const inner: Rect = {
      left: region.left + (c.side === "right" ? G / 2 : margin), right: region.right - (c.side === "left" ? G / 2 : margin),
      top: region.top + (c.side === "bottom" ? G / 2 : margin), bottom: region.bottom - (c.side === "top" ? G / 2 : margin),
    };
    const RW = inner.right - inner.left, RH = inner.bottom - inner.top;
    if (RW < 20 || RH < 20) return null;
    const cam = camOf(mainPts, F, mainRect);
    let mainDepth = 0;
    for (const q of mainPts) mainDepth += depthOf(cam, q);
    mainDepth /= mainPts.length;
    // Shelf packing in reading order: each break point is tried, the one with the largest scale wins.
    let best: { k: number; Wc: number; Hc: number; at: Map<string, [number, number]> } | null = null;
    let run = -gapIn;
    for (let j = 0; j < list.length; j++) {
      run += list[j].sx + gapIn;
      const Wt = run + 1e-6;
      const rows: Block[][] = [[]];
      let w = -gapIn;
      for (const b of list) {
        if (rows[rows.length - 1].length && w + gapIn + b.sx > Wt) { rows.push([]); w = -gapIn; }
        rows[rows.length - 1].push(b); w += gapIn + b.sx;
      }
      const rw = rows.map((row) => row.reduce((a, b) => a + b.sx + gapIn, -gapIn));
      const rh = rows.map((row) => Math.max(...row.map((b) => b.sy)));
      const Wc = Math.max(...rw), Hc = rh.reduce((a, h) => a + h, 0) + gapIn * (rows.length - 1);
      const k = Math.min(RW / Wc, RH / Hc);
      if (!(k > 0) || (best && k <= best.k)) continue;
      const at = new Map<string, [number, number]>();
      let y = Hc / 2;
      rows.forEach((row, r) => {
        let x = -rw[r] / 2;
        for (const b of row) { at.set(b.key, [x + b.sx / 2, y - rh[r] / 2]); x += b.sx + gapIn; }
        y -= rh[r] + gapIn;
      });
      best = { k, Wc, Hc, at };
    }
    // Or a grid filled column by column (a bank of n drawers is one column when rows = n).
    for (let rows = 1; rows <= list.length; rows++) {
      const cols = Math.ceil(list.length / rows);
      const cw = new Array(cols).fill(0), rh = new Array(rows).fill(0);
      list.forEach((b, i) => { const cc = Math.floor(i / rows), r = i % rows; cw[cc] = Math.max(cw[cc], b.sx); rh[r] = Math.max(rh[r], b.sy); });
      const Wc = cw.reduce((a, b) => a + b, 0) + gapIn * (cols - 1), Hc = rh.reduce((a, b) => a + b, 0) + gapIn * (rows - 1);
      const k = Math.min(RW / Wc, RH / Hc);
      if (!(k > 0) || (best && k <= best.k)) continue;
      const at = new Map<string, [number, number]>();
      list.forEach((b, i) => {
        const cc = Math.floor(i / rows), r = i % rows;
        at.set(b.key, [-Wc / 2 + cw.slice(0, cc).reduce((a, v) => a + v, 0) + gapIn * cc + cw[cc] / 2, Hc / 2 - rh.slice(0, r).reduce((a, w) => a + w, 0) - gapIn * r - rh[r] / 2]);
      });
      best = { k, Wc, Hc, at };
    }
    if (!best) return null;
    // Depth for that scale (px per inch = f / z), near face included; never nearer than CLUSTER_GAIN_MAX allows.
    const zOf = (b: Block) => Math.max(cam.f / (best!.k * b.wt) + b.ez / 2, mainDepth / CLUSTER_GAIN_MAX, b.ez + 2);
    // The live camera fits main and cluster together and re-centres them, and a sideways camera move shifts the nearer
    // cluster more than the assembly (parallax): place it next to the assembly as the camera of the last pass sees it,
    // three passes.
    const targets = new Map<string, V3>();
    let camI = cam, merged = new Map(poses);
    for (let it = 0; it < 3; it++) {
      let ax0 = Infinity, ax1 = -Infinity, ay0 = Infinity, ay1 = -Infinity;
      for (const q of mainPts) { const [a, b] = project(camI, q); ax0 = Math.min(ax0, a); ax1 = Math.max(ax1, a); ay0 = Math.min(ay0, b); ay1 = Math.max(ay1, b); }
      const K = best.k;
      const px = c.side === "right" ? ax1 + G + (best.Wc * K) / 2 : c.side === "left" ? ax0 - G - (best.Wc * K) / 2 : (ax0 + ax1) / 2;
      const py = c.side === "bottom" ? ay1 + G + (best.Hc * K) / 2 : c.side === "top" ? ay0 - G - (best.Hc * K) / 2 : (ay0 + ay1) / 2;
      for (const b of list) {
        const [bu, bv] = best.at.get(b.key)!;
        const zb = zOf(b), sxp = px + bu * K, syp = py - bv * K;
        const Pb = add(add(add(camI.eye, mul(camI.back, -zb)), mul(camI.x, ((sxp - camI.scx) * zb) / camI.f)), mul(camI.y, (-(syp - camI.scy) * zb) / camI.f));
        for (const q of b.pieces) targets.set(q.p.id, add(add(Pb, mul(camI.x, q.u)), mul(camI.y, q.v)));
      }
      merged = new Map(poses);
      for (const b of list) for (const q of b.pieces) merged.set(q.p.id, { t: sub(targets.get(q.p.id)!, q.c), rot: q.rot ? { ...q.rot, pivot: q.c } : undefined });
      const pts: V3[] = [];
      for (const p of L.parts) pts.push(...cornersOf(p, merged.get(p.id)));
      camI = camOf(pts, F);
    }
    // Screen boxes must not meet in the live frame (the cluster never covers the assembly).
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity, cx0 = Infinity, cx1 = -Infinity, cy0 = Infinity, cy1 = -Infinity;
    for (const q of mainPts) { const [a, b] = project(camI, q); bx0 = Math.min(bx0, a); bx1 = Math.max(bx1, a); by0 = Math.min(by0, b); by1 = Math.max(by1, b); }
    for (const blk of list) for (const q of blk.pieces) for (const k of cornersOf(q.p, merged.get(q.p.id))) {
      const [a, b] = project(camI, k); cx0 = Math.min(cx0, a); cx1 = Math.max(cx1, a); cy0 = Math.min(cy0, b); cy1 = Math.max(cy1, b);
    }
    if (Math.min(bx1, cx1) - Math.max(bx0, cx0) > -2 && Math.min(by1, cy1) - Math.max(by0, cy0) > -2) return null;
    // Blocks leave front first (nearest the camera once slid out), each in its own slice of CLUSTER_WINDOW, so a
    // block always moves away from the ones still waiting behind it.
    const depthNow = (b: Block) => mean(b.pieces.map((q) => {
      const bp = poses.get(q.p.id) ?? { t: [0, 0, 0] as V3 };
      return depthOf(cam, add(q.c, bp.t));
    }));
    const queue = list.slice().sort((a, b) => depthNow(a) - depthNow(b));
    const [w0, w1] = CLUSTER_WINDOW, n = queue.length;
    const dur = n > 1 ? (w1 - w0) * 0.5 : w1 - w0, stepT = n > 1 ? (w1 - w0 - dur) / (n - 1) : 0;
    const out = new Map<string, Pose>();
    queue.forEach((b, i) => {
      const clu: [number, number] = [w0 + i * stepT, w0 + i * stepT + dur];
      for (const q of b.pieces) out.set(q.p.id, poseTo(q, poses.get(q.p.id), targets.get(q.p.id)!, clu));
    });
    for (const h of L.parts) {
      if (h.role !== "hardware" || !h.host) continue;
      const hp = out.get(h.host);
      if (hp) out.set(h.id, { ...hp, t: [...hp.t] as V3, lat: hp.lat ? ([...hp.lat] as V3) : undefined, cl: hp.cl ? ([...hp.cl] as V3) : undefined });
    }
    return out;
  };
  const scored: { c: ClusterPick; m: Map<string, Pose>; score: number }[] = [];
  for (const c of cands) {
    const out = place(c);
    if (!out) continue;
    const merged = new Map(poses);
    for (const [k, v] of out) merged.set(k, v);
    scored.push({ c, m: merged, score: minReadable(L, merged, F, ids) });
  }
  scored.sort((a, b) => b.score - a.score);
  const plain = minReadable(L, poses, F);
  let win: (typeof scored)[number] | undefined;
  const clear = (t: (typeof scored)[number]) => !tweenCollides(L, t.m);
  // The smallest share that reaches CLUSTER_TARGET; failing that, the best score.
  const enough = scored.filter((t) => t.score >= CLUSTER_TARGET).sort((a, b) => a.c.share - b.c.share || b.score - a.score);
  for (const t of enough) if (clear(t)) { win = t; break; }
  if (!win) for (const t of scored) {
    if (t.score <= plain * 1.05) break;
    if (clear(t)) { win = t; break; }
  }
  L.clusterPick = { sig, pick: win?.c ?? null };
  if (!win) return false;
  for (const [k, v] of win.m) poses.set(k, v);
  return true;
}
