/**
 * Any measured brief → a real unit, cut list, and plan.
 * Same logic as the bathroom pocket: space first, rectangular unit second,
 * program (vanity / closet / desk / …) third. Trapezoid walls if they gave them.
 */

import { createId } from "@/lib/utils";
import type {
  FittedProgram,
  FittedSpec,
  FittedUnit,
  Panel,
  PocketWalls,
  YardProject,
} from "./types";
import { buildPocket, clearancesAt, looksLikePocket, parsePocket } from "./pocket";
import { buildTable } from "./tableFitted";

const PLY = "plywood-3-4-4x8";
const P = 0.75;

function pick(text: string, re: RegExp, fallback: number) {
  const m = text.match(re);
  if (!m?.[1]) return fallback;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : fallback;
}

const CRAFT = /popsicle|craft stick|toothpick|paper towel|toilet paper|straw|dowel|pvc|lego|mailing tube/;
const MAKER = /eiffel|taj|mahal|pyramid|giraffe|rocket|looks like|lattice tower/;
const BUILDER =
  /vanity|closet|cabinet|cabinetry|desk|bookcase|bookshelf|pantry|wardrobe|built-?in|alcove|linen|mudroom|workbench|nightstand|bedside|dresser|media cons|console|\btv\b|sideboard|credenza|hutch|island|table|shelves|shelf|drawer|storage|bench seat|window seat|system|\brack\b|crate|headboard|shoe|coat|range\s*hood|kitchen\s*hood|\bhood\b/;

export function looksLikeFitted(prompt: string) {
  const lower = prompt.toLowerCase();
  if (looksLikePocket(prompt)) return true;
  if (MAKER.test(lower) && CRAFT.test(lower)) return false;
  if (CRAFT.test(lower) && !BUILDER.test(lower)) return false;
  const dimText = lower
    .replace(/\b(?:from\s+)?(?:[1-8]\s*[x×]\s*(?:2|3|4|6|8|10|12)|two by four|two by six|one by four|four by four)\b/gi, " ");
  const nums = (dimText.match(/\d+(?:\.\d+)?/g) ?? []).length;
  if (/workbench/.test(lower) && !/drawer|plywood|cabinet/.test(lower) && !/(?:wide|width|deep|depth|high|height)/.test(lower)) {
    return false;
  }
  if (/chair|stool|ladder/.test(lower) && !/vanity|desk|bookcase/.test(lower)) return false;
  if (!BUILDER.test(lower)) return false;
  if (/vanity|closet|desk|bookcase|bookshelf|pantry|wardrobe|linen|mudroom|media cons|console|\btv\b|sideboard|table|alcove|built-?in|system|nightstand|bedside|dresser|hutch|island|cabinet|shelves|shelf|storage|\brack\b|crate|headboard|shoe|coat|range\s*hood|\bhood\b/.test(lower)) {
    return true;
  }
  return nums >= 2;
}

export function detectProgram(lower: string): FittedProgram {
  if (/\bdesk\b|workbench|work table/.test(lower)) return "desk";
  if (/\bvanity\b|\bsink\b/.test(lower)) return "vanity";
  if (/bookcase|bookshelf|\bbooks\b/.test(lower)) return "bookcase";
  if (/pantry/.test(lower)) return "pantry";
  if (/wardrobe/.test(lower)) return "wardrobe";
  if (/nightstand|bedside/.test(lower)) return "storage";
  if (/\btable\b/.test(lower) && !/work table|console table/.test(lower)) return "table";
  if (/\bmedia\b|\btv\b|console|sideboard|credenza/.test(lower)) return "media";
  if (/\bmudroom\b|window seat/.test(lower)) return "bench";
  if (/\bcloset\b|linen|alcove|built-?in|closet system|storage system/.test(lower)) return "closet";
  if (/\bbench\b/.test(lower)) return "bench";
  if (/bathroom/.test(lower) && !/closet|linen|alcove/.test(lower)) return "vanity";
  return "storage";
}

function triple(text: string): { w?: number; h?: number; d?: number } {
  const m = text.match(
    /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)(?:\s*(?:in|inch|inches|")?\s*(?:x|by|×)\s*(\d+(?:\.\d+)?))?/i,
  );
  if (!m) return {};
  return { w: parseFloat(m[1]), h: parseFloat(m[2]), d: m[3] ? parseFloat(m[3]) : undefined };
}

export function parseBrief(prompt: string): FittedSpec | null {
  if (!looksLikeFitted(prompt)) return null;
  const pocket = parsePocket(prompt);
  if (pocket) {
    return {
      program: detectProgram(prompt.toLowerCase()),
      name: "Bathroom pocket vanity",
      opening: {
        width: pocket.walls.backWidth,
        height: pocket.walls.height,
        depth: Math.max(pocket.walls.leftDepth, pocket.walls.rightDepth),
        kind: "pocket",
      },
      unit: {
        width: pocket.unit.width,
        depth: pocket.unit.depth,
        height: pocket.unit.height,
        counterH: pocket.unit.vanityH,
        kneeW: pocket.unit.kneeW,
        upperStart: pocket.unit.upperStart,
        drawersPerBank: 3,
        doors: true,
        mirror: true,
        centered: true,
      },
      walls: pocket.walls,
      leftClear: pocket.leftClear,
      rightClear: pocket.rightClear,
    };
  }

  const t = prompt.replace(/×/g, "x").replace(/″/g, '"');
  const lower = t.toLowerCase();
  const program = detectProgram(lower);
  const trip = triple(t);
  const isSystem = /system|walk-?in|along the wall|wall of closets/.test(lower);
  const isRound = /round|circular|diameter|\bdia\b/.test(lower);
  const diameter = pick(t, /(?:diameter|dia\.?)\s*(?:of\s*)?(\d+(?:\.\d+)?)/i, NaN);
  const legs = Math.max(
    3,
    Math.min(4, Math.round(pick(t, /(\d+)\s*(?:-?\s*)legs?/i, program === "table" ? (isRound ? 3 : 4) : 4))),
  );

  let width = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:wide|width)/i, NaN);
  let height = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:tall|high|height)/i, NaN);
  let depth = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:deep|depth)/i, NaN);

  if (!Number.isFinite(width) && trip.w) width = trip.w;

  if (!Number.isFinite(width)) {
    const alcove = t.match(
      /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s+(?:bathroom\s+)?(?:alcove|opening|niche|closet)\b/i,
    );
    if (alcove && !(trip.w && trip.h)) width = parseFloat(alcove[1]);
  }
  if (!Number.isFinite(width) && /range\s*hood|kitchen\s*hood|extractor\s*hood|\bhood\b/.test(lower)) {
    width = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")/, 30);
  }
  if (!Number.isFinite(width)) {
    width =
      trip.w ??
      (program === "desk"
        ? 48
        : program === "vanity"
          ? 36
          : program === "table"
            ? 40
            : program === "media"
              ? 60
              : /nightstand|bedside/.test(lower)
                ? 20
                : /range\s*hood|\bhood\b/.test(lower)
                  ? 30
                : 36);
  }

  const saidAxis = /wide|width|deep|depth|tall|high|height/.test(lower);
  const furnitureTriple =
    program !== "closet" && program !== "wardrobe" && program !== "pantry" && program !== "vanity";
  let unlabeledWd = false;
  if (!saidAxis && furnitureTriple && trip.w && trip.h && trip.d) {
    width = trip.w;
    depth = trip.h;
    height = trip.d;
  } else if (!saidAxis && furnitureTriple && trip.w && trip.h && !trip.d && trip.h < 20) {
    width = trip.w;
    depth = trip.h;
    unlabeledWd = true;
  }

  if (program === "table" && (isRound || Number.isFinite(diameter))) {
    const dia = Number.isFinite(diameter)
      ? diameter
      : pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*round/i, width);
    width = dia;
    depth = dia;
    if (!Number.isFinite(height)) {
      height = trip.h && trip.h < 42 ? trip.h : /coffee/.test(lower) ? 18 : 30;
    }
  }

  if (isSystem && trip.w && trip.h && !Number.isFinite(pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:deep|depth)/i, NaN))) {
    const a = trip.w;
    const b = trip.h;
    // Both opening-sized (≥60): typed order is W×H (80x120 → 80 wide × 120 tall), not longer=width.
    if (a >= 60 && b >= 60) {
      width = a;
      height = b;
      depth = 24;
    } else {
      width = Math.max(a, b);
      const other = Math.min(a, b);
      depth = other;
      height = 84;
    }
  }

  const wantsUppers =
    program === "vanity" &&
    /upper|to the ceiling|floor.?to.?ceiling|linen storage|towels to/.test(lower);

  if (!Number.isFinite(height) || height === 0) {
    if (program === "table") {
      height = trip.h && trip.h < 42 ? trip.h : /coffee/.test(lower) ? 18 : 30;
    } else if (program === "media") {
      if (trip.h && trip.d) height = trip.h;
      else height = 22;
    } else if (program === "desk" || program === "bench") {
      height = trip.d && trip.d < 42 ? trip.d : trip.h ?? 29;
      if (trip.h && trip.h < 42 && trip.d && trip.d > 14) {
        depth = trip.h;
        height = trip.d;
      } else if (trip.h && !Number.isFinite(depth)) depth = trip.h;
    } else if (program === "vanity") {
      if (trip.h && trip.h >= 48) height = trip.h;
      else if (trip.h && trip.h < 42) {
        if (!Number.isFinite(depth)) depth = trip.h;
        height = 34;
      } else {
        height = wantsUppers ? 84 : 34;
      }
    } else if (
      (program === "closet" || program === "wardrobe" || program === "pantry") &&
      trip.h &&
      trip.h < 40 &&
      !trip.d
    ) {
      depth = trip.h;
      height = 84;
    } else {
      height =
        (unlabeledWd ? undefined : trip.h) ??
        (/headboard/.test(lower)
          ? 48
          : /dresser/.test(lower)
            ? 36
            : /nightstand|bedside/.test(lower)
              ? 24
            : /island/.test(lower)
              ? 36
              : /crate/.test(lower)
                ? 30
                : /coat/.test(lower) && /rack/.test(lower)
                  ? 6
                  : /range\s*hood|\bhood\b/.test(lower)
                    ? 24
                  : /shoe/.test(lower) && /rack/.test(lower)
                    ? 18
                    : /shelf/.test(lower)
                      ? 18
                  : program === "storage"
                    ? 30
                    : 84);
    }
  }
  if (!Number.isFinite(depth)) {
    depth =
      trip.d ??
      (program === "desk"
        ? 24
        : program === "vanity"
          ? 21
          : program === "bookcase"
            ? 12
            : program === "media"
              ? 16
              : program === "table"
                ? width
                : /headboard/.test(lower)
                  ? 4
                  : /coat/.test(lower) && /rack/.test(lower)
                    ? 8
                    : /range\s*hood|\bhood\b/.test(lower)
                      ? 18
                    : /dresser/.test(lower)
                      ? 18
                      : /crate/.test(lower)
                        ? 24
                      : /shelf|rack/.test(lower)
                        ? 12
                        : 16);
  }

  let bays: number | undefined;
  if (
    (isSystem || width >= 84) &&
    (program === "closet" || program === "wardrobe" || program === "pantry" || program === "storage")
  ) {
    bays = Math.max(2, Math.min(6, Math.round(width / 32)));
  } else if (program === "media" && width >= 48) {
    // Wide media: center divider(s) so ¾" shelves and the TV top don't span 60–70" clear.
    bays = Math.max(2, Math.min(4, Math.round(width / 28)));
  }

  const counterH = /(?:counter|work surface)[^\d]{0,18}(\d+(?:\.\d+)?)/i.test(t)
    ? pick(t, /(?:counter|work surface)[^\d]{0,18}(\d+(?:\.\d+)?)/i, program === "desk" ? height : 34)
    : program === "vanity"
      ? 34
      : program === "desk"
        ? height
        : undefined;
  const kneeW = /knee|sit|chair|open/.test(lower)
    ? pick(
        t,
        /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*knee/i,
        pick(t, /knee[^\d]{0,24}(\d+(?:\.\d+)?)/i, 24),
      )
    : program === "vanity" || program === "desk"
      ? Math.min(24, Math.max(18, width * 0.4))
      : undefined;
  const upperStart = /upper/.test(lower) ? pick(t, /upper[^\d]{0,40}(\d+(?:\.\d+)?)/i, 54) : program === "vanity" && height >= 72 ? 54 : undefined;
  const linen = /linen|towel/.test(lower);
  const rod =
    /rod|hang|rail/.test(lower) ||
    program === "wardrobe" ||
    (program === "closet" && isSystem && !linen);
  const shelfCount = pick(
    t,
    /(\d+)\s*shel(?:f|ves)/i,
    program === "bookcase"
      ? 5
      : program === "closet"
        ? rod
          ? 1
          : 4
        : program === "pantry" || program === "wardrobe"
          ? 4
          : program === "media"
            ? 2
            : /shoe/.test(lower) && /rack/.test(lower)
              ? 3
              : /crate/.test(lower)
                ? 0
                : (/shelf/.test(lower) && !/coat/.test(lower))
                ? 3
                : /nightstand|bedside/.test(lower)
                  ? 1
                  : 0,
  );
  const cubbies = pick(t, /(\d+)\s*cubb/i, NaN);
  const drawers = /drawer/.test(lower) || program === "vanity" || program === "desk" || /nightstand|bedside|dresser|hutch/.test(lower);
  const doors =
    /door/.test(lower) ||
    /crate/.test(lower) ||
    program === "closet" ||
    program === "pantry" ||
    program === "wardrobe" ||
    (program === "vanity" && height >= 54);
  const doorsFinal = program === "media" && !/door/.test(lower) ? false : doors;
  const mirror = /mirror/.test(lower) || program === "vanity";

  const walls: PocketWalls | undefined = /angle|trapezoid|centerline|back wall/.test(lower)
    ? {
        backWidth: width,
        leftDepth: depth,
        rightDepth: depth,
        height,
        leftAngleDeg: 0,
        rightAngleDeg: 0,
      }
    : undefined;

  const unit: FittedUnit = {
    width,
    depth,
    height,
    counterH,
    kneeW,
    upperStart,
    shelfCount: shelfCount || undefined,
    cubbies: Number.isFinite(cubbies) && cubbies >= 2 ? cubbies : undefined,
    drawersPerBank: drawers ? (/nightstand|bedside/.test(lower) ? 1 : 3) : undefined,
    doors: doorsFinal,
    mirror,
    rod,
    centered: true,
    legs: program === "table" ? legs : undefined,
    shape: program === "table" ? (isRound || Number.isFinite(diameter) ? "round" : "rect") : undefined,
    bays,
  };

  const names: Record<FittedProgram, string> = {
    vanity: "Vanity",
    closet: "Closet",
    pantry: "Pantry",
    wardrobe: "Wardrobe",
    desk: "Desk",
    bookcase: "Bookcase",
    media: "Media unit",
    bench: "Bench",
    storage: "Storage unit",
    table: "Table",
  };

  return {
    program,
    name: `${/coffee/.test(lower) && /table/.test(lower) ? "Coffee table" : /dresser/.test(lower) ? "Dresser" : /nightstand|bedside/.test(lower) ? "Nightstand" : /coat/.test(lower) && /rack/.test(lower) ? "Coat rack" : /shoe rack/.test(lower) ? "Shoe rack" : /headboard/.test(lower) ? "Headboard" : /crate/.test(lower) ? "Crate" : /island/.test(lower) ? "Island" : /range\s*hood|\bhood\b/.test(lower) ? "Range hood" : /floating/.test(lower) && /shel/.test(lower) ? "Shelves" : names[program]} ${width}" × ${height}" × ${depth}"`,
    opening: {
      width,
      height,
      depth,
      kind: walls ? "pocket" : /alcove|built-?in|niche/.test(lower) ? "alcove" : "room",
    },
    unit,
    walls,
    leftClear: walls ? 0 : undefined,
    rightClear: walls ? 0 : undefined,
  };
}

function panel(
  type: Panel["type"],
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): Panel {
  return {
    id: createId(type.slice(0, 2)),
    type,
    name,
    position: { x, y, z },
    size: { width: w, height: h, depth: d },
    materialId: PLY,
  };
}

export function buildFitted(spec: FittedSpec, prompt = ""): YardProject {
  if (spec.walls && (spec.walls.leftAngleDeg > 0.2 || spec.walls.rightAngleDeg > 0.2)) {
    const pocket = buildPocket(
      {
        walls: spec.walls,
        unit: {
          width: spec.unit.width,
          depth: spec.unit.depth,
          height: spec.unit.height,
          vanityH: spec.unit.counterH ?? 34,
          kneeW: spec.unit.kneeW ?? 22,
          upperStart: spec.unit.upperStart ?? 54,
        },
        leftClear: spec.leftClear ?? 0,
        rightClear: spec.rightClear ?? 0,
      },
      prompt,
    );
    return { ...pocket, fitted: spec, name: spec.name || pocket.name };
  }

  const u = spec.unit;
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  const panels: Panel[] = [];

  const nightstand = /nightstand|bedside/.test(prompt.toLowerCase());
  if (spec.program === "table" && !nightstand) {
    return buildTable(spec, prompt);
  }

  const headboard = /headboard/.test(prompt.toLowerCase());
  if (headboard) {
    const slabD = P;
    const slabH = Math.max(14, H);
    panels.push(panel("back", "Headboard", x0, 0, 0, W, slabH, slabD));
    return {
      id: createId("proj"),
      name: `Headboard ${W}" × ${slabH}" × ${slabD}"`,
      prompt,
      kind: "closet",
      overall: { width: W, height: slabH, depth: slabD },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `One ${W}" × ${slabH}" headboard from ¾" plywood. No box — it sits behind the mattress.`,
        "Hang on a french cleat or lag into studs. Guidance only.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: slabH, depth: slabD },
      fitted: { ...spec, unit: { ...u, height: slabH, depth: slabD, doors: false, shelfCount: 0, drawersPerBank: undefined }, name: `Headboard ${W}" × ${slabH}" × ${slabD}"` },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "alcove",
        wallType: "wood_stud",
      },
    };
  }

  const coatRack = /coat/.test(prompt.toLowerCase()) && /rack/.test(prompt.toLowerCase()) && !/shoe/.test(prompt.toLowerCase());
  if (coatRack) {
    const shelfD = Math.max(6, Math.min(D, 10));
    const standing = H >= 36;
    const railH = standing ? Math.max(24, H - P) : 5.5;
    panels.push(panel("back", standing ? "Back board" : "Peg rail", x0, 0, 0, W, railH, P));
    panels.push(panel("top", "Hat shelf", x0, railH, 0, W, P, shelfD));
    const stackH = railH + P;
    const hooks = Math.max(3, Math.min(8, Math.round(W / 6)));
    return {
      id: createId("proj"),
      name: `Coat rack ${W}" × ${stackH}" × ${shelfD}"`,
      prompt,
      kind: "closet",
      overall: { width: W, height: stackH, depth: shelfD },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        standing
          ? `Wall-mounted coat board: ${W}" × ${stackH}" with an ${shelfD}" hat shelf. ¾" plywood.`
          : `Wall-mounted coat rack: ${W}" peg rail with an ${shelfD}" hat shelf. ¾" plywood.`,
        `Screw ${hooks} coat hooks into the rail, about 6" on center. Hit studs.`,
        "Guidance only — not a cubby. No leftover shelves.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: stackH, depth: shelfD },
      fitted: { ...spec, unit: { ...u, height: stackH, depth: shelfD, doors: false, shelfCount: 0, drawersPerBank: undefined }, name: `Coat rack ${W}" × ${stackH}" × ${shelfD}"` },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "alcove",
        wallType: "wood_stud",
      },
    };
  }

  const hood = /range\s*hood|kitchen\s*hood|extractor\s*hood|\bhood\b/.test(prompt.toLowerCase());
  if (hood) {
    const canopyH = Math.min(12, Math.max(8, Math.round(H * 0.5 * 8) / 8));
    const chimneyH = Math.max(0, H - canopyH);
    const chimneyW = Math.min(W, Math.max(10, Math.round(W * 0.4)));
    const chimneyD = Math.min(D, Math.max(8, Math.round(D * 0.55)));
    const cx = x0 + (W - chimneyW) / 2;
    panels.push(panel("upright", "Left side", x0, 0, 0, P, canopyH, D));
    panels.push(panel("upright", "Right side", x0 + W - P, 0, 0, P, canopyH, D));
    panels.push(panel("back", "Back", x0 + P, 0, 0, W - P * 2, canopyH, P));
    panels.push(panel("rail", "Front apron", x0 + P, 0, D - P, W - P * 2, canopyH, P));
    panels.push(panel("top", "Canopy top", x0 + P, canopyH - P, 0, W - P * 2, P, D));
    if (chimneyH >= 4) {
      panels.push(panel("upright", "Chimney left", cx, canopyH, 0, P, chimneyH, chimneyD));
      panels.push(panel("upright", "Chimney right", cx + chimneyW - P, canopyH, 0, P, chimneyH, chimneyD));
      panels.push(panel("back", "Chimney back", cx + P, canopyH, 0, chimneyW - P * 2, chimneyH, P));
      panels.push(panel("rail", "Chimney front", cx + P, canopyH, chimneyD - P, chimneyW - P * 2, chimneyH, P));
      panels.push(panel("top", "Chimney top", cx + P, canopyH + chimneyH - P, 0, chimneyW - P * 2, P, chimneyD));
    }
    const stackH = canopyH + (chimneyH >= 4 ? chimneyH : 0);
    const name = `Range hood ${W}" × ${stackH}" × ${D}"`;
    return {
      id: createId("proj"),
      name,
      prompt,
      kind: "closet",
      overall: { width: W, height: stackH, depth: D },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `${name}. Wall-mounted plywood canopy, open on the bottom, over the cooktop. ¾" plywood.`,
        chimneyH >= 4
          ? `A ${canopyH}" canopy with a ${chimneyH}" chimney against the wall. Open bottom. Not a closet.`
          : "Open-bottom canopy. Not a closet box.",
        "Hang on studs above the range. A metal liner and a vent fan are optional and not on this list.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: stackH, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        unit: { ...u, height: stackH, depth: D, doors: false, shelfCount: 0, drawersPerBank: undefined },
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "alcove",
        wallType: "wood_stud",
      },
    };
  }


  const crate = /crate/.test(prompt.toLowerCase());
  if (crate) {
    const innerW = W - P * 2;
    const doorGap = 1.5;
    const doorH = Math.max(12, H - P - doorGap);
    panels.push(panel("upright", "Left side", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right side", x0 + W - P, 0, 0, P, H, D));
    panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, P));
    panels.push(panel("bottom", "Floor", x0 + P, 0, P, innerW, P, D - P));
    panels.push(panel("top", "Top", x0 + P, H - P, 0, innerW, P, D));
    panels.push(panel("door", "Door", x0 + P + 0.06, P, D - P, innerW - 0.12, doorH, P));
    const name = `Crate ${W}" × ${H}" × ${D}"`;
    return {
      id: createId("proj"),
      name,
      prompt,
      kind: "closet",
      overall: { width: W, height: H, depth: D },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `${name}. Wooden kennel the dog goes inside — floor, top, two sides, a back, and a hinged door. ¾" plywood. No shelves.`,
        `The door is ${doorH}" tall, leaving a ${doorGap}" air gap at the top. Drill three 1½" holes near the top of each side and the back so it can breathe.`,
        "Latch the door with a barrel bolt. Sits on the floor. Not a bookcase.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        unit: { ...u, height: H, depth: D, doors: true, shelfCount: 0, drawersPerBank: undefined },
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "freestanding",
        wallType: "wood_stud",
      },
    };
  }

  const island = /island/.test(prompt.toLowerCase());
  if (island) {
    const kickH = 3.5;
    const counterT = 1.5;
    const boxH = Math.max(24, H - counterT);
    const innerW = W - P * 2;
    const midY = kickH + (boxH - kickH) / 2;
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, boxH, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, boxH, D));
    panels.push(panel("bottom", "Bottom shelf", x0 + P, kickH, 0, innerW, P, D));
    panels.push(panel("shelf", "Shelf", x0 + P, midY, 0, innerW, P, D));
    panels.push(panel("kick", "Front toekick", x0 + P, 0, D - kickH, innerW, kickH, P));
    panels.push(panel("kick", "Back toekick", x0 + P, 0, 0, innerW, kickH, P));
    panels.push(panel("counter", "Counter", x0, boxH, 0, W, counterT, D));
    const stackH = boxH + counterT;
    return {
      id: createId("proj"),
      name: `Island ${W}" × ${stackH}" × ${D}"`,
      prompt,
      kind: "closet",
      overall: { width: W, height: stackH, depth: D },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `Kitchen island ${W}" × ${stackH}" × ${D}". Open both sides — no back. ¾" plywood, 1½" counter, 3½" toekick.`,
        "Bottom shelf and one middle shelf are glued in. Not a closet. Not a dining table.",
        "Guidance only — level it on the floor. Confirm the real kitchen.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: stackH, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name: `Island ${W}" × ${stackH}" × ${D}"`,
        unit: { ...u, height: stackH, depth: D, doors: false, shelfCount: 1, drawersPerBank: undefined, counterH: stackH },
      },
      assumptions: {
        load: "heavy",
        units: "inches",
        installMode: "freestanding",
        wallType: "wood_stud",
      },
    };
  }

  const floating = /floating|wall-?mounted/.test(prompt.toLowerCase()) && /shel/.test(prompt.toLowerCase());
  if (floating) {
    const n = Math.max(1, Math.min(8, u.shelfCount ?? 3));
    const gap = 10;
    for (let i = 0; i < n; i++) {
      panels.push(panel("shelf", n === 1 ? "Shelf" : `Shelf ${i + 1}`, x0, i * (P + gap), 0, W, P, D));
    }
    const stackH = n * P + Math.max(0, n - 1) * gap;
    return {
      id: createId("proj"),
      name: spec.name.replace(/storage/i, "Shelves"),
      prompt,
      kind: "closet",
      overall: { width: W, height: stackH, depth: D },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `${n} floating ${W}" × ${D}" shelves. ¾" plywood. No box — each board mounts to the wall.`,
        `Space them about ${gap}" apart (cleat or hidden bracket into studs).`,
        "Guidance only — hit a stud, or use a french cleat.",
      ],
      historic: false,
      opening: spec.opening,
      fitted: { ...spec, unit: { ...u, height: stackH, doors: false, drawersPerBank: undefined } },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "alcove",
        wallType: "wood_stud",
      },
    };
  }


  if (nightstand) {
    const drawerH = Math.min(6.5, Math.max(4.5, Math.round(H * 0.28 * 8) / 8));
    const shelfY = Math.max(P + 6, H - P - drawerH - P);
    const drawerY = shelfY + P;
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
    panels.push(panel("back", "Back", x0 + P, 0, 0, W - P * 2, H, 0.25));
    panels.push(panel("top", "Top", x0 + P, H - P, 0, W - P * 2, P, D));
    panels.push(panel("bottom", "Bottom", x0 + P, 0, 0, W - P * 2, P, D));
    panels.push(panel("shelf", "Shelf", x0 + P, shelfY, 0.1, W - P * 2, P, D - 0.2));
    panels.push(
      panel("drawer", "Drawer", x0 + P + 0.5, drawerY, 0.15, W - P * 2 - 1, drawerH - 0.12, D - 0.3),
    );
    const name = `Nightstand ${W}" × ${H}" × ${D}"`;
    return {
      id: createId("proj"),
      name,
      prompt,
      kind: "closet",
      overall: { width: W, height: H, depth: D },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `${name}. One ${drawerH}" drawer over an open shelf. ¾" plywood, ¼" back. Not a mini dresser.`,
        `The drawer is 1" narrower than the bay so a pair of side-mount slides fit. The shelf is glued — it is the floor of the drawer bay.`,
        "Guidance only — level it on the floor. Confirm the bedside height.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        unit: { ...u, height: H, depth: D, doors: false, shelfCount: 1, drawersPerBank: 1 },
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "freestanding",
        wallType: "wood_stud",
      },
    };
  }

  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
  const bayN = u.bays && u.bays >= 2 ? u.bays : 1;
  if (bayN >= 2) {
    for (let i = 1; i < bayN; i++) {
      const x = x0 + (W * i) / bayN - P / 2;
      panels.push(panel("divider", `Bay divider ${i}`, x, 0, 0, P, H, D));
    }
  }
  panels.push(panel("back", "Back", x0 + P, 0, 0, W - P * 2, H, 0.25));
  panels.push(panel("top", "Top", x0 + P, H - P, 0, W - P * 2, P, D));
  panels.push(panel("bottom", "Bottom", x0 + P, 0, 0, W - P * 2, P, D));
  if (spec.program === "media") {
    panels.push(panel("kick", "Toekick", x0 + P, 0, D - 3.5, W - P * 2, 3.5, P));
  }

  const hasKnee = (spec.program === "vanity" || spec.program === "desk") && (u.kneeW ?? 0) > 8;
  const counterY = u.counterH ?? (spec.program === "desk" ? H : 34);

  if (hasKnee) {
    const knee = Math.min(u.kneeW ?? 22, W - 10);
    const kneeL = -knee / 2;
    const kneeR = knee / 2;
    const leftW = kneeL - x0;
    const rightW = x0 + W - kneeR;
    const boxH = Math.min(counterY, H);
    panels.push(panel("divider", "Left knee divider", kneeL - P, 0, 0, P, boxH, D));
    panels.push(panel("divider", "Right knee divider", kneeR, 0, 0, P, boxH, D));
    panels.push(panel("kick", "Left toekick", x0 + P, 0, D - P, leftW - P, 3.5, P));
    panels.push(panel("kick", "Right toekick", kneeR + P, 0, D - P, rightW - P, 3.5, P));
    const n = u.drawersPerBank ?? 3;
    const span = boxH - 3.5;
    const dh = span / n;
    for (let i = 0; i < n; i++) {
      const y = 3.5 + i * dh;
      panels.push(panel("drawer", `Left drawer ${i + 1}`, x0 + P, y, 0.15, leftW - P - 0.1, dh - 0.12, D - 0.3));
      panels.push(panel("drawer", `Right drawer ${i + 1}`, kneeR + P, y, 0.15, rightW - P - 0.1, dh - 0.12, D - 0.3));
    }
    panels.push(panel("counter", spec.program === "desk" ? "Desktop" : "Counter", x0, boxH, 0, W, 1.5, D));
    if (u.mirror && spec.program === "vanity") {
      const mh = Math.max(8, (u.upperStart ?? Math.min(H, 54)) - boxH - 3);
      panels.push(panel("mirror", "Mirror", kneeL, boxH + 2, 0.4, knee, mh, 0.2));
    }
  } else if (u.drawersPerBank) {
    const n = u.drawersPerBank;
    const dh = (H - 4) / n;
    for (let i = 0; i < n; i++) {
      panels.push(panel("drawer", `Drawer ${i + 1}`, x0 + P + 0.5, 3.5 + i * dh, 0.15, W - P * 2 - 1, dh - 0.12, D - 0.3));
    }
  }

  const shelfZone0 = hasKnee ? (u.upperStart ?? counterY + 2) : P;
  const shelfZone1 = u.upperStart ? H : H - P;
  if (u.upperStart && u.upperStart < H - 4) {
    panels.push(panel("bottom", "Upper bottom", x0 + P, u.upperStart, 0, W - P * 2, P, D));
    if (W >= 36) panels.push(panel("divider", "Upper divider", -P / 2, u.upperStart, 0, P, H - u.upperStart, D));
  }

  const hang = !!u.rod && (spec.program === "wardrobe" || spec.program === "closet");
  const rodY = hang ? Math.min(H - 8, Math.max(60, H * 0.72)) : null;
  const shelves = u.shelfCount ?? (spec.program === "bookcase" ? 5 : spec.program === "closet" ? 1 : spec.program === "pantry" || spec.program === "wardrobe" ? 4 : spec.program === "media" ? 2 : 0);
  if (shelves > 0) {
    const y0 = rodY != null ? rodY + 2 : (u.upperStart ?? shelfZone0);
    const y1 = shelfZone1;
    for (let i = 1; i <= shelves; i++) {
      const y = y0 + ((y1 - y0) * i) / (shelves + 1);
      if (bayN >= 2) {
        const clear = (W - P * (bayN + 1)) / bayN;
        for (let b = 0; b < bayN; b++) {
          const x = x0 + P + b * (clear + P);
          panels.push(panel("shelf", `Bay ${b + 1} shelf ${i}`, x, y, 0.1, clear, P, D - 0.2));
        }
      } else if (u.upperStart && W >= 36) {
        const bay = (W - P * 3) / 2;
        panels.push(panel("shelf", `Left shelf ${i}`, x0 + P, y, 0.1, bay, P, D - 0.2));
        panels.push(panel("shelf", `Right shelf ${i}`, P / 2, y, 0.1, bay, P, D - 0.2));
      } else {
        panels.push(panel("shelf", `Shelf ${i}`, x0 + P, y, 0.1, W - P * 2, P, D - 0.2));
      }
    }
  }

  if (rodY != null) {
    panels.push(panel("rail", "Hanging rod", x0 + P, rodY, D * 0.45, W - P * 2, 1.25, 1.25));
  }

  const cubbyN = u.cubbies ?? 0;
  if (cubbyN >= 2 && !hasKnee) {
    // Interior clear: top and bottom already take P each.
    const cubbyH = Math.max(P, H - 2 * P);
    for (let i = 1; i < cubbyN; i++) {
      const x = x0 + (W * i) / cubbyN - P / 2;
      panels.push(panel("divider", `Cubby divider ${i}`, x, P, 0, P, cubbyH, D));
    }
  }

  if (u.doors && spec.program !== "media") {
    const doorY = u.upperStart ?? 0;
    const doorH = H - doorY;
    if (bayN >= 2) {
      const bayW = W / bayN;
      for (let i = 0; i < bayN; i++) {
        panels.push(
          panel("door", `Bay ${i + 1} door`, x0 + i * bayW + 0.1, doorY, D - P, bayW - 0.2, doorH, P),
        );
      }
    } else if (W > 28) {
      panels.push(panel("door", "Left door", x0 + 0.1, doorY, D - P, W / 2 - 0.2, doorH, P));
      panels.push(panel("door", "Right door", 0.1, doorY, D - P, W / 2 - 0.2, doorH, P));
    } else {
      panels.push(panel("door", "Door", x0 + 0.1, doorY, D - P, W - 0.2, doorH, P));
    }
  }

  const alcove = spec.opening.kind === "alcove" || spec.opening.kind === "pocket";
  const notes = [
    `${spec.name}. ${alcove ? "Fitted to the opening." : "Freestanding carcase — still square, still a cut list."}`,
    `Unit ${u.width}" W × ${u.depth}" D × ${u.height}" H. ¾" plywood. Front reads straight.`,
    hasKnee
      ? `Work surface at ${counterY}". Knee ${u.kneeW}" clear, drawers in the wings.`
      : shelves
        ? `${shelves} adjustable shelf line${shelves === 1 ? "" : "s"}.`
        : spec.program === "media"
        ? bayN >= 2
          ? `Open front. ${bayN} bays with divider${bayN > 2 ? "s" : ""} so the top and shelves don't span the full ${W}". TV sits on top. No leftover doors.`
          : "Open front. TV sits on top. No leftover doors."
        : "Solid carcase.",
    alcove
      ? "Anchor uprights into studs. Shim the tight side. Do not rack the box to match a wonky wall."
      : "Level it. Add a back (already on the bench) so it cannot rack.",
    "Guidance only — confirm plumbing, studs, and the real opening before you cut.",
  ];

  return {
    id: createId("proj"),
    name: spec.name,
    prompt,
    kind: "closet",
    overall: { width: W, height: H, depth: D },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes,
    historic: false,
    opening: spec.opening,
    fitted: spec,
    assumptions: {
      load: spec.program === "bookcase" || spec.program === "pantry" ? "heavy" : "medium",
      units: "inches",
      installMode: alcove ? "alcove" : "freestanding",
      wallType: "wood_stud",
    },
  };
}

export function fittedFromPocketProject(project: YardProject): FittedSpec | undefined {
  return project.fitted ?? undefined;
}
