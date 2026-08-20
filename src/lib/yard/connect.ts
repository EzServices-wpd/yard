/**
 * Stage 1 connectivity — one structure, stock-scaled density.
 * Mid-span crossings count as joins. Floating pieces do not.
 */

import type { CatalogItem, StructureKind, Vec3, YardInstance } from "./types";
import { toPrimitive } from "./geometry";
import {
  StructureEdge,
  StructureGraph,
  StructureNode,
  createId,
} from "./structureGraph";

export type StockDensity = {
  fat: boolean;
  chords: number;
  bay: number;
  faceStep: number;
  stock: number;
  thick: number;
};

export type SupportOffer = {
  needed: boolean;
  included: boolean;
  reason: string;
};

export type BuildStats = {
  joints: number;
  components: number;
  loose: number;
  pieces: number;
};

export function dist(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function mid(a: Vec3, b: Vec3): Vec3 {
  return lerp(a, b, 0.5);
}

/**
 * Stock is the mosaic tile size.
 * Thinner / shorter retail stock → denser lattice (toothpick vs 2x4).
 * grain > 1 coarsens; grain < 1 densifies (detail toggle later).
 */
export function stockDensity(item: CatalogItem, grain = 1): StockDensity {
  const prim = toPrimitive(item);
  const stock = Math.max(0.5, prim.length);
  const thick = Math.max(prim.width, (prim.radius ?? 0) * 2, 0.06);
  const fat = thick >= 1.35 || item.formFactor === "pipe" || (item.formFactor === "board" && thick >= 1.4);
  const g = Math.min(3.2, Math.max(0.32, grain));
  const lengthBit = Math.min(stock * 0.28, Math.max(thick * 8, 1.15));
  const tile = Math.max(thick * 2.8, lengthBit) * g;
  return {
    fat,
    chords: fat ? 1 : thick < 0.12 ? 4 : thick < 0.35 ? 3 : 2,
    bay: Math.max(tile * 1.15, thick * 4, 0.5),
    faceStep: Math.max(tile, thick * 3.5, 0.4),
    stock,
    thick,
  };
}

export type Envelope3 = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export function graphEnvelope(graph: StructureGraph): Envelope3 {
  const xs = graph.nodes.map((n) => n.position.x);
  const ys = graph.nodes.map((n) => n.position.y);
  const zs = graph.nodes.map((n) => n.position.z);
  return {
    minX: Math.min(...xs, 0),
    maxX: Math.max(...xs, 0),
    minY: Math.min(...ys, 0),
    maxY: Math.max(...ys, 0),
    minZ: Math.min(...zs, 0),
    maxZ: Math.max(...zs, 0),
  };
}

function pointInEnv(p: Vec3, env: Envelope3, pad: number): boolean {
  return (
    p.x >= env.minX - pad &&
    p.x <= env.maxX + pad &&
    p.y >= env.minY - pad &&
    p.y <= env.maxY + pad &&
    p.z >= env.minZ - pad &&
    p.z <= env.maxZ + pad
  );
}

/** Sample a segment — braces must stay inside the form AABB. */
export function segmentInEnvelope(a: Vec3, b: Vec3, env: Envelope3, pad: number): boolean {
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    if (!pointInEnv(lerp(a, b, t), env, pad)) return false;
  }
  return true;
}

/**
 * True if the midpoint sits on the existing structure (surface),
 * not floating through a void or outside the skin.
 */
export function segmentOnStructure(
  a: Vec3,
  b: Vec3,
  graph: StructureGraph,
  tol: number,
): boolean {
  const m = mid(a, b);
  for (const n of graph.nodes) {
    if (dist(m, n.position) <= tol) return true;
  }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const e of graph.edges) {
    const pa = byId.get(e.from);
    const pb = byId.get(e.to);
    if (!pa || !pb) continue;
    if (pointSegDist(m, pa.position, pb.position) <= tol) return true;
  }
  return false;
}

/** Portal void: walk-through zone must stay clear of braces. */
export function segmentCrossesOpening(
  a: Vec3,
  b: Vec3,
  env: Envelope3,
  kind: StructureKind,
): boolean {
  if (kind !== "arch" && kind !== "bridge" && kind !== "opening" && kind !== "pyramid") return false;
  const w = env.maxX - env.minX || 1;
  const d = env.maxZ - env.minZ || 1;
  const h = env.maxY - env.minY || 1;
  const cx = (env.minX + env.maxX) / 2;
  const cz = (env.minZ + env.maxZ) / 2;
  for (const t of [0.35, 0.5, 0.65]) {
    const p = lerp(a, b, t);
    const inX = Math.abs(p.x - cx) < w * 0.28;
    const inZ = Math.abs(p.z - cz) < d * 0.28;
    const inY = p.y > env.minY + h * 0.08 && p.y < env.minY + h * 0.55;
    if (kind === "arch" && inX && inZ && inY) return true;
    if (kind === "bridge" && inY && Math.abs(p.y - (env.minY + h * 0.35)) < h * 0.2 && inZ) {
      // deck gap under is OK
    }
    if (kind === "pyramid") {
      const doorW = w * 0.17;
      const doorH = h * 0.26;
      const onNorth = p.z < env.minZ + d * 0.18;
      const inDoorX = Math.abs(p.x - cx) < doorW * 0.55;
      const inDoorY = p.y > env.minY - 0.2 && p.y < env.minY + doorH;
      if (onNorth && inDoorX && inDoorY) return true;
    }
  }
  return false;
}

/**
 * Drop brace/support edges that leave the form or cut through openings.
 * Frame legs and critical members stay.
 */
export function confineSupports(
  graph: StructureGraph,
  kind: StructureKind,
  thick: number,
): StructureGraph {
  if (graph.nodes.length < 2) return graph;
  const env = graphEnvelope(graph);
  const pad = Math.max(thick * 2.5, 0.55);
  const tol = Math.max(thick * 3.5, 0.75);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const edges = graph.edges.filter((e) => {
    const role = e.role || "";
    if (role !== "brace" && role !== "support") return true;
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) return false;
    if (!segmentInEnvelope(a.position, b.position, env, pad)) return false;
    if (segmentCrossesOpening(a.position, b.position, env, kind)) return false;
    if (role === "brace" && !segmentOnStructure(a.position, b.position, graph, tol * 1.8)) {
      const sameFace =
        Math.abs(a.position.x - b.position.x) < tol ||
        Math.abs(a.position.z - b.position.z) < tol ||
        Math.abs(a.position.y - b.position.y) < tol;
      if (!sameFace) return false;
    }
    return true;
  });
  return { ...graph, edges };
}

export function joinTol(item: CatalogItem): number {
  const d = stockDensity(item);
  return Math.max(d.thick * 2.4, 0.32);
}

const ROLE_RANK: Record<string, number> = {
  base: 0,
  support: 1,
  leg: 2,
  platform: 3,
  ring: 4,
  rail: 5,
  tip: 6,
  brace: 7,
  splice: 8,
};

function roleRank(role?: string) {
  return ROLE_RANK[role ?? ""] ?? 9;
}

/** Merge nodes that sit on the same joint. */
export function weldGraph(graph: StructureGraph, tol = 0.28): StructureGraph {
  const nodes = graph.nodes;
  const n = nodes.length;
  if (n < 2) return graph;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    let p = i;
    while (parent[p] !== p) p = parent[p];
    let c = i;
    while (parent[c] !== c) {
      const next = parent[c];
      parent[c] = p;
      c = next;
    }
    return p;
  };
  const unite = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa === pb) return;
    const keep =
      roleRank(nodes[pa].role) <= roleRank(nodes[pb].role) ? pa : pb;
    const drop = keep === pa ? pb : pa;
    parent[drop] = keep;
  };

  const cell = Math.max(tol, 0.2);
  const buckets = new Map<string, number[]>();
  const keyOf = (p: Vec3) =>
    `${Math.round(p.x / cell)}|${Math.round(p.y / cell)}|${Math.round(p.z / cell)}`;
  for (let i = 0; i < n; i++) {
    const k = keyOf(nodes[i].position);
    const arr = buckets.get(k);
    if (arr) arr.push(i);
    else buckets.set(k, [i]);
  }
  const neigh = [-1, 0, 1];
  for (let i = 0; i < n; i++) {
    const p = nodes[i].position;
    const cx = Math.round(p.x / cell);
    const cy = Math.round(p.y / cell);
    const cz = Math.round(p.z / cell);
    for (const dx of neigh) {
      for (const dy of neigh) {
        for (const dz of neigh) {
          const others = buckets.get(`${cx + dx}|${cy + dy}|${cz + dz}`);
          if (!others) continue;
          for (const j of others) {
            if (j <= i) continue;
            if (dist(p, nodes[j].position) <= tol) unite(i, j);
          }
        }
      }
    }
  }

  const kept = new Map<number, StructureNode>();
  const remap = new Map<string, string>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!kept.has(root)) kept.set(root, nodes[root]);
    remap.set(nodes[i].id, nodes[root].id);
  }

  const seen = new Set<string>();
  const edges: StructureEdge[] = [];
  for (const e of graph.edges) {
    const from = remap.get(e.from) ?? e.from;
    const to = remap.get(e.to) ?? e.to;
    if (from === to) continue;
    const key = from < to ? `${from}|${to}|${e.role}` : `${to}|${from}|${e.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ ...e, from, to });
  }

  return { ...graph, nodes: [...kept.values()], edges };
}

export function componentsOf(graph: StructureGraph): string[][] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let p = parent.get(id) ?? id;
    if (!parent.has(id)) parent.set(id, id);
    while ((parent.get(p) ?? p) !== p) p = parent.get(p) ?? p;
    parent.set(id, p);
    return p;
  };
  const unite = (a: string, b: string) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent.set(pb, pa);
  };
  for (const n of graph.nodes) parent.set(n.id, n.id);
  for (const e of graph.edges) unite(e.from, e.to);
  const groups = new Map<string, string[]>();
  for (const n of graph.nodes) {
    const r = find(n.id);
    const arr = groups.get(r);
    if (arr) arr.push(n.id);
    else groups.set(r, [n.id]);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

/** Tie leftover islands into the main body. Mid-span crossings are allowed. */
export function stitchComponents(graph: StructureGraph, kind: StructureKind = "custom"): StructureGraph {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  let edges = [...graph.edges];
  const env0 = graphEnvelope(graph);
  const pad = 0.85;
  for (let pass = 0; pass < 24; pass++) {
    const groups = componentsOf({ ...graph, edges });
    if (groups.length <= 1) break;
    const main = groups[0];
    const island = groups[1];
    let best = Infinity;
    let pair: [string, string] | null = null;
    for (const a of island) {
      const pa = nodes.get(a);
      if (!pa) continue;
      for (const b of main) {
        const pb = nodes.get(b);
        if (!pb) continue;
        const d = dist(pa.position, pb.position);
        if (d <= 0.12 || d > 36) continue;
        if (!segmentInEnvelope(pa.position, pb.position, env0, pad)) continue;
        if (segmentCrossesOpening(pa.position, pb.position, env0, kind)) continue;
        const sameFace =
          Math.abs(pa.position.x - pb.position.x) < 1.2 ||
          Math.abs(pa.position.z - pb.position.z) < 1.2 ||
          Math.abs(pa.position.y - pb.position.y) < 1.2;
        const score = d * (sameFace ? 1 : 3.5);
        if (score < best) {
          best = score;
          pair = [a, b];
        }
      }
    }
    if (!pair) break;
    edges.push({
      id: createId("stitch"),
      from: pair[0],
      to: pair[1],
      join: "glue",
      role: "brace",
      critical: false,
    });
  }
  return { ...graph, edges };
}

export function needsSpine(
  graph: StructureGraph,
  kind: StructureKind,
): { needed: boolean; reason: string } {
  if (!graph.nodes.length) return { needed: false, reason: "" };
  const ys = graph.nodes.map((n) => n.position.y);
  const xs = graph.nodes.map((n) => n.position.x);
  const zs = graph.nodes.map((n) => n.position.z);
  const height = Math.max(...ys) - Math.min(...ys);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 0.5);
  const slender = height / span > 2.8;
  const figure = kind === "figure" || kind === "plant" || kind === "vehicle" || kind === "vessel";
  if (kind === "arch" || kind === "bridge" || kind === "opening" || kind === "closet" || kind === "pyramid") {
    return { needed: false, reason: "" };
  }
  if (figure) {
    return {
      needed: true,
      reason: "This is a figure armature — it will stand as a display model, not a load-bearing frame. Add a spine if you want it to hold itself up.",
    };
  }
  if (slender) {
    return {
      needed: true,
      reason: `Slender (${(height / span).toFixed(1)}:1). The frame may not stand until it is braced and cured. Add a spine if you want temporary support built in.`,
    };
  }
  return { needed: false, reason: "" };
}

export function addSpine(graph: StructureGraph, frac = 0.42): StructureGraph {
  if (!graph.nodes.length) return graph;
  const ys = graph.nodes.map((n) => n.position.y);
  const y0 = Math.min(...ys);
  const y1 = y0 + (Math.max(...ys) - y0) * frac;
  const base = graph.nodes.filter((n) => n.position.y <= y0 + 0.8);
  const cx = base.reduce((s, n) => s + n.position.x, 0) / Math.max(base.length, 1);
  const cz = base.reduce((s, n) => s + n.position.z, 0) / Math.max(base.length, 1);
  const mast0 = createId("spine0");
  const mast1 = createId("spine1");
  const nodes: StructureNode[] = [
    ...graph.nodes,
    { id: mast0, position: { x: cx, y: y0, z: cz }, role: "base" },
    { id: mast1, position: { x: cx, y: y1, z: cz }, role: "support" },
  ];
  const edges: StructureEdge[] = [
    ...graph.edges,
    { id: createId("spine"), from: mast0, to: mast1, join: "glue", role: "support", critical: true },
  ];
  const ties = 4;
  for (let i = 1; i <= ties; i++) {
    const y = y0 + ((y1 - y0) * i) / ties;
    const hub = { x: cx, y, z: cz };
    const nearest = [...graph.nodes].sort((a, b) => dist(a.position, hub) - dist(b.position, hub))[0];
    if (!nearest) continue;
    const hid = createId(`spineh${i}`);
    nodes.push({ id: hid, position: hub, role: "support" });
    edges.push({ id: createId(`spinee${i}`), from: hid, to: nearest.id, join: "glue", role: "support", critical: false });
    if (i > 1) {
      const prev = nodes[nodes.length - 2];
      if (prev) edges.push({ id: createId(`spinem${i}`), from: prev.id, to: hid, join: "glue", role: "support" });
    } else {
      edges.push({ id: createId("spinem0"), from: mast0, to: hid, join: "glue", role: "support" });
    }
  }
  return {
    ...graph,
    nodes,
    edges,
    notes: [...graph.notes, "Internal spine included — temporary support until the frame is braced and cured."],
  };
}

export function resampleStroke(points: Vec3[], spacing: number): Vec3[] {
  if (points.length < 2) return points;
  const out: Vec3[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = dist(a, b);
    const steps = Math.max(1, Math.round(len / Math.max(spacing, 0.6)));
    for (let k = 1; k <= steps; k++) out.push(lerp(a, b, k / steps));
  }
  return out;
}

export function snapStrokes(strokes: { points: Vec3[]; role?: string }[], tol: number) {
  const anchors: Vec3[] = [];
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((p) => {
      let best = p;
      let bestD = tol;
      for (const a of anchors) {
        const d = dist(p, a);
        if (d < bestD) {
          bestD = d;
          best = a;
        }
      }
      if (best === p) anchors.push(p);
      return best;
    }),
  }));
}

function pointSegDist(p: Vec3, a: Vec3, b: Vec3): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const apz = p.z - a.z;
  const ab2 = abx * abx + aby * aby + abz * abz || 1;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / ab2));
  return dist(p, { x: a.x + abx * t, y: a.y + aby * t, z: a.z + abz * t });
}

export function pieceEnds(inst: YardInstance, length: number): { a: Vec3; b: Vec3 } {
  if (inst.from && inst.to) return { a: inst.from, b: inst.to };
  const half = length / 2;
  const { x: rx, y: ry, z: rz } = inst.rotation;
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  const dx = cy * cz;
  const dy = -sz;
  const dz = sy * cz;
  const nx = rx !== 0 ? Math.sin(ry) : dx;
  const ny = rx !== 0 ? Math.cos(rx) : dy;
  const nz = rx !== 0 ? Math.cos(ry) : dz;
  const p = inst.home ?? inst.position;
  return {
    a: { x: p.x - nx * half, y: p.y - ny * half, z: p.z - nz * half },
    b: { x: p.x + nx * half, y: p.y + ny * half, z: p.z + nz * half },
  };
}

export function analyzePieces(instances: YardInstance[], item: CatalogItem): BuildStats {
  const n = instances.length;
  if (!n) return { joints: 0, components: 0, loose: 0, pieces: 0 };
  const tol = joinTol(item);
  const segs = instances.map((inst) => {
    const len = toPrimitive(item, inst.cutLength).length;
    return pieceEnds(inst, len);
  });
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    let p = i;
    while (parent[p] !== p) p = parent[p];
    return p;
  };
  const unite = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pb] = pa;
  };
  let joints = 0;
  const deg = new Array(n).fill(0);
  const cell = Math.max(tol, 0.25);
  const buckets = new Map<string, number[]>();
  const put = (x: number, y: number, z: number, i: number) => {
    const k = `${Math.round(x / cell)}|${Math.round(y / cell)}|${Math.round(z / cell)}`;
    const arr = buckets.get(k);
    if (arr) arr.push(i);
    else buckets.set(k, [i]);
  };
  for (let i = 0; i < n; i++) {
    put(segs[i].a.x, segs[i].a.y, segs[i].a.z, i);
    put(segs[i].b.x, segs[i].b.y, segs[i].b.z, i);
  }
  const neigh = [-1, 0, 1];
  const seen = new Set<string>();
  const consider = (i: number, j: number) => {
    if (i === j) return;
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    const key = `${a}|${b}`;
    if (seen.has(key)) return;
    seen.add(key);
    const A = segs[a];
    const B = segs[b];
    const hit =
      dist(A.a, B.a) <= tol ||
      dist(A.a, B.b) <= tol ||
      dist(A.b, B.a) <= tol ||
      dist(A.b, B.b) <= tol ||
      pointSegDist(A.a, B.a, B.b) <= tol ||
      pointSegDist(A.b, B.a, B.b) <= tol ||
      pointSegDist(B.a, A.a, A.b) <= tol ||
      pointSegDist(B.b, A.a, A.b) <= tol;
    if (hit) {
      unite(a, b);
      joints += 1;
      deg[a] += 1;
      deg[b] += 1;
    }
  };
  for (let i = 0; i < n; i++) {
    for (const p of [segs[i].a, segs[i].b]) {
      const cx = Math.round(p.x / cell);
      const cy = Math.round(p.y / cell);
      const cz = Math.round(p.z / cell);
      for (const dx of neigh) {
        for (const dy of neigh) {
          for (const dz of neigh) {
            const others = buckets.get(`${cx + dx}|${cy + dy}|${cz + dz}`);
            if (!others) continue;
            for (const j of others) consider(i, j);
          }
        }
      }
    }
  }
  const roots = new Set<number>();
  for (let i = 0; i < n; i++) roots.add(find(i));
  const loose = deg.filter((d) => d === 0).length;
  return { joints, components: roots.size, loose, pieces: n };
}

export function ensureDownwardPath(graph: StructureGraph): StructureGraph {
  if (graph.nodes.length < 2) return graph;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const lower: Map<string, boolean> = new Map();
  for (const e of graph.edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    if (a.position.y > b.position.y + 0.15) lower.set(a.id, true);
    if (b.position.y > a.position.y + 0.15) lower.set(b.id, true);
  }
  const yMin = Math.min(...graph.nodes.map((n) => n.position.y));
  const edges = [...graph.edges];
  const grounded = graph.nodes.filter((n) => n.position.y <= yMin + 0.6);
  for (const n of graph.nodes) {
    if (n.position.y <= yMin + 0.6) continue;
    if (lower.get(n.id)) continue;
    let best: StructureNode | null = null;
    let bestD = Infinity;
    for (const g of graph.nodes) {
      if (g.id === n.id) continue;
      if (g.position.y >= n.position.y - 0.1) continue;
      const lateral = Math.hypot(n.position.x - g.position.x, n.position.z - g.position.z);
      const d = dist(n.position, g.position) + lateral * 2.2;
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    const target = best ?? grounded[0];
    if (!target) continue;
    edges.push({
      id: createId("down"),
      from: n.id,
      to: target.id,
      join: "glue",
      role: "leg",
      critical: true,
    });
  }
  return { ...graph, edges };
}

export function ribBands(graph: StructureGraph, band: number, skipGround = true): StructureGraph {
  if (graph.nodes.length < 4) return graph;
  const yMin = Math.min(...graph.nodes.map((n) => n.position.y));
  const groups = new Map<number, StructureNode[]>();
  for (const n of graph.nodes) {
    if (skipGround && n.position.y < yMin + band * 0.45) continue;
    const k = Math.round(n.position.y / Math.max(band, 0.4));
    const arr = groups.get(k);
    if (arr) arr.push(n);
    else groups.set(k, [n]);
  }
  const edges = [...graph.edges];
  const have = new Set(graph.edges.map((e) => [e.from, e.to].sort().join("|")));
  for (const nodes of groups.values()) {
    if (nodes.length < 2 || nodes.length > 14) continue;
    const cx = nodes.reduce((s, n) => s + n.position.x, 0) / nodes.length;
    const cz = nodes.reduce((s, n) => s + n.position.z, 0) / nodes.length;
    const ordered = [...nodes].sort(
      (a, b) => Math.atan2(a.position.z - cz, a.position.x - cx) - Math.atan2(b.position.z - cz, b.position.x - cx),
    );
    const n = ordered.length;
    const link = (i: number, j: number) => {
      const a = ordered[i].id;
      const b = ordered[j].id;
      const key = [a, b].sort().join("|");
      if (have.has(key)) return;
      have.add(key);
      edges.push({ id: createId("rib"), from: a, to: b, join: "glue", role: "rail", critical: false });
    };
    if (n === 2) link(0, 1);
    else {
      for (let i = 0; i < n; i++) link(i, (i + 1) % n);
      if (n === 4) link(0, 2);
    }
  }
  return { ...graph, edges };
}

export function finishGraph(
  graph: StructureGraph,
  item: CatalogItem,
  kind: StructureKind,
  includeSpine = false,
  grain = 1,
): { graph: StructureGraph; offer: SupportOffer } {
  const d = stockDensity(item, grain);
  const weldTol =
    kind === "pyramid"
      ? Math.max(Math.min(d.thick, item.dims.thickness ?? d.thick) * 1.8, 0.1)
      : Math.max(d.thick * 1.6, 0.22);
  let next = weldGraph(graph, weldTol);
  next = stitchComponents(next, kind);
  const spanKind = kind === "arch" || kind === "bridge" || kind === "opening" || kind === "pyramid";
  // Span forms already placed their piers. Dropping a leg from every deck/cable
  // node turns a suspension into a lattice cage.
  if (!spanKind) next = ensureDownwardPath(next);
  const fig = kind === "figure" || kind === "plant" || kind === "vehicle" || kind === "vessel";
  if (fig) next = ribBands(next, Math.max(d.bay, 0.8), true);
  next = weldGraph(next, weldTol);
  const offerBase = needsSpine(next, kind);
  const offer: SupportOffer = { ...offerBase, included: includeSpine && offerBase.needed };
  if (offer.included) next = addSpine(next);
  next = confineSupports(next, kind, d.thick);
  next = {
    ...next,
    notes: [
      ...next.notes,
      `${next.nodes.length} joints · ${next.edges.length} members after weld`,
      `Resolution · ${item.name} tiles the form at ~${d.faceStep.toFixed(1)}" pitch (stock is the mosaic cell).`,
      "Braces stay on the form — nothing through openings or outside the silhouette.",
    ],
  };
  return { graph: next, offer };
}
