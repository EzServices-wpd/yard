/**
 * Operate on the bench: which parts slide out together as one drawer, and how far.
 *
 * 1. A shared drawer id on the part (`drawerId`, coming with SWE's hollow 5-part drawers): every part with the same id
 *    is one drawer.
 * 2. Until then: an existing drawer front ("Left drawer front 1") plus the parts under it, i.e. the parts of the same
 *    drawer by name, or drawer parts that sit inside the front's outline and behind it (today's solid box).
 * 3. No group: today's behaviour. A lone drawer box pulls by its own depth (8 to 16 in) and nothing else moves.
 *
 * A group slides along +z by about 2/3 of its depth, clamped so at least an inch stays in the carcass, the same rule
 * as the home cards (showcase-drawers). Turned parts never slide. Read-only: no part's geometry is changed.
 *
 * Seeing into the drawers (Critic #84: a dresser's drawers all opened the same ~2/3 showed only fronts, each box
 * hidden under the one above):
 * - Up to 3 stacked drawers stagger: in each column the bottom drawer opens the full ~2/3 and each one above opens
 *   one step less (open = pull × (n − k) / n, k = 0 at the bottom), so every drawer's inside shows past the one above.
 * - Taller stacks (4+) would leave steps under ~3": every other drawer opens fully from the bottom (k even) and the
 *   ones between stay shut, so each open drawer shows its whole pulled-out box under a shut one.
 * - Tap a drawer: it opens alone to the full ~2/3 and every other drawer stays shut, so its whole cavity shows.
 */
import { drawerKey } from "@/components/home/showcase-drawers";

type Part = { id: string; type: string; name: string; position: { x: number; y: number; z: number }; size: { width: number; height: number; depth: number }; yaw?: number; drawerId?: unknown };
export type DrawerGroup = {
  by: "drawer-id" | "front"; ids: string[]; depth: number;
  /** Full pull (~2/3 depth, ≥ 1" left in): a drawer opened alone. */
  pull: number;
  /** Staggered pull when every drawer is open: the bottom of a column opens fully, each one above one step less. */
  open: number;
  /** Stack index in its column (0 = bottom) and the column's drawer count. */
  k: number; n: number;
  /** The group's outer face (max z), where its pull is drawn. */ face: number;
  /** Outline (for columns and stacking). */ x0: number; x1: number; y0: number; y1: number;
};

const FIXED = /\b(?:rails?|runners?|slides?|dividers?|webs?|guides?|kickers?|stretchers?|frames?|openings?)\b/i;
const FRONT = /\bfront\b/i;
const EPS = 0.5;

/** Today's per-part pull for a lone drawer box. */
export const legacyPull = (depth: number) => Math.max(8, Math.min(depth * 0.75, 16));
/** A group's pull: about 2/3 of its depth, at least an inch left in. */
export const groupPull = (depth: number) => Math.max(0, Math.min((2 / 3) * depth, depth - 1));

const idOf = (p: Part) => (typeof p.drawerId === "string" && p.drawerId.trim() ? p.drawerId.trim() : null);
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function group(by: DrawerGroup["by"], parts: Part[]): DrawerGroup {
  const z0 = Math.min(...parts.map((p) => p.position.z)), z1 = Math.max(...parts.map((p) => p.position.z + p.size.depth));
  const depth = r3(z1 - z0);
  // The face the pull sits on: the front's outer face when the drawer has a front, else the group's.
  const fronts = parts.filter((p) => FRONT.test(p.name));
  const face = fronts.length ? Math.max(...fronts.map((p) => p.position.z + p.size.depth)) : z1;
  const x0 = Math.min(...parts.map((p) => p.position.x)), x1 = Math.max(...parts.map((p) => p.position.x + p.size.width));
  const y0 = Math.min(...parts.map((p) => p.position.y)), y1 = Math.max(...parts.map((p) => p.position.y + p.size.height));
  const pull = r3(groupPull(depth));
  return { by, ids: parts.map((p) => p.id), depth, pull, open: pull, k: 0, n: 1, face: r3(face), x0, x1, y0, y1 };
}

/** Open pull for drawer k (0 = bottom) of n in a column when every drawer is open (see the header). */
export const staggerPull = (pull: number, k: number, n: number) =>
  n <= 1 ? pull : n <= 3 ? r3((pull * (n - k)) / n) : k % 2 === 0 ? pull : 0;

/** Columns by X overlap (more than half the narrower drawer); bottom drawer k = 0. */
function stack(groups: DrawerGroup[]) {
  const cols: DrawerGroup[][] = [];
  for (const g of groups) {
    const c = cols.find((c) => c.some((h) => Math.min(g.x1, h.x1) - Math.max(g.x0, h.x0) > 0.5 * Math.min(g.x1 - g.x0, h.x1 - h.x0)));
    if (c) c.push(g); else cols.push([g]);
  }
  for (const c of cols) {
    c.sort((a, b) => a.y0 - b.y0);
    c.forEach((g, k) => { g.k = k; g.n = c.length; g.open = staggerPull(g.pull, k, c.length); });
  }
}

/** True when `p` sits inside the front's face outline and behind (or at) the front. */
function under(front: Part, p: Part): boolean {
  const f = front.position, s = front.size;
  return p.position.x >= f.x - EPS && p.position.x + p.size.width <= f.x + s.width + EPS
    && p.position.y >= f.y - EPS && p.position.y + p.size.height <= f.y + s.height + EPS
    && p.position.z + p.size.depth <= f.z + s.depth + EPS && p !== front;
}

export function drawerGroups(panels: readonly Part[]): DrawerGroup[] {
  const out: DrawerGroup[] = [];
  const taken = new Set<string>();
  const movable = (p: Part) => !p.yaw && p.type !== "door" && !FIXED.test(p.name);
  // 1. Shared drawer id.
  const byId = new Map<string, Part[]>();
  for (const p of panels) { const id = idOf(p); if (id && movable(p)) byId.set(id, [...(byId.get(id) ?? []), p]); }
  for (const parts of byId.values()) { out.push(group("drawer-id", parts)); parts.forEach((p) => taken.add(p.id)); }
  // 2. A drawer front plus the parts under it.
  const free = panels.filter((p) => !taken.has(p.id) && !idOf(p) && movable(p));
  const fronts = free.filter((p) => FRONT.test(p.name) && drawerKey(p.name) != null);
  for (const front of fronts) {
    if (taken.has(front.id)) continue;
    const key = drawerKey(front.name);
    const parts = free.filter((p) => p !== front && !taken.has(p.id) && !fronts.includes(p)
      && (drawerKey(p.name) === key || ((p.type === "drawer" || drawerKey(p.name) != null) && under(front, p))));
    if (!parts.length) continue; // a lone front stays put, as today
    const all = [front, ...parts];
    out.push(group("front", all));
    all.forEach((p) => taken.add(p.id));
  }
  stack(out);
  return out;
}

const cache = new WeakMap<readonly Part[], Map<string, DrawerGroup>>();
function groupOf(panels: readonly Part[], id: string): DrawerGroup | undefined {
  let by = cache.get(panels);
  if (!by) {
    by = new Map();
    for (const g of drawerGroups(panels)) for (const m of g.ids) by.set(m, g);
    cache.set(panels, by);
  }
  return by.get(id);
}
/** The drawer group a part belongs to, if any (tap-to-open-alone reads it for the selected part). */
export const drawerGroupOf = (panels: readonly Part[], id: string | null | undefined) => (id ? groupOf(panels, id) : undefined);

/**
 * How far this part slides when its drawer is open on the bench: its group's staggered pull (every drawer open),
 * or, when a drawer is tapped (`solo` = the selected part's id), the full pull for that drawer and 0 (shut) for
 * every other; today's pull for a lone drawer box (3); or null for a part that never slides.
 */
export function benchDrawerPull(panels: readonly Part[], panel: Part, solo?: string | null): number | null {
  const g = groupOf(panels, panel.id);
  const s = drawerGroupOf(panels, solo);
  if (g) return s ? (s === g ? g.pull : 0) : g.open;
  if (panel.type === "drawer" && !panel.yaw) return s ? 0 : legacyPull(panel.size.depth);
  return null;
}

/** The furthest any drawer reaches past its face when open (cavity camera: frame the open drawers). */
export function maxOpenPull(panels: readonly Part[], solo?: string | null): number {
  const s = drawerGroupOf(panels, solo);
  if (s) return s.pull;
  return Math.max(0, ...drawerGroups(panels).map((g) => g.open));
}

/**
 * Where a drawer box draws its pull, as a depth from the box's centre to the face: the outer face of its group's
 * front when it has one (so the pull isn't buried in the front), else its own face (today).
 */
export function benchPullDepth(panels: readonly Part[], panel: Part): number {
  const g = groupOf(panels, panel.id);
  const own = panel.size.depth;
  if (!g) return own;
  const toFace = g.face - (panel.position.z + own / 2);
  return Math.max(own, Math.round(toFace * 2 * 1000) / 1000);
}

/**
 * Which part of a drawer wears its pull: the drawer front when the group has one (hollow #94 drawers: one pull on
 * the front, never one per side, back and bottom), else the first box part of the group (drawn out on the face, see
 * benchPullDepth); a lone drawer box wears its own. Critic #94: filing drawer fronts had no pulls.
 */
export function benchWearsPull(panels: readonly Part[], panel: Part): boolean {
  const g = groupOf(panels, panel.id);
  if (!g) return panel.type === "drawer";
  const members = panels.filter((p) => g.ids.includes(p.id));
  const front = members.find((p) => (p as { drawerPart?: unknown }).drawerPart === "front") ?? members.find((p) => FRONT.test(p.name));
  if (front) return front.id === panel.id;
  return members.find((p) => p.type === "drawer")?.id === panel.id;
}
