/**
 * Universal form → StructureGraph.
 * Every model: map stock onto the recipe wire, then choose frame / brace /
 * support from the material (fat column vs thin truss). No piece-count cap.
 */

import type { CatalogItem, JoinMethod, StructureKind } from "./types";
import type { FormOp, FormRecipe } from "./form";
import {
  StructureEdge,
  StructureGraph,
  StructureNode,
  Vec3,
  createId,
} from "./structureGraph";
import {
  finishGraph,
  resampleStroke,
  snapStrokes,
  stockDensity,
  type StockDensity,
  type SupportOffer,
} from "./connect";
import { densifyTriangles, pruneTopology } from "./topo";
import { buildSquareLoft, buildSteppedPyramid, hoopSchedule } from "./lattice";
import { buildShell } from "./shell";

export type StockPolicy = StockDensity;

export function stockPolicy(item: CatalogItem): StockPolicy {
  return stockDensity(item);
}

export function buildFormGraph(
  recipe: FormRecipe,
  item: CatalogItem,
  materialId: string,
  opts: { includeSpine?: boolean; kind?: StructureKind; grain?: number } = {},
): { graph: StructureGraph; offer: SupportOffer } {
  const policy = stockDensity(item, opts.grain ?? 1);
  const join: JoinMethod = (item.preferredJoins && item.preferredJoins[0]) || "glue";
  const braceJoin: JoinMethod = join === "solvent" ? "solvent" : join === "screw" ? "screw" : "glue";
  const kind = opts.kind ?? recipe.kind;
  const memberBuilt = kind === "furniture" || kind === "ladder" || kind === "frame" || kind === "figure";

  if (kind === "pyramid") {
    return buildPyramidForm(recipe, item, materialId, opts);
  }

  const nodes: StructureNode[] = [];
  const edges: StructureEdge[] = [];
  const verticals: { a: string; b: string }[] = [];

  const addNode = (p: Vec3, role: StructureNode["role"] = "leg") => {
    const id = createId("n");
    nodes.push({ id, position: p, role });
    return id;
  };
  const addEdge = (from: string, to: string, role: StructureEdge["role"], critical = false, j = join) => {
    if (from === to) return;
    edges.push({ id: createId("e"), from, to, join: j, role, critical });
  };
  const chain = (ids: string[], role: StructureEdge["role"], critical = false) => {
    for (let i = 0; i < ids.length - 1; i++) addEdge(ids[i], ids[i + 1], role, critical);
  };

  const apply = (op: FormOp) => {
    switch (op.op) {
      case "column": {
        const ids = [
          addNode({ x: op.x, y: op.y0, z: op.z }, "base"),
          addNode({ x: op.x, y: op.y1, z: op.z }, "leg"),
        ];
        chain(ids, (op.role as StructureEdge["role"]) || "leg", true);
        verticals.push({ a: ids[0], b: ids[1] });
        return;
      }
      case "ring": {
        const n = op.n ?? (policy.fat ? 6 : Math.max(8, Math.round((2 * Math.PI * op.rx) / policy.faceStep)));
        const rz = op.rz ?? op.rx;
        const ids: string[] = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          ids.push(addNode({ x: Math.cos(a) * op.rx, y: op.y, z: Math.sin(a) * rz }, "ring"));
        }
        for (let i = 0; i < ids.length; i++) addEdge(ids[i], ids[(i + 1) % ids.length], (op.role as StructureEdge["role"]) || "ring");
        return;
      }
      case "taper": {
        const H = Math.max(op.y1 - op.y0, 1);
        const stories = Math.max(2, Math.round(H / policy.bay));
        const ts = Array.from({ length: stories + 1 }, (_, i) => i / stories);
        const loft = buildSquareLoft({
          height: H,
          halfAt: (t) => op.r0 + (op.r1 - op.r0) * t,
          ts,
          item,
          hoopAt: hoopSchedule(ts, [], 3),
          laceFace: () => true,
          join,
          braceJoin,
          pierChords: 1,
          maxFaceDivs: policy.fat ? 2 : 4,
        });
        const remap = new Map<string, string>();
        for (const n of loft.nodes) {
          remap.set(n.id, addNode({ x: n.position.x, y: n.position.y + op.y0, z: n.position.z }, n.role));
        }
        for (const e of loft.edges) {
          const from = remap.get(e.from);
          const to = remap.get(e.to);
          if (from && to) addEdge(from, to, e.role, !!e.critical, e.join);
        }
        return;
      }
      case "box": {
        const hx = op.w / 2;
        const hy = op.h / 2;
        const hz = op.d / 2;
        const corners: Vec3[] = [];
        for (const y of [op.y - hy, op.y + hy]) {
          for (const [x, z] of [
            [op.x - hx, op.z - hz],
            [op.x + hx, op.z - hz],
            [op.x + hx, op.z + hz],
            [op.x - hx, op.z + hz],
          ] as const) {
            corners.push({ x, y, z });
          }
        }
        const ids = corners.map((p, i) => addNode(p, i < 4 ? "base" : "leg"));
        const ring = (a: number) => {
          addEdge(ids[a], ids[a + 1], "ring");
          addEdge(ids[a + 1], ids[a + 2], "ring");
          addEdge(ids[a + 2], ids[a + 3], "ring");
          addEdge(ids[a + 3], ids[a], "ring");
        };
        ring(0);
        ring(4);
        for (let i = 0; i < 4; i++) addEdge(ids[i], ids[i + 4], "leg", true);
        // Fat lumber frames stay member-built (cut list). Thin craft stock gets face braces
        // so a named-stock weekend frame densifies at catalog pitch, not a hollow cube.
        if (!memberBuilt || (kind === "frame" && !policy.fat)) {
          for (let i = 0; i < 4; i++) addEdge(ids[i], ids[4 + ((i + 1) % 4)], "brace", false, braceJoin);
        }
        return;
      }
      case "arch": {
        const portal = recipe.kind === "arch";
        const segs = policy.fat || portal ? 4 : Math.max(8, Math.round(Math.hypot(op.x1 - op.x0, op.z1 - op.z0) / policy.faceStep));
        const y0 = op.y0 ?? 0;
        const ids: string[] = [];
        for (let i = 0; i <= segs; i++) {
          const u = i / segs;
          ids.push(
            addNode(
              {
                x: op.x0 + (op.x1 - op.x0) * u,
                y: y0 + Math.sin(u * Math.PI) * op.crown,
                z: op.z0 + (op.z1 - op.z0) * u,
              },
              i === 0 || i === segs ? "base" : "brace",
            ),
          );
        }
        chain(ids, (op.role as StructureEdge["role"]) || "support", true);
        return;
      }
      case "dome": {
        const shell = buildShell({
          y0: op.y0,
          y1: op.y0 + op.r,
          r: op.r,
          cx: op.x,
          cz: op.z,
          profile: "hemisphere",
          item,
          join,
          braceJoin,
        });
        const remap = new Map<string, string>();
        for (const n of shell.nodes) remap.set(n.id, addNode(n.position, n.role));
        for (const e of shell.edges) {
          const from = remap.get(e.from);
          const to = remap.get(e.to);
          if (from && to) addEdge(from, to, e.role, !!e.critical, e.join);
        }
        return;
      }
      case "shell": {
        const shell = buildShell({
          y0: op.y0,
          y1: op.y1,
          r: op.r,
          cx: op.x,
          cz: op.z,
          profile: op.profile ?? "hemisphere",
          item,
          join,
          braceJoin,
        });
        const remap = new Map<string, string>();
        for (const n of shell.nodes) remap.set(n.id, addNode(n.position, n.role));
        for (const e of shell.edges) {
          const from = remap.get(e.from);
          const to = remap.get(e.to);
          if (from && to) addEdge(from, to, e.role, !!e.critical, e.join);
        }
        return;
      }
      case "grid": {
        const nx = op.nx ?? Math.max(2, Math.round(op.w / policy.faceStep));
        const nz = op.nz ?? Math.max(2, Math.round(op.d / policy.faceStep));
        const cx = op.x ?? 0;
        const cz = op.z ?? 0;
        const ids: string[][] = [];
        for (let i = 0; i <= nx; i++) {
          const row: string[] = [];
          for (let k = 0; k <= nz; k++) {
            row.push(
              addNode(
                {
                  x: cx - op.w / 2 + (op.w * i) / nx,
                  y: op.y,
                  z: cz - op.d / 2 + (op.d * k) / nz,
                },
                "rail",
              ),
            );
          }
          ids.push(row);
        }
        for (let i = 0; i <= nx; i++) {
          for (let k = 0; k < nz; k++) addEdge(ids[i][k], ids[i][k + 1], (op.role as StructureEdge["role"]) || "rail");
        }
        for (let k = 0; k <= nz; k++) {
          for (let i = 0; i < nx; i++) addEdge(ids[i][k], ids[i + 1][k], (op.role as StructureEdge["role"]) || "rail");
        }
        return;
      }
      case "poly": {
        if (op.points.length < 2) return;
        const portal = recipe.kind === "arch";
        // Fat lumber / arch portal / ladder-like frames keep intentional members.
        // Thin craft weekend frames + figures densify the stroke at stock bay.
        const keepMembers = policy.fat || portal || (memberBuilt && kind !== "frame" && kind !== "figure");
        const pts = keepMembers ? op.points : resampleStroke(op.points, policy.bay);
        const ids = pts.map((p, i) => addNode(p, i === 0 ? "base" : "leg"));
        chain(ids, (op.role as StructureEdge["role"]) || "leg", true);
        return;
      }
      case "legs": {
        for (let i = 0; i < op.count; i++) {
          const a = (i / op.count) * Math.PI * 2 + Math.PI / 4;
          apply({
            op: "column",
            x: Math.cos(a) * op.radius,
            z: Math.sin(a) * op.radius,
            y0: op.y0,
            y1: op.y1,
            role: op.role || "leg",
          });
        }
        return;
      }
    }
  };

  const snapped = snapStrokes(recipe.strokes ?? [], Math.max(policy.thick * 2, 0.35));
  for (const stroke of snapped) {
    apply({ op: "poly", points: stroke.points, role: stroke.role || "leg" });
  }
  for (const op of recipe.ops) apply(op);

  const openKind = kind === "arch" || kind === "bridge" || kind === "opening";
  // Thin craft weekend frames also get face X-braces between uprights — densify at stock
  // pitch without a per-noun .ts (catapult / box / scaffold share this path).
  const thinFrameLace = kind === "frame" && !policy.fat;
  if (!openKind && (!memberBuilt || thinFrameLace) && verticals.length >= 2) {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const xs = nodes.map((n) => n.position.x);
    const ys = nodes.map((n) => n.position.y);
    const zs = nodes.map((n) => n.position.z);
    const env = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
    };
    const pad = Math.max(policy.thick * 2.5, 0.55);
    const inEnv = (p: { x: number; y: number; z: number }) =>
      p.x >= env.minX - pad &&
      p.x <= env.maxX + pad &&
      p.y >= env.minY - pad &&
      p.y <= env.maxY + pad &&
      p.z >= env.minZ - pad &&
      p.z <= env.maxZ + pad;
    for (let i = 0; i < verticals.length; i++) {
      for (let j = i + 1; j < verticals.length; j++) {
        const a = verticals[i];
        const b = verticals[j];
        const a0 = byId.get(a.a);
        const a1 = byId.get(a.b);
        const b0 = byId.get(b.a);
        const b1 = byId.get(b.b);
        if (!a0 || !a1 || !b0 || !b1) continue;
        const sameX = Math.abs(a0.position.x - b0.position.x) < 0.6;
        const sameZ = Math.abs(a0.position.z - b0.position.z) < 0.6;
        if (!(sameX || sameZ)) continue;
        const gap = Math.hypot(a0.position.x - b0.position.x, a0.position.z - b0.position.z);
        if (gap < 0.5 || gap > 48) continue;
        if (!inEnv(a0.position) || !inEnv(b1.position) || !inEnv(a1.position) || !inEnv(b0.position)) continue;
        addEdge(a.a, b.b, "brace", false, braceJoin);
        addEdge(a.b, b.a, "brace", false, braceJoin);
      }
    }
  }

  const ys = nodes.map((n) => n.position.y);
  const xs = nodes.map((n) => n.position.x);
  const zs = nodes.map((n) => n.position.z);
  const height = (Math.max(...ys, 0) - Math.min(...ys, 0)) || 1;
  const span = Math.max(Math.max(...xs, 0) - Math.min(...xs, 0), Math.max(...zs, 0) - Math.min(...zs, 0), 1);

  const raw: StructureGraph = {
    id: createId("graph"),
    name: recipe.name,
    envelope: { width: span || 12, height: height || 12, depth: span || 12 },
    materialId,
    nodes,
    edges,
    assumptions: [
      `Form: ${recipe.name}. Stock is mapped onto the queried wire — as close as ${item.name} can sit on that frame.`,
      recipe.source ? `Source: ${recipe.source}` : "Proportions from the form query (published measures when they exist).",
      policy.fat
        ? `${item.name} is column stock — each long member is one piece.`
        : `${item.name} is thin — long members are laced into a truss.`,
      `Resolution · ${item.name} is the mosaic cell: face step ≈ ${policy.faceStep.toFixed(1)}", bay ≈ ${policy.bay.toFixed(1)}" (${policy.stock.toFixed(1)}" × ${policy.thick.toFixed(2)}").`,
      "Frame first. Braces stay on the form — never through openings or outside the silhouette.",
    ],
    notes: [...recipe.notes],
    structureClass: recipe.kind === "eiffel" ? "eiffel" : recipe.kind === "pyramid" ? "pyramid" : "generic",
  };

  const finished = finishGraph(raw, item, kind, !!opts.includeSpine, opts.grain ?? 1);
  const fig = kind === "figure" || kind === "plant" || kind === "vehicle" || kind === "vessel";
  let g = finished.graph;
  // Arch / bridge / Eiffel stay intentional wires. Thin weekend frames densify at stock pitch.
  const keepWire =
    kind === "arch" ||
    kind === "bridge" ||
    kind === "eiffel" ||
    kind === "taj" ||
    kind === "castle" ||
    kind === "house" ||
    kind === "dome" ||
    kind === "wall" ||
    kind === "tower" ||
    kind === "custom" ||
    kind === "furniture" ||
    kind === "ladder" ||
    (kind === "frame" && policy.fat) ||
    kind === "figure";
  if (!keepWire) {
    g = densifyTriangles(
      g,
      kind,
      // Frames: slightly longer chords so A-frame faces fill with whole-stick braces.
      Math.max(policy.bay * (kind === "frame" ? 2.4 : 1.8), policy.faceStep * (kind === "frame" ? 3.2 : 2.5)),
      fig ? 12 : kind === "frame" ? 96 : 28,
    );
  }
  if (kind !== "arch" && kind !== "furniture" && kind !== "ladder" && !(kind === "frame" && policy.fat)) {
    const topo = pruneTopology(g, kind, {
      // Keep frame braces — sparse A-frames were pruning densify away.
      aggressiveness: fig ? 0.1 : kind === "frame" ? 0.05 : keepWire ? 0.15 : 0.32,
    });
    g = {
      ...topo.graph,
      notes: [...topo.graph.notes.filter((n: string) => !n.startsWith("Topology")), topo.note],
    };
  }
  return { graph: g, offer: finished.offer };
}

function pyramidEnvelope(ops: FormOp[]) {
  let height = 12;
  let half0 = 0;
  for (const op of ops) {
    if (op.op === "poly") {
      for (const p of op.points) {
        height = Math.max(height, p.y);
        if (p.y < 0.8) half0 = Math.max(half0, Math.abs(p.x), Math.abs(p.z));
      }
    } else if (op.op === "taper") {
      height = Math.max(height, op.y1);
      half0 = Math.max(half0, op.r0);
    }
  }
  if (half0 < 4) half0 = (height * 230.3) / 146.6 / 2;
  return { height, half0 };
}

function buildPyramidForm(
  recipe: FormRecipe,
  item: CatalogItem,
  materialId: string,
  opts: { includeSpine?: boolean; kind?: StructureKind; grain?: number },
): { graph: StructureGraph; offer: SupportOffer } {
  const policy = stockDensity(item, opts.grain ?? 1);
  const join: JoinMethod = (item.preferredJoins && item.preferredJoins[0]) || "glue";
  const braceJoin: JoinMethod = join === "solvent" ? "solvent" : join === "screw" ? "screw" : "glue";
  const { height, half0 } = pyramidEnvelope(recipe.ops);
  const built = buildSteppedPyramid({
    height,
    half0,
    item,
    join,
    braceJoin,
    grain: opts.grain ?? 1,
  });
  const raw: StructureGraph = {
    id: createId("graph"),
    name: recipe.name,
    envelope: { width: half0 * 2, height, depth: half0 * 2 },
    materialId,
    nodes: built.nodes,
    edges: built.edges,
    assumptions: [
      `Form: ${recipe.name}. Stepped square courses — Khufu's ratio, not a laced loft.`,
      `${item.name} tiles each belt. Face posts follow stock face-step so panels are not empty. Frame is hips + every third course + face diagonals. Full packs the faces at stick width — the finished tomb.`,
      `North doorway ${built.door.width.toFixed(1)}" × ${built.door.height.toFixed(1)}" — open walk-through, jambs + lintel only.`,
      `Resolution · course pitch from ${item.name} (~${policy.bay.toFixed(1)}" bay). Base courses denser for mass.`,
    ],
    notes: [
      ...recipe.notes,
      "Stepped courses, face posts, face diagonals, four hips, open north door, pyramidion tip. Do not lace the opening shut.",
    ],
    structureClass: "pyramid",
  };
  const finished = finishGraph(raw, item, "pyramid", !!opts.includeSpine, opts.grain ?? 1);
  return { graph: finished.graph, offer: finished.offer };
}
