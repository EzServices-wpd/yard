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
      // A board laid face-on across two or more rails (gate or fence pickets) fastens to them, even where its foot meets the floor.
      const e = [0, 1, 2].map((k) => A.max[k] - A.min[k]);
      const thin = e.indexOf(Math.min(...e));
      const long = e.indexOf(Math.max(...e));
      const rails = p.type === "rail" || p.type === "upright" || e[thin] * 3 > e[long] ? [] : structural.filter((q) => {
        if (q.id === p.id || q.type !== "rail") return false;
        const B = boxes.get(q.id)!;
        return Math.abs(gapOn(A, B, thin)) <= 0.1 && [0, 1, 2].filter((k) => k !== thin).every((k) => overlap(A, B, k) >= 0.25);
      });
      const spans = rails.length >= 2 && [0, 1].every((end) => rails.some((q) => {
        const B = boxes.get(q.id)!;
        return end === 0 ? B.min[long] <= A.min[long] + 0.25 * e[long] : B.max[long] >= A.max[long] - 0.25 * e[long];
      }));
      if (spans) {
        out.set(p.id, { key: p.id, name: p.name, how: "side", on: rails.map((q) => q.id) });
        continue;
      }
      out.set(p.id, { key: p.id, name: p.name, how: "floor", on: [] });
      continue;
    }
    const others = structural.filter((q) => q.id !== p.id && q.type !== "drawer");
    // A flat span fastened between two uprights (a top, bottom, seat or fixed shelf) is carried by those
    // end supports, whatever sits under its middle (a divider, a kick strip) — they fasten to it later.
    const ext = [0, 1, 2].map((k) => A.max[k] - A.min[k]);
    // So is a rail on edge fastened between two uprights along its own length (a gate's top rail, a table
    // apron, a bed's side rail): the posts at its ends carry it, whatever it later meets along its face.
    const flat = ext[1] <= Math.min(ext[0], ext[2]);
    const la = flat || ext[0] >= ext[2] ? 0 : 2;
    const oa = la === 0 ? 2 : 0;
    if (flat || (p.type === "rail" && ext[la] >= Math.max(ext[1], ext[oa]))) {
      const endOn = (side: 0 | 1) =>
        others.filter((q) => {
          if (!vertical(q)) return false;
          const B = boxes.get(q.id)!;
          // Wall boards at a rail's ends (or grazing a span's end at an edge) are skin fastened later, never what carries it.
          if (q.type === "side" && (!flat || overlap(A, B, oa) <= 0.05)) return false;
          const meets = side === 0 ? Math.abs(B.max[la] - A.min[la]) <= 0.1 : Math.abs(B.min[la] - A.max[la]) <= 0.1;
          // A rail may sit just inside the post's face (an apron on the leg's inner face): edge contact counts.
          return meets && overlap(A, B, 1) >= ext[1] - 0.05 && overlap(A, B, oa) >= (flat ? 0.5 * ext[oa] : -0.1);
        });
      const [l, r] = [endOn(0), endOn(1)];
      if (l.length && r.length) {
        out.set(p.id, { key: p.id, name: p.name, how: "side", on: [...l, ...r].map((q) => q.id) });
        continue;
      }
    }
    // A flat panel notched around posts that run up through it (a raised coop floor on its legs) hangs on
    // those posts, not on the walls that later stand on it.
    if (flat) {
      const through = others.filter((q) => {
        // A sloped part's box is not its shape (a splayed leg): only true posts count.
        if (!vertical(q) || q.polygon) return false;
        const B = boxes.get(q.id)!;
        return B.min[1] < A.min[1] - 0.1 && B.max[1] > A.max[1] + 0.1 && overlap(A, B, 0) > 0.1 && overlap(A, B, 2) > 0.1;
      });
      if (through.length >= 2) {
        out.set(p.id, { key: p.id, name: p.name, how: "side", on: through.map((q) => q.id) });
        continue;
      }
    }
    const rests = others.filter((q) => {
      const B = boxes.get(q.id)!;
      return Math.abs(B.max[1] - A.min[1]) <= 0.1 && overlap(A, B, 0) >= 0.25 && overlap(A, B, 2) >= 0.25;
    });
    if (rests.length) {
      // A post standing beside a rail on the same support is screwed to that rail's face: the rail goes first.
      const railed = vertical(p)
        ? others.filter((q) => {
            const B = boxes.get(q.id)!;
            return q.type === "rail" && !vertical(q) && Math.abs(B.min[1] - A.min[1]) <= 0.1 && dist(A, B) <= 0.1 && overlap(A, B, 1) > 0;
          })
        : [];
      out.set(p.id, { key: p.id, name: p.name, how: "rests", on: [...rests, ...railed].map((q) => q.id) });
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
    // A part that sits on top of this one is never what holds it up.
    const below = touching.filter((q) => boxes.get(q.id)!.min[1] < A.max[1] - 0.1);
    // A board laid face-on across a frame (gate boards over their rails) reaches both ends of its long
    // axis; it fastens to every frame part it crosses, so it goes on after all of them.
    const thin = ext.indexOf(Math.min(...ext));
    const long = ext.indexOf(Math.max(...ext));
    const faceOn = touching.filter((q) => gapOn(A, boxes.get(q.id)!, thin) >= -0.1);
    const reach = (end: 0 | 1) =>
      faceOn.some((q) => {
        const B = boxes.get(q.id)!;
        return end === 0 ? B.min[long] <= A.min[long] + 0.25 * ext[long] : B.max[long] >= A.max[long] - 0.25 * ext[long];
      });
    const skin = p.type !== "rail" && p.type !== "upright" && faceOn.length >= 2 && ext[thin] * 3 <= ext[long] && reach(0) && reach(1);
    const on = skin ? faceOn : lower.length ? lower : below.length ? below : touching.length ? touching : near(others, 1).map((id) => others.find((q) => q.id === id)!);
    out.set(p.id, { key: p.id, name: p.name, how: "side", on: on.map((q) => (typeof q === "string" ? q : q.id)) });
  }
  // A batten or cleat that only ties boards together fastens across them: the boards go first, so a board
  // and its batten never wait on each other.
  const isTie = (p: Panel) => p.type === "cleat" || /\b(?:batten|cleat)s?\b/i.test(p.name);
  for (const p of panels) {
    const info = out.get(p.id);
    if (!info || isTie(p)) continue;
    const mutual = info.on.filter((k) => {
      const q = panels.find((x) => x.id === k);
      return q && isTie(q) && out.get(k)?.on.includes(p.id);
    });
    if (mutual.length) out.set(p.id, { ...info, on: info.on.filter((k) => !mutual.includes(k)) });
  }
  // A built-up door or lid (slats or boards on battens, named "Door 2 slat 3", "Lid batten") is its own
  // leaf: its battens hang on hinges from the one frame part the leaf swings on, and its slats fasten to
  // those battens, never to the posts or rails the closed leaf sits against.
  const leafOf = (p: Panel) => p.name.match(/^((?:door|lid)(?:\s+\d+)?)\s+(?:\w+\s+)?(?:slat|board|batten|cleat)s?\b/i)?.[1].toLowerCase() ?? null;
  const leaves = new Map<string, Panel[]>();
  for (const p of panels) {
    const k = leafOf(p);
    if (k) leaves.set(k, [...(leaves.get(k) ?? []), p]);
  }
  const frame = panels.filter((q) => !leafOf(q) && q.type !== "door" && q.type !== "drawer" && !isDrawerFront(q));
  for (const members of leaves.values()) {
    const ties = members.filter(isTie);
    if (!ties.length || !frame.length) continue;
    const A = boxes.get(ties[0].id)!;
    const hinge = [...frame].sort((x, y) => dist(A, boxes.get(x.id)!) - dist(A, boxes.get(y.id)!))[0];
    // Battens at the hinge line carry the straps; a batten across the far edge fastens over the boards.
    const H = boxes.get(hinge.id)!;
    const hung = ties.filter((t) => dist(boxes.get(t.id)!, H) <= 1);
    const boards = members.filter((m) => !isTie(m));
    for (const t of hung) out.set(t.id, { key: t.id, name: t.name, how: "hinges", on: [hinge.id] });
    for (const m of boards) {
      const M = boxes.get(m.id)!;
      const crossed = hung.filter((t) => dist(M, boxes.get(t.id)!) <= 0.1);
      out.set(m.id, { key: m.id, name: m.name, how: "side", on: (crossed.length ? crossed : hung).map((t) => t.id) });
    }
    for (const t of ties.filter((x) => !hung.includes(x))) {
      const T = boxes.get(t.id)!;
      const crossed = boards.filter((m) => dist(T, boxes.get(m.id)!) <= 0.1);
      out.set(t.id, { key: t.id, name: t.name, how: "side", on: (crossed.length ? crossed : boards).map((m) => m.id) });
    }
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
