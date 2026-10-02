import { solveModel } from "./solve";
import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import { isWholeStock, toPrimitive } from "./geometry";
import { graphToInstances, type StructureGraph } from "./structureGraph";
import { buildLatticeTowerGraph } from "./structures/latticeTower";
import { buildClosetFromPrompt } from "./closet";
import { parsePocket, buildPocket, looksLikePocket } from "./pocket";
import { looksLikeFitted, parseBrief, buildFitted } from "./fitted";
import { buildOddShape, isOddShapePrompt } from "./oddShapes";
import { climbIdentityLabel, detectHouseFamily, isAvTower, isBedsideShelf, isHouseMediaCarcase, isPlatformBed, isWallMediaLedge, isPictureLedge , isAdirondackChair, isPorchSwingFrame, isLoungeChair, isRockingChair, isOttoman, isSeatingLoungeClass, namesSitChair, identityTitleStem } from "./family";
import { climbRiseRun, climbStepCount, detectWeekendFamily, detectWeekendMech, isClimbSingleStep, isClimbStepStool, isLauncherRamp, launcherRampLengthIn, mediaTipTalk, mediaHoldHeldLabel, wantsMediaTipHold, wantsClimbHandrail, weekendUsesLatticeGraph } from "./weekendFamily";
import { normalizeUserPrompt } from "./voiceHonesty";
import { enforceHonesty } from "./honesty";
import { enforceWeekendHonesty, applyNamedLumberPrimaryHonesty, applyExplicitBoardCarcase, applyExplicitSheetCarcase } from "./weekendStockHonesty";
import { pickWindow, buildWindowProject, looksLikeDoorFrame, buildDoorProject } from "./windows";
import { withHome } from "./assembly";
import { detectForm, type FormRecipe } from "./form";
import { buildFormGraph } from "./buildGraph";
import { analyzePieces, finishGraph } from "./connect";
import { pruneTopology } from "./topo";
import type { BuildScale, CatalogItem, JoinMethod, StructureKind, YardInstance, YardProject } from "./types";
import { detectStructure, detectMaterial, parseSize, toProject, defaultSizeFor, isWireStock, hasExplicitSize } from "./promptHelpers";
import { bodyStockClauses, CATALOG_LUMBER_BIND } from "./namedLumberSpecies";
import { attachFunction } from "./function";
import { wantsSheetBox, buildSheetBox } from "./sheetBox";
import { memberView, recastPanelsAsStock, type MemberView } from "./memberStock";
import { detectFlatPrompt, buildFlatProject } from "./flatLayout";
import { detectShapeClass, materializeShape, shapeSummary } from "./shapeTemplates";
import { buildTemplate, detectTemplate, typedSizeIn, type TemplateBuild, type TemplateClassId } from "./formTemplates";
import { composeProducts } from "./compose";
import { applySpokenFace } from "./face";
import { isBareProductPrompt, modeledProduct } from "./productModel";
import { rememberCatalogItem } from "./foundStock";

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


function honestHouse(project: YardProject, prompt: string, honorUnit = false, materialOverride?: string): YardProject {
  return finishHouse(project, prompt, honorUnit, materialOverride);
}

/** The stock the user just asked for: a catalog pick, else the last "from …" clause. */
function requestedStock(prompt: string, materialOverride?: string): CatalogItem | null {
  const picked = materialOverride ? getCatalogItem(materialOverride) : undefined;
  if (picked && !isWireStock(picked)) return picked;
  if (!bodyStockClauses(prompt).length) return null;
  const named = detectMaterial(prompt);
  return isWireStock(named) ? null : named;
}

function carcaseKind(item: CatalogItem | null): "board" | "sheet" | null {
  if (!item) return null;
  if (item.category === "sheet_goods") return "sheet";
  if (item.category === "lumber" && item.formFactor === "board") return "board";
  return null;
}

/**
 * House carcase, then the stock the user actually switched to.
 * A species clause still binds solid 1×4. A later plywood / 2×4 / 1×4 / 4×10 clause replaces it.
 * A stick, pipe, or brick keeps the same carcase and tiles every face in that stock.
 */
function finishHouse(
  project: YardProject,
  prompt: string,
  honorUnit: boolean,
  materialOverride?: string,
): YardProject {
  const stock = requestedStock(prompt, materialOverride);
  const kind = carcaseKind(stock);
  const allowSpecies = !stock || stock.id === CATALOG_LUMBER_BIND;
  let next = allowSpecies ? applyNamedLumberPrimaryHonesty(project, prompt) : project;
  next = enforceHonesty(next, {
    rebuild: (spec) => {
      const built = buildFitted(spec, prompt);
      return allowSpecies ? applyNamedLumberPrimaryHonesty(built, prompt) : built;
    },
    honorUnit,
  });
  // Sticks tile whatever faces exist, so a slat or a shaker stile has to be a
  // panel before the recast. Sheet and board carcases are faced after the
  // interference solve, once doors have been pulled onto the front.
  const recastCraft = Boolean(stock && !kind && next.panels.length);
  if (recastCraft && stock) next = applySpokenFace(next, prompt);
  if (recastCraft && stock) {
    next = recastPanelsAsStock(next, stock);
  } else if (kind === "board" && stock && next.primaryMaterialId !== stock.id) {
    next = applyExplicitBoardCarcase(next, stock);
  } else if (kind === "sheet" && stock && (stock.id !== next.primaryMaterialId || stock.id !== "plywood-3-4-4x8")) {
    const already =
      stock.id === next.primaryMaterialId &&
      stock.id === "plywood-3-4-4x8" &&
      next.panels.every((p) => !/^plywood-3-4-4x10|^plywood-1-2/.test(p.materialId ?? ""));
    if (!already) next = applyExplicitSheetCarcase(next, stock);
  }
  return next;
}

/**
 * The stock a build uses: the chip's pick, else the named stock, else popsicle sticks.
 * No build ships stockless — a cut list and a Buy list always exist. ("wire" typed stays wire.)
 */
function buildStock(prompt: string, materialOverride?: string): CatalogItem {
  const picked = materialOverride ? getCatalogItem(materialOverride) : undefined;
  if (picked) return picked;
  const named = detectMaterial(prompt);
  if (isWireStock(named) && !/\bwire\b/i.test(prompt)) {
    // No stock typed: a build a child rides, a cat climbs, or that holds books or soil defaults to real
    // lumber (2x4 for a rocker, 3/4" plywood for the rest); craft pieces default to popsicle sticks.
    // Human climb / step stool is weight-bearing — never silent popsicle densify.
    if (detectWeekendMech(prompt) === "climb" && (isClimbStepStool(prompt) || wantsClimbHandrail(prompt))) {
      return getCatalogItem("plywood-3-4-4x8") || named;
    }
    const use = detectShapeClass(prompt)?.profile.use;
    const fn = use === "rocker" ? "lumber-2x4-8" : use || detectTemplate(prompt) === "platform-tower" ? "plywood-3-4-4x8" : null;
    return (fn && getCatalogItem(fn)) || getCatalogItem("popsicle-standard") || named;
  }
  return named;
}

/** Default size for an animal with a use, when none is typed: a bookend is book height, a planter a patio pot. */
const USE_DEFAULT_SIZE: Record<string, { length?: number; height?: number }> = {
  bookend: { height: 9 },
  planter: { length: 24 },
  shelf: { length: 30 },
  rocker: { height: 24 },
};

/** Built → solved. A sized weekend build then lands on the three numbers, same as a closet. */
export function generateFromPrompt(...args: Parameters<typeof generateRaw>): YardProject {
  const solved = solveModel(generateRaw(...args));
  const project = solved.panels.length ? applySpokenFace(solved, args[0]) : solved;
  return fitWeekendSize(project, args[0], args[3]?.sizeOverride);
}

function axisLabeled(prompt: string): boolean {
  const l = prompt.toLowerCase();
  return /(?:wide|width)\b/.test(l) && /(?:tall|high|height)\b/.test(l) && /(?:deep|depth)\b/.test(l);
}

function fitWeekendSize(
  project: YardProject,
  prompt: string,
  override?: { width: number; height: number; depth: number },
): YardProject {
  if (project.fitted || project.pocket || project.windowPkg || project.kind === "closet" || project.kind === "opening") {
    return project;
  }
  if (!project.instances.length && !project.panels.length) return project;
  const box = override ?? (axisLabeled(prompt) ? parseSize(prompt.toLowerCase()) : null);
  if (!box || !(box.width > 0) || !(box.height > 0) || !(box.depth > 0)) return project;
  return scaleToBox(project, box);
}

function scaleToBox(
  project: YardProject,
  box: { width: number; height: number; depth: number },
): YardProject {
  const o = project.overall;
  if (!o || o.width < 0.2 || o.height < 0.2 || o.depth < 0.2) return project;
  const sx = box.width / o.width;
  const sy = box.height / o.height;
  const sz = box.depth / o.depth;
  if (![sx, sy, sz].every((n) => Number.isFinite(n) && n > 0 && n < 40)) return project;
  if (Math.abs(sx - 1) < 0.03 && Math.abs(sy - 1) < 0.03 && Math.abs(sz - 1) < 0.03) return project;
  const s = (p: { x: number; y: number; z: number }) => ({ x: p.x * sx, y: p.y * sy, z: p.z * sz });
  const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
    Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const instances = project.instances.map((i) => {
    const from = i.from ? s(i.from) : undefined;
    const to = i.to ? s(i.to) : undefined;
    return {
      ...i,
      from,
      to,
      position: s(i.position),
      cutLength: from && to ? r1(dist(from, to)) : i.cutLength,
    };
  });
  const panels = project.panels.map((p) => ({
    ...p,
    position: s(p.position),
    size: { width: p.size.width * sx, height: p.size.height * sy, depth: p.size.depth * sz },
    polygon: p.polygon
      ? {
          ...p.polygon,
          pts: p.polygon.pts.map(([a, b]) =>
            (p.polygon!.plane === "xy" ? [a * sx, b * sy] : [a * sx, b * sz]) as [number, number],
          ),
          holes: p.polygon.holes?.map((h) =>
            p.polygon!.plane === "xy"
              ? { x: h.x * sx, y: h.y * sy, r: h.r * Math.min(sx, sy) }
              : { x: h.x * sx, y: h.y * sz, r: h.r * Math.min(sx, sz) },
          ),
        }
      : p.polygon,
  }));
  const fmt = (n: number) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : String(r1(n)));
  const note = `Sized to ${fmt(box.width)}" wide × ${fmt(box.height)}" high × ${fmt(box.depth)}" deep.`;
  const steps = Math.max(1, climbStepCount(project.prompt || ""));
  const fixRise = (s: string) =>
    s.replace(
      /(\d+(?:\.\d+)?)" rise × (\d+(?:\.\d+)?)" run/g,
      `${fmt(box.height / steps)}" rise × ${fmt(box.depth / steps)}" run`,
    );
  let notes = project.notes.map(fixRise);
  const openW = Number(project.shape?.params?.openW);
  const openH = Number(project.shape?.params?.openH);
  let params = project.shape?.params;
  if (Number.isFinite(openW) && Number.isFinite(openH) && openW > 0 && openH > 0) {
    const ow = r1(openW * sx);
    const oh = r1(openH * sy);
    params = { ...params, openW: ow, openH: oh };
    notes = notes.map((n) => n.replace(/opening [^×]+× [^("]+/, `opening ${fmt(ow)}" × ${fmt(oh)}"`));
  }
  if (!notes.some((n) => n.startsWith("Sized to "))) notes = [note, ...notes];
  return {
    ...project,
    name: fixRise(project.name),
    instances,
    panels,
    overall: { width: r1(box.width), height: r1(box.height), depth: r1(box.depth) },
    shape: project.shape && params ? { ...project.shape, params } : project.shape,
    notes,
  };
}


/** A named product is the piece, not a carcase that happens to mention a bottle. */
function placeNamedProduct(prompt: string): YardProject | null {
  if (!isBareProductPrompt(prompt)) return null;
  const item = modeledProduct(prompt);
  if (!item?.shape || item.shape === "object") return null;
  rememberCatalogItem(item);
  const tall = item.dims.length ?? 8;
  const across = item.dims.diameter ?? item.dims.width ?? 3;
  const deep = item.dims.height ?? item.dims.diameter ?? across;
  const pos = { x: 0, y: tall / 2, z: 0 };
  return {
    id: createId("proj"),
    name: item.name,
    prompt,
    kind: "custom",
    overall: { width: across, height: tall, depth: deep },
    instances: [
      {
        id: createId("inst"),
        catalogId: item.id,
        position: pos,
        rotation: { x: 0, y: 0, z: 0 },
        cutLength: tall,
        role: "member",
        home: pos,
      },
    ],
    panels: [],
    primaryMaterialId: item.id,
    notes: [item.notes || `${item.name} at its usual size.`],
    assumptions: {
      load: "light",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  };
}

function generateRaw(
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
    honorUnit?: boolean;
    noCompose?: boolean;
  } = {},
): YardProject {
  prompt = normalizeUserPrompt(prompt);
  if (!opts.noCompose && !opts.fittedOverride && !formOverride) {
    const composed = composeProducts(prompt, (clause) =>
      generateRaw(clause, materialOverride, undefined, { ...opts, noCompose: true }),
    );
    if (composed) return composed;
  }
  const lower = prompt.toLowerCase().trim();
  const placed = placeNamedProduct(prompt);
  if (placed && !formOverride) return placed;
  const size = parseSize(lower);
  const kindHint = detectStructure(lower);
  const scale = opts.scale ?? "full";
  const grain = scale === "weekend" ? 1.85 : 1;

  // An animal with a use (shelf, bookend, planter, rocker) is the animal template first — never a storage unit.
  if (detectShapeClass(prompt)?.profile.use && !formOverride) {
    const shaped = buildShapeProject(prompt, buildStock(prompt, materialOverride), opts);
    if (shaped) return shaped;
  }
  // Climb/step stool identity beats a stolen Bench fittedOverride from house-brief / Measure.
  // Linen/closet with climb step-shelf still accepts fitted (climbIdentityLabel is null).
  // A stick/pipe pick (popsicle, PVC, dowel) is not a plywood carcase — fall through and densify.
  const stockAsk = requestedStock(prompt, materialOverride);
  const craftAsk = !!stockAsk && !carcaseKind(stockAsk);
  if (opts.fittedOverride && !climbIdentityLabel(lower)) {
    return honestHouse(buildFitted(opts.fittedOverride, prompt), prompt, !!opts.honorUnit, materialOverride);
  }

  // Odd-shape pack beats window/door/pocket steals ("shelves around a window", "corner cabinet with angled front").
  if (isOddShapePrompt(prompt) && !climbIdentityLabel(lower)) {
    return honestHouse(buildOddShape(null, prompt), prompt, false, materialOverride);
  }

  if (kindHint === "opening" && !craftAsk) {
    if (looksLikeDoorFrame(lower) && !/\bwindows?\b/.test(lower)) return buildDoorProject(prompt);
    return buildWindowProject(pickWindow(prompt), prompt);
  }
  const climbPrimary = !!climbIdentityLabel(lower);
  const weekendMech = detectWeekendMech(prompt);
  // Launcher / media-hold stay craft. Climb-primary stools stay craft.
  // House carcase + climb step-shelf (linen) still fitted via detectHouseFamily.
  // House media ledge / shelf / stereo / AV tower / platform bed / bedside shelf beat weekend steals.
  const houseMedia =
    !!detectHouseFamily(prompt) ||
    isWallMediaLedge(lower) ||
    isPictureLedge(lower) ||
    isHouseMediaCarcase(lower) ||
    isAvTower(lower) ||
    isPlatformBed(lower) ||
    isBedsideShelf(lower);
  if (
    !climbPrimary &&
    !isAdirondackChair(lower) &&
    (!namesSitChair(lower) || isSeatingLoungeClass(lower)) &&
    weekendMech !== "launcher" &&
    weekendMech !== "pot-hold" &&
    (weekendMech !== "media-hold" || houseMedia) &&
    (kindHint === "closet" || looksLikeFitted(prompt) || houseMedia) &&
    // A garden arch "from paper towel" is still an arch. Weekend forms are not carcases.
    !detectWeekendFamily(prompt)
  ) {
    // Wonky pocket before parseBrief — the original survey is a trapezoid, not a fitted rectangle.
    if (looksLikePocket(prompt)) {
      const pocket = parsePocket(prompt);
      if (pocket) return finishHouse(enforceHonesty(buildPocket(pocket, prompt)), prompt, false, materialOverride);
    }
    const brief = parseBrief(prompt);
    if (brief) return honestHouse(buildFitted(brief, prompt), prompt, false, materialOverride);
    return finishHouse(enforceHonesty(buildClosetFromPrompt(prompt, size)), prompt, false, materialOverride);
  }

  // Flat-frame template (picture frames) owns its build before the 2D paper layouts.
  if (detectTemplate(prompt) === "flat-frame") {
    const fItem = buildStock(prompt, materialOverride);
    const framed = buildTemplateProject(prompt, fItem, opts, "flat-frame");
    if (framed) return framed;
  }
  // Phase B: prompt-native 2D paper layouts (kids / printable)
  const flatIntent = detectFlatPrompt(prompt);
  if (flatIntent && !formOverride) {
    const item = (materialOverride && getCatalogItem(materialOverride)) || detectMaterial(prompt);
    return enforceWeekendHonesty(withWireNote(buildFlatProject(prompt, item, flatIntent), item));
  }

  const item = buildStock(prompt, materialOverride);
  // Subject-class shape templates (quadruped…) are deterministic: they beat any LLM form override.
  if (detectShapeClass(prompt) && !weekendMech) {
    const shaped = buildShapeProject(prompt, item, opts);
    if (shaped) return shaped;
  }
  const tmpl = detectTemplate(prompt);
  if (tmpl) {
    const built = buildTemplateProject(prompt, item, opts, tmpl);
    if (built) return built;
  }
  const recipe0 = formOverride ?? detectForm(prompt, size);
  let box = defaultSizeFor(recipe0.kind, size, prompt);
  if (opts.sizeOverride) {
    box = {
      width: opts.sizeOverride.width || box.width,
      height: opts.sizeOverride.height || box.height,
      depth: opts.sizeOverride.depth || box.depth,
    };
  }
  const freeSize = !!opts.sizeOverride || axisLabeled(prompt);
  const lowerP = prompt.toLowerCase();
  if (!freeSize && /arch|gateway|portal|arbor|arbour|pergola/.test(lowerP) && !formOverride) {
    const H = box.height;
    box = {
      height: H,
      width: Math.max(box.width, Math.min(H * 0.72, 72), 28),
      depth: Math.min(Math.max(box.depth, 12), Math.max(14, H * 0.24)),
    };
  }
  const namedSpan = /golden gate|brooklyn|suspension/.test(lowerP);
  if (!freeSize && /bridge|span|overpass|viaduct/.test(lowerP) && !formOverride && !namedSpan) {
    // A typed span under 24″ is the span. Untyped bridges still start at 24″ (parseSize lifts a blank to 96″).
    const span = box.width < 24 ? Math.max(box.width, 6) : Math.max(box.width, 24);
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
  const recipe = formOverride ?? detectForm(prompt, { ...box, free: freeSize });
  const kind = recipe.kind;
  const forceCut = /cut the sticks|cut each stick|cut the stock/.test(lower) || opts.cutStock === true;
  const forceWhole = /don'?t cut|whole sticks|uncut|glue them whole/.test(lower) || opts.cutStock === false;
  const whole = forceCut ? false : forceWhole ? true : isWholeStock(item);
  // A sheet is ripped into battens before it tiles a form. The bought id stays the sheet.
  const members = memberView(item);
  const formName = stickFurnitureName(prompt, recipe.name);

  if (wantsSheetBox(prompt, item, kind)) {
    return enforceWeekendHonesty(withWireNote(attachFunction(buildSheetBox(prompt, item, kind, box, recipe.name)), item));
  }

  const weekend = detectWeekendFamily(prompt);
  if (
    weekendUsesLatticeGraph(prompt, kind) &&
    !(formOverride?.strokes && formOverride.strokes.length >= 4)
  ) {
    const eiffelK = kind === "eiffel" || weekend?.override === "eiffel" || /eiffel/.test(lower);
    const latticeAt = (targetHeightIn: number) => {
      const raw = buildLatticeTowerGraph({ targetHeightIn, materialId: item.id, item: members.density, eiffel: eiffelK, platforms: true, grain });
      const finished = finishGraph(raw, members.density, kind, !!opts.includeSpine, grain);
      const topo = pruneTopology(finished.graph, kind, { aggressiveness: kind === "eiffel" ? 0.06 : 0.18 });
      const g = { ...topo.graph, notes: [...topo.graph.notes, topo.note] };
      return finalize(
        attachFunction(projectFromGraph(prompt, members.cut, kind, g, true, finished.offer, opts.joinMethod, undefined, whole, members.section)),
        item,
        box,
        scale,
        members,
      );
    };
    let lat = latticeAt(box.height);
    // Parametric rule (CadQuery / FreeCAD): the typed height is a constraint.
    // Members are drawn on the centreline, so thick stock stands proud and the
    // tower grows. Pull the skeleton in by that overrun. Craft-thin sticks stay
    // on the tuned profile — a popsicle Eiffel is already within an inch.
    const dims = members.density.dims;
    const standOff = dims.diameter ?? Math.min(dims.thickness ?? dims.height ?? dims.width ?? 0, dims.width ?? dims.height ?? 0);
    const over = (lat.overall?.height ?? box.height) - box.height;
    if (over > 1 && (standOff >= 0.7 || freeSize || !eiffelK)) {
      lat = latticeAt(Math.max(6, box.height - over));
    }
    return lat;
  }

  const built = buildFormGraph({ ...recipe, name: formName }, members.density, item.id, { includeSpine: opts.includeSpine, kind, grain });
  return finalize(
    attachFunction(
      projectFromGraph(prompt, members.cut, kind, built.graph, !!recipe.historic, built.offer, opts.joinMethod, formName, whole, members.section),
    ),
    item,
    box,
    scale,
    members,
  );
}

function buildTemplateProject(
  prompt: string,
  item: CatalogItem,
  opts: { joinMethod?: JoinMethod; sizeOverride?: { width: number; height: number; depth: number }; cutStock?: boolean },
  id: TemplateClassId,
): YardProject | null {
  const lower = prompt.toLowerCase();
  const forceCut = /cut the sticks|cut each stick|cut the stock/.test(lower) || opts.cutStock === true;
  const forceWhole = /don'?t cut|whole sticks|uncut|glue them whole/.test(lower) || opts.cutStock === false;
  const whole = forceCut ? false : forceWhole ? true : isWholeStock(item);
  // Hole / photo / opening sizes are part sizes, not the overall — strip them before reading a typed size.
  const sized = lower.replace(/\d[\d\s\/.x×-]*\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:diameter\s+|dia\.?\s+|round\s+)?(?:entry\s+|entrance\s+)?hole/g, "hole").replace(/(?:for\s+(?:an?\s+)?)?\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:photo|picture|print|pic)/g, "photo");
  const raw = hasExplicitSize(sized) ? parseSize(sized) : undefined;
  const said = (n: number) => (n !== 24 || /\b24\b|\b2\s*-?\s*(?:foot|feet|ft)\b|\btwo\s*-?\s*(?:foot|feet)\b/.test(sized) ? n : undefined);
  const typed = opts.sizeOverride ?? (raw ? { width: said(raw.width), height: said(raw.height), depth: said(raw.depth) } : {});
  const built: TemplateBuild | null = buildTemplate(id, prompt, item, typed, whole);
  if (!built) return null;
  let project: YardProject;
  if (built.segs) {
    const join = (item.preferredJoins && item.preferredJoins[0]) || "glue";
    const nodes: StructureGraph["nodes"] = [];
    const edges: StructureGraph["edges"] = [];
    for (const s of built.segs) {
      const a = createId("n");
      const b = createId("n");
      nodes.push({ id: a, position: s.a, role: "support" }, { id: b, position: s.b, role: "support" });
      edges.push({ id: createId("e"), from: a, to: b, join, role: s.role as StructureGraph["edges"][number]["role"], critical: true, face: s.face });
    }
    const graph: StructureGraph = {
      id: createId("graph"),
      name: built.label,
      envelope: { width: 1, height: 1, depth: 1 },
      materialId: item.id,
      nodes,
      edges,
      assumptions: [],
      notes: [],
      structureClass: "generic",
    };
    project = projectFromGraph(prompt, item, built.kind, graph, false, undefined, opts.joinMethod, built.label, whole);
    // Sheet parts that ride with a stick build (a chipboard backer) keep their own material.
    if (built.panels?.length) project = { ...project, panels: [...project.panels, ...built.panels] };
  } else {
    project = {
      ...emptyProject(),
      name: built.label,
      prompt,
      kind: built.kind,
      panels: built.panels ?? [],
      primaryMaterialId: item.id,
      joinMethod: item.category === "cardboard" || built.params?.glueOnly ? "glue" : "screw",
      notes: [],
      assumptions: { load: "light", units: "inches", installMode: "freestanding", wallType: "wood_stud", use: "display" },
    };
  }
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (const i of project.instances) for (const q of [i.from, i.to]) if (q) { xs.push(q.x); ys.push(q.y); zs.push(q.z); }
  for (const p of project.panels) {
    xs.push(p.position.x, p.position.x + p.size.width);
    ys.push(p.position.y, p.position.y + p.size.height);
    zs.push(p.position.z, p.position.z + p.size.depth);
  }
  const pad = project.instances.length ? Math.max(toPrimitive(item).width, 0.1) : 0;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const overall = {
    width: r1(Math.max(...xs) - Math.min(...xs) + pad),
    height: r1(Math.max(...ys) + pad / 2),
    depth: r1(Math.max(...zs) - Math.min(...zs) + pad),
  };
  const counts = new Map<string, number>();
  for (const i of project.instances) if (i.role) counts.set(i.role, (counts.get(i.role) ?? 0) + 1);
  for (const p of project.panels) {
    const n = /wall/i.test(p.name) ? "wall" : /roof/i.test(p.name) ? "roof" : p.name.toLowerCase().split(" ").pop()!;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  project = {
    ...project,
    name: built.label,
    overall,
    shape: {
      classId: built.classId,
      subject: built.subject,
      pose: "stand",
      bodyLength: 0,
      parts: [...counts].map(([name, count]) => ({ name: name as never, count })),
      params: built.params,
    },
    notes: [...built.notes, ...project.notes.filter((n) => !/^Form:|^Proportions from/.test(n))],
  };
  return enforceWeekendHonesty(withWireNote(project, item));
}

/** Typed size for a shape template: "tall/high" is height; any other typed size is the length. */
function shapeTyped(prompt: string, sizeOverride?: { width: number; height: number; depth: number }): { length?: number; height?: number } {
  if (sizeOverride) return { length: sizeOverride.width };
  const said = typedSizeIn(prompt);
  if (said.height) return { height: said.height };
  if (said.length) return { length: said.length };
  if (!hasExplicitSize(prompt)) return {};
  const lower = prompt.toLowerCase();
  const s = parseSize(lower);
  if (/tall|high\b|height/.test(lower)) return { height: s.height };
  if (/long|length/.test(lower)) return { length: Math.max(s.width, s.height) };
  return { length: s.height !== 24 ? s.height : s.width };
}

function buildShapeProject(
  prompt: string,
  item: CatalogItem,
  opts: { joinMethod?: JoinMethod; scale?: BuildScale; sizeOverride?: { width: number; height: number; depth: number }; cutStock?: boolean },
): YardProject | null {
  const lower = prompt.toLowerCase();
  const forceCut = /cut the sticks|cut each stick|cut the stock/.test(lower) || opts.cutStock === true;
  const forceWhole = /don'?t cut|whole sticks|uncut|glue them whole/.test(lower) || opts.cutStock === false;
  const whole = forceCut ? false : forceWhole ? true : isWholeStock(item);
  let typed = shapeTyped(prompt, opts.sizeOverride);
  if (opts.scale === "tabletop" && !typed.length && !typed.height) typed = { length: 12 };
  const use = detectShapeClass(prompt)?.profile.use;
  if (use && !typed.length && !typed.height) typed = { ...USE_DEFAULT_SIZE[use] };
  const built = materializeShape(prompt, item, whole, typed);
  if (!built) return null;
  const shape = shapeSummary(built.model);
  const name = built.model.label;
  let project: YardProject;
  if (built.graph) {
    project = projectFromGraph(prompt, item, "figure", built.graph, false, undefined, opts.joinMethod, name, whole);
  } else {
    project = {
      ...emptyProject(),
      name,
      prompt,
      kind: "figure",
      panels: built.panels ?? [],
      primaryMaterialId: item.id,
      joinMethod: "screw",
      notes: [],
      assumptions: { load: "light", units: "inches", installMode: "freestanding", wallType: "wood_stud", use: "display" },
    };
  }
  project = {
    ...project,
    name,
    overall: built.overall,
    shape,
    notes: [...built.notes, ...project.notes.filter((n) => !/^Form:|^Proportions from/.test(n))],
  };
  return enforceWeekendHonesty(withWireNote(project, item));
}

function finalize(
  project: YardProject,
  item: CatalogItem,
  box: { width: number; height: number; depth: number },
  scale: BuildScale,
  members?: MemberView,
): YardProject {
  const notes = [...project.notes];
  if (scale === "tabletop") {
    notes.unshift(`Tabletop scale — about ${box.height.toFixed(0)}" high. Weekend / Full on the bench grow it.`);
  } else if (scale === "weekend") {
    notes.unshift("Weekend density — coarser than Full, still the same form.");
  }
  const prompt = project.prompt ?? "";
  if (detectWeekendMech(prompt) === "launcher" && isLauncherRamp(prompt)) {
    const rampLen = launcherRampLengthIn(prompt);
    const lenTalk = rampLen != null ? `${rampLen}" run` : "typed run length";
    notes.unshift(
      /(?:paper\s*)?plane/.test(prompt.toLowerCase())
        ? `Soft-launch plane ramp ${lenTalk} — side guides + floor ties; paper plane leaves free (not glued on).`
        : `Soft-launch trough channel ${lenTalk} — side guides + floor ties; free projectile leaves the ramp; marble leaves free (not glued on).`,
    );
  }
  if (detectWeekendMech(prompt) === "climb" && isClimbStepStool(prompt)) {
    const rr = climbRiseRun(prompt);
    const n = Math.max(1, climbStepCount(prompt));
    const riseRun = rr != null ? `${rr.rise}" rise × ${rr.run}" run` : "typed rise × run";
    const who = /\badult\b|adult\s+stands|adult\s+tread/.test(prompt.toLowerCase())
      ? "adult stands"
      : "kid stands";
    notes.unshift(
      n >= 2
        ? `${n} weight-bearing human steps (each ${riseRun}) — ${who} on the top tread; not a vehicle incline.`
        : `Weight-bearing climb step at ${riseRun} — ${who} on the tread; densify from named stock; not a vehicle incline.`,
    );
    if (wantsClimbHandrail(prompt)) {
      notes.unshift(
        "Handrail — posts rise above the top tread with a grip you hold while climbing; not decorative junk.",
      );
    }
  }
  if (wantsMediaTipHold(prompt)) {
    const tipTalk = mediaTipTalk(prompt);
    const held = mediaHoldHeldLabel(prompt);
    const printTalk = /8\s*[×x]\s*10/.test(prompt) ? "8×10 " : "";
    notes.unshift(
      `Tipped lean at ${tipTalk} with a front lip — holds a real ${printTalk}${held}, never a flat decal.`,
    );
  }
  const pl = prompt.toLowerCase();
  if (isPorchSwingFrame(pl)) {
    notes.unshift(
      `Porch swing frame for a hanging seat — clear swing densify; honor typed frame size. Not a sittable Bench or Storage unit.`,
    );
  }
  if (isAdirondackChair(pl)) {
    const seatHay = pl.replace(/\b\d\s*[x×]\s*\d+\b/g, " ");
    const seatM = seatHay.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″'])?\s*seat\s*height|seat\s*height[^\d]{0,16}(\d+(?:\.\d+)?)/);
    const seat = seatM ? seatM[1] || seatM[2] : null;
    notes.unshift(
      seat
        ? `Adirondack chair with ${seat}" seat height — outdoor seat family, never Custom closet.`
        : `Adirondack chair — outdoor seat family, never Custom closet.`,
    );
  }
  if (isLoungeChair(pl)) {
    notes.unshift(
      `Lounge chair — sit anatomy (seat + back + legs/frame); honor typed seat height and seat depth. Never Yard House wire.`,
    );
  }
  if (isRockingChair(pl)) {
    notes.unshift(
      `Rocking chair — curved rocker rails under the legs (not skis/sled). Honor typed seat height. Never Yard House wire.`,
    );
  }
  if (isOttoman(pl)) {
    notes.unshift(
      `Ottoman — solid top densify; square W=D when typed equal; honor height. Never Storage / Yard House wire.`,
    );
  }
  let next = notes === project.notes ? project : { ...project, notes };
  if (members?.note && !next.notes.includes(members.note)) {
    next = { ...next, notes: [members.note, ...next.notes] };
  }
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
  if (
    /table|desk|workbench|picnic/.test(next.prompt.toLowerCase()) &&
    !/chair|stool|planter/.test(next.prompt.toLowerCase()) &&
    next.instances.length &&
    !next.panels.length &&
    item.formFactor === "block"
  ) {
    next = withBrickDeck(next, item);
  }
  return enforceWeekendHonesty(withWireNote(next, item));
}

const KEEP_FORM = new Set([
  "eiffel",
  "lattice",
  "tower",
  "arch",
  "bridge",
  "ladder",
  "frame",
  "figure",
  "furniture",
  "vehicle",
  "vessel",
  "plant",
  "wall",
  "dome",
  "pyramid",
  "custom",
]);

/** A stick-built table/desk/workbench keeps the noun the person typed. */
function stickFurnitureName(prompt: string, recipeName: string): string {
  if (recipeName !== "Table") return recipeName;
  const stem = identityTitleStem(prompt.toLowerCase());
  if (stem && /desk|table|workbench|vanity/i.test(stem)) return stem;
  if (/\bdesk\b/.test(prompt.toLowerCase())) return "Desk";
  if (/\bworkbench\b/.test(prompt.toLowerCase())) return "Workbench";
  return recipeName;
}

function neverEmpty(project: YardProject, item: CatalogItem, box: { width: number; height: number; depth: number }): YardProject {
  const view = memberView(item);
  const assumed = `I don't have a dedicated ${project.name} recipe in ${item.name} yet. This is a close frame. Assumed ${box.width.toFixed(0)}" × ${box.depth.toFixed(0)}" × ${box.height.toFixed(0)}".`;
  if (KEEP_FORM.has(project.kind)) {
    const recipe = detectForm(project.prompt, { ...box, height: Math.max(box.height, 16), width: Math.max(box.width, 16) });
    const built = buildFormGraph(
      { ...recipe, ops: recipe.ops.length ? recipe.ops : [{ op: "box", x: 0, y: box.height / 2, z: 0, w: box.width, h: box.height, d: box.depth, role: "leg" }] },
      view.density,
      item.id,
      { kind: project.kind },
    );
    const retry = projectFromGraph(
      project.prompt,
      view.cut,
      project.kind,
      built.graph,
      false,
      built.offer,
      project.joinMethod,
      project.name,
      isWholeStock(item),
      view.section,
    );
    if (retry.instances.length) {
      return {
        ...retry,
        name: project.name,
        kind: project.kind,
        notes: [view.note ?? assumed, ...retry.notes],
      };
    }
    return {
      ...project,
      notes: [view.note ?? assumed, "Nothing I could place stayed above the stock's minimum length. Name a size or a different stock."],
    };
  }
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

/** Tile a block stock (Lego) across the top of a table, desk, or workbench. */
function withBrickDeck(project: YardProject, item: CatalogItem): YardProject {
  const prim = toPrimitive(item);
  const L = Math.max(0.4, prim.length);
  const W = Math.max(0.3, prim.width);
  const H = Math.max(0.2, prim.height);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let railY = 0;
  for (const inst of project.instances) {
    const pts = inst.from && inst.to ? [inst.from, inst.to] : [inst.position];
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
      railY = Math.max(railY, p.y);
    }
  }
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  if (!(spanX > 1 && spanZ > 1)) return project;
  let pitchX = L + 0.06;
  let pitchZ = W + 0.06;
  let nx = Math.max(1, Math.floor((spanX + 0.01) / pitchX));
  let nz = Math.max(1, Math.floor((spanZ + 0.01) / pitchZ));
  while (nx * nz > 1100 && pitchZ < spanZ) {
    pitchZ += W;
    nz = Math.max(1, Math.floor((spanZ + 0.01) / pitchZ));
  }
  while (nx * nz > 1100 && pitchX < spanX) {
    pitchX += L;
    nx = Math.max(1, Math.floor((spanX + 0.01) / pitchX));
  }
  const y = railY + H;
  const x0 = (minX + maxX) / 2 - ((nx - 1) * pitchX) / 2;
  const z0 = (minZ + maxZ) / 2 - ((nz - 1) * pitchZ) / 2;
  const deck: YardInstance[] = [];
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      const x = x0 + i * pitchX;
      const z = z0 + k * pitchZ;
      deck.push({
        id: createId("brk"),
        catalogId: item.id,
        position: { x, y, z },
        rotation: { x: 0, y: 0, z: 0 },
        role: "deck",
        from: { x: x - L / 2, y, z },
        to: { x: x + L / 2, y, z },
      });
    }
  }
  const crown = y + H / 2;
  return {
    ...project,
    instances: [...project.instances, ...deck],
    overall: {
      ...project.overall,
      width: Math.max(project.overall.width, Math.round(spanX * 10) / 10),
      depth: Math.max(project.overall.depth, Math.round(spanZ * 10) / 10),
      height: Math.max(project.overall.height, Math.round(crown * 10) / 10),
    },
    notes: [...project.notes, `Top: ${deck.length} ${item.name}s pressed on over the frame.`],
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
  section?: { width: number; height: number } | null,
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
    ...(g.face ? { face: { x: g.face[0], y: g.face[1], z: g.face[2] } } : {}),
    ...(section ? { section } : {}),
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
