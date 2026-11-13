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
  clusterJointNodes,
  countSlipFittings,
  highWay,
  slipFittingPhrase,
  uncataloguedJoints,
} from "./joints";
import { isSeatedPipeFrame, rigidSlipPipe } from "./pipeRackFrame";
import type { CatalogItem, Vec3, YardInstance, YardProject } from "./types";

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

/**
 * Buy may count fittings from the joints. A seated rack already does.
 * An open frame does only once every meeting is an end and every joint is a catalog fitting.
 */
export function usesGeometryJoints(project: YardProject): boolean {
  if (isSeatedPipeFrame(project)) return true;
  if (!isOpenPipeJointFrame(project)) return false;
  if (hasInteriorMeeting(project.instances)) return false;
  const item = getCatalogItem(project.primaryMaterialId);
  if (!item) return false;
  const radius = (item.dims.diameter ?? 1.05) / 2;
  const members = project.instances.map((inst) => ({ from: inst.from, to: inst.to, radius }));
  // A joint no catalog fitting makes stays on the release Buy. Open ends alone are not a meeting.
  if (uncataloguedJoints(members) > 0) return false;
  const counts = countSlipFittings(project.instances, radius);
  return counts.tees + counts.elbows90 + counts.elbows45 + counts.couplings + counts.crosses + counts.corners > 0;
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
 * Split each meeting of an open pipe frame into pipe ends.
 * Returns the same project when there is nothing to joint, or when jointing would ship a bad frame.
 */
export function seatOpenPipeJoints(project: YardProject): YardProject {
  if (!isOpenPipeJointFrame(project)) return project;
  const item = getCatalogItem(project.primaryMaterialId ?? "");
  if (!item) return project;
  const od = item.dims.diameter ?? 1.05;
  const ends: Seg[] = [];
  const rest: YardInstance[] = [];
  for (const inst of project.instances) {
    if (!inst.from || !inst.to || inst.round || dist(inst.from, inst.to) < 0.2) rest.push(inst);
    else ends.push({ inst, a: { ...inst.from }, b: { ...inst.to }, cuts: [] });
  }
  if (ends.length < 2) return project;

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
        if (!hit) return true;
        if (!wantMove(`${gi}:${which}`, hit)) return false;
        host.cuts.push(hit);
        any = true;
        return true;
      };
      if (!meetEnd(B, A, "a", i) || !meetEnd(B, A, "b", i) || !meetEnd(A, B, "a", j) || !meetEnd(A, B, "b", j)) return project;
      const x = segSeg(A.a, A.b, B.a, B.b);
      if (x.d > NODE) continue;
      if (!interior(x.pa, A.a, A.b) || !interior(x.pb, B.a, B.b)) continue;
      const p = rp({ x: (x.pa.x + x.pb.x) / 2, y: (x.pa.y + x.pb.y) / 2, z: (x.pa.z + x.pb.z) / 2 });
      A.cuts.push(p);
      B.cuts.push(p);
      any = true;
    }
  }
  if (!any) return project;

  for (const [key, p] of move) {
    const [idx, which] = key.split(":");
    const seg = ends[Number(idx)];
    if (which === "a") seg.a = p;
    else seg.b = p;
  }

  const next: YardInstance[] = [];
  for (const seg of ends) {
    const parts = piecesOf(seg.a, seg.b, seg.cuts);
    if (!parts) return project;
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
  const instances = [...next, ...rest];
  if (!clean(instances, od)) return project;
  return { ...project, instances };
}
