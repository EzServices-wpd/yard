import { UNIT_ITEM_NOTE } from "@/lib/yard/unitItems";
import { findRecipe, RECIPES } from "@/lib/yard/recipes";
import { recipePrompt } from "@/lib/yard/recipeIdeas";
"use client";
import { noteBuildingPrompt } from "@/components/workspace/building-prompt";

import { hintSubject, interpretPrompt, lookupRecipe } from "@/lib/ai/grok";
import { proposeRecipeFn } from "@/lib/ai/recipeBot";
import { boundPrompt } from "@/lib/yard/promptLimits";
import { lookupAndBuild, roughBlock, roughNote, timedLookup, TRY_SAMPLE } from "@/lib/yard/recipeBuild";
import { briefHousePrompt } from "@/lib/ai/houseBrief";
import { engineKeepsPrompt, routesToLearner, typedSizeComplete } from "@/lib/yard/formOwnership";
import { recipeFromAnatomy, isLockedForm, engineOwnsForm } from "@/lib/yard/form";
import { looksLikeFitted, parseBrief } from "@/lib/yard/fitted";
import { climbIdentityLabel, detectHouseFamily, identityTitleStem, isWorkbench, isPottingBench, isStandingShopTop, isPlanterBox, isOutdoorSideTable, isPorchSwingFrame, isAdirondackChair, isDoorPortal, mediaIdentityLabel, sitBenchTitleStem, tableTopShape, tableShapeTitlePrefix } from "@/lib/yard/family";
import { looksLikePocket } from "@/lib/yard/pocket";
import { useYard } from "@/lib/yard/store";
import { ignoredTypedWords } from "@/lib/yard/promptMain";
import { detectMaterial, hasExplicitStock } from "@/lib/yard/promptHelpers";
import { isBareProductPrompt } from "@/lib/yard/productModel";
import { detectWeekendMech, wantsMediaTipHold } from "@/lib/yard/weekendFamily";
import { tableSpanFromPrompt } from "@/lib/yard/voiceHonesty";
import type { FittedSpec } from "@/lib/yard/types";
import { readPromptSpec } from "@/lib/ai/readPrompt";
import { chooseBuildPrompt } from "@/lib/yard/aiReader/rewrite";
import { needsReader, READER_TIMEOUT_MS } from "@/lib/yard/aiReader/core";
import { currentTestFlags } from "@/lib/ideas/testFlags";
import { looksLikeFollowOn } from "@/lib/yard/promptHelpers";

const HOUSE_HINT =
  /closet|desk|vanity|table|prep\s*table|folding\s*table|butcher|cart|console|\btv\b|cabinet|bookcase|pantry|wardrobe|bench|media|storage|shelving|shelf|system|dresser|nightstand|bedside|sideboard|credenza|hutch|alcove|built-?in|linen|mudroom|island|drawer|rack|crate|headboard|shoe|coat|range\s*hood|\bhood\b|workbench|pegboard|tool\s*rail|lumber\s*rack|wall\s*panel|ironing|laundry\s*sorter|sorter|drying\s*rack|utility\s*shel|planter|outdoor\s*side\s*table|side\s*table/i;

function isHousePrompt(prompt: string, kind?: string, fitted?: unknown) {
  if (kind === "closet" || fitted) return true;
  const lower = prompt.toLowerCase();
  // Climb/step stools: "reach a shelf" must not house-steal into Bench after densify.
  if (climbIdentityLabel(lower)) return false;
  if (isPorchSwingFrame(lower) || isAdirondackChair(lower)) return false;
  // Launcher / media-hold weekend mechs stay craft — linen+climb step-shelf still house via family.
  const mech = detectWeekendMech(prompt);
  // Universal weekend mechs stay craft even when a house noun overlaps (ledge, ramp, plane).
  if (mech || wantsMediaTipHold(prompt)) return false;
  if (looksLikeFitted(prompt)) return true;
  return HOUSE_HINT.test(prompt);
}

/** Numbers and form the user actually said beat the house-brief few-shot. */
function mergeHouseBrief(prompt: string, parsed: FittedSpec | null, brief: FittedSpec): FittedSpec {
  const lower = prompt.toLowerCase();
  if (!parsed) {
    // Identity stems still win when local parse missed (climb/shoe/kitchen/media).
    const identity =
      identityTitleStem(lower) ||
      (brief.program === "media" ? mediaIdentityLabel(lower) || "Media console" : null);
    if (!identity) {
      // Scrub naked "Media" / "Media unit" even when no better stem is known.
      if (brief.name && /^Media(\s+unit)?(\s|\d|$)/i.test(brief.name.trim())) {
        const { width, height, depth } = brief.unit;
        return { ...brief, name: `Media console ${width}" × ${height}" × ${depth}"` };
      }
      return brief;
    }
    const { width, height, depth } = brief.unit;
    return { ...brief, name: `${identity} ${width}" × ${height}" × ${depth}"` };
  }
  const saidWide = /wide|width/.test(lower);
  const saidDeep = /deep|depth/.test(lower);
  const saidTall = /tall|high|height/.test(lower);
  const saidLong = /\blong\b|\blength\b/.test(lower);
  const promptShape = tableTopShape(lower);
  const saidRound = promptShape === "round" || (/\b(?:round|circular)\b|\bdiameter\b|\bdia\b/.test(lower) && promptShape !== "oval");
  const saidOval = promptShape === "oval";
  const saidSquare = promptShape === "square";
  const saidLegs = /\d+\s*-?\s*legs?/.test(lower);
  const saidTableSpan = Number.isFinite(tableSpanFromPrompt(prompt));
  // "70 in by 28 in" is a footprint. A third number (48x36x24) is not.
  const saidFootprintPair =
    /\d+(?:\.\d+)?\s*(?:in|inch|inches|")?\s*(?:x|by|×)\s*\d+(?:\.\d+)?/i.test(prompt) &&
    !/\d+(?:\.\d+)?\s*(?:in|inch|inches|")?\s*(?:x|by|×)\s*\d+(?:\.\d+)?\s*(?:in|inch|inches|")?\s*(?:x|by|×)\s*\d+/i.test(
      prompt,
    ) &&
    !saidWide &&
    !saidDeep &&
    !saidTall &&
    !saidLong;
  const lockFootprint = saidFootprintPair && parsed.program === "table";
  const tableShapeSaid = saidRound || saidOval || saidSquare || saidLong;

  const unit = { ...brief.unit };
  const opening = { ...brief.opening };

  if (saidWide || saidRound || saidOval || saidLong || saidSquare || saidTableSpan || lockFootprint) {
    unit.width = parsed.unit.width;
    opening.width = parsed.opening.width;
  }
  if (saidDeep || saidRound || saidOval || saidLong || saidSquare || saidTableSpan || lockFootprint) {
    unit.depth = parsed.unit.depth;
    opening.depth = parsed.opening.depth;
  }
  if (saidTall || saidOval || saidSquare || saidLong || saidTableSpan || lockFootprint) {
    unit.height = parsed.unit.height;
    opening.height = parsed.opening.height;
  }
  if (saidRound) {
    unit.shape = parsed.unit.shape ?? "round";
    unit.depth = parsed.unit.depth;
    unit.width = parsed.unit.width;
  } else if (saidOval) {
    unit.shape = "oval";
    unit.width = parsed.unit.width;
    unit.depth = parsed.unit.depth;
    unit.height = parsed.unit.height;
  } else if (saidSquare) {
    unit.shape = "square";
    unit.width = parsed.unit.width;
    unit.depth = parsed.unit.depth;
    unit.height = parsed.unit.height;
  } else if (parsed.unit.shape && !unit.shape) {
    unit.shape = parsed.unit.shape;
  }
  if (saidLegs || (parsed.program === "table" && parsed.unit.legs && !unit.legs)) {
    unit.legs = parsed.unit.legs;
  }
  if (parsed.unit.bays && !unit.bays) unit.bays = parsed.unit.bays;
  if (parsed.unit.kneeW && !unit.kneeW) unit.kneeW = parsed.unit.kneeW;
  // Spoken/typed drawer count from local parse overrides brief defaults (desk pencil, etc.).
  if (parsed.unit.drawersPerBank != null) unit.drawersPerBank = parsed.unit.drawersPerBank;
  // Spoken shelf count ("two shelves" / "one lower shelf" / "3 shelves") always wins.
  if (
    /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|single)\s+(?:(?:lower|upper|bottom|top|open|middle)\s+)?shel(?:f|ves|ving)\b/.test(
      lower,
    ) &&
    parsed.unit.shelfCount != null
  ) {
    unit.shelfCount = parsed.unit.shelfCount;
  } else if (/\blower\s+shel(?:f|ves)\b/.test(lower) && parsed.unit.shelfCount != null) {
    unit.shelfCount = parsed.unit.shelfCount;
  }

  // Bare workbench / potting bench: standing shop top — no invent knee/drawers; NO default lower shelf
  // (shelf only when the prompt types it, e.g. "with one lower shelf").
  if (isStandingShopTop(lower)) {
    if (!/knee|sit|chair/.test(lower)) unit.kneeW = undefined;
    if (!/drawer/.test(lower)) unit.drawersPerBank = undefined;
    const spokenShelf =
      /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|single)\s+(?:(?:lower|upper|bottom|top|open|middle)\s+)?shel(?:f|ves|ving)\b/.test(
        lower,
      ) || /\blower\s+shel(?:f|ves)\b/.test(lower);
    if (!spokenShelf) {
      unit.shelfCount = 0;
    }
  }

  // Door-carcase vanity: typed doors without drawers must not keep AI invent of drawer banks / knee / mirror.
  // Local parseBrief already leaves these undefined; labeled prompts still hit LLM house-brief which invents them.
  // Prefer local parsed.unit doors/drawers/knee/mirror (and W/D/H) when program is vanity.
  const vanityDoorsSaid =
    (/\bvanity\b/.test(lower) || parsed.program === "vanity") &&
    /door/.test(lower) &&
    !isDoorPortal(lower);
  if (parsed.program === "vanity") {
    unit.width = parsed.unit.width;
    unit.depth = parsed.unit.depth;
    unit.height = parsed.unit.height;
    opening.width = parsed.opening.width;
    opening.depth = parsed.opening.depth;
    opening.height = parsed.opening.height;
    if (parsed.unit.doors != null) unit.doors = parsed.unit.doors;
    if (parsed.unit.drawersPerBank != null) unit.drawersPerBank = parsed.unit.drawersPerBank;
    if (parsed.unit.kneeW != null) unit.kneeW = parsed.unit.kneeW;
    if (parsed.unit.mirror != null) unit.mirror = parsed.unit.mirror;
  }
  if (vanityDoorsSaid) {
    // Drawers only when said; knee/mirror invent always scrubbed for typed-door vanities.
    if (!/drawer/.test(lower)) unit.drawersPerBank = undefined;
    if (!/knee|sit|chair/.test(lower)) unit.kneeW = undefined;
    unit.doors = true;
    if (!/mirror/.test(lower)) unit.mirror = false;
  }

  let program = brief.program;
  if (parsed.program === "table" || parsed.program === "media" || parsed.program === "vanity") program = parsed.program;
  else if (brief.program === "storage" && parsed.program && parsed.program !== "storage") {
    program = parsed.program;
  }

  if (program === "media" && !saidTall) {
    unit.height = Math.min(unit.height, 22);
    opening.height = unit.height;
    unit.doors = false;
  }
  if (program === "table") {
    unit.doors = false;
    if (parsed.unit.shape) unit.shape = parsed.unit.shape;
    if (parsed.unit.legs) unit.legs = parsed.unit.legs;
    if (/coffee/.test(lower) && !saidTall) {
      unit.height = parsed.unit.height;
      opening.height = parsed.opening.height;
    }
  }
  if (parsed.program === "storage" || parsed.program === "bookcase") {
    program = parsed.program;
    unit.width = parsed.unit.width;
    unit.depth = parsed.unit.depth;
    unit.height = parsed.unit.height;
    opening.width = parsed.opening.width;
    opening.depth = parsed.opening.depth;
    opening.height = parsed.opening.height;
    unit.doors = parsed.unit.doors;
    if (parsed.unit.shelfCount != null) unit.shelfCount = parsed.unit.shelfCount;
    if (parsed.unit.drawersPerBank != null) unit.drawersPerBank = parsed.unit.drawersPerBank;
  } else if (
    (parsed.program === "closet" || parsed.program === "wardrobe") &&
    /closet|wardrobe|linen|system/.test(lower)
  ) {
    program = parsed.program;
    // Local parse owns unlabeled W×H for closet systems (AI few-shot used to swap 80x120).
    unit.width = parsed.unit.width;
    unit.depth = parsed.unit.depth;
    unit.height = parsed.unit.height;
    opening.width = parsed.opening.width;
    opening.depth = parsed.opening.depth;
    opening.height = parsed.opening.height;
    unit.rod = !!parsed.unit.rod;
    if (parsed.unit.doors != null) unit.doors = parsed.unit.doors;
    if (parsed.unit.bays != null) unit.bays = parsed.unit.bays;
    if (!/\d+\s*shel/.test(lower) && parsed.unit.shelfCount != null) {
      unit.shelfCount = parsed.unit.shelfCount;
    }
  }

  const identity = identityTitleStem(lower);
  // TV / media console stay positive product names — never capitalize program → naked "Media".
  const mediaLabel = program === "media" ? mediaIdentityLabel(lower) || "Media console" : null;
  const sitLabel = sitBenchTitleStem(lower);
  const label = identity
    ? identity
    : mediaLabel
    ? mediaLabel
    : /coffee/.test(lower) && /table/.test(lower)
    ? "Coffee table"
    : sitLabel
    ? sitLabel
    : /spice/.test(lower) && /rack/.test(lower)
    ? "Spice rack"
    : /wine/.test(lower) && /rack/.test(lower)
    ? "Wine rack"
    : /coat/.test(lower) && /rack/.test(lower)
    ? "Coat rack"
    : /file\s*cabinet|filing\s*cabinet|\bfiling\b/.test(lower)
      ? "File cabinet"
      : /\bchest\b/.test(lower) && !/medicine/.test(lower)
        ? "Chest"
        : /dresser/.test(lower)
          ? "Dresser"
          : /nightstand|bedside/.test(lower)
            ? "Nightstand"
            : /island/.test(lower)
          ? "Kitchen island"
          : /headboard/.test(lower)
            ? "Headboard"
            : /crate/.test(lower)
              ? "Crate"
            : /range\s*hood|\bhood\b/.test(lower)
              ? "Range hood"
            : program[0].toUpperCase() + program.slice(1);
  const shapePrefix = tableShapeTitlePrefix(
    unit.shape === "round" || unit.shape === "oval" || unit.shape === "square" ? unit.shape : null,
  );
  const name =
    unit.shape === "round"
      ? `${shapePrefix}${label} ${unit.width}" × ${unit.height}"`
      : `${shapePrefix}${label} ${unit.width}" × ${unit.height}" × ${unit.depth}"`;
  // Prefer local parseBrief table title when the prompt named a top shape / long axis.
  const tableLocalName =
    parsed.program === "table" && (tableShapeSaid || saidTableSpan || lockFootprint) && parsed.name ? parsed.name : null;
  // AI few-shot sometimes returns naked "Media" / "Media unit" — never keep that over a positive stem.
  const briefNakedMedia = !!brief.name && /^Media(\s+unit)?(\s|\d|$)/i.test(brief.name.trim());
  // AI few-shot sometimes returns naked "Bench" on a named sit (dining/hall/entry/…) — keep stem.
  const briefNakedBench =
    !!brief.name &&
    /^Bench(\s|\d|$)/i.test(brief.name.trim()) &&
    !!sitBenchTitleStem(lower);
  const keepBriefName =
    brief.name &&
    !briefNakedMedia &&
    !briefNakedBench &&
    !saidDeep &&
    !saidWide &&
    !saidRound &&
    !saidOval &&
    !saidSquare &&
    !saidLong &&
    !saidTableSpan &&
    !lockFootprint &&
    !identity &&
    !mediaLabel &&
    !(/coat/.test(lower) && /rack/.test(lower)) &&
    !(/spice/.test(lower) && /rack/.test(lower)) &&
    !(/wine/.test(lower) && /rack/.test(lower)) &&
    !sitBenchTitleStem(lower) &&
    !/dresser/.test(lower) &&
    !/nightstand|bedside/.test(lower) &&
    !(/\bchest\b/.test(lower) && !/medicine/.test(lower)) &&
    !/file\s*cabinet|filing\s*cabinet|\bfiling\b/.test(lower) &&
    !(/coffee/.test(lower) && /table/.test(lower)) &&
    !/range\s*hood|\bhood\b/.test(lower) &&
    !/crate/.test(lower);
  return {
    ...brief,
    program,
    name: keepBriefName ? brief.name : tableLocalName || name,
    opening,
    unit,
    walls: parsed.walls ?? brief.walls,
    leftClear: parsed.leftClear ?? brief.leftClear,
    rightClear: parsed.rightClear ?? brief.rightClear,
  };
}

function withDeadline<T>(p: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
    // A newer prompt aborts this run: its pending await gives up at once instead of waiting out the bound.
    if (signal) {
      onAbort = () => reject(new Error(STALE));
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
  return Promise.race([p, late]).finally(() => {
    clearTimeout(timer);
    if (signal && onAbort) signal.removeEventListener("abort", onAbort);
  });
}

/**
 * Hotfix (Critic B2 race): only the latest prompt's run may write. Every run gets a monotonically increasing id;
 * a newer prompt aborts the older run's in-flight calls, and every write after an await (house brief, learner
 * recipe, the grey 'no parts' block, hint, interpret, the 22s busy timer, the finally) first checks that its run
 * is still the latest. A slow learner lookup (up to 160s) can no longer land over the build showing now.
 */
const STALE = "stale prompt run";
let latestRun = 0;
let latestAbort: AbortController | null = null;
type PromptRun = { id: number; live: () => boolean; signal?: AbortSignal };
function startRun(): PromptRun {
  const id = ++latestRun;
  latestAbort?.abort();
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  latestAbort = ctrl;
  return { id, live: () => id === latestRun, signal: ctrl?.signal };
}
/** The id of the newest prompt run (tests and callers that write after runYardPrompt resolves). */
export function latestPromptRun(): number {
  return latestRun;
}

/** Built with the reader off (YARD_AI_READER unset), no tab asks; the server saying off (no key, cap hit) stops this tab asking. */
let readerOff = false;
/**
 * AI prompt reader (I49): only for words the regex parser cannot read, never offline/local test runs, never a
 * follow-on edit to the bench. Off, failed, capped, late or a different object → the typed words build, as today.
 */
function readerWanted(typed: string, fresh: boolean | undefined): boolean {
  if (readerOff || typeof window === "undefined" || import.meta.env.VITE_PUBLIC_AI_READER !== "on" || !needsReader(typed)) return false;
  const f = currentTestFlags();
  const bench = useYard.getState().project.prompt;
  return !f.offline && !f.local && !(!fresh && bench.trim() && looksLikeFollowOn(typed, bench));
}
async function readerPrompt(typed: string, run: PromptRun): Promise<string> {
  const r = await withDeadline(readPromptSpec({ data: { prompt: typed, test: !!currentTestFlags().test }, signal: run.signal }), READER_TIMEOUT_MS + 500, run.signal).catch(() => null);
  if (r && !r.ok && r.off) readerOff = true;
  return chooseBuildPrompt(typed, r && r.ok ? r.spec : null).buildPrompt;
}

/** Homepage ?q= and the bench prompt bar share this so house prompts never fall through to craft interpret. */
const AI = { lookupRecipe, hintSubject, interpretPrompt, briefHousePrompt, proposeRecipeFn };

type RunOpts = { fresh?: boolean; ai?: Partial<typeof AI>; boundMs?: number };

/**
 * Runs one prompt. Resolves true when this run is still the latest prompt (its build is the one on the bench),
 * false when a newer prompt superseded it; a caller that writes after it resolves must skip on false.
 */
export async function runYardPrompt(raw: string, opts: RunOpts = {}): Promise<boolean> {
  if (!boundPrompt(raw).prompt) return false;
  const run = startRun();
  await runOnce(raw, opts, run);
  return run.live();
}

async function runOnce(raw: string, opts: RunOpts, run: PromptRun) {
  noteBuildingPrompt(raw);
  // Sizes and length bounded before any geometry: "bookshelf 9999 wide" or a pasted essay never freezes the tab.
  const bounded = boundPrompt(raw);
  const typed = bounded.prompt;
  const { lookupRecipe, hintSubject, interpretPrompt, briefHousePrompt, proposeRecipeFn } = { ...AI, ...opts.ai };
  if (!typed) return;
  let prompt = typed;
  if (readerWanted(typed, opts.fresh)) {
    prompt = await readerPrompt(typed, run);
    if (!run.live()) return;
  }

  const generate = useYard.getState().generate;
  const makePlan = useYard.getState().makePlan;
  const revealBench = useYard.getState().revealBench;

  const weekendMech = detectWeekendMech(prompt);
  const tipHold = wantsMediaTipHold(prompt);
  const parsed =
    weekendMech || tipHold
      ? null
      : parseBrief(prompt);
  // The bar builds exactly what the engine builds from the typed words: generateFromPrompt reads the
  // fitted brief itself when the prompt is a carcase, so a pre-parsed brief would only steal real classes.
  generate(prompt, undefined, undefined, { fresh: opts.fresh });
  // The bar keeps showing the words typed, never the reader's rewrite (I35).
  if (prompt !== typed) useYard.getState().setProject({ ...useYard.getState().project, typedPrompt: typed });
  if (bounded.note) {
    const p = useYard.getState().project;
    useYard.getState().setProject({ ...p, notes: [bounded.note, ...p.notes] });
  }

  const next = useYard.getState().project;
  // A noun the engine does not own goes to the learner, from every entry point (bar, ?q=, share link, idea):
  // while it learns, and if it fails, the bench shows the display-only block, never the engine's guess
  // (a stick cloud or thin frame with a price and piece count).
  const half = ignoredTypedWords(next, prompt).length > 0;
  // F47: a unit item (one clip, a clip chain, a washer tower) is built from the unit table, never learned.
  const unitItem = (next.notes ?? []).some((n) => n.startsWith(UNIT_ITEM_NOTE));
  // L1 + hotfix #41: an engine-owned shape always wins; the learner runs only when the engine has no form.
  const learn0 = !unitItem && !engineKeepsPrompt(prompt, next, half) && routesToLearner(prompt, next, half) && !looksLikePocket(prompt);
  // A bare starter noun whose recipe needs a modifier ("sandbox", recipe "sandbox with seat") builds that
  // starter instead of going to the learner, but only when the engine has nothing of its own for it.
  const bare = learn0 ? RECIPES.recipes.find((r) => !r.learned && r.modifiers?.length && r.key.replace(/-/g, " ") === prompt.toLowerCase()) : undefined;
  if (bare) {
    generate(recipePrompt(bare), undefined, undefined, { fresh: opts.fresh });
    makePlan();
    revealBench();
    return;
  }
  const learn = learn0;
  const block = (why?: string[]) => {
    const b = roughBlock(prompt, next);
    return { ...b, notes: [roughNote(b.name, why ?? []), ...(b.notes ?? [])] };
  };
  if (learn) useYard.getState().setProject({ ...roughBlock(prompt, next), notes: [`Yard is learning the ${prompt.toLowerCase()}: the real parts come next.`] });
  // Trapezoid / "pocket vanity" chip: parsePocket already filled the measured bathroom.
  const wonky =
    !!next.pocket ||
    looksLikePocket(prompt) ||
    (parsed?.walls != null &&
      ((parsed.walls.leftAngleDeg ?? 0) > 0.2 || (parsed.walls.rightAngleDeg ?? 0) > 0.2));
  // The house brief refines a carcase (or a build the engine did not own); never a dedicated builder's form.
  // A compound noun the engine only half-read (lap desk, chicken tractor) is never a house brief or a fitted build.
  const weak = half;
  const houseLike =
    !weak &&
    isHousePrompt(prompt, next.kind, next.fitted) && (next.kind === "closet" || !!next.fitted || !engineOwnsForm(prompt, next));
  const skipLlm =
    // C10: a house prompt with every size typed (the linen canary) keeps the engine's build and price: the brief
    // could only re-guess typed sizes and reprice the plan ($183.70 → ~$202.67) after an ~11s lamp.
    (houseLike && typedSizeComplete(parsed)) ||
    next.kind === "opening" || isLockedForm(next.kind) || !!next.flat || wonky || isBareProductPrompt(prompt) ||
    // A saved recipe is the whole answer: no hint or interpret calls that could only reshape it.
    !!findRecipe(prompt) ||
    // Cost leak: an engine-owned shape (Big Ben, trebuchet, submarine) is locked, so the hint (Wikidata/Wikipedia)
    // and interpret (Wikidata/Wikipedia + xAI chat) server calls could never change it. Skip them.
    engineKeepsPrompt(prompt, next, half);
  if (skipLlm && !learn) {
    revealBench();
    makePlan();
    return;
  }

  makePlan();

  const offline =
    typeof window !== "undefined" &&
    /(?:^|[?&])(?:local|offline)=1/.test(window.location.search);
  if (offline) {
    if (learn) useYard.getState().setProject(block());
    revealBench();
    return;
  }

  useYard.getState().beginBuild();
  useYard.setState({ grokBusy: true });
  const timeout = window.setTimeout(() => {
    // A superseded run's timer must not clear the newer run's busy state or reveal over it.
    if (!run.live()) return;
    useYard.setState({ grokBusy: false });
    revealBench();
  }, 22000);
  const signal = run.signal;

  try {
    if (houseLike && !learn) {
      const house = await withDeadline(briefHousePrompt({ data: { prompt }, signal }), 30_000, signal);
      if (!run.live()) return;
      if (house.ok && house.brief) {
        generate(prompt, undefined, undefined, {
          fresh: true,
          fittedOverride: mergeHouseBrief(prompt, parsed, house.brief as FittedSpec),
        });
        makePlan();
        const current = useYard.getState().project;
        const note = "Brief refined from house training set.";
        if (!current.notes.includes(note)) {
          useYard.getState().setProject({ ...current, notes: [...current.notes, note] });
        }
      }
      return;
    }

    const namedStock = hasExplicitStock(prompt) ? detectMaterial(prompt).id : undefined;
    // Spec 001: a noun nothing owns gets a structured recipe (lookup plus one retry, cached in memory on
    // a pass). A pass rebuilds through the engine; two failures label the engine's build a rough shape.
    if (learn) {
      let lookupId: string | undefined;
      const lookup = timedLookup(async (feedback) => {
        // A superseded run never spends a (retry) lookup call.
        if (!run.live()) throw new Error(STALE);
        const r = await lookupRecipe({ data: { prompt, feedback }, signal });
        if (r.ok && "lookupId" in r) lookupId = r.lookupId as string;
        return r;
      });
      // A compound noun never falls back to its last word's build: the rough shape is a plain labelled block.
      const engine = () => roughBlock(prompt, next);
      // Two tries at 75s each, one bound on the whole lookup so the bench never waits on it.
      const out = await withDeadline(lookupAndBuild(prompt, lookup, engine, namedStock), opts.boundMs ?? 160_000, signal).catch(
        () => ({ project: block(["the lookup ran out of time"]), recipe: null, rough: true }) as const,
      );
      // The learner's recipe, rough shape and grey 'no parts' block only land for the latest prompt.
      if (!run.live()) return;
      if (!out.recipe && !out.rough) {
        useYard.getState().setProject(out.unavailable ? { ...roughBlock(prompt, next), notes: [TRY_SAMPLE] } : block([]));
        makePlan();
        return;
      }
      if (out.recipe) {
        // Propose it for the committed store; quiet when the bot has no token.
        if (lookupId) void proposeRecipeFn({ data: { lookupId } })
          .then((r) => console.info(`[recipe-bot] ${r.status}`))
          .catch((e) => console.warn(`[recipe-bot] call failed: ${(e as Error).message}`));
        generate(prompt, namedStock, undefined, { fresh: true });
        makePlan();
        return;
      }
      if (out.rough) {
        useYard.getState().setProject(out.project);
        makePlan();
        return;
      }
    }
    // Every AI call is bounded: a slow hint or interpret reply never holds the Building overlay over a finished bench.
    const hint = await withDeadline(hintSubject({ data: { prompt }, signal }), opts.boundMs ?? 20_000, signal);
    if (!run.live()) return;
    const bound = engineOwnsForm(prompt, useYard.getState().project);
    if (
      !bound &&
      hint.summary &&
      hint.summary !== hint.subject &&
      !wantsMediaTipHold(prompt) &&
      !detectWeekendMech(prompt)
    ) {
      // The lookup steers the anatomy class; the title stays the maker's typed words.
      const form = recipeFromAnatomy(`${prompt} ${hint.summary}`, next.overall, prompt);
      generate(prompt, namedStock, form);
      makePlan();
      const current = useYard.getState().project;
      const note = `Looked up: ${hint.summary}`;
      if (!current.notes.includes(note)) {
        useYard.getState().setProject({ ...current, notes: [...current.notes, note] });
      }
    }
    const interp = await withDeadline(interpretPrompt({
      data: { prompt, heightIn: next.overall.height, widthIn: next.overall.width },
      signal,
    }), opts.boundMs ?? 20_000, signal);
    if (!run.live()) return;
    const after = useYard.getState().project;
    const locked =
      // Tip-angled media-hold anatomy is deterministic — LLM form must not wipe lean+lip.
      wantsMediaTipHold(prompt) ||
      !!detectWeekendMech(prompt) ||
      bound ||
      engineOwnsForm(prompt, after);
    // Named stock from the prompt binds like CatalogPanel. Unnamed stays wire-frame —
    // LLM must not silently pick popsicle.
    if (interp.ok && interp.form && !locked) {
      generate(prompt, namedStock, interp.form);
      makePlan();
    } else if (
      interp.ok &&
      namedStock &&
      namedStock !== after.primaryMaterialId &&
      !locked
    ) {
      generate(prompt, namedStock);
      makePlan();
    }
    if (interp.ok && (interp.real || interp.notes)) {
      const current = useYard.getState().project;
      const extra = [interp.real ? `Queried form: ${interp.real}` : "", interp.notes ?? ""].filter(
        (n): n is string => n.length > 0,
      );
      useYard.getState().setProject({
        ...current,
        notes: [...current.notes, ...extra.filter((n) => !current.notes.includes(n))],
      });
    }
  } catch {
    // Deterministic already on the bench, except a half-read compound noun, which shows its labelled block.
    if (weak && run.live()) {
      const block = roughBlock(prompt, next);
      useYard.getState().setProject({ ...block, notes: [roughNote(block.name, [])] });
      makePlan();
    }
  } finally {
    window.clearTimeout(timeout);
    if (run.live()) {
      useYard.setState({ grokBusy: false });
      revealBench();
    }
  }
}
