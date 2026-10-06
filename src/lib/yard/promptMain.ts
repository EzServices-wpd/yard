import { frontCueNotes } from "./fittedShared";
import { withFrontCuesBuilt } from "./cueRules";
import { buildBoxFigure, buildPetBed, classAnatomy } from "./classAnatomy";
import { withPairedLeafReveals } from "./pairedLeaves";
import { hooksShowInModel } from "./boughtHardware";
import { spokenJoin } from "./shopJoin";
import { projectBoxes } from "./contact";
import { buildJobFurniture, wantsJobFurniture, wantsRealStockDefault, REAL_STOCK_NOTE, wantsRealShelterDefault, REAL_SHELTER_NOTE } from "./jobFurniture";
import { solveModel } from "./solve";
import { createId } from "@/lib/utils";
import { getCatalogItem } from "./catalog";
import { inchFrac, parseInch } from "./inchText";
import { autoSupportSpans } from "./spanCheck";
import { isWholeStock, toPrimitive } from "./geometry";
import { graphToInstances, rotationForDirection, type StructureGraph } from "./structureGraph";
import { buildLatticeTowerGraph } from "./structures/latticeTower";
import { buildClosetFromPrompt } from "./closet";
import { parsePocket, buildPocket, looksLikePocket } from "./pocket";
import { looksLikeFitted, parseBrief, buildFitted } from "./fitted";
import { buildOddShape, isOddShapePrompt } from "./oddShapes";
import { climbIdentityLabel, detectHouseFamily, isAvTower, isBedsideShelf, isHouseMediaCarcase, isPlatformBed, isWallMediaLedge, isPictureLedge , isAdirondackChair, isPorchSwingFrame, isLoungeChair, isRockingChair, isOttoman, isSeatingLoungeClass, namesSitChair, identityTitleStem, wantsShoes } from "./family";
import { climbRiseRun, climbStepCount, isAccessRamp, figureWordModifiesHead, detectWeekendFamily, detectWeekendMech, isClimbSingleStep, isClimbStepStool, isLauncherRamp, launcherRampLengthIn, mediaTipTalk, mediaHoldHeldLabel, wantsMediaTipHold, wantsClimbHandrail, weekendUsesLatticeGraph } from "./weekendFamily";
import { classifyAnatomy } from "./anatomy";
import { normalizeUserPrompt, untypedAxisAssumedNotes } from "./voiceHonesty";
import { axisOrderNote, enforceHonesty, typedExtents } from "./honesty";
import { enforceWeekendHonesty, applyNamedLumberPrimaryHonesty, applyExplicitBoardCarcase, applyExplicitSheetCarcase, typedStockKeptNote, withSpeciesTitle, withPlainStockNotes } from "./weekendStockHonesty";
import { pickWindow, buildWindowProject, looksLikeDoorFrame, buildDoorProject } from "./windows";
import { withHome } from "./assembly";
import { detectForm, subjectFromPrompt, type FormRecipe } from "./form";
import { buildFormGraph } from "./buildGraph";
import { analyzePieces, finishGraph } from "./connect";
import { pruneTopology } from "./topo";
import { pickPrimitive, looksLikeFallback, fallbackNote, primitiveNotes, primitivePrompt, isToyScaleBed, petSurfaceHeight, tidyNotes } from "./fallbackPrimitive";
import { buildToyBedFrame } from "./toyBed";
import type { BuildScale, CatalogItem, JoinMethod, Panel, StructureKind, YardInstance, YardProject } from "./types";
import { detectStructure, detectMaterial, parseSize, toProject, defaultSizeFor, isWireStock, hasExplicitSize, stripLumberStock } from "./promptHelpers";
import { bodyStockClauses, CATALOG_LUMBER_BIND } from "./namedLumberSpecies";
import { attachFunction } from "./function";
import { wantsSheetBox, buildSheetBox, wantsUnmatchedSheetShell, buildTypedSheetShell } from "./sheetBox";
import { memberView, recastPanelsAsStock, type MemberView } from "./memberStock";
import { detectFlatPrompt, buildFlatProject } from "./flatLayout";
import { detectShapeClass, materializeShape, shapeSummary, RIDE_HANDLE_STOCK } from "./shapeTemplates";
import { buildTemplate, detectTemplate, typedSizeIn, type TemplateBuild, type TemplateClassId } from "./formTemplates";
import { blockKit, buildBlocks, defaultBlockStock, detectBlockSubject, pieceBounds, stripStockSizes } from "./blocks";
import { composeProducts } from "./compose";
import { applySpokenFace } from "./face";
import { hasProductDrawing, isBareProductPrompt, isSpecProduct, modeledProduct } from "./productModel";
import { heldCollection, heldObjectFor, heldPhrase, namedBuildClass, stripPetUse, type HeldObject } from "./heldObjects";
import { buildHeldStand, buildTieredPlantStand, plantStandTiers } from "./heldStand";
import { buildClimb, climbKind } from "./climb";
import { buildOutdoorFrame, outdoorFrameKind } from "./outdoorFrames";
import { isTrellis, poleFrameKind, wantsFullSizeFrame } from "./poleFrames";

const REAL_POLE_NOTE = "No material typed, so this builds from 2×2 lumber at full size, the way it stands in a garden. Type dowels or popsicle sticks to build a model.";
const wantsFullSizePoleFrame = (prompt: string) => Boolean(poleFrameKind(prompt) || isTrellis(prompt)) && wantsFullSizeFrame(prompt);
import { buildAccessRamp, buildPetEnclosure, buildScratchingPost, isPetEnclosure, isScratchingPost } from "./petGear";
import { localStockQuery } from "./stockQuery";
import { placeCutOrder } from "./cutOrder";
import { rememberCatalogItem } from "./foundStock";
import { withOutdoorNotes } from "./outdoor";
import { notesWithFinishedDepth } from "./modelSize";

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
  const named = detectMaterial(prompt);
  if (isWireStock(named)) return null;
  // "from plywood" already wins inside detectMaterial. A leading sheet word is the same ask.
  if (bodyStockClauses(prompt).length) return named;
  if (named.formFactor === "sheet" || named.category === "cardboard" || named.category === "sheet_goods") return named;
  // A named member (dowel, pipe, stick, tube, roll, block) is the stock even without "from".
  // A house noun must not put that ask back on sheet goods. Species boards stay on the species path.
  if (named.formFactor === "dowel" || named.formFactor === "pipe" || named.formFactor === "tube" || named.formFactor === "stick" || named.formFactor === "block" || named.formFactor === "roll") return named;
  // A named board section is the member stock even without "from". The species default is not a section.
  if (named.category === "lumber" && named.formFactor === "board" && named.id !== CATALOG_LUMBER_BIND) return named;
  return null;
}

function carcaseKind(item: CatalogItem | null): "board" | "sheet" | null {
  if (!item) return null;
  if (item.formFactor === "sheet" || item.category === "sheet_goods" || item.category === "cardboard") return "sheet";
  if (item.category === "lumber" && item.formFactor === "board") return "board";
  return null;
}

/**
 * Typed framing stock drives the members of a panel build that has its own recipe stock (a step stool's
 * plywood treads and 2×2 posts, a gate's 1×6 boards): board parts take the typed board at its real
 * thickness, and the parts that keep their stock get one note saying which and why.
 */
function withTypedBoardStock(project: YardProject, prompt: string, materialOverride?: string): YardProject {
  const stock = requestedStock(prompt, materialOverride);
  if (!stock || carcaseKind(stock) !== "board" || !project.panels.length || project.primaryMaterialId === stock.id) return project;
  return applyExplicitBoardCarcase(project, stock);
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
    // A parts-block subject with its own natural stock (a pull wagon is plywood) uses it.
    const blockStock = defaultBlockStock(prompt);
    if (blockStock && getCatalogItem(blockStock)) return getCatalogItem(blockStock)!;
    const use = detectShapeClass(prompt)?.profile.use;
    const fn = use === "rocker" ? "lumber-2x4-8" : use || detectTemplate(prompt) === "platform-tower" ? "plywood-3-4-4x8" : null;
    if (fn && getCatalogItem(fn)) return getCatalogItem(fn)!;
    // An outdoor birdhouse is real 1×6 board at real size.
    if (wantsRealShelterDefault(prompt) && getCatalogItem("lumber-1x6-8")) return getCatalogItem("lumber-1x6-8")!;
    // Furniture and human-use pieces (seats, tables, beds, benches) are real lumber at real size.
    if (wantsRealStockDefault(prompt) && getCatalogItem("lumber-2x4-8")) return getCatalogItem("lumber-2x4-8")!;
    // Garden pole frames and trellises are full-size 2×2 builds unless a model is asked for.
    if (wantsFullSizePoleFrame(prompt) && getCatalogItem("lumber-2x2-8")) return getCatalogItem("lumber-2x2-8")!;
    return getCatalogItem("popsicle-standard") || named;
  }
  return named;
}

/** Default size for an animal with a use, when none is typed: a bookend is book height, a planter a patio pot. */
const USE_DEFAULT_SIZE: Record<string, { length?: number; height?: number }> = {
  bookend: { height: 9 },
  planter: { length: 24 },
  shelf: { length: 30 },
  rocker: { height: 24 },
  hooks: { length: 36 },
};

/**
 * Every build says which axes it assumed. Fitted builds read typed axes from typedExtents;
 * anything else only when no size was typed at all. Bench edits (Measure / overrides) are typed facts.
 */
function withAssumedAxes(project: YardProject, args: Parameters<typeof generateRaw>): YardProject {
  const [prompt = "", , formOverride, opts] = args;
  if (formOverride || opts?.sizeOverride || opts?.fittedOverride || opts?.pocketOverride || opts?.honorUnit) return project;
  let typed = { width: false, height: false, depth: false };
  if (project.fitted) {
    typed = typedExtents(prompt)?.labeled ?? typed;
  } else {
    const counts = /\b\d+\s*-?\s*(?:legs?|doors?|drawers?|shel(?:f|ves)|cubb(?:y|ies)|hooks?|pegs?|steps?|treads?|tiers?|rows?|bottles?|slots?|bins?|arms?|rungs?|lids?|brackets?)\b/g;
    const sized = /\d/.test(stripLumberStock(prompt.toLowerCase()).replace(counts, " ")) ||
      /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s*-?\s*(?:ft|foot|feet|inch|inches)\b/i.test(prompt);
    if (sized) return project;
  }
  // Cue notes land on the notes next; an axis one of them already explains is not assumed.
  const extra = untypedAxisAssumedNotes(prompt, [...(project.fitted?.cueNotes ?? []), ...(project.notes ?? [])], project.overall, typed);
  return extra.length ? { ...project, notes: [...(project.notes ?? []), ...extra] } : project;
}

/** A front feature typed both ways resolved by one rule (later cue wins): the note says which won. */
function withFrontCueNotes(project: YardProject, prompt: string): YardProject {
  if (!project.fitted) return project;
  const extra = [...frontCueNotes(prompt), ...(project.fitted.cueNotes ?? [])].filter((n) => !(project.notes ?? []).includes(n));
  return extra.length ? { ...project, notes: [...extra, ...(project.notes ?? [])] } : project;
}

/** A bare "8x6x7" says which order it was read in, right under the size line. */
function withAxisOrderNote(project: YardProject, args: Parameters<typeof generateRaw>): YardProject {
  const [prompt = "", , formOverride, opts] = args;
  if (formOverride || opts?.sizeOverride || opts?.fittedOverride || opts?.pocketOverride) return project;
  const note = axisOrderNote(prompt, project.overall);
  if (!note) return project;
  const notes = project.notes ?? [];
  return { ...project, notes: [...notes.slice(0, 1), note, ...notes.slice(1)] };
}

/** Built → solved. A sized weekend build then lands on the three numbers, same as a closet. */
export function generateFromPrompt(...args: Parameters<typeof generateRaw>): YardProject {
  // Every pass after the build reads the same words the build read ("2x4x8 bench" → "2x4 bench").
  const said = args[0] ?? "";
  args[0] = normalizeUserPrompt(said);
  const prompt = args[0];
  const done = withAxisOrderNote(
    withPlainStockNotes(withFrontCueNotes(typedStockKeptNote(withAssumedAxes(generateTyped(...args), args), prompt), prompt), prompt),
    args,
  );
  // The prompt box keeps the person's own words; every build's notes are tidied the same way.
  const tidy = { ...done, notes: tidyNotes(done.notes ?? []) };
  const built = done.typedPrompt ? { ...tidy, typedPrompt: said } : tidy;
  // Title rule: the species reaches the title when a lumber size was typed ("cedar 1x6", any builder) or
  // the noun matched no recipe (the title is only the typed words). A named recipe on species alone
  // ("pine step stool") keeps its builder's own title; notes, cut list and Buy still carry the species.
  const sized = built.primaryMaterialId !== CATALOG_LUMBER_BIND && getCatalogItem(built.primaryMaterialId)?.category === "lumber";
  return sized || built.unmatched ? withSpeciesTitle(built, prompt) : built;
}

function generateTyped(...args: Parameters<typeof generateRaw>): YardProject {
  const core = generateCore(...args);
  const prompt = args[0] ?? "";
  const noun = prompt
    .replace(/\d+(?:\.\d+)?\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:wide|tall|high|deep)/gi, " ")
    // A bare size ("coaster 4 inch") is not the head noun.
    .replace(/\s\d+(?:\.\d+)?\s*(?:"|inch(?:es)?|in\b|ft\b|foot|feet|')\s*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
  const stockTyped = Boolean(args[1]) || !isWireStock(detectMaterial(prompt)) || /\bwire\b|\b(from|out of|made of|made from|with)\b|sticks?\b|ply|cardboard|lumber|2x\d|1x\d|pallet|bamboo|pvc|acrylic|metal|pipe/i.test(prompt);
  const toyBed = isToyScaleBed(noun);
  // Toy-scale beds: dedicated stick bed frame (legs + rails + deck) — never the house
  // platform-bed panel recipe recast into a sprawling craft lattice.
  if (toyBed) {
    const woodLift = /\b(?:plywood|lumber|2x\d|1x\d|pallet)\b/i.test(prompt) || (args[1] && /plywood|lumber|2x|1x/.test(String(args[1])));
    if (!woodLift) {
      const craftId =
        args[1] && getCatalogItem(args[1]) && !isWireStock(getCatalogItem(args[1])!)
          ? args[1]
          : !isWireStock(detectMaterial(prompt))
            ? detectMaterial(prompt).id
            : "popsicle-standard";
      const item = getCatalogItem(craftId) ?? getCatalogItem("popsicle-standard")!;
      const prim = pickPrimitive(noun);
      const sized = parseSize(prompt.toLowerCase());
      const size = {
        width: /wide/i.test(prompt) ? sized.width : (prim?.size[0] ?? 4.5),
        height: /(?:tall|high)/i.test(prompt) ? sized.height : (prim?.size[1] ?? 2.5),
        depth: /deep/i.test(prompt) ? sized.depth : (prim?.size[2] ?? 3.5),
      };
      const built = buildToyBedFrame(prompt, item, size, noun);
      return hooksShowInModel(craftDisplay(built, prompt));
    }
  }
  // Toy-scale beds always consider the bed primitive — craft stock typed must not leave a figure or full mattress.
  // A figure word that only modifies the head noun ("craft stick bird feeder") still gets the head's
  // primitive, in the stock that was typed.
  // Only when the build found no recipe for the head ("dog bed from a pallet" keeps its pallet bed).
  const modifier = figureWordModifiesHead(noun) && (Boolean(core.unmatched) || core.kind === "figure");
  // A pet's feeding surface built at people scale (a 42" counter, a 40" table) is rebuilt at the pet's scale.
  const o = core.overall;
  const petScale = petSurfaceHeight(noun) != null && (o.height > 20 || Math.max(o.width, o.depth) > 36);
  // A body with no class is the weakest build: a head noun with a primitive builds that primitive in the typed stock.
  const unmatchedBody = Boolean(core.unmatched);
  const p = stockTyped && !toyBed && !modifier && !petScale && !unmatchedBody ? null : pickPrimitive(noun);
  if (!p || (!petScale && !looksLikeFallback(core, noun))) return core;
  let remapped = primitivePrompt(p, prompt);
  if (stockTyped && (modifier || petScale || unmatchedBody)) {
    const subject = new Set(subjectFromPrompt(noun).toLowerCase().split(/\s+/));
    remapped = `${noun.split(/\s+/).filter((w) => !subject.has(w.toLowerCase())).join(" ")} ${remapped}`.trim();
  }
  // Keep craft stock for toy beds (popsicle when none typed); never silently lift them to plywood.
  if (toyBed && !args[1] && !/\b(?:plywood|lumber|2x\d|1x\d|pallet)\b/i.test(prompt)) {
    const craft =
      prompt.match(/\b(?:jumbo\s+)?(?:popsicle|craft)\s*sticks?\b|\bbamboo\s+skewers?\b|\btoothpicks?\b|\bbalsa\b/i)?.[0] ??
      "popsicle sticks";
    remapped = `${craft} ${remapped}`;
  }
  const built = generateCore(remapped, ...(args.slice(1) as []));
  const subject = subjectFromPrompt(noun).replace(/\b\w/g, (c) => c.toUpperCase());
  // The title names the model's size, like every other build's.
  const size = built.overall;
  const title = `${subject} ${inchFrac(size.width)}" × ${inchFrac(size.height)}" × ${inchFrac(size.depth)}"`;
  // The bench builds from the primitive; the prompt box keeps the person's own words.
  // The primitive's size was Yard's pick, so a "You typed" line only stays when a size was typed.
  const saidSize = /\d+(?:\.\d+)?\s*(?:"|in(?:ch(?:es)?)?|ft|foot|feet|')?\s*(?:wide|tall|high|deep|long)|\d+(?:\.\d+)?\s*(?:"|inch|in\b|ft\b|foot|feet|')/i.test(prompt);
  const ownNotes = (built.notes ?? []).filter((n) => saidSize || !/^You typed\b/.test(n));
  return { ...built, name: title, typedPrompt: prompt, notes: [fallbackNote(noun.toLowerCase(), p.label), ...primitiveNotes(ownNotes, p, subject, noun)] };
}

function generateCore(...args: Parameters<typeof generateRaw>): YardProject {
  const built = (a: Parameters<typeof generateRaw>) => {
    const solved = solveModel(generateRaw(...a));
    return solved.panels.length ? applySpokenFace(solved, a[0]) : solved;
  };
  const project = built(args);
  const override = args[3]?.sizeOverride;
  // A size the builder missed: rebuild at the typed envelope (module counts follow), then fit.
  const rebuild = (box: Box3) => fitWeekendSize(built([args[0], args[1], args[2], { ...(args[3] ?? {}), sizeOverride: box }]), args[0], box, undefined, undefined, true);
  const natural = () => {
    const bare = stripEnvelopeWords(args[0]);
    return bare && bare !== args[0] ? built([bare, args[1], args[2], args[3]]) : null;
  };
  const sized = addFigureBookend(fitWeekendSize(project, args[0], override, override ? undefined : rebuild, natural), args[0]);
  const tabled0 = honorTableTriple(sized, args[0]);
  // A furniture piece built in 2×4 because no stock was typed says so.
  const defaulted =
    !args[1] && isWireStock(detectMaterial(args[0])) && !/\bwire\b/i.test(args[0]) && wantsRealStockDefault(args[0]) &&
    tabled0.primaryMaterialId === "lumber-2x4-8" && !(tabled0.notes ?? []).includes(REAL_STOCK_NOTE);
  const poleDefaulted =
    !args[1] && isWireStock(detectMaterial(args[0])) && !/\bwire\b/i.test(args[0]) && wantsFullSizePoleFrame(args[0]) &&
    tabled0.primaryMaterialId === "lumber-2x2-8" && !(tabled0.notes ?? []).includes(REAL_POLE_NOTE);
  const shelterDefaulted =
    !args[1] && isWireStock(detectMaterial(args[0])) && !/\bwire\b/i.test(args[0]) && wantsRealShelterDefault(args[0]) &&
    tabled0.primaryMaterialId === "lumber-1x6-8" && !(tabled0.notes ?? []).includes(REAL_SHELTER_NOTE);
  const stockNote = defaulted ? REAL_STOCK_NOTE : poleDefaulted ? REAL_POLE_NOTE : shelterDefaulted ? REAL_SHELTER_NOTE : null;
  const tabled = withFrontCuesBuilt(stockNote ? { ...tabled0, notes: [...(tabled0.notes ?? []), stockNote] } : tabled0, args[0]);
  const finished = tabled.panels.length && !tabled.pocket ? { ...tabled, notes: notesWithFinishedDepth(tabled.notes ?? [], tabled.panels, tabled.overall.depth) } : tabled;
  const joined = spokenJoin(args[0]);
  const stamped = joined ? { ...finished, shopJoin: joined } : finished;
  return settleOnFloor(hooksShowInModel(withPairedLeafReveals(withOutdoorNotes(autoSupportSpans(stampStockThickness(pipeHouse(craftDisplay(stamped, args[0]), args[0])), args[0]), args[0]))));
}

/**
 * A freestanding build rests on its lowest part. A body or model drawn above the floor with nothing
 * reaching down (a model plane on its wings, a coaster) is lowered until that part sits on the floor.
 */
function settleOnFloor(project: YardProject): YardProject {
  if (project.assumptions?.installMode && project.assumptions.installMode !== "freestanding") return project;
  if (project.windowPkg || project.pocket) return project;
  const boxes = projectBoxes(project);
  if (!boxes.length) return project;
  const low = Math.min(...boxes.map((b) => b.c.y - (b.h[0] * Math.abs(b.ax[0].y) + b.h[1] * Math.abs(b.ax[1].y) + b.h[2] * Math.abs(b.ax[2].y))));
  if (!(low > 0.1)) return project;
  const down = <T extends { y: number }>(v: T): T => ({ ...v, y: v.y - low });
  return {
    ...project,
    instances: project.instances.map((i) => ({ ...i, position: down(i.position), ...(i.from ? { from: down(i.from) } : {}), ...(i.to ? { to: down(i.to) } : {}) })),
    panels: project.panels.map((p) => ({ ...p, position: down(p.position) })),
  };
}

/** Sheet faces take the picked stock thickness. A 1/2" sheet is not still cut at 3/4". Backer keeps its own stock. */
function stampStockThickness(project: YardProject): YardProject {
  const item = getCatalogItem(project.primaryMaterialId);
  const thick = item?.dims.thickness;
  if (!thick || Math.abs(thick - 0.75) < 0.02 || !project.panels.length) return project;
  const panels = project.panels.map((panel) => {
    if (panel.materialId !== project.primaryMaterialId) return panel;
    const size = panel.size;
    const thin = (["width", "height", "depth"] as const).reduce((a, b) => (size[a] <= size[b] ? a : b));
    if (Math.abs(size[thin] - 0.75) > 0.05) return panel;
    return { ...panel, size: { ...size, [thin]: thick } };
  });
  return { ...project, panels };
}

/**
 * "robot bookend": the figure is the class, the bookend is its use. A stick-built figure gets a flat
 * face on one side for the books to lean on, and a base that runs on under the first books so their
 * weight holds it. Same stock and joinery as the figure. Shape templates (animals) carry their own.
 */
function addFigureBookend(project: YardProject, prompt: string): YardProject {
  const lower = (prompt || "").toLowerCase();
  if (!/\bbook\s*-?\s*ends?\b/.test(lower)) return project;
  if (project.kind !== "figure" || project.panels.length || !project.instances.length) return project;
  if (project.instances.some((i) => i.role === "base" || i.role === "bookend face")) return project;
  const counts = new Map<string, number>();
  for (const i of project.instances) counts.set(i.catalogId, (counts.get(i.catalogId) ?? 0) + 1);
  const catId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const item = getCatalogItem(catId);
  if (!item) return project;
  const prim = toPrimitive(item);
  const w = Math.max(0.25, prim.width);
  const t = Math.max(0.1, prim.height);
  const pts = project.instances.flatMap((i) => [i.from ?? i.position, i.to ?? i.position]);
  const minX = Math.min(...pts.map((p) => p.x)) - w / 2;
  const maxX = Math.max(...pts.map((p) => p.x)) + w / 2;
  const minY = Math.min(...pts.map((p) => p.y)) - w / 2;
  const maxY = Math.max(...pts.map((p) => p.y)) + w / 2;
  const minZ = Math.min(...pts.map((p) => p.z)) - w / 2;
  const maxZ = Math.max(...pts.map((p) => p.z)) + w / 2;
  const lift = t - minY;
  const up = (p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y + lift, z: p.z });
  const lifted: YardInstance[] = project.instances.map((i) => ({
    ...i,
    position: up(i.position),
    from: i.from ? up(i.from) : i.from,
    to: i.to ? up(i.to) : i.to,
    home: i.home ? up(i.home) : i.home,
  }));
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const mk = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, role: string, face: { x: number; y: number; z: number }): YardInstance => {
    const [rx, ry, rz] = rotationForDirection(a, b, false);
    return {
      id: createId("bkend"),
      catalogId: catId,
      position: { x: r((a.x + b.x) / 2), y: r((a.y + b.y) / 2), z: r((a.z + b.z) / 2) },
      rotation: { x: rx, y: ry, z: rz },
      cutLength: Math.round(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) * 16) / 16,
      role,
      join: "screw",
      from: a,
      to: b,
      face,
    };
  };
  const zSpan = Math.max(maxZ - minZ, 2 * w);
  const n = Math.max(2, Math.ceil(zSpan / w));
  const z0 = (minZ + maxZ) / 2 - (n * w) / 2 + w / 2;
  const figH = maxY - minY;
  const faceH = Math.round(Math.min(10, Math.max(6, figH * 0.45)) * 2) / 2;
  const bookRun = Math.round(Math.max(5, Math.min(8, (maxX - minX) * 0.75)) * 2) / 2;
  const faceX = maxX + t / 2;
  const baseX0 = minX - 0.5;
  const baseX1 = faceX + t / 2 + bookRun;
  const added: YardInstance[] = [];
  for (let k = 0; k < n; k++) {
    const z = r(z0 + k * w);
    added.push(mk({ x: r(baseX0), y: r(t / 2), z }, { x: r(baseX1), y: r(t / 2), z }, "base", { x: 0, y: 1, z: 0 }));
    added.push(mk({ x: r(faceX), y: r(t), z }, { x: r(faceX), y: r(t + faceH), z }, "bookend face", { x: 1, y: 0, z: 0 }));
  }
  const stock = item.name.replace(/\s*\(.*?\)\s*/g, " ").trim();
  const label = project.name.replace(/\s+bookends?$/i, "");
  const name = /bookend/i.test(project.name) ? project.name : `${label} bookend`;
  const notes = [
    `${name}: the ${label.toLowerCase()} is the figure, the bookend is its use. ${n} upright ${stock} pieces ${inchFrac(faceH)}" tall make a flat face on its right side for the books to lean on; ${n} more lie flat as a base that runs ${inchFrac(bookRun)}" past the face, under the first books — their weight keeps the bookend from sliding.`,
    "Screw the face pieces down into the base, then stand the figure on the base and screw up through it. Stick felt pads under the base so it does not scratch the shelf.",
    ...project.notes,
  ];
  return {
    ...project,
    name,
    instances: [...lifted, ...added],
    notes,
    overall: {
      width: Math.round((baseX1 - Math.min(minX, baseX0)) * 16) / 16,
      height: Math.round(Math.max(figH + t, t + faceH) * 16) / 16,
      depth: Math.round(Math.max(maxZ - minZ, n * w) * 16) / 16,
    },
  };
}

function axisLabeled(prompt: string): boolean {
  const l = prompt.toLowerCase();
  return /(?:wide|width)\b/.test(l) && /(?:tall|high|height)\b/.test(l) && /(?:deep|depth)\b/.test(l);
}

/** Three typed numbers on a table or bench are width × depth × height. */
function honorTableTriple(project: YardProject, prompt: string): YardProject {
  const lower = (prompt || "").toLowerCase();
  if (!/\b(?:tables?|benches|bench)\b/.test(lower)) return project;
  if (/\bfold/.test(lower)) return project;
  if (/\b(?:wide|width|deep|depth|tall|high|height|long|length)\b/.test(lower)) return project;
  const m = lower.match(/(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)/);
  if (!m) return project;
  const width = parseFloat(m[1]);
  const depth = parseFloat(m[2]);
  const height = parseFloat(m[3]);
  if (!(width > 0 && depth > 0 && height > 0)) return project;
  if (Math.abs(project.overall.width - width) < 0.6 && Math.abs(project.overall.depth - depth) < 0.6 && Math.abs(project.overall.height - height) < 0.6) {
    return project;
  }
  const sy = project.overall.height > 0 ? height / project.overall.height : 1;
  const sz = project.overall.depth > 0 ? depth / project.overall.depth : 1;
  const panels = project.panels.map((p) => ({
    ...p,
    position: { x: p.position.x, y: p.position.y * sy, z: p.position.z * sz },
    size: { width: p.size.width, height: p.size.height * (p.size.height > 1 ? sy : 1), depth: p.size.depth * (p.size.depth > 1 ? sz : 1) },
  }));
  const fitted = project.fitted
    ? { ...project.fitted, unit: { ...project.fitted.unit, width, height, depth }, opening: { ...project.fitted.opening, width, height, depth } }
    : project.fitted;
  return {
    ...project,
    panels,
    fitted,
    overall: { width, height, depth },
    name: project.name.replace(/\d[^"]*"/, `${width}" × ${height}" × ${depth}"`),
  };
}
function bareFigureHeight(prompt: string): number | null {
  const l = prompt.toLowerCase();
  if (/\b(?:wide|width|deep|depth|long|length|tall|high)\b/.test(l)) return null;
  const m = l.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return n > 0 ? n : null;
}

type Box3 = { width: number; height: number; depth: number };
const AXES = ["width", "height", "depth"] as const;

/**
 * The typed envelope of a weekend / craft build: labeled axes from typedExtents (a triple, W / H / D words,
 * "long" on the width), else one bare size ("18 inches") on the build's longest axis.
 */
function typedEnvelope(prompt: string, overall: Box3): Partial<Box3> | null {
  const ext = typedExtents(prompt);
  const out: Partial<Box3> = {};
  for (const a of AXES) if (ext?.labeled?.[a] && Number.isFinite(ext[a]) && (ext[a] as number) > 0) out[a] = ext[a] as number;
  if (Object.keys(out).length) return out;
  const said = typedSizeIn(prompt);
  if (said.height) return { height: said.height };
  if (said.length) {
    // A bare size goes on the axis the builder already gave it; else on the long axis.
    const near = AXES.find((a) => Math.abs(overall[a] - said.length!) <= Math.max(0.5, 0.1 * said.length!));
    if (near) return { [near]: said.length };
    const long = AXES.reduce((m, a) => (overall[a] > overall[m] ? a : m), "width" as (typeof AXES)[number]);
    return { [long]: said.length };
  }
  return null;
}

/** Sizes, not stock: the same prompt with its typed envelope words taken out (natural proportions). */
function stripEnvelopeWords(prompt: string): string {
  const N = String.raw`\d+(?:\.\d+)?(?:\s+\d+\/\d+)?`;
  const U = String.raw`(?:\s*(?:"|″|in(?:ch(?:es)?)?\b|ft\b|feet\b|foot\b|'))?`;
  return prompt
    .replace(new RegExp(String.raw`(?<![\w/.])(?![124]\s*[x×]\s*(?:2|3|4|6|8|10|12)\b)${N}${U}\s*[x×]\s*${N}${U}(?:\s*[x×]\s*${N}${U})?`, "gi"), " ")
    .replace(new RegExp(String.raw`(?<![\w/.])${N}${U}\s*-?\s*(?:wide|width|tall|high|height|deep|depth|long|length|across|around|in diameter|diameter|dia)\b`, "gi"), " ")
    .replace(new RegExp(String.raw`\b(?:dia(?:meter)?|width|height|depth|length)\s*(?:of\s*)?${N}${U}`, "gi"), " ")
    .replace(new RegExp(String.raw`(?<![\w/.])${N}\s*(?:"|″|in(?:ch(?:es)?)?\b|ft\b|feet\b|foot\b)(?!\s*(?:x|×|plywood|ply|skewers?|dowels?|sticks?|boards?|hole|diameter|dia|photo|picture|opening|entrance|pipe|pvc))`, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whole craft sticks are glued as bought: their length is the module, never stretched to a size. */
function wholeStickBuild(project: YardProject): boolean {
  const item = getCatalogItem(project.primaryMaterialId);
  if (!item || !isWholeStock(item)) return false;
  const own = project.instances.filter((i) => i.catalogId === project.primaryMaterialId);
  return own.length > 0 && own.every((i) => i.cutLength == null);
}

const misses = (o: Box3, want: Partial<Box3>, slack = 0.04) =>
  AXES.some((a) => want[a] != null && Math.abs(o[a] - want[a]!) > Math.max(0.5, slack * want[a]!));
const missBy = (o: Box3, want: Partial<Box3>) =>
  AXES.reduce((s, a) => s + (want[a] != null ? Math.abs(Math.log(Math.max(o[a], 0.1) / want[a]!)) : 0), 0);

function realSizeNote(project: YardProject, want: Partial<Box3>): YardProject {
  const item = getCatalogItem(project.primaryMaterialId);
  const stick = (item?.name ?? "stick").replace(/\s*\(.*?\)\s*/g, " ").trim();
  const word = { width: "wide", height: "tall", depth: "deep" } as const;
  const asked = AXES.filter((a) => want[a] != null).map((a) => `${inchFrac(want[a]!)}" ${word[a]}`).join(" × ");
  const o = project.overall;
  const note = `You typed ${asked}. Whole ${stick}s build it ${inchFrac(o.width)}" wide × ${inchFrac(o.height)}" tall × ${inchFrac(o.depth)}" deep — the closest the stick allows. Type "cut the sticks" to build it to the exact size.`;
  return { ...project, notes: [note, ...(project.notes ?? []).filter((n) => !/^You typed .* the closest the stick allows/.test(n))] };
}

function fitWeekendSize(
  project: YardProject,
  prompt: string,
  override?: Box3,
  rebuild?: (box: Box3) => YardProject,
  natural?: () => YardProject | null,
  /** The caller weighs this rebuild against the first build and writes the size note itself. */
  quiet = false,
): YardProject {
  if (project.fitted || project.pocket || project.windowPkg || project.climb || project.sizedByBuilder || project.kind === "closet" || project.kind === "opening") {
    return project;
  }
  if (!project.instances.length && !project.panels.length) return project;
  const bare = bareFigureHeight(prompt);
  if (project.kind === "figure" && bare && Math.abs(project.overall.height - bare) > 0.5) {
    const k = bare / project.overall.height;
    return scaleToBox(project, { width: project.overall.width * k, height: bare, depth: project.overall.depth * k });
  }
  const whole = wholeStickBuild(project);
  if (override) {
    if (!(override.width > 0) || !(override.height > 0) || !(override.depth > 0)) return project;
    // A whole-stick build was rebuilt at this size by its own module count; it is never stretched.
    if (whole) return quiet || !misses(project.overall, override) ? project : realSizeNote(project, override);
    return scaleToBox(project, override);
  }
  if (axisLabeled(prompt) && !whole) {
    const box = parseSize(prompt.toLowerCase());
    if (!(box.width > 0) || !(box.height > 0) || !(box.depth > 0)) return project;
    return scaleToBox(project, box);
  }
  // Partly typed sizes are the builder's own business, except whole craft sticks (their module ignores
  // them) and unmatched nouns (no builder read them).
  if (!whole && !project.unmatched) return project;
  const want = typedEnvelope(prompt, project.overall);
  if (!want) return project;
  // Untyped axes keep the build's own proportions (from the same prompt with no size), scaled with the typed ones.
  const nat = whole ? natural?.() : null;
  const base = nat && nat.kind === project.kind && nat.overall.width > 0.2 ? nat.overall : project.overall;
  const typedAxes = AXES.filter((a) => want[a] != null);
  const k = Math.exp(typedAxes.reduce((s, a) => s + Math.log(want[a]! / Math.max(base[a], 0.1)), 0) / typedAxes.length);
  const r2 = (n: number) => Math.round(n * 16) / 16;
  const target: Box3 = { width: r2(want.width ?? base.width * k), height: r2(want.height ?? base.height * k), depth: r2(want.depth ?? base.depth * k) };
  const proportionsOff = whole && typedAxes.length < 3 && misses(project.overall, target, 0.25);
  if (!misses(project.overall, want) && !proportionsOff) return project;
  if (!whole) return scaleToBox(project, target);
  const r = rebuild?.(target);
  const pick = r && missBy(r.overall, want) <= missBy(project.overall, want) + 1e-6 ? r : project;
  return misses(pick.overall, want) ? realSizeNote(pick, want) : pick;
}

/** Parts already inside the typed box — envelope padding is not a reason to shrink them. */
function partsAlreadyInside(
  project: YardProject,
  box: { width: number; height: number; depth: number },
): boolean {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let n = 0;
  for (const panel of project.panels) {
    n += 1;
    minX = Math.min(minX, panel.position.x);
    minY = Math.min(minY, panel.position.y);
    minZ = Math.min(minZ, panel.position.z);
    maxX = Math.max(maxX, panel.position.x + panel.size.width);
    maxY = Math.max(maxY, panel.position.y + panel.size.height);
    maxZ = Math.max(maxZ, panel.position.z + panel.size.depth);
  }
  for (const inst of project.instances) {
    const pts = [inst.position, inst.from, inst.to].filter(Boolean) as { x: number; y: number; z: number }[];
    for (const pt of pts) {
      n += 1;
      minX = Math.min(minX, pt.x);
      minY = Math.min(minY, pt.y);
      minZ = Math.min(minZ, pt.z);
      maxX = Math.max(maxX, pt.x);
      maxY = Math.max(maxY, pt.y);
      maxZ = Math.max(maxZ, pt.z);
    }
  }
  if (!n) return false;
  const slack = 0.75;
  return maxX - minX <= box.width + slack && maxY - minY <= box.height + slack && maxZ - minZ <= box.depth + slack;
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
  // Typed outside size wins. Padding on overall (roof clearance, battlement margin) must not shrink parts that already fit.
  const shrinking = sx < 0.97 || sy < 0.97 || sz < 0.97;
  const growing = sx > 1.03 || sy > 1.03 || sz > 1.03;
  if (shrinking && !growing && partsAlreadyInside(project, box)) {
    const fmt = (n: number) => inchFrac(n);
    const note = `Sized to ${inchFrac(box.width)}" wide × ${inchFrac(box.height)}" high × ${inchFrac(box.depth)}" deep.`;
    return {
      ...project,
      overall: { width: box.width, height: box.height, depth: box.depth },
      notes: [note, ...(project.notes ?? []).filter((n) => !n.startsWith("Sized to "))],
    };
  }
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
  // Stock keeps its thickness: a ¾" sheet stays ¾" when the build is stretched or squeezed.
  // Only the face of each panel follows the new size.
  const panels = project.panels.map((p) => {
    const thinAxis = p.size.width <= p.size.height && p.size.width <= p.size.depth ? "x" : p.size.height <= p.size.depth ? "y" : "z";
    const k = { x: thinAxis === "x" ? 1 : sx, y: thinAxis === "y" ? 1 : sy, z: thinAxis === "z" ? 1 : sz };
    const c0 = { x: p.position.x + p.size.width / 2, y: p.position.y + p.size.height / 2, z: p.position.z + p.size.depth / 2 };
    const size = { width: p.size.width * k.x, height: p.size.height * k.y, depth: p.size.depth * k.z };
    const c1 = s(c0);
    return {
    ...p,
    position: { x: c1.x - size.width / 2, y: thinAxis === "y" && p.position.y < 0.01 ? 0 : c1.y - size.height / 2, z: c1.z - size.depth / 2 },
    size,
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
  };
  });
  const fmt = (n: number) => inchFrac(n);
  const note = `Sized to ${inchFrac(box.width)}" wide × ${inchFrac(box.height)}" high × ${inchFrac(box.depth)}" deep.`;
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
  // Part sizes written into the notes follow the new size: scaled when the build grew or shrank evenly;
  // when it was stretched one way, the cut list carries the real lengths and the old numbers drop out.
  const even = Math.max(sx, sy, sz) / Math.min(sx, sy, sz) < 1.04;
  const k = (sx + sy + sz) / 3;
  const inchNum = /(\d+(?:\.\d+)?(?: \d+\/\d+)?|\d+\/\d+)"/g;
  notes = notes
    .filter((n) => n.startsWith("Sized to ") || even || !/\d"/.test(n))
    .map((n) => (n.startsWith("Sized to ") || !even ? n : n.replace(inchNum, (_m, v: string) => `${inchFrac(parseInch(v) * k)}"`)));
  notes = [note, ...notes.filter((n) => !n.startsWith("Sized to "))];
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



/** A board they already own stays that board. Not a catalog default, not a figure. */
function placeOwnedBoard(prompt: string): YardProject | null {
  const item = localStockQuery(prompt);
  if (!item || item.unitCostUsd !== 0) return null;
  rememberCatalogItem(item);
  const length = item.dims.length ?? 0;
  const width = item.dims.width ?? 0;
  const thick = item.dims.height ?? 0;
  if (length < 0.5 || width < 0.5) return null;
  const scraper = /boot scraper|scraper/i.test(prompt);
  const name = scraper ? `Boot scraper from your ${item.name}` : item.name;
  const pos = { x: 0, y: thick / 2, z: 0 };
  const kept = `${inchFrac(thick)}" × ${inchFrac(width)}" × ${inchFrac(length)}"`;
  const note = item.notes
    ? `${item.notes} Kept at your board's own ${kept}.`
    : `Kept at your board's own ${kept}.`;
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "custom",
    overall: { width: length, height: thick, depth: width },
    instances: [
      {
        id: createId("inst"),
        catalogId: item.id,
        position: pos,
        rotation: { x: 0, y: 0, z: 0 },
        cutLength: length,
        role: "member",
        home: pos,
      },
    ],
    panels: [],
    primaryMaterialId: item.id,
    notes: [note],
    assumptions: {
      load: "light",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  };
}


/**
 * A stand, riser, shelf, or holder FOR a held object keeps that object on a deck sized to it.
 * Only when no build class matched (animal / figure / template / weekend / climb), and only when the
 * held phrase names a real object: a class-default held object (microwave, aquarium, TV…) or a
 * product with a drawing (cooler, bottle). An unknown noun never becomes a tiny placeholder.
 */
/** Nouns that are plural in form but one object (a pair of pliers). A language rule, not routing. */
const PAIR_NOUN = /\b(?:pliers|scissors|shears|tongs|goggles|glasses|sunglasses|binoculars|headphones|earbuds|clippers|tweezers|pants|jeans|skis|chopsticks)$/;

/** The held phrase names many things: a count above two, or a plural head noun. */
function holdsMany(phrase: string): boolean {
  const p = phrase.trim().replace(/\s+(?:collection|set)$/, "");
  if (/^(?:\d+|three|four|five|six|seven|eight|nine|ten|twelve|dozen|several|many|lots of|all)\b/.test(p) && !/^\d+(?:\.\d+)?\s*(?:lb|lbs|pound|gallon|gal|qt|quart|oz|inch|in|"|ft|foot|feet)\b/.test(p)) return true;
  const head = p.split(/\s+/).pop() ?? "";
  if (PAIR_NOUN.test(head)) return false;
  return /[a-z]{3,}s$/.test(head) && !/(?:ss|us|is|ics)$/.test(head);
}

function placeHeldProduct(prompt: string): YardProject | null {
  const lower = prompt.toLowerCase();
  if (!/\b(stands?|holders?|cradles?|racks?|shel(?:f|ves)|risers?|carts?)\b/.test(lower)) return null;
  // One precedence rule. A known build class wins (cat tree, any animal, robot, frame, and the house
  // furniture identities: shoe rack, bookcase, ladder / floating / utility shelving, printer stand…).
  if (namedBuildClass(prompt)) return null;
  // A shelf / tier count is a property of shelving furniture, never of a stand around one object.
  if (/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:shel(?:f|ves)|tiers?|levels?)\b/.test(lower)) return null;
  // "shelf for my X collection" is a display shelf: X is what it shows.
  if (heldCollection(lower)) return null;
  const phrase = heldPhrase(stripPetUse(lower));
  if (!phrase) return null;
  const held = heldObjectFor(phrase);
  if (!held) {
    // Many of X (a count or a plural: "12 bottles", "jars", "my shoes") is storage furniture for X.
    if (holdsMany(phrase)) return null;
    // "<X> shelf / rack" (no "for") names shelving for X — a jar shelf, a corner shelf — unless the
    // class table knows X as one object (microwave shelf). Stand / holder / riser / cradle / cart keep X.
    if (!/\bfor\b/.test(lower) && !/\b(stands?|holders?|cradles?|risers?|carts?)\b/.test(lower)) return null;
  }
  const titleFor = (label: string) => {
    const noun = (lower.match(/\b(stand|riser|shelf|holder|cradle|cart|rack)\b/)?.[1] ?? "stand");
    const art = /^(?:one|two|three|four|\d+\s+\w+s)\b/i.test(label) && !/^\d+\s*(?:gallon|inch|″|")/i.test(label) ? "" : /^(?:[aeiou]|8\b|11\b|18\b)/i.test(label) ? "an " : "a ";
    return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} for ${art}${label}`;
  };
  if (held) return buildHeldStand(prompt, held, titleFor(held.label));
  // A named product with a listing or usual-family size keeps that envelope.
  if (!hasProductDrawing(phrase)) return null;
  const item = modeledProduct(phrase);
  if (!item?.shape) return null;
  const round = ["bottle", "can", "jar", "tank", "cup", "bucket", "roll", "ball"].includes(item.shape);
  const dia = item.dims.diameter ?? item.dims.width ?? 4;
  const w = round ? dia : (item.dims.length ?? 8);
  const d = round ? dia : (item.dims.width ?? 4);
  const h = round ? (item.dims.length ?? 8) : (item.dims.height ?? 4);
  const holdsWater = ["bottle", "can", "jar", "cup", "bucket"].includes(item.shape) || /cooler/.test(phrase);
  const pounds = Math.max(2, Math.round(((w * d * h) / 1728) * 30));
  const raw = prompt.slice(lower.indexOf(phrase), lower.indexOf(phrase) + phrase.length) || phrase;
  const product: HeldObject = {
    label: raw,
    width: w,
    depth: d,
    height: h,
    pounds,
    water: holdsWater,
    count: 1,
    standHeight: 24,
    note: item.notes || `${item.name} at its usual size.`,
    item,
  };
  return buildHeldStand(prompt, product, titleFor(raw));
}

/** A named product is the piece, not a carcase that happens to mention a bottle. */
function placeNamedProduct(prompt: string): YardProject | null {
  if (!isBareProductPrompt(prompt)) return null;
  // A subject the build path has a block for (a figure stance, a weekend family) builds from stock,
  // unless it is a listed spec product (Dasani, CamelBak…).
  if (!isSpecProduct(prompt)) {
    const a = classifyAnatomy(prompt);
    if ((a.anatomy === "figure" && a.kind === "figure") || detectWeekendFamily(prompt.toLowerCase())) return null;
  }
  const item = modeledProduct(prompt);
  if (!item?.shape) return null;
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
    /** A pocket whose hole or share was edited on the bench: rebuild that hole, in the chosen stock. */
    pocketOverride?: import("./types").PocketSpec;
    honorUnit?: boolean;
    noCompose?: boolean;
  } = {},
): YardProject {
  prompt = normalizeUserPrompt(prompt);
  if (opts.pocketOverride) {
    return finishHouse(enforceHonesty(buildPocket(opts.pocketOverride, prompt)), prompt, false, materialOverride);
  }
  if (!opts.noCompose && !opts.fittedOverride && !formOverride) {
    const composed = composeProducts(prompt, (clause) =>
      generateRaw(clause, materialOverride, undefined, { ...opts, noCompose: true }),
    );
    if (composed) return composed;
  }
  const lower = prompt.toLowerCase().trim();
  // A human climb (step stool, kitchen steps, library/loft ladder) is one panel model with real treads
  // at the typed height. A craft or toy stock pick stays on its craft path.
  {
    const climb = climbKind(prompt);
    const ask = climb ? requestedStock(prompt, materialOverride) : null;
    // Leaning ladders stay parked on their old path until the step writer reads sloped stringer blanks.
    if (climb === "stool" && (!ask || carcaseKind(ask) || /^(?:lumber|plywood)-/.test(ask.id))) {
      return withTypedBoardStock(buildClimb(prompt, climb, opts.sizeOverride), prompt, materialOverride);
    }
  }
  // A deck, garden gate or swing set builds at real scale in lumber; craft stock or a model word keeps the stick model.
  if (!formOverride && !opts.fittedOverride) {
    const frame = outdoorFrameKind(prompt, materialOverride);
    if (frame) return buildOutdoorFrame(prompt, frame, opts.sizeOverride);
  }
  // Head noun last: "dog ramp for the couch" is a ramp, "cat scratching post" a post — never the animal.
  // An animal word before a furniture head ("bunny hutch") makes it the animal's enclosure.
  if (!formOverride && !opts.fittedOverride && isPetEnclosure(lower)) return withTypedBoardStock(buildPetEnclosure(prompt, opts.sizeOverride), prompt, materialOverride);
  if (!formOverride && !opts.fittedOverride && !opts.sizeOverride) {
    if (isAccessRamp(lower)) return withTypedBoardStock(buildAccessRamp(prompt), prompt, materialOverride);
    if (isScratchingPost(lower)) return withTypedBoardStock(buildScratchingPost(prompt), prompt, materialOverride);
  }
  // A known build class (cat tree, any animal, robot, figure, frame, catapult…) beats owned-board and
  // named-product routing. A material plus a size is never a product.
  const buildClass = namedBuildClass(prompt);
  const owned = buildClass ? null : placeOwnedBoard(prompt);
  if (owned && !formOverride) return owned;
  // Stock, a count and a length with no subject is a cut order: build the pieces, not a creature.
  const cut = buildClass || formOverride ? null : placeCutOrder(prompt);
  if (cut) return cut;
  const placed = buildClass ? null : placeNamedProduct(prompt);
  if (placed && !formOverride) return placed;
  const held = placeHeldProduct(prompt);
  if (held && !formOverride) return held;
  // A spoken tier count on a plant stand builds N stepped tiers in lumber, not a single craft riser.
  // A craft stock pick (popsicle, dowel…) stays craft.
  if (!formOverride && !opts.fittedOverride) {
    const tiers = plantStandTiers(lower);
    const ask = tiers ? requestedStock(prompt, materialOverride) : null;
    if (tiers && (!ask || carcaseKind(ask) || /^lumber-/.test(ask.id))) return buildTieredPlantStand(prompt, tiers);
  }
  const size = parseSize(lower);
  const kindHint = detectStructure(lower);
  const scale = opts.scale ?? "full";
  const grain = scale === "weekend" ? 1.85 : 1;

  // A subject the shared parts blocks build (neck, wheels, tube, perched body, figure, towers) owns its build.
  if (!formOverride && !opts.fittedOverride) {
    const blocked = buildBlocksProject(prompt, buildStock(prompt, materialOverride), opts);
    if (blocked) return blocked;
  }
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

  if (wantsJobFurniture(prompt, materialOverride)) return buildJobFurniture(prompt);
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
  // A sheet is faces of the typed envelope unless the form is a figure. The bought id stays the sheet.
  const members = memberView(item);
  const formName = stickFurnitureName(prompt, recipe.name);

  // Class anatomy fallback: a pet bed is a low box, a cardboard figure is folded boxes — never a stick lattice.
  const anatomy = formOverride ? null : classAnatomy(prompt, item, kind);
  if (anatomy === "pet-bed") return enforceWeekendHonesty(withWireNote(attachFunction(buildPetBed(prompt, item)), item));
  if (anatomy === "box-figure") return enforceWeekendHonesty(withWireNote(attachFunction(buildBoxFigure(prompt, item, box, recipe.name)), item));
  // An upright figure (robot, person) with no stock typed and only the generic mapped form: the class picks
  // folded cardboard boxes, the easy honest default, and the plan says how to change it.
  const noStockTyped = !materialOverride && isWireStock(detectMaterial(prompt)) && !/\bwire\b/i.test(prompt);
  const cardboard = getCatalogItem("cardboard-corrugated-sheet");
  if (!formOverride && !anatomy && noStockTyped && cardboard && kind === "figure" && /^(?:Robot|Figure)$/.test(recipe.name) && recipe.notes.some((n) => /stock mapped onto the form/.test(n))) {
    const built = buildBoxFigure(prompt, cardboard, box, recipe.name);
    const note = "No material typed, so this builds from cardboard boxes, the easy default. Type a material (plywood, popsicle sticks) to change it.";
    return enforceWeekendHonesty(withWireNote(attachFunction({ ...built, notes: [...built.notes, note] }), cardboard));
  }
  if (wantsUnmatchedSheetShell(item, kind, recipe.notes.some((n) => /stock mapped onto the form/.test(n)) || recipe.ops.length > 1, recipe.notes)) {
    return enforceWeekendHonesty(withWireNote(attachFunction(buildTypedSheetShell(prompt, item, box, recipe.name, !!recipe.unmatched)), item));
  }
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
  const done = finalize(
    attachFunction(
      projectFromGraph(prompt, members.cut, kind, built.graph, !!recipe.historic, built.offer, opts.joinMethod, formName, whole, members.section),
    ),
    item,
    box,
    scale,
    members,
  );
  // An unmatched noun builds a body along its length; it does not claim a class it never matched.
  return recipe.unmatched ? { ...done, kind: "custom", unmatched: true } : done;
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
      primaryMaterialId: built.stockId ?? item.id,
      joinMethod: item.category === "cardboard" || built.params?.glueOnly ? "glue" : "screw",
      notes: [],
      assumptions: { load: "light", units: "inches", installMode: "freestanding", wallType: "wood_stud", use: "display" },
    };
  }
  // The overall is the model's own extent: each stick's ends plus its real section (face width across,
  // thickness along the face normal), so the size, the notes and the model are one number.
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const prim = toPrimitive(item);
  const roundStock = item.formFactor === "dowel" || item.formFactor === "tube" || item.formFactor === "pipe";
  for (const i of project.instances) {
    if (!i.from || !i.to) continue;
    const fw = Math.max(i.section?.width ?? prim.width, 0.1);
    const ft = Math.max(i.section?.height ?? (roundStock ? prim.width : prim.height), 0.05);
    const d = [i.to.x - i.from.x, i.to.y - i.from.y, i.to.z - i.from.z];
    const dl = Math.hypot(d[0], d[1], d[2]) || 1;
    const u = d.map((c) => c / dl);
    const n = i.face ? [i.face.x, i.face.y, i.face.z] : null;
    const across = n ? [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]] : null;
    const half = [0, 1, 2].map((k) =>
      n && across && Math.hypot(...across) > 0.5
        ? (Math.abs(across[k]) * fw + Math.abs(n[k]) * ft) / 2
        : (Math.sqrt(Math.max(0, 1 - u[k] * u[k])) * Math.max(fw, ft)) / 2,
    );
    for (const q of [i.from, i.to]) {
      xs.push(q.x - half[0], q.x + half[0]);
      ys.push(q.y - half[1], q.y + half[1]);
      zs.push(q.z - half[2], q.z + half[2]);
    }
  }
  for (const p of project.panels) {
    xs.push(p.position.x, p.position.x + p.size.width);
    ys.push(p.position.y, p.position.y + p.size.height);
    zs.push(p.position.z, p.position.z + p.size.depth);
  }
  const r16 = (n: number) => Math.round(n * 16) / 16;
  const overall = {
    width: r16(Math.max(...xs) - Math.min(...xs)),
    height: r16(Math.max(...ys) - Math.min(0, ...ys)),
    depth: r16(Math.max(...zs) - Math.min(...zs)),
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
    ...(built.sized ? { sizedByBuilder: true } : {}),
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

/**
 * Parts-block build: exact pieces (a disc is a disc, a strip its own width), mixed stocks per piece
 * (axles, wood balls, closet rod), and sheet cutouts as panels. Box figures in thin stock stay humanoid.
 */
function buildBlocksProject(
  prompt: string,
  item: CatalogItem,
  opts: { joinMethod?: JoinMethod; sizeOverride?: { width: number; height: number; depth: number } },
): YardProject | null {
  const subject = detectBlockSubject(prompt);
  if (!subject) return null;
  if (subject.figure === "box" && blockKit(item).kind !== "lumber") return null;
  const built = buildBlocks(prompt, item, shapeTyped(stripStockSizes(prompt), opts.sizeOverride));
  if (!built) return null;
  const stockItem = getCatalogItem(built.stockId) ?? item;
  const instances: YardInstance[] = built.pieces.map((p) => {
    const it = getCatalogItem(p.stock);
    const cyl = !p.section && !!it && (it.formFactor === "dowel" || it.formFactor === "tube" || it.formFactor === "pipe");
    const rot = rotationForDirection(p.a, p.b, cyl);
    return {
      id: createId("i"),
      catalogId: p.stock,
      position: { x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2, z: (p.a.z + p.b.z) / 2 },
      rotation: { x: rot[0], y: rot[1], z: rot[2] },
      ...(p.cut != null ? { cutLength: p.cut } : {}),
      role: p.role,
      join: stockItem.preferredJoins?.[0] ?? "glue",
      from: p.a,
      to: p.b,
      ...(p.face ? { face: p.face } : {}),
      ...(p.section ? { section: p.section } : {}),
      ...(p.round ? { round: p.round } : {}),
    };
  });
  const stats = analyzePieces(instances, stockItem, { full: true });
  const joinMethod = opts.joinMethod ?? (stockItem.category === "cardboard" ? "glue" : stockItem.preferredJoins?.[0]);
  let project: YardProject = instances.length
    ? toProject(prompt, stockItem, built.kind, instances, [], false, { buildStats: stats, joinMethod, name: built.label })
    : {
        ...emptyProject(),
        name: built.label,
        prompt,
        kind: built.kind,
        panels: [],
        primaryMaterialId: stockItem.id,
        joinMethod: stockItem.category === "cardboard" ? "glue" : "screw",
        notes: [],
        assumptions: { load: "light", units: "inches", installMode: "freestanding", wallType: "wood_stud", use: "display" },
      };
  if (built.panels.length) project = { ...project, panels: [...project.panels, ...built.panels] };
  const bb = pieceBounds(built);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const counts = new Map<string, number>();
  for (const i of project.instances) if (i.role) counts.set(i.role, (counts.get(i.role) ?? 0) + 1);
  for (const p of project.panels) counts.set(p.name.toLowerCase(), (counts.get(p.name.toLowerCase()) ?? 0) + 1);
  const connected = stats.components <= 1 && stats.loose === 0;
  project = {
    ...project,
    name: built.label,
    primaryMaterialId: stockItem.id,
    overall: { width: r1(bb.max.x - bb.min.x), height: r1(bb.max.y), depth: r1(bb.max.z - bb.min.z) },
    shape: {
      classId: "blocks",
      subject: built.subject.subject,
      pose: "stand",
      bodyLength: 0,
      parts: [...counts].map(([name, count]) => ({ name: name as never, count })),
      params: { ...built.params, blocks: built.subject.blocks.join("+") as never },
    },
    notes: [
      ...built.notes,
      ...(instances.length ? [connected ? `Connected structure · ${stats.joints} joints · every piece meets another` : `Joined in ${stats.components} clusters — glue each cluster to the next where they touch.`] : []),
    ],
  };
  return enforceWeekendHonesty(withWireNote(project, stockItem));
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
    // A ridden rocker's handle bar is its own stock (a rounded 2x2), so Buy and the bench show it.
    if (project.instances.some((i) => i.role === "handle") && getCatalogItem(RIDE_HANDLE_STOCK)) {
      const hs = getCatalogItem(RIDE_HANDLE_STOCK)!;
      project = { ...project, instances: project.instances.map((i) => (i.role === "handle" ? { ...i, catalogId: hs.id, cutLength: i.cutLength ?? Math.round(Math.hypot(i.to!.x - i.from!.x, i.to!.y - i.from!.y, i.to!.z - i.from!.z) * 8) / 8 } : i)) };
    }
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
  const sheetFigure = next.kind === "figure" && /sheet|cardboard/.test(item.id);
  if (members?.note && !sheetFigure && !next.notes.includes(members.note)) {
    next = { ...next, notes: [members.note, ...next.notes] };
  }
  if (sheetFigure && next.instances.length > 16) {
    next = {
      ...next,
      instances: next.instances.slice(0, 12),
      notes: ["A sheet figure stays a few faces, not a stack of battens.", ...next.notes.filter((n) => !/Ripped into/.test(n))],
    };
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

const CRAFT_STOCK = /popsicle|chipboard|cardboard|straw/;
const LOADED = /step stool|stool|bench|chair|climb|sit|shelf|rack|outdoor|porch|deck|planter/;
const HOLDS: Record<string, string> = {
  stool: "2x4 and 3/4 plywood",
  bench: "2x4 and 3/4 plywood",
  chair: "2x4 and 3/4 plywood",
  shelf: "3/4 plywood",
  planter: "cedar 1x and exterior screws",
};

/** Craft stock that is asked to carry a person or live outside is a display model. */
function craftDisplay(project: YardProject, prompt: string): YardProject {
  const item = getCatalogItem(project.primaryMaterialId);
  const stock = `${item?.name ?? ""} ${item?.id ?? ""} ${prompt}`.toLowerCase();
  if (!CRAFT_STOCK.test(stock) || !LOADED.test(prompt.toLowerCase())) return project;
  if ((project.notes ?? []).some((note) => note.startsWith("This is a display model"))) return project;
  const lower = prompt.toLowerCase();
  const hold = /planter|outdoor|porch/.test(lower) ? HOLDS.planter : /shelf|rack/.test(lower) ? HOLDS.shelf : HOLDS.stool;
  const holdStockId = /planter|outdoor|porch/.test(lower) ? "lumber-1x4-8" : /shelf|rack/.test(lower) ? "plywood-3-4-4x8" : "lumber-2x4-8";
  const line = `This is a display model in ${item?.name ?? "craft stock"}. A piece that holds needs ${hold}. Switch the stock to that.`;
  return { ...project, holdStockId, notes: [line, ...(project.notes ?? [])] };
}

/** A pipe birdhouse joins like pipe. Notes do not borrow stick walls or wood screws. */
function pipeHouse(project: YardProject, prompt: string): YardProject {
  if (!/birdhouse|bird house/.test(prompt.toLowerCase())) return project;
  const item = getCatalogItem(project.primaryMaterialId);
  if (!/pvc|pipe/i.test(`${item?.name ?? ""} ${item?.id ?? ""}`)) return project;
  const notes = [
    `Birdhouse in ${item?.name ?? "PVC"}. Join with solvent cement. No wood screws.`,
    ...(project.notes ?? []).filter((note) => !/popsicle|flat stick|wood screw/i.test(note)),
  ];
  return { ...project, notes };
}
