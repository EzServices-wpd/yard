/**
 * See inside, item 2: frame the exploded model. The same math as fitBench (src/lib/yard/benchFrame.ts, read
 * only here) — exact distance so every point sits inside the free rect with its margin, then re-centred — but
 * over the posed corners of every part instead of the corners of one axis-aligned box. An exploded model is
 * mostly air at its box corners; fitting the parts themselves lets the model fill the frame, and condition (d)
 * of every-piece-visible (every corner inside the free rect) still holds by construction.
 */
import { safeRectFor, type BenchFrame, type BenchView, type Rect } from "@/lib/yard/benchFrame";
import type { V3 } from "@/components/workspace/explode-layout";

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function fitPoints(opts: { points: V3[]; view: BenchView; viewport: { w: number; h: number }; overlays?: Rect[]; fovDeg: number }): BenchFrame {
  const { fovDeg, points } = opts;
  const { w: W, h: H } = opts.viewport;
  const safe = safeRectFor(opts.viewport, opts.overlays ?? []);
  const sw = Math.max(40, safe.right - safe.left), sh = Math.max(40, safe.bottom - safe.top);
  const margin = Math.max(22, Math.min(sw, sh) * 0.1);
  const f = H / 2 / Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const kx = Math.max(10, sw / 2 - margin) / f;
  const ky = Math.max(10, sh / 2 - margin) / f;
  const az = (opts.view.azimuthDeg * Math.PI) / 180, el = (opts.view.elevationDeg * Math.PI) / 180;
  const back: V3 = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
  const x = norm(cross([0, 1, 0], back));
  const y = cross(back, x);
  let lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) { lo = [Math.min(lo[0], p[0]), Math.min(lo[1], p[1]), Math.min(lo[2], p[2])]; hi = [Math.max(hi[0], p[0]), Math.max(hi[1], p[1]), Math.max(hi[2], p[2])]; }
  let tgt: V3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  let dist = 1;
  for (let it = 0; it < 6; it++) {
    dist = 0;
    for (const c of points) {
      const v = sub(c, tgt);
      const xr = dot(v, x), yu = dot(v, y), zf = dot(v, back);
      dist = Math.max(dist, Math.abs(xr) / kx + zf, Math.abs(yu) / ky + zf, zf + 2);
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const c of points) {
      const v = sub(c, tgt);
      const depth = dist - dot(v, back);
      const px = dot(v, x) / depth, py = dot(v, y) / depth;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    const mx = ((minX + maxX) / 2) * dist, my = ((minY + maxY) / 2) * dist;
    if (Math.abs(mx) + Math.abs(my) < 1e-3) break;
    tgt = [tgt[0] + x[0] * mx + y[0] * my, tgt[1] + x[1] * mx + y[1] * my, tgt[2] + x[2] * mx + y[2] * my];
  }
  // The re-centre moves points closer or further; one last exact distance at the final target.
  dist = 0;
  for (const c of points) {
    const v = sub(c, tgt);
    const xr = dot(v, x), yu = dot(v, y), zf = dot(v, back);
    dist = Math.max(dist, Math.abs(xr) / kx + zf, Math.abs(yu) / ky + zf, zf + 2);
  }
  const position: V3 = [tgt[0] + back[0] * dist, tgt[1] + back[1] * dist, tgt[2] + back[2] * dist];
  const scx = (safe.left + safe.right) / 2, scy = (safe.top + safe.bottom) / 2;
  return { position, target: tgt, viewOffset: { x: W / 2 - scx, y: H / 2 - scy }, distance: dist, safe, fovDeg };
}
