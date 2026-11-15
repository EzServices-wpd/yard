/**
 * Open-frame forms skip the rack joint path.
 *
 * Rack joints split every meeting into pipe ends, then Buy counts the fitting
 * each direction set is. Two gates keep an open frame off that path:
 * - finishGraph does not split crossings for a ladder, frame, or other member
 *   form, and the crossing split itself ignores a pipe end that lands on
 *   another pipe (both crossings have to be mid-span).
 * - The rack seat runs only for a declared rack, and only once every member
 *   is an upright or a rail.
 *
 * A rung drawn to a rail is then one open end on a continuous pipe. Nothing
 * joins them, so Buy and the steps list no tee or elbow.
 *
 * This seats those meetings for every rigid slip-pipe open frame (ladder,
 * frame, arch). The fitting still comes from the direction set. A frame that
 * cannot be jointed without a clash, a gap, a pass-through, or a joint no
 * catalog fitting makes is left as it was.
 */
import { getCatalogItem } from "./catalog";
import {
  binderBom,
  buyCatalogWays,
  clusterJointNodes,
  countSlipFittings,
  highWay,
  slipFittingPhrase,
} from "./joints";
import { bomLinesFromForge, buildForgeBom } from "./bom";
import { fractionizeInches, inchFrac } from "./inchText";
import { decorateBom } from "./listings";
import { isSeatedPipeFrame, rigidSlipPipe } from "./pipeRackFrame";
import { cutSummary } from "./steps";
import type { BuildPlan, CatalogItem, Vec3, YardInstance, YardProject } from "./types";
import { withSocketCuts } from "./socketTakeoff";
import { namedStockDisplayName, stampWeekendCuts, weekendCutLines } from "./weekendStockHonesty";

/** Same node test the rack census uses. */
const NODE = 0.05;
/** A 3/4" fitting body. An end this close, along its own pipe, still meets. */
const REACH = 1.375;
/** Two fittings need this much pipe between their centres. */
const PITCH = 2.75;

const OPEN_KINDS = new Set(["ladder", "frame"]);

type Seg = { inst: YardInstance; a: Vec3; b: Vec3; cuts: Vec3[] };

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
function rp(p: Vec3): Vec3 {
  return { x: round4(p.x), y: round4(p.y), z: round4(p.z) };
}
function same(a: Vec3, b: Vec3): boolean {
  return dist(a, b) <= NODE;
}
function unit(a: Vec3, b: Vec3): Vec3 | null {
  const d = sub(b, a);
  const L = Math.hypot(d.x, d.y, d.z);
  if (L < 1e-6) return null;
  return { x: d.x / L, y: d.y / L, z: d.z / L };
}

/** Where a ray along a pipe meets another pipe's interior, within one fitting body. */
function rayMeet(origin: Vec3, dir: Vec3, a: Vec3, b: Vec3): Vec3 | null {
  const v = sub(b, a);
  const w = sub(origin, a);
  const vv = dot(v, v);
  const dv = dot(dir, v);
  const wd = dot(w, dir);
  const wv = dot(w, v);
  const denom = vv - dv * dv;
  if (vv < 1e-8 || Math.abs(denom) < 1e-8) return null;
  const t = (dv * wv - vv * wd) / denom;
  const s = (wv - dv * wd) / denom;
  if (t < -1e-4 || t > REACH + 1e-4) return null;
  if (s < -1e-4 || s > 1 + 1e-4) return null;
  const onHost = lerp(a, b, Math.min(1, Math.max(0, s)));
  const onRay = { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
  if (dist(onRay, onHost) > NODE) return null;
  if (same(onHost, a) || same(onHost, b)) return null;
  return rp(onHost);
}

/** Closest points of two segments. */
function segSeg(a0: Vec3, a1: Vec3, b0: Vec3, b1: Vec3): { sc: number; tc: number; d: number; pa: Vec3; pb: Vec3 } {
  const u = sub(a1, a0);
  const v = sub(b1, b0);
  const w0 = sub(a0, b0);
  const a = dot(u, u);
  const b = dot(u, v);
  const c = dot(v, v);
  const d = dot(u, w0);
  const e = dot(v, w0);
  const D = a * c - b * b;
  let sN: number;
  let sD = D;
  let tN: number;
  let tD = D;
  if (D < 1e-8) {
    sN = 0;
    sD = 1;
    tN = e;
    tD = c;
  } else {
    sN = b * e - c * d;
    tN = a * e - b * d;
    if (sN < 0) {
      sN = 0;
      tN = e;
      tD = c;
    } else if (sN > sD) {
      sN = sD;
      tN = e + b;
      tD = c;
    }
  }
  if (tN < 0) {
    tN = 0;
    if (-d < 0) sN = 0;
    else if (-d > a) sN = sD;
    else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if (-d + b < 0) sN = 0;
    else if (-d + b > a) sN = sD;
    else {
      sN = -d + b;
      sD = a;
    }
  }
  const sc = Math.abs(sN) < 1e-12 || sD === 0 ? 0 : sN / sD;
  const tc = Math.abs(tN) < 1e-12 || tD === 0 ? 0 : tN / tD;
  const pa = lerp(a0, a1, sc);
  const pb = lerp(b0, b1, tc);
  return { sc, tc, d: dist(pa, pb), pa, pb };
}

function interior(p: Vec3, a: Vec3, b: Vec3): boolean {
  return !same(p, a) && !same(p, b) && dist(p, a) + dist(p, b) <= dist(a, b) + NODE;
}

/** A pipe end on another pipe, or two pipes crossing, with no shared end. */
export function hasInteriorMeeting(instances: readonly { from?: Vec3; to?: Vec3 }[]): boolean {
  const segs = instances.filter((i) => i.from && i.to);
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const A = segs[i];
      const B = segs[j];
      const hit = segSeg(A.from!, A.to!, B.from!, B.to!);
      if (hit.d > NODE) continue;
      if (same(hit.pa, hit.pb) && (same(hit.pa, A.from!) || same(hit.pa, A.to!)) && (same(hit.pb, B.from!) || same(hit.pb, B.to!))) continue;
      if (interior(hit.pa, A.from!, A.to!) || interior(hit.pb, B.from!, B.to!)) return true;
    }
  }
  return false;
}

/** Rigid slip pipe whose form is an open frame, and not a rack the joint path already seated. */
export function isOpenPipeJointFrame(project: {
  kind?: string;
  panels: readonly unknown[];
  instances: readonly { from?: Vec3; to?: Vec3 }[];
  primaryMaterialId?: string;
}): boolean {
  if (!OPEN_KINDS.has(project.kind ?? "")) return false;
  if (project.panels.length || project.instances.length < 2) return false;
  if (isSeatedPipeFrame(project)) return false;
  const item = getCatalogItem(project.primaryMaterialId ?? "");
  return !!item && rigidSlipPipe(item);
}

/** Right-angle tolerance shared with the rack's 4-way test (about 5°). Straight is the coupling test. */
const STRAIGHT = -0.82;
const SQUARE = 0.08;

function pairDots(dirs: Vec3[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++) out.push(dot(dirs[i], dirs[j]));
  return out;
}

/**
 * The catalog fitting for one meeting, or null when the pipes are not square or straight.
 * A loose angle is not sold as a tee or a cross.
 */
export function catalogMeeting(dirs: Vec3[]): "coupling" | "elbow90" | "tee" | "corner" | "cross" | "tee4" | "cross5" | "cross6" | null {
  const n = dirs.length;
  if (n < 2) return null;
  if (n === 2) {
    const d = dot(dirs[0], dirs[1]);
    if (d < STRAIGHT) return "coupling";
    if (Math.abs(d) <= SQUARE) return "elbow90";
    return null;
  }
  if (n === 3) {
    const dots = pairDots(dirs);
    if (dots.length === 3 && dots.every((d) => Math.abs(d) <= SQUARE)) return "corner";
    if (dots.filter((d) => d < STRAIGHT).length === 1 && dots.filter((d) => Math.abs(d) <= SQUARE).length === 2) return "tee";
    return null;
  }
  if (n === 4 && highWay(dirs) === "cross") return squarePlanarCross(dirs) ? "cross" : null;
  if (n === 4 && highWay(dirs) === "tee4") return "tee4";
  if (n === 5 && highWay(dirs) === "cross5") {
    for (let i = 0; i < dirs.length; i++) {
      const rest = dirs.filter((_, k) => k !== i);
      if (squarePlanarCross(rest)) return "cross5";
    }
    return null;
  }
  if (n === 6 && highWay(dirs) === "cross6") return "cross6";
  return null;
}

/** Two opposite pairs in one plane, and those axes square to each other. */
function squarePlanarCross(dirs: Vec3[]): boolean {
  if (dirs.length !== 4) return false;
  const used = new Set<number>();
  const axes: Vec3[] = [];
  for (let i = 0; i < 4; i++) {
    if (used.has(i)) continue;
    let mate = -1;
    for (let j = i + 1; j < 4; j++) if (!used.has(j) && dot(dirs[i], dirs[j]) < STRAIGHT) mate = j;
    if (mate < 0) return false;
    used.add(i);
    used.add(mate);
    axes.push(dirs[i]);
  }
  return axes.length === 2 && Math.abs(dot(axes[0], axes[1])) <= SQUARE;
}

/** Every meeting of pipes is square or straight. An open end is not a meeting. */
export function meetingsAreSquare(instances: readonly { from?: Vec3; to?: Vec3 }[], radius: number): boolean {
  const nodes = clusterJointNodes(instances.map((inst) => ({ from: inst.from, to: inst.to, radius })));
  let meetings = 0;
  for (const node of nodes) {
    if (node.dirs.length < 2) continue;
    meetings += 1;
    if (!catalogMeeting(node.dirs)) return false;
  }
  return meetings > 0;
}

/**
 * The fitting sentence the steps already use.
 * When Buy has split 4-way and up into catalog fittings, the sentence uses those names.
 * Otherwise it uses the same lumped counts Buy still prints.
 */
export function openPipeFittingPhrase(item: CatalogItem, instances: YardInstance[], catalogWays: boolean): string {
  const radius = (item.dims.diameter ?? 1.05) / 2;
  const counts = countSlipFittings(instances, radius);
  if (!catalogWays) return slipFittingPhrase(item, counts);
  const ways = { cross: 0, tee4: 0, cross5: 0, cross6: 0 };
  for (const node of clusterJointNodes(instances.map((inst) => ({ from: inst.from, to: inst.to, radius })))) {
    if (node.dirs.length < 4) continue;
    const kind = highWay(node.dirs);
    if (kind !== "miss") ways[kind] += 1;
  }
  return slipFittingPhrase(item, { ...counts, crosses: ways.cross, tee4: ways.tee4, cross5: ways.cross5, cross6: ways.cross6 });
}

function piecesOf(a: Vec3, b: Vec3, cuts: Vec3[]): { from: Vec3; to: Vec3 }[] | null {
  const ab = sub(b, a);
  const L2 = dot(ab, ab);
  const L = Math.sqrt(L2);
  const marks: { t: number; p: Vec3 }[] = [
    { t: 0, p: a },
    { t: 1, p: b },
  ];
  for (const c of cuts) {
    if (L2 < 1e-8) continue;
    const t = dot(sub(c, a), ab) / L2;
    if (t * L <= NODE || (1 - t) * L <= NODE) continue;
    marks.push({ t, p: c });
  }
  marks.sort((x, y) => x.t - y.t);
  const uniq: { t: number; p: Vec3 }[] = [];
  for (const m of marks) {
    const prev = uniq[uniq.length - 1];
    // The same joint recorded twice is one fitting, not two fittings too close to seat.
    if (prev && (m.t - prev.t) * L <= NODE) continue;
    uniq.push(m);
  }
  // A member we do not cut keeps its length, even when it is shorter than a fitting.
  if (uniq.length === 2) return [{ from: a, to: b }];
  const out: { from: Vec3; to: Vec3 }[] = [];
  for (let i = 0; i < uniq.length - 1; i++) {
    const len = (uniq[i + 1].t - uniq[i].t) * L;
    if (len < PITCH - 0.01) return null;
    out.push({ from: uniq[i].p, to: uniq[i + 1].p });
  }
  return out.length ? out : null;
}

/** An end that still stops short of a pipe it is aimed at, inside one fitting body. */
function axialGap(list: { from?: Vec3; to?: Vec3 }[]): boolean {
  for (let i = 0; i < list.length; i++) {
    for (let j = 0; j < list.length; j++) {
      const hostA = list[j].from;
      const hostB = list[j].to;
      const endA = list[i].from;
      const endB = list[i].to;
      if (i === j || !endA || !endB || !hostA || !hostB) continue;
      for (const which of ["from", "to"] as const) {
        const origin = which === "from" ? endA : endB;
        const other = which === "from" ? endB : endA;
        const dir = unit(other, origin);
        if (!dir) continue;
        const hit = rayMeet(origin, dir, hostA, hostB);
        if (hit && dist(origin, hit) > NODE) return true;
      }
    }
  }
  return false;
}

function clean(instances: YardInstance[], od: number): boolean {
  const members = instances.filter((i) => i.from && i.to && !i.round);
  if (hasInteriorMeeting(members) || axialGap(members)) return false;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const A = members[i];
      const B = members[j];
      const hit = segSeg(A.from!, A.to!, B.from!, B.to!);
      const share = [A.from!, A.to!].some((p) => [B.from!, B.to!].some((q) => same(p, q)));
      if (!share && hit.d < od - 0.02) return false;
    }
  }
  return true;
}

/**
 * Split each exact meeting into pipe ends. Null when this is not an open pipe frame,
 * when nothing meets in the middle, or when the split would clash, gap, or pass through.
 * Ends that are not already on the other pipe are not moved.
 */
export function splitOpenPipe(project: YardProject): YardInstance[] | null {
  if (!isOpenPipeJointFrame(project)) return null;
  const item = getCatalogItem(project.primaryMaterialId ?? "");
  if (!item) return null;
  const od = item.dims.diameter ?? 1.05;
  const ends: Seg[] = [];
  const rest: YardInstance[] = [];
  for (const inst of project.instances) {
    if (!inst.from || !inst.to || inst.round || dist(inst.from, inst.to) < 0.2) rest.push(inst);
    else ends.push({ inst, a: { ...inst.from }, b: { ...inst.to }, cuts: [] });
  }
  if (ends.length < 2) return null;

  let any = false;
  const move = new Map<string, Vec3>();
  const wantMove = (key: string, p: Vec3): boolean => {
    const prev = move.get(key);
    if (!prev) {
      move.set(key, p);
      return true;
    }
    return same(prev, p);
  };

  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const A = ends[i];
      const B = ends[j];
      const meetEnd = (host: Seg, guest: Seg, which: "a" | "b", gi: number) => {
        const origin = guest[which];
        const other = which === "a" ? guest.b : guest.a;
        const dir = unit(other, origin);
        if (!dir) return true;
        const hit = rayMeet(origin, dir, host.a, host.b);
        if (!hit || dist(origin, hit) > NODE) return true;
        if (!wantMove(`${gi}:${which}`, hit)) return false;
        host.cuts.push(hit);
        any = true;
        return true;
      };
      if (!meetEnd(B, A, "a", i) || !meetEnd(B, A, "b", i) || !meetEnd(A, B, "a", j) || !meetEnd(A, B, "b", j)) return null;
      const x = segSeg(A.a, A.b, B.a, B.b);
      if (x.d > NODE) continue;
      if (!interior(x.pa, A.a, A.b) || !interior(x.pb, B.a, B.b)) continue;
      const p = rp({ x: (x.pa.x + x.pb.x) / 2, y: (x.pa.y + x.pb.y) / 2, z: (x.pa.z + x.pb.z) / 2 });
      A.cuts.push(p);
      B.cuts.push(p);
      any = true;
    }
  }
  if (!any) return null;

  for (const [key, p] of move) {
    const [idx, which] = key.split(":");
    const seg = ends[Number(idx)];
    if (which === "a") seg.a = p;
    else seg.b = p;
  }

  const next: YardInstance[] = [];
  for (const seg of ends) {
    const parts = piecesOf(seg.a, seg.b, seg.cuts);
    if (!parts) return null;
    const moved =
      parts.length !== 1 || dist(parts[0].from, seg.inst.from!) > 1e-4 || dist(parts[0].to, seg.inst.to!) > 1e-4;
    if (!moved) {
      next.push(seg.inst);
      continue;
    }
    parts.forEach((part, k) => {
      const L = dist(part.from, part.to);
      next.push({
        ...seg.inst,
        id: parts.length === 1 ? seg.inst.id : `${seg.inst.id}~${k}`,
        from: part.from,
        to: part.to,
        position: { x: (part.from.x + part.to.x) / 2, y: (part.from.y + part.to.y) / 2, z: (part.from.z + part.to.z) / 2 },
        cutLength: parts.length > 1 || seg.inst.cutLength != null ? round4(L) : undefined,
      });
    });
  }
  const instances = withSocketCuts([...next, ...rest], item);
  if (!clean(instances, od)) return null;
  return instances;
}

const MANAGED_FITTING = new Set(["pvc-tee", "pvc-elbow-90", "pvc-elbow-45", "pvc-side-outlet", "pvc-coupling", "pvc-cross", "pvc-4-way-tee", "pvc-5-way-cross", "pvc-6-way-cross"]);

export type OpenPipeDeal = { segments: YardInstance[]; split: boolean };

/**
 * Segments to price, or null when the frame must stay exactly as release built it.
 * A split is kept only when every meeting on it is square or straight.
 */
export function openPipeDeal(project: YardProject): OpenPipeDeal | null {
  if (!isOpenPipeJointFrame(project)) return null;
  const item = getCatalogItem(project.primaryMaterialId ?? "");
  const radius = (item?.dims.diameter ?? 1.05) / 2;
  if (!hasInteriorMeeting(project.instances)) {
    return meetingsAreSquare(project.instances, radius) ? { segments: project.instances, split: false } : null;
  }
  const segments = splitOpenPipe(project);
  if (!segments || !meetingsAreSquare(segments, radius)) return null;
  return { segments, split: true };
}

function money(n: number): string {
  return `~$${n >= 100 ? n.toFixed(0) : n.toFixed(2)}`;
}

/**
 * The Buy note the pipe line already uses, written for these segments.
 * Null when that note's stick count is not the Buy count.
 */
function segmentPipeLine(project: YardProject, itemId: string) {
  const forged = bomLinesFromForge(buildForgeBom(project.instances, project.primaryMaterialId)).find((line) => line.catalogId === itemId);
  if (!forged?.notes) return null;
  const told = forged.notes.match(/from (\d+) whole /);
  if (!told || Number(told[1]) !== forged.quantity) return null;
  const [priced] = decorateBom([{ ...forged, estimatedCost: undefined, offers: undefined }]);
  return priced ?? null;
}

/**
 * Step 1's cut count, from the existing cut summary, read off these segments.
 * Null when Step 1 does not start with that summary, so a new sentence is not written.
 */
function retellStepOne(project: YardProject, instructions: BuildPlan["instructions"], segments: YardInstance[], cuts: { quantity: number; lengthIn: number }[]): BuildPlan["instructions"] | null {
  const item = getCatalogItem(project.primaryMaterialId ?? "");
  const at = instructions.findIndex((step) => /before you cut/i.test(step.title));
  if (at < 0) return null;
  const description = instructions[at].description ?? "";
  const label = namedStockDisplayName(project.prompt ?? "", item);
  const oldSum = cutSummary(project.instances, label);
  if (!description.startsWith(oldSum)) return null;
  const aligned = alignMarkedCuts(cutSummary(segments, label), cuts);
  if (!aligned) return null;
  const next = aligned + description.slice(oldSum.length);
  return instructions.map((step, i) => (i === at ? { ...step, description: next } : step));
}

/**
 * The marked-cut clause uses the same "N × length" words, with each length written
 * the way the cut list writes it. The cut summary rounds a length before it spells
 * it; the cut list's spelling is the one the cut step and the Buy note already use.
 * More than twelve lengths is the summary's own "and N more" line, which this does not rebuild.
 */
function alignMarkedCuts(summary: string, cuts: { quantity: number; lengthIn: number }[]): string | null {
  const marked = summary.match(/marked cuts \(([^)]*)\)/);
  if (!marked) return summary;
  if (/more lengths/.test(marked[1])) return null;
  const groups = new Map<string, { n: number; len: number }>();
  let total = 0;
  for (const cut of cuts) {
    total += cut.quantity;
    const text = inchFrac(cut.lengthIn);
    const g = groups.get(text);
    if (g) g.n += cut.quantity;
    else groups.set(text, { n: cut.quantity, len: cut.lengthIn });
  }
  const bits = [...groups.values()].sort((a, b) => b.len - a.len).map((g) => `${g.n} × ${inchFrac(g.len)}"`);
  if (!bits.length || bits.length > 12) return null;
  let next = summary.replace(marked[0], `marked cuts (${bits.join(", ")})`);
  next = next.replace(/(\d+) marked cuts/, `${total} marked cuts`);
  if (/^\d+ pieces/.test(next)) next = next.replace(/^\d+ pieces/, `${total} pieces`);
  return next;
}

/**
 * A split whose steps, cut list and Buy all name the segments.
 * A plan that still tells a length the cut list does not have does not agree.
 */
export function openSplitAgrees(project: YardProject, plan: BuildPlan): boolean {
  const deal = openPipeDeal(project);
  if (!deal?.split) return true;
  const item = getCatalogItem(project.primaryMaterialId ?? "");
  if (!item) return false;
  const label = namedStockDisplayName(project.prompt ?? "", item);
  const summary = alignMarkedCuts(cutSummary(deal.segments, label), plan.cutList);
  if (!summary) return false;
  const step1 = plan.instructions.find((step) => /before you cut/i.test(step.title));
  if (!step1?.description?.includes(summary)) return false;
  const pipe = plan.bom.find((line) => line.catalogId === item.id);
  const told = pipe?.notes?.match(/from (\d+) whole /);
  if (!pipe || !told || Number(told[1]) !== pipe.quantity) return false;
  const allowed = new Set(plan.cutList.map((line) => inchFrac(line.lengthIn)));
  if (!allowed.size) return false;
  const cutTo = pipe.notes?.match(/Cut to: ([^·]+)/);
  const spelled = cutTo ? [...cutTo[1].matchAll(/(\d+(?: \d+\/\d+)?)"/g)].map((m) => m[1]) : [];
  if (!spelled.length || spelled.some((len) => !allowed.has(len)) || [...allowed].some((len) => !spelled.includes(len))) return false;
  const cutStep = plan.instructions.find((step) => /^Cut the\b/.test(step.title));
  if (!cutStep?.description || !plan.cutList.every((line) => cutStep.description!.includes(`${line.quantity} ${line.label ? `${line.label} ` : ""}${line.name} ${inchFrac(line.lengthIn)} ×`))) return false;
  const toldLengths = plan.instructions.flatMap((step) => {
    const text = step.description ?? "";
    const marked = text.match(/marked cuts \(([^)]*)\)/);
    return [
      ...(marked ? [...marked[1].matchAll(/(\d+) × (\d+(?: \d+\/\d+)?)"/g)].map((m) => m[2]) : []),
      ...[...text.matchAll(/\d+ [A-Z] [A-Za-z]+ (\d+(?: \d+\/\d+)?) ×/g)].map((m) => m[1]),
    ];
  });
  return toldLengths.every((len) => allowed.has(len));
}

/**
 * Cut list, Buy and the fittings sentence follow the segments, and only when every
 * joint is square or straight. On a split, Step 1's cut count and the Buy pipe note
 * use the sentences they already use, read from the segments. The cut step is
 * rewritten by the same cut-list pass that release uses. Anything that would need
 * a new sentence returns the plan unchanged.
 */
export function applyOpenPipeFrame(project: YardProject, plan: BuildPlan): BuildPlan {
  const deal = openPipeDeal(project);
  if (!deal) return plan;
  const item = getCatalogItem(project.primaryMaterialId ?? "");
  if (!item) return plan;
  const radius = (item.dims.diameter ?? 1.05) / 2;
  const couplings = countSlipFittings(deal.segments, radius).couplings;
  const members = deal.segments.map((inst) => ({ from: inst.from, to: inst.to, radius }));
  const fresh = decorateBom(
    buyCatalogWays(binderBom(item, deal.segments, project.joinMethod, couplings), members).filter((line) => line.catalogId !== "pvc-cement"),
  );
  const phrase = openPipeFittingPhrase(item, deal.segments, true).trim();
  if (!phrase || !phraseAgrees(phrase, fresh)) return plan;
  const seen = new Set<string>();
  let bom = plan.bom.flatMap((line) => {
    if (!line.catalogId || !MANAGED_FITTING.has(line.catalogId)) return [line];
    const next = fresh.find((fit) => fit.name === line.name);
    seen.add(line.name);
    if (!next) return [];
    const same = next.quantity === line.quantity && next.catalogId === line.catalogId && Math.abs((next.estimatedCost ?? 0) - (line.estimatedCost ?? 0)) < 0.005;
    return [same ? line : next];
  });
  for (const line of fresh) if (!seen.has(line.name)) bom = [...bom, line];
  let cutList = plan.cutList;
  let instructions = plan.instructions;
  if (deal.split) {
    cutList = stampWeekendCuts(weekendCutLines({ ...project, instances: deal.segments })).map((line) =>
      line.notes ? { ...line, notes: fractionizeInches(line.notes) } : line,
    );
    const pipe = segmentPipeLine({ ...project, instances: deal.segments }, item.id);
    const told = retellStepOne(project, instructions, deal.segments, cutList);
    if (!pipe || !told) return plan;
    const spelled = [...new Map(cutList.map((line) => [inchFrac(line.lengthIn), line.lengthIn])).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([text]) => `${text}"`)
      .join(", ");
    const notes = fractionizeInches(pipe.notes ?? "").replace(/Cut to: (?:(?! · ).)*/, `Cut to: ${spelled}`);
    bom = bom.map((line) => (line.catalogId === item.id ? { ...line, ...pipe, notes } : line));
    instructions = told;
  }
  const i = instructions.findIndex((step) => /solvent cement/i.test(step.description ?? ""));
  if (i < 0 || instructions.some((step) => (step.description ?? "").includes("The fittings are"))) return plan;
  instructions = instructions.map((step, k) => (k === i ? { ...step, description: `${step.description ?? ""} ${phrase}`.trim() } : step));
  const cost = Math.round(bom.reduce((sum, line) => sum + (line.estimatedCost ?? 0), 0) * 100) / 100;
  const sameMoney = Math.abs(cost - plan.totals.estCostUsd) < 0.005;
  return {
    ...plan,
    bom,
    cutList,
    instructions,
    totals: { ...plan.totals, estCostUsd: cost },
    feasibility: sameMoney
      ? plan.feasibility
      : { ...plan.feasibility, summary: plan.feasibility.summary.replace(/~\$[\d,]+(?:\.\d+)?/, money(cost)) },
  };
}

/** The fittings sentence names only lines Buy carries, in the same counts. */
function fittingStem(name: string): string {
  return name
    .replace(/corners$/, "corner")
    .replace(/couplings$/, "coupling")
    .replace(/crosses$/, "cross")
    .replace(/tees$/, "tee")
    .replace(/elbows$/, "elbow");
}

function phraseAgrees(phrase: string, lines: { name: string; quantity: number }[]): boolean {
  const body = phrase.replace(/^The fittings are /, "").replace(/, the same fittings on the Buy list\.$/, "");
  const bits = body.split(/, | and /);
  const used = new Set<number>();
  for (const bit of bits) {
    const match = bit.match(/^(\d+) (.+)$/);
    if (!match) return false;
    const qty = Number(match[1]);
    const want = fittingStem(match[2]);
    const at = lines.findIndex((line, i) => !used.has(i) && line.quantity === qty && fittingStem(line.name) === want);
    if (at < 0) return false;
    used.add(at);
  }
  return used.size === lines.length;
}
