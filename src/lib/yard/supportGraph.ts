/**
 * What each part really rests on, read from the model's geometry (not from its name).
 *
 * A part whose underside is at the floor rests on the floor. A flat span between two uprights hangs on
 * those end supports. Otherwise it rests on the parts whose top
 * face meets its underside; failing that, on the lower parts it is fastened against (side contact).
 * Doors hang on the box sides, drawer fronts on their drawer boxes, drawer boxes on the box sides.
 * Stick members rest on the members that share their lower end.
 */
import { panelWorldCorners } from "./geometry";
import type { Panel, YardInstance, YardProject } from "./types";

export type How = "floor" | "rests" | "side" | "hinges" | "front" | "slides";
export type SupportInfo = { key: string; name: string; how: How; on: string[] };

type Box = { min: [number, number, number]; max: [number, number, number] };

function boxOf(p: Panel): Box {
  const c = panelWorldCorners(p);
  return {
    min: [Math.min(...c.map((q) => q.x)), Math.min(...c.map((q) => q.y)), Math.min(...c.map((q) => q.z))],
    max: [Math.max(...c.map((q) => q.x)), Math.max(...c.map((q) => q.y)), Math.max(...c.map((q) => q.z))],
  };
}

const overlap = (A: Box, B: Box, k: number) => Math.min(A.max[k], B.max[k]) - Math.max(A.min[k], B.min[k]);
const gapOn = (A: Box, B: Box, k: number) => Math.max(A.min[k], B.min[k]) - Math.min(A.max[k], B.max[k]);
const dist = (A: Box, B: Box) => Math.hypot(...[0, 1, 2].map((k) => Math.max(0, gapOn(A, B, k))));

export const isDrawerFront = (p: Panel) => /drawer front|false front/i.test(p.name);

export function panelSupports(panels: Panel[]): Map<string, SupportInfo> {
  const boxes = new Map(panels.map((p) => [p.id, boxOf(p)]));
  const out = new Map<string, SupportInfo>();
  const structural = panels.filter((q) => q.type !== "door" && !isDrawerFront(q));
  const vertical = (q: Panel) => {
    const b = boxes.get(q.id)!;
    return b.max[1] - b.min[1] > Math.max(b.max[0] - b.min[0], 0.8) && q.type !== "door" && q.type !== "drawer" && !isDrawerFront(q);
  };
  for (const p of panels) {
    const A = boxes.get(p.id)!;
    const near = (pool: Panel[], n = 2) =>
      pool
        .filter((q) => q.id !== p.id)
        .sort((x, y) => dist(A, boxes.get(x.id)!) - dist(A, boxes.get(y.id)!))
        .slice(0, n)
        .map((q) => q.id);
    if (p.type === "door") {
      out.set(p.id, { key: p.id, name: p.name, how: "hinges", on: near(panels.filter(vertical), 1) });
      continue;
    }
    if (isDrawerFront(p)) {
      const box = near(panels.filter((q) => q.type === "drawer"), 1);
      out.set(p.id, { key: p.id, name: p.name, how: box.length ? "front" : "side", on: box.length ? box : near(structural, 1) });
      continue;
    }
    if (p.type === "drawer") {
      out.set(p.id, { key: p.id, name: p.name, how: "slides", on: near(panels.filter(vertical), 2) });
      continue;
    }
    if (A.min[1] <= 0.1) {
      out.set(p.id, { key: p.id, name: p.name, how: "floor", on: [] });
      continue;
    }
    const others = structural.filter((q) => q.id !== p.id && q.type !== "drawer");
    // A flat span fastened between two uprights (a top, bottom, seat or fixed shelf) is carried by those
    // end supports, whatever sits under its middle (a divider, a kick strip) — they fasten to it later.
    const ext = [0, 1, 2].map((k) => A.max[k] - A.min[k]);
    if (ext[1] <= Math.min(ext[0], ext[2])) {
      const endOn = (side: 0 | 1) =>
        others.filter((q) => {
          if (!vertical(q)) return false;
          const B = boxes.get(q.id)!;
          const meets = side === 0 ? Math.abs(B.max[0] - A.min[0]) <= 0.1 : Math.abs(B.min[0] - A.max[0]) <= 0.1;
          return meets && overlap(A, B, 1) >= ext[1] - 0.05 && overlap(A, B, 2) >= 0.5 * ext[2];
        });
      const [l, r] = [endOn(0), endOn(1)];
      if (l.length && r.length) {
        out.set(p.id, { key: p.id, name: p.name, how: "side", on: [...l, ...r].map((q) => q.id) });
        continue;
      }
    }
    const rests = others.filter((q) => {
      const B = boxes.get(q.id)!;
      return Math.abs(B.max[1] - A.min[1]) <= 0.1 && overlap(A, B, 0) >= 0.25 && overlap(A, B, 2) >= 0.25;
    });
    if (rests.length) {
      out.set(p.id, { key: p.id, name: p.name, how: "rests", on: rests.map((q) => q.id) });
      continue;
    }
    const touching = others.filter((q) => {
      const B = boxes.get(q.id)!;
      const gaps = [0, 1, 2].map((k) => gapOn(A, B, k));
      const axis = gaps.indexOf(Math.max(...gaps));
      if (gaps[axis] > 0.1 || gaps[axis] < -1) return false;
      return [0, 1, 2].filter((k) => k !== axis).every((k) => -gaps[k] >= 0.25);
    });
    const lower = touching.filter((q) => boxes.get(q.id)!.min[1] < A.min[1] - 0.01);
    const on = lower.length ? lower : touching.length ? touching : near(others, 1).map((id) => others.find((q) => q.id === id)!);
    out.set(p.id, { key: p.id, name: p.name, how: "side", on: on.map((q) => (typeof q === "string" ? q : q.id)) });
  }
  return out;
}

/** Stick builds: each role group rests on the floor or on the groups that share its members' lower ends. */
export function roleSupports(instances: YardInstance[]): Map<string, SupportInfo> {
  const roleOf = (i: YardInstance) => i.role || "member";
  const segs = instances.filter((i) => i.from && i.to);
  const out = new Map<string, SupportInfo>();
  const groups = new Map<string, YardInstance[]>();
  for (const i of segs) groups.set(roleOf(i), [...(groups.get(roleOf(i)) ?? []), i]);
  const touches = (pt: { x: number; y: number; z: number }, o: YardInstance) => {
    const a = o.from!, b = o.to!;
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const L2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
    const t = L2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((pt.x - a.x) * ab.x + (pt.y - a.y) * ab.y + (pt.z - a.z) * ab.z) / L2));
    return Math.hypot(a.x + ab.x * t - pt.x, a.y + ab.y * t - pt.y, a.z + ab.z * t - pt.z) <= 1;
  };
  for (const [role, members] of groups) {
    if (members.some((m) => Math.min(m.from!.y, m.to!.y) <= 0.1)) {
      out.set(role, { key: role, name: role, how: "floor", on: [] });
      continue;
    }
    const on = new Set<string>();
    for (const m of members) {
      const low = m.from!.y <= m.to!.y ? m.from! : m.to!;
      for (const o of segs) if (roleOf(o) !== role && touches(low, o)) on.add(roleOf(o));
    }
    out.set(role, { key: role, name: role, how: on.size ? "rests" : "side", on: [...on] });
  }
  return acyclicRoles(out, groups);
}

/** Build sequence when groups sit level: the frame first, then what ties it, then what it carries. */
const ROLE_RANK: [RegExp, number][] = [
  [/^(?:leg|post|pier|upright|wall|foot|feet|arch|frame|side|stand|spring|floor|base)s?$/, 0],
  [/^(?:rail|tie|brace|batten|stretcher|apron|ring|belt|support|crossbar|stop|axle|lattice|cleat|rung|joist|beam|bearer|spine)s?$/, 1],
  [/^(?:rafter|ridge|purlin)s?$/, 2],
  [/^(?:roof|shingle|slat|cup|arm|top|seat|deck|back|backrest|tread|shelf|lid|panel|plank)s?$/, 3],
];
function roleRank(role: string): number {
  const r = role.toLowerCase();
  return ROLE_RANK.find(([re]) => re.test(r))?.[1] ?? 1.5;
}

/**
 * Stick groups that touch each other can each "rest" on the other. A group rests only on a group that
 * sits lower (median of its members' low ends), or, level with it, on one earlier in the build sequence.
 * The support graph is then a tree to build up from, never a loop.
 */
function acyclicRoles(out: Map<string, SupportInfo>, groups: Map<string, YardInstance[]>): Map<string, SupportInfo> {
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
  };
  const low = new Map<string, number>();
  for (const [role, members] of groups) low.set(role, median(members.map((m) => Math.min(m.from!.y, m.to!.y))));
  const below = (b: string, a: string) => {
    const d = (low.get(a) ?? 0) - (low.get(b) ?? 0);
    if (Math.abs(d) > 0.5) return d > 0;
    return roleRank(b) < roleRank(a);
  };
  for (const [role, info] of out) {
    if (info.how !== "rests") continue;
    const on = info.on.filter((b) => out.get(b)?.how === "floor" || below(b, role));
    out.set(role, on.length ? { ...info, on } : { ...info, how: "side", on: [] });
  }
  return out;
}

/** Supports for every part key the steps place (panel ids, or role names on stick builds). */
export function supportsOf(project: YardProject): Map<string, SupportInfo> {
  return project.panels.length ? panelSupports(project.panels) : roleSupports(project.instances);
}
