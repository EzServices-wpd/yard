/**
 * Stock-specific binders. PVC gets slip fittings, sticks get glue,
 * straws get tape — never one blob for every material.
 */
import type { BomLine, CatalogItem, JoinMethod, Vec3, YardInstance } from "./types";
import { dist } from "./connect";

export type BinderKind = "slip" | "glue" | "tape" | "fastener" | "friction";

export type JointClass = "ground" | "cap" | "coupling" | "elbow45" | "elbow90" | "tee" | "cross";

export type JointNode = {
  p: Vec3;
  r: number;
  dirs: Vec3[];
};

export const FRAME_ROLES = new Set(["leg", "rail", "ring", "support", "base", "tip"]);

export function isFrameRole(role?: string): boolean {
  if (!role || role === "member") return true;
  return FRAME_ROLES.has(role);
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
    const screws = Math.max(8, instances.length * 2);
    return [
      {
        name: '#8 × 1-1/4" wood screws',
        quantity: Math.ceil(screws / 50),
        unit: "box",
        catalogId: "screws-8",
        searchQuery: "#8 1-1/4 wood screws",
        estimatedCost: 8,
        notes: `${screws} screws estimated at joints.`,
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
