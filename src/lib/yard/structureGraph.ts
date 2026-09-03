/**
 * StructureGraph — discrete, buildable topology for Forge.
 * Nodes + edges map 1:1 onto catalog stock after subdivision.
 * Phase 1 foundation for Eiffel-scale (and any) lattice structures.
 */

import type { CatalogItem, JoinMethod, Vec3 } from "./types";
import { isWholeStock, toPrimitive } from "./geometry";

export type { Vec3 };

export interface StructureNode {
  id: string;
  position: Vec3;
  /** Optional semantic role for instructions */
  role?: "base" | "leg" | "brace" | "ring" | "platform" | "tip" | "splice" | "rail" | "support" | "skin";
}

export interface StructureEdge {
  id: string;
  from: string;
  to: string;
  /** How these two ends meet in the real world */
  join: JoinMethod;
  /** Structural importance for sequencing / warnings */
  critical?: boolean;
  role?: "leg" | "brace" | "ring" | "rail" | "splice" | "deck" | "support" | "skin";
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
 * Pyramid hips are a chain of short collinear legs — emit them as one
 * spliced member so the BOM is four long rafters, not 80 toothpicks.
 * Craft stock (popsicle, straw, toothpick) is laid as WHOLE sticks —
 * never snipped to a unique length — but ends meet at nodes (no piercing).
 */
export function graphToInstances(
  graph: StructureGraph,
  item: CatalogItem,
  joinOverride?: JoinMethod,
  opts: { whole?: boolean } = {},
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
  const whole = opts.whole ?? isWholeStock(item);
  const defaultJoin: JoinMethod =
    joinOverride || (item.preferredJoins && item.preferredJoins[0]) || "glue";
  // Splice lap is a small surface for glue — not a through-penetration.
  const lap = Math.min(stock * 0.08, Math.max(thick * 2.2, 0.18));

  const instances: GraphInstance[] = [];
  let spliceCount = 0;
  const joinCounts = new Map<string, number>();

  const bumpJoin = (j: JoinMethod) =>
    joinCounts.set(j, (joinCounts.get(j) ?? 0) + 1);

  const pushPiece = (
    a: Vec3,
    b: Vec3,
    join: JoinMethod,
    role: StructureEdge["role"],
    id: string,
    cut?: number,
    critical = false,
  ) => {
    const segLen = dist(a, b);
    const face = item.formFactor === "board" || item.formFactor === "sheet" ? Math.max(prim.height, 0.08) : thick;
    // Drop micro-edges that read as floating blobs — but never discard a critical frame member.
    // Craft-thin stock (toothpick / short stick) keeps intentional lace at face×2.1.
    const craftThin = face < 0.22 || (item.formFactor === "stick" && (item.dims.length ?? 8) <= 6);
    const minLen = Math.max(face * (craftThin ? 2.1 : 2.5), item.formFactor === "sheet" ? 1.2 : 0.4);
    if (segLen < minLen && !critical) return;
    const m = mid(a, b);
    const rot = rotationForDirection(a, b, cylindrical);
    instances.push({
      id,
      catalogId: item.id,
      position: [m.x, m.y, m.z],
      rotation: rot,
      cutLength: whole ? undefined : cut,
      join,
      role,
      from: [a.x, a.y, a.z],
      to: [b.x, b.y, b.z],
    });
  };

  const emitRun = (
    p0: Vec3,
    p1: Vec3,
    join: JoinMethod,
    role: StructureEdge["role"],
    id: string,
    critical = false,
  ) => {
    const length = dist(p0, p1);
    const face = item.formFactor === "board" || item.formFactor === "sheet" ? Math.max(prim.height, 0.08) : thick;
    const craftThin = face < 0.22 || (item.formFactor === "stick" && (item.dims.length ?? 8) <= 6);
    const minLen = Math.max(face * (craftThin ? 2.1 : 2.5), item.formFactor === "sheet" ? 1.2 : 0.4);
    if (length < minLen && !critical) return;
    bumpJoin(join);

    if (whole) {
      const ux = (p1.x - p0.x) / (length || 1);
      const uy = (p1.y - p0.y) / (length || 1);
      const uz = (p1.z - p0.z) / (length || 1);
      const along = (origin: Vec3, t: number): Vec3 => ({
        x: origin.x + ux * t,
        y: origin.y + uy * t,
        z: origin.z + uz * t,
      });

      // Short edge: ends meet at the nodes. Never center a full stick past both
      // joints — that is what made one popsicle pierce through another.
      // Canvas pad still seats the tip into the joint hub for a readable seam.
      if (length <= stock * 1.02) {
        pushPiece(p0, p1, join, role, `${id}-s0`, undefined, critical);
        return;
      }

      // Long run: lay whole sticks end-to-end with a small splice lap only.
      // Step so consecutive sticks share ~lap of surface, not a full through-cross.
      const usable = Math.max(stock - lap, stock * 0.88);
      const n = Math.max(2, Math.ceil((length - lap) / usable));
      const step = (length - stock) / Math.max(n - 1, 1);
      for (let s = 0; s < n; s++) {
        const start = Math.min(s * step, Math.max(0, length - stock));
        const a = along(p0, start);
        const b = along(p0, start + stock);
        if (s > 0) spliceCount += 1;
        pushPiece(a, b, s > 0 ? "glue" : join, role, `${id}-s${s}`, undefined, critical);
      }
      return;
    }

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
      const a = lerp(p0, p1, t0);
      const b = lerp(p0, p1, t1);
      const segLen = dist(a, b);
      const cut = canCut ? Math.min(segLen, stock) : undefined;
      if (s > 0) spliceCount += 1;
      pushPiece(a, b, s > 0 ? "glue" : join, role, `${id}-s${s}`, cut, critical);
    }
  };

  const consumed = new Set<string>();
  if (graph.structureClass === "pyramid") {
    for (const path of collinearLegPaths(graph, nodeMap)) {
      for (const id of path.edgeIds) consumed.add(id);
      emitRun(path.a, path.b, path.join, "leg", path.id, true);
    }
  }

  for (const edge of graph.edges) {
    if (consumed.has(edge.id)) continue;
    const a = nodeMap.get(edge.from);
    const b = nodeMap.get(edge.to);
    if (!a || !b) continue;
    emitRun(a.position, b.position, edge.join || defaultJoin, edge.role, edge.id, !!edge.critical);
  }

  const joinSummary = [...joinCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([j, n]) => `${n}× ${j}`);

  return { instances, joinSummary, spliceCount };
}

function collinearLegPaths(
  graph: StructureGraph,
  nodeMap: Map<string, StructureNode>,
): { id: string; join: JoinMethod; a: Vec3; b: Vec3; edgeIds: string[] }[] {
  const legs = graph.edges.filter((e) => e.role === "leg");
  if (legs.length < 2) return [];
  const adj = new Map<string, { to: string; edge: StructureEdge }[]>();
  for (const e of legs) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push({ to: e.to, edge: e });
    adj.get(e.to)!.push({ to: e.from, edge: e });
  }
  const used = new Set<string>();
  const out: { id: string; join: JoinMethod; a: Vec3; b: Vec3; edgeIds: string[] }[] = [];

  const unit = (p: Vec3, q: Vec3): Vec3 => {
    const l = dist(p, q) || 1;
    return { x: (q.x - p.x) / l, y: (q.y - p.y) / l, z: (q.z - p.z) / l };
  };

  const extend = (start: string, firstTo: string, firstEdge: StructureEdge) => {
    const ids = [firstEdge.id];
    let prev = start;
    let cur = firstTo;
    let dir = unit(nodeMap.get(start)!.position, nodeMap.get(firstTo)!.position);
    while (true) {
      const opts = (adj.get(cur) ?? []).filter((n) => n.to !== prev && !used.has(n.edge.id));
      let next: { to: string; edge: StructureEdge } | null = null;
      for (const n of opts) {
        if (n.edge.role !== "leg") continue;
        const d = unit(nodeMap.get(cur)!.position, nodeMap.get(n.to)!.position);
        if (d.x * dir.x + d.y * dir.y + d.z * dir.z > 0.97) {
          next = n;
          break;
        }
      }
      if (!next) break;
      used.add(next.edge.id);
      ids.push(next.edge.id);
      dir = unit(nodeMap.get(cur)!.position, nodeMap.get(next.to)!.position);
      prev = cur;
      cur = next.to;
    }
    return { end: cur, ids };
  };

  for (const e of legs) {
    if (used.has(e.id)) continue;
    used.add(e.id);
    const left = extend(e.to, e.from, e);
    const right = extend(e.from, e.to, e);
    const a = nodeMap.get(left.end);
    const b = nodeMap.get(right.end);
    if (!a || !b) continue;
    const edgeIds = [...left.ids.slice(1).reverse(), e.id, ...right.ids.slice(1)];
    out.push({ id: e.id, join: e.join, a: a.position, b: b.position, edgeIds });
  }
  return out;
}

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
