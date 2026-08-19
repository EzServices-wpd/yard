import type { CatalogItem, JoinMethod } from "./types";
import type { FormOp, FormRecipe } from "./form";
import { toPrimitive } from "./geometry";
import { StructureEdge, StructureGraph, StructureNode, Vec3, createId } from "./structureGraph";

export type StockPolicy = { fat: boolean; chords: number; bay: number; stock: number; thick: number };

export function stockPolicy(item: CatalogItem): StockPolicy {
  const prim = toPrimitive(item);
  const stock = Math.max(1, prim.length);
  const thick = Math.max(prim.width, (prim.radius ?? 0) * 2, 0.2);
  const fat = thick >= 1.35;
  return { fat, chords: fat ? 1 : 4, bay: Math.max(stock * 0.82, 1.15), stock, thick };
}

export function buildFormGraph(recipe: FormRecipe, item: CatalogItem, materialId: string): StructureGraph {
  const policy = stockPolicy(item);
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
        const n = op.n ?? (policy.fat ? 6 : 10);
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
        const hx = op.w / 2, hy = op.h / 2, hz = op.d / 2;
        const corners: Vec3[] = [];
        for (const y of [op.y - hy, op.y + hy]) {
          for (const [x, z] of [[op.x - hx, op.z - hz], [op.x + hx, op.z - hz], [op.x + hx, op.z + hz], [op.x - hx, op.z + hz]] as const) {
            corners.push({ x, y, z });
          }
        }
        const ids = corners.map((p, i) => addNode(p, i < 4 ? "base" : "leg"));
        const ring = (a: number) => {
          addEdge(ids[a], ids[a + 1], "ring"); addEdge(ids[a + 1], ids[a + 2], "ring");
          addEdge(ids[a + 2], ids[a + 3], "ring"); addEdge(ids[a + 3], ids[a], "ring");
        };
        ring(0); ring(4);
        for (let i = 0; i < 4; i++) addEdge(ids[i], ids[i + 4], "leg", true);
        for (let i = 0; i < 4; i++) addEdge(ids[i], ids[4 + ((i + 1) % 4)], "brace", false, braceJoin);
        return;
      }
      case "arch": {
        const segs = policy.fat ? 5 : 8;
        const y0 = op.y0 ?? 0;
        const ids: string[] = [];
        for (let i = 0; i <= segs; i++) {
          const u = i / segs;
          ids.push(addNode({ x: op.x0 + (op.x1 - op.x0) * u, y: y0 + Math.sin(u * Math.PI) * op.crown, z: op.z0 + (op.z1 - op.z0) * u }, i === 0 || i === segs ? "base" : "brace"));
        }
        chain(ids, (op.role as StructureEdge["role"]) || "support", true);
        return;
      }
      case "dome": {
        const cx = op.x ?? 0, cz = op.z ?? 0;
        const rings = policy.fat ? 3 : 5;
        const mer = policy.fat ? 6 : 8;
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
          if (r > 0.4) for (let k = 0; k < row.length; k++) addEdge(row[k], row[(k + 1) % row.length], "ring");
        }
        for (let i = 0; i < rows.length - 1; i++) {
          const a = rows[i], b = rows[i + 1], n = Math.min(a.length, b.length);
          for (let k = 0; k < n; k++) addEdge(a[k], b[Math.floor((k * b.length) / a.length)], "brace", false, braceJoin);
        }
        return;
      }
      case "grid": {
        const nx = op.nx ?? 3, nz = op.nz ?? 3, cx = op.x ?? 0, cz = op.z ?? 0;
        const ids: string[][] = [];
        for (let i = 0; i <= nx; i++) {
          const row: string[] = [];
          for (let k = 0; k <= nz; k++) {
            row.push(addNode({ x: cx - op.w / 2 + (op.w * i) / nx, y: op.y, z: cz - op.d / 2 + (op.d * k) / nz }, "rail"));
          }
          ids.push(row);
        }
        for (let i = 0; i <= nx; i++) for (let k = 0; k < nz; k++) addEdge(ids[i][k], ids[i][k + 1], (op.role as StructureEdge["role"]) || "rail");
        for (let k = 0; k <= nz; k++) for (let i = 0; i < nx; i++) addEdge(ids[i][k], ids[i + 1][k], (op.role as StructureEdge["role"]) || "rail");
        return;
      }
      case "poly": {
        if (op.points.length < 2) return;
        const ids = op.points.map((p, i) => addNode(p, i === 0 ? "base" : "leg"));
        chain(ids, (op.role as StructureEdge["role"]) || "leg", true);
        return;
      }
      case "legs": {
        for (let i = 0; i < op.count; i++) {
          const a = (i / op.count) * Math.PI * 2 + Math.PI / 4;
          apply({ op: "column", x: Math.cos(a) * op.radius, z: Math.sin(a) * op.radius, y0: op.y0, y1: op.y1, role: op.role || "leg" });
        }
        return;
      }
    }
  };
  for (const stroke of recipe.strokes ?? []) apply({ op: "poly", points: stroke.points, role: stroke.role || "leg" });
  for (const op of recipe.ops) apply(op);
  const ys = nodes.map((n) => n.position.y);
  const xs = nodes.map((n) => n.position.x);
  const zs = nodes.map((n) => n.position.z);
  const height = (Math.max(...ys, 0) - Math.min(...ys, 0)) || 1;
  const span = Math.max(Math.max(...xs, 0) - Math.min(...xs, 0), Math.max(...zs, 0) - Math.min(...zs, 0), 1);
  const hasSupport = edges.some((e) => e.role === "support");
  const hasBrace = edges.some((e) => e.role === "brace");
  if (height / span > 3.2 && !hasSupport) {
    const y0 = Math.min(...ys, 0);
    const a = addNode({ x: 0, y: y0, z: 0 }, "base");
    const b = addNode({ x: 0, y: y0 + height * 0.35, z: 0 }, "platform");
    addEdge(a, b, "support", true);
  }
  if (!hasBrace && verticals.length >= 2) {
    addEdge(verticals[0].a, verticals[1].b, "brace", false, braceJoin);
    addEdge(verticals[0].b, verticals[1].a, "brace", false, braceJoin);
  }
  return {
    id: createId("graph"),
    name: recipe.name,
    envelope: { width: span || 12, height: height || 12, depth: span || 12 },
    materialId,
    nodes, edges,
    assumptions: [
      `Form: ${recipe.name}. Stock is mapped onto the queried wire — as close as ${item.name} can sit on that frame.`,
      recipe.source ? `Source: ${recipe.source}` : "Proportions from the form query.",
      policy.fat ? `${item.name} is column stock — each long member is one piece.` : `${item.name} is thin — long members are laced into a truss.`,
      `Bay ≈ ${policy.bay.toFixed(1)}" (driven by ${policy.stock.toFixed(1)}" stock).`,
      "Frame first. Braces next. A bare frame will rack and fail.",
      height / span > 3.2 ? `Slender (${(height / span).toFixed(1)}:1) — temporary support until braced.` : `Proportions ${(height / span).toFixed(1)}:1.`,
    ],
    notes: [...recipe.notes, `${nodes.length} nodes · ${edges.length} members before stock cuts`],
    structureClass: recipe.kind === "eiffel" ? "eiffel" : recipe.kind === "pyramid" ? "pyramid" : "generic",
  };
}
