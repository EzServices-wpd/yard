import { createId } from "@/lib/utils";
import { FORGE_CATALOG, getCatalogItem, searchCatalog } from "./catalog";
import { graphToInstances } from "./structureGraph";
import { buildLatticeTowerGraph } from "./structures/latticeTower";
import { buildClosetFromPrompt } from "./closet";
import { parsePocket, buildPocket, POCKET_DREAM } from "./pocket";
import { looksLikeFitted, parseBrief, buildFitted } from "./fitted";
import { looksLikeWindow, pickWindow, buildWindowProject } from "./windows";
import { withHome } from "./assembly";
import { detectForm, type FormRecipe } from "./form";
import { buildFormGraph } from "./buildGraph";
import type { CatalogItem, StructureKind, YardInstance, YardProject } from "./types";

export const DREAMS = [
  { id: "eiffel", label: "3-ft popsicle Eiffel", prompt: "3 foot Eiffel Tower from popsicle sticks", blurb: "The north star — true-scale lattice, pack count, ordered steps." },
  { id: "taj", label: "Paper-towel Taj", prompt: "2 foot tower from paper towels that looks like the Taj Mahal", blurb: "Recycled cores, stacked body, onion top." },
  { id: "closet", label: "Bathroom pocket vanity", prompt: POCKET_DREAM, blurb: "The original — a wonky trapezoid, a straight unit, a plan you can cut." },
  { id: "arch", label: "PVC garden arch", prompt: "6 foot garden arch from 3/4 inch PVC pipe", blurb: "Two legs and a curved crown in shop-length pipe." },
  { id: "pyramid", label: "Craft-stick pyramid", prompt: "3 ft popsicle stick pyramid", blurb: "Stepped square rings, real stick lengths." },
  { id: "window", label: "Andersen 36×48 hung", prompt: "Andersen 100 Series 36 by 48 double hung window, frame the rough opening", blurb: "Pick the unit. Frame its RO. Buy the window and the lumber." },
  { id: "bridge", label: "Straw bridge", prompt: "4 foot bridge from plastic drinking straws", blurb: "Deck, piers, a raised mid-span." },
  { id: "desk", label: "60\" desk with drawers", prompt: "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space", blurb: "Same engine as the pocket — measure it, cut it, sit at it." },
] as const;

export function parseSize(lower: string): { height: number; width: number; depth: number } {
  let height = 24, width = 24, depth = 24;
  const ftH = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:tall|high|height|tower)?/);
  const inH = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\s*(?:tall|high)?/);
  if (ftH) height = parseFloat(ftH[1]) * 12;
  else if (inH) height = parseFloat(inH[1]);
  const pair = lower.match(/(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|by|×)\s*(\d+(?:\.\d+)?))?/);
  if (pair) { width = parseFloat(pair[1]); height = parseFloat(pair[2]); if (pair[3]) depth = parseFloat(pair[3]); }
  const ftW = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:wide|width|long|span)/);
  const inW = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\s*(?:wide|width)/);
  if (ftW) width = parseFloat(ftW[1]) * 12;
  else if (inW) width = parseFloat(inW[1]);
  const ftD = lower.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet)\s*(?:deep|depth)/);
  const inD = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\s*(?:deep|depth)/);
  if (ftD) depth = parseFloat(ftD[1]) * 12;
  else if (inD) depth = parseFloat(inD[1]);
  if (!ftW && !inW && !pair) { width = Math.max(12, height * 0.5); depth = width; }
  return { height: Math.min(Math.max(height, 6), 480), width: Math.min(Math.max(width, 6), 480), depth: Math.min(Math.max(depth, 4), 480) };
}

export function detectStructure(lower: string): StructureKind {
  if (looksLikeWindow(lower) || /rough opening|window ro|window opening/.test(lower)) return "opening";
  if (/closet|wardrobe|pantry|built-?in|cabinet|shelv|linen|vanity|alcove|pocket space|pocket in|desk|bookcase|bookshelf|workbench|dresser|nightstand|mudroom/.test(lower)) return "closet";
  return detectForm(lower, parseSize(lower)).kind;
}

export function detectMaterial(prompt: string): CatalogItem {
  const lower = prompt.toLowerCase();
  const phrases: [RegExp, string][] = [
    [/jumbo (craft|popsicle)/, "popsicle-jumbo"], [/giant (craft|popsicle)/, "popsicle-giant"], [/mini (craft|popsicle)/, "popsicle-mini"],
    [/popsicle|craft stick/, "popsicle-standard"], [/paper towel/, "paper-towel-roll"], [/toilet paper|tp roll/, "toilet-paper-roll"],
    [/mailing tube|poster tube/, "mailing-tube-2x24"], [/3\/4.?inch pvc|3\/4 pvc|three quarter pvc/, "pvc-3-4-sch40"],
    [/1\/2.?inch pvc|half inch pvc|1\/2 pvc/, "pvc-half-sch40"], [/1.?inch pvc|one inch pvc/, "pvc-1-sch40"], [/pvc/, "pvc-3-4-sch40"],
    [/1\/2.?inch dowel|half inch dowel/, "dowel-1-2-36"], [/1\/4.?inch dowel|quarter inch dowel/, "dowel-1-4-36"], [/dowel/, "dowel-1-2-36"],
    [/2\s*[x×]\s*4|two by four|stud/, "lumber-2x4-8"], [/1\s*[x×]\s*4|one by four/, "lumber-1x4-8"],
    [/plywood/, "plywood-3-4-4x8"], [/foam/, "foam-board-20x30"], [/cardboard/, "cardboard-corrugated-sheet"],
    [/straw/, "straw-plastic"], [/toothpick/, "toothpick"], [/skewer/, "bamboo-skewer-12"],
    [/soda can|aluminum can/, "soda-can"], [/bottle/, "plastic-bottle-16oz"], [/lego/, "legos-2x4"],
    [/copper/, "copper-pipe-half"], [/pool noodle|noodle/, "pool-noodle"],
  ];
  for (const [re, id] of phrases) {
    if (re.test(lower)) { const item = getCatalogItem(id); if (item) return item; }
  }
  return searchCatalog(lower, 5)[0] ?? FORGE_CATALOG[0];
}

function toProject(prompt: string, item: CatalogItem, kind: StructureKind, instances: YardInstance[], notes: string[], historic = false): YardProject {
  let list = instances;
  if (list.length > 8000) {
    list = list.slice(0, 8000);
    notes = [...notes, "Stopped at 8,000 pieces — renderer limit, not a materials cap."];
  } else if (list.length > 1500) {
    notes = [...notes, `${list.length} pieces. Orbit may hitch on a phone.`];
  }
  const xs = list.map((i) => i.position.x);
  const ys = list.map((i) => i.position.y);
  const zs = list.map((i) => i.position.z);
  const pad = 6;
  return {
    id: createId("proj"),
    name: kind === "eiffel" ? "Eiffel frame" : `${item.name} ${kind}`,
    prompt, kind,
    overall: {
      width: Math.max(12, (Math.max(...xs, 0) - Math.min(...xs, 0) || 0) + pad * 2),
      height: Math.max(12, (Math.max(...ys, 0) - Math.min(...ys, 0) || 0) + pad),
      depth: Math.max(12, (Math.max(...zs, 0) - Math.min(...zs, 0) || 0) + pad * 2),
    },
    instances: withHome(list), panels: [], primaryMaterialId: item.id, notes, historic,
    assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}

export function emptyProject(): YardProject {
  return {
    id: createId("proj"), name: "Untitled", prompt: "", kind: "tower",
    overall: { width: 36, height: 36, depth: 36 }, instances: [], panels: [],
    primaryMaterialId: "popsicle-standard", notes: [],
    assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}

export function generateFromPrompt(prompt: string, materialOverride?: string, formOverride?: FormRecipe): YardProject {
  const lower = prompt.toLowerCase().trim();
  const size = parseSize(lower);
  const kindHint = detectStructure(lower);
  if (kindHint === "opening") return buildWindowProject(pickWindow(prompt, size.width, size.height), prompt);
  if (kindHint === "closet" || looksLikeFitted(prompt)) {
    const brief = parseBrief(prompt);
    if (brief) return buildFitted(brief, prompt);
    const pocket = parsePocket(prompt);
    if (pocket) return buildPocket(pocket, prompt);
    return buildClosetFromPrompt(prompt, size);
  }
  const item = (materialOverride && getCatalogItem(materialOverride)) || detectMaterial(prompt);
  const recipe = formOverride ?? detectForm(prompt, size);
  const kind = recipe.kind;
  if ((kind === "eiffel" || kind === "lattice") && !(formOverride?.strokes && formOverride.strokes.length >= 4)) {
    const graph = buildLatticeTowerGraph({ targetHeightIn: size.height, materialId: item.id, item, eiffel: kind === "eiffel" || /eiffel/.test(lower), platforms: true });
    return projectFromGraph(prompt, item, kind, graph, true);
  }
  return projectFromGraph(prompt, item, kind, buildFormGraph(recipe, item, item.id), !!recipe.historic);
}

function projectFromGraph(prompt: string, item: CatalogItem, kind: StructureKind, graph: import("./structureGraph").StructureGraph, historic: boolean): YardProject {
  const mapped = graphToInstances(graph, item);
  const instances: YardInstance[] = mapped.instances.map((g) => ({
    id: g.id, catalogId: g.catalogId,
    position: { x: g.position[0], y: g.position[1], z: g.position[2] },
    rotation: { x: g.rotation[0], y: g.rotation[1], z: g.rotation[2] },
    cutLength: g.cutLength, role: g.role, join: g.join,
  }));
  return toProject(prompt, item, kind, instances, [
    ...graph.notes, ...graph.assumptions,
    mapped.spliceCount > 0 ? `${mapped.spliceCount} splice joint(s) where members exceed stock length` : "No splices — each member fits in one stock piece",
    `Joins: ${mapped.joinSummary.join(", ") || "glue"}`,
    "Frame first, then support, then brace. The frame will fail without bracing.",
  ], historic);
}
