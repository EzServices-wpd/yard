/**
 * A pipe rack is one square frame. Centre lines that belong on the same pipe
 * move sideways onto it, and an end lengthens or shortens along its own axis
 * until it sits on the pipe it meets. Nothing is tilted to close a gap.
 * A frame that still clashes, gaps, or falls into two pieces is not shipped.
 */
import { createId } from "@/lib/utils";
import type { CatalogItem, Vec3, YardInstance } from "./types";

type Axis = "x" | "y" | "z";
const AXES: Axis[] = ["x", "y", "z"];

/** Two fittings need this much pipe between their centres. */
const FITTING_PITCH = 2.75;
/** A 3/4" fitting body, centre to face. An open end inside this of another pipe is a gap. */
const FITTING_BODY = 1.375;
/** One physical joint. Ends this close are the same node. */
const NODE = 0.05;
const TILT_DEG = 1;

type Meta = {
  role: string;
  join?: string;
  catalogId: string;
  face?: Vec3;
  whole: boolean;
  /** Perpendicular coordinates before any snap, so a later merge cannot walk a pipe off its line. */
  born: [number, number];
};

type Span = Meta & {
  axis: Axis;
  perp: [number, number];
  lo: number;
  hi: number;
};

export type SeatResult = { ok: true; instances: YardInstance[] } | { ok: false; why: string };

const others = (a: Axis): [Axis, Axis] => AXES.filter((x) => x !== a) as [Axis, Axis];

function vlen(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function axisOf(from: Vec3, to: Vec3): { axis: Axis; deg: number } | null {
  const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
  const L = Math.hypot(d.x, d.y, d.z);
  if (L < 0.2) return null;
  let axis: Axis = "x";
  let along = 0;
  for (const a of AXES) {
    const v = Math.abs(d[a]);
    if (v > along) {
      along = v;
      axis = a;
    }
  }
  const lateral = Math.sqrt(Math.max(0, L * L - along * along));
  const deg = (Math.atan2(lateral, along) * 180) / Math.PI;
  return { axis, deg };
}

/**
 * Values within one pipe width share a grid line. Adjacent grid lines stay at least that far apart,
 * and no value moves farther than that from where the outline drew it.
 */
function clusterSnap(values: number[], snap: number): (v: number) => number {
  const uniq: number[] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    if (!uniq.length || v - uniq[uniq.length - 1] > 1e-4) uniq.push(v);
  }
  type Bucket = { vals: number[]; rep: number };
  const clusters: Bucket[] = [];
  for (const v of uniq) {
    const last = clusters[clusters.length - 1];
    if (last && v - last.vals[0] <= snap + 1e-6) last.vals.push(v);
    else clusters.push({ vals: [v], rep: v });
  }
  const repOf = (vals: number[]) => round4(vals.reduce((s, v) => s + v, 0) / vals.length);
  for (const c of clusters) c.rep = repOf(c.vals);
  let guard = 0;
  while (guard++ < 24) {
    let merged = false;
    for (let i = 0; i < clusters.length - 1; i++) {
      if (Math.abs(clusters[i + 1].rep - clusters[i].rep) >= snap - 1e-6) continue;
      const vals = [...clusters[i].vals, ...clusters[i + 1].vals];
      const rep = vals.reduce((s, v) => s + v, 0) / vals.length;
      if (vals.some((v) => Math.abs(v - rep) > snap + 1e-6)) continue;
      clusters.splice(i, 2, { vals, rep: round4(rep) });
      merged = true;
      break;
    }
    if (!merged) break;
  }
  return (v: number) => {
    let best = round4(v);
    let bd = Infinity;
    for (const c of clusters) {
      const d = Math.abs(v - c.rep);
      if (d < bd) {
        bd = d;
        best = c.rep;
      }
    }
    return bd <= snap + 1e-6 ? best : round4(v);
  };
}

function pointOf(axis: Axis, perp: [number, number], t: number): Vec3 {
  const [u, v] = others(axis);
  return { x: 0, y: 0, z: 0, [axis]: t, [u]: perp[0], [v]: perp[1] } as Vec3;
}

function lineKey(s: Span): string {
  return `${s.axis}|${s.perp[0]}|${s.perp[1]}`;
}

/** Overlapping or near-touching runs on one line become one pipe. A real opening stays open. */
function mergeCollinear(spans: Span[], reach: number): Span[] {
  const groups = new Map<string, Span[]>();
  for (const s of spans) {
    const k = lineKey(s);
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const out: Span[] = [];
  for (const group of groups.values()) {
    const sorted = group.slice().sort((a, b) => a.lo - b.lo || b.hi - b.lo - (a.hi - a.lo));
    let cur = { ...sorted[0], born: sorted[0].born };
    for (const s of sorted.slice(1)) {
      if (s.lo <= cur.hi + reach + 1e-6) {
        const longer = s.hi - s.lo > cur.hi - cur.lo ? s : cur;
        cur = { ...longer, lo: Math.min(cur.lo, s.lo), hi: Math.max(cur.hi, s.hi), born: longer.born };
      } else {
        out.push(cur);
        cur = { ...s };
      }
    }
    out.push(cur);
  }
  return out.filter((s) => s.hi - s.lo >= 0.2);
}

function fixedOn(s: Span, axis: Axis): number | null {
  if (s.axis === axis) return null;
  return s.perp[others(s.axis).indexOf(axis)];
}

function crossings(spans: Span[], reach: number): Map<number, number[]> {
  const cuts = new Map<number, number[]>();
  const add = (i: number, t: number) => cuts.set(i, [...(cuts.get(i) ?? []), t]);
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i];
      const b = spans[j];
      if (a.axis === b.axis) continue;
      const shared = AXES.find((ax) => ax !== a.axis && ax !== b.axis)!;
      if (Math.abs(fixedOn(a, shared)! - fixedOn(b, shared)!) > 1e-3) continue;
      const tOnA = fixedOn(b, a.axis)!;
      const tOnB = fixedOn(a, b.axis)!;
      const da = tOnA < a.lo ? a.lo - tOnA : tOnA > a.hi ? tOnA - a.hi : 0;
      const db = tOnB < b.lo ? b.lo - tOnB : tOnB > b.hi ? tOnB - b.hi : 0;
      if (da <= reach + 1e-6 && db <= reach + 1e-6) {
        add(i, round4(tOnA));
        add(j, round4(tOnB));
      }
    }
  }
  return cuts;
}

function applyCuts(span: Span, raw: number[], reach: number): { span: Span; splits: number[] } | string | null {
  const ts = [...new Set(raw.map(round4))].filter((t) => t >= span.lo - reach - 1e-6 && t <= span.hi + reach + 1e-6).sort((a, b) => a - b);
  let a = span.lo;
  let b = span.hi;
  for (const t of ts) {
    if (t < a && span.lo - t <= reach + 1e-6) a = t;
    if (t > b && t - span.hi <= reach + 1e-6) b = t;
  }
  const cuts = ts.filter((t) => t > a + NODE && t < b - NODE);
  let marks = [a, ...cuts, b];
  let guard = 0;
  while (guard++ < 8) {
    const tightAt = marks.findIndex((t, i) => i > 0 && t - marks[i - 1] < FITTING_PITCH - 0.01);
    if (tightAt < 0) break;
    if (marks.length <= 2) return null;
    const drop = tightAt === marks.length - 1 ? marks.length - 2 : tightAt;
    if (drop <= 0 || drop >= marks.length - 1) return null;
    marks = marks.filter((_, i) => i !== drop);
  }
  if (marks[marks.length - 1] - marks[0] < FITTING_PITCH - 0.01) return null;
  return { span: { ...span, lo: round4(marks[0]), hi: round4(marks[marks.length - 1]) }, splits: marks.slice(1, -1).map(round4) };
}

/** Distance between two axis-aligned pipes. Zero when they meet at a shared point. */
function closest(a: Span, b: Span): number {
  if (a.axis === b.axis) {
    const perp = Math.hypot(a.perp[0] - b.perp[0], a.perp[1] - b.perp[1]);
    const gap = a.lo > b.hi ? a.lo - b.hi : b.lo > a.hi ? b.lo - a.hi : 0;
    return Math.hypot(perp, gap);
  }
  const delta = { x: 0, y: 0, z: 0 };
  for (const ax of AXES) {
    const fa = fixedOn(a, ax);
    const fb = fixedOn(b, ax);
    if (fa != null && fb != null) delta[ax] = fa - fb;
    else if (fa != null) delta[ax] = fa - Math.min(b.hi, Math.max(b.lo, fa));
    else if (fb != null) delta[ax] = Math.min(a.hi, Math.max(a.lo, fb)) - fb;
  }
  return Math.hypot(delta.x, delta.y, delta.z);
}

function distPointSpan(p: Vec3, s: Span): number {
  const t = Math.min(s.hi, Math.max(s.lo, p[s.axis]));
  const q = pointOf(s.axis, s.perp, t);
  return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
}

function sharesNode(a: Span, b: Span): boolean {
  const ends = (s: Span) => [s.lo, s.hi];
  for (const ta of ends(a)) {
    for (const tb of ends(b)) {
      const pa = pointOf(a.axis, a.perp, ta);
      const pb = pointOf(b.axis, b.perp, tb);
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z) <= NODE + 1e-6) return true;
    }
  }
  return false;
}

function faults(spans: Span[], od: number): string | null {
  if (spans.length < 2) return "frame has fewer than two pipes";
  const parent = spans.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < spans.length; i++) {
    if (spans[i].hi - spans[i].lo < FITTING_PITCH - 0.01) return "member shorter than a fitting";
    for (let j = i + 1; j < spans.length; j++) {
      if (sharesNode(spans[i], spans[j])) parent[find(j)] = find(i);
      const d = closest(spans[i], spans[j]);
      if (d < od - 0.02 && !sharesNode(spans[i], spans[j])) return "pipes pass through each other";
      if (spans[i].axis === spans[j].axis && spans[i].perp[0] === spans[j].perp[0] && spans[i].perp[1] === spans[j].perp[1]) {
        const gap = spans[i].lo > spans[j].hi ? spans[i].lo - spans[j].hi : spans[j].lo > spans[i].hi ? spans[j].lo - spans[i].hi : 0;
        if (gap > NODE && gap < FITTING_PITCH) return "collinear gap";
      }
    }
  }
  const roots = new Set(spans.map((_, i) => find(i)));
  if (roots.size !== 1) return `${roots.size} pieces`;
  for (const s of spans) {
    for (const t of [s.lo, s.hi]) {
      const p = pointOf(s.axis, s.perp, t);
      let joined = false;
      let near = Infinity;
      for (const o of spans) {
        if (o === s) continue;
        for (const u of [o.lo, o.hi]) {
          const q = pointOf(o.axis, o.perp, u);
          if (Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) <= NODE + 1e-6) joined = true;
        }
        near = Math.min(near, distPointSpan(p, o));
      }
      if (!joined && near <= FITTING_BODY + 1e-6) return "open end inside a fitting";
      if (!joined && near < od - 0.02) return "open end inside a pipe";
    }
  }
  return null;
}

function componentsOf(spans: Span[]): number {
  const parent = spans.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < spans.length; i++) for (let j = i + 1; j < spans.length; j++) if (sharesNode(spans[i], spans[j])) parent[find(j)] = find(i);
  return new Set(spans.map((_, i) => find(i))).size;
}

/**
 * Pull parallel lines that cannot hold two fittings onto one line,
 * but only when neither pipe leaves the line it was drawn on by more than one pipe width.
 */
function mergeCloseLines(spans: Span[], limit: number): Span[] | string {
  let cur = spans.map((s) => ({ ...s }));
  const banned = new Set<string>();
  const pairKey = (i: number, j: number) => (i < j ? `${i}:${j}` : `${j}:${i}`);
  let guard = 0;
  while (guard++ < 40) {
    let pair: [number, number] | null = null;
    let best = Infinity;
    for (let i = 0; i < cur.length; i++) {
      for (let j = i + 1; j < cur.length; j++) {
        if (banned.has(pairKey(i, j))) continue;
        const a = cur[i];
        const b = cur[j];
        if (a.axis !== b.axis) continue;
        const d = Math.hypot(a.perp[0] - b.perp[0], a.perp[1] - b.perp[1]);
        if (d > NODE && d < FITTING_PITCH - 1e-6 && d < best) {
          best = d;
          pair = [i, j];
        }
      }
    }
    if (!pair) break;
    const [i, j] = pair;
    const a = cur[i];
    const b = cur[j];
    const perp: [number, number] = [round4((a.perp[0] + b.perp[0]) / 2), round4((a.perp[1] + b.perp[1]) / 2)];
    const moved = (s: Span) => Math.hypot(s.born[0] - perp[0], s.born[1] - perp[1]);
    if (moved(a) > limit + 1e-6 || moved(b) > limit + 1e-6) {
      banned.add(pairKey(i, j));
      continue;
    }
    banned.clear();
    const host = a.hi - a.lo >= b.hi - b.lo ? a : b;
    const merged: Span = { ...host, perp, lo: Math.min(a.lo, b.lo), hi: Math.max(a.hi, b.hi) };
    cur = cur.filter((_, k) => k !== i && k !== j);
    cur.push(merged);
    cur = mergeCollinear(cur, FITTING_BODY);
  }
  return cur;
}

/** A loose peg, kick, or divider shifts parallel to itself onto the frame, then lengthens along its own axis. */
function dockOrphans(spans: Span[]): Span[] {
  const budget = 4;
  let cur = spans.map((s) => ({ ...s }));
  for (let pass = 0; pass < 8; pass++) {
    const parent = cur.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < cur.length; i++) for (let j = i + 1; j < cur.length; j++) if (sharesNode(cur[i], cur[j])) parent[find(j)] = find(i);
    const groups = new Map<number, number[]>();
    cur.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]));
    if (groups.size <= 1) break;
    const ordered = [...groups.values()].sort((a, b) => b.length - a.length);
    const mainIdx = new Set(ordered[0]);
    let moved = false;
    for (const ids of ordered.slice(1)) {
      for (const i of ids) {
        const s = cur[i];
        let best: { m: number; shared: Axis; shift: number; target: number } | null = null;
        for (const mi of mainIdx) {
          const m = cur[mi];
          if (m.axis === s.axis) {
            const perpD = Math.hypot(m.perp[0] - s.perp[0], m.perp[1] - s.perp[1]);
            if (perpD > 0.15) continue;
            const gap = s.lo > m.hi ? s.lo - m.hi : m.lo > s.hi ? m.lo - s.hi : 0;
            if (gap > NODE && gap <= budget) {
              const mid = s.lo > m.hi ? (s.lo + m.hi) / 2 : (m.lo + s.hi) / 2;
              if (s.lo > m.hi) {
                cur[i] = { ...s, lo: round4(mid) };
                cur[mi] = { ...m, hi: round4(mid) };
              } else {
                cur[i] = { ...s, hi: round4(mid) };
                cur[mi] = { ...m, lo: round4(mid) };
              }
              moved = true;
            }
            continue;
          }
          const shared = AXES.find((ax) => ax !== s.axis && ax !== m.axis)!;
          const shift = fixedOn(m, shared)! - fixedOn(s, shared)!;
          if (Math.abs(shift) > budget) continue;
          const target = fixedOn(m, s.axis)!;
          const ext = target < s.lo ? s.lo - target : target > s.hi ? target - s.hi : 0;
          if (ext > budget) continue;
          const onMain = fixedOn(s, m.axis)!;
          const mainExt = onMain < m.lo ? m.lo - onMain : onMain > m.hi ? onMain - m.hi : 0;
          if (mainExt > budget) continue;
          const cost = Math.abs(shift) + ext;
          if (!best || cost < Math.abs(best.shift) + (best.target < s.lo ? s.lo - best.target : best.target > s.hi ? best.target - s.hi : 0)) {
            best = { m: mi, shared, shift, target };
          }
        }
        if (!best) continue;
        const idx = others(s.axis).indexOf(best.shared);
        const perp: [number, number] = [s.perp[0], s.perp[1]];
        perp[idx] = round4(perp[idx] + best.shift);
        const lo = round4(Math.min(s.lo, best.target));
        const hi = round4(Math.max(s.hi, best.target));
        cur[i] = { ...s, perp, lo, hi };
        const m = cur[best.m];
        const onMain = fixedOn(cur[i], m.axis)!;
        cur[best.m] = { ...m, lo: round4(Math.min(m.lo, onMain)), hi: round4(Math.max(m.hi, onMain)) };
        moved = true;
      }
    }
    if (!moved) break;
  }
  return cur;
}

function toInstances(spans: Span[], stock: number): YardInstance[] {
  const out: YardInstance[] = [];
  for (const s of spans) {
    const cuts = [s.lo];
    if (stock > 0 && s.hi - s.lo > stock + 0.01) {
      const n = Math.ceil((s.hi - s.lo - 1e-6) / stock);
      for (let k = 1; k < n; k++) {
        const t = s.lo + (k * (s.hi - s.lo)) / n;
        if (t - cuts[cuts.length - 1] >= FITTING_PITCH && s.hi - t >= FITTING_PITCH) cuts.push(round4(t));
      }
    }
    cuts.push(s.hi);
    for (let k = 0; k < cuts.length - 1; k++) {
      const from = pointOf(s.axis, s.perp, cuts[k]);
      const to = pointOf(s.axis, s.perp, cuts[k + 1]);
      const L = vlen(from, to);
      out.push({
        id: createId("sk"),
        catalogId: s.catalogId,
        position: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 },
        rotation: { x: 0, y: 0, z: 0 },
        cutLength: s.whole ? undefined : round4(L),
        role: s.role,
        join: s.join,
        from,
        to,
        face: s.face,
      });
    }
  }
  return out;
}

export function seatPipeRack(instances: YardInstance[], item: CatalogItem): SeatResult {
  const od = Math.max(item.dims.diameter ?? 0, item.dims.width ?? 0, 0.08);
  // Grid lines closer than half a fitting pitch cannot hold two fittings, so they become one line.
  const snap = Math.max(od, FITTING_PITCH / 2);
  const reach = Math.max(od, FITTING_BODY);
  const stock = item.dims.length ?? 0;
  const coords: Record<Axis, number[]> = { x: [], y: [], z: [] };
  const raw: { from: Vec3; to: Vec3; meta: Omit<Meta, "born">; axis: Axis }[] = [];
  for (const inst of instances) {
    if (!inst.from || !inst.to) continue;
    const found = axisOf(inst.from, inst.to);
    if (!found) continue;
    if (found.deg > TILT_DEG) return { ok: false, why: "member tilted over 1 degree" };
    raw.push({
      from: inst.from,
      to: inst.to,
      axis: found.axis,
      meta: { role: inst.role ?? "member", join: inst.join, catalogId: inst.catalogId, face: inst.face, whole: inst.cutLength == null },
    });
    for (const p of [inst.from, inst.to]) for (const a of AXES) coords[a].push(p[a]);
  }
  if (raw.length < 2) return { ok: false, why: "frame has fewer than two pipes" };
  const snapOf: Record<Axis, (v: number) => number> = {
    x: clusterSnap(coords.x, snap),
    y: clusterSnap(coords.y, snap),
    z: clusterSnap(coords.z, snap),
  };
  let spans: Span[] = [];
  for (const s of raw) {
    const [u, v] = others(s.axis);
    const perp: [number, number] = [snapOf[u](s.from[u]), snapOf[v](s.from[v])];
    const born: [number, number] = [round4((s.from[u] + s.to[u]) / 2), round4((s.from[v] + s.to[v]) / 2)];
    const lo = Math.min(snapOf[s.axis](s.from[s.axis]), snapOf[s.axis](s.to[s.axis]));
    const hi = Math.max(snapOf[s.axis](s.from[s.axis]), snapOf[s.axis](s.to[s.axis]));
    if (hi - lo < 0.2) continue;
    spans.push({ ...s.meta, born, axis: s.axis, perp, lo: round4(lo), hi: round4(hi) });
  }
  spans = mergeCollinear(spans, reach);
  const closed = mergeCloseLines(spans, 2);
  if (typeof closed === "string") return { ok: false, why: closed };
  spans = mergeCollinear(dockOrphans(closed), reach);
  const cuts = crossings(spans, reach);
  const next: Span[] = [];
  for (let i = 0; i < spans.length; i++) {
    const applied = applyCuts(spans[i], cuts.get(i) ?? [], reach);
    if (applied == null) continue;
    if (typeof applied === "string") return { ok: false, why: applied };
    const { span, splits } = applied;
    const marks = [span.lo, ...splits, span.hi];
    for (let k = 0; k < marks.length - 1; k++) {
      if (marks[k + 1] - marks[k] < 0.2) continue;
      next.push({ ...span, lo: marks[k], hi: marks[k + 1] });
    }
  }
  spans = next.filter((s) => s.hi - s.lo >= FITTING_PITCH - 0.01);
  spans = mergeCollinear(dockOrphans(spans), reach);
  const cuts2 = crossings(spans, reach);
  const joined: Span[] = [];
  for (let i = 0; i < spans.length; i++) {
    const applied = applyCuts(spans[i], cuts2.get(i) ?? [], reach);
    if (applied == null) continue;
    if (typeof applied === "string") return { ok: false, why: applied };
    const marks = [applied.span.lo, ...applied.splits, applied.span.hi];
    for (let k = 0; k < marks.length - 1; k++) {
      if (marks[k + 1] - marks[k] < FITTING_PITCH - 0.01) continue;
      joined.push({ ...applied.span, lo: marks[k], hi: marks[k + 1] });
    }
  }
  spans = joined.filter((s) => s.hi - s.lo >= FITTING_PITCH - 0.01);
  const why = faults(spans, od);
  if (why) return { ok: false, why: `${why} (${componentsOf(spans)} pieces)` };
  return { ok: true, instances: toInstances(spans, stock) };
}
