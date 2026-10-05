/**
 * Joints read from the model itself — the screws Buy asks for come from these, per joint type.
 *
 * Panels: two parts whose boxes touch (or are let in up to 1") on one axis and overlap on the other
 * two make one joint. Edge-to-face butt joints take a screw every 8" of joint, at least 2; face-to-face
 * glue-ups take a screw per 64 sq in, at least 2; a thin back takes a screw every 8" of its edge.
 * Doors, drawers, glass and mirrors hang on their own hardware; shelves on pins take no screws.
 *
 * Sticks: members meet at welded ends. Every member past the first at a node is one joint, 2 screws
 * on lumber and boards (one screw lets the joint spin), 1 on thin stock.
 */
import { panelWorldCorners } from "./geometry";
import type { Panel, YardInstance } from "./types";

export type JointKind = "butt" | "face" | "back" | "frame";
export type ModelJoint = { a: string; b: string; kind: JointKind; screws: number };

const HARDWARE_TYPES = new Set(["door", "drawer", "glass_panel", "mirror"]);

type Box = { min: [number, number, number]; max: [number, number, number] };

function boxOf(p: Panel): Box {
  const c = panelWorldCorners(p);
  return {
    min: [Math.min(...c.map((q) => q.x)), Math.min(...c.map((q) => q.y)), Math.min(...c.map((q) => q.z))],
    max: [Math.max(...c.map((q) => q.x)), Math.max(...c.map((q) => q.y)), Math.max(...c.map((q) => q.z))],
  };
}

function thinnest(p: Panel) {
  return Math.min(p.size.width, p.size.height, p.size.depth);
}

/** Joints between panels. `noScrew(a, b)` marks pairs held some other way (shelf pins). */
export function panelJoints(panels: Panel[], noScrew: (a: Panel, b: Panel) => boolean = () => false): ModelJoint[] {
  const parts = panels.filter((p) => !HARDWARE_TYPES.has(p.type) && !/drawer front|false front/i.test(p.name) && thinnest(p) > 0.1);
  const boxes = parts.map(boxOf);
  const out: ModelJoint[] = [];
  const tol = 0.07;
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const A = boxes[i], B = boxes[j];
      // Positive = clear gap, negative = overlap length on that axis.
      const gaps = [0, 1, 2].map((k) => Math.max(A.min[k], B.min[k]) - Math.min(A.max[k], B.max[k]));
      // Contact axis: the one with the least overlap. Touching (gap ≈ 0) or let in up to 1".
      const axis = gaps.indexOf(Math.max(...gaps));
      const g = gaps[axis];
      if (g > tol || g < -1) continue;
      const others = [0, 1, 2].filter((k) => k !== axis).map((k) => -gaps[k]);
      if (others.some((o) => o < 0.25)) continue;
      const declared =
        parts[i].joints?.some((x) => x.with === parts[j].id) || parts[j].joints?.some((x) => x.with === parts[i].id);
      if (g < -tol && !declared && g < -0.8) continue;
      if (noScrew(parts[i], parts[j])) continue;
      const [l1, l2] = others.sort((x, y) => y - x);
      // Boards laid side by side (or stacked) in one plane, touching along their full length, are not
      // fastened to each other — each one fastens to what it rests on. Ends and short edges still join.
      const thinAxis = (b: Box) => {
        const ext = [0, 1, 2].map((k) => b.max[k] - b.min[k]);
        return ext.indexOf(Math.min(...ext));
      };
      const longest = (b: Box) => Math.max(...[0, 1, 2].map((k) => b.max[k] - b.min[k]));
      const coplanar =
        !declared &&
        thinAxis(A) === thinAxis(B) &&
        thinAxis(A) !== axis &&
        Math.abs(A.min[thinAxis(A)] - B.min[thinAxis(A)]) < 0.07 &&
        Math.abs(A.max[thinAxis(A)] - B.max[thinAxis(A)]) < 0.07 &&
        l1 >= 0.9 * Math.min(longest(A), longest(B));
      if (coplanar) continue;
      const thinBack = thinnest(parts[i]) < 0.5 || thinnest(parts[j]) < 0.5;
      let kind: JointKind;
      let screws: number;
      if (thinBack) {
        kind = "back";
        screws = Math.max(2, Math.ceil(l1 / 8));
      } else if (l2 > 3) {
        kind = "face";
        screws = Math.max(2, Math.ceil((l1 * l2) / 64));
      } else {
        kind = "butt";
        screws = Math.max(2, Math.ceil(l1 / 8));
      }
      out.push({ a: parts[i].id, b: parts[j].id, kind, screws });
    }
  }
  return out;
}

/** Joints where stick members meet: at welded ends, and where one member's end lands on another's side (a tee). */
export function stickJoints(
  instances: YardInstance[],
  screwsPerJoint = 2,
  reach: number | ((i: YardInstance) => number) = 0.8,
): ModelJoint[] {
  const reachOf = typeof reach === "number" ? () => reach : reach;
  const key = (p: { x: number; y: number; z: number }) => `${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.z.toFixed(1)}`;
  const nodes = new Map<string, string[]>();
  for (const i of instances) {
    if (!i.from || !i.to) continue;
    for (const p of [i.from, i.to]) {
      const k = key(p);
      const list = nodes.get(k) ?? [];
      if (!list.includes(i.id)) list.push(i.id);
      nodes.set(k, list);
    }
  }
  const out: ModelJoint[] = [];
  const paired = new Set<string>();
  for (const ids of nodes.values()) {
    for (let n = 1; n < ids.length; n++) {
      out.push({ a: ids[0], b: ids[n], kind: "frame", screws: screwsPerJoint });
      paired.add(`${ids[0]}|${ids[n]}`).add(`${ids[n]}|${ids[0]}`);
    }
  }
  const segs = instances.filter((i) => i.from && i.to);
  for (const m of segs) {
    for (const end of [m.from!, m.to!]) {
      for (const o of segs) {
        if (o === m || paired.has(`${m.id}|${o.id}`)) continue;
        const a = o.from!, b = o.to!;
        const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
        const L2 = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
        if (L2 < 1e-6) continue;
        const t = ((end.x - a.x) * ab.x + (end.y - a.y) * ab.y + (end.z - a.z) * ab.z) / L2;
        if (t <= 0.02 || t >= 0.98) continue;
        const d = Math.hypot(a.x + ab.x * t - end.x, a.y + ab.y * t - end.y, a.z + ab.z * t - end.z);
        // A tee only when the end sits on the other member's side: within the wider of the two drawn sections.
        if (d > Math.max(reachOf(m), reachOf(o))) continue;
        out.push({ a: m.id, b: o.id, kind: "frame", screws: screwsPerJoint });
        paired.add(`${m.id}|${o.id}`).add(`${o.id}|${m.id}`);
      }
    }
  }
  return out;
}

const KIND_TALK: Record<JointKind, [string, string]> = {
  butt: ["butt joint", "butt joints"],
  face: ["face glue-up", "face glue-ups"],
  back: ["back edge", "back edges"],
  frame: ["frame joint", "frame joints"],
};

/** Total screws plus a plain note that names the joints by type. */
export function screwTalk(joints: ModelJoint[]): { screws: number; note: string } {
  const screws = joints.reduce((s, j) => s + j.screws, 0);
  const parts: string[] = [];
  for (const kind of ["butt", "frame", "face", "back"] as JointKind[]) {
    const js = joints.filter((j) => j.kind === kind);
    if (!js.length) continue;
    const n = js.reduce((s, j) => s + j.screws, 0);
    parts.push(`${n} for ${js.length} ${KIND_TALK[kind][js.length === 1 ? 0 : 1]}`);
  }
  return { screws, note: `${screws} screws from the model's joints: ${parts.join(", ")}.` };
}
