/**
 * StructureGraph — discrete, buildable topology.
 * Nodes + edges map 1:1 onto catalog stock after subdivision.
 */

import type { CatalogItem, JoinMethod } from "./types";
import { toPrimitive } from "./geometry";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface StructureNode {
  id: string;
  position: Vec3;
  role?: "base" | "leg" | "brace" | "ring" | "platform" | "tip" | "splice" | "rail" | "support";
}

export interface StructureEdge {
  id: string;
  from: string;
  to: string;
  join: JoinMethod;
  critical?: boolean;
  role?: "leg" | "brace" | "ring" | "rail" | "splice" | "deck" | "support";
}

export interface StructureGraph {
  id: string;
  name: string;
  envelope: { width: number; height: number; depth: number };
  materialId: string;
  nodes: StructureNode[];
  edges: StructureEdge[];
  assumptions: string[];
  notes: string[];
  structureClass: "lattice_tower" | "eiffel" | "pyramid" | "frame" | "shell" | "generic";
}

export interface GraphInstance {
  id: string;
  catalogId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  cutLength?: number;
  join?: JoinMethod;
  role?: string;
}

function dist(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function mid(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function rotationForDirection(
  from: Vec3,
  to: Vec3,
  cylindrical: boolean
): [number, number, number] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  const x = dx / len;
  const y = dy / len;
  const z = dz / len;

  if (cylindrical) {
    const ry = Math.atan2(x, z);
    const rx = Math.atan2(Math.sqrt(x * x + z * z), y);
    return [rx, ry, 0];
  }

  const ry = Math.atan2(z, x);
  const rz = Math.asin(Math.max(-1, Math.min(1, -y)));
  return [0, ry, rz];
}

export function graphToInstances(
  graph: StructureGraph,
  item: CatalogItem
): { instances: GraphInstance[]; joinSummary: string[]; spliceCount: number } {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const prim = toPrimitive(item);
  const stock = Math.max(0.5, prim.length);
  const cylindrical =
    item.formFactor === "tube" ||
    item.formFactor === "pipe" ||
    item.formFactor === "dowel";
  const canCut = item.canCut ?? true;
  const defaultJoin: JoinMethod =
    (item.preferredJoins && item.preferredJoins[0]) || "glue";

  const instances: GraphInstance[] = [];
  let spliceCount = 0;
  const joinCounts = new Map<string, number>();
  const bumpJoin = (j: JoinMethod) => joinCounts.set(j, (joinCounts.get(j) ?? 0) + 1);

  for (const edge of graph.edges) {
    const a = nodeMap.get(edge.from);
    const b = nodeMap.get(edge.to);
    if (!a || !b) continue;
    const length = dist(a.position, b.position);
    if (length < 0.15) continue;
    const join = edge.join || defaultJoin;
    bumpJoin(join);
    const segments = canCut && length > stock * 1.02 ? Math.ceil(length / stock) : 1;
    const segLen = length / segments;
    for (let s = 0; s < segments; s++) {
      const t0 = s / segments;
      const t1 = (s + 1) / segments;
      const p0 = lerp(a.position, b.position, t0);
      const p1 = lerp(a.position, b.position, t1);
      const m = mid(p0, p1);
      const rot = rotationForDirection(p0, p1, cylindrical);
      const cut =
        canCut && Math.abs(segLen - stock) > 0.05 ? Math.min(segLen, stock) : undefined;
      if (s > 0) spliceCount += 1;
      instances.push({
        id: `${edge.id}-s${s}`,
        catalogId: graph.materialId,
        position: [m.x, m.y, m.z],
        rotation: rot,
        cutLength: cut,
        join: s > 0 ? "glue" : join,
        role: s > 0 ? "splice" : edge.role,
      });
    }
  }

  const joinSummary = [...joinCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([j, n]) => `${n}× ${j}`);

  return { instances, joinSummary, spliceCount };
}

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
