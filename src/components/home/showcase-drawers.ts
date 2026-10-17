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
/** What the loader sends per drawer: its parts, its box (model inches) and how far it opens. */
export type DrawerSpec = { ids: string[]; w: number; h: number; d: number; y: number; open: number };

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
    out.push({ ids: parts.map((p) => p.id), w: r(x1 - x0), h: r(y1 - y0), d: r(d), y: r(y0), open: r(open) });
  }
  // Top drawer first: the stagger runs down a stack.
  return out.sort((a, b) => b.y - a.y);
}

export type Drawer = { els: SVGGElement[]; at: (inches: number) => string; open: number; stack: number };

/** The drawn drawers of one card. `specs` come from the loader; parts not in the drawing are skipped. */
export function drawersIn(root: Element, specs: DrawerSpec[]): Drawer[] {
  const out: Drawer[] = [];
  const stackAt = new Map<string, number>();
  for (const s of specs) {
    const els = s.ids.flatMap((id) => [...root.querySelectorAll<SVGGElement>(`g[data-part="${CSS.escape(id)}"]`)]);
    if (!els.length) continue;
    let x0 = Infinity, x1 = -Infinity;
    for (const g of els) { const b = g.getBBox(); x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x + b.width); }
    // Drawn width of a w × h × d box in iso is (w + d)·cos30 inches.
    const scale = (x1 - x0) / ((s.w + s.d) * C30);
    if (!Number.isFinite(scale) || scale <= 0) continue;
    const column = String(Math.round(s.w)) + ":" + String(Math.round(s.d));
    const stack = stackAt.get(column) ?? 0;
    stackAt.set(column, stack + 1);
    const at = (t: number) => `translate(${(-C30 * scale * t).toFixed(2)}px, ${(0.5 * scale * t).toFixed(2)}px)`;
    out.push({ els, at, open: s.open, stack });
  }
  return out;
}

const STACK_MS = 70; // slight stagger down a stack (doors use 90 between leaves)

/**
 * Paint order. The overview paints each part once, in an order made for the shut model, so a fixed part listed
 * after a drawer (the pocket vanity's right knee divider) paints over it once it slides out. An open drawer sticks
 * out past the carcass face, so nothing fixed is in front of it: while a drawer is open its parts are painted last
 * (moved to the end of their parent, in their own order), and put back where they were once it is shut.
 */
const home = new WeakMap<SVGGElement, Comment>();
const raised = new Set<SVGGElement>();
export function raise(drawers: Drawer[]) {
  const fresh = drawers.flatMap((d) => d.els).filter((g) => !home.has(g) && g.parentNode);
  if (!fresh.length) return;
  for (const g of fresh) {
    const mark = document.createComment("drawer");
    g.parentNode!.insertBefore(mark, g);
    home.set(g, mark);
    raised.add(g);
  }
  // Every raised part, in the shut drawing's own order (by where each one came from), so drawers that open at
  // different moments still paint in the order the drawing chose for them (an upper drawer over a lower one).
  const parents = new Set(fresh.map((g) => g.parentNode!));
  const order = [...raised].filter((g) => g.isConnected && parents.has(g.parentNode!));
  order.sort((a, b) => (home.get(a)!.compareDocumentPosition(home.get(b)!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  for (const g of order) g.parentNode!.appendChild(g);
}
export function lower(drawers: Drawer[]) {
  for (const g of drawers.flatMap((d) => d.els)) {
    const mark = home.get(g);
    if (!mark) continue;
    home.delete(g);
    raised.delete(g);
    if (mark.parentNode) mark.replaceWith(g);
  }
}
export const isRaised = (g: SVGGElement) => home.has(g);

/** Calls `cb` once `anim` has played to `t` ms (waits while it is paused offscreen); never if it is cancelled. */
function whenAt(anim: Animation, t: number, cb: () => void) {
  const tick = () => {
    if (anim.playState === "idle") return;
    const now = Number(anim.currentTime ?? 0);
    if (now >= t || anim.playState === "finished") cb();
    else setTimeout(tick, Math.max(16, Math.min(250, t - now)));
  };
  tick();
}

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
    const mine: Animation[] = [];
    for (const g of dr.els) {
      g.getAnimations().forEach((a) => a.cancel());
      mine.push(g.animate(kf, { duration: kind === "once" ? ONCE_MS : kind === "open" ? OPEN_MS : CLOSE_MS, delay: start, easing: "linear", fill: kind === "open" ? "forwards" : "none" }));
    }
    // Painted last from the moment it moves; put back once it is shut (not if a hover cancels the close).
    if (kind !== "close") whenAt(mine[0], start, () => raise([dr]));
    if (kind !== "open") mine[0].finished.then(() => lower([dr]), () => {});
    all.push(...mine);
  });
  return all;
}

/** Reduced motion: no slide, just open or shut at once. */
export function setOpen(drawers: Drawer[], open: boolean) {
  for (const dr of drawers) for (const g of dr.els) {
    g.getAnimations().forEach((a) => a.cancel());
    g.style.transform = open ? dr.at(dr.open) : "";
  }
  if (open) raise(drawers);
  else lower(drawers);
}
