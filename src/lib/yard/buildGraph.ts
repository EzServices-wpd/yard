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

export type StockPolicy = StockDensity;

export function stockPolicy(item: CatalogItem): StockPolicy {
  return stockDensity(item);
}

export function buildFormGraph(
  recipe: FormRecipe,
  item: CatalogItem,
  materialId: string,
  opts: { includeSpine?: boolean; kind?: StructureKind } = {},
): { graph: StructureGraph; offer: SupportOffer } {
  const policy = stockDensity(item);
  const join: JoinMethod = (item.preferredJoins && item.preferredJoins[0]) || "glue";
  const braceJoin: JoinMethod = join === "solvent" ? "solvent" : join === "screw" ? "screw" : "glue";

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
        const n = Math.max(1, Math.round((op.y1 - op.y0) / policy.bay));
        const ids: string[] = [];
        for (let i = 0; i <= n; i++) {
          const y = op.y0 + ((op.y1 - op.y0) * i) / n;
          ids.push(addNode({ x: op.x, y, z: op.z }, i === 0 ? "base" : "leg"));
        }
        chain(ids, (op.role as StructureEdge["role"]) || "leg", true);
        if (ids.length >= 2) verticals.push({ a: ids[0], b: ids[ids.length - 1] });
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
        const sides = op.sides ?? (policy.fat ? 4 : 6);
        const stories = Math.max(2, Math.round((op.y1 - op.y0) / policy.bay));
        const rows: string[][] = [];
        for (let L = 0; L <= stories; L++) {
          const t = L / stories;
          const y = op.y0 + t * (op.y1 - op.y0);
          const r = op.r0 + (op.r1 - op.r0) * t;
          const row: string[] = [];
          for (let s = 0; s < sides; s++) {
            const a = (s / sides) * Math.PI * 2;
            row.push(addNode({ x: Math.cos(a) * r, y, z: Math.sin(a) * r }, L === 0 ? "base" : "leg"));
          }
          rows.push(row);
          for (let s = 0; s < sides; s++) addEdge(row[s], row[(s + 1) % sides], "ring", L === 0);
        }
        for (let L = 0; L < stories; L++) {
          for (let s = 0; s < sides; s++) {
            addEdge(rows[L][s], rows[L + 1][s], "leg", true);
            addEdge(rows[L][s], rows[L + 1][(s + 1) % sides], "brace", false, braceJoin);
            if (!policy.fat) addEdge(rows[L][(s + 1) % sides], rows[L + 1][s], "brace", false, braceJoin);
          }
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
        for (let i = 0; i < 4; i++) addEdge(ids[i], ids[4 + ((i + 1) % 4)], "brace", false, braceJoin);
        return;
      }
      case "arch": {
        const segs = policy.fat ? 5 : Math.max(8, Math.round(Math.hypot(op.x1 - op.x0, op.z1 - op.z0) / policy.faceStep));
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
        const cx = op.x ?? 0;
        const cz = op.z ?? 0;
        const rings = policy.fat ? 3 : Math.max(5, Math.round((op.r * Math.PI * 0.5) / policy.bay));
        const mer = policy.fat ? 6 : Math.max(8, Math.round((2 * Math.PI * op.r) / policy.faceStep));
        const rows: string[][] = [];
        for (let i = 0; i <= rings; i++) {
          const t = i / rings;
          const y = op.y0 + Math.sin(t * Math.PI * 0.5) * op.r;
          const r = Math.cos(t * Math.PI * 0.5) * op.r;
          const row: string[] = [];
          const n = Math.max(3, Math.round(mer * Math.max(r / op.r, 0.25)));
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            row.push(addNode({ x: cx + Math.cos(a) * r, y, z: cz + Math.sin(a) * r }, "ring"));
          }
          rows.push(row);
          if (r > 0.4) {
            for (let k = 0; k < row.length; k++) addEdge(row[k], row[(k + 1) % row.length], "ring");
          }
        }
        for (let i = 0; i < rows.length - 1; i++) {
          const a = rows[i];
          const b = rows[i + 1];
          const n = Math.min(a.length, b.length);
          for (let k = 0; k < n; k++) {
            addEdge(a[k], b[Math.floor((k * b.length) / a.length)], "brace", false, braceJoin);
          }
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
        const pts = resampleStroke(op.points, policy.bay);
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

  if (!edges.some((e) => e.role === "brace") && verticals.length >= 2) {
    const a = verticals[0];
    const b = verticals[1];
    addEdge(a.a, b.b, "brace", false, braceJoin);
    addEdge(a.b, b.a, "brace", false, braceJoin);
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
      `Bay ≈ ${policy.bay.toFixed(1)}" (driven by ${policy.stock.toFixed(1)}" × ${policy.thick.toFixed(2)}" stock).`,
      "Frame first. Braces next. A bare frame will rack and fail.",
    ],
    notes: [...recipe.notes],
    structureClass: recipe.kind === "eiffel" ? "eiffel" : recipe.kind === "pyramid" ? "pyramid" : "generic",
  };

  const finished = finishGraph(raw, item, opts.kind ?? recipe.kind, !!opts.includeSpine);
  return finished;
}
