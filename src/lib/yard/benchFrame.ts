/**
 * Bench framing — one pure function places the camera for EVERY build.
 *
 * Input is the solved model's bounding box (the same panels/instances the cut list reads),
 * the canvas size and the parts of the canvas covered by UI cards. Output is a camera that
 * shows the whole model inside the free part of the canvas with a margin, from a 3/4 view.
 * The workspace canvas and the framing guard both call this, so a new build cannot regress.
 */
import { aabbOfPanels } from "./geometry";
import type { Aabb3 } from "./geometry";
import type { YardProject } from "./types";

export type Rect = { left: number; top: number; right: number; bottom: number };
export type Insets = { top: number; bottom: number; left: number; right: number };
export type BenchView = { azimuthDeg: number; elevationDeg: number };
export type BenchFrame = {
  position: [number, number, number];
  target: [number, number, number];
  /** Principal-point shift in canvas px (camera.setViewOffset(w, h, x, y, w, h)). */
  viewOffset: { x: number; y: number };
  distance: number;
  safe: Rect;
  fovDeg: number;
};

export const BENCH_FOV = 34;

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** The model the bench draws: panels (world corners, yaw-aware) + stick instances. Floor included (y ≥ 0). */
export function benchModelBox(project: Pick<YardProject, "panels" | "instances" | "overall">): Aabb3 {
  const b = aabbOfPanels(project.panels ?? []);
  let box: Aabb3 | null = b ? { ...b } : null;
  const grow = (x: number, y: number, z: number, pad: number) => {
    if (!box) box = { minX: x - pad, maxX: x + pad, minY: y - pad, maxY: y + pad, minZ: z - pad, maxZ: z + pad };
    else {
      box.minX = Math.min(box.minX, x - pad); box.maxX = Math.max(box.maxX, x + pad);
      box.minY = Math.min(box.minY, y - pad); box.maxY = Math.max(box.maxY, y + pad);
      box.minZ = Math.min(box.minZ, z - pad); box.maxZ = Math.max(box.maxZ, z + pad);
    }
  };
  for (const i of project.instances ?? []) {
    const pad = 0.75;
    if (i.from && i.to) {
      grow(i.from.x, i.from.y, i.from.z, pad);
      grow(i.to.x, i.to.y, i.to.z, pad);
    } else {
      const p = i.home ?? i.position;
      grow(p.x, p.y, p.z, Math.min((i.cutLength ?? 4) / 2, 6));
    }
  }
  if (!box) {
    const o = project.overall;
    box = { minX: -o.width / 2, maxX: o.width / 2, minY: 0, maxY: Math.max(o.height, 1), minZ: -o.depth / 2, maxZ: o.depth / 2 };
  }
  const out = box as Aabb3;
  out.minY = Math.max(0, Math.min(out.minY, out.maxY - 0.5));
  return out;
}

export function boxCorners(b: Aabb3): V[] {
  const out: V[] = [];
  for (const x of [b.minX, b.maxX]) for (const y of [b.minY, b.maxY]) for (const z of [b.minZ, b.maxZ]) out.push([x, y, z]);
  return out;
}

/** Default 3/4 view per build family: slightly right of front, looking a little down. */
export function benchView(project: Pick<YardProject, "fitted" | "kind" | "flat">, box: Aabb3): BenchView {
  const odd = project.fitted?.unit?.odd?.kind;
  const corner =
    !!project.fitted?.unit?.corner || odd === "l-footprint" || odd === "corner-diagonal" || odd === "angled-corner" || odd === "outside-corner";
  const w = box.maxX - box.minX, h = box.maxY - box.minY, d = box.maxZ - box.minZ;
  if (project.flat && !project.flat.lifted) return { azimuthDeg: 30, elevationDeg: 52 };
  if (corner) return { azimuthDeg: 45, elevationDeg: 22 };
  if (project.kind === "eiffel") return { azimuthDeg: 38, elevationDeg: 12 };
  // Low wide things (tables, chests, benches) read best from higher up; tall units from lower.
  const low = h < Math.max(w, d) * 0.9;
  return { azimuthDeg: 32, elevationDeg: low ? 26 : 16 };
}

function basis(view: BenchView) {
  const az = (view.azimuthDeg * Math.PI) / 180;
  const el = (view.elevationDeg * Math.PI) / 180;
  const back: V = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  const x = norm(cross([0, 1, 0], back));
  const y = cross(back, x);
  return { back, x, y };
}

/** Free canvas rect after excluding each overlay by its cheapest side. */
export function safeRectFor(viewport: { w: number; h: number }, overlays: Rect[]): Rect {
  const W = viewport.w, H = viewport.h;
  const ins: Insets = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const r0 of overlays) {
    const r = { left: Math.max(0, r0.left), top: Math.max(0, r0.top), right: Math.min(W, r0.right), bottom: Math.min(H, r0.bottom) };
    if (r.right - r.left < 2 || r.bottom - r.top < 2) continue;
    const cost = [
      { side: "top" as const, px: r.bottom, frac: r.bottom / H },
      { side: "bottom" as const, px: H - r.top, frac: (H - r.top) / H },
      { side: "left" as const, px: r.right, frac: r.right / W },
      { side: "right" as const, px: W - r.left, frac: (W - r.left) / W },
    ].sort((a, b) => a.frac - b.frac)[0];
    ins[cost.side] = Math.max(ins[cost.side], cost.px);
  }
  // Never let overlays squeeze the model below 40% of the canvas in either direction.
  const capV = (ins.top + ins.bottom) - H * 0.6;
  if (capV > 0) { const k = (H * 0.6) / (ins.top + ins.bottom); ins.top *= k; ins.bottom *= k; }
  const capH = (ins.left + ins.right) - W * 0.6;
  if (capH > 0) { const k = (W * 0.6) / (ins.left + ins.right); ins.left *= k; ins.right *= k; }
  return { left: ins.left, top: ins.top, right: W - ins.right, bottom: H - ins.bottom };
}

/** Where each box corner lands in canvas px for a frame (for guards and the live check). */
export function projectCorners(frame: BenchFrame, viewport: { w: number; h: number }, box: Aabb3) {
  const pos = frame.position, tgt = frame.target;
  const back = norm(sub(pos, tgt));
  const x = norm(cross([0, 1, 0], back));
  const y = cross(back, x);
  const f = viewport.h / 2 / Math.tan(((frame.fovDeg / 2) * Math.PI) / 180);
  const cx = viewport.w / 2 - frame.viewOffset.x, cy = viewport.h / 2 - frame.viewOffset.y;
  return boxCorners(box).map((c) => {
    const v = sub(c, pos);
    const depth = -dot(v, back);
    return { x: cx + (f * dot(v, x)) / depth, y: cy - (f * dot(v, y)) / depth, depth };
  });
}

export function fitBench(opts: {
  box: Aabb3;
  view: BenchView;
  viewport: { w: number; h: number };
  overlays?: Rect[];
  safe?: Rect;
  fovDeg?: number;
  /** Only these corners must fit (a step's parts); the rest may run off. */
  focusBox?: Aabb3;
}): BenchFrame {
  const fovDeg = opts.fovDeg ?? BENCH_FOV;
  const { w: W, h: H } = opts.viewport;
  const safe = opts.safe ?? safeRectFor(opts.viewport, opts.overlays ?? []);
  const sw = Math.max(40, safe.right - safe.left), sh = Math.max(40, safe.bottom - safe.top);
  const margin = Math.max(22, Math.min(sw, sh) * 0.1);
  const f = H / 2 / Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const kx = Math.max(10, sw / 2 - margin) / f;
  const ky = Math.max(10, sh / 2 - margin) / f;
  const box = opts.focusBox ?? opts.box;
  const { back, x, y } = basis(opts.view);
  let tgt: V = [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2];
  const corners = boxCorners(box);
  let dist = 1;
  for (let it = 0; it < 4; it++) {
    // Exact distance: every corner satisfies |x|/depth ≤ kx and |y|/depth ≤ ky.
    dist = 0;
    for (const c of corners) {
      const v = sub(c, tgt);
      const xr = dot(v, x), yu = dot(v, y), zf = dot(v, back);
      dist = Math.max(dist, Math.abs(xr) / kx + zf, Math.abs(yu) / ky + zf, zf + 2);
    }
    // Re-centre: shift the target so the projected box sits in the middle of the free rect.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of corners) {
      const v = sub(c, tgt);
      const depth = dist - dot(v, back);
      const px = dot(v, x) / depth, py = dot(v, y) / depth;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    const mx = ((minX + maxX) / 2) * dist, my = ((minY + maxY) / 2) * dist;
    if (Math.abs(mx) + Math.abs(my) < 1e-3) break;
    tgt = [tgt[0] + x[0] * mx + y[0] * my, tgt[1] + x[1] * mx + y[1] * my, tgt[2] + x[2] * mx + y[2] * my];
  }
  const position: V = [tgt[0] + back[0] * dist, tgt[1] + back[1] * dist, tgt[2] + back[2] * dist];
  const scx = (safe.left + safe.right) / 2, scy = (safe.top + safe.bottom) / 2;
  return { position, target: tgt, viewOffset: { x: W / 2 - scx, y: H / 2 - scy }, distance: dist, safe, fovDeg };
}

/**
 * Representative UI overlays (canvas px) at the two widths we ship for. The prompt bar carries one
 * Options dropdown, so nothing sits on the bench top except the step card while stepping; the step
 * pill and the stock/size card sit at the bottom. Canvas heights are the window minus the header
 * and the one-row prompt bar. Used by the framing guard.
 */
export const BENCH_VIEWPORTS: { name: string; viewport: { w: number; h: number }; overlays: Rect[] }[] = [
  {
    name: "desktop 1280×800",
    viewport: { w: 1280, h: 675 },
    overlays: [
      { left: 384, top: 16, right: 896, bottom: 150 }, // step card (step view)
      { left: 16, top: 600, right: 390, bottom: 659 }, // stock + size card
      { left: 444, top: 549, right: 836, bottom: 595 }, // step pill
    ],
  },
  {
    name: "mobile 390×844",
    viewport: { w: 390, h: 735 },
    overlays: [
      { left: 12, top: 12, right: 378, bottom: 190 }, // step card (step view)
      { left: 16, top: 660, right: 374, bottom: 719 }, // stock + size card
      { left: 34, top: 596, right: 356, bottom: 659 }, // step pill
    ],
  },
];
