/**
 * Home sample cards: doors and lids open once after the cards' turn-in, and ease open on hover.
 * Reads the Operate hooks the engine puts on the overview SVG: every part is a <g data-part>,
 * doors/lids add data-role, data-hinge-edge and data-hinge-axis (two points in model inches).
 * The axis is projected with the overview's iso camera for its direction, anchored on the leaf's
 * drawn hinge edge, and the leaf folds toward that line (a squash perpendicular to the axis),
 * which reads as a swing in the iso drawing. Transform only, via WAAPI so it can pause.
 */
const C30 = Math.cos(Math.PI / 6);
const iso = (x: number, y: number, z: number) => ({ x: (x - z) * C30, y: -y + (x + z) * 0.5 });

export type Leaf = { els: SVGGElement[]; open: string };

function leafMatrix(els: SVGGElement[], edge: string, axis: string, role: string): string | null {
  const pts = axis.trim().split(/\s+/).map((p) => p.split(",").map(Number));
  if (pts.length !== 2 || pts.some((p) => p.length !== 3 || p.some((n) => !Number.isFinite(n)))) return null;
  const a = iso(pts[0][0], pts[0][1], pts[0][2]);
  const b = iso(pts[1][0], pts[1][1], pts[1][2]);
  let dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  dx /= len; dy /= len;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const g of els) {
    const r = g.getBBox();
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.width); y1 = Math.max(y1, r.y + r.height);
  }
  if (!Number.isFinite(x0) || x1 - x0 < 1) return null;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const e = edge.toLowerCase();
  const p = e === "left" ? { x: x0, y: cy } : e === "right" ? { x: x1, y: cy } : e === "bottom" || e === "front" ? { x: cx, y: y1 } : { x: cx, y: y0 };
  // Squash by k across the axis (n = screen normal of the axis), about the hinge line through p.
  const k = role === "lid" ? 0.45 : 0.38;
  const nx = -dy, ny = dx, s = k - 1;
  const m11 = 1 + s * nx * nx, m12 = s * nx * ny, m22 = 1 + s * ny * ny;
  const tx = p.x - (m11 * p.x + m12 * p.y);
  const ty = p.y - (m12 * p.x + m22 * p.y) + (role === "lid" ? -(y1 - y0) * 0.08 : 0);
  return `matrix(${m11.toFixed(4)}, ${m12.toFixed(4)}, ${m12.toFixed(4)}, ${m22.toFixed(4)}, ${tx.toFixed(2)}, ${ty.toFixed(2)})`;
}

export function leavesIn(root: Element): Leaf[] {
  const out: Leaf[] = [];
  const seen = new Set<string>();
  root.querySelectorAll<SVGGElement>("g[data-part][data-hinge-axis]").forEach((g) => {
    const id = g.getAttribute("data-part")!;
    if (seen.has(id)) return;
    seen.add(id);
    const els = [...root.querySelectorAll<SVGGElement>(`g[data-part="${CSS.escape(id)}"]`)];
    const m = leafMatrix(els, g.getAttribute("data-hinge-edge") ?? "", g.getAttribute("data-hinge-axis") ?? "", g.getAttribute("data-role") ?? "door");
    if (m) out.push({ els, open: m });
  });
  return out;
}

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Animate every <g> of every leaf. "once" opens, holds, and closes; open/close are for hover. */
export function swing(leaves: Leaf[], kind: "once" | "open" | "close", delay = 0): Animation[] {
  const all: Animation[] = [];
  for (const l of leaves) {
    for (const g of l.els) {
      g.getAnimations().forEach((a) => a.cancel());
      const kf =
        kind === "once"
          ? [{ transform: "none", offset: 0 }, { transform: l.open, offset: 0.35 }, { transform: l.open, offset: 0.62 }, { transform: "none", offset: 1 }]
          : kind === "open"
            ? [{ transform: "none" }, { transform: l.open }]
            : [{ transform: l.open }, { transform: "none" }];
      all.push(g.animate(kf, { duration: kind === "once" ? 2800 : 650, delay, easing: kind === "once" ? "ease-in-out" : EASE, fill: kind === "open" ? "forwards" : "none" }));
    }
  }
  return all;
}
