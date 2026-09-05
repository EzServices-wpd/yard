"use client";

import { hintSubject, interpretPrompt } from "@/lib/ai/grok";
import { briefHousePrompt } from "@/lib/ai/houseBrief";
import { recipeFromAnatomy, isLockedForm } from "@/lib/yard/form";
import { looksLikeFitted, parseBrief } from "@/lib/yard/fitted";
import { climbIdentityLabel, detectHouseFamily, identityTitleStem } from "@/lib/yard/family";
import { looksLikePocket } from "@/lib/yard/pocket";
import { useYard } from "@/lib/yard/store";
import { detectMaterial, hasExplicitStock } from "@/lib/yard/promptHelpers";
import { detectWeekendMech } from "@/lib/yard/weekendFamily";
import type { FittedSpec } from "@/lib/yard/types";

const HOUSE_HINT =
  /closet|desk|vanity|table|console|\btv\b|cabinet|bookcase|pantry|wardrobe|bench|media|storage|shelf|system|dresser|nightstand|bedside|sideboard|credenza|hutch|alcove|built-?in|linen|mudroom|island|drawer|rack|crate|headboard|shoe|coat|range\s*hood|\bhood\b/i;

function isHousePrompt(prompt: string, kind?: string, fitted?: unknown) {
  if (kind === "closet" || fitted) return true;
  const lower = prompt.toLowerCase();
  // Climb/step stools: "reach a shelf" must not house-steal into Bench after densify.
  if (climbIdentityLabel(lower)) return false;
  // Launcher / media-hold weekend mechs stay craft — linen+climb step-shelf still house via family.
  const mech = detectWeekendMech(prompt);
  if (mech && !looksLikeFitted(prompt) && !detectHouseFamily(prompt)) return false;
  if (looksLikeFitted(prompt)) return true;
  return HOUSE_HINT.test(prompt);
}

/** Numbers and form the user actually said beat the house-brief few-shot. */
function mergeHouseBrief(prompt: string, parsed: FittedSpec | null, brief: FittedSpec): FittedSpec {
  const lower = prompt.toLowerCase();
  if (!parsed) {
    // Identity stems still win when local parse missed (climb/shoe/kitchen).
    const identity = identityTitleStem(lower);
    if (!identity) return brief;
    const { width, height, depth } = brief.unit;
    return { ...brief, name: `${identity} ${width}" × ${height}" × ${depth}"` };
  }
  const saidWide = /wide|width/.test(lower);
  const saidDeep = /deep|depth/.test(lower);
  const saidTall = /tall|high|height/.test(lower);
  const saidRound = /round|circular|diameter|\bdia\b/.test(lower);
  const saidLegs = /\d+\s*-?\s*legs?/.test(lower);

  const unit = { ...brief.unit };
  const opening = { ...brief.opening };

  if (saidWide || saidRound) {
    unit.width = parsed.unit.width;
    opening.width = parsed.opening.width;
  }
  if (saidDeep || saidRound) {
    unit.depth = parsed.unit.depth;
    opening.depth = parsed.opening.depth;
  }
  if (saidTall) {
    unit.height = parsed.unit.height;
    opening.height = parsed.opening.height;
  }
  if (saidRound) {
    unit.shape = parsed.unit.shape ?? "round";
    unit.depth = parsed.unit.depth;
    unit.width = parsed.unit.width;
  } else if (parsed.unit.shape && !unit.shape) {
    unit.shape = parsed.unit.shape;
  }
  if (saidLegs || (parsed.program === "table" && parsed.unit.legs && !unit.legs)) {
    unit.legs = parsed.unit.legs;
  }
  if (parsed.unit.bays && !unit.bays) unit.bays = parsed.unit.bays;
  if (parsed.unit.kneeW && !unit.kneeW) unit.kneeW = parsed.unit.kneeW;

  let program = brief.program;
  if (parsed.program === "table" || parsed.program === "media") program = parsed.program;
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
  const label = identity
    ? identity
    : /coffee/.test(lower) && /table/.test(lower)
    ? "Coffee table"
    : /mudroom/.test(lower) && /bench/.test(lower)
    ? "Mudroom bench"
    : /spice/.test(lower) && /rack/.test(lower)
    ? "Spice rack"
    : /wine/.test(lower) && /rack/.test(lower)
    ? "Wine rack"
    : /coat/.test(lower) && /rack/.test(lower)
    ? "Coat rack"
    : /dresser/.test(lower)
      ? "Dresser"
      : /nightstand|bedside/.test(lower)
        ? "Nightstand"
        : /island/.test(lower)
          ? "Island"
          : /headboard/.test(lower)
            ? "Headboard"
            : /crate/.test(lower)
              ? "Crate"
            : /range\s*hood|\bhood\b/.test(lower)
              ? "Range hood"
            : program[0].toUpperCase() + program.slice(1);
  const name = `${label} ${unit.width}" × ${unit.height}" × ${unit.depth}"`;
  const keepBriefName =
    brief.name &&
    !saidDeep &&
    !saidWide &&
    !saidRound &&
    !identity &&
    !(/coat/.test(lower) && /rack/.test(lower)) &&
    !(/spice/.test(lower) && /rack/.test(lower)) &&
    !(/wine/.test(lower) && /rack/.test(lower)) &&
    !(/mudroom/.test(lower) && /bench/.test(lower)) &&
    !/dresser/.test(lower) &&
    !/nightstand|bedside/.test(lower) &&
    !(/coffee/.test(lower) && /table/.test(lower)) &&
    !/range\s*hood|\bhood\b/.test(lower) &&
    !/crate/.test(lower);
  return {
    ...brief,
    program,
    name: keepBriefName ? brief.name : name,
    opening,
    unit,
    walls: parsed.walls ?? brief.walls,
    leftClear: parsed.leftClear ?? brief.leftClear,
    rightClear: parsed.rightClear ?? brief.rightClear,
  };
}

/** Homepage ?q= and the bench prompt bar share this so house prompts never fall through to craft interpret. */
export async function runYardPrompt(raw: string, opts: { fresh?: boolean } = {}) {
  const prompt = raw.trim();
  if (!prompt) return;

  const generate = useYard.getState().generate;
  const makePlan = useYard.getState().makePlan;
  const revealBench = useYard.getState().revealBench;

  const parsed = parseBrief(prompt);
  generate(prompt, undefined, undefined, {
    fresh: opts.fresh,
    fittedOverride: parsed ?? undefined,
  });

  const next = useYard.getState().project;
  // Trapezoid / "pocket vanity" chip: parsePocket already filled the measured bathroom.
  const wonky =
    !!next.pocket ||
    looksLikePocket(prompt) ||
    (parsed?.walls != null &&
      ((parsed.walls.leftAngleDeg ?? 0) > 0.2 || (parsed.walls.rightAngleDeg ?? 0) > 0.2));
  const skipLlm =
    next.kind === "opening" || isLockedForm(next.kind) || !!next.flat || wonky;
  if (skipLlm) {
    revealBench();
    makePlan();
    return;
  }

  makePlan();

  const offline =
    typeof window !== "undefined" &&
    /(?:^|[?&])(?:local|offline)=1/.test(window.location.search);
  if (offline) {
    revealBench();
    return;
  }

  const houseLike = isHousePrompt(prompt, next.kind, next.fitted);
  useYard.setState({ grokBusy: true, grokError: null, building: true });
  const timeout = window.setTimeout(() => {
    useYard.setState({ grokBusy: false });
    revealBench();
  }, 22000);

  try {
    if (houseLike) {
      const house = await briefHousePrompt({ data: { prompt } });
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
    const hint = await hintSubject({ data: { prompt } });
    if (hint.summary && hint.summary !== hint.subject) {
      const form = recipeFromAnatomy(`${prompt} ${hint.summary}`, next.overall);
      generate(prompt, namedStock, form);
      makePlan();
      const current = useYard.getState().project;
      const note = `Looked up: ${hint.summary}`;
      if (!current.notes.includes(note)) {
        useYard.getState().setProject({ ...current, notes: [...current.notes, note] });
      }
    }
    const interp = await interpretPrompt({
      data: { prompt, heightIn: next.overall.height, widthIn: next.overall.width },
    });
    const after = useYard.getState().project;
    const locked =
      isLockedForm(after.kind) || after.kind === "closet" || after.kind === "opening" || !!after.flat;
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
      const extra = [interp.real ? `Queried form: ${interp.real}` : "", interp.notes].filter(Boolean);
      useYard.getState().setProject({
        ...current,
        notes: [...current.notes, ...extra.filter((n) => !current.notes.includes(n))],
      });
    }
  } catch {
    /* deterministic already on the bench */
  } finally {
    window.clearTimeout(timeout);
    useYard.setState({ grokBusy: false });
    revealBench();
  }
}
