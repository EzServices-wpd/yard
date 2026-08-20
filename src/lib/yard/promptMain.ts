import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import { graphToInstances } from "./structureGraph";
import { buildLatticeTowerGraph } from "./structures/latticeTower";
import { buildClosetFromPrompt } from "./closet";
import { parsePocket, buildPocket } from "./pocket";
import { looksLikeFitted, parseBrief, buildFitted } from "./fitted";
import { pickWindow, buildWindowProject } from "./windows";
import { withHome } from "./assembly";
import { detectForm, type FormRecipe } from "./form";
import { buildFormGraph } from "./buildGraph";
import { analyzePieces, finishGraph } from "./connect";
import { pruneTopology } from "./topo";
import type { CatalogItem, JoinMethod, StructureKind, YardInstance, YardProject } from "./types";
import { detectStructure, detectMaterial, parseSize, toProject } from "./promptHelpers";

export function emptyProject(): YardProject {
  return {
    id: createId("proj"),
    name: "Untitled",
    prompt: "",
    kind: "tower",
    overall: { width: 36, height: 36, depth: 36 },
    instances: [],
    panels: [],
    primaryMaterialId: "popsicle-standard",
    notes: [],
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  };
}

export function generateFromPrompt(
  prompt: string,
  materialOverride?: string,
  formOverride?: FormRecipe,
  opts: { includeSpine?: boolean; joinMethod?: JoinMethod } = {},
): YardProject {
  const lower = prompt.toLowerCase().trim();
  const size = parseSize(lower);
  const kindHint = detectStructure(lower);

  if (kindHint === "opening") {
    const unit = pickWindow(prompt, size.width, size.height);
    return buildWindowProject(unit, prompt);
  }
  if (kindHint === "closet" || looksLikeFitted(prompt)) {
    const brief = parseBrief(prompt);
    if (brief) return buildFitted(brief, prompt);
    const pocket = parsePocket(prompt);
    if (pocket) return buildPocket(pocket, prompt);
    return buildClosetFromPrompt(prompt, size);
  }

  const item = (materialOverride && getCatalogItem(materialOverride)) || detectMaterial(prompt);
  let box = size;
  const lowerP = prompt.toLowerCase();
  if (/arch|gateway|portal|arbor|arbour|pergola/.test(lowerP) && !formOverride) {
    const H = box.height;
    box = {
      height: H,
      width: Math.max(box.width, Math.min(H * 0.7, 60), 24),
      depth: Math.min(Math.max(box.depth, 10), Math.max(12, H * 0.22)),
    };
  }
  const namedSpan = /golden gate|brooklyn|suspension/.test(lowerP);
  if (/bridge|span|overpass|viaduct/.test(lowerP) && !formOverride && !namedSpan) {
    const span = Math.max(box.width, 24);
    box = {
      height: Math.min(Math.max(box.height, 10), Math.max(10, span * 0.32)),
      width: span,
      depth: Math.max(6, Math.min(span * 0.14, 14)),
    };
  }
  const recipe = formOverride ?? detectForm(prompt, box);
  const kind = recipe.kind;

  if ((kind === "eiffel" || kind === "lattice") && !(formOverride?.strokes && formOverride.strokes.length >= 4)) {
    const raw = buildLatticeTowerGraph({
      targetHeightIn: box.height,
      materialId: item.id,
      item,
      eiffel: kind === "eiffel" || /eiffel/.test(lower),
      platforms: true,
    });
    const finished = finishGraph(raw, item, kind, !!opts.includeSpine);
    // Do not densify the Eiffel — that fills the gap between the four piers.
    const topo = pruneTopology(finished.graph, kind, { aggressiveness: 0.18 });
    const g = { ...topo.graph, notes: [...topo.graph.notes, topo.note] };
    return projectFromGraph(prompt, item, kind, g, true, finished.offer, opts.joinMethod);
  }

  const built = buildFormGraph(recipe, item, item.id, { includeSpine: opts.includeSpine, kind });
  return projectFromGraph(prompt, item, kind, built.graph, !!recipe.historic, built.offer, opts.joinMethod, recipe.name);
}

function projectFromGraph(
  prompt: string,
  item: CatalogItem,
  kind: StructureKind,
  graph: import("./structureGraph").StructureGraph,
  historic: boolean,
  offer?: YardProject["supportOffer"],
  joinMethod?: JoinMethod,
  displayName?: string,
): YardProject {
  const mapped = graphToInstances(graph, item, joinMethod);
  const joinUsed = joinMethod || item.preferredJoins?.[0] || "glue";
  const instances: YardInstance[] = mapped.instances.map((g) => ({
    id: g.id,
    catalogId: g.catalogId,
    position: { x: g.position[0], y: g.position[1], z: g.position[2] },
    rotation: { x: g.rotation[0], y: g.rotation[1], z: g.rotation[2] },
    cutLength: g.cutLength,
    role: g.role,
    join: g.join,
    from: g.from ? { x: g.from[0], y: g.from[1], z: g.from[2] } : undefined,
    to: g.to ? { x: g.to[0], y: g.to[1], z: g.to[2] } : undefined,
  }));
  const stats = analyzePieces(instances, item);
  const notes = [
    ...graph.notes,
    ...graph.assumptions,
    mapped.spliceCount > 0
      ? `${mapped.spliceCount} lap splice(s) where members exceed stock — overlap the joint, then glue`
      : "No splices — each member fits in one stock piece",
    `Joins: ${mapped.joinSummary.join(", ") || joinUsed}`,
    stats.components <= 1 && stats.loose === 0
      ? `Connected structure · ${stats.joints} joints · every piece meets another`
      : `Mostly connected · ${stats.joints} joints · ${stats.loose} loose · ${stats.components} cluster${stats.components === 1 ? "" : "s"}`,
    "Frame first, then support, then brace. The frame will fail without bracing.",
  ];
  if (offer?.needed && !offer.included) notes.push(offer.reason);
  if (offer?.included) notes.push("Internal spine included at your request.");
  return toProject(prompt, item, kind, instances, notes, historic, {
    supportOffer: offer,
    buildStats: stats,
    joinMethod: joinMethod ?? item.preferredJoins?.[0],
    name: displayName,
  });
}
