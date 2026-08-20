/**
 * Stage A topology-lite: rank and prune redundant braces without a full FE solver.
 *
 * Ground-structure style: keep the anatomy wire, drop braces that do not
 * triangulate or that are pure duplicates, never split the structure, never
 * touch frame legs / critical members / opening edges.
 */

import type { StructureKind, Vec3 } from "./types";
import {
  StructureEdge,
  StructureGraph,
  StructureNode,
  createId,
} from "./structureGraph";
import { componentsOf, dist, graphEnvelope, segmentCrossesOpening } from "./connect";

const FRAME_ROLES = new Set(["leg", "base", "platform", "tip", "ring"]);
const PRUNABLE = new Set(["brace", "support"]);

function nodeMap(graph: StructureGraph): Map<string, StructureNode> {
  return new Map(graph.nodes.map((n) => [n.id, n]));
}

function degreeMap(edges: StructureEdge[]): Map<string, number> {
  const d = new Map<string, number>();
  for (const e of edges) {
    d.set(e.from, (d.get(e.from) ?? 0) + 1);
    d.set(e.to, (d.get(e.to) ?? 0) + 1);
  }
  return d;
}

function adjList(edges: StructureEdge[]): Map<string, Set<string>> {
  const a = new Map<string, Set<string>>();
  const add = (u: string, v: string) => {
    if (!a.has(u)) a.set(u, new Set());
    a.get(u)!.add(v);
  };
  for (const e of edges) {
    add(e.from, e.to);
    add(e.to, e.from);
  }
  return a;
}

function sharesTriangle(u: string, v: string, adj: Map<string, Set<string>>): boolean {
  const au = adj.get(u);
  const av = adj.get(v);
  if (!au || !av) return false;
  for (const w of au) {
    if (w !== v && av.has(w)) return true;
  }
  return false;
}

function braceScore(
  e: StructureEdge,
  nodes: Map<string, StructureNode>,
  adj: Map<string, Set<string>>,
  deg: Map<string, number>,
  envSpan: number,
): number {
  const a = nodes.get(e.from);
  const b = nodes.get(e.to);
  if (!a || !b) return 0;
  const len = dist(a.position, b.position);
  const tri = sharesTriangle(e.from, e.to, adj) ? 1 : 0;
  const da = deg.get(e.from) ?? 1;
  const db = deg.get(e.to) ?? 1;
  const lengthPenalty = len / Math.max(envSpan, 1);
  const endpointNeed = 1 / Math.max(Math.min(da, db), 1);
  let score = tri * 4 + endpointNeed * 2 - lengthPenalty * 0.8;
  if (e.critical) score += 100;
  if (e.role === "support") score += 0.5;
  return score;
}

export type TopoResult = {
  graph: StructureGraph;
  pruned: number;
  kept: number;
  note: string;
};

export function pruneTopology(
  graph: StructureGraph,
  kind: StructureKind,
  opts: { aggressiveness?: number } = {},
): TopoResult {
  const fig = kind === "figure" || kind === "plant" || kind === "vehicle" || kind === "vessel";
  const spanKind = kind === "bridge" || kind === "arch" || kind === "opening";
  const base = fig ? 0.1 : spanKind ? 0.18 : 0.32;
  const agg = Math.min(0.85, Math.max(0.05, opts.aggressiveness ?? base));

  if (graph.edges.length < 8) {
    return { graph, pruned: 0, kept: graph.edges.length, note: "Topology · too small to prune" };
  }

  const nodes = nodeMap(graph);
  const env = graphEnvelope(graph);
  const span = Math.max(env.maxX - env.minX, env.maxY - env.minY, env.maxZ - env.minZ, 1);

  const prunable = graph.edges.filter(
    (e) => PRUNABLE.has(e.role || "") && !e.critical && !FRAME_ROLES.has(e.role || ""),
  );
  if (!prunable.length) {
    return { graph, pruned: 0, kept: graph.edges.length, note: "Topology · no redundant braces" };
  }

  const adj = adjList(graph.edges);
  const deg = degreeMap(graph.edges);
  const ranked = [...prunable].sort(
    (x, y) => braceScore(x, nodes, adj, deg, span) - braceScore(y, nodes, adj, deg, span),
  );

  const targetRemove = Math.floor(prunable.length * agg);
  if (targetRemove < 1) {
    return { graph, pruned: 0, kept: graph.edges.length, note: "Topology · aggressiveness too low" };
  }

  const removeIds = new Set<string>();
  let edges = [...graph.edges];

  for (const cand of ranked) {
    if (removeIds.size >= targetRemove) break;
    const d = degreeMap(edges.filter((e) => e.id !== cand.id && !removeIds.has(e.id)));
    if ((d.get(cand.from) ?? 0) < 2 || (d.get(cand.to) ?? 0) < 2) continue;

    const trial = edges.filter((e) => e.id !== cand.id && !removeIds.has(e.id));
    const comps = componentsOf({ ...graph, edges: trial });
    if (comps.length > 1) continue;

    removeIds.add(cand.id);
    edges = trial;
  }

  const next: StructureGraph = {
    ...graph,
    edges,
    notes: [
      ...graph.notes,
      removeIds.size > 0
        ? `Topology · pruned ${removeIds.size} low-value brace(s); structure stays one piece`
        : "Topology · no braces safe to prune",
    ],
  };

  return {
    graph: next,
    pruned: removeIds.size,
    kept: edges.length,
    note:
      removeIds.size > 0
        ? `Topology-lite · −${removeIds.size} redundant braces (ground-structure style)`
        : "Topology-lite · structure already tight",
  };
}

export function densifyTriangles(
  graph: StructureGraph,
  kind: StructureKind,
  maxLen: number,
  maxAdd = 24,
): StructureGraph {
  if (graph.nodes.length < 4) return graph;
  const nodes = graph.nodes;
  const have = new Set(graph.edges.map((e) => [e.from, e.to].sort().join("|")));
  const env = graphEnvelope(graph);
  const adj = adjList(graph.edges);
  const added: StructureEdge[] = [];

  for (let i = 0; i < nodes.length && added.length < maxAdd; i++) {
    for (let j = i + 1; j < nodes.length && added.length < maxAdd; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const key = [a.id, b.id].sort().join("|");
      if (have.has(key)) continue;
      const len = dist(a.position, b.position);
      if (len < 0.5 || len > maxLen) continue;
      const sameFace =
        Math.abs(a.position.x - b.position.x) < 1.15 ||
        Math.abs(a.position.z - b.position.z) < 1.15 ||
        Math.abs(a.position.y - b.position.y) < 1.15;
      if (!sameFace) continue;
      if (segmentCrossesOpening(a.position, b.position, env, kind)) continue;
      if (!sharesTriangle(a.id, b.id, adj)) continue;
      const edge: StructureEdge = {
        id: createId("topo"),
        from: a.id,
        to: b.id,
        join: "glue",
        role: "brace",
        critical: false,
      };
      added.push(edge);
      have.add(key);
      if (!adj.has(a.id)) adj.set(a.id, new Set());
      if (!adj.has(b.id)) adj.set(b.id, new Set());
      adj.get(a.id)!.add(b.id);
      adj.get(b.id)!.add(a.id);
    }
  }

  if (!added.length) return graph;
  return {
    ...graph,
    edges: [...graph.edges, ...added],
    notes: [...graph.notes, `Topology · densified ${added.length} triangle brace(s)`],
  };
}
