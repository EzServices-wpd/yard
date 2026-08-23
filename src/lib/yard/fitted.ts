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
  /vanity|closet|cabinet|cabinetry|desk|bookcase|bookshelf|pantry|wardrobe|built-?in|alcove|linen|mudroom|workbench|nightstand|dresser|media cons|console|shelves|shelf|drawer|storage|bench seat|window seat/;

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
  return BUILDER.test(lower) && nums >= 2;
}

export function detectProgram(lower: string): FittedProgram {
  if (/\bdesk\b|workbench|work table/.test(lower)) return "desk";
  if (/\bvanity\b|\bsink\b/.test(lower)) return "vanity";
  if (/bookcase|bookshelf|\bbooks\b/.test(lower)) return "bookcase";
  if (/pantry/.test(lower)) return "pantry";
  if (/wardrobe/.test(lower)) return "wardrobe";
  if (/\bmedia\b|\btv\b|console/.test(lower)) return "media";
  if (/\bmudroom\b|window seat/.test(lower)) return "bench";
  if (/\bcloset\b|linen|alcove|built-?in/.test(lower)) return "closet";
  if (/towel|cabinet|storage|shelves|shelf/.test(lower)) return "closet";
  if (/\bbench\b/.test(lower)) return "bench";
  if (/bathroom/.test(lower)) return "vanity";
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

  let width = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:wide|width)/i, NaN);
  let height = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:tall|high|height)/i, NaN);
  let depth = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:deep|depth)/i, NaN);

  if (!Number.isFinite(width)) {
    const alcove = t.match(
      /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s+(?:bathroom\s+)?(?:alcove|opening|niche|closet)\b/i,
    );
    if (alcove) width = parseFloat(alcove[1]);
  }
  if (!Number.isFinite(width)) width = trip.w ?? (program === "desk" ? 48 : 36);

  if (!Number.isFinite(height)) {
    if (program === "desk" || program === "bench") {
      height = trip.d && trip.d < 42 ? trip.d : trip.h ?? 29;
      if (trip.h && trip.h < 42 && trip.d && trip.d > 14) {
        depth = trip.h;
        height = trip.d;
      } else if (trip.h && !Number.isFinite(depth)) depth = trip.h;
    } else if (trip.h && trip.h < 40 && !trip.d) {
      depth = trip.h;
      height = program === "media" ? 24 : program === "vanity" ? 36 : 84;
    } else {
      height = trip.h ?? (program === "media" ? 24 : 84);
    }
  }
  if (!Number.isFinite(depth)) {
    depth = program === "desk" ? 24 : program === "bookcase" ? 12 : program === "media" ? 16 : 16;
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
  const shelfCount = pick(t, /(\d+)\s*shel(?:f|ves)/i, program === "bookcase" ? 5 : program === "closet" || program === "pantry" || program === "wardrobe" ? 4 : 0);
  const cubbies = pick(t, /(\d+)\s*cubb/i, NaN);
  const drawers = /drawer/.test(lower) || program === "vanity" || program === "desk";
  const doors =
    /door/.test(lower) ||
    program === "closet" ||
    program === "pantry" ||
    program === "wardrobe" ||
    (program === "vanity" && height >= 54);
  const mirror = /mirror/.test(lower) || program === "vanity";
  const rod = /rod|hang|rail/.test(lower) || program === "wardrobe";

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
    drawersPerBank: drawers ? 3 : undefined,
    doors,
    mirror,
    rod,
    centered: true,
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
  };

  return {
    program,
    name: `${names[program]} ${width}" × ${height}" × ${depth}"`,
    opening: {
      width,
      height,
      depth,
      kind: walls ? "pocket" : /alcove|built-?in|closet|niche/.test(lower) ? "alcove" : "room",
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

  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
  panels.push(panel("back", "Back", x0 + P, 0, 0, W - P * 2, H, 0.25));
  panels.push(panel("top", "Top", x0 + P, H - P, 0, W - P * 2, P, D));
  panels.push(panel("bottom", "Bottom", x0 + P, 0, 0, W - P * 2, P, D));

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
    panels.push(panel("kick", "Left toekick", x0 + P, 0, D - 0.5, leftW - P, 3.5, 0.5));
    panels.push(panel("kick", "Right toekick", kneeR + P, 0, D - 0.5, rightW - P, 3.5, 0.5));
    const n = u.drawersPerBank ?? 3;
    const span = boxH - 3.5 - (spec.program === "desk" ? 0 : 0);
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
      panels.push(panel("drawer", `Drawer ${i + 1}`, x0 + P, 3.5 + i * dh, 0.15, W - P * 2, dh - 0.12, D - 0.3));
    }
  }

  const shelfZone0 = hasKnee ? (u.upperStart ?? counterY + 2) : P;
  const shelfZone1 = u.upperStart ? H : H - P;
  if (u.upperStart && u.upperStart < H - 4) {
    panels.push(panel("bottom", "Upper bottom", x0 + P, u.upperStart, 0, W - P * 2, P, D));
    if (W >= 36) panels.push(panel("divider", "Upper divider", -P / 2, u.upperStart, 0, P, H - u.upperStart, D));
  }

  const shelves = u.shelfCount ?? (spec.program === "bookcase" ? 5 : spec.program === "closet" || spec.program === "pantry" || spec.program === "wardrobe" ? 4 : spec.program === "media" ? 2 : 0);
  if (shelves > 0) {
    const y0 = u.upperStart ?? shelfZone0;
    const y1 = shelfZone1;
    for (let i = 1; i <= shelves; i++) {
      const y = y0 + ((y1 - y0) * i) / (shelves + 1);
      if (u.upperStart && W >= 36) {
        const bay = (W - P * 3) / 2;
        panels.push(panel("shelf", `Left shelf ${i}`, x0 + P, y, 0.1, bay, P, D - 0.2));
        panels.push(panel("shelf", `Right shelf ${i}`, P / 2, y, 0.1, bay, P, D - 0.2));
      } else {
        panels.push(panel("shelf", `Shelf ${i}`, x0 + P, y, 0.1, W - P * 2, P, D - 0.2));
      }
    }
  }

  if (u.rod && spec.program === "wardrobe") {
    const rodY = Math.min(H - 8, Math.max(60, H * 0.72));
    panels.push(panel("rail", "Hanging rod", x0 + P, rodY, D * 0.45, W - P * 2, 1.25, 1.25));
  }

  const cubbyN = u.cubbies ?? 0;
  if (cubbyN >= 2 && !hasKnee) {
    for (let i = 1; i < cubbyN; i++) {
      const x = x0 + (W * i) / cubbyN - P / 2;
      panels.push(panel("divider", `Cubby divider ${i}`, x, 0, 0, P, H, D));
    }
  }

  if (u.doors) {
    const doorY = u.upperStart ?? 0;
    const doorH = H - doorY;
    if (W > 28) {
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
