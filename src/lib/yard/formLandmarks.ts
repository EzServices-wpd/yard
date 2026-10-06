/**
 * Landmark families with published proportions. Each family is parametric: one landmark is a spec
 * (spans, heights, tower style), and the size typed scales the whole thing without changing its ratios.
 * Figures are the structures' public dimensions; nothing here is copied from a plan.
 */
import type { FormOp, Size3 } from "./formTypes";

type P = { x: number; y: number; z: number };
const poly = (points: P[], role: string): FormOp => ({ op: "poly", points, role });
const col = (x: number, z: number, y0: number, y1: number, role = "leg"): FormOp => ({ op: "column", x, z, y0, y1, role });

// ── Suspension bridges ────────────────────────────────────────────────────────────────────────────
export type SuspensionSpec = {
  /** Suspended length (side spans + main span) over tower height. */
  lOverH: number;
  /** Deck height over tower height. */
  deck: number;
  /** Main span share of the suspended length. */
  main: number;
  /** "deco": two steel legs and stacked portal struts. "gothic": three masonry piers, twin pointed arches. */
  tower: "deco" | "gothic";
  /** Diagonal stays fanning from the tower tops (Roebling's web). */
  stays: boolean;
  /** Cable low point above the deck, as a share of the tower above the deck. */
  sag: number;
};
/** Golden Gate: 746 ft towers, 220 ft deck, 4,200 ft main span between 1,125 ft side spans. */
export const GOLDEN_GATE: SuspensionSpec = { lOverH: 6450 / 746, deck: 220 / 746, main: 4200 / 6450, tower: "deco", stays: false, sag: (276 - 220) / 526 };
/** Brooklyn: 276 ft towers, 127 ft deck, 1,595 ft main span between 930 ft side spans. */
export const BROOKLYN: SuspensionSpec = { lOverH: 3455 / 276.5, deck: 127 / 276.5, main: 1595.5 / 3455, tower: "gothic", stays: true, sag: 21.5 / 149.5 };

/** A typed number is the length unless a height word is typed; no number builds 72" long. */
export function fitSuspensionTo(spec: SuspensionSpec) {
  return (s: Size3, prompt: string): Size3 => {
    const lower = prompt.toLowerCase();
    const ft = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\b/);
    const inch = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")/);
    const n = ft ? parseFloat(ft[1]) * 12 : inch ? parseFloat(inch[1]) : 0;
    const tall = /tall|high|height/.test(lower);
    const h = tall && n ? n : (n || 72) / spec.lOverH;
    return { width: h * spec.lOverH, height: h, depth: Math.max(4, Math.min(h * 0.55, 14)) };
  };
}

function parabola(x0: number, y0: number, x1: number, y1: number, yMid: number, n: number, z: number): P[] {
  const yc = 2 * yMid - 0.5 * (y0 + y1);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return { x: x0 + (x1 - x0) * t, y: y0 * (1 - t) * (1 - t) + 2 * yc * t * (1 - t) + y1 * t * t, z };
  });
}

export function suspensionOps(s: Size3, spec: SuspensionSpec): FormOp[] {
  const h = s.height;
  const span = s.width;
  const depth = s.depth;
  const x0 = -span / 2, x1 = span / 2, z0 = -depth / 2, z1 = depth / 2;
  const deckY = h * spec.deck;
  const side = (span * (1 - spec.main)) / 2;
  const towers = [x0 + side, x1 - side];
  const tw = Math.max(0.75, h * 0.035);
  const ops: FormOp[] = [];
  for (const tx of towers) {
    if (spec.tower === "deco") {
      // Two legs, each a pair of columns, with portal struts stacked above the deck and X-bracing below it.
      for (const z of [z0, z1]) for (const dx of [-tw, tw]) ops.push(col(tx + dx, z, 0, h));
      const above = h - deckY;
      for (const f of [0.18, 0.42, 0.64, 0.84, 1]) {
        const y = deckY + above * f;
        for (const dx of [-tw, tw]) ops.push(poly([{ x: tx + dx, y, z: z0 }, { x: tx + dx, y, z: z1 }], "rail"));
      }
      for (const z of [z0, z1]) {
        ops.push(poly([{ x: tx - tw, y: 0, z }, { x: tx + tw, y: deckY, z }], "brace"));
        ops.push(poly([{ x: tx + tw, y: 0, z }, { x: tx - tw, y: deckY, z }], "brace"));
      }
      ops.push(poly([{ x: tx - tw, y: deckY * 0.5, z: z0 }, { x: tx - tw, y: deckY, z: z1 }], "brace"));
      ops.push(poly([{ x: tx - tw, y: deckY * 0.5, z: z1 }, { x: tx - tw, y: deckY, z: z0 }], "brace"));
    } else {
      // Three masonry piers across the bridge; two pointed arches carry the roadways through them.
      for (const z of [z0, 0, z1]) for (const dx of [-tw, tw]) ops.push(col(tx + dx, z, 0, h));
      const archTop = deckY + (h - deckY) * 0.62;
      for (const dx of [-tw, tw]) {
        for (const [za, zb] of [[z0, 0], [0, z1]] as const) {
          const zm = (za + zb) / 2;
          ops.push(poly([{ x: tx + dx, y: deckY, z: za }, { x: tx + dx, y: (deckY + archTop) / 2 + (archTop - deckY) * 0.2, z: za + (zm - za) * 0.4 }, { x: tx + dx, y: archTop, z: zm }], "support"));
          ops.push(poly([{ x: tx + dx, y: archTop, z: zm }, { x: tx + dx, y: (deckY + archTop) / 2 + (archTop - deckY) * 0.2, z: zb - (zb - zm) * 0.4 }, { x: tx + dx, y: deckY, z: zb }], "support"));
        }
        for (const y of [deckY, h * 0.97, h]) ops.push(poly([{ x: tx + dx, y, z: z0 }, { x: tx + dx, y, z: z1 }], "rail"));
      }
      for (const z of [z0, 0, z1]) for (const y of [deckY * 0.5, deckY, h]) ops.push(poly([{ x: tx - tw, y, z }, { x: tx + tw, y, z }], "rail"));
    }
  }
  // Anchorages at both ends, the deck along the span and floor beams across it.
  for (const x of [x0, x1]) for (const z of [z0, z1]) ops.push(col(x, z, 0, deckY));
  for (const z of [z0, z1]) ops.push(poly([{ x: x0, y: deckY, z }, { x: x1, y: deckY, z }], "rail"));
  const beams = Math.max(10, Math.round(span / Math.max(depth, 3)));
  for (let i = 0; i <= beams; i++) {
    const x = x0 + (span * i) / beams;
    if (towers.some((t) => Math.abs(x - t) < tw * 1.5)) continue;
    ops.push(poly([{ x, y: deckY, z: z0 }, { x, y: deckY, z: z1 }], "rail"));
  }
  // Main cables over the tower tops, down to the deck mid-span and to the anchorages; hangers below.
  // The low point keeps a stick's width over the deck so the cable stays its own member.
  const sag = deckY + Math.max((h - deckY) * spec.sag, 0.6);
  const sideMid = deckY + (h - deckY) * 0.4;
  for (const z of [z0, z1]) {
    const cable = [
      ...parabola(x0, deckY, towers[0], h, sideMid, 8, z),
      ...parabola(towers[0], h, towers[1], h, sag, 16, z).slice(1),
      ...parabola(towers[1], h, x1, deckY, sideMid, 8, z).slice(1),
    ];
    ops.push(poly(cable, "support"));
    for (const p of cable) {
      if (towers.some((t) => Math.abs(p.x - t) < tw * 2) || p.y - deckY < 0.4) continue;
      ops.push(col(p.x, z, deckY, p.y, "brace"));
    }
    if (spec.stays) {
      // Stays run straight from each tower top to the deck, fanning both ways.
      const reach = (towers[1] - towers[0]) * 0.32;
      for (const tx of towers) for (const dir of [-1, 1]) for (let k = 1; k <= 5; k++) {
        ops.push(poly([{ x: tx + dir * tw, y: h * 0.96, z }, { x: tx + dir * (tw + (reach * k) / 5), y: deckY, z }], "brace"));
      }
    }
  }
  return ops;
}

// ── Towers ────────────────────────────────────────────────────────────────────────────────────────
/** A circle of points (a ring) in a horizontal plane, centred off-axis when the tower leans. */
function hoop(cx: number, y: number, r: number, n: number): P[] {
  return Array.from({ length: n + 1 }, (_, i) => ({ x: cx + r * Math.cos((i / n) * Math.PI * 2), y, z: r * Math.sin((i / n) * Math.PI * 2) }));
}

/**
 * Leaning Tower of Pisa: 56.7 m tall, 15.5 m across at the base, 3.97° out of plumb. A tall ground
 * storey, six arcaded galleries, and the narrower belfry on top.
 */
export function pisaTowerOps(s: Size3): FormOp[] {
  const H = s.height;
  const lean = Math.tan((3.97 * Math.PI) / 180);
  const r = H * (15.48 / 56.67) * 0.5;
  const rb = r * 0.72;
  const n = 16;
  const levels = [0, 0.2, ...Array.from({ length: 6 }, (_, i) => 0.2 + ((i + 1) * 0.6) / 6)];
  const ops: FormOp[] = [];
  const at = (y: number) => y * lean;
  for (const [i, f] of levels.entries()) ops.push(poly(hoop(at(f * H), f * H, r, n), i === 0 ? "base" : "ring"));
  for (let i = 0; i + 1 < levels.length; i++) {
    const ya = levels[i] * H, yb = levels[i + 1] * H;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      ops.push(poly([{ x: at(ya) + r * Math.cos(a), y: ya, z: r * Math.sin(a) }, { x: at(yb) + r * Math.cos(a), y: yb, z: r * Math.sin(a) }], "leg"));
    }
  }
  const yb0 = 0.8 * H, yb1 = H;
  ops.push(poly(hoop(at(yb1), yb1, rb, 12), "ring"));
  ops.push(poly(hoop(at((yb0 + yb1) / 2), (yb0 + yb1) / 2, rb, 12), "ring"));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ops.push(poly([{ x: at(yb0) + rb * Math.cos(a), y: yb0, z: rb * Math.sin(a) }, { x: at(yb1) + rb * Math.cos(a), y: yb1, z: rb * Math.sin(a) }], "leg"));
  }
  return ops;
}

/** A square frame at one height (a plan ring). */
const square = (y: number, h: number): P[] => [
  { x: h, y, z: h }, { x: -h, y, z: h }, { x: -h, y, z: -h }, { x: h, y, z: -h }, { x: h, y, z: h },
];

/**
 * Clock tower (Elizabeth Tower): 96 m tall on a 12 m square; the clock stage stands proud with a dial
 * on each face centred near 55 m, the belfry above it, then the tall pyramid spire and finial.
 */
export function clockTowerOps(s: Size3): FormOp[] {
  const H = s.height;
  const a = H * 0.0625;
  const stage = a * 1.3;
  const ops: FormOp[] = [];
  const shaftTop = H * 0.52, dialY = H * 0.575, stageTop = H * 0.64, belfryTop = H * 0.72, spireTop = H * 0.96;
  for (const [x, z] of [[a, a], [-a, a], [-a, -a], [a, -a]] as const) {
    ops.push(col(x, z, 0, shaftTop));
    ops.push(col((x / a) * stage, (z / a) * stage, shaftTop, stageTop));
    ops.push(col(x, z, stageTop, belfryTop));
    ops.push(poly([{ x, y: belfryTop, z }, { x: x * 0.12, y: spireTop, z: z * 0.12 }], "tip"));
  }
  for (let i = 0; i <= 8; i++) ops.push(poly(square((shaftTop * i) / 8, a), i === 0 ? "base" : "ring"));
  for (const y of [shaftTop, stageTop]) ops.push(poly(square(y, stage), "rail"));
  ops.push(poly(square(belfryTop, a * 1.05), "rail"));
  ops.push(poly(square((belfryTop + spireTop) / 2, a * 0.56), "ring"));
  // A dial on each face: a 12-sided ring standing in the face plane.
  const dial = a * 0.8;
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const pts: P[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      const u = dial * Math.cos(t), v = dial * Math.sin(t);
      pts.push(nx ? { x: nx * stage, y: dialY + v, z: u } : { x: u, y: dialY + v, z: nz * stage });
    }
    ops.push(poly(pts, "ring"));
  }
  ops.push(col(0, 0, spireTop, H, "tip"));
  return ops;
}

/**
 * CN Tower: 553 m. A Y-plan concrete shaft that flares to three legs at the base, the main pod at
 * 346 m, the SkyPod at 447 m, and the steel antenna mast from 457 m to the top.
 */
export function cnTowerOps(s: Size3): FormOp[] {
  const H = s.height;
  const ops: FormOp[] = [];
  const shaft = (y: number) => (y < 0.3 * H ? 0.07 * H - ((0.07 - 0.03) * H * y) / (0.3 * H) : 0.03 * H - ((0.03 - 0.016) * H * (y - 0.3 * H)) / (0.53 * H));
  const levels = Array.from({ length: 11 }, (_, i) => (0.83 * H * i) / 10);
  for (const y of levels) {
    const r = shaft(y);
    ops.push(poly(Array.from({ length: 4 }, (_, k) => ({ x: r * Math.cos((k / 3) * Math.PI * 2 + Math.PI / 2), y, z: r * Math.sin((k / 3) * Math.PI * 2 + Math.PI / 2) })), y === 0 ? "base" : "ring"));
  }
  for (let k = 0; k < 3; k++) {
    const t = (k / 3) * Math.PI * 2 + Math.PI / 2;
    ops.push(poly(levels.map((y) => ({ x: shaft(y) * Math.cos(t), y, z: shaft(y) * Math.sin(t) })), "leg"));
  }
  ops.push({ op: "shell", y0: 0.6 * H, y1: 0.665 * H, r: 0.05 * H, profile: "drum", role: "ring" });
  ops.push({ op: "ring", y: 0.6 * H, rx: 0.05 * H, n: 12, role: "rail" });
  // The SkyPod reads at no less than one stick across.
  const rs = Math.max(0.032 * H, 1);
  for (const f of [0.795, 0.82]) ops.push(poly(hoop(0, f * H, rs, 6), "ring"));
  for (let k = 0; k < 6; k += 2) {
    const t = (k / 6) * Math.PI * 2;
    ops.push(poly([{ x: rs * Math.cos(t), y: 0.795 * H, z: rs * Math.sin(t) }, { x: rs * Math.cos(t), y: 0.82 * H, z: rs * Math.sin(t) }], "leg"));
  }
  ops.push(col(0, 0, 0.83 * H, H, "tip"));
  return ops;
}

// ── Arch bridges ──────────────────────────────────────────────────────────────────────────────────
/**
 * Through-arch bridge (Sydney Harbour proportions): 503 m between the bearings, the arch top 134 m
 * up, the deck 49 m up hung from the arch mid-span and carried on posts near the ends, a granite
 * pylon at each end.
 */
export function archBridgeOps(s: Size3): FormOp[] {
  const H = s.height;
  const span = s.width;
  const depth = s.depth;
  const x0 = -span / 2, x1 = span / 2, z0 = -depth / 2, z1 = depth / 2;
  const deckY = H * (49 / 134);
  const inner = span * 0.4;
  const lower = (x: number) => 0.9 * H * (1 - (x / inner) ** 2);
  const upper = (x: number) => H - (H - deckY * 1.25) * (x / inner) ** 2;
  const ops: FormOp[] = [];
  const n = 16;
  for (const z of [z0, z1]) {
    const xs = Array.from({ length: n + 1 }, (_, i) => -inner + (2 * inner * i) / n);
    ops.push(poly(xs.map((x) => ({ x, y: lower(x), z })), "support"));
    ops.push(poly(xs.map((x) => ({ x, y: upper(x), z })), "support"));
    for (const [i, x] of xs.entries()) {
      ops.push(poly([{ x, y: lower(x), z }, { x, y: upper(x), z }], "leg"));
      if (i < n) ops.push(poly([{ x, y: lower(x), z }, { x: xs[i + 1], y: upper(xs[i + 1]), z }], "brace"));
      // Hangers drop from the arch to the deck; near the bearings posts stand on the arch under the deck.
      if (lower(x) > deckY + 0.3) ops.push(col(x, z, deckY, lower(x), "brace"));
      else if (lower(x) < deckY - 0.3) ops.push(col(x, z, lower(x), deckY, "leg"));
    }
    ops.push(poly([{ x: x0, y: deckY, z }, { x: x1, y: deckY, z }], "rail"));
  }
  for (let i = 0; i <= n; i++) {
    const x = x0 + (span * i) / n;
    ops.push(poly([{ x, y: deckY, z: z0 }, { x, y: deckY, z: z1 }], "rail"));
  }
  for (const x of [-inner, inner]) ops.push(poly([{ x, y: H * 0.66, z: z0 }, { x, y: H * 0.66, z: z1 }], "rail"));
  for (const cx of [-inner, inner]) for (const [dx, dz] of [[-1, z0], [1, z0], [-1, z1], [1, z1]] as const) ops.push(col(cx + dx * span * 0.03, dz, 0, H * 0.66));
  for (const x of [x0, x1]) for (const z of [z0, z1]) ops.push(col(x, z, 0, deckY));
  return ops;
}
