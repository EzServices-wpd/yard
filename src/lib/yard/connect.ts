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

export function stockDensity(item: CatalogItem): StockDensity {
  const prim = toPrimitive(item);
  const stock = Math.max(0.75, prim.length);
  const thick = Math.max(prim.width, (prim.radius ?? 0) * 2, 0.08);
  const fat = thick >= 1.35;
  return {
    fat,
    chords: fat ? 1 : thick < 0.15 ? 4 : thick < 0.45 ? 3 : 2,
    bay: Math.max(stock * 0.62, thick * 5, 0.7),
    faceStep: Math.max(stock * 0.48, thick * 5),
    stock,
    thick,
  };
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

function componentsOf(graph: StructureGraph): string[][] {
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
export function stitchComponents(graph: StructureGraph): StructureGraph {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  let edges = [...graph.edges];
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
        if (d < best && d > 0.12) {
          best = d;
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
      const d = dist(n.position, g.position);
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
): { graph: StructureGraph; offer: SupportOffer } {
  const d = stockDensity(item);
  let next = weldGraph(graph, Math.max(d.thick * 1.6, 0.22));
  next = stitchComponents(next);
  next = ensureDownwardPath(next);
  const fig = kind === "figure" || kind === "plant" || kind === "vehicle" || kind === "vessel";
  if (fig) next = ribBands(next, Math.max(d.bay, 0.8), true);
  next = weldGraph(next, Math.max(d.thick * 1.6, 0.22));
  const offerBase = needsSpine(next, kind);
  const offer: SupportOffer = { ...offerBase, included: includeSpine && offerBase.needed };
  if (offer.included) next = addSpine(next);
  next = {
    ...next,
    notes: [
      ...next.notes,
      `${next.nodes.length} joints · ${next.edges.length} members after weld`,
    ],
  };
  return { graph: next, offer };
}
