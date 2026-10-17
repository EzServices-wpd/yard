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
 */
import { drawerKey } from "@/components/home/showcase-drawers";

type Part = { id: string; type: string; name: string; position: { x: number; y: number; z: number }; size: { width: number; height: number; depth: number }; yaw?: number; drawerId?: unknown };
export type DrawerGroup = { by: "drawer-id" | "front"; ids: string[]; depth: number; pull: number; /** The group's outer face (max z), where its pull is drawn. */ face: number };

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
  return { by, ids: parts.map((p) => p.id), depth, pull: r3(groupPull(depth)), face: r3(face) };
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
/**
 * How far this part slides when its drawer is open on the bench: its group's pull, today's pull for a lone drawer
 * box (3), or null for a part that never slides.
 */
export function benchDrawerPull(panels: readonly Part[], panel: Part): number | null {
  const g = groupOf(panels, panel.id);
  if (g) return g.pull;
  return panel.type === "drawer" && !panel.yaw ? legacyPull(panel.size.depth) : null;
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
