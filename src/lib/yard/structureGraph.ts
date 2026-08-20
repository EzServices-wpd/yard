/**
 * StructureGraph — discrete, buildable topology for Forge.
 * Nodes + edges map 1:1 onto catalog stock after subdivision.
 * Phase 1 foundation for Eiffel-scale (and any) lattice structures.
 */

import type { CatalogItem, JoinMethod, Vec3 } from "./types";
import { toPrimitive } from "./geometry";

export type { Vec3 };

export interface StructureNode {
  id: string;
  position: Vec3;
  /** Optional semantic role for instructions */
  role?: "base" | "leg" | "brace" | "ring" | "platform" | "tip" | "splice" | "rail" | "support";
}

export interface StructureEdge {
  id: string;
  from: string;
  to: string;
  /** How these two ends meet in the real world */
  join: JoinMethod;
  /** Structural importance for sequencing / warnings */
  critical?: boolean;
  role?: "leg" | "brace" | "ring" | "rail" | "splice" | "deck" | "support";
}

export interface StructureGraph {
  id: string;
  name: string;
  /** Target envelope in inches */
  envelope: { width: number; height: number; depth: number };
  materialId: string;
  nodes: StructureNode[];
  edges: StructureEdge[];
  /** Human-readable build assumptions */
  assumptions: string[];
  notes: string[];
  structureClass:
    | "lattice_tower"
    | "eiffel"
    | "pyramid"
    | "frame"
    | "shell"
    | "generic";
}

/** Local prompt-side instance (tuple rotation) before page maps to DesignJson */
export interface GraphInstance {
  id: string;
  catalogId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  cutLength?: number;
  join?: JoinMethod;
  role?: string;
  from?: [number, number, number];
  to?: [number, number, number];
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

/**
 * Orient a stick (box: long axis = X) or cylinder (long axis = Y)
 * so its long axis matches vector from → to.
 */
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
    // Three.js cylinderGeometry: axis = +Y. Point +Y along (x,y,z).
    // Euler order XYZ: rx tilts in YZ, ry spins around Y.
    const ry = Math.atan2(x, z);
    const rx = Math.atan2(Math.sqrt(x * x + z * z), y);
    // rx=0 → straight up (+Y); rx=π/2 → horizontal
    return [rx, ry, 0];
  }

  // Box geometry: long axis = +X (see ForgePieces). Point +X along (x,y,z).
  // ry spins in XZ; rz pitches up/down.
  const ry = Math.atan2(z, x);
  const rz = Math.asin(Math.max(-1, Math.min(1, -y)));
  return [0, ry, rz];
}

/**
 * Convert graph edges into catalog instances.
 * Long edges are subdivided into stock-length pieces with lap splices.
 */
export function graphToInstances(
  graph: StructureGraph,
  item: CatalogItem,
  joinOverride?: JoinMethod,
): { instances: GraphInstance[]; joinSummary: string[]; spliceCount: number } {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const prim = toPrimitive(item);
  const stock = Math.max(0.5, prim.length);
  const thick = Math.max(prim.width, (prim.radius ?? 0) * 2, 0.08);
  const cylindrical =
    item.formFactor === "tube" ||
    item.formFactor === "pipe" ||
    item.formFactor === "dowel";
  const canCut = item.canCut ?? true;
  const defaultJoin: JoinMethod =
    joinOverride || (item.preferredJoins && item.preferredJoins[0]) || "glue";
  const lap = Math.min(stock * 0.12, Math.max(thick * 3, 0.22));

  const instances: GraphInstance[] = [];
  let spliceCount = 0;
  const joinCounts = new Map<string, number>();

  const bumpJoin = (j: JoinMethod) =>
    joinCounts.set(j, (joinCounts.get(j) ?? 0) + 1);

  for (const edge of graph.edges) {
    const a = nodeMap.get(edge.from);
    const b = nodeMap.get(edge.to);
    if (!a || !b) continue;

    const length = dist(a.position, b.position);
    // Shorter than ~2.5× thickness reads as a floating blob / circle, not a member
    const minLen = Math.max(thick * 2.5, 0.4);
    if (length < minLen) continue;

    const join = edge.join || defaultJoin;
    bumpJoin(join);

    const usable = Math.max(stock - lap, stock * 0.82);
    const segments =
      canCut && length > stock * 1.02
        ? Math.max(2, Math.ceil((length - lap) / usable))
        : 1;

    for (let s = 0; s < segments; s++) {
      const raw0 = s / segments;
      const raw1 = (s + 1) / segments;
      const overlap = segments > 1 ? lap / length : 0;
      const t0 = s === 0 ? raw0 : Math.max(0, raw0 - overlap * 0.5);
      const t1 = s === segments - 1 ? raw1 : Math.min(1, raw1 + overlap * 0.5);
      const p0 = lerp(a.position, b.position, t0);
      const p1 = lerp(a.position, b.position, t1);
      const m = mid(p0, p1);
      const rot = rotationForDirection(p0, p1, cylindrical);
      const segLen = dist(p0, p1);
      const cut = canCut ? Math.min(segLen, stock) : undefined;

      if (s > 0) spliceCount += 1;

      instances.push({
        id: `${edge.id}-s${s}`,
        catalogId: graph.materialId,
        position: [m.x, m.y, m.z],
        rotation: rot,
        cutLength: cut,
        join: s > 0 ? "glue" : join,
        role: edge.role,
        from: [p0.x, p0.y, p0.z],
        to: [p1.x, p1.y, p1.z],
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
