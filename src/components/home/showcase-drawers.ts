/**
 * Home sample cards: drawers slide open the way the doors swing (showcase-doors): once after the cards' entrance, and
 * on hover. A drawer is a group (today's solid box plus its front; SWE's coming hollow box: front, two sides, back and
 * bottom), and the whole group slides along the drawer's depth (+z, toward the viewer). Each part's drawing is moved as
 * is (one translate per group), so no part's geometry is touched.
 *
 * The overview is an isometric drawing and an iso projection is linear, so a slide of t inches along +z is the 2D
 * translate t·s·P(0,0,1), where s is the drawing's inches → SVG units scale, read from the group's own drawn box.
 * Open distance: about 2/3 of the drawer's depth, clamped so at least an inch stays in the carcass. Transform only,
 * via WAAPI so it pauses with the grid; reduced motion: an instant toggle.
 */
import { CLOSE_MS, ONCE_MS, OPEN_MS, closeCurve, openCurve } from "./showcase-doors";

const C30 = Math.cos(Math.PI / 6);

type Part = { id: string; type: string; name: string; position: { x: number; y: number; z: number }; size: { width: number; height: number; depth: number }; yaw?: number };
/**
 * What the loader sends per drawer: its parts, its box (model inches), how far it opens, each part's box
 * ([x0, y0, z0, x1, y1, z1], same order as ids) and `cut`: the case face plane z the open drawer is split at.
 */
export type DrawerSpec = { ids: string[]; w: number; h: number; d: number; y: number; open: number; boxes: number[][]; cut: number };
type B6 = number[];
const box6 = (p: Part): B6 => [p.position.x, p.position.y, p.position.z, p.position.x + p.size.width, p.position.y + p.size.height, p.position.z + p.size.depth];

/**
 * The case face an open drawer is split at. In the overview the viewer sits at +(1,1,1), so a fixed box F hides a
 * drawer point b only if b + s(1,1,1) enters F for some s > 0. Over the drawer's x/y span, the nearest such b has
 * z = F.z1 − s_min, s_min = max(0, F.x0 − x1, F.y0 − y1) (if the ray reaches F's x and y at all). The cut is the
 * frontmost of those over every fixed part (a desk top overhanging the fronts pushes it out), and never behind the
 * drawer box's own front (its case face). Everything of the open drawer nearer than the cut is in front of every
 * fixed part, so it is drawn last; the rest keeps the drawing's order.
 */
export function cutPlane(drawer: B6[], frontIdx: Set<number>, fixed: B6[], open: number): number {
  const lo = (a: number) => Math.min(...drawer.map((b) => b[a])), hi = (a: number) => Math.max(...drawer.map((b) => b[a]));
  const [x0, y0, x1, y1, z1] = [lo(0), lo(1), hi(3), hi(4), hi(5)];
  const body = drawer.filter((_, i) => !frontIdx.has(i));
  let cut = body.length ? Math.max(...body.map((b) => b[5])) : z1;
  const E = 1e-3;
  for (const F of fixed) {
    const s = Math.max(0, F[0] - x1, F[1] - y1);
    if (s >= F[3] - x0 - E || s >= F[4] - y0 - E) continue; // the ray never reaches F's x or y span
    cut = Math.max(cut, F[5] - s);
  }
  return Math.min(cut, z1 + open);
}
const FRONT_WORDS = /\b(?:front|face|pull|knob)\b/i;

// Words that name a part of a drawer, not the drawer: "Left drawer front 1", "Drawer 2 left side", "Drawer 1 bottom".
const PART_WORDS = /\s+(?:(?:left|right)\s+side|false\s+front|front|sides?|back|bottom|box|face|pull|knob)\b/gi;
// Carcass parts that carry the word but never move: rails, runners, slides, dividers, webs, guides.
const FIXED = /\b(?:rails?|runners?|slides?|dividers?|webs?|guides?|kickers?|stretchers?|frames?|openings?)\b/i;

export function drawerKey(name: string): string | null {
  const n = name.toLowerCase().replace(/\s+/g, " ").trim();
  if (!/\bdrawers?\b/.test(n) || FIXED.test(n)) return null;
  return (" " + n).replace(PART_WORDS, "").replace(/\s+/g, " ").trim();
}

/** Group the drawer parts (solid or hollow) and size each slide. Turned parts never slide (as on the bench). */
export function drawerSpecs(panels: Part[]): DrawerSpec[] {
  const groups = new Map<string, Part[]>();
  for (const p of panels) {
    if (p.yaw) continue;
    const k = drawerKey(p.name);
    if (k) groups.set(k, [...(groups.get(k) ?? []), p]);
  }
  const out: DrawerSpec[] = [];
  for (const parts of groups.values()) {
    // A drawer: a solid drawer box, or a built box (3+ parts). A lone front with nothing behind it does not slide.
    if (!parts.some((p) => p.type === "drawer") && parts.length < 3) continue;
    const x0 = Math.min(...parts.map((p) => p.position.x)), x1 = Math.max(...parts.map((p) => p.position.x + p.size.width));
    const y0 = Math.min(...parts.map((p) => p.position.y)), y1 = Math.max(...parts.map((p) => p.position.y + p.size.height));
    const z0 = Math.min(...parts.map((p) => p.position.z)), z1 = Math.max(...parts.map((p) => p.position.z + p.size.depth));
    const d = z1 - z0;
    if (d < 3) continue;
    const open = Math.max(0, Math.min((2 / 3) * d, d - 1));
    const r = (n: number) => Math.round(n * 1000) / 1000;
    out.push({ ids: parts.map((p) => p.id), w: r(x1 - x0), h: r(y1 - y0), d: r(d), y: r(y0), open: r(open), boxes: parts.map((p) => box6(p).map(r)), cut: 0 });
  }
  // Fixed: everything that never slides (other drawers are split and drawn last in their own order).
  const moving = new Set(out.flatMap((s) => s.ids));
  const fixed = panels.filter((p) => !moving.has(p.id)).map(box6);
  for (const s of out) {
    const fronts = new Set(s.ids.flatMap((id, i) => (FRONT_WORDS.test(panels.find((p) => p.id === id)?.name ?? "") ? [i] : [])));
    s.cut = Math.round(cutPlane(s.boxes, fronts, fixed, s.open) * 1000) / 1000;
  }
  // Top drawer first: the stagger runs down a stack.
  return out.sort((a, b) => b.y - a.y);
}

/** A drawer as drawn: its parts, the 2D slide, and the three clip outlines (SVG units, the parts' own space). */
export type Drawer = { els: SVGGElement[]; at: (inches: number) => string; open: number; stack: number; clips?: { inside: string; near: string; front: string } };

type Pt = [number, number];
/** Convex hull (monotone chain) of 2D points, as an SVG points string. */
export function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: Pt[]) => { const h: Pt[] = []; for (const q of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
  return [...half(p), ...half([...p].reverse())];
}
/**
 * The drawn outline of the drawer's x/y span swept along z from za to zb: the hull of that rectangle at za and at zb.
 * `proj` maps model inches to SVG units. Two sweeps of one convex outline along one direction meet in exactly the
 * sweep of the overlap, so a static sweep [cut, ∞) intersected with one that rides along with the drawer
 * (−∞, front] is the drawer's part beyond the cut at every moment of the slide.
 */
export function sweep(proj: (x: number, y: number, z: number) => Pt, x0: number, x1: number, y0: number, y1: number, za: number, zb: number): string {
  const pts: Pt[] = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [za, zb]) pts.push(proj(x, y, z));
  return hull(pts).map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

/** The drawn drawers of one card. `specs` come from the loader; parts not in the drawing are skipped. */
export function drawersIn(root: Element, specs: DrawerSpec[]): Drawer[] {
  const out: Drawer[] = [];
  const stackAt = new Map<string, number>();
  for (const s of specs) {
    const found = s.ids.map((id) => [...root.querySelectorAll<SVGGElement>(`g[data-part="${CSS.escape(id)}"]`)]);
    const els = found.flat();
    if (!els.length) continue;
    // The drawing's projection, read off the widest drawn part: X = ox + k·(x − z)·cos30, Y = oy + k·(−y + (x + z)/2).
    let best: { k: number; ox: number; oy: number; w: number } | null = null;
    found.forEach((gs, i) => {
      const bx = s.boxes?.[i];
      if (!gs.length || !bx) return;
      const b = gs[0].getBBox();
      const k = b.width / ((bx[3] - bx[0] + bx[5] - bx[2]) * C30);
      if (!Number.isFinite(k) || k <= 0 || (best && b.width <= best.w)) return;
      best = { k, ox: b.x - k * (bx[0] - bx[5]) * C30, oy: b.y - k * (-bx[4] + (bx[0] + bx[2]) / 2), w: b.width };
    });
    if (!best) continue;
    const { k: scale, ox, oy } = best as { k: number; ox: number; oy: number };
    const column = String(Math.round(s.w)) + ":" + String(Math.round(s.d));
    const stack = stackAt.get(column) ?? 0;
    stackAt.set(column, stack + 1);
    const at = (t: number) => `translate(${(-C30 * scale * t).toFixed(2)}px, ${(0.5 * scale * t).toFixed(2)}px)`;
    const proj = (x: number, y: number, z: number): Pt => [ox + scale * (x - z) * C30, oy + scale * (-y + (x + z) / 2)];
    const lo = (a: number) => Math.min(...s.boxes.map((b) => b[a])), hi = (a: number) => Math.max(...s.boxes.map((b) => b[a]));
    // Padded a little past the drawer's x/y span so edge strokes are never shaved; the seam overlaps by a hair.
    const P = 0.5, far = s.d + s.open + 12;
    const [x0, y0, z0, x1, y1, z1] = [lo(0) - P, lo(1) - P, lo(2), hi(3) + P, hi(4) + P, hi(5)];
    const clips = s.cut < z1 + s.open
      ? { inside: sweep(proj, x0, x1, y0, y1, z0 - far, s.cut + 0.02), near: sweep(proj, x0, x1, y0, y1, s.cut, s.cut + far), front: sweep(proj, x0, x1, y0, y1, z0 - far, z1 + P) }
      : undefined;
    out.push({ els, at, open: s.open, stack, clips });
  }
  return out;
}

const STACK_MS = 70; // slight stagger down a stack (doors use 90 between leaves)

/**
 * Paint order. The overview paints each part once, in an order made for the shut model. An open drawer is split at
 * its cut (the case face, see cutPlane): the part still inside stays where the drawing put it, clipped to the
 * inside; a copy of the drawer, clipped to what is beyond the cut, is painted after everything else (drawers in the
 * drawing's own order between them). The copy rides the same slide as the drawer. Shut, the split is undone.
 * Clip outlines are fixed shapes made once per split; only transforms move.
 */
const NS = "http://www.w3.org/2000/svg";
type Split = { wraps: SVGGElement[]; near: SVGGElement; copies: SVGGElement[]; defs: Element[] };
const splits = new Map<Drawer, Split>();
let clipN = 0;
const el = (name: string, attrs: Record<string, string>) => {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
function clipDef(svg: Element, points: string): [Element, string] {
  const id = `yard-drawer-clip-${++clipN}`;
  const c = el("clipPath", { id, clipPathUnits: "userSpaceOnUse" });
  c.appendChild(el("polygon", { points }));
  let defs = svg.querySelector(":scope > defs[data-drawer-clips]");
  if (!defs) defs = svg.insertBefore(el("defs", { "data-drawer-clips": "" }), svg.firstChild);
  defs.appendChild(c);
  return [c, `url(#${id})`];
}
export function split(drawers: Drawer[]) {
  for (const dr of drawers) {
    if (splits.has(dr) || !dr.clips) continue;
    const parent = dr.els[0]?.parentNode as Element | null;
    const svg = dr.els[0]?.ownerSVGElement;
    if (!parent || !svg || dr.els.some((g) => g.parentNode !== parent)) continue;
    const [cIn, uIn] = clipDef(svg, dr.clips.inside), [cNear, uNear] = clipDef(svg, dr.clips.near), [cFront, uFront] = clipDef(svg, dr.clips.front);
    // Inside: each part stays in its place, wrapped in a still group clipped to the inside of the case.
    const wraps = dr.els.map((g) => {
      const w = el("g", { "clip-path": uIn, "data-drawer-inside": "" }) as SVGGElement;
      parent.insertBefore(w, g);
      w.appendChild(g);
      return w;
    });
    // Beyond the cut: a still group clipped to [cut, ∞) holding copies clipped to (−∞, front] that slide along.
    const near = el("g", { "clip-path": uNear, "data-drawer-near": "", "aria-hidden": "true" }) as SVGGElement;
    const copies = dr.els.map((g) => {
      const c = g.cloneNode(true) as SVGGElement;
      for (const n of [c, ...c.querySelectorAll("[id]")]) n.removeAttribute("id");
      c.setAttribute("clip-path", uFront);
      c.setAttribute("data-drawer-copy", "");
      c.style.transform = g.style.transform;
      near.appendChild(c);
      return c;
    });
    parent.appendChild(near);
    splits.set(dr, { wraps, near, copies, defs: [cIn, cNear, cFront] });
    // Copies of several drawers: in the drawing's own order (an upper drawer over a lower one).
    const nears = [...splits.entries()].filter(([, s]) => s.near.parentNode === parent);
    nears.sort(([, a], [, b]) => (a.wraps[0].compareDocumentPosition(b.wraps[0]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    for (const [, s] of nears) parent.appendChild(s.near);
  }
}
export function unsplit(drawers: Drawer[]) {
  for (const dr of drawers) {
    const s = splits.get(dr);
    if (!s) continue;
    splits.delete(dr);
    s.near.remove();
    s.wraps.forEach((w, i) => w.replaceWith(dr.els[i]));
    for (const d of s.defs) d.remove();
  }
}
export const isSplit = (dr: Drawer) => splits.has(dr);
/** Everything that moves with a drawer: its parts and, while split, their copies. */
const movers = (dr: Drawer) => [...dr.els, ...(splits.get(dr)?.copies ?? [])];

function frames(dr: Drawer, f: (t: number) => number, n = 20) {
  return Array.from({ length: n + 1 }, (_, i) => ({ transform: dr.at(dr.open * f(i / n)), offset: i / n }));
}

/** Same timing and curves as the doors: "once" slides open, holds, slides shut; "open"/"close" are the hover pair. */
export function slide(drawers: Drawer[], kind: "once" | "open" | "close", delay = 0): Animation[] {
  const all: Animation[] = [];
  drawers.forEach((dr, j) => {
    const kf =
      kind === "close"
        ? frames(dr, closeCurve)
        : kind === "open"
          ? frames(dr, openCurve)
          : [...frames(dr, openCurve).map((k) => ({ ...k, offset: k.offset * 0.4 })), ...frames(dr, closeCurve).map((k) => ({ ...k, offset: 0.6 + k.offset * 0.4 }))];
    const start = delay + j * STACK_MS;
    // Split before it moves (shut, the copy shows only what is already beyond the cut); joined again once shut
    // (not if a hover cancels the close).
    if (kind !== "close") split([dr]);
    const mine: Animation[] = [];
    for (const g of movers(dr)) {
      g.getAnimations().forEach((a) => a.cancel());
      mine.push(g.animate(kf, { duration: kind === "once" ? ONCE_MS : kind === "open" ? OPEN_MS : CLOSE_MS, delay: start, easing: "linear", fill: kind === "open" ? "forwards" : "none" }));
    }
    if (kind !== "open" && mine.length) mine[0].finished.then(() => unsplit([dr]), () => {});
    all.push(...mine);
  });
  return all;
}

/** Reduced motion: no slide, just open or shut at once. */
export function setOpen(drawers: Drawer[], open: boolean) {
  if (open) split(drawers);
  for (const dr of drawers) for (const g of movers(dr)) {
    g.getAnimations().forEach((a) => a.cancel());
    g.style.transform = open ? dr.at(dr.open) : "";
  }
  if (!open) unsplit(drawers);
}
