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

  // FULL FILE CONTINUES - this is a partial to test size limits
  return { graph: { id: "x", name: recipe.name, envelope: { width: 12, height: 12, depth: 12 }, materialId, nodes: [], edges: [], assumptions: [], notes: [], structureClass: "generic" }, offer: { join, braceJoin, kind: "frame" } as any };
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
  const height = 24;
  const half0 = 18;
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
