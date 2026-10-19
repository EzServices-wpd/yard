/**
 * See inside, item 1: the staged explode by unit (PLAN §2, Ezra approved 2026-10-17).
 *
 * Every part gets a ROLE from data the engine already emits, every role a MOVER with a fixed AXIS, and a
 * solver (explode-solver.ts) grows each mover's DISTANCE until every piece is really visible (EPV) or a cap
 * is hit. No hand-tuned offsets: every gap scales off g = max(1", 0.5 × case depth).
 *
 * Pure and renderer-free: positions in inches, the engine's own frame (panel.position = min corner).
 * Read-only on the engine: nothing here changes form, parts, price or Buy.
 */
import type { Panel } from "@/lib/yard/types";
import { doorHingesLeft } from "@/lib/yard/operateFaces";

export type Role =
  | "hardware" | "drawerBox" | "drawerFront" | "door" | "lid" | "shelf" | "top" | "back" | "bottom"
  | "sideL" | "sideR" | "divider" | "kick" | "inset" | "front" | "case";

export type V3 = [number, number, number];

export type ExplodePart = {
  id: string;
  name: string;
  type: string;
  role: Role;
  /** The unit it moves with: "case", "D:<drawer id>", "door:<id>", "lid:<id>", "shelf:<id>". */
  unit: string;
  /** Stepper group (PLAN §2.6): case, [zone] [bank] drawers, doors, shelves, hardware. */
  group: string;
  /** Tagged (hollow) drawers only: which piece of the drawer (drawerPartOf). */
  drawerPart?: "front" | "bottom" | "side" | "back" | "box";
  /** Hardware rides on this part. */
  host?: string;
  /** Min corner and size (inches), the engine's box. */
  x: number; y: number; z: number; w: number; h: number; d: number;
};

/** A rigid explode pose: rotate by `ang` about `axis` through `pivot` (world), then translate by `t`.
 * `lat` is the share of `t` that moves second (a drawer slides out, then its column steps sideways, so it
 * never passes through an upright or the top). `stage` is the role whose tween window it follows (hardware: its host's). */
export type Pose = { t: V3; rot?: { axis: V3; ang: number; pivot: V3 }; lat?: V3; stage?: Role; rotLate?: boolean };

export type Box3 = { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };

const HW = /hinge|pull|knob|caster|slide|handle|hasp|latch|catch/i;
const ov1 = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
const cxOf = (p: ExplodePart) => p.x + p.w / 2;
const cyOf = (p: ExplodePart) => p.y + p.h / 2;
const czOf = (p: ExplodePart) => p.z + p.d / 2;
const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

export function boxOf(parts: readonly ExplodePart[]): Box3 {
  const b: Box3 = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  for (const p of parts) {
    b.minX = Math.min(b.minX, p.x); b.maxX = Math.max(b.maxX, p.x + p.w);
    b.minY = Math.min(b.minY, p.y); b.maxY = Math.max(b.maxY, p.y + p.h);
    b.minZ = Math.min(b.minZ, p.z); b.maxZ = Math.max(b.maxZ, p.z + p.d);
  }
  return b;
}

/**
 * Drawer membership: the ONE place that decides which drawer a part belongs to.
 *
 * Hollow 5-part drawers (#94: front, 2 sides, back, 1/4" ply bottom, open top) carry a shared `drawerId`
 * and a `drawerPart`. A solid (untagged) drawer is its own drawer and a "drawer front" joins the box it
 * overlaps most (classify).
 */
let DRAWER_TAG: string | null = "drawerId";
/** Tests (and the switch-over) only: name the panel field that carries the shared drawer id. */
export function setDrawerTag(field: string | null) { DRAWER_TAG = field; }
export function drawerIdOf(p: Panel): string | undefined {
  if (!DRAWER_TAG) return undefined;
  const v = (p as unknown as Record<string, unknown>)[DRAWER_TAG];
  return typeof v === "string" && v ? v : typeof v === "number" ? String(v) : undefined;
}
/** Which part of a tagged drawer this is. A drawer's bottom is found by role or name "bottom" inside its
 * group, never as the case bottom (the explode's anchor). */
export function drawerPartOf(p: Panel): "front" | "bottom" | "side" | "back" | "box" {
  const tagged = (p as { drawerPart?: unknown }).drawerPart;
  if (tagged === "front" || tagged === "bottom" || tagged === "side" || tagged === "back") return tagged;
  const n = p.name.toLowerCase();
  const t = String(p.type ?? "").toLowerCase();
  if (t === "bottom" || /\bbottom\b/.test(n)) return "bottom";
  if (/\bfront\b/.test(n) || t === "front") return "front";
  if (t === "back" || /\bback\b/.test(n)) return "back";
  if (t === "side" || /\bside\b/.test(n)) return "side";
  return "box";
}

/** Roles, units, hardware hosts and stepper groups (PLAN §2.1, §2.6). */
export function classify(panels: readonly Panel[]): ExplodePart[] {
  const parts: ExplodePart[] = panels.map((p) => ({
    id: p.id, name: p.name, type: p.type, role: "case", unit: "case", group: "case",
    x: p.position.x, y: p.position.y, z: p.position.z, w: p.size.width, h: p.size.height, d: p.size.depth,
  }));
  if (!parts.length) return parts;
  const all = boxOf(parts);
  const midX = (all.minX + all.maxX) / 2;
  const src = new Map(panels.map((p) => [p.id, p]));
  for (const p of parts) {
    const n = p.name.toLowerCase();
    const raw = src.get(p.id)!;
    const tagged = drawerIdOf(raw);
    if (HW.test(n)) p.role = "hardware";
    else if (tagged) {
      // Hollow drawer: every part moves with its drawer; the front leads, the rest (sides, back, bottom) is the box.
      p.drawerPart = drawerPartOf(raw);
      p.role = p.drawerPart === "front" ? "drawerFront" : "drawerBox";
    }
    else if (p.type === "drawer") p.role = "drawerBox";
    else if (/drawer front/.test(n)) p.role = "drawerFront";
    else if (p.type === "door") p.role = "door";
    else if (raw.turns || /\blid\b/.test(n)) p.role = "lid";
    else if (p.type === "shelf" || /shelf/.test(n)) p.role = "shelf";
    else if (p.type === "top" || p.type === "counter" || /\btop\b|counter|desktop/.test(n)) p.role = "top";
    else if (p.type === "back" || /\bback\b/.test(n)) p.role = "back";
    else if (p.type === "bottom" || /bottom/.test(n)) p.role = "bottom";
    else if (p.type === "kick" || /kick/.test(n)) p.role = "kick";
    else if (p.type === "mirror") p.role = "inset";
    else if (/front wall|front$/.test(n)) p.role = "front";
    else if (p.w <= 1 && p.h > p.w && p.d > p.w) {
      const edge = Math.min(Math.abs(p.x - all.minX), Math.abs(p.x + p.w - all.maxX));
      p.role = edge < 0.01 ? (cxOf(p) < midX ? "sideL" : "sideR") : "divider";
    } else if (p.d <= 1 && p.h > p.d) p.role = "divider";
    else p.role = "case";
  }
  // Drawer fronts (typed "rail" live) pair with the box whose X×Y overlap is largest.
  const boxes = parts.filter((p) => p.role === "drawerBox");
  for (const f of parts.filter((p) => p.role === "drawerFront" && !drawerIdOf(src.get(p.id)!))) {
    let best: ExplodePart | null = null, bs = 0;
    for (const b of boxes) {
      const s = ov1(f.x, f.x + f.w, b.x, b.x + b.w) * ov1(f.y, f.y + f.h, b.y, b.y + b.h);
      if (s > bs) { bs = s; best = b; }
    }
    f.unit = best ? `D:${best.id}` : "case";
  }
  for (const p of parts) {
    const tag = drawerIdOf(src.get(p.id)!);
    if (tag && (p.role === "drawerBox" || p.role === "drawerFront")) p.unit = `D:${tag}`;
    else if (p.role === "drawerBox") p.unit = `D:${p.id}`;
    else if (p.role === "door") p.unit = `door:${p.id}`;
    else if (p.role === "lid") p.unit = `lid:${p.id}`;
    else if (p.role === "shelf") p.unit = `shelf:${p.id}`;
    else if (p.role !== "drawerFront" && p.role !== "hardware") p.unit = "case";
  }
  // Hardware rides with the nearest door, lid or drawer (box distance; doors and lids preferred).
  for (const h of parts.filter((p) => p.role === "hardware")) {
    let best: ExplodePart | null = null, bd = Infinity;
    for (const q of parts) {
      if (q === h || q.role === "hardware") continue;
      const dist = Math.hypot(
        Math.max(0, Math.abs(cxOf(h) - cxOf(q)) - (h.w + q.w) / 2),
        Math.max(0, Math.abs(cyOf(h) - cyOf(q)) - (h.h + q.h) / 2),
        Math.max(0, Math.abs(czOf(h) - czOf(q)) - (h.d + q.d) / 2),
      );
      const pref = q.role === "door" || q.role === "lid" ? -0.05 : 0;
      if (dist + pref < bd) { bd = dist + pref; best = q; }
    }
    h.host = best?.id;
    h.unit = best ? best.unit : "case";
  }
  // Stepper groups: case shell, each drawer bank, doors, shelves, hardware; tall builds prefix the zone.
  const H = all.maxY - all.minY, W = all.maxX - all.minX;
  const tall = W > 0 && H / W > 1.8;
  const ux = new Map<string, [number, number]>();
  for (const p of parts) { const a = ux.get(p.unit) ?? [Infinity, -Infinity]; ux.set(p.unit, [Math.min(a[0], p.x), Math.max(a[1], p.x + p.w)]); }
  for (const p of parts) {
    const span = ux.get(p.unit);
    const ucx = span ? (span[0] + span[1]) / 2 : cxOf(p);
    const zone = tall ? (cyOf(p) < all.minY + 0.45 * H ? "lower " : "upper ") : "";
    const drawer = p.unit.startsWith("D:");
    const bank = drawer ? (ucx < midX - 0.15 * W ? "left " : ucx > midX + 0.15 * W ? "right " : "") : "";
    p.group = p.role === "hardware" ? "hardware" : drawer ? `${zone}${bank}drawers` : p.role === "door" ? `${zone}doors` : p.role === "shelf" ? `${zone}shelves` : `${zone}case`;
  }
  return parts;
}

export type Mover = {
  key: string;
  parts: ExplodePart[];
  axis: V3;
  dist: number;
  cap: number;
  /** Drawer bank membership: lift = (n − 1 − k) × drawer height × bank.spread. */
  bank?: { spread: number };
  /** Sideways shift of the whole bank (its column stays aligned): lat.side × dir along X. One lat for every
   * bank, so side-by-side banks part from the middle by the same amount. */
  lat?: { side: number }; dir?: number;
  /** Hollow drawers only: the front stands off its box by `out` inches (one value for every drawer), so the
   * box's inside (its bottom's inner face) shows from above. Solid drawers have no inside to show. */
  front?: { out: number };
  /** Movers that keep one distance (both sides, both doors, matching drawers), so gaps stay even. */
  link?: string;
  k?: number; n?: number; hh?: number;
  /** A drawer's box depth and its box's bottom centre (the tilt pivot). */
  dd?: number; pivot?: V3;
  /** Small flat parts (toekicks): how far (0..1) their broad face turns square to the camera (solver-grown). */
  face?: number;
};

export type Layout = {
  parts: ExplodePart[];
  movers: Map<string, Mover>;
  /** Part id → its mover. */
  owner: Map<string, Mover>;
  g: number; W: number; H: number; D: number; midX: number; minY: number;
  /** Doors that hang on the left (operateFaces.doorHingesLeft: one hinge rule for model, steps and pull). */
  hingeLeft: Map<string, boolean>;
  /**
   * Hollow drawers tip their open top toward the camera by `ang` (one value for every drawer, so the staircase
   * stays even) about a level axis square to the camera's heading (tiltAxis). The solver grows it when a drawer's
   * inside is hidden by its own side or back (Critic #98 row 107: the vanity's left column showed side-on troughs).
   */
  tilt: { ang: number; axis: V3 };
  /** Unit vector from the model toward the explode camera (EXPLODE_VIEW, or the user's own angle). */
  camDir: V3;
};

/** Unit vector toward a camera at this azimuth / elevation (the bench's frame: azimuth from +z toward +x). */
export function camDirOf(view: { azimuthDeg: number; elevationDeg: number }): V3 {
  const a = (view.azimuthDeg * Math.PI) / 180, e = (view.elevationDeg * Math.PI) / 180;
  return norm([Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]);
}

/**
 * The turn that lays a flat part's broad face square to the camera, scaled by `share` (0..1): axis = n × c, angle =
 * share × the angle between them, about the part's centre. A thin strip seen at a slant (a toekick) reads full size.
 */
export function faceTurn(p: Pick<ExplodePart, "x" | "y" | "z" | "w" | "h" | "d">, cam: V3, share: number): Pose["rot"] | undefined {
  const dims = [p.w, p.h, p.d];
  const k = dims.indexOf(Math.min(...dims));
  const n: V3 = [0, 0, 0];
  n[k] = cam[k] >= 0 ? 1 : -1;
  const dot = n[0] * cam[0] + n[1] * cam[1] + n[2] * cam[2];
  const ang = Math.acos(Math.max(-1, Math.min(1, dot))) * Math.max(0, Math.min(1, share));
  const ax: V3 = [n[1] * cam[2] - n[2] * cam[1], n[2] * cam[0] - n[0] * cam[2], n[0] * cam[1] - n[1] * cam[0]];
  if (ang < 1e-4 || Math.hypot(...ax) < 1e-6) return undefined;
  return { axis: norm(ax), ang, pivot: [cxOf(p as ExplodePart), cyOf(p as ExplodePart), czOf(p as ExplodePart)] };
}

/** Most a drawer tips toward the camera, and the solver's step. */
export const TILT_MAX = (40 * Math.PI) / 180;
export const TILT_STEP = (5 * Math.PI) / 180;

/** The level axis that tips a box's up face toward a camera at this azimuth (up × heading). */
export function tiltAxis(azimuthDeg: number): V3 {
  const a = (azimuthDeg * Math.PI) / 180;
  return norm([Math.cos(a), 0, -Math.sin(a)]);
}

/** Movers, axes and starting distances (PLAN §2.2). */
export function layoutFor(panels: readonly Panel[]): Layout {
  const parts = classify(panels);
  const A = boxOf(parts);
  const W = A.maxX - A.minX, H = A.maxY - A.minY, D = A.maxZ - A.minZ;
  const g = Math.max(1, 0.5 * D), midX = (A.minX + A.maxX) / 2;
  const cap = 1.6 * Math.max(W, H, D);
  const movers = new Map<string, Mover>();
  const hingeLeft = new Map<string, boolean>();
  const src = new Map(panels.map((p) => [p.id, p]));
  const add = (key: string, p: ExplodePart, axis: V3, d0: number, link?: string) => {
    let m = movers.get(key);
    if (!m) movers.set(key, (m = { key, parts: [], axis: norm(axis), dist: d0, cap, link }));
    m.parts.push(p);
  };
  const T = 0.75;
  for (const p of parts) {
    switch (p.role) {
      case "hardware": break;
      case "bottom": add("anchor", p, [0, 0, 0], 0); break;
      case "top": add(`top:${p.id}`, p, [0, 1, 0], g); break;
      case "back": add(`back:${p.id}`, p, [0, 0, -1], g); break;
      case "sideL": add(`sideL:${p.id}`, p, [-1, 0, 0], g, "side"); break;
      case "sideR": add(`sideR:${p.id}`, p, [1, 0, 0], g, "side"); break;
      case "front": add(`front:${p.id}`, p, [0, 0, 1], g); break;
      case "kick": add(`kick:${p.id}`, p, [0, 0, 1], 0.6 * g, "kick"); break;
      case "inset": add(`inset:${p.id}`, p, [0, 0, 1], 0.35 * g); break;
      case "divider": { const short = p.h < 0.5 * H; add(`div:${p.id}`, p, short ? [0, 1, 0] : [0, 0, -1], 0.25 * g, short ? "div-lift" : "div-back"); break; }
      case "shelf": add(p.unit, p, [0, 0.25, 1], 0.55 * D); break;
      case "door": {
        const left = doorHingesLeft(src.get(p.id)!);
        hingeLeft.set(p.id, left);
        add(p.unit, p, [left ? -1 : 1, 0, 0.35], g + T, "door");
        break;
      }
      case "lid": add(p.unit, p, [0, 1, -0.2], 1.4 * g); break;
      case "case": add(`case:${p.id}`, p, [0, 1, 0], 0.3 * g); break;
      default:
        if (p.unit.startsWith("D:")) add(p.unit, p, [0, 0, 1], 0);
        else add("anchor", p, [0, 0, 0], 0);
    }
  }
  // Drawers: an aligned staircase. Banks by X overlap, top drawer first (k = 0). Each drawer slides straight
  // out, start = depth × (0.85 + 0.45 k), so lower drawers sit further out and each top shows past the one
  // above; each bank also spreads upward (even gaps). The whole bank then steps sideways as one column, so it
  // clears the open carcase: two banks part from the middle (the desk's knee space stays open), a single
  // bank goes toward camera-left (right when a left door swings there). PLAN §2.2 fanned each drawer by
  // 0.25 × (k + 1); one shift per bank keeps the columns aligned and the gaps even instead of a fan.
  type Env = { m: Mover; b: Box3 };
  const env: Env[] = [...movers.values()].filter((m) => m.key.startsWith("D:")).map((m) => ({ m, b: boxOf(m.parts.filter((q) => q.role !== "drawerFront")) }));
  const cols: { minX: number; maxX: number; list: Env[] }[] = [];
  for (const e of env) {
    let c = cols.find((c) => ov1(c.minX, c.maxX, e.b.minX, e.b.maxX) > 0.5 * (e.b.maxX - e.b.minX));
    if (!c) cols.push((c = { minX: e.b.minX, maxX: e.b.maxX, list: [] }));
    c.list.push(e);
  }
  const leftDoor = parts.some((q) => q.role === "door" && hingeLeft.get(q.id));
  const rightDoor = parts.some((q) => q.role === "door" && hingeLeft.get(q.id) === false);
  const bank = { spread: 0.35 };
  const hollow = env.filter((e) => e.m.parts.some((q) => q.drawerPart === "bottom"));
  const front = { out: 0.5 * Math.max(0, ...hollow.map((e) => e.b.maxZ - e.b.minZ)) };
  for (const e of hollow) e.m.front = front;
  const lat = { side: cols.length > 1 ? 0.25 * D : 0.5 * W };
  for (const c of cols) {
    c.list.sort((a, b) => b.b.minY - a.b.minY);
    const n = c.list.length;
    const colLeft = (c.minX + c.maxX) / 2 <= midX;
    // Doors open on both sides: camera-left, and posesFor widens the step past the open door (doorClear).
    const dir = cols.length > 1 ? (colLeft ? -1 : 1) : leftDoor && !rightDoor ? 1 : -1;
    c.list.forEach((e, k) => {
      const dd = e.b.maxZ - e.b.minZ, hh = e.b.maxY - e.b.minY;
      e.m.axis = [0, 0, 1];
      // Never less than clear of the case front, so the sideways step happens outside the carcase.
      e.m.dist = Math.max(dd * (0.85 + 0.45 * k), A.maxZ - e.b.minZ + 0.1 * g + 0.45 * k * dd);
      e.m.lat = lat; e.m.dir = dir;
      e.m.link = `drawer:${k}`;
      e.m.bank = bank; e.m.k = k; e.m.n = n; e.m.hh = hh; e.m.dd = dd;
      e.m.pivot = [(e.b.minX + e.b.maxX) / 2, e.b.minY, (e.b.minZ + e.b.maxZ) / 2];
    });
  }
  const owner = new Map<string, Mover>();
  for (const m of movers.values()) for (const p of m.parts) owner.set(p.id, m);
  return { parts, movers, owner, g, W, H, D, midX, minY: A.minY, hingeLeft, tilt: { ang: 0, axis: tiltAxis(EXPLODE_VIEW.azimuthDeg) }, camDir: camDirOf(EXPLODE_VIEW) };
}

/** The pose of every part for the layout's current distances (PLAN §2.2, §2.5). */
export function posesFor(L: Layout): Map<string, Pose> {
  const out = new Map<string, Pose>();
  const tall = L.W > 0 && L.H / L.W > 1.8;
  const clear = doorClear(L);
  // A column that steps toward an open door first slides out past the door's front edge (one shift for the
  // whole column, so the staircase stays even).
  const zOut = (clear as Map<number, number> & { z?: Map<number, number> }).z ?? new Map<number, number>();
  const shiftZ = new Map<number, number>();
  for (const m of L.movers.values()) {
    const z = m.lat ? zOut.get(m.dir ?? 0) : undefined;
    if (z === undefined) continue;
    const minZ = Math.min(...m.parts.filter((q) => q.role !== "drawerFront").map((q) => q.z));
    shiftZ.set(m.dir!, Math.max(shiftZ.get(m.dir!) ?? 0, z - (minZ + m.dist)));
  }
  // A drawer that spreads upward must first slide out past anything that ends up in front of it at its lifted
  // height (a jewelry box's tray front wall stepping forward above the drawers): one extra shift per column side.
  // A tipped drawer stands taller by its depth × sin(tilt): the bank spreads by that too, so tipped drawers never meet.
  const tipped = (m: Mover) => (m.front && L.tilt.ang > 0 ? L.tilt.ang : 0);
  const liftOf = (m: Mover) => (m.bank ? ((m.n ?? 1) - 1 - (m.k ?? 0)) * ((m.hh ?? 0) * m.bank.spread + (m.dd ?? 0) * Math.sin(tipped(m))) : 0);
  for (const m of L.movers.values()) {
    const lift = liftOf(m);
    const tip = tipped(m);
    if (!m.lat || (lift <= 0 && !tip)) continue;
    const mine = m.parts.filter((q) => q.role !== "hardware");
    const b = boxOf(mine);
    // A tipped drawer's back rises by its depth × sin(tilt): it must clear what sits above it too.
    const y0 = b.minY + lift, y1 = b.maxY + lift + (m.dd ?? 0) * Math.sin(tip);
    let need = -Infinity;
    for (const o of L.movers.values()) {
      if (o.key.startsWith("D:") || o === m) continue;
      const t: V3 = [o.axis[0] * o.dist, o.axis[1] * o.dist, o.axis[2] * o.dist];
      for (const q of o.parts) {
        if (q.role === "hardware" || q.role === "door" || q.role === "lid") continue;
        if (ov1(q.y + t[1], q.y + q.h + t[1], y0, y1) <= 0.01 || ov1(q.x + t[0], q.x + q.w + t[0], b.minX, b.maxX) <= 0.01) continue;
        need = Math.max(need, q.z + q.d + t[2] + 0.1 * L.g);
      }
    }
    if (need === -Infinity) continue;
    const minZ = Math.min(...mine.filter((q) => q.role !== "drawerFront").map((q) => q.z));
    shiftZ.set(m.dir!, Math.max(shiftZ.get(m.dir!) ?? 0, need - (minZ + m.dist)));
  }
  for (const m of L.movers.values()) {
    const lift = liftOf(m);
    for (const p of m.parts) {
      const side = m.lat ? Math.max(m.lat.side, clear.get(m.dir ?? 0) ?? 0) * (m.dir ?? 0) : 0;
      const dz = m.lat ? Math.max(0, shiftZ.get(m.dir ?? 0) ?? 0) : 0;
      const fz = m.front && p.role === "drawerFront" ? m.front.out : 0;
      const t: V3 = [m.axis[0] * m.dist + side, m.axis[1] * m.dist + lift, m.axis[2] * m.dist + dz + fz];
      const pose: Pose = { t, stage: p.role };
      // The slide-out comes first; the column's sideways step and upward spread second (lat).
      if (side || lift) pose.lat = [side, lift, 0];
      if (p.role === "door") {
        // Swing 105° on the real hinge side, then move outward: the open door never lands in front of its case.
        const left = L.hingeLeft.get(p.id) ?? cxOf(p) < L.midX;
        pose.rot = { axis: [0, 1, 0], ang: ((left ? -1 : 1) * 105 * Math.PI) / 180, pivot: [left ? p.x : p.x + p.w, cyOf(p), p.z + p.d / 2] };
      } else if (tipped(m) && m.pivot) {
        // A hollow drawer tips its open top toward the camera, about its own box's bottom centre (front and all).
        // It tips only once it is out of the carcase (the lat window), never inside it.
        pose.rot = { axis: L.tilt.axis, ang: tipped(m), pivot: m.pivot };
        pose.rotLate = true;
      } else if (m.face && p.role === "kick") {
        // Turns once the drawers are out (the lat window), so it never sweeps through one sliding past.
        pose.rot = faceTurn(p, L.camDir, m.face);
        if (pose.rot) pose.rotLate = true;
      } else if (p.role === "lid") {
        // Tip back 75° on the hinge line (back edge, bottom face).
        pose.rot = { axis: [1, 0, 0], ang: (-75 * Math.PI) / 180, pivot: [cxOf(p), p.y, p.z] };
      }
      // Tall builds: the upper zone lifts by another 0.12 × height so upper and lower read as separate units.
      if (tall && cyOf(p) > L.minY + 0.5 * L.H && p.role !== "back" && p.role !== "sideL" && p.role !== "sideR") t[1] += 0.12 * L.H;
      out.set(p.id, pose);
    }
  }
  // Hardware rides on its host, exactly (within 0.01").
  for (const h of L.parts) {
    if (h.role !== "hardware") continue;
    const host = h.host ? out.get(h.host) : undefined;
    out.set(h.id, host ? { ...host, t: [...host.t] as V3 } : { t: [0, 0, 0] });
  }
  return out;
}

/**
 * How far a drawer column must step toward −x / +x so it lands clear of an open door on that side (a door
 * swung open beside the case, level with the drawers): the door's posed outer edge + g/4 past the
 * column's near edge. Doors move before drawers, so this uses the doors' current solved distance.
 */
function doorClear(L: Layout): Map<number, number> {
  const out = new Map<number, number>();
  /** dir → the open door's front edge + g/4 (z): a column stepping that way must slide out past it first. */
  const zOut = new Map<number, number>();
  (out as Map<number, number> & { z?: Map<number, number> }).z = zOut;
  const drawers = L.parts.filter((p) => p.unit.startsWith("D:") && p.role !== "hardware");
  if (!drawers.length) return out;
  const D = boxOf(drawers);
  for (const p of L.parts) {
    if (p.role !== "door" || ov1(p.y, p.y + p.h, D.minY, D.maxY) <= 0) continue;
    const m = L.owner.get(p.id);
    if (!m) continue;
    const left = L.hingeLeft.get(p.id) ?? cxOf(p) < L.midX;
    const pose: Pose = {
      t: [m.axis[0] * m.dist, m.axis[1] * m.dist, m.axis[2] * m.dist],
      rot: { axis: [0, 1, 0], ang: ((left ? -1 : 1) * 105 * Math.PI) / 180, pivot: [left ? p.x : p.x + p.w, cyOf(p), p.z + p.d / 2] },
    };
    const cs = cornersOf(p, pose);
    const xs = cs.map((c) => c[0]);
    const need = left ? D.maxX - Math.min(...xs) + 0.25 * L.g : Math.max(...xs) - D.minX + 0.25 * L.g;
    const dir = left ? -1 : 1;
    out.set(dir, Math.max(out.get(dir) ?? 0, need));
    zOut.set(dir, Math.max(zOut.get(dir) ?? -Infinity, Math.max(...cs.map((c) => c[2])) + 0.25 * L.g));
  }
  return out;
}

/** World corners of a part's box under a pose. */
export function cornersOf(p: Pick<ExplodePart, "x" | "y" | "z" | "w" | "h" | "d">, pose?: Pose): V3[] {
  const out: V3[] = [];
  for (const X of [p.x, p.x + p.w]) for (const Y of [p.y, p.y + p.h]) for (const Z of [p.z, p.z + p.d]) out.push(applyPose([X, Y, Z], pose));
  return out;
}

export function applyPose(v: V3, pose?: Pose, u = 1): V3 {
  if (!pose) return v;
  let [x, y, z] = v;
  if (pose.rot) {
    const { axis, ang, pivot } = pose.rot;
    const a = ang * u, c = Math.cos(a), s = Math.sin(a);
    const px = x - pivot[0], py = y - pivot[1], pz = z - pivot[2];
    const [kx, ky, kz] = axis;
    const dt = kx * px + ky * py + kz * pz;
    // Rodrigues
    x = px * c + (ky * pz - kz * py) * s + kx * dt * (1 - c) + pivot[0];
    y = py * c + (kz * px - kx * pz) * s + ky * dt * (1 - c) + pivot[1];
    z = pz * c + (kx * py - ky * px) * s + kz * dt * (1 - c) + pivot[2];
  }
  return [x + pose.t[0] * u, y + pose.t[1] * u, z + pose.t[2] * u];
}

/** Every part's posed corners (what the explode camera fits). */
export function posedPoints(L: Layout, poses: Map<string, Pose>): V3[] {
  const out: V3[] = [];
  for (const p of L.parts) out.push(...cornersOf(p, poses.get(p.id)));
  return out;
}

/** The exploded model's box (every part's posed corners). */
export function explodedBox(L: Layout, poses: Map<string, Pose>): Box3 {
  const b: Box3 = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  for (const p of L.parts) for (const [x, y, z] of cornersOf(p, poses.get(p.id))) {
    b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x);
    b.minY = Math.min(b.minY, y); b.maxY = Math.max(b.maxY, y);
    b.minZ = Math.min(b.minZ, z); b.maxZ = Math.max(b.maxZ, z);
  }
  b.minY = Math.max(0, b.minY);
  return b;
}

/** Explode camera (PLAN §3): azimuth 32° (unchanged), elevation 32° (up from 16°) to look into drawers and onto shelves. */
export const EXPLODE_VIEW = { azimuthDeg: 32, elevationDeg: 32 } as const;
/** Open tween; closing takes 0.7× (PLAN §6 item 1). */
export const EXPLODE_MS = 1200;
export const CLOSE_MS = Math.round(EXPLODE_MS * 0.7);
/** Reduced motion: no tween, a 150 ms fade on the final pose. */
export const REDUCED_FADE_MS = 150;

/**
 * Staged by unit: each role moves inside its own window of the one tween (fractions of it), so doors and
 * lids swing clear first, the case opens, drawers slide out (then step sideways), shelves follow. Closing runs the same path
 * backwards (drawers home first, doors shut last). [start, end] of the move, and of a swing.
 */
export function stageWindow(role: Role): { move: [number, number]; swing: [number, number] } {
  switch (role) {
    case "door": case "lid": return { move: [0.12, 0.72], swing: [0, 0.5] };
    case "shelf": return { move: [0.68, 1], swing: [0, 1] };
    case "drawerBox": case "drawerFront": return { move: [0.3, 0.75], swing: [0, 1] };
    default: return { move: [0.12, 0.85], swing: [0, 1] };
  }
}

/** A drawer column's sideways step: after the slide-out is ≥ 98% done (ease-out of [0.3, 0.75] at 0.65). */
export const LAT_WINDOW: [number, number] = [0.65, 1];

export function windowed(u: number, w: [number, number]): number {
  return easeParts(Math.min(1, Math.max(0, (u - w[0]) / Math.max(1e-6, w[1] - w[0]))));
}

/** A part's pose part-way through the tween (clock u in 0..1), staged by its role. */
export function poseAt(pose: Pose, role: Role, u: number): Pose {
  const w = stageWindow(pose.stage ?? role);
  const m = windowed(u, w.move);
  const l = pose.lat ? windowed(u, LAT_WINDOW) : 0;
  const L = pose.lat ?? [0, 0, 0];
  const t: V3 = [(pose.t[0] - L[0]) * m + L[0] * l, (pose.t[1] - L[1]) * m + L[1] * l, (pose.t[2] - L[2]) * m + L[2] * l];
  if (!pose.rot) return { t };
  return { t, rot: { ...pose.rot, ang: pose.rot.ang * windowed(u, pose.rotLate ? LAT_WINDOW : w.swing) } };
}

/** Strong ease-out for parts (no ease-in on UI). */
export const easeParts = (u: number) => 1 - (1 - u) ** 3;


/** An oriented box (centre, unit axes, half extents) for the 3D clearance rule. */
export type OBB = { c: V3; ax: V3[]; e: number[] };
const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vdot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** A part's box under a pose, shrunk by `shrink` inches so parts that only touch don't count. */
export function obbOf(p: Pick<ExplodePart, "x" | "y" | "z" | "w" | "h" | "d">, pose: Pose | undefined, shrink: number): OBB {
  const o = applyPose([0, 0, 0], pose);
  const axis = (v: V3) => vsub(applyPose(v, pose), o);
  const c = applyPose([p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2], pose);
  return { c, ax: [axis([1, 0, 0]), axis([0, 1, 0]), axis([0, 0, 1])], e: [p.w, p.h, p.d].map((s) => Math.max(0, s / 2 - shrink)) };
}

/** Separating-axis test for two oriented boxes. */
export function obbOverlap(a: OBB, b: OBB): boolean {
  if (a.e.some((x) => x <= 0) || b.e.some((x) => x <= 0)) return false;
  const axes = [...a.ax, ...b.ax];
  for (const u of a.ax) for (const v of b.ax) { const x = vcross(u, v); if (Math.hypot(...x) > 1e-6) axes.push(x); }
  const d = vsub(b.c, a.c);
  for (const L of axes) {
    const ra = a.e.reduce((s, e, i) => s + e * Math.abs(vdot(a.ax[i], L)), 0);
    const rb = b.e.reduce((s, e, i) => s + e * Math.abs(vdot(b.ax[i], L)), 0);
    if (Math.abs(vdot(d, L)) > ra + rb) return false;
  }
  return true;
}

/**
 * The 3D clearance rule over the whole tween: does any moving part pass through a part of another unit at any of
 * `frames` frames? Parts that start inside one another (inset panels) only have to leave. Every solver step that
 * tips or spreads drawers is checked with this and taken back if it fails (growIfClear).
 */
export function tweenCollides(L: Layout, poses: Map<string, Pose>, frames = 16): boolean {
  const live = L.parts.filter((p) => p.role !== "hardware");
  const rest = new Map(live.map((p) => [p.id, obbOf(p, undefined, 0.05)]));
  const pairs: [ExplodePart, ExplodePart][] = [];
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    if (a.unit === b.unit) continue;
    if (a.unit === "case" && b.unit === "case") continue;
    if (obbOverlap(rest.get(a.id)!, rest.get(b.id)!)) continue;
    pairs.push([a, b]);
  }
  for (let f = 1; f <= frames; f++) {
    const u = f / frames;
    const at = (p: ExplodePart) => { const q = poses.get(p.id); return obbOf(p, q && poseAt(q, p.role, u), 0.05); };
    for (const [a, b] of pairs) if (obbOverlap(at(a), at(b))) return true;
  }
  return false;
}

/** Apply a solver step only if the tween stays clear; otherwise take it back. Returns whether it stuck. */
export function growIfClear(L: Layout, apply: () => void, revert: () => void): boolean {
  apply();
  if (!tweenCollides(L, posesFor(L))) return true;
  revert();
  return false;
}
