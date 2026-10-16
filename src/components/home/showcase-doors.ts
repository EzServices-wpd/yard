/**
 * Home sample cards: doors and lids swing open on their hinge once after the cards' entrance, and
 * ease open on hover. Reads the Operate hooks the engine puts on the overview SVG: every part is a
 * <g data-part>; doors/lids add data-role, data-hinge-edge and data-hinge-axis (two points in model
 * inches).
 *
 * The overview is an isometric drawing, and an iso projection is linear, so a flat leaf rotated in
 * 3D about its hinge is still an exact 2D affine map of the drawn leaf. For a swing angle θ we take
 * the leaf's width direction w (perpendicular to the hinge, in its plane) and map its drawn
 * direction P(w) to P(w·cosθ + n·sinθ), keeping the hinge direction P(a) fixed and the hinge line
 * pinned. That is the real foreshortened, sheared swing toward the viewer, not a flat squash.
 * Transform only, via WAAPI so it can pause.
 */
const C30 = Math.cos(Math.PI / 6);
type V3 = [number, number, number];
const P = (v: V3) => [(v[0] - v[2]) * C30, -v[1] + (v[0] + v[2]) * 0.5] as const;
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export type Leaf = { els: SVGGElement[]; at: (deg: number) => string; max: number };

function leafOf(els: SVGGElement[], edge: string, axis: string, role: string): Leaf | null {
  const pts = axis.trim().split(/\s+/).map((p) => p.split(",").map(Number));
  if (pts.length !== 2 || pts.some((p) => p.length !== 3 || p.some((n) => !Number.isFinite(n)))) return null;
  let a: V3 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
  const al = Math.hypot(...a);
  if (al < 1e-6) return null;
  a = a.map((x) => x / al) as V3;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const g of els) {
    const r = g.getBBox();
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.width); y1 = Math.max(y1, r.y + r.height);
  }
  if (!Number.isFinite(x0) || x1 - x0 < 1) return null;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const e = edge.toLowerCase();
  // A point on the drawn hinge line: the bbox edge on the hinge side (exact for upright doors).
  const h = e === "left" ? { x: x0, y: cy } : e === "right" ? { x: x1, y: cy } : e === "bottom" || e === "front" ? { x: cx, y: y1 } : { x: cx, y: y0 };
  const toC = { x: cx - h.x, y: cy - h.y };
  // Width direction: the model axis perpendicular to the hinge whose drawing points from hinge to leaf.
  let w: V3 | null = null, best = -Infinity;
  for (const c of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1]] as V3[]) {
    if (Math.abs(dot(c, a)) > 0.3) continue;
    const [px, py] = P(c);
    const s = (px * toC.x + py * toC.y) / (Math.hypot(px, py) * Math.hypot(toC.x, toC.y) + 1e-9);
    if (s > best) { best = s; w = c; }
  }
  if (!w) return null;
  // Swing toward the viewer (doors) or upward (lids).
  let n = cross(a, w);
  if ((role === "lid" ? n[1] : n[0] + n[1] + n[2]) < 0) n = n.map((x) => -x) as V3;
  const [pax, pay] = P(a), [pwx, pwy] = P(w);
  const det = pwx * pay - pax * pwy;
  if (Math.abs(det) < 1e-6) return null;
  const at = (deg: number) => {
    const t = (deg * Math.PI) / 180;
    const [qx, qy] = P([w![0] * Math.cos(t) + n[0] * Math.sin(t), w![1] * Math.cos(t) + n[1] * Math.sin(t), w![2] * Math.cos(t) + n[2] * Math.sin(t)]);
    // M·[P(w) P(a)] = [P(w') P(a)]  →  M = [P(w') P(a)]·[P(w) P(a)]⁻¹
    const ia = pay / det, ib = -pax / det, ic = -pwy / det, id = pwx / det;
    const m11 = qx * ia + pax * ic, m12 = qx * ib + pax * id, m21 = qy * ia + pay * ic, m22 = qy * ib + pay * id;
    const tx = h.x - (m11 * h.x + m12 * h.y), ty = h.y - (m21 * h.x + m22 * h.y);
    return `matrix(${m11.toFixed(4)}, ${m21.toFixed(4)}, ${m12.toFixed(4)}, ${m22.toFixed(4)}, ${tx.toFixed(2)}, ${ty.toFixed(2)})`;
  };
  return { els, at, max: role === "lid" ? 58 : 68 };
}

export function leavesIn(root: Element): Leaf[] {
  const out: Leaf[] = [];
  const seen = new Set<string>();
  root.querySelectorAll<SVGGElement>("g[data-part][data-hinge-axis]").forEach((g) => {
    const id = g.getAttribute("data-part")!;
    if (seen.has(id)) return;
    seen.add(id);
    const els = [...root.querySelectorAll<SVGGElement>(`g[data-part="${CSS.escape(id)}"]`)];
    const l = leafOf(els, g.getAttribute("data-hinge-edge") ?? "", g.getAttribute("data-hinge-axis") ?? "", g.getAttribute("data-role") ?? "door");
    if (l) out.push(l);
  });
  return out;
}

// Angle curves sampled into keyframes (matrices only interpolate well between close angles).
// Open: ease-out swing that overshoots ~6% and settles. Close: ease-in-out with a tiny bump shut.
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const openCurve = (t: number) => (t < 0.72 ? 1.06 * easeOut(t / 0.72) : 1.06 - 0.06 * easeOut((t - 0.72) / 0.28));
const closeCurve = (t: number) => (t < 0.85 ? 1 - (t / 0.85) ** 2 * (3 - 2 * (t / 0.85)) * 1.015 : -0.015 * (1 - (t - 0.85) / 0.15));

function frames(l: Leaf, f: (t: number) => number, from = 0, to = 1, n = 20) {
  return Array.from({ length: n + 1 }, (_, i) => ({ transform: l.at(l.max * (from + (to - from) * f(i / n))), offset: i / n }));
}

/** "once": swing open, hold, swing shut. "open"/"close" are the hover pair (open holds). */
export function swing(leaves: Leaf[], kind: "once" | "open" | "close", delay = 0): Animation[] {
  const all: Animation[] = [];
  leaves.forEach((l, j) => {
    const stagger = j * 90;
    const kf =
      kind === "close"
        ? frames(l, closeCurve)
        : kind === "open"
          ? frames(l, openCurve)
          : [...frames(l, openCurve).map((k) => ({ ...k, offset: k.offset * 0.4 })), ...frames(l, closeCurve).map((k) => ({ ...k, offset: 0.6 + k.offset * 0.4 }))];
    for (const g of l.els) {
      g.getAnimations().forEach((a) => a.cancel());
      all.push(g.animate(kf, { duration: kind === "once" ? 3000 : kind === "open" ? 900 : 700, delay: delay + stagger, easing: "linear", fill: kind === "open" ? "forwards" : "none" }));
    }
  });
  return all;
}
