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
  /** Hardware rides on this part. */
  host?: string;
  /** Min corner and size (inches), the engine's box. */
  x: number; y: number; z: number; w: number; h: number; d: number;
};

/** A rigid explode pose: rotate by `ang` about `axis` through `pivot` (world), then translate by `t`. */
export type Pose = { t: V3; rot?: { axis: V3; ang: number; pivot: V3 } };

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
    if (HW.test(n)) p.role = "hardware";
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
  for (const f of parts.filter((p) => p.role === "drawerFront")) {
    let best: ExplodePart | null = null, bs = 0;
    for (const b of boxes) {
      const s = ov1(f.x, f.x + f.w, b.x, b.x + b.w) * ov1(f.y, f.y + f.h, b.y, b.y + b.h);
      if (s > bs) { bs = s; best = b; }
    }
    f.unit = best ? `D:${best.id}` : "case";
  }
  for (const p of parts) {
    if (p.role === "drawerBox") p.unit = `D:${p.id}`;
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
  /** Movers that keep one distance (both sides, both doors, matching drawers), so gaps stay even. */
  link?: string;
  k?: number; n?: number; hh?: number;
};

export type Layout = {
  parts: ExplodePart[];
  movers: Map<string, Mover>;
  /** Part id → its mover. */
  owner: Map<string, Mover>;
  g: number; W: number; H: number; D: number; midX: number; minY: number;
  /** Doors that hang on the left (operateFaces.doorHingesLeft: one hinge rule for model, steps and pull). */
  hingeLeft: Map<string, boolean>;
};

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
  const bank = { spread: 0.35 };
  const lat = { side: cols.length > 1 ? 0.25 * D : 0.5 * W };
  for (const c of cols) {
    c.list.sort((a, b) => b.b.minY - a.b.minY);
    const n = c.list.length;
    const colLeft = (c.minX + c.maxX) / 2 <= midX;
    const dir = cols.length > 1 ? (colLeft ? -1 : 1) : leftDoor ? 1 : -1;
    c.list.forEach((e, k) => {
      const dd = e.b.maxZ - e.b.minZ, hh = e.b.maxY - e.b.minY;
      e.m.axis = [0, 0, 1];
      e.m.dist = dd * (0.85 + 0.45 * k);
      e.m.lat = lat; e.m.dir = dir;
      e.m.link = `drawer:${k}`;
      e.m.bank = bank; e.m.k = k; e.m.n = n; e.m.hh = hh;
    });
  }
  const owner = new Map<string, Mover>();
  for (const m of movers.values()) for (const p of m.parts) owner.set(p.id, m);
  return { parts, movers, owner, g, W, H, D, midX, minY: A.minY, hingeLeft };
}

/** The pose of every part for the layout's current distances (PLAN §2.2, §2.5). */
export function posesFor(L: Layout): Map<string, Pose> {
  const out = new Map<string, Pose>();
  const tall = L.W > 0 && L.H / L.W > 1.8;
  for (const m of L.movers.values()) {
    const lift = m.bank ? ((m.n ?? 1) - 1 - (m.k ?? 0)) * (m.hh ?? 0) * m.bank.spread : 0;
    for (const p of m.parts) {
      const t: V3 = [m.axis[0] * m.dist + (m.lat ? m.lat.side * (m.dir ?? 0) : 0), m.axis[1] * m.dist + lift, m.axis[2] * m.dist];
      const pose: Pose = { t };
      if (p.role === "door") {
        // Swing 105° on the real hinge side, then move outward: the open door never lands in front of its case.
        const left = L.hingeLeft.get(p.id) ?? cxOf(p) < L.midX;
        pose.rot = { axis: [0, 1, 0], ang: ((left ? -1 : 1) * 105 * Math.PI) / 180, pivot: [left ? p.x : p.x + p.w, cyOf(p), p.z + p.d / 2] };
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
    out.set(h.id, host ? { t: [...host.t] as V3, rot: host.rot } : { t: [0, 0, 0] });
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
 * lids swing clear first, the case opens, then shelves and drawers slide out. Closing runs the same path
 * backwards (drawers home first, doors shut last). [start, end] of the move, and of a swing.
 */
export function stageWindow(role: Role): { move: [number, number]; swing: [number, number] } {
  switch (role) {
    case "door": case "lid": return { move: [0.12, 0.72], swing: [0, 0.5] };
    case "shelf": return { move: [0.3, 0.95], swing: [0, 1] };
    case "drawerBox": case "drawerFront": return { move: [0.35, 1], swing: [0, 1] };
    default: return { move: [0.12, 0.85], swing: [0, 1] };
  }
}

export function windowed(u: number, w: [number, number]): number {
  return easeParts(Math.min(1, Math.max(0, (u - w[0]) / Math.max(1e-6, w[1] - w[0]))));
}

/** Strong ease-out for parts (no ease-in on UI). */
export const easeParts = (u: number) => 1 - (1 - u) ** 3;
