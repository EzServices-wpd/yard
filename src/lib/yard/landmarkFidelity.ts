/**
 * Landmark fidelity, read from the built members: the signature features a stranger names the
 * landmark by, and the published proportions (heights, spans, footprints) within a tolerance.
 * Real figures are public dimensions of the structures; the score is the share of checks met.
 */
import { projectBoxes } from "./contact";
import type { YardProject } from "./types";

type V = { x: number; y: number; z: number };
type Seg = { a: V; b: V; role: string; len: number; dir: V };
export type FidelityCheck = { name: string; ok: boolean; detail: string };
export type Fidelity = { score: number; checks: FidelityCheck[] };

function segments(project: YardProject): Seg[] {
  return projectBoxes(project).map((b) => {
    const e = { x: b.ax[0].x * b.h[0], y: b.ax[0].y * b.h[0], z: b.ax[0].z * b.h[0] };
    const a = { x: b.c.x - e.x, y: b.c.y - e.y, z: b.c.z - e.z };
    const c = { x: b.c.x + e.x, y: b.c.y + e.y, z: b.c.z + e.z };
    const len = 2 * b.h[0];
    return { a, b: c, role: b.role, len, dir: { x: b.ax[0].x, y: b.ax[0].y, z: b.ax[0].z } };
  });
}

const near = (v: number, want: number, tol: number) => Math.abs(v - want) <= tol;
const r2 = (n: number) => Math.round(n * 100) / 100;

class Shape {
  segs: Seg[];
  min: V;
  max: V;
  H: number;
  L: number;
  constructor(project: YardProject) {
    this.segs = segments(project);
    const pts = this.segs.flatMap((s) => [s.a, s.b]);
    const lo = (k: keyof V) => Math.min(...pts.map((p) => p[k]));
    const hi = (k: keyof V) => Math.max(...pts.map((p) => p[k]));
    this.min = { x: lo("x"), y: lo("y"), z: lo("z") };
    this.max = { x: hi("x"), y: hi("y"), z: hi("z") };
    this.H = this.max.y - this.min.y;
    this.L = this.max.x - this.min.x;
  }
  fy(y: number) { return (y - this.min.y) / this.H; }
  /** Points of every member inside a height band (fractions of H), sampled along its length. */
  band(f0: number, f1: number): V[] {
    const y0 = this.min.y + f0 * this.H, y1 = this.min.y + f1 * this.H;
    const out: V[] = [];
    for (const s of this.segs) for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const p = { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t, z: s.a.z + (s.b.z - s.a.z) * t };
      if (p.y >= y0 && p.y <= y1) out.push(p);
    }
    return out;
  }
  /** Widest plan extent (x or z) of the members in a band. */
  width(f0: number, f1: number) {
    const ps = this.band(f0, f1);
    if (!ps.length) return 0;
    const ext = (k: "x" | "z") => Math.max(...ps.map((p) => p[k])) - Math.min(...ps.map((p) => p[k]));
    return Math.max(ext("x"), ext("z"));
  }
  centreX(f0: number, f1: number) {
    const ps = this.band(f0, f1);
    return ps.length ? (Math.max(...ps.map((p) => p.x)) + Math.min(...ps.map((p) => p.x))) / 2 : 0;
  }
  vertical(s: Seg) { return Math.abs(s.dir.y) >= 0.85; }
  level(s: Seg) { return Math.abs(s.dir.y) <= 0.2; }
}

const check = (checks: FidelityCheck[], name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

/** Suspension bridge: published span and tower ratios plus the features that name it. */
function suspension(sh: Shape, spec: { lOverH: number; deck: number; main: number; piers: number; stays: boolean; walkway?: number }): FidelityCheck[] {
  const c: FidelityCheck[] = [];
  const tall = sh.segs.filter((s) => sh.vertical(s) && sh.fy(Math.max(s.a.y, s.b.y)) >= 0.8);
  const xs = [...new Set(tall.map((s) => r2(s.a.x)))].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const x of xs) {
    const last = clusters[clusters.length - 1];
    if (last && x - last[last.length - 1] <= sh.L * 0.08) last.push(x);
    else clusters.push([x]);
  }
  const towers = clusters.map((g) => (g[0] + g[g.length - 1]) / 2);
  check(c, "two towers", towers.length === 2, `${towers.length} tower(s)`);
  check(c, "length : tower height", near(sh.L / sh.H, spec.lOverH, spec.lOverH * 0.3), `${r2(sh.L / sh.H)} (real ${spec.lOverH})`);
  // Deck: the height carrying the most run of level members along the span.
  const runs = new Map<number, number>();
  for (const s of sh.segs) if (sh.level(s) && Math.abs(s.dir.x) > 0.9) runs.set(Math.round(sh.fy((s.a.y + s.b.y) / 2) * 50) / 50, (runs.get(Math.round(sh.fy((s.a.y + s.b.y) / 2) * 50) / 50) ?? 0) + s.len);
  const deck = [...runs.entries()].filter(([f]) => f > 0.05).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  check(c, "deck height", near(deck, spec.deck, 0.07), `${r2(deck)} of the tower (real ${spec.deck})`);
  if (towers.length === 2) {
    const main = (towers[1] - towers[0]) / sh.L;
    check(c, "main span share", near(main, spec.main, 0.08), `${r2(main)} (real ${spec.main})`);
    const mid = (towers[0] + towers[1]) / 2, half = (towers[1] - towers[0]) / 2;
    const deckY = sh.min.y + deck * sh.H;
    if (spec.walkway) {
      // High-level walkways tower to tower; the central span stays open between the deck and the walkways.
      const wy = spec.walkway;
      const walk = sh.segs.filter((s) => sh.level(s) && Math.abs(s.dir.x) > 0.9 && near(sh.fy(s.a.y), wy, 0.08) && Math.abs((s.a.x + s.b.x) / 2 - mid) < half);
      const run = walk.reduce((n, s) => n + s.len, 0);
      check(c, "high-level walkways", run >= 2 * (towers[1] - towers[0]) * 0.8, `${r2(run)} of walkway run (real ${wy} of the tower)`);
      const deckFrac = deck;
      const between = sh.segs.filter((s) => Math.abs((s.a.x + s.b.x) / 2 - mid) < half * 0.7 && sh.fy(Math.min(s.a.y, s.b.y)) > deckFrac + 0.12 && sh.fy(Math.max(s.a.y, s.b.y)) < wy - 0.1);
      check(c, "central span open below the walkways", between.length === 0, `${between.length} member(s) in the opening`);
    } else {
      const hangers = sh.segs.filter((s) => sh.vertical(s) && Math.abs(s.a.x - mid) < half * 0.85 && Math.min(s.a.y, s.b.y) >= deckY - 0.3 && sh.fy(Math.max(s.a.y, s.b.y)) < 0.95);
      check(c, "hangers from the cable", hangers.length >= 12, `${hangers.length}`);
      const cable = sh.segs.filter((s) => !sh.vertical(s) && Math.abs((s.a.x + s.b.x) / 2 - mid) < half * 0.2 && Math.min(s.a.y, s.b.y) > deckY + 0.2);
      const low = cable.length ? Math.min(...cable.map((s) => Math.min(s.a.y, s.b.y))) : Infinity;
      check(c, "cable sags to the deck mid-span", (low - deckY) / (sh.max.y - deckY) <= 0.25, `${r2((low - deckY) / (sh.max.y - deckY))} of the tower above the deck`);
    }
    const side = sh.segs.filter((s) => !sh.vertical(s) && !sh.level(s) && ((s.a.x + s.b.x) / 2 < towers[0] || (s.a.x + s.b.x) / 2 > towers[1]));
    check(c, "side-span cables", side.length >= 4, `${side.length}`);
    const legs = tall.filter((s) => Math.abs(s.a.x - towers[0]) < sh.L * 0.05);
    const zs = new Set(legs.map((s) => r2(s.a.z)));
    check(c, spec.piers === 3 ? "masonry towers with twin arches (3 piers)" : "two-leg towers", zs.size >= spec.piers && (spec.piers === 3 || zs.size <= 3), `${zs.size} leg line(s) across`);
    if (spec.walkway) {
      // Masonry towers: the walkways tie them at the top, so no portal struts are asked for.
    } else if (spec.stays) {
      // Stays: straight sloped members beside a tower (not in it) that come down near the deck, where the
      // main cable is still high.
      const stays = sh.segs.filter((s) => {
        const sl = Math.abs(s.dir.y);
        const lo = s.a.y < s.b.y ? s.a : s.b;
        const mx = (s.a.x + s.b.x) / 2;
        return sl > 0.15 && sl < 0.85 && towers.some((t) => Math.abs(mx - t) > sh.L * 0.03 && Math.abs(mx - t) < half * 0.4) && lo.y < deckY + (sh.max.y - deckY) * 0.3 && Math.abs(lo.x - mid) < half;
      });
      check(c, "diagonal stays fan from the towers", stays.length >= 8, `${stays.length}`);
    } else {
      const struts = new Set(sh.segs.filter((s) => sh.level(s) && Math.abs(s.dir.z) > 0.9 && towers.some((t) => Math.abs(s.a.x - t) < sh.L * 0.05) && s.a.y > deckY + 0.5).map((s) => r2(sh.fy(s.a.y))));
      check(c, "portal struts across the towers", struts.size >= 3, `${struts.size} level(s)`);
    }
  }
  return c;
}

function truss(sh: Shape): FidelityCheck[] {
  const c: FidelityCheck[] = [];
  const chords = sh.segs.filter((s) => sh.level(s) && Math.abs(s.dir.x) > 0.9);
  const levels = new Map<string, number>();
  for (const s of chords) {
    const k = `${r2(sh.fy(s.a.y))}|${r2(s.a.z)}`;
    levels.set(k, (levels.get(k) ?? 0) + s.len);
  }
  const long = [...levels.entries()].filter(([, len]) => len >= sh.L * 0.75).map(([k]) => k.split("|").map(Number));
  const planes = new Set(long.map(([, z]) => z));
  const ys = new Set(long.map(([y]) => y));
  check(c, "two truss planes", planes.size >= 2, `${planes.size}`);
  check(c, "top and bottom chords", ys.size >= 2, `${ys.size} chord level(s)`);
  const web = sh.segs.filter((s) => !sh.vertical(s) && !sh.level(s) && Math.abs(s.dir.z) < 0.3);
  check(c, "triangulated web", web.length >= 8, `${web.length} diagonals`);
  const beams = sh.segs.filter((s) => sh.level(s) && Math.abs(s.dir.z) > 0.9);
  check(c, "floor beams across", beams.length >= 4, `${beams.length}`);
  const yl = [...ys].sort((a, b) => a - b);
  const depth = yl.length >= 2 ? ((yl[yl.length - 1] - yl[0]) * sh.H) / sh.L : 0;
  check(c, "truss depth : span", depth >= 1 / 12 && depth <= 1 / 3, `${r2(depth)} (real 1/10 to 1/5)`);
  const ends = sh.segs.filter((s) => Math.min(s.a.y, s.b.y) <= sh.min.y + 0.1);
  const lefts = ends.some((s) => Math.min(s.a.x, s.b.x) <= sh.min.x + sh.L * 0.1);
  const rights = ends.some((s) => Math.max(s.a.x, s.b.x) >= sh.max.x - sh.L * 0.1);
  check(c, "bears on both banks", lefts && rights, `${lefts}/${rights}`);
  return c;
}

const SPECS: Record<string, (sh: Shape) => FidelityCheck[]> = {
  "golden gate": (sh) => suspension(sh, { lOverH: 8.65, deck: 0.29, main: 0.65, piers: 2, stays: false }),
  brooklyn: (sh) => suspension(sh, { lOverH: 12.5, deck: 0.46, main: 0.46, piers: 3, stays: true }),
  "tower bridge": (sh) => suspension(sh, { lOverH: 3.75, deck: 0.14, main: 0.25, piers: 3, stays: false, walkway: 0.68 }),
  truss: truss,
  eiffel: (sh) => {
    const c: FidelityCheck[] = [];
    const base = sh.width(0, 0.02);
    check(c, "base : height", near(base / sh.H, 0.38, 0.06), `${r2(base / sh.H)} (real 0.38)`);
    check(c, "waist at half height", near(sh.width(0.48, 0.52) / base, 0.19, 0.08), `${r2(sh.width(0.48, 0.52) / base)} of the base (real ~0.19)`);
    check(c, "needle top", sh.width(0.9, 0.95) / base <= 0.1, `${r2(sh.width(0.9, 0.95) / base)}`);
    const open = sh.band(0, 0.05).filter((p) => Math.abs(p.x - (sh.min.x + sh.max.x) / 2) < base * 0.2 && Math.abs(p.z - (sh.min.z + sh.max.z) / 2) < base * 0.2);
    check(c, "four legs open at the base", open.length === 0, `${open.length} member points in the middle`);
    // Four arches between the legs, crowned under the first platform (real crown about 40 m of 324 m).
    const arch = sh.segs.filter((s) => s.role === "support" && sh.fy(Math.max(s.a.y, s.b.y)) < 0.2);
    const crown = arch.length ? Math.max(...arch.map((s) => sh.fy(Math.max(s.a.y, s.b.y)))) : 0;
    check(c, "four arches at the base", arch.length >= 16 && near(crown, 0.13, 0.04), `${arch.length} arch members, crown at ${r2(crown)} of the height (real 0.12)`);
    const deckLevels = [0.175, 0.35, 0.84].filter((f) => sh.width(f - 0.02, f + 0.02) >= sh.width(f + 0.04, f + 0.06) * 1.02);
    check(c, "three platforms", deckLevels.length >= 2, `${deckLevels.length} of 3 read as platforms`);
    check(c, "lattice", sh.segs.length >= 200, `${sh.segs.length} members`);
    return c;
  },
  "cn tower": (sh) => {
    const c: FidelityCheck[] = [];
    const shaft = sh.width(0.45, 0.5);
    check(c, "slender shaft", shaft / sh.H <= 0.08, `${r2(shaft / sh.H)}`);
    check(c, "tripod base flares", sh.width(0, 0.04) >= shaft * 1.6, `${r2(sh.width(0, 0.04) / Math.max(shaft, 1e-6))}× the shaft`);
    check(c, "main pod at 0.63", sh.width(0.6, 0.66) >= shaft * 2, `${r2(sh.width(0.6, 0.66) / Math.max(shaft, 1e-6))}× the shaft`);
    check(c, "SkyPod at 0.81", sh.width(0.79, 0.82) > sh.width(0.73, 0.76) * 1.1, `${r2(sh.width(0.79, 0.82))} vs ${r2(sh.width(0.73, 0.76))}`);
    check(c, "antenna mast", sh.width(0.88, 0.97) <= shaft * 0.5, `${r2(sh.width(0.88, 0.97))}`);
    return c;
  },
  pisa: (sh) => {
    const c: FidelityCheck[] = [];
    const base = sh.width(0, 0.05);
    check(c, "diameter : height", near(base / sh.H, 0.3, 0.06), `${r2(base / sh.H)} (real 0.27 plus the lean)`);
    const lean = (sh.centreX(0.9, 0.95) - sh.centreX(0, 0.05)) / sh.H;
    check(c, "leans about 4°", near(Math.abs(lean), 0.069, 0.03), `${r2(lean)} (real 0.069)`);
    const rings = new Set(sh.segs.filter((s) => sh.level(s)).map((s) => Math.round(sh.fy(s.a.y) * 40)));
    check(c, "eight storeys", rings.size >= 8, `${rings.size} ring levels`);
    check(c, "belfry narrower on top", sh.width(0.92, 0.99) < sh.width(0.5, 0.55), `${r2(sh.width(0.92, 0.99))} vs ${r2(sh.width(0.5, 0.55))}`);
    const cols = sh.segs.filter((s) => sh.vertical(s) || Math.abs(s.dir.y) > 0.95 - 0.1);
    check(c, "arcade columns", cols.length >= 40, `${cols.length}`);
    return c;
  },
  "big ben": (sh) => {
    const c: FidelityCheck[] = [];
    const shaft = sh.width(0.2, 0.4);
    check(c, "shaft : height", near(shaft / sh.H, 0.125, 0.04), `${r2(shaft / sh.H)} (real 0.125)`);
    const faces = sh.segs.filter((s) => s.role === "ring" && sh.fy((s.a.y + s.b.y) / 2) > 0.5 && sh.fy((s.a.y + s.b.y) / 2) < 0.68);
    check(c, "clock faces at 0.57", faces.length >= 8, `${faces.length} dial members`);
    check(c, "clock stage stands proud", sh.width(0.55, 0.6) >= shaft * 1.05, `${r2(sh.width(0.55, 0.6) / Math.max(shaft, 1e-6))}× the shaft`);
    check(c, "pyramid spire", sh.width(0.88, 0.94) <= shaft * 0.6 && sh.width(0.88, 0.94) > 0, `${r2(sh.width(0.88, 0.94) / Math.max(shaft, 1e-6))}× the shaft`);
    const xz = (() => { const ps = sh.band(0.2, 0.4); const ex = (k: "x" | "z") => Math.max(...ps.map((p) => p[k])) - Math.min(...ps.map((p) => p[k])); return ps.length ? ex("x") / ex("z") : 0; })();
    check(c, "square plan", near(xz, 1, 0.1), `${r2(xz)}`);
    return c;
  },
  lighthouse: (sh) => {
    const c: FidelityCheck[] = [];
    check(c, "tower tapers", sh.width(0, 0.1) >= sh.width(0.55, 0.62) * 1.25, `${r2(sh.width(0, 0.1))} vs ${r2(sh.width(0.55, 0.62))}`);
    check(c, "gallery overhangs", sh.width(0.69, 0.75) >= sh.width(0.6, 0.66) * 1.2, `${r2(sh.width(0.69, 0.75))} vs ${r2(sh.width(0.6, 0.66))}`);
    check(c, "lantern room above", sh.width(0.77, 0.83) > 0 && sh.width(0.77, 0.83) < sh.width(0.69, 0.75), `${r2(sh.width(0.77, 0.83))}`);
    check(c, "cap on top", sh.width(0.96, 1) < sh.width(0.77, 0.83), `${r2(sh.width(0.96, 1))}`);
    check(c, "height : base", sh.H / Math.max(sh.width(0, 0.05), 1e-6) >= 3, `${r2(sh.H / Math.max(sh.width(0, 0.05), 1e-6))}`);
    return c;
  },
};

export const FIDELITY_KEYS = Object.keys(SPECS);

export function landmarkFidelity(project: YardProject, key: string): Fidelity {
  if (!project.instances.length) return { score: 0, checks: [{ name: "built as members", ok: false, detail: `${project.panels.length} panels, no frame` }] };
  const checks = SPECS[key](new Shape(project));
  return { score: Math.round((checks.filter((x) => x.ok).length / checks.length) * 100), checks };
}
