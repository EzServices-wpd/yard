/**
 * Rod arrays (class F32 follow-up): a row of two or more like round rods (dowels, pipes, rungs, spindles, wires)
 * running side by side, and whatever is strung on them (beads, rollers, spools). Every rod and every strung part
 * must fit inside the clear span between the parts that bound the row (no sinking into a post), and neighbouring
 * columns must clear each other (bare rods may lie glued side by side, never through each other). One rule for every build: nothing here names a build.
 */
import { CATALOG_BY_ID, getCatalogItem } from "./catalog";
import type { Panel } from "./types";

export const ROW_CLEAR = 1 / 16; // between neighbouring columns, as laid out
export const TOUCH = 1 / 32; // closer than this, neighbours touch

const AX = [["x", "width"], ["y", "height"], ["z", "depth"]] as const;
export type Axis = (typeof AX)[number];

const ROUND = new Set(["dowel", "tube", "pipe"]);
const isRound = (p: Panel) => ROUND.has(getCatalogItem(p.materialId)?.formFactor ?? "") && !p.strut && !p.form;
const fam = (p: Panel) => p.name.replace(/ \d+$/, "");
const mid = (p: Panel, [a, k]: Axis) => p.position[a] + p.size[k] / 2;
const lo = (p: Panel, [a]: Axis) => p.position[a];
const hi = (p: Panel, [a, k]: Axis) => p.position[a] + p.size[k];

export type RodArray = {
  family: string;
  rods: Panel[]; // sorted along the row
  long: Axis; row: Axis; third: Axis;
  /** The parts strung on each rod (same order as rods). */
  strung: Panel[][];
  /** Inner faces of the parts that bound the row, when there are parts on both sides. */
  L?: number; R?: number;
};

/**
 * Every rod array in a build: a family of ≥2 parallel round rods spread along one axis, and what rides on them;
 * or a single rod carrying riders between parts that bound it on both sides (a one-rod abacus).
 */
export function rodArrays(panels: Panel[]): RodArray[] {
  const groups = new Map<string, Panel[]>();
  for (const p of panels) if (isRound(p)) groups.set(fam(p), [...(groups.get(fam(p)) ?? []), p]);
  const out: RodArray[] = [];
  for (const [family, all] of groups) {
    const long = [...AX].sort((a, b) => all[0].size[b[1]] - all[0].size[a[1]])[0];
    const cross = AX.filter((x) => x !== long);
    // Rods: long and thin, all along one axis, all one section.
    if (!all.every((r) => r.size[long[1]] >= 3 * Math.max(...cross.map(([, k]) => r.size[k])) && cross.every(([, k]) => Math.abs(r.size[k] - all[0].size[k]) < 0.01))) continue;
    const spread = (ax: Axis) => Math.max(...all.map((r) => mid(r, ax))) - Math.min(...all.map((r) => mid(r, ax)));
    if (all.length >= 2) {
      const [row, third] = [...cross].sort((a, b) => spread(b) - spread(a));
      // One row: side by side along one axis, level with each other along their length and across it.
      if (spread(row) < 0.1 || spread(third) > 0.05 || spread(long) > 0.05) continue;
      out.push(rowOf(panels, family, all, long, row, third));
      continue;
    }
    // A single rod: a row of one only when it carries riders (beads, small beside its length, never a wheel as
    // big as its axle) and parts bound it on both sides across its length.
    const small = (r: RodArray) => r.strung[0].every((b) => Math.max(b.size[r.row[1]], b.size[r.third[1]]) <= 0.25 * r.rods[0].size[long[1]]);
    const held = cross.map((row) => rowOf(panels, family, all, long, row, cross.find((x) => x !== row)!)).find((r) => r.strung[0].length >= 2 && small(r) && r.L != null && r.R != null);
    if (held) out.push(held);
  }
  return out;
}

function rowOf(panels: Panel[], family: string, all: Panel[], long: Axis, row: Axis, third: Axis): RodArray {
  const rods = [...all].sort((a, b) => mid(a, row) - mid(b, row));
  // A rider: round across the rod (both cross sides one diameter), holding a rod's centre line, lying along it.
  // Each rider rides on exactly one rod, the one nearest its middle.
  const riders = panels.filter((q) => !rods.includes(q) && Math.abs(q.size[row[1]] - q.size[third[1]]) <= 0.1 * q.size[row[1]] &&
    rods.some((r) => [row, third].every((ax) => lo(q, ax) < mid(r, ax) && hi(q, ax) > mid(r, ax)) && lo(q, long) >= lo(r, long) - 0.01 && hi(q, long) <= hi(r, long) + 0.01));
  const strung: Panel[][] = rods.map(() => []);
  for (const q of riders) {
    const i = rods.reduce((m, r, j) => (Math.abs(mid(r, row) - mid(q, row)) < Math.abs(mid(rods[m], row) - mid(q, row)) ? j : m), 0);
    strung[i].push(q);
  }
  const members = [...rods, ...riders];
  const span = (ax: Axis) => [Math.min(...members.map((m) => lo(m, ax))), Math.max(...members.map((m) => hi(m, ax)))];
  const [l0, l1] = span(long), [t0, t1] = span(third);
  const centre = (mid(rods[0], row) + mid(rods[rods.length - 1], row)) / 2;
  // Bounds: parts that share the row's length and depth and stand to one side of its centre without crossing it
  // (end posts), even when a narrow row's rods were set inside them. Rails the rods are set in cross the centre.
  // A bound runs alongside the row (an end post, a side): it shares most of the row's length. A part a rod
  // meets at a joint (a foot, a socket, a crossing arm or rail) is not a bound, even when it holds the rod.
  const alongside = (q: Panel) => Math.min(hi(q, long), l1) - Math.max(lo(q, long), l0) >= 0.5 * (l1 - l0);
  const beside = panels.filter((q) => !members.includes(q) && alongside(q) && lo(q, third) < t1 - 0.01 && hi(q, third) > t0 + 0.01);
  // A part that reaches past the centre (a narrow build whose posts were set wider than its span) still bounds
  // the side its middle is on, as long as it stops short of the row's far end rod.
  const first = mid(rods[0], row), last = mid(rods[rods.length - 1], row);
  const one = rods.length === 1;
  // Posts that met over a narrow row (each reaching past both its end rods) still bound the side their middle is
  // on, when that middle stands clearly off the row's centre; a part centred on the row (a back, a rail) never does.
  const off = (q: Panel) => Math.abs(mid(q, row) - centre) > 0.05;
  const left = beside.filter((q) => hi(q, row) <= centre + 1e-6 || (mid(q, row) < centre && (one || hi(q, row) < last - 1e-6 || (off(q) && lo(q, row) < first))));
  const right = beside.filter((q) => !left.includes(q) && (lo(q, row) >= centre - 1e-6 || (mid(q, row) > centre && (one || lo(q, row) > first + 1e-6 || (off(q) && hi(q, row) > last)))));
  // A row every rod of which lies inside those parts, one rod to a part (a sleeve, a doubled member), is part of
  // them, not bounded by them. A part holding two or more of the row's rods is a row crowded into its bounds
  // (a narrow build whose posts met over it): it still bounds the row, so the row is fitted between them. A row
  // carrying riders is never a sleeve: its riders slide on rods that must stand clear of the parts beside them.
  const holds = (q: Panel, r: Panel) => [row, third].every((ax) => lo(q, ax) < mid(r, ax) && hi(q, ax) > mid(r, ax));
  const sides = [...left, ...right];
  const sleeved = !riders.length && rods.every((r) => sides.some((q) => holds(q, r))) && sides.every((q) => rods.filter((r) => holds(q, r)).length <= 1);
  const bounded = left.length && right.length && !sleeved;
  return { family, rods, long, row, third, strung,
    ...(bounded ? { L: Math.max(...left.map((q) => hi(q, row))), R: Math.min(...right.map((q) => lo(q, row))) } : {}) };
}

/** A column's extent along the row: the rod and everything strung on it. */
export function columnSpan(arr: RodArray, i: number): [number, number] {
  const ps = [arr.rods[i], ...arr.strung[i]];
  return [Math.min(...ps.map((p) => lo(p, arr.row))), Math.max(...ps.map((p) => hi(p, arr.row)))];
}

/**
 * The thinnest legal rider on a rod (I30, I36): a whole dowel that takes the rod's running bore with a 1/16" wall
 * each side. A bead under this splits on its bore; Yard never cuts one smaller.
 */
export function riderFloor(rodDia: number): number {
  const dowels = Object.values(CATALOG_BY_ID).filter((c) => c.formFactor === "dowel" && /^dowel-/.test(c.id)).map((c) => c.dims.diameter ?? 0).filter((d) => d > 0).sort((x, y) => x - y);
  return dowels.find((d) => d >= rodDia + 1 / 4 - 1e-6) ?? rodDia + 1 / 4;
}


type V3 = { x: number; y: number; z: number };
type Inst = { catalogId?: string; role?: string; name?: string; from?: V3; to?: V3; position?: V3; size?: { width: number; height: number; depth: number } };
/**
 * Stick builds place round stock as instances (a dowel from one point to another): each straight, axis-aligned one
 * is read as a rod box of its stock's diameter, so the same rule covers them. Others are left out.
 */
export function instanceRods(instances: Inst[] = []): Panel[] {
  const out: Panel[] = [];
  const count = new Map<string, number>();
  for (const i of instances) {
    const it = i.catalogId ? getCatalogItem(i.catalogId) : undefined;
    const d = it?.dims.diameter ?? (it && ROUND.has(it.formFactor ?? "") ? it.dims.width : undefined);
    if (!it || !ROUND.has(it.formFactor ?? "") || !d || !i.from || !i.to) continue;
    const delta = AX.map(([a]) => Math.abs(i.to![a] - i.from![a]));
    if (delta.filter((x) => x > 1e-3).length !== 1) continue;
    const r = d / 2;
    const lo3 = AX.map(([a], j) => (delta[j] > 1e-3 ? Math.min(i.from![a], i.to![a]) : i.from![a] - r));
    const sz = AX.map((_, j) => (delta[j] > 1e-3 ? delta[j] : d));
    const fam0 = i.role ?? i.name ?? "stick";
    const n = (count.get(fam0) ?? 0) + 1;
    count.set(fam0, n);
    out.push({ id: `inst-${fam0}-${n}`, type: "cleat", name: `${fam0} ${n}`, materialId: i.catalogId!, position: { x: lo3[0], y: lo3[1], z: lo3[2] }, size: { width: sz[0], height: sz[1], depth: sz[2] } } as Panel);
  }
  return out;
}

/** Rod-array failures: a column sinking into a part that bounds the row, or touching its neighbour. */
export function rodArrayFailures(project: { panels: Panel[]; instances?: Inst[] }): string[] {
  const out: string[] = [];
  for (const arr of rodArrays([...project.panels, ...instanceRods(project.instances)])) {
    const cols = arr.rods.map((_, i) => columnSpan(arr, i));
    const what = (i: number) => (arr.strung[i].length ? `${arr.rods[i].name} and its ${fam(arr.strung[i][0]).toLowerCase()}s` : arr.rods[i].name);
    if (arr.L != null && cols[0][0] < arr.L - 0.005) out.push(`${what(0)} sink ${(arr.L - cols[0][0]).toFixed(2)}" into the part beside the row`);
    const n = cols.length - 1;
    // Riders spread across every rod in the row, never stacked on some while others stand bare.
    const loads = arr.strung.map((x) => x.length);
    if (Math.max(...loads) > 0 && Math.min(...loads) === 0) out.push(`${arr.family} riders sit on ${loads.filter((k) => k > 0).length} of ${loads.length} rods; the rest stand bare`);
    if (arr.R != null && cols[n][1] > arr.R + 0.005) out.push(`${what(n)} sink ${(cols[n][1] - arr.R).toFixed(2)}" into the part beside the row`);
    for (let i = 1; i < cols.length; i++) {
      const gap = cols[i][0] - cols[i - 1][1];
      // Bare rods may lie glued side by side (a bundle of skewers); strung parts must clear to slide or turn.
      const strung = arr.strung[i].length || arr.strung[i - 1].length;
      if (strung ? gap < TOUCH - 1e-6 : gap < -0.005) { out.push(`${arr.family} columns ${i} and ${i + 1} ${gap < -0.005 ? "overlap" : "touch"} (${gap.toFixed(2)}" apart)`); break; }
    }
  }
  return out;
}
