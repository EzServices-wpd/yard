/**
 * Stock-specific binders. PVC gets slip fittings, sticks get glue,
 * straws get tape — never one blob for every material.
 */
import { faceScrewInches } from "./shopJoin";
import { inchFrac } from "./inchText";
import { usesHotGlue, hotGlueBom } from "./adhesive";
import { panelJoints, screwTalk, stickJoints } from "./modelJoints";
import type { BomLine, CatalogItem, JoinMethod, Panel, Vec3, YardInstance } from "./types";
import { dist } from "./connect";

/** Wood screws are bought by the box. Say the count inside so "2 boxes" never reads as 2 screws. */
export const SCREWS_PER_BOX = 50;
export function screwBoxUnit(boxes: number): string {
  return boxes === 1 ? `box (${SCREWS_PER_BOX} ct)` : `boxes (${SCREWS_PER_BOX} ct each)`;
}

export type BinderKind = "slip" | "glue" | "tape" | "fastener" | "friction";

export type JointClass = "ground" | "cap" | "coupling" | "elbow45" | "elbow90" | "tee" | "cross";

export type JointNode = {
  p: Vec3;
  r: number;
  dirs: Vec3[];
};

export const FRAME_ROLES = new Set(["leg", "rail", "ring", "support", "base", "tip"]);
export const SKIN_ROLES = new Set(["skin"]);

export function isFrameRole(role?: string): boolean {
  if (!role || role === "member") return true;
  return FRAME_ROLES.has(role);
}

export function isSkinRole(role?: string): boolean {
  return !!role && SKIN_ROLES.has(role);
}

export const JOIN_LABELS: Record<JoinMethod, string> = {
  glue: "Glue",
  notch: "Notch",
  solvent: "Solvent",
  friction: "Friction",
  tape: "Tape",
  screw: "Screw",
  nail: "Nail",
  pin: "Pin",
  slot: "Slot",
  cable_tie: "Cable tie",
  staple: "Staple",
  zip: "Zip tie",
  none: "None",
};

export function effectiveJoin(item: CatalogItem, override?: JoinMethod | null): JoinMethod {
  return override || item.preferredJoins?.[0] || "glue";
}

export function binderKind(item: CatalogItem, override?: JoinMethod | null): BinderKind {
  const j = effectiveJoin(item, override);
  if (j === "tape" || j === "cable_tie") return "tape";
  if (j === "screw" || j === "nail") return "fastener";
  if (item.category === "pvc_plumbing" || j === "solvent") return "slip";
  if (item.formFactor === "pipe" && j === "friction") return "slip";
  if (j === "friction" || j === "pin" || j === "slot") return "friction";
  return "glue";
}

function keyOf(p: Vec3) {
  return `${p.x.toFixed(2)}|${p.y.toFixed(2)}|${p.z.toFixed(2)}`;
}

export function jointNodes(
  members: { from?: Vec3; to?: Vec3; radius: number }[],
): JointNode[] {
  const map = new Map<string, JointNode>();
  for (const m of members) {
    if (!m.from || !m.to) continue;
    const ends: [Vec3, Vec3][] = [
      [m.from, m.to],
      [m.to, m.from],
    ];
    for (const [at, other] of ends) {
      const k = keyOf(at);
      let node = map.get(k);
      if (!node) {
        node = { p: at, r: m.radius, dirs: [] };
        map.set(k, node);
      } else if (m.radius > node.r) node.r = m.radius;
      const dx = other.x - at.x;
      const dy = other.y - at.y;
      const dz = other.z - at.z;
      const len = Math.hypot(dx, dy, dz) || 1;
      const dir = { x: dx / len, y: dy / len, z: dz / len };
      if (!node.dirs.some((d) => d.x * dir.x + d.y * dir.y + d.z * dir.z > 0.97)) {
        node.dirs.push(dir);
      }
    }
  }
  return [...map.values()];
}

export function classifyJoint(node: JointNode): JointClass {
  const n = node.dirs.length;
  if (n <= 1 && node.p.y < 0.45) return "ground";
  if (n <= 1) return "cap";
  if (n === 3) return "tee";
  if (n >= 4) return "cross";
  const d0 = node.dirs[0];
  const d1 = node.dirs[1];
  const dot = d0.x * d1.x + d0.y * d1.y + d0.z * d1.z;
  if (dot < -0.82) return "coupling";
  if (dot < -0.35) return "elbow45";
  return "elbow90";
}

function longAxis(p: Panel): "x" | "y" | "z" {
  const ax = [
    ["x", p.size.width],
    ["y", p.size.height],
    ["z", p.size.depth],
  ] as const;
  return ax.slice().sort((a, b) => b[1] - a[1])[0][0];
}

function contactPoint(a: Panel, b: Panel): Vec3 {
  const box = (p: Panel) => ({
    min: [p.position.x, p.position.y, p.position.z],
    max: [p.position.x + p.size.width, p.position.y + p.size.height, p.position.z + p.size.depth],
  });
  const A = box(a);
  const B = box(b);
  const pt = [0, 1, 2].map((k) => {
    const lo = Math.max(A.min[k], B.min[k]);
    const hi = Math.min(A.max[k], B.max[k]);
    if (hi + 1e-6 >= lo) return (lo + hi) / 2;
    return A.max[k] < B.min[k] ? (A.max[k] + B.min[k]) / 2 : (B.max[k] + A.min[k]) / 2;
  });
  return { x: pt[0], y: pt[1], z: pt[2] };
}

/**
 * Recipe members are panels, not welded sticks. Each place two of them meet is one slip joint
 * (a corner where a post meets two rails is one tee, not a fitting per part). Contacts within
 * two cross-sections are the same fitting; meetings farther apart stay separate.
 * ponytail: box members only — a curved pipe still uses its box until a recipe draws a centerline.
 */
export function slipInstancesFromPanels(panels: Panel[], catalogId: string): YardInstance[] {
  const mine = panels.filter((p) => p.materialId === catalogId);
  if (mine.length < 2) return [];
  const byId = new Map(mine.map((p) => [p.id, p]));
  const pairs = panelJoints(mine).filter((j) => byId.has(j.a) && byId.has(j.b));
  if (!pairs.length) return [];
  const section = Math.max(
    ...mine.map((p) => {
      const s = [p.size.width, p.size.height, p.size.depth].sort((a, b) => a - b);
      return s[1];
    }),
    0.5,
  );
  const radius = Math.max(1.25, section * 2);
  const dist = (u: Vec3, v: Vec3) => Math.hypot(u.x - v.x, u.y - v.y, u.z - v.z);
  type Hit = Vec3 & { ids: string[] };
  const hits: Hit[] = pairs.map((j) => ({ ...contactPoint(byId.get(j.a)!, byId.get(j.b)!), ids: [j.a, j.b] }));
  const seen = hits.map(() => -1);
  const clusters: { point: Vec3; ids: Set<string> }[] = [];
  for (let i = 0; i < hits.length; i++) {
    if (seen[i] >= 0) continue;
    const stack = [i];
    seen[i] = clusters.length;
    const group: Hit[] = [];
    while (stack.length) {
      const k = stack.pop()!;
      group.push(hits[k]);
      for (let j = 0; j < hits.length; j++) {
        if (seen[j] < 0 && dist(hits[k], hits[j]) <= radius) {
          seen[j] = clusters.length;
          stack.push(j);
        }
      }
    }
    const ids = new Set(group.flatMap((g) => g.ids));
    if (ids.size < 2) continue;
    clusters.push({
      point: {
        x: group.reduce((s, g) => s + g.x, 0) / group.length,
        y: group.reduce((s, g) => s + g.y, 0) / group.length,
        z: group.reduce((s, g) => s + g.z, 0) / group.length,
      },
      ids,
    });
  }
  const out: YardInstance[] = [];
  for (const p of mine) {
    const axis = longAxis(p);
    const pts: Vec3[] = [];
    for (const q of clusters.filter((c) => c.ids.has(p.id)).map((c) => c.point).sort((u, v) => u[axis] - v[axis])) {
      if (!pts.some((u) => dist(u, q) < 0.05)) pts.push(q);
    }
    // One meeting: the other end is free, so the shared point still classifies (an elbow, not a cap).
    if (pts.length === 1) {
      const mid = {
        x: p.position.x + p.size.width / 2,
        y: p.position.y + p.size.height / 2,
        z: p.position.z + p.size.depth / 2,
      };
      const len = axis === "x" ? p.size.width : axis === "y" ? p.size.height : p.size.depth;
      const ends = [mid[axis] - len / 2, mid[axis] + len / 2].map((n) => ({ ...mid, [axis]: n }));
      const far = dist(ends[0], pts[0]) >= dist(ends[1], pts[0]) ? ends[0] : ends[1];
      if (dist(pts[0], far) >= 0.5) {
        out.push({
          id: `${p.id}~0`,
          catalogId,
          position: pts[0],
          rotation: { x: 0, y: 0, z: 0 },
          from: pts[0],
          to: far,
        });
      }
      continue;
    }
    if (pts.length < 2) continue;
    for (let i = 0; i < pts.length - 1; i++) {
      if (dist(pts[i], pts[i + 1]) < 0.5) continue;
      out.push({
        id: `${p.id}~${i}`,
        catalogId,
        position: pts[i],
        rotation: { x: 0, y: 0, z: 0 },
        from: pts[i],
        to: pts[i + 1],
      });
    }
  }
  return out;
}

export function countSlipFittings(instances: YardInstance[], radius: number) {
  const nodes = jointNodes(
    instances.map((i) => ({ from: i.from, to: i.to, radius })),
  );
  const counts = { tees: 0, elbows90: 0, elbows45: 0, couplings: 0, crosses: 0, caps: 0 };
  for (const node of nodes) {
    const k = classifyJoint(node);
    if (k === "tee") counts.tees += 1;
    else if (k === "elbow90") counts.elbows90 += 1;
    else if (k === "elbow45") counts.elbows45 += 1;
    else if (k === "coupling") counts.couplings += 1;
    else if (k === "cross") counts.crosses += 1;
    else if (k === "cap") counts.caps += 1;
  }
  return counts;
}

function pvcSizeLabel(item: CatalogItem): string {
  const d = item.dims.diameter ?? 1.05;
  if (d < 0.95) return "1/2\"";
  if (d > 1.2) return "1\"";
  return "3/4\"";
}

export function binderBom(
  item: CatalogItem,
  instances: YardInstance[],
  override?: JoinMethod | null,
): BomLine[] {
  const kind = binderKind(item, override);
  const joints = Math.max(1, Math.round(instances.length * 0.6));
  if (kind === "glue" && usesHotGlue(item)) return [{ ...hotGlueBom(), notes: `${hotGlueBom().notes} About ${joints} joints.` }];
  if (kind === "glue") {
    return [
      {
        name: item.category === "craft_wood" ? "Wood glue" : "Multi-purpose craft glue",
        quantity: 1,
        unit: "bottle",
        catalogId: "glue",
        searchQuery: "titebond wood glue 8 oz",
        estimatedCost: 5,
        notes: `Primary join: glue · ~${joints} joints`,
      },
    ];
  }
  if (kind === "tape") {
    return [
      {
        name: "Packing tape",
        quantity: 1,
        unit: "roll",
        catalogId: "tape-packing",
        searchQuery: "packing tape 1.88 inch",
        estimatedCost: 4,
        notes: `Wrap each joint. ~${joints} wraps.`,
      },
    ];
  }
  if (kind === "fastener") {
    // Screws follow the joints in the model: members meeting at welded ends, 2 per joint on lumber.
    const across = Math.max(item.dims.width ?? 0, item.dims.thickness ?? 0, item.dims.diameter ?? 0, 0.25);
    // Reach is the member as drawn: a 1" strip ripped from a sheet is 1" across, not the 48" sheet face.
    const reachOf = (i: YardInstance) => (i.section ? Math.max(i.section.width, i.section.height) : across) * 0.6 + 0.1;
    const talk = screwTalk(stickJoints(instances, item.category === "lumber" || item.category === "sheet_goods" || item.formFactor === "board" ? 2 : 1, reachOf));
    const screws = Math.max(4, talk.screws);
    // Screw length follows the stick's thickness: 3/4" boards take 1 1/4", a 2x (1 1/2") takes 2 1/2".
    const len = inchFrac(faceScrewInches(item.dims.thickness ?? item.dims.height ?? 0.75)).replace(" ", "-");
    return [
      {
        name: `#8 × ${len}" wood screws`,
        quantity: Math.ceil(screws / SCREWS_PER_BOX),
        unit: screwBoxUnit(Math.ceil(screws / SCREWS_PER_BOX)),
        catalogId: "screws-8",
        searchQuery: `#8 ${len} wood screws`,
        estimatedCost: 8,
        notes: talk.screws >= 4 ? talk.note : `${screws} screws for the few joints in the model.`,
      },
    ];
  }
  if (kind === "slip") {
    const r = (item.dims.diameter ?? 1.05) / 2;
    const c = countSlipFittings(instances, r);
    const size = pvcSizeLabel(item);
    const lines: BomLine[] = [
      {
        name: "PVC solvent cement",
        quantity: 1,
        unit: "can",
        catalogId: "pvc-cement",
        searchQuery: "PVC solvent cement",
        estimatedCost: 7,
        notes: "Dry-fit every joint. Cement is permanent.",
      },
    ];
    const push = (qty: number, name: string, id: string, q: string, cost: number) => {
      if (qty <= 0) return;
      lines.push({
        name,
        quantity: qty,
        unit: "ea",
        catalogId: id,
        searchQuery: q,
        estimatedCost: qty * cost,
        notes: `Match ${size} pipe.`,
      });
    };
    push(c.tees, `${size} PVC tee`, "pvc-tee", `${size} schedule 40 PVC tee`, 1.15);
    push(c.crosses, `${size} PVC cross`, "pvc-tee", `${size} schedule 40 PVC cross`, 2.4);
    push(c.elbows90, `${size} PVC 90° elbow`, "pvc-elbow-90", `${size} schedule 40 PVC 90 elbow`, 0.95);
    push(c.elbows45, `${size} PVC 45° elbow`, "pvc-elbow-45", `${size} schedule 40 PVC 45 elbow`, 0.95);
    return lines;
  }
  return [];
}

export function memberSpan(a?: Vec3, b?: Vec3): number {
  if (!a || !b) return 0;
  return dist(a, b);
}
