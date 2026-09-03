import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { graphToInstances } from "./structureGraph";
import { buildLatticeTowerGraph } from "./structures/latticeTower";
import { buildClosetFromPrompt } from "./closet";
import { parsePocket, buildPocket } from "./pocket";
import { looksLikeFitted, parseBrief, buildFitted } from "./fitted";
import { detectHouseFamily } from "./family";
import { detectWeekendFamily, weekendUsesLatticeGraph } from "./weekendFamily";
import { enforceHonesty } from "./honesty";
import { enforceWeekendHonesty } from "./weekendStockHonesty";
import { pickWindow, buildWindowProject } from "./windows";
import { withHome } from "./assembly";
import { detectForm, type FormRecipe } from "./form";
import { buildFormGraph } from "./buildGraph";
import { analyzePieces, finishGraph } from "./connect";
import { pruneTopology } from "./topo";
import type { BuildScale, CatalogItem, JoinMethod, StructureKind, YardInstance, YardProject } from "./types";
import { detectStructure, detectMaterial, parseSize, toProject, defaultSizeFor, isWireStock } from "./promptHelpers";
import { attachFunction } from "./function";
import { wantsSheetBox, buildSheetBox } from "./sheetBox";
import { detectFlatPrompt, buildFlatProject } from "./flatLayout";

export function emptyProject(): YardProject {
  return {
    id: createId("proj"),
    name: "Untitled",
    prompt: "",
    kind: "tower",
    overall: { width: 36, height: 36, depth: 36 },
    instances: [],
    panels: [],
    primaryMaterialId: "wire-frame",
    notes: [],
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  };
}

function withWireNote(project: YardProject, item: CatalogItem): YardProject {
  if (!isWireStock(item)) return project;
  const tip =
    "Wire frame — no stock was named. Open Stock and pick popsicle, PVC, straw, lumber… to densify this form.";
  return {
    ...project,
    notes: [tip, ...project.notes.filter((n) => !n.startsWith("Wire frame"))],
  };
}


function honestHouse(project: YardProject, prompt: string): YardProject {
  return enforceHonesty(project, {
    rebuild: (spec) => buildFitted(spec, prompt),
  });
}

export function generateFromPrompt(
  prompt: string,
  materialOverride?: string,
  formOverride?: FormRecipe,
  opts: {
    includeSpine?: boolean;
    joinMethod?: JoinMethod;
    scale?: BuildScale;
    sizeOverride?: { width: number; height: number; depth: number };
    cutStock?: boolean;
    fittedOverride?: import("./types").FittedSpec;
  } = {},
): YardProject {
  const lower = prompt.toLowerCase().trim();
  const size = parseSize(lower);
  const kindHint = detectStructure(lower);
  const scale = opts.scale ?? "full";
  const grain = scale === "weekend" ? 1.85 : 1;

  if (opts.fittedOverride) {
    return honestHouse(buildFitted(opts.fittedOverride, prompt), prompt);
  }

  if (kindHint === "opening") {
    const unit = pickWindow(prompt, size.width, size.height);
    return buildWindowProject(unit, prompt);
  }
  if (kindHint === "closet" || looksLikeFitted(prompt) || detectHouseFamily(prompt)) {
    const brief = parseBrief(prompt);
    if (brief) return honestHouse(buildFitted(brief, prompt), prompt);
    const pocket = parsePocket(prompt);
    if (pocket) return enforceHonesty(buildPocket(pocket, prompt));
    return enforceHonesty(buildClosetFromPrompt(prompt, size));
  }

  // Phase B: prompt-native 2D paper layouts (kids / printable)
  const flatIntent = detectFlatPrompt(prompt);
  if (flatIntent && !formOverride) {
    const item = (materialOverride && getCatalogItem(materialOverride)) || detectMaterial(prompt);
    return enforceWeekendHonesty(withWireNote(buildFlatProject(prompt, item, flatIntent), item));
  }

  const item = (materialOverride && getCatalogItem(materialOverride)) || detectMaterial(prompt);
  const recipe0 = formOverride ?? detectForm(prompt, size);
  let box = defaultSizeFor(recipe0.kind, size, prompt);
  if (opts.sizeOverride) {
    box = {
      width: opts.sizeOverride.width || box.width,
      height: opts.sizeOverride.height || box.height,
      depth: opts.sizeOverride.depth || box.depth,
    };
  }
  const lowerP = prompt.toLowerCase();
  if (/arch|gateway|portal|arbor|arbour|pergola/.test(lowerP) && !formOverride) {
    const H = box.height;
    box = {
      height: H,
      width: Math.max(box.width, Math.min(H * 0.72, 72), 28),
      depth: Math.min(Math.max(box.depth, 12), Math.max(14, H * 0.24)),
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
  if (scale === "tabletop") {
    const cap = 12;
    const m = Math.max(box.height, box.width, box.depth, 1);
    if (m > cap) {
      const k = cap / m;
      box = { height: box.height * k, width: box.width * k, depth: Math.max(4, box.depth * k) };
    }
  }
  const recipe = formOverride ?? detectForm(prompt, box);
  const kind = recipe.kind;
  const forceCut = /cut the sticks|cut each stick|cut the stock/.test(lower) || opts.cutStock === true;
  const forceWhole = /don'?t cut|whole sticks|uncut|glue them whole/.test(lower) || opts.cutStock === false;
  const whole = forceCut ? false : forceWhole ? true : isWholeStock(item);

  if (wantsSheetBox(prompt, item, kind)) {
    return enforceWeekendHonesty(withWireNote(attachFunction(buildSheetBox(prompt, item, kind, box, recipe.name)), item));
  }

  const weekend = detectWeekendFamily(prompt);
  if (
    weekendUsesLatticeGraph(prompt, kind) &&
    !(formOverride?.strokes && formOverride.strokes.length >= 4)
  ) {
    const raw = buildLatticeTowerGraph({
      targetHeightIn: box.height,
      materialId: item.id,
      item,
      eiffel: kind === "eiffel" || weekend?.override === "eiffel" || /eiffel/.test(lower),
      platforms: true,
      grain,
    });
    const finished = finishGraph(raw, item, kind, !!opts.includeSpine, grain);
    const topo = pruneTopology(finished.graph, kind, { aggressiveness: kind === "eiffel" ? 0.06 : 0.18 });
    const g = { ...topo.graph, notes: [...topo.graph.notes, topo.note] };
    return finalize(
      attachFunction(projectFromGraph(prompt, item, kind, g, true, finished.offer, opts.joinMethod, undefined, whole)),
      item,
      box,
      scale,
    );
  }

  const built = buildFormGraph(recipe, item, item.id, { includeSpine: opts.includeSpine, kind, grain });
  return finalize(
    attachFunction(
      projectFromGraph(prompt, item, kind, built.graph, !!recipe.historic, built.offer, opts.joinMethod, recipe.name, whole),
    ),
    item,
    box,
    scale,
  );
}

function finalize(project: YardProject, item: CatalogItem, box: { width: number; height: number; depth: number }, scale: BuildScale): YardProject {
  const notes = [...project.notes];
  if (scale === "tabletop") {
    notes.unshift(`Tabletop scale — about ${box.height.toFixed(0)}" high. Weekend / Full on the bench grow it.`);
  } else if (scale === "weekend") {
    notes.unshift("Weekend density — coarser than Full, still the same form.");
  }
  let next = notes === project.notes ? project : { ...project, notes };
  if (next.instances.length === 0 && next.panels.length === 0) {
    next = neverEmpty(next, item, box);
  }
  if (
    /table|desk|workbench|picnic/.test(next.prompt.toLowerCase()) &&
    !/chair|stool|planter/.test(next.prompt.toLowerCase()) &&
    next.instances.length &&
    !next.panels.length &&
    (item.category === "lumber" || item.formFactor === "board")
  ) {
    next = withTableTop(next, item, box);
  }
  return enforceWeekendHonesty(withWireNote(next, item));
}

function neverEmpty(project: YardProject, item: CatalogItem, box: { width: number; height: number; depth: number }): YardProject {
  const assumed = `I don't have a dedicated ${project.name} recipe in ${item.name} yet. This is a close frame. Assumed ${box.width.toFixed(0)}" × ${box.depth.toFixed(0)}" × ${box.height.toFixed(0)}".`;
  if (item.formFactor === "sheet" || item.category === "cardboard" || item.category === "sheet_goods") {
    const shell = buildSheetBox(project.prompt, item, project.kind === "castle" ? "castle" : "house", box, project.name);
    return { ...shell, notes: [assumed, ...shell.notes] };
  }
  const recipe = detectForm(project.prompt, { ...box, height: Math.max(box.height, 16), width: Math.max(box.width, 16) });
  const built = buildFormGraph(
    { ...recipe, ops: recipe.ops.length ? recipe.ops : [{ op: "box", x: 0, y: box.height / 2, z: 0, w: box.width, h: box.height, d: box.depth, role: "leg" }] },
    item,
    item.id,
    { kind: project.kind },
  );
  const retry = projectFromGraph(project.prompt, item, project.kind, built.graph, false, built.offer, project.joinMethod, project.name);
  if (retry.instances.length) {
    return { ...retry, notes: [assumed, ...retry.notes] };
  }
  return {
    ...project,
    notes: [assumed, "Nothing I could place stayed above the stock's minimum length. Name a size or a thinner stock."],
  };
}

function withTableTop(project: YardProject, item: CatalogItem, box: { width: number; height: number; depth: number }): YardProject {
  const sheet = getCatalogItem("plywood-3-4-4x8") ?? item;
  const thick = sheet.dims.thickness ?? 0.75;
  const ys = project.instances.map((i) => (i.to && i.from ? Math.max(i.from.y, i.to.y) : i.position.y));
  const y = Math.max(...ys, box.height);
  return {
    ...project,
    panels: [
      ...project.panels,
      {
        id: createId("top"),
        type: "top",
        name: "Top",
        position: { x: -box.width / 2, y, z: -box.depth / 2 },
        size: { width: box.width, height: thick, depth: box.depth },
        materialId: sheet.id,
      },
    ],
    notes: [...project.notes, `Top: ${sheet.name} over the ${item.name} frame.`],
  };
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
  whole?: boolean,
): YardProject {
  const mapped = graphToInstances(graph, item, joinMethod, { whole });
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
  const useWhole = whole ?? isWholeStock(item);
  const notes = [
    ...graph.notes,
    ...graph.assumptions,
    mapped.spliceCount > 0
      ? useWhole
        ? `${mapped.spliceCount} overlaps — full ${item.name}s lap at the joint. Glue both faces. Do not cut.`
        : `${mapped.spliceCount} lap splice(s) where members exceed stock — overlap the joint, then glue`
      : useWhole
        ? `Full ${item.name}s from the pack. Glue them as they come. Do not cut.`
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
