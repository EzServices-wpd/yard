/**
 * Rod arrays (class F32 follow-up): a row of two or more like round rods (dowels, pipes, rungs, spindles, wires)
 * running side by side, and whatever is strung on them (beads, rollers, spools). Every rod and every strung part
 * must fit inside the clear span between the parts that bound the row (no sinking into a post), and neighbouring
 * columns must clear each other (bare rods may lie glued side by side, never through each other). One rule for every build: nothing here names a build.
 */
import { getCatalogItem } from "./catalog";
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

/** Every rod array in a build: a family of ≥2 parallel round rods spread along one axis, and what rides on them. */
export function rodArrays(panels: Panel[]): RodArray[] {
  const groups = new Map<string, Panel[]>();
  for (const p of panels) if (isRound(p)) groups.set(fam(p), [...(groups.get(fam(p)) ?? []), p]);
  const out: RodArray[] = [];
  for (const [family, all] of groups) {
    if (all.length < 2) continue;
    const long = [...AX].sort((a, b) => all[0].size[b[1]] - all[0].size[a[1]])[0];
    const cross = AX.filter((x) => x !== long);
    // Rods: long and thin, all along one axis, all one section.
    if (!all.every((r) => r.size[long[1]] >= 3 * Math.max(...cross.map(([, k]) => r.size[k])) && cross.every(([, k]) => Math.abs(r.size[k] - all[0].size[k]) < 0.01))) continue;
    const spread = (ax: Axis) => Math.max(...all.map((r) => mid(r, ax))) - Math.min(...all.map((r) => mid(r, ax)));
    const [row, third] = [...cross].sort((a, b) => spread(b) - spread(a));
    // One row: side by side along one axis, level with each other along their length and across it.
    if (spread(row) < 0.1 || spread(third) > 0.05 || spread(long) > 0.05) continue;
    const rods = [...all].sort((a, b) => mid(a, row) - mid(b, row));
    const pitch = spread(row) / (rods.length - 1);
    // Strung on a rod: round across the rod (both cross sides one diameter), holds the rod's centre line, lies along it.
    const strung = rods.map((r) => panels.filter((q) => q !== r && !rods.includes(q) && q.size[row[1]] < 2 * pitch && Math.abs(q.size[row[1]] - q.size[third[1]]) <= 0.1 * q.size[row[1]] &&
      [row, third].every((ax) => lo(q, ax) < mid(r, ax) && hi(q, ax) > mid(r, ax)) && lo(q, long) >= lo(r, long) - 0.01 && hi(q, long) <= hi(r, long) + 0.01));
    const members = [...rods, ...strung.flat()];
    const span = (ax: Axis) => [Math.min(...members.map((m) => lo(m, ax))), Math.max(...members.map((m) => hi(m, ax)))];
    const [l0, l1] = span(long), [t0, t1] = span(third);
    const a0 = mid(rods[0], row), a1 = mid(rods[rods.length - 1], row);
    // Bounds: parts beside the row (their middle outside the first and last rods) that share its length and depth.
    const beside = panels.filter((q) => !members.includes(q) && lo(q, long) < l1 - 0.01 && hi(q, long) > l0 + 0.01 && lo(q, third) < t1 - 0.01 && hi(q, third) > t0 + 0.01);
    const left = beside.filter((q) => mid(q, row) < a0), right = beside.filter((q) => mid(q, row) > a1);
    out.push({ family, rods, long, row, third, strung,
      ...(left.length && right.length ? { L: Math.max(...left.map((q) => hi(q, row))), R: Math.min(...right.map((q) => lo(q, row))) } : {}) });
  }
  return out;
}

/** A column's extent along the row: the rod and everything strung on it. */
export function columnSpan(arr: RodArray, i: number): [number, number] {
  const ps = [arr.rods[i], ...arr.strung[i]];
  return [Math.min(...ps.map((p) => lo(p, arr.row))), Math.max(...ps.map((p) => hi(p, arr.row)))];
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
