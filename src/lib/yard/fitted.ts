/**
 * Any measured brief → a real unit, cut list, and plan.
 * Same logic as the bathroom pocket: space first, rectangular unit second,
 * program (vanity / closet / desk / …) third. Trapezoid walls if they gave them.
 */

import { inchFrac } from "./inchText";
import { heldCollection } from "./heldObjects";
import { readHookRows } from "./face";
import { createId } from "@/lib/utils";
import { drawerBoxFromOpening } from "./shopPlural";
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
import { detectWeekendMech } from "./weekendFamily";
import { climbIdentityLabel, detectHouseFamily, identityTitleStem, isLadderShelfFurniture, ladderShelfTitleStem, mediaIdentityLabel, sitBenchTitleStem, isAdirondackChair, isLoungeChair, isRockingChair, isOttoman, isSeatingLoungeClass, isAvTower, isBedsideShelf, isBootTrayBench, isBookBinBench, isBunkBed, isButcherCart, isDiningTable, isServingCart, isPlateRack, isMagazineRack, isSlotRack, slotRackTitle, isCoatCubbyWall, isDaybed, isDryingRack, isFoldDown, isFoldingTable, isHouseMediaCarcase, isIroningWallMount, isKeyMailShelf, isCoatHookBoard, isKitchenBase, isKitchenIsland, isKitchenUpper, isLaundryFoldDown, isLaundrySorter, isLeashRail, isPegRail, isFilingShelf, isPrinterStand, isLoftBed, isLumberRack, isMediaShelf, isOpenKitchenShelving, isOutdoorSideTable, isSideEndTable, sideEndTableStem, isPegboard, isPlanterBox, isPlatformBed, isPorchSwingFrame, isPrepTable, isRadiatorCover, isMudroomCubbyWall, isOpenCubbyWall, openCubbyWallTitle, isShoePortalCubbies, isShoePortalRail, isStereoCabinet, isToolRail, isToyChest, isHingedLidChest, isLiftOffLidChest, isLiftOffLidPrompt, isMultiLidPrompt, spokenLidCount, isStorageHutch, isTowelPortalRail, isUtilityShelf, isWallMediaLedge, isPictureLedge, pictureLedgeTitleStem, isWorkbench, isPottingBench, isStandingShopTop, isStorageBox, storageBoxTitleStem, towelPortalWantsHooks, isDoorPortal, isPortalHookRail, isPortalSpanShelf, portalHookRailTitle, portalSpanShelfTitle, isSofaConsoleTable, tableTopShape, tableShapeTitlePrefix, wantsBookHold, wantsPrintHold, wantsShoes, wantsSoundbarHold, type HouseAffordance, type HouseFamily, type TableTopShape } from "./family";
import { honorSpeciesInTitle, speciesSubstituteNote, speciesStockHonestyTalk, deskWidthFromPrompt, tableSpanFromPrompt, nounSpanFromPrompt, openingWidthFromPrompt, stampTypedAxesTitle, typedOpeningStorageAxes, typedClassDefaultAxes, isClassDefaultDensifyPrompt, classDefaultDensifyTitle, classDefaultAssumedNotes, normalizeUserPrompt, spokenAxisInches, guidanceConfirmTalk } from "./voiceHonesty";
import { namedStockFromPrompt } from "./weekendStockHonesty";
import { detectMaterial, isWireStock } from "./promptHelpers";
import { buildCornerUnit, cornerSpecFromPrompt, isCornerUnitPrompt } from "./corner";
import { buildOddShape, isOddShapePrompt, oddSpecFromPrompt } from "./oddShapes";

const PLY = "plywood-3-4-4x8";
const PLY_BACKER = "plywood-1-4-4x8";
const TWO_BY_TWO = "lumber-2x2-8";
const P = 0.75;
/** Stud spacing the hang steps assume. A back narrower than this cannot take a screw in two studs. */
export const STUD_CENTER_IN = 16;
/** Concealed hinge arm sticks in from the door's inner face. Shelves must stop short of it. */
export const HINGE_ARM_CLEAR_IN = 0.75;
const DOOR_MIRROR_T = 0.12;

/** Keep the typed noun. "spice cabinet" stays Spice cabinet, not a bare Cabinet. */
function cabinetStem(lower: string): string {
  const m = lower.match(/\b([a-z][a-z-]{2,}(?:\s+[a-z][a-z-]{2,}){0,2})\s+cabinets?\b/);
  if (!m) return "Cabinet";
  const words = m[1].split(/\s+/).filter((w) => !/^(?:a|an|the|my|our|your|small|large|tall|new|old)$/.test(w));
  if (!words.length) return "Cabinet";
  return `${words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")} cabinet`;
}


/**
 * Shallow hung cabinet: the typed depth is the finished depth, door included.
 * The overlay door's outer face is that number — it does not add a slab past the label.
 * A mirror sits on that outer face, not buried in the door. Shelves stop short of the hinge arm.
 */
export function shallowWallCabinetFace(typedDepth: number, backT = P) {
  const doorT = P;
  const outer = typedDepth;
  const doorZ = Math.max(0, outer - doorT);
  const shelfStop = Math.max(backT + 0.5, doorZ - HINGE_ARM_CLEAR_IN);
  return {
    doorT,
    doorZ,
    outer,
    shelfDepth: Math.max(0.5, shelfStop - backT),
    mirrorT: DOOR_MIRROR_T,
    mirrorZ: outer - DOOR_MIRROR_T,
  };
}

/** A back this wide cannot reach two studs at the usual centers. */
export function backReachesTwoStuds(backWidth: number, studCenter = STUD_CENTER_IN) {
  return backWidth + 1e-6 >= studCenter;
}

function tableClassHeight(lower: string): number {
  if (/coffee|cocktail/.test(lower)) return 18;
  // Side / end tables sit at sofa-arm height: ~22" (class range 18–22").
  if (isSideEndTable(lower)) return 22;
  if (/changing(?:\s*pad)?\s*tables?/.test(lower)) return 36;
  if (/bar\s*-?\s*height/.test(lower)) return 42;
  if (/counter\s*-?\s*height/.test(lower)) return 36;
  return 30;
}

function isIroningCabinet(text: string) {
  return /ironing/.test(text.toLowerCase());
}

function isMedicineCabinet(text: string) {
  return /medicine/.test(text.toLowerCase());
}

function isSpiceRack(text: string) {
  const lower = text.toLowerCase();
  return /spice/.test(lower) && /rack/.test(lower);
}

function isSpiceCabinet(text: string) {
  const lower = text.toLowerCase();
  return /spice/.test(lower) && /cabinet/.test(lower);
}

function isWineRack(text: string) {
  const lower = text.toLowerCase();
  return /wine/.test(lower) && /rack/.test(lower);
}

function isShoeStorage(text: string) {
  return wantsShoes(text.toLowerCase());
}

function isOverToilet(text: string) {
  const lower = text.toLowerCase();
  if (/toilet\s*paper/.test(lower)) return false;
  return /over[- ]?(the[- ]?)?toilet|toilet[- ]?(cabinet|storage|shelf|etagere|étagère)|space[- ]?saver/.test(lower);
}

function pick(text: string, re: RegExp, fallback: number) {
  const m = text.match(re);
  if (!m?.[1]) return fallback;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Spoken drawer negation — "no/zero/without/drawerless/0 drawers".
 * Soft leftover: /\bdrawer/ matched the word inside "no drawers" and desk/nightstand/dresser
 * class defaults still invented banks + Operate + Buy slides — silent collapse.
 */
function isNoDrawersPrompt(lower: string): boolean {
  return (
    /\b(?:no|zero|without|sans)\s+(?:any\s+)?drawers?\b/.test(lower) ||
    /\bdrawerless\b/.test(lower) ||
    /\b0\s*-?\s*drawers?\b/.test(lower) ||
    /\bdrawers?\s*[:=]\s*0\b/.test(lower)
  );
}

/**
 * Soft leftover: /door/ matched inside "no doors" / "without doors" so media densified
 * door leaves + Operate + Buy hinges while notes still said Open front / No leftover doors.
 * Explicit open-front asks also force open (never silent door invent).
 */
function isNoDoorsPrompt(lower: string): boolean {
  return (
    /\b(?:no|zero|without|sans)\s+(?:any\s+)?doors?\b/.test(lower) ||
    /\bdoorless\b/.test(lower) ||
    /\b0\s*-?\s*doors?\b/.test(lower) ||
    /\bdoors?\s*[:=]\s*0\b/.test(lower) ||
    /\bopen\s*-?\s*front\b/.test(lower)
  );
}

/** Spoken/typed drawer count — digits or words; overrides family defaults (nightstand=1, bank=3). */
function spokenDrawerCount(text: string): number | null {
  const lower = text.toLowerCase();
  const digit = lower.match(/\b(\d+)\s*-?\s*drawers?\b/);
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (n >= 1 && n <= 12) return n;
  }
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    single: 1,
  };
  const word = lower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|single)\s+(?:pencil\s+)?drawers?\b/);
  if (word) return words[word[1]];
  // "a pencil drawer" / bare pencil drawer → one front
  if (/\bpencil\s+drawers?\b/.test(lower)) return 1;
  if (/\bwith\s+a\s+drawers?\b/.test(lower)) return 1;
  return null;
}


/** Spoken/typed door-leaf count — digits or words; null → width/bay heuristic. */
function typedDoorCount(text: string): number | null {
  const lower = text.toLowerCase();
  const digit = lower.match(/\b(\d+)\s*-?\s*doors?\b/);
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (n >= 1 && n <= 8) return n;
  }
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    single: 1,
  };
  const word = lower.match(/\b(one|two|three|four|five|six|seven|eight|single)\s*-?\s*doors?\b/);
  if (word && words[word[1]] != null) return words[word[1]];
  // "a door" / "the door" → one leaf
  if (/\b(?:a|the)\s+doors?\b/.test(lower)) return 1;
  // Bare singular "door" (not "doors") → one; bare plural "doors" → null (heuristic)
  if (/\bdoor\b/.test(lower) && !/\bdoors\b/.test(lower)) return 1;
  return null;
}

/** Spoken usable-tier count: "4 shelves", "three tiers", "5 levels", "4 rows". */
function spokenTierCount(text: string): number | null {
  const s = spokenShelfCount(text);
  if (s != null) return s;
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const m = text.toLowerCase().match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:[\w'-]+\s+)?(?:tiers?|levels?|rows?)\b/);
  if (!m) return null;
  const n = /\d/.test(m[1]) ? parseInt(m[1], 10) : words[m[1]];
  return n >= 1 && n <= 12 ? n : null;
}

/** Spoken/typed shelf count — digits or words; honor "one lower shelf" / adjective between count and shelf. */
function spokenShelfCount(text: string): number | null {
  const lower = text.toLowerCase();
  // Allow short intervening adjectives: "two floating shelves", "3 wall shelves", "one open shelf".
  const bridge = "(?:[\\w'-]+\\s+){0,3}";
  const adj = "(?:lower|upper|bottom|top|open|middle|adjustable|floating|wall|cleat-?mounted)\\s+";
  const digit = lower.match(new RegExp(`\\b(\\d+)\\s+(?:${adj}|${bridge})?shel(?:f|ves|ving)\\b`));
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (n >= 1 && n <= 12) return n;
  }
  const digitTight = lower.match(/\b(\d+)\s*shel(?:f|ves|ving)\b/);
  if (digitTight) {
    const n = parseInt(digitTight[1], 10);
    if (n >= 1 && n <= 12) return n;
  }
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    single: 1,
  };
  const word = lower.match(
    new RegExp(
      `\\b(one|two|three|four|five|six|seven|eight|nine|ten|single)\\s+(?:${adj}|${bridge})?shel(?:f|ves|ving)\\b`,
    ),
  );
  if (word && words[word[1]] != null) return words[word[1]];
  // "a lower shelf" / "the lower shelf" → one
  if (/\b(?:a|the|one|single)\s+(?:lower|bottom)\s+shel(?:f|ves)\b/.test(lower)) return 1;
  if (/\blower\s+shel(?:f|ves)\b/.test(lower) && !/\b(?:[2-9]|1[0-2]|two|three|four|five|six|seven|eight|nine|ten)\s+(?:lower\s+)?shel/.test(lower)) {
    return 1;
  }
  // Bare singular "floating shelf" / "a shelf" (not shelves) → one — do not invent multi stack.
  if (
    /\bshelf\b/.test(lower) &&
    !/\bshelves\b/.test(lower) &&
    (/floating|wall-?mounted|with\s+(?:a\s+)?lip|\blip\b/.test(lower) ||
      /\b(?:a|the|one|single)\s+shel(?:f)\b/.test(lower))
  ) {
    return 1;
  }
  return null;
}

/** Spoken arm count for lumber racks ("four arms" / "4 arms"). */
function spokenArmCount(text: string): number | null {
  const lower = text.toLowerCase();
  const digit = lower.match(/\b(\d+)\s*arms?\b/);
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (n >= 1 && n <= 16) return n;
  }
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
  };
  const word = lower.match(/\b(one|two|three|four|five|six|seven|eight)\s+arms?\b/);
  if (word && words[word[1]] != null) return words[word[1]];
  return null;
}

/** Spoken bin count for laundry sorters ("three bins" / "3 bins"). */

/** Spoken bracket count for wall/floating shelves ("two brackets" / "2 brackets"). */
function spokenBracketCount(text: string): number | null {
  const lower = text.toLowerCase();
  const digit = lower.match(/\b(\d+)\s*brackets?\b/);
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (n >= 1 && n <= 8) return n;
  }
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    pair: 2,
  };
  const word = lower.match(/\b(one|two|three|four|five|six|pair)\s+brackets?\b/);
  if (word && words[word[1]] != null) return words[word[1]];
  // Bare "with brackets" / "bracketed" without a count → two (common pair).
  if (/\bwith\s+brackets\b|\bbracketed\b/.test(lower) && !/\bwithout\s+brackets\b/.test(lower)) {
    return 2;
  }
  return null;
}

function spokenBinCount(text: string): number | null {
  const lower = text.toLowerCase();
  const digit = lower.match(/\b(\d+)\s*bins?\b/);
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (n >= 1 && n <= 8) return n;
  }
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    triple: 3,
  };
  const word = lower.match(/\b(one|two|three|four|five|six|triple)\s+bins?\b/);
  if (word && words[word[1]] != null) return words[word[1]];
  return null;
}

/** Spoken rung count for drying racks ("four rungs" / "4 rungs"). */
function spokenRungCount(text: string): number | null {
  const lower = text.toLowerCase();
  const digit = lower.match(/\b(\d+)\s*rungs?\b/);
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (n >= 1 && n <= 16) return n;
  }
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
  };
  const word = lower.match(/\b(one|two|three|four|five|six|seven|eight)\s+rungs?\b/);
  if (word && words[word[1]] != null) return words[word[1]];
  return null;
}

const COUNT_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};

/**
 * Bottle capacity asked for on a wine / bottle rack. "12 slots", "holds 8 bottles",
 * "24 bottles", "rack for 10 bottles", "holds eight" all bind the same way.
 */
export function spokenBottleCount(text: string): number | null {
  const slots = spokenSlotCount(text);
  if (slots != null) return slots;
  const lower = text.toLowerCase().replace(/-/g, " ");
  const num = "(\\d+|" + Object.keys(COUNT_WORDS).join("|") + ")";
  const pats = [
    new RegExp(`\\b${num}\\s*(?:wine\\s+|bottle\\s+)?(?:bottles?|slots?)\\b`),
    new RegExp(`\\bholds?\\s+(?:up\\s+to\\s+|about\\s+)?${num}\\b(?!\\s*(?:"|″|in\\b|inch|ft|foot|feet|wide|tall|high|deep))`),
  ];
  for (const re of pats) {
    const m = lower.match(re);
    if (!m) continue;
    const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : COUNT_WORDS[m[1]];
    if (n != null && n >= 1 && n <= 120) return n;
  }
  return null;
}

/** Height the stranger actually typed ("36 tall", "30 inches tall", "× 36″ tall", "3 ft tall"), else null. */
export function typedHeightInches(prompt: string): number | null {
  const t = prompt.toLowerCase().replace(/[″”"]/g, '"');
  const m = t.match(/(\d+(?:\.\d+)?)\s*(?:"|in\b|inch(?:es)?\b|-?\s*(ft|foot|feet)\b)?\s*(?:tall|high)\b/);
  if (m) return parseFloat(m[1]) * (m[2] ? 12 : 1);
  const h = t.match(/\b(?:height|h)\s*(?:of\s*)?[:=]?\s*(\d+(?:\.\d+)?)/);
  if (h) return parseFloat(h[1]);
  return null;
}

/** Bottle opening minimum, and the side-by-side width one bottle takes on an open shelf. */
export const WINE_BOTTLE_CLEAR = 3.5;
const WINE_BOTTLE_SPAN = 3.75;

export type WineRackLayout = {
  rows: number;
  cols: number;
  /** true = divider grid, one opening per bottle; false = open rows, bottles side by side. */
  grid: boolean;
  capacity: number;
  /** Asked count did not fit at the bottle pitch within the height. */
  heightCapped: boolean;
  /** Short of the count: overall height that fits every asked bottle at this width. */
  fitH?: number;
  /** Short of the count: overall width that fits every asked bottle at this height. */
  fitW?: number;
  cellW: number;
  /** Clear height of every bottle row. */
  cellH: number;
  /** Overall height (derived from the rows when no height was typed). */
  H: number;
  /** Open shelves above the bottle grid (typed height taller than the count needs). */
  openShelves: number;
  /** Clear height of each open shelf space. */
  openClear: number;
  /** Spare height under ~6" clear: the bottle rows sit on a plinth this tall so the top cap lands at the typed height. */
  plinth: number;
  /** True when the height came from the rows, not from a typed/default height. */
  derivedH: boolean;
  /** Bottles fill the typed height ("as many as fit" / no count). */
  filled: boolean;
  /** The stranger typed the height (vs the default height). */
  heightTyped: boolean;
};

/** Front cradle rail on every bottle row: tall enough to hold the neck, scalloped so the bottle passes. */
export const WINE_RAIL_H = 1.5;
/** Highest a cradle scallop floor sits: a 3/4" lip, lower when the row needs it so a 3 1/2" bottle clears with 1/16" to spare. */
export const WINE_CRADLE_LIP = 0.75;

/** Cradle scallop floor and the clear height a bottle gets above it on a row of `cellH` clear. */
export function wineCradle(cellH: number): { floor: number; clear: number } {
  const floor = Math.max(1 / 8, Math.min(WINE_CRADLE_LIP, cellH - WINE_BOTTLE_CLEAR - 1 / 16));
  return { floor, clear: cellH - floor };
}

/**
 * Face outline ("xy", rail-local) of a scalloped cradle rail: a WINE_RAIL_H board with one circular
 * scallop WINE_BOTTLE_CLEAR wide per bottle centre, bottoming out at `floor`. The scallop radius is at
 * least the bottle radius, so a bottle resting on the scallop floor passes through it.
 */
export function wineCradleOutline(w: number, centres: number[], floor: number): [number, number][] {
  const c = WINE_BOTTLE_CLEAR;
  const d = WINE_RAIL_H - floor;
  const R = (c * c / 4 + d * d) / (2 * d);
  const pts: [number, number][] = [[0, 0], [w, 0], [w, WINE_RAIL_H]];
  const round64 = (v: number) => Math.round(v * 64) / 64;
  for (const cx of [...centres].sort((a, b) => b - a)) {
    for (let i = 0; i <= 16; i++) {
      const x = cx + c / 2 - (i * c) / 16;
      const y = floor + R - Math.sqrt(Math.max(0, R * R - (x - cx) ** 2));
      pts.push([round64(Math.min(w, Math.max(0, x))), round64(Math.min(WINE_RAIL_H, y))]);
    }
  }
  pts.push([0, WINE_RAIL_H]);
  return pts;
}

/** Bottle row pitch: 3¾" clear opening + one ¾" shelf ≈ 4½", the same rule as the columns. */
export const WINE_ROW_CLEAR = 3.75;
/**
 * Row tolerance: a bottle row may take up to ¼" of spare height (3¾" → 4" clear) and no more.
 * Why ¼": the widest common 750 ml bottle (Champagne/sparkling) is about 3½" across, so a 4" row
 * still cradles it with ½" to slide a hand in, one bottle high, inside the 4–4¼" cubbies of store-bought
 * racks. Past that a bottle sits loose and the row starts to read as a shelf. Spare beyond ¼" a row
 * goes to a plinth (or a capped open shelf at 6"+ clear), so the rows stay on the standard pitch.
 */
export const WINE_ROW_SLACK = 0.25;
/** Largest bottle row we ever build — the standard row plus the slack, one bottle high. */
export const WINE_ROW_MAX_CLEAR = WINE_ROW_CLEAR + WINE_ROW_SLACK;
/** Open-shelf clear above a bottle grid: 6" (stemless glasses, a corkscrew) up to 12" (decanters, books). */
export const WINE_OPEN_MIN = 6;
export const WINE_OPEN_MAX = 12;
/** A plinth sits back from the front like a toe kick. */
export const WINE_PLINTH_SETBACK = 3.5;

/** "as many as fit" / "fill it" / "max bottles" — fill the height with bottles. */
export function wantsBottleFill(text: string): boolean {
  return /\bas many (?:bottles )?as (?:will )?fit\b|\bfill(?:s|ed)?\b(?! ?in)|\bmax(?:imum)? (?:bottles|capacity)\b/i.test(text);
}

/**
 * Wine rack grid. Board thickness counts: columns = floor((inner + t) / (3.5 + t)).
 * Rows sit on the bottle pitch (3¾" clear + board) and take at most ¼" of spare each (WINE_ROW_SLACK):
 * - a typed bottle count wins: the grid is sized to the count, rounded up to a full grid;
 *   no typed height → the carcass is only as tall as those rows; typed height → the leftover
 *   above the grid becomes capped open shelves 6–12" clear (under 6" of spare, the rows sit on a plinth);
 * - no count (or "as many as fit") with a height → bottle rows fill it, spare under the rows is a plinth.
 * A height too short for the count keeps the height, builds the full rows that fit, and names the
 * height (and width) that fit every bottle, measured with the openings this build makes.
 */
export function wineRackLayout(o: {
  W: number;
  H: number;
  t: number;
  asked: number | null;
  shelfCount?: number;
  heightTyped?: boolean;
  fill?: boolean;
}): WineRackLayout {
  const { W, t, asked } = o;
  const innerW = W - 2 * t;
  const maxCols = Math.max(1, Math.floor((innerW + t) / (WINE_BOTTLE_CLEAR + t) + 1e-9));
  const pitch = WINE_ROW_CLEAR + t;
  const gridOf = (rows: number, cell: number) => rows * cell + (rows - 1) * t;
  const base = { openShelves: 0, openClear: 0, plinth: 0, derivedH: false, filled: false, heightTyped: !!o.heightTyped };
  // Spare height under the rows: ≤ ¼" a row spreads into the rows; anything more is a plinth.
  const settle = (rows: number, spare: number) =>
    spare <= rows * WINE_ROW_SLACK + 1e-9
      ? { cellH: WINE_ROW_CLEAR + Math.max(0, spare) / rows, plinth: 0 }
      : { cellH: WINE_ROW_CLEAR, plinth: spare };
  // Fill a fixed inner height with standard-pitch rows; the spare is settled above.
  const fill = (innerH: number) => {
    const rows = Math.max(1, Math.floor((innerH + t) / pitch + 1e-9));
    return { rows, ...settle(rows, innerH - gridOf(rows, WINE_ROW_CLEAR)) };
  };
  // The size that fits every asked bottle (rounded up to the next 1/4").
  const up4 = (n: number) => Math.ceil(n * 4 - 1e-9) / 4;
  if (asked != null && asked >= 1) {
    const cols = Math.min(maxCols, asked);
    const cellW = (innerW - (cols - 1) * t) / cols;
    const wantRows = Math.ceil(asked / cols);
    if (!o.heightTyped) {
      const H = 2 * t + gridOf(wantRows, WINE_ROW_CLEAR);
      return { ...base, rows: wantRows, cols, grid: true, capacity: wantRows * cols, heightCapped: false, cellW, cellH: WINE_ROW_CLEAR, H, derivedH: true };
    }
    const innerH = o.H - 2 * t;
    const maxRows = Math.max(1, Math.floor((innerH + t) / pitch + 1e-9));
    if (o.fill || wantRows >= maxRows) {
      // A typed height is a hard cap; the count is a target. Build the full rows that fit.
      const f = fill(innerH);
      const capacity = f.rows * cols;
      const heightCapped = capacity < asked;
      // Fit sizes come from the openings this build makes (its row pitch, opening width and board),
      // so the named size rebuilds to a rack that holds every bottle.
      const colsNeed = Math.ceil(asked / f.rows);
      const fitH = heightCapped ? up4(2 * t + gridOf(wantRows, f.cellH)) : undefined;
      const fitW = heightCapped ? up4(2 * t + colsNeed * cellW + (colsNeed - 1) * t) : undefined;
      return { ...base, rows: f.rows, cols, grid: true, capacity, heightCapped, cellW, cellH: f.cellH, H: o.H, filled: !!o.fill, plinth: f.plinth, fitH, fitW };
    }
    // The count wins: grid for the count, leftover height becomes open shelves above it.
    const rows = wantRows;
    // Height above the grid's closing shelf, up to the typed top.
    const above = o.H - (2 * t + gridOf(rows, WINE_ROW_CLEAR));
    let openShelves = 0;
    let openClear = 0;
    let spare = 0;
    if (above + 1e-9 >= WINE_OPEN_MIN + t) {
      // Fewest capped open shelves with each space ≤ 12" clear, split evenly (≥ 6" clear);
      // the last one is closed by the top cap at the typed height.
      let n = Math.max(1, Math.ceil((above - 1e-9) / (WINE_OPEN_MAX + t)));
      let c = above / n - t;
      if (c < WINE_OPEN_MIN - 1e-9) {
        n -= 1;
        c = WINE_OPEN_MAX;
      }
      openShelves = n;
      openClear = c;
      spare = above - n * (c + t);
    } else {
      // Under 6" clear of spare: no sliver shelf — the rows sit on a plinth, top cap at the typed height.
      spare = above;
    }
    const s = settle(rows, spare);
    return { ...base, rows, cols, grid: true, capacity: rows * cols, heightCapped: false, cellW, cellH: s.cellH, H: o.H, openShelves, openClear, plinth: s.plinth };
  }
  // Open rows (no dividers): bottles side by side on pitch shelves, or the spoken shelf count.
  const perRow = Math.max(1, Math.floor(innerW / WINE_BOTTLE_SPAN + 1e-9));
  const innerH = o.H - 2 * t;
  if (o.shelfCount && o.shelfCount > 1) {
    const maxRows = Math.max(1, Math.floor((innerH + t) / (WINE_BOTTLE_CLEAR + t) + 1e-9));
    const rows = Math.max(1, Math.min(maxRows, o.shelfCount - 1));
    return { ...base, rows, cols: perRow, grid: false, capacity: rows * perRow, heightCapped: false, cellW: innerW / perRow, cellH: (innerH - (rows - 1) * t) / rows, H: o.H };
  }
  // Open rows on the standard pitch, one bottle high; spare under the rows is a plinth.
  const f = fill(innerH);
  return { ...base, rows: f.rows, cols: perRow, grid: false, capacity: f.rows * perRow, heightCapped: false, cellW: innerW / perRow, cellH: f.cellH, H: o.H, plinth: f.plinth, filled: !!o.heightTyped };
}

/** Shop inches to the nearest 1/16" (3.9 → 3 7/8, 3.97 → 4). */
export function inch16(n: number): string {
  return inchFrac(n);
}
function _inch16Legacy(n: number): string {
  const e = Math.round(n * 16);
  const whole = Math.floor(e / 16);
  let num = e % 16;
  let den = 16;
  while (num && num % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  return num ? (whole ? `${whole} ${num}/${den}` : `${num}/${den}`) : `${whole}`;
}

/** Plain capacity sentence for the notes — the real layout, never the row count alone. */
export function wineCapacityVoice(l: WineRackLayout, asked: number | null, H: number): string {
  const grid = `${l.rows} row${l.rows === 1 ? "" : "s"} × ${l.cols} across`;
  const pitchVoice = `rows on a ${inch16(l.cellH + 0.75)}" pitch, one bottle high`;
  const shelfWord = `${l.openShelves} open shel${l.openShelves === 1 ? "f" : "ves"}`;
  const heightWord = l.heightTyped ? `the ${inch16(l.H)}" height you typed` : `the full ${inch16(l.H)}" height`;
  const plinthVoice = l.plinth > 0
    ? ` The bottle rows sit on a ${inch16(l.plinth)}" plinth, recessed like a kick strip, so the top cap lands at ${heightWord}.`
    : "";
  const openUse = l.openClear < 8 ? "stemless glasses, a corkscrew and stoppers" : "glasses, decanters or books";
  const heightVoice = l.derivedH
    ? ` Built ${inch16(l.H)}" tall — just the rows the bottles need.`
    : l.openShelves > 0
      ? ` Above the bottles: ${shelfWord}, ${inch16(l.openClear)}" clear${l.openShelves === 1 ? "" : " each"}, for ${openUse} — capped at the ${inch16(l.H)}" height you typed.${plinthVoice}`
      : l.plinth > 0
        ? plinthVoice
        : l.filled
          ? ` Bottle rows fill the ${inch16(l.H)}" height.`
          : "";
  if (!l.grid) {
    return `Holds about ${l.capacity} bottles — ${l.rows} rows of about ${l.cols} bottles each, lying side by side on open shelves (${pitchVoice}).${plinthVoice}`;
  }
  if (asked == null || l.capacity === asked) {
    return `Holds ${l.capacity} bottles${l.openShelves ? `, with ${shelfWord} above` : ""} — ${grid}, one opening per bottle (${pitchVoice}).${heightVoice}`;
  }
  if (l.capacity > asked) {
    return `Holds ${l.capacity} bottles (room for the ${asked} bottles you asked for${l.openShelves ? `), with ${shelfWord} above (` : "; "}${grid}, one opening per bottle, ${pitchVoice}).${heightVoice}`;
  }
  // The typed size wins; say the shortfall and the size that fits them all.
  const fitVoice = l.fitH
    ? `; about ${inch16(l.fitH)}" tall fits all ${asked}${l.fitW && l.fitW <= 96 ? ` (or about ${inch16(l.fitW)}" wide at ${inch16(H)}" tall)` : ""}`
    : "";
  return `Holds ${l.capacity} bottles at this height — ${asked - l.capacity} short of the ${asked} you asked for${fitVoice}. ${grid}, one opening per bottle (${pitchVoice}), inside the ${inch16(H)}" height you typed.${heightVoice}`;
}

/** Spoken slot count for plate/magazine/dish/wine racks ("three slots" / "sixteen slots" / "12 slots" / "16 slots"). */
function spokenSlotCount(text: string): number | null {
  const lower = text.toLowerCase();
  const digit = lower.match(/\b(\d+)\s*slots?\b/);
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (n >= 1 && n <= 24) return n;
  }
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
  };
  const word = lower.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+slots?\b/,
  );
  if (word && words[word[1]] != null) return words[word[1]];
  return null;
}

/** Spoken/typed shelf board thickness ("2 thick" / "2\" thick"). */
function spokenShelfThickness(text: string): number | null {
  const m =
    text.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″'])?\s*thick\b/i) ||
    text.match(/\bthick(?:ness)?\s*(?:of\s*)?(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n < 0.5 || n > 4) return null;
  return n;
}

/** Spoken cubby / bay count — digit or word ("six cubbies" → 6). */
function spokenCubbyCount(text: string): number | null {
  const lower = text.toLowerCase();
  const digit = lower.match(/\b([2-9]|1[0-2])\s*cubb/);
  if (digit) return Number(digit[1]);
  const words: Record<string, number> = {
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const word = lower.match(/\b(two|three|four|five|six|seven|eight|nine|ten)\s+cubb/);
  if (word) return words[word[1]];
  return null;
}




const CRAFT = /popsicle|craft stick|toothpick|paper towel|toilet paper|straw|dowel|pvc|lego|mailing tube/;
const MAKER = /eiffel|taj|mahal|pyramid|giraffe|rocket|looks like|lattice tower/;
const BUILDER =
  /vanity|closet|cabinet|cabinetry|desk|bookcase|bookshelf|pantry|wardrobe|built-?in|alcove|linen|mudroom|workbench|potting\s*bench|nightstand|bedside|dresser|media cons|console|\btv\b|sideboard|credenza|hutch|island|table|prep\s*table|butcher|cart|shelving|shelves|shelf|\bledge\b|drawer|storage|bench seat|window seat|system|\brack\b|crate|headboard|bunk|loft\s*bed|day\s*bed|platform\s*beds?|shoe|coat|towel|range\s*hood|kitchen\s*hood|\bhood\b|\bstereo\b|soundbar|(?:\bav\b|a\.?\s*v\.?)\s*tower|media\s*tower|entertainment|pegboard|peg\s*board|tool\s*rail|leash\s*rail|lumber\s*rack|wall\s*panel|ironing|laundry\s*sorter|\bsorter\b|drying\s*rack|utility\s*shel|folding\s*table|boot\s*tray|key\s*(?:and|&)\s*mail|mail\s*shelf|coat\s*(?:and|&)?\s*cubb|toy\s*cubb|cubby\s*wall|kids\s*cubb|book\s*bin|\bchest\b|toy\s*box|hinged\s*lid|planter|adirondack|porch\s*swing|outdoor\s*side\s*table|side\s*table/;

export function looksLikeFitted(prompt: string) {
  const lower = prompt.toLowerCase();
  if (looksLikePocket(prompt)) return true;
  if (isOverToilet(lower)) return true;
  // Corner-unit class (corner / right-angle / triangle / quarter-round shelves) is house.
  if (isCornerUnitPrompt(lower)) return true;
  // Odd-shape pack (L-footprint, diagonal corner, sloped, wrap, angled, outside, polygon) is house.
  if (isOddShapePrompt(lower)) return true;
  // Climb-primary stools / launcher / media-hold are craft — not fitted.
  // Linen/closet with a climb step-shelf still fitted (climbIdentityLabel null).
  if (climbIdentityLabel(lower)) return false;
  if (
    isPegboard(lower) ||
    isToolRail(lower) ||
    isLeashRail(lower) ||
    isKeyMailShelf(lower) ||
    isCoatCubbyWall(lower) ||
    isOpenCubbyWall(lower) ||
    isBootTrayBench(lower) ||
    isLumberRack(lower) ||
    isWorkbench(lower) ||
    isPottingBench(lower) ||
    isLaundrySorter(lower) ||
    isFoldingTable(lower) ||
    isDryingRack(lower) ||
    isUtilityShelf(lower) ||
    isIroningWallMount(lower) ||
    isPlanterBox(lower) ||
    isPlatformBed(lower) ||
    isOutdoorSideTable(lower) ||
    isSeatingLoungeClass(lower) ||
    isToyChest(lower) ||
    isHingedLidChest(lower) ||
    isBookBinBench(lower) ||
    isPorchSwingFrame(lower) ||
    /ironing/.test(lower)
  ) {
    return true;
  }
  const weekendMech = detectWeekendMech(prompt);
  // House media ledge / shelf / stereo / AV stay fitted even if craft nouns overlap.
  // Pot-hold / hamper stand is weekend craft — never house Storage steal via laundry noun.
  if (weekendMech === "pot-hold") return false;
  if (weekendMech === "launcher") return false;
  if (
    weekendMech === "media-hold" &&
    !detectHouseFamily(prompt) &&
    !isHouseMediaCarcase(lower) &&
    !isWallMediaLedge(lower) &&
    !isPictureLedge(lower) &&
    !isBedsideShelf(lower) &&
    !isPlatformBed(lower)
  ) {
    return false;
  }
  if (weekendMech === "climb" && !detectHouseFamily(prompt)) return false;
  // A stock clause is not a new subject. "entry bench from popsicle sticks",
  // "dog house from dowels", "hall tree from PVC" stay the house piece.
  // BUILDER is narrower than the house-noun list (no bare bench, dog house,
  // hall tree, …), so naming sticks used to fail this test and the generator
  // stamped a 24×24×24 Custom closet. "popsicle Eiffel" is still not a carcase.
  const houseDespiteStock = detectHouseFamily(prompt);
  if (MAKER.test(lower) && CRAFT.test(lower) && !houseDespiteStock) return false;
  if (CRAFT.test(lower) && !BUILDER.test(lower) && !houseDespiteStock) return false;
  const dimText = lower
    .replace(/\b(?:from\s+)?(?:[1-8]\s*[x×]\s*(?:2|3|4|6|8|10|12)|two by four|two by six|one by four|four by four)\b/gi, " ");
  const nums = (dimText.match(/\d+(?:\.\d+)?/g) ?? []).length;
  if (/workbench/.test(lower) && !/drawer|plywood|cabinet/.test(lower) && !/(?:wide|width|long|length|deep|depth|high|height|tall)/.test(lower) && !/\d+(?:\.\d+)?\s*(?:in|inch|inches|ft|foot|feet|')/.test(lower)) {
    return false;
  }
  // Seating lounge class stays fitted (plywood sit anatomy) — not craft House-wire.
  if (
    /chair|stool|ladder/.test(lower) &&
    !isSeatingLoungeClass(lower) &&
    !/vanity|desk|bookcase/.test(lower) &&
    !isBunkBed(lower) &&
    !isLoftBed(lower) &&
    !isPlatformBed(lower) &&
    !isLadderShelfFurniture(lower) &&
    !ladderShelfTitleStem(lower)
  )
    return false;
  if (detectHouseFamily(prompt)) return true;
  // Three finished axes and no named stock: a sheet carcase at those numbers.
  // A named material still densifies in that stock. A figure or climb stays that build.
  if (
    /\d+(?:\.\d+)?\s*["″']?\s*(?:wide|width)\b/.test(lower) &&
    /\d+(?:\.\d+)?\s*["″']?\s*(?:tall|high|height)\b/.test(lower) &&
    /\d+(?:\.\d+)?\s*["″']?\s*(?:deep|depth)\b/.test(lower) &&
    !namedStockFromPrompt(prompt) &&
    !CRAFT.test(lower) &&
    !MAKER.test(lower) &&
    !climbIdentityLabel(lower)
  ) {
    return true;
  }
  if (isPortalHookRail(lower) || isPortalSpanShelf(lower) || isTowelPortalRail(lower) || isShoePortalRail(lower) || isShoePortalCubbies(lower)) {
    return true;
  }
  // "70 in by 28 in" with no other noun is a table footprint, not a craft wire.
  if (isBarePlanPair(lower)) return true;
  if (!BUILDER.test(lower)) return false;
  if (/vanity|closet|desk|bookcase|bookshelf|pantry|wardrobe|linen|mudroom|media cons|console|\btv\b|sideboard|table|prep\s*table|butcher|cart|shelving|alcove|built-?in|system|nightstand|bedside|dresser|hutch|island|cabinet|shelves|shelf|\bledge\b|storage|\brack\b|crate|headboard|bunk|loft\s*bed|day\s*bed|platform\s*beds?|shoe|coat|towel|range\s*hood|\bhood\b|\bstereo\b|soundbar|(?:\bav\b|a\.?\s*v\.?)\s*tower|entertainment|ironing|laundry|sorter|drying|utility|folding\s*table/.test(lower)) {
    return true;
  }
  if (isHouseMediaCarcase(lower) || isWallMediaLedge(lower) || isPictureLedge(lower) || isAvTower(lower) || isStereoCabinet(lower) || isPlatformBed(lower) || isBedsideShelf(lower)) return true;
  return nums >= 2;
}

export function detectProgram(lower: string): FittedProgram {
  const house = detectHouseFamily(lower);
  if (house) return house.program;
  if (/\bdesk\b|workbench|work table/.test(lower)) return "desk";
  if (isMedicineCabinet(lower)) return "storage";
  if (isOverToilet(lower)) return "storage";
  if (isSpiceRack(lower)) return "storage";
  if (isWineRack(lower)) return "storage";
  if (isSlotRack(lower) || isServingCart(lower) || isButcherCart(lower)) return "storage";
  if (isDiningTable(lower)) return "table";
  if (/\bvanity\b|\bsink\b/.test(lower)) return "vanity";
  if (/bookcase|bookshelf|\bbooks\b/.test(lower)) return "bookcase";
  if (/pantry/.test(lower)) return "pantry";
  if (/wardrobe/.test(lower)) return "wardrobe";
  if (isBedsideShelf(lower)) return "storage";
  if (/nightstand/.test(lower) || (/bedside/.test(lower) && !isBedsideShelf(lower))) return "storage";
  if (isSofaConsoleTable(lower)) return "table";
  if (isPlatformBed(lower)) return "storage";
  if (isDaybed(lower)) return "bench";
  if (/\btable\b/.test(lower) && !/work table/.test(lower)) return "table";
  if (/\bmedia\b|\btv\b|console|sideboard|credenza/.test(lower)) return "media";
  if (isOpenCubbyWall(lower) || isMudroomCubbyWall(lower)) return "storage";
  if (/\bmudroom\b|window seat|day\s*bed/.test(lower)) return "bench";
  if (/\bcloset\b|linen|alcove|built-?in|closet system|storage system/.test(lower)) return "closet";
  if (/\bbench\b/.test(lower)) return "bench";
  if (/bathroom/.test(lower) && !/closet|linen|alcove|medicine|toilet/.test(lower)) return "vanity";
  if (isBarePlanPair(lower)) return "table";
  return "storage";
}

/** "70 in by 28 in" / "give me a 70 by 28" — two plan numbers, no other noun. */
function isBarePlanPair(lower: string): boolean {
  const t = lower
    .replace(/^(?:please\s+)?(?:give me|make me|build me|i need|i want)\s+(?:a|an)?\s*/i, "")
    .trim();
  if (BUILDER.test(t) || MAKER.test(t) || CRAFT.test(t)) return false;
  return /^\d+(?:\.\d+)?\s*(?:in|inch|inches|")?\s*(?:x|by|×)\s*\d+(?:\.\d+)?\s*(?:in|inch|inches|")?$/.test(t);
}

function triple(text: string): { w?: number; h?: number; d?: number } {
  // 4x4 / 2x4 is the stick, not the footprint. "table with 4x4 legs 36 inches" is 36 wide.
  const stripped = text.replace(
    /\b(?:[124]\s*[x×]\s*(?:2|4|6|8|10|12)|1x2|1\s*[x×]\s*3|1x3|1x4|1x6|1x8|1x12|2x2|2x4|2x6|2x8|2x10|2x12|4x4)(?:\s*[x×]\s*\d+)?(?:\s*(?:ft|foot|feet|in|inch|inches))?(?:'s|s)?\b/gi,
    " ",
  );
  // Optional axis words between numbers so "42 long × 24 wide × 18 tall" still triples.
  const m = stripped.match(
    /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:long|length|wide|width|deep|depth|tall|high|height)?\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)(?:\s*(?:in|inch|inches|")?\s*(?:long|length|wide|width|deep|depth|tall|high|height)?\s*(?:x|by|×)\s*(\d+(?:\.\d+)?))?/i,
  );
  if (!m) return {};
  return { w: parseFloat(m[1]), h: parseFloat(m[2]), d: m[3] ? parseFloat(m[3]) : undefined };
}

/** Mattress class. Width is across the sleeper, length is head to foot. */
function mattressDeck(lower: string): { width: number; length: number } | null {
  if (/cal(?:ifornia)?\s*king/.test(lower)) return { width: 72, length: 84 };
  if (/\bking\b/.test(lower)) return { width: 76, length: 80 };
  if (/\bqueen\b/.test(lower)) return { width: 60, length: 80 };
  if (/\bfull\b|\bdouble\b/.test(lower)) return { width: 54, length: 75 };
  if (/\btwin\b/.test(lower)) return { width: 39, length: 75 };
  return null;
}

/** Bunk / loft frame is a couple inches wider than the mattress. An unnamed bunk stays the usual twin 42. */
function framedSleep(lower: string): { width: number; length: number } {
  const m = mattressDeck(lower);
  if (!m) return { width: 42, length: 75 };
  if (m.width <= 39) return { width: 42, length: m.length };
  return { width: m.width + 2, length: m.length };
}

export function parseBrief(prompt: string): FittedSpec | null {
  prompt = normalizeUserPrompt(prompt);
  const craftLower = prompt.toLowerCase();
  // Tip-rail picture/photo/art ledge is hung-open house densify (isPictureLedge) — do not null brief.
  if (/soft-?launch|leaves?\s+free/.test(craftLower) && /(?:paper\s*)?plane|marble|ramp|trough|cedar|popsicle|weekend|craft/.test(craftLower) && !/mudroom|closet|desk|headboard|shoe|cabinet/.test(craftLower)) return null;
  if (!looksLikeFitted(prompt)) return null;
  // A numbered degree on a shelf is the odd-shape corner, not a 90° triangle.
  if (isOddShapePrompt(prompt)) return oddSpecFromPrompt(prompt);
  // Corner-unit class — triangle / quarter-round plates in a 90° corner, never a flat rectangle.
  if (isCornerUnitPrompt(prompt) && !looksLikePocket(prompt)) return cornerSpecFromPrompt(prompt);
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
  const house = detectHouseFamily(lower);
  const trip = triple(t);
  const isSystem = /system|walk-?in|along the wall|wall of closets/.test(lower);
  const topShape: TableTopShape | null = program === "table" ? tableTopShape(lower) : null;
  const isRound = topShape === "round" || (program === "table" && /\b(?:round|circular)\b|\bdiameter\b|\bdia\b/.test(lower) && topShape !== "oval");
  const isOval = topShape === "oval";
  const isSquareTop = topShape === "square";
  // Prefer N diameter / N dia (Tail) over diameter N (Raw): Raw otherwise steals the
  // height from "40 diameter 30 tall" as diameter 30. Harden Raw so a captured number
  // that is immediately an axis label (tall/high/wide/deep/long) is not treated as dia.
  const diameterRaw = pick(
    t,
    /(?:diameter|dia\.?)\s*(?:of\s*)?(\d+(?:\.\d+)?)(?!\d)(?!\s*(?:in|inch|inches|["″])?\s*(?:tall|high|height|H|wide|width|deep|depth|long|length))/i,
    NaN,
  );
  const diameterTail = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:diameter|dia\b)/i, NaN);
  const diameter = Number.isFinite(diameterTail) ? diameterTail : diameterRaw;
  const legs = Math.max(
    3,
    Math.min(4, Math.round(pick(t, /(\d+)\s*(?:-?\s*)legs?/i, program === "table" ? (isRound ? 3 : 4) : 4))),
  );

  let width = spokenAxisInches(t, "w");
  // Paper/HUD/Measure teach Dia×H and W×H×D — bare H is a height axis label
  // (same honesty class as round envelope "40\" dia × 30\" H"). tall|high|height still win.
  let height = spokenAxisInches(t, "h");
  let depth = spokenAxisInches(t, "d");
  // Table plan length — "42 long × 24 wide" is length × plan-width, not a dropped axis.
  const labeledLong = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:long|length)\b/i, NaN);
  // Headboard / slab wall-fit: "60\" wall span" is the typed width.
  if (!Number.isFinite(width)) {
    width = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″])?\s*wall\s*span/i, NaN);
  }
  if (!Number.isFinite(width)) {
    width = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″])?\s*span/i, NaN);
  }
  if (!Number.isFinite(width)) {
    width = pick(t, /spann(?:ing)?\s+(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″])?/i, NaN);
  }
  if (!Number.isFinite(width) && /tool\s*rail|leash\s*rail|pegboard|peg\s*board/.test(lower)) {
    width = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″]|″)?/, NaN);
  }
  if (isPegboard(lower) && (!Number.isFinite(depth) || depth > 4)) depth = 0.75;
  if ((isToolRail(lower) || isLeashRail(lower) || isPegRail(lower)) && (!Number.isFinite(depth) || depth > 8)) depth = 4;
  if ((isToolRail(lower) || isLeashRail(lower) || isPegRail(lower)) && (!Number.isFinite(height) || height > 24)) height = 6;
  if (isKeyMailShelf(lower)) {
    if (!Number.isFinite(depth) || depth > 12) depth = Number.isFinite(depth) ? depth : 6;
    if (!Number.isFinite(height) || height > 24) height = Number.isFinite(height) ? height : 10;
  }
  // Tip-rail hung-open (picture/photo/art ledge + picture/tip rail) — never storage 30×16.
  // Same class as tool/peg rail envelope: shallow D, short H for tipped frames.
  if (isPictureLedge(lower)) {
    if (!Number.isFinite(depth) || depth > 12) depth = Number.isFinite(depth) ? depth : 4;
    if (!Number.isFinite(height) || height > 24) height = Number.isFinite(height) ? height : 6;
  }
  // Ironing board wall mount — board length binds width; shallow mount depth.
  if (isIroningWallMount(lower)) {
    const boardLen = pick(
      t,
      /(?:board|for\s+a)\s+(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″]|″)?/i,
      NaN,
    );
    if (Number.isFinite(boardLen) && (!Number.isFinite(width) || width < boardLen * 0.5)) width = boardLen;
    if (!Number.isFinite(depth) || depth > 12) depth = 6;
    if (!Number.isFinite(height) || height > 36) height = 8;
  }
  // Seating lounge class — honor typed seat H + seat D; square ottoman W=D; never House wire dims.
  if (isSeatingLoungeClass(lower)) {
    const seatH = pick(
      t,
      /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″])?\s*seat\s*(?:height|high|tall)/i,
      NaN,
    );
    const seatHAlt = pick(
      t,
      /seat\s*(?:height|high|tall)[^\d]{0,12}(\d+(?:\.\d+)?)/i,
      NaN,
    );
    const seatH2 = Number.isFinite(seatH)
      ? seatH
      : Number.isFinite(seatHAlt)
        ? seatHAlt
        : pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″])?\s*(?:tall|high|height|H)\b/i, NaN);
    const seatD = pick(
      t,
      /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″])?\s*seat\s*(?:depth|deep)/i,
      NaN,
    );
    const seatDAlt = pick(
      t,
      /seat\s*(?:depth|deep)[^\d]{0,12}(\d+(?:\.\d+)?)/i,
      NaN,
    );
    if (Number.isFinite(seatH2)) height = seatH2;
    if (Number.isFinite(seatD)) depth = seatD;
    else if (Number.isFinite(seatDAlt)) depth = seatDAlt;
    if (isOttoman(lower)) {
      // 24×24×16 tall — square W=D when typed equal; height from tall.
      if (trip.w && trip.h && trip.d) {
        // labeled tall already bound height; prefer square plan from first two when equal-ish
        if (Math.abs(trip.w - trip.h) < 0.05) {
          width = trip.w;
          depth = trip.h;
          if (!Number.isFinite(height) || height === trip.h) height = trip.d;
        } else if (Math.abs(trip.w - trip.d) < 0.05) {
          width = trip.w;
          depth = trip.d;
          height = trip.h;
        } else {
          // W×W×H tall pattern: pair already set W/H/D — force square plan + tall height
          width = trip.w;
          depth = trip.w;
          const tall = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″])?\s*(?:tall|high|height|H)\b/i, NaN);
          if (Number.isFinite(tall)) height = tall;
          else if (trip.d) height = trip.d;
        }
      }
      if (!Number.isFinite(width)) width = 24;
      if (!Number.isFinite(depth)) depth = width;
      if (!Number.isFinite(height)) height = 16;
      // square W=D when one axis missing
      if (Number.isFinite(width) && Number.isFinite(depth) && Math.abs(width - depth) > 0.05) {
        // keep typed; if only one of W/D spoken equal intent via "square"
      }
      if (/square/.test(lower) || (Number.isFinite(width) && !Number.isFinite(depth))) depth = width;
      if (/square/.test(lower) || (Number.isFinite(depth) && !Number.isFinite(width))) width = depth;
    } else if (isLoungeChair(lower) || isRockingChair(lower)) {
      if (!Number.isFinite(width)) width = isRockingChair(lower) ? 26 : 30;
      if (!Number.isFinite(depth)) depth = isLoungeChair(lower) ? 24 : 32;
      if (!Number.isFinite(height)) height = isRockingChair(lower) ? 17 : 16;
    }
  }


  if (isPorchSwingFrame(lower)) {
    if (!Number.isFinite(width)) width = 48;
    if (!Number.isFinite(height)) height = 78;
    if (!Number.isFinite(depth)) depth = 36;
  }

  // Bare desk width before trip steal — "60\" desk … 30 deep × 29 tall" must not become 30×29×30.
  if (!Number.isFinite(width) && (program === "desk" || /\b(?:writing\s+)?desk\b/.test(lower))) {
    const deskW = deskWidthFromPrompt(t);
    if (Number.isFinite(deskW)) width = deskW;
  }

  // "give me a 70 inch table" / "table 70\"" — the number is the plan span.
  // Without this, width falls through to the 40" table class default.
  if (!Number.isFinite(width) && program === "table") {
    const span = tableSpanFromPrompt(t);
    if (Number.isFinite(span)) width = span;
  }

  if (!Number.isFinite(width) && trip.w) {
    // "30 deep × 29 tall" triples as {w:30,h:29} — do not promote that pair to plan width
    // when depth+height are already axis-labeled (desk title W/D echo class).
    const labeledDh =
      Number.isFinite(depth) &&
      Number.isFinite(height) &&
      /(?:deep|depth)/.test(lower) &&
      /(?:tall|high|height)/.test(lower);
    if (!(labeledDh && trip.h != null && trip.d == null)) {
      width = trip.w;
    }
  }

  if (!Number.isFinite(width)) {
    // Universal typed opening width — "31.5 inch linen closet" (adjectives between measure + noun).
    // Superset of the old bare alcove/closet matcher; halves and stock twins both honor typed W.
    const openingW = openingWidthFromPrompt(t);
    if (Number.isFinite(openingW) && !(trip.w && trip.h)) width = openingW;
  }
  if (!Number.isFinite(width)) {
    const nounW = nounSpanFromPrompt(t);
    if (Number.isFinite(nounW) && !(trip.w && trip.h)) width = nounW;
  }
  if (!Number.isFinite(width) && /range\s*hood|kitchen\s*hood|extractor\s*hood|\bhood\b/.test(lower)) {
    width = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")/, 30);
  }
  if (!Number.isFinite(width) && (program === "media" || /\btv\b|television/.test(lower))) {
    const diag = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:tv|television)\b/i, NaN);
    if (Number.isFinite(diag) && diag >= 32 && diag <= 120 && !/(?:wide|width)/.test(lower)) width = diag;
  }
  if (!Number.isFinite(width) && /\bcloset\b/.test(lower) && /\brod\b|\bpole\b/.test(lower)) {
    const rodW = pick(t, /\brod\s+(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?/i, NaN);
    if (Number.isFinite(rodW) && rodW >= 18 && rodW <= 192) width = rodW;
  }

  // Casegoods and shop tops run their length along the front: "workbench 60 long" is 60 wide.
  if (
    program !== "table" &&
    !isPlatformBed(lower) &&
    !isBunkBed(lower) &&
    !isLoftBed(lower) &&
    !Number.isFinite(width) &&
    Number.isFinite(labeledLong)
  ) {
    width = labeledLong;
  }
  if (!Number.isFinite(width)) {
    width =
      trip.w ??
      (program === "desk"
        ? 48
        : program === "vanity"
          ? 36
          : program === "table"
            ? isSideEndTable(lower)
              ? 20
              : 40
            : program === "media"
              ? 60
              : isDaybed(lower)
                ? (mattressDeck(lower)?.length ?? 75)
              : program === "bench"
                ? 48
              : isBedsideShelf(lower)
                ? 18
              : /nightstand/.test(lower) || (/bedside/.test(lower) && !isBedsideShelf(lower))
                ? 20
                : isPlatformBed(lower)
                  ? (mattressDeck(lower)?.width ?? 54)
                : isLaundryFoldDown(lower)
                  ? 48
                : isIroningCabinet(lower)
                  ? 16
                : isMedicineCabinet(lower)
                  ? 16
                : isSpiceCabinet(lower)
                  ? 12
                : isOverToilet(lower)
                  ? 27
                : isWineRack(lower)
                  ? 24
                : /range\s*hood|\bhood\b/.test(lower)
                  ? 30
                : isSofaConsoleTable(lower)
                  ? 48
                : isBunkBed(lower) || isLoftBed(lower)
                  ? framedSleep(lower).width
                : /headboard/.test(lower)
                  ? /king/.test(lower)
                    ? 76
                    : /queen/.test(lower)
                      ? 60
                      : /full|double/.test(lower)
                        ? 54
                        : /twin/.test(lower)
                          ? 39
                          : 36
                : 36);
  }

  // Seat/fitted envelope: typed W×D opening + seat H — opening depth must survive.
  // "entry bench fitted to a 60×20 opening, 18\" seat height" → 60×18×20 (not 60×18×16).
  // "banquette seat fitted to a 72×24 opening, 18\" seat height" → 72×18×24.
  // "window seat … 60×18 opening, 18\" seat height" → 60×18×18.
  // saidAxis is true when "seat height" appears, so the unlabeled W×D branch below
  // does not fire — without this, opening D collapses to the default ~16" case depth.
  // Dresser/carcase keep labeled deep/height axes; this only applies to bench/seat pairs.
  const seatOpeningWd =
    program === "bench" &&
    Boolean(trip.w && trip.h && !trip.d) &&
    (/\bopening\b/.test(lower) || /fitted\s+to/.test(lower));
  if (seatOpeningWd) {
    width = trip.w;
    if (!Number.isFinite(depth)) depth = trip.h;
    // height already from "seat height" / tall|high|height pick when present
  }

  const saidAxis = /wide|width|deep|depth|tall|high|height|long|length|ceiling|(?:^|[^a-z])[hwd](?:$|[^a-z])/.test(lower);
  // Casegoods (desk, media, storage…) read unlabeled triples as W×D×H.
  // Tables are W×H×D — "laundry folding table 48x36x24" means 36 tall × 24 deep,
  // not a 24" coffee height with a 36" deep top.
  // Vanity is casegoods: unlabeled triples are W×D×H (36×21×32 → H32), not middle-as-depth + default 34.
  // Closet/wardrobe/pantry stay opening-oriented; tables keep their own plan-axis rules.
  const furnitureTriple =
    program !== "closet" &&
    program !== "wardrobe" &&
    program !== "pantry" &&
    program !== "table";
  let unlabeledWd = false;
  if (!saidAxis && furnitureTriple && trip.w && trip.h && trip.d) {
    width = trip.w;
    depth = trip.h;
    height = trip.d;
  } else if (!saidAxis && furnitureTriple && trip.w && trip.h && !trip.d && trip.h <= 36 && trip.w >= trip.h) {
    width = trip.w;
    depth = trip.h;
    unlabeledWd = true;
  }

  // A bookcase is never 84" deep and 12" tall. The bigger of the last two is the height.
  if (program === "bookcase" && !saidAxis && trip.w && trip.h && trip.d) {
    const taller = Math.max(trip.h, trip.d);
    const shallower = Math.min(trip.h, trip.d);
    if (taller >= 36 && shallower <= 24 && taller >= shallower + 12) {
      width = trip.w;
      height = taller;
      depth = shallower;
    }
  }

  // Fitted to a named opening: unlabeled triples are W×H×D (opening), not furniture W×D×H.
  const openingFit =
    /fitted\s+to/.test(lower) ||
    /\b(?:the\s+)?opening\s+is\b/.test(lower) ||
    /\b(?:the\s+)?hole\s+is\b/.test(lower) ||
    (/\bopening\b/.test(lower) && /fitted|bookcase|bookshelf|closet|alcove|niche|built-?in/.test(lower));
  if (openingFit && trip.w && trip.h && trip.d) {
    const labeledAll =
      /(?:wide|width)/.test(lower) && /(?:deep|depth)/.test(lower) && /(?:tall|high|height)/.test(lower);
    if (!labeledAll) {
      width = trip.w;
      height = trip.h;
      depth = trip.d;
    }
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

  // Table plan axes (universal): height must not steal a plan dim; long×wide×tall is L×planW×H.
  // "oval coffee 42 long × 24 wide × 18 tall" → W42 × H18 × D24.
  // "square dining 36 × 36 × 30 tall" → W36 × H30 × D36 (third is height, not depth).
  // Oval/square bare triples (42×24×18 / 36×36×30) are also L×planW×H — strangers type that.
  // Rect tables (laundry folding 48x36x24) stay unlabeled W×H×D.
  if (program === "table" && !isRound && !Number.isFinite(diameter)) {
    const labeledWide = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:wide|width)/i, NaN);
    const labeledTall = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:tall|high|height|H)\b/i, NaN);
    const labeledDeep = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:deep|depth)/i, NaN);
    if (Number.isFinite(labeledLong)) {
      width = labeledLong;
      if (Number.isFinite(labeledWide)) depth = labeledWide;
      else if (trip.h && !trip.d && !Number.isFinite(labeledDeep)) depth = trip.h;
      // "84 inches long" is one plan axis. Do not square it into an 84×84 top.
      else if (!trip.h && !Number.isFinite(labeledDeep)) depth = /coffee/.test(lower) ? 22 : 36;
    } else if (Number.isFinite(labeledWide)) {
      width = labeledWide;
    }
    if (Number.isFinite(labeledTall)) height = labeledTall;
    if (Number.isFinite(labeledDeep)) depth = labeledDeep;

    // Unlabeled pair is the footprint, not the height.
    // "70 in by 28 in" → 70 wide × 30 high × 28 deep (fills that plan).
    // A third number stays laundry W×H×D ("48x36x24").
    if (
      !isOval &&
      !isSquareTop &&
      trip.w &&
      trip.h &&
      !trip.d &&
      !Number.isFinite(labeledWide) &&
      !Number.isFinite(labeledTall) &&
      !Number.isFinite(labeledDeep) &&
      !Number.isFinite(labeledLong)
    ) {
      width = trip.w;
      depth = trip.h;
      height = tableClassHeight(lower);
    }

    // "36 by 24 and 20 inches tall" — the pair is the top, the third number is height.
    if (
      trip.w &&
      trip.h &&
      !trip.d &&
      Number.isFinite(height) &&
      Math.abs(height - trip.w) > 0.05 &&
      Math.abs(height - trip.h) > 0.05 &&
      !Number.isFinite(labeledDeep) &&
      !Number.isFinite(labeledWide)
    ) {
      width = trip.w;
      depth = trip.h;
    }

    // Three typed numbers on a table or bench are W × D × H.
    // "coffee table 48 x 24 x 18" is 48 wide, 24 deep, 18 tall.
    if (
      trip.w &&
      trip.h &&
      trip.d &&
      !/(?:wide|width|deep|depth|tall|high|height|long|length)/.test(lower)
    ) {
      width = trip.w;
      depth = trip.h;
      height = trip.d;
    }
    if (
      (isOval || isSquareTop) &&
      trip.w &&
      trip.h &&
      trip.d &&
      !/(?:wide|width|deep|depth|tall|high|height|long|length)/.test(lower)
    ) {
      if (isSquareTop && Math.abs(trip.w - trip.h) < 0.05) {
        width = trip.w;
        depth = trip.w;
        height = trip.d;
      } else {
        width = trip.w;
        depth = trip.h;
        height = trip.d;
      }
    }

    // Triple + labeled height matching one slot → remaining two are plan W×D in typed order.
    if (trip.w && trip.h && trip.d && Number.isFinite(height)) {
      const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
      const slots: Array<{ key: "w" | "h" | "d"; n: number }> = [
        { key: "w", n: trip.w },
        { key: "h", n: trip.h },
        { key: "d", n: trip.d },
      ];
      const heightHits = slots.filter((s) => near(s.n, height));
      // Prefer the last matching slot when duplicates (square 36×36×30 tall → height is the 30).
      const heightSlot = heightHits.length ? heightHits[heightHits.length - 1] : null;
      if (heightSlot && (Number.isFinite(labeledTall) || /\d[^\d]{0,12}(?:tall|high|height|H)\b/i.test(t))) {
        const plan = slots.filter((s) => s.key !== heightSlot.key).map((s) => s.n);
        if (plan.length === 2) {
          if (!Number.isFinite(labeledLong) && !Number.isFinite(labeledWide)) width = plan[0];
          if (!Number.isFinite(labeledDeep) && !(Number.isFinite(labeledLong) && Number.isFinite(labeledWide))) {
            depth = plan[1];
          }
        }
      }
    }

    if (isSquareTop) {
      // Square top: force plan W=D from the larger honest plan dim (or the equal pair).
      if (Number.isFinite(width) && Number.isFinite(depth) && Math.abs(width - depth) > 0.05) {
        // Only collapse when one axis was clearly the stolen height twin.
        if (Number.isFinite(height) && (Math.abs(width - height) < 0.05 || Math.abs(depth - height) < 0.05)) {
          const other = Math.abs(width - height) < 0.05 ? depth : width;
          width = other;
          depth = other;
        }
      } else if (Number.isFinite(width) && !Number.isFinite(depth)) {
        depth = width;
      } else if (Number.isFinite(depth) && !Number.isFinite(width)) {
        width = depth;
      } else if (trip.w && trip.h && !trip.d) {
        width = trip.w;
        depth = trip.h;
      }
      if (Number.isFinite(width) && Number.isFinite(depth)) {
        // Equalize to typed square when both plan dims present and close, or force equal from first.
        if (Math.abs(width - depth) < 0.05) {
          /* already square */
        } else if (trip.w && trip.h && Math.abs(trip.w - trip.h) < 0.05) {
          width = trip.w;
          depth = trip.w;
        }
      }
    }

    if (isOval && Number.isFinite(labeledLong) && Number.isFinite(labeledWide)) {
      width = labeledLong;
      depth = labeledWide;
    }
  }

  // Platform / bunk / loft beds: wide × long × tall → W × H × D(length). Never drop length.
  if (isPlatformBed(lower) || isBunkBed(lower) || isLoftBed(lower)) {
    const labeledWide = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:wide|width)/i, NaN);
    const labeledTall = pick(t, /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:tall|high|height|H)\b/i, NaN);
    if (Number.isFinite(labeledWide)) width = labeledWide;
    if (Number.isFinite(labeledLong)) depth = labeledLong;
    if (Number.isFinite(labeledTall)) height = labeledTall;
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

  // Axes the stranger typed — class-default densify uses prompt digits (width-only linen ≠ stock H;
  // bare vanity/chest must not treat stock fills as typed). Capture before height/depth class defaults
  // so stock fills never flip labeled flags.
  // Universal densify gate (opening-storage + vanity + chest + floor-carcase class defaults) — not a program whitelist.
  const classDefaultTitleHonesty = isClassDefaultDensifyPrompt(prompt);
  const typedAxes = classDefaultTitleHonesty
    ? typedClassDefaultAxes(prompt)
    : {
        width: Number.isFinite(width),
        height: Number.isFinite(height) && height !== 0,
        depth: Number.isFinite(depth),
      };

  // A 4×8 raised bed is the footprint. The wall stays a bed height, not 8 feet tall.
  if (isPlanterBox(lower) && trip.w && trip.h && !trip.d && !/(?:tall|high|height)\b/.test(lower)) {
    width = trip.w;
    depth = trip.h;
    height = 16;
  }

  if (!Number.isFinite(height) || height === 0) {
    if (program === "table") {
      const consumedAsDepth =
        trip.h != null &&
        !trip.d &&
        Number.isFinite(depth) &&
        Math.abs(depth - trip.h) < 0.05;
      height = !consumedAsDepth && trip.h && trip.h < 42 ? trip.h : tableClassHeight(lower);
    } else if (program === "media") {
      if (trip.h && trip.d) height = trip.h;
      else height = 22;
    } else if (program === "desk") {
      // "desk 4' by 20 inches deep" — 20 is depth. Desk height stays 29.
      const pairIsDepth =
        trip.h != null &&
        !trip.d &&
        Number.isFinite(depth) &&
        Math.abs(depth - trip.h) < 0.05;
      // A standing shop top works at counter height, not a 29" desk.
      const deskH = isStandingShopTop(lower) ? 36 : 29;
      if (unlabeledWd || pairIsDepth) {
        height = deskH;
      } else {
        height = trip.d && trip.d < 42 ? trip.d : trip.h ?? deskH;
        if (trip.h && trip.h < 42 && trip.d && trip.d > 14) {
          depth = trip.h;
          height = trip.d;
        } else if (trip.h && !Number.isFinite(depth)) depth = trip.h;
      }
    } else if (program === "bench") {
      if (isDaybed(lower) && !/(?:tall|high|height)\b/.test(lower)) {
        height = 22;
      } else {
        height = trip.d && trip.d < 42 ? trip.d : trip.h ?? 18;
        if (trip.h && trip.h < 42 && trip.d && trip.d > 14) {
          depth = trip.h;
          height = trip.d;
        } else if (trip.h && !Number.isFinite(depth)) depth = trip.h;
      }
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
          : isKidsBookcase(lower)
            ? KIDS_BOOKCASE_H
            : isBedsideShelf(lower)
              ? 6
            : /nightstand/.test(lower) || (/bedside/.test(lower) && !isBedsideShelf(lower))
              ? 24
            : isPlatformBed(lower)
              ? 14
            : /island/.test(lower)
              ? 36
              : /crate/.test(lower)
                ? 30
                : isLaundryFoldDown(lower)
                  ? 36
                : isIroningCabinet(lower)
                  ? 48
                : isRadiatorCover(lower)
                  ? 30
                : isMedicineCabinet(lower)
                  ? 24
                : isSpiceCabinet(lower)
                  ? 20
                : isOverToilet(lower)
                  ? 68
                : isSpiceRack(lower)
                  ? 24
                : isWineRack(lower)
                  ? 36
                : isToolRail(lower)
                  ? 6
                : isPegboard(lower)
                  ? (trip.h ?? 36)
                : isLumberRack(lower)
                  ? (trip.h ?? 72)
                : isPortalHookRail(lower) || (/coat/.test(lower) && /rack|rail|hook|peg/.test(lower))
                  ? 6
                  : isPortalSpanShelf(lower)
                    ? (trip.h && trip.h >= 60 ? trip.h : 80)
                  : /range\s*hood|\bhood\b/.test(lower)
                    ? 24
                  : isShoeStorage(lower)
                    ? 18
                    : isKitchenBase(lower)
                      ? 34.5
                    : isKitchenUpper(lower)
                      ? 30
                    : isDaybed(lower)
                      ? 22
                    : isSofaConsoleTable(lower)
                      ? 30
                    : isBunkBed(lower) || isLoftBed(lower)
                      ? 65
                    : isPictureLedge(lower)
                      ? 6
                    : spokenBracketCount(t) != null && /shel/.test(lower)
                      ? Math.min(8, Math.max(6, Number.isFinite(depth) ? depth : 8))
                    : /floating/.test(lower) && /shel/.test(lower)
                      ? 3.25
                    : /shelf/.test(lower) && !/bookcase|bookshelf/.test(lower)
                      ? 18
                    : isStorageHutch(lower)
                      ? 72
                  : program === "storage"
                    ? 30
                    : /linen/.test(lower)
                      ? 78
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
              : isSofaConsoleTable(lower)
                ? 14
              : program === "table"
                ? width
                : /headboard/.test(lower)
                  ? 4
                  : isLaundryFoldDown(lower) || isFoldDown(lower) || isIroningCabinet(lower)
                    ? 6
                  : isRadiatorCover(lower)
                    ? 10
                  : isMedicineCabinet(lower)
                    ? 4
                  : isSpiceCabinet(lower)
                    ? 4.5
                  : isOverToilet(lower)
                    ? 9
                  : (/coat/.test(lower) || program === "bench") && /\bbench\b/.test(lower)
                    ? 16
                  : /coat/.test(lower) && /rack/.test(lower)
                    ? 8
                    : /range\s*hood|\bhood\b/.test(lower)
                      ? 18
                    : isKitchenBase(lower)
                      ? 24
                    : isKitchenUpper(lower)
                      ? 12
                    : isDaybed(lower)
                      ? (mattressDeck(lower)?.width ?? 39)
                    : isPlatformBed(lower)
                      ? (mattressDeck(lower)?.length ?? 75)
                    : isBunkBed(lower) || isLoftBed(lower)
                      ? framedSleep(lower).length
                    : isBedsideShelf(lower)
                      ? 8
                    : isPictureLedge(lower)
                      ? 4
                    : /dresser/.test(lower)
                      ? 18
                      : /crate/.test(lower)
                        ? 24
                      : /floating/.test(lower) && /shel/.test(lower)
                        ? 8
                        : isPortalSpanShelf(lower)
                          ? 4
                        : isPortalHookRail(lower) || isTowelPortalRail(lower)
                          ? 4
                        : isSpiceRack(lower)
                          ? 4
                        : isWineRack(lower)
                          ? 12
                        : house?.family === "hung-cabinet"
                          ? 12
                        : /shelf|rack/.test(lower)
                          ? 12
                          : 16);
  }

  // Member stock: an untyped axis does not outgrow a typed axis.
  // Only when the prompt names a stick, dowel, pipe, or other member stock.
  // Unnamed stock is a wire placeholder with a dowel form — that must not cap
  // a class height. A single typed number sets one axis; the class default fills the rest.
  const member = detectMaterial(prompt);
  const namedMember =
    !isWireStock(member) &&
    (member.formFactor === "stick" ||
      member.formFactor === "dowel" ||
      member.formFactor === "pipe" ||
      member.formFactor === "tube" ||
      member.formFactor === "block" ||
      member.formFactor === "roll");
  if (namedMember) {
    const typed = [
      typedAxes.width ? width : NaN,
      typedAxes.height ? height : NaN,
      typedAxes.depth ? depth : NaN,
    ].filter((n) => Number.isFinite(n));
    if (typed.length > 0 && typed.length < 3) {
      const cap = Math.max(...typed);
      if (!typedAxes.width) width = Math.min(width, cap);
      if (!typedAxes.height) height = Math.min(height, cap);
      if (!typedAxes.depth) depth = Math.min(depth, cap);
    }
  }

  // Opening-fit W×H×D must win over furniture defaults (e.g. bookcase depth 12).
  if (openingFit && trip.w && trip.h && trip.d) {
    const labeledAll =
      /(?:wide|width)/.test(lower) && /(?:deep|depth)/.test(lower) && /(?:tall|high|height)/.test(lower);
    if (!labeledAll) {
      width = trip.w;
      height = trip.h;
      depth = trip.d;
    }
  }

  const typedDepth = /deep|depth/.test(lower);
  if (house && house.affordances.includes("jar-lips") && !typedDepth && !(trip.d && !saidAxis)) {
    depth = 4;
  }

  let bays: number | undefined;
  // Spoken "three open bays" / "3 bays" — AV tower + media cut-list honesty.
  const spokenBaysDigit = lower.match(/\b(\d+)\s*(?:open\s+)?bays?\b/);
  const spokenBaysWord = lower.match(/\b(two|three|four|five|six)\s+(?:open\s+)?bays?\b/);
  const spokenBayWords: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6 };
  const spokenBays = spokenBaysDigit
    ? parseInt(spokenBaysDigit[1], 10)
    : spokenBaysWord
      ? spokenBayWords[spokenBaysWord[1]]
      : NaN;
  if (Number.isFinite(spokenBays) && spokenBays >= 2 && spokenBays <= 8) {
    // Wide media can take vertical bay dividers; narrow AV towers / filing shelves stack open bays on shelves.
    if (!(isAvTower(lower) || isFilingShelf(lower) || (program === "media" && width < 36))) {
      bays = spokenBays;
    }
  } else if (
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
  // Bare workbench / potting bench is a standing shop top — never invent desk knee clearance.
  // Door-carcase vanity: typed doors → no invent knee (pocket early-return already set knee).
  // Drawers+doors vanity also skips knee unless knee/sit/chair/open is typed.
  const vanityDoorsSaid =
    program === "vanity" && /door/.test(lower) && !isDoorPortal(lower);
  const kneeW = isStandingShopTop(lower)
    ? /knee|sit|chair/.test(lower)
      ? pick(
          t,
          /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*knee/i,
          pick(t, /knee[^\d]{0,24}(\d+(?:\.\d+)?)/i, 24),
        )
      : undefined
    : /knee|sit|chair|open/.test(lower)
      ? pick(
          t,
          /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*knee/i,
          pick(t, /knee[^\d]{0,24}(\d+(?:\.\d+)?)/i, 24),
        )
      : program === "desk" || (program === "vanity" && !vanityDoorsSaid)
        ? Math.round(Math.min(24, Math.max(18, width * 0.4)) * 16) / 16
        : undefined;
  // "Kitchen upper cabinet" is a hung box — not a vanity upperStart at 54".
  const upperStart =
    /upper/.test(lower) && !isKitchenUpper(lower) && !/upper\s+cabinet/.test(lower)
      ? pick(t, /upper[^\d]{0,40}(\d+(?:\.\d+)?)/i, 54)
      : program === "vanity" && height >= 72
        ? 54
        : isStorageHutch(lower) && height >= 60
          ? 36
        : undefined;
  const linen = /linen|towel/.test(lower);
  const rod =
    /rod|hang|rail/.test(lower) ||
    program === "wardrobe" ||
    (program === "closet" && isSystem && !linen);
  const spokenShelves = spokenShelfCount(t);
  const shelfCount = spokenShelves != null
    ? Math.max(1, Math.min(12, spokenShelves))
    : pick(
    t,
    /(\d+)\s*shel(?:f|ves|ving)/i,
    program === "bookcase"
      ? 5
      : program === "closet"
        ? rod
          ? 1
          : 4
        : program === "pantry" || program === "wardrobe"
          ? 4
          : program === "media"
            ? isMediaShelf(lower) || wantsSoundbarHold(lower)
              ? 1
              : isAvTower(lower) || (Number.isFinite(spokenBays) && spokenBays >= 2)
                ? // N open bays → N-1 intermediate shelves between bottom and top.
                  Math.max(1, (Number.isFinite(spokenBays) ? spokenBays : 3) - 1)
                : 2
            : isShoeStorage(lower)
              ? Math.max(2, Math.min(5, Math.round((height - P) / 6)))
              : /crate/.test(lower)
                ? 0
                : isLaundryFoldDown(lower) || isFoldDown(lower) || isIroningCabinet(lower)
                  ? 0
                : isRadiatorCover(lower)
                  ? 0
                : isMedicineCabinet(lower)
                  ? 2
                : isOverToilet(lower)
                  ? 3
                : isSpiceRack(lower)
                  ? 3
                : isWineRack(lower)
                  ? Math.max(3, Math.min(10, Math.round((height - P) / 4.5)))
                : isKitchenBase(lower) || isKitchenUpper(lower)
                  ? 1
                : isBunkBed(lower)
                  ? 0
                : isPortalSpanShelf(lower)
                  ? 1
                : isToolRail(lower) || isLeashRail(lower) || isPegRail(lower) || isKeyMailShelf(lower) || isPegboard(lower)
                  ? 0
                : isFilingShelf(lower) && Number.isFinite(spokenBays) && spokenBays >= 2
                  ? Math.max(1, spokenBays - 1)
                : isFilingShelf(lower)
                  ? 3
                : isLumberRack(lower)
                  ? 0
                : isButcherCart(lower) || isServingCart(lower)
                  ? 2
                : isUtilityShelf(lower) || isOpenKitchenShelving(lower)
                  ? 3
                // Singular floating / lip shelf — never invent a 3-shelf stack for one board.
                : ((/floating|wall-?mounted/.test(lower) || /\bwith\s+(?:a\s+)?lip\b|\blip\b/.test(lower)) &&
                    /\bshelf\b/.test(lower) &&
                    !/\bshelves\b/.test(lower))
                  ? 1
                : (/shel(?:f|ves|ving)/.test(lower) && !/coat/.test(lower) && !(program === "desk" && /media\s*shelf|shelf behind|laptop/.test(lower)))
                ? 3
                : (program === "desk" && /media\s*shelf|shelf behind|laptop/.test(lower))
                  ? 0
                : isStandingShopTop(lower)
                  ? 0
                : isStorageHutch(lower)
                  ? 3
                : /nightstand|bedside/.test(lower)
                  ? 1
                // A rack is posts plus the tiers that hold the load. A rail or arm rack stays open.
                : /\bracks?\b/.test(lower) && !isLumberRack(lower) && !isDryingRack(lower) && !/rail|peg|hook|coat/.test(lower)
                  ? 3
                // A cabinet is an enclosed carcase. Named contents do not erase the shelves.
                : /cabinet/.test(lower) && !/rack|open/.test(lower)
                  ? 2
                  : 0,
  );
  const spokenCubbies = spokenCubbyCount(t);
  const cubbiesSaid = spokenCubbies != null ? spokenCubbies : pick(t, /(\d+)\s*cubb/i, NaN);
  // Mudroom / entry benches need cubby dividers so a ~48" seat does not sag under a sitting adult.
  // Open cubby walls honor spoken N ("six cubbies") before width defaults.
  const cubbies =
    Number.isFinite(cubbiesSaid) && cubbiesSaid >= 2
      ? cubbiesSaid
      : program === "bench" && !isDaybed(lower)
        ? Math.max(2, Math.min(4, Math.round(width / 16)))
        : isShoeStorage(lower)
          ? Math.max(2, Math.min(8, Math.round(width / 6)))
          : house?.affordances?.includes("cubbies") && house.family === "floor-carcase" && wantsShoes(lower)
            ? Math.max(2, Math.min(8, Math.round(width / 6)))
            : NaN;
  // Door-carcase vanity: typed doors without drawers → no invent drawer banks.
  // Honor typed drawers (with or without doors). Bare vanity (no doors typed) still densifies drawers.
  // Spoken no/zero/without/drawerless drawers — never silent-collapse to banks (desk/nightstand/dresser/vanity).
  const drawers = isNoDrawersPrompt(lower)
    ? false
    : /drawer/.test(lower) ||
      (program === "vanity" && !vanityDoorsSaid) ||
      (program === "desk" && !isStandingShopTop(lower)) ||
      (isStandingShopTop(lower) && /drawer/.test(lower)) ||
      (/nightstand/.test(lower) || (/bedside/.test(lower) && !isBedsideShelf(lower)) || /dresser|file\s*cabinet/.test(lower) || (/\bfiling\b/.test(lower) && !isFilingShelf(lower)) || (/\bchest\b/.test(lower) && !isHingedLidChest(lower))) && !isBedsideShelf(lower) && !isStorageHutch(lower);
  const doors =
    (/cabinet/.test(lower) && !/rack|open/.test(lower)) ||
    (/door/.test(lower) && !isDoorPortal(lower)) ||
    /crate/.test(lower) ||
    isIroningCabinet(lower) ||
    isLaundryFoldDown(lower) ||
    isFoldDown(lower) ||
    isMedicineCabinet(lower) ||
    (program === "closet" && !/coat/.test(lower)) ||
    program === "pantry" ||
    program === "wardrobe" ||
    (program === "vanity" && height >= 54) ||
    isStorageHutch(lower) ||
    !!house?.affordances.includes("door");
  const doorsFinal =
    isNoDoorsPrompt(lower) ||
    isBunkBed(lower) ||
    isLoftBed(lower) ||
    isDaybed(lower) ||
    isButcherCart(lower) ||
    isServingCart(lower) ||
    isSlotRack(lower) ||
    isOpenKitchenShelving(lower) ||
    isFilingShelf(lower) ||
    isPrinterStand(lower) ||
    isKitchenIsland(lower) ||
    isPrepTable(lower) ||
    (program === "media" && !/door/.test(lower))
      ? false
      : doors;
  // Door-carcase vanity: never invent a mirror when doors were typed (pocket early-return sets mirror).
  const mirror =
    /mirror/.test(lower) ||
    (program === "vanity" && !vanityDoorsSaid) ||
    isMedicineCabinet(lower);

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

  // BATCH6_OPENING_FIT_FINAL: keep braced so minify cannot comma-fold into neighboring ifs.
  if (typeof openingFit !== "undefined" && openingFit && trip.w && trip.h && trip.d) {
    const axisLabeledAll =
      /(?:wide|width)/.test(lower) && /(?:deep|depth)/.test(lower) && /(?:tall|high|height)/.test(lower);
    if (!axisLabeledAll) {
      width = Number(trip.w);
      height = Number(trip.h);
      depth = Number(trip.d);
    }
  }

  // BATCH10_SEAT_OPENING_WD: seat/fitted W×D opening — honor typed opening D (not default 16).
  if (typeof seatOpeningWd !== "undefined" && seatOpeningWd) {
    width = Number(trip.w);
    depth = Number(trip.h);
  }

  // Three typed numbers on a table or bench are W × D × H, after every other axis pass.
  if (
    (program === "table" || program === "bench") &&
    trip.w &&
    trip.h &&
    trip.d &&
    !/\bfold/.test(lower) &&
    !/(?:wide|width|deep|depth|tall|high|height|long|length)/.test(lower) &&
    !/\bopening\b/.test(lower)
  ) {
    width = trip.w;
    depth = trip.h;
    height = trip.d;
  }

  const unit: FittedUnit = {

    width,
    depth,
    height,
    counterH,
    kneeW,
    upperStart,
    shelfCount: shelfCount || undefined,
    cubbies: Number.isFinite(cubbies) && cubbies >= 2 ? cubbies : undefined,
    drawersPerBank: drawers
      ? spokenDrawerCount(lower) ?? (isBedsideShelf(lower) ? undefined : /nightstand/.test(lower) || (/bedside/.test(lower) && !isBedsideShelf(lower)) ? 1 : 3)
      : undefined,
    doors: doorsFinal,
    mirror,
    rod,
    centered: true,
    legs: program === "table" ? legs : undefined,
    shape: program === "table"
      ? isOval
        ? "oval"
        : isRound || Number.isFinite(diameter)
          ? "round"
          : isSquareTop
            ? "square"
            : "rect"
      : undefined,
    bays,
  };

  const names: Record<FittedProgram, string> = {
    vanity: "Vanity",
    closet: "Closet",
    pantry: "Pantry",
    wardrobe: "Wardrobe",
    desk: "Desk",
    bookcase: "Bookcase",
    media: "Media console",
    bench: "Bench",
    storage: "Storage unit",
    table: "Table",
  };

  const identityStem = identityTitleStem(lower);
  const sitStem = sitBenchTitleStem(lower);
  const titleStem =
    /coffee/.test(lower) && /table/.test(lower)
      ? "Coffee table"
      : isFoldingTable(lower)
        ? "Folding table"
      : isPrepTable(lower)
        ? "Prep table"
      : isDiningTable(lower)
        ? "Dining table"
      : isKitchenIsland(lower)
        ? "Kitchen island"
      : isServingCart(lower)
        ? "Serving cart"
      : isButcherCart(lower)
        ? (/butcher/.test(lower) ? "Butcher block cart" : "Kitchen cart")
      : isSlotRack(lower)
        ? slotRackTitle(lower)
      : isOpenKitchenShelving(lower)
        ? (/open\s+kitchen\s+shelving|kitchen\s+shelving/.test(lower) ? "Open kitchen shelving" : "Open shelving")
      : isUtilityShelf(lower)
        ? "Utility shelf"
      : isLaundrySorter(lower)
        ? "Laundry sorter"
      : isDryingRack(lower)
        ? "Drying rack"
      : isIroningWallMount(lower)
        ? "Ironing board wall mount"
      : isPottingBench(lower)
        ? "Potting bench"
      : isRockingChair(lower)
        ? "Rocking chair"
      : isLoungeChair(lower)
        ? "Lounge chair"
      : isOttoman(lower)
        ? "Ottoman"
      : isPlanterBox(lower)
        ? "Planter box"
      : isSideEndTable(lower)
        ? sideEndTableStem(lower)
      : isOutdoorSideTable(lower)
        ? /outdoor/.test(lower) ? "Outdoor side table" : "Side table"
      : isWorkbench(lower)
        ? "Workbench"
      : isPegboard(lower)
        ? "Pegboard"
      : isToolRail(lower)
        ? "Tool rail"
      : isLeashRail(lower)
        ? "Leash rail"
      : isPegRail(lower)
        ? "Peg rail"
      : isPrinterStand(lower)
        ? "Printer stand"
      : isFilingShelf(lower)
        ? "Filing shelf"
      : isKeyMailShelf(lower)
        ? "Key and mail shelf"
      : isCoatCubbyWall(lower)
        ? "Coat and cubby wall"
      : isLumberRack(lower)
        ? "Lumber rack"
      : isPortalSpanShelf(lower)
        ? portalSpanShelfTitle(lower)
      : isPortalHookRail(lower)
        ? portalHookRailTitle(lower)
      : isOpenCubbyWall(lower) || isMudroomCubbyWall(lower)
        ? openCubbyWallTitle(lower)
      : sitStem
        ? sitStem
        : isFilingShelf(lower)
          ? "Filing shelf"
        : /file\s*cabinet|filing\s*cabinet|\bfiling\b/.test(lower)
          ? "File cabinet"
          : isHingedLidChest(lower)
            ? isToyChest(lower) ? "Toy chest" : isStorageBox(lower) ? storageBoxTitleStem(lower) : "Chest"
          : /\bchest\b/.test(lower) && !/medicine/.test(lower)
            ? isToyChest(lower) || /toy/.test(lower) ? "Toy chest" : "Chest"
            : /dresser/.test(lower)
              ? "Dresser"
              : isBedsideShelf(lower)
                ? "Bedside shelf"
              : isPlatformBed(lower)
                ? "Platform bed"
              : /nightstand/.test(lower) || (/bedside/.test(lower) && !isBedsideShelf(lower))
                ? "Nightstand"
                : isIroningWallMount(lower)
              ? "Ironing board wall mount"
                : isIroningCabinet(lower)
              ? "Ironing cabinet"
              : isMedicineCabinet(lower)
                ? "Medicine cabinet"
                : isOverToilet(lower)
                  ? "Over-toilet"
                  : isSpiceRack(lower)
                    ? "Spice rack"
                    : isWineRack(lower)
                      ? "Wine rack"
                      : isCoatCubbyWall(lower)
                        ? "Coat and cubby wall"
                      : /coat/.test(lower) && /rack|rail|rod|hook|peg|tree/.test(lower) && !isCoatCubbyWall(lower)
                        ? /rod/.test(lower)
                          ? "Coat rod"
                          : /rail/.test(lower)
                            ? "Coat rail"
                            : "Coat rack"
                        : identityStem
                            ? identityStem
                            : /headboard/.test(lower)
                              ? "Headboard"
                              : /crate/.test(lower)
                                ? "Crate"
                                : /island/.test(lower)
                                  ? "Kitchen island"
                                  : /range\s*hood|\bhood\b/.test(lower)
                                    ? "Range hood"
                                    : /floating/.test(lower) && /shelves/.test(lower)
                                      ? "Floating shelves"
                                      : /floating/.test(lower) && /shelf/.test(lower)
                                        ? "Floating shelf"
                                      : house?.family === "hung-open" && house.affordances.includes("jar-lips")
                                        ? "Jar rack"
                                        : house?.family === "hung-open" && house.affordances.includes("bottle-rails")
                                          ? "Bottle rack"
                                          : house?.family === "hung-open"
                                            ? "Wall rack"
                                            : house?.family === "hung-cabinet"
                                              ? "Wall cabinet"
                                              : /cabinet/.test(lower) && !/\bracks?\b/.test(lower)
                                                ? cabinetStem(lower)
                                              : names[program];

  if (typeof openingFit !== "undefined" && openingFit && trip.w && trip.h && trip.d) {
    const axisLabeledAll =
      /(?:wide|width)/.test(lower) && /(?:deep|depth)/.test(lower) && /(?:tall|high|height)/.test(lower);
    if (!axisLabeledAll) {
      width = Number(trip.w);
      height = Number(trip.h);
      depth = Number(trip.d);
      unit.width = width;
      unit.height = height;
      unit.depth = depth;
    }
  }
  if (typeof seatOpeningWd !== "undefined" && seatOpeningWd) {
    width = Number(trip.w);
    depth = Number(trip.h);
    unit.width = width;
    unit.depth = depth;
  }

  const tableShape: TableTopShape | null =
    program === "table"
      ? isOval
        ? "oval"
        : isRound || Number.isFinite(diameter)
          ? "round"
          : isSquareTop
            ? "square"
            : "rect"
      : null;
  const shapePrefix = tableShapeTitlePrefix(tableShape === "rect" ? null : tableShape);
  const displayName =
    tableShape === "round"
      ? `${shapePrefix}${titleStem} ${width}" × ${height}"`
      : classDefaultTitleHonesty && typedAxes && !(typedAxes.width && typedAxes.height && typedAxes.depth)
        ? stampTypedAxesTitle(
            `${shapePrefix}${titleStem}`,
            typedAxes,
            { width, height, depth },
          )
      : `${shapePrefix}${titleStem} ${width}" × ${height}" × ${depth}"`;

  return {
    program,
    name: displayName,
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
    family: house?.family,
    affordances: house?.affordances,
    typedAxes,
  };
}

/** Universal usable clear height between shelves (general storage). */
export const SHELF_MIN_CLEAR = 7;
/** Kids bookcase: a child reaches the top shelf (36–48" range), and it still gets anchored. */
const KIDS_BOOKCASE_H = 42;
export function isKidsBookcase(lower: string): boolean {
  return /\b(?:kids?|kid'?s|kids'|child(?:ren)?(?:'?s)?|toddlers?|nursery|playroom)\b/.test(lower) && /\b(?:bookcases?|bookshel(?:f|ves)|book\s+shel(?:f|ves))\b/.test(lower);
}
/** Shoe tier clear height (a pair of everyday shoes stands in about 6–7"). */
const SHOE_TIER_CLEAR = 7;
/** Shoe bay clear width (a pair side by side). */
const SHOE_BAY_MIN = 9;
/** Default clear between stacked wall shelves when no height is typed. */
const SHELF_DEFAULT_CLEAR = 10;

function panel(
  type: Panel["type"],
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  materialId?: string,
): Panel {
  const thinBack = type === "back" && Math.min(w, h, d) <= 0.26;
  return {
    id: createId(type.slice(0, 2)),
    type,
    name,
    position: { x, y, z },
    size: { width: w, height: h, depth: d },
    materialId: materialId ?? (thinBack ? PLY_BACKER : PLY),
  };
}

/** Dowels sticking out of a rail so a coat rack reads as a coat rack, not a shelf. */
function pushPegs(
  panels: Panel[],
  count: number,
  x0: number,
  y: number,
  z: number,
  span: number,
  stick = 3.25,
  thick = 0.75,
  nose = false,
  label = "Peg",
) {
  const n = Math.max(2, Math.min(12, Math.round(count)));
  const peg = thick;
  const inset = Math.min(Math.max(1.25, span * 0.06), 3);
  const usable = Math.max(peg, span - inset * 2 - peg);
  const knobW = Math.round((peg + 0.5) * 8) / 8;
  for (let i = 0; i < n; i++) {
    const x = x0 + inset + (usable * i) / Math.max(1, n - 1);
    panels.push(panel("rail", `${label} ${i + 1}`, x, y, z, peg, peg, stick));
    if (!nose) continue;
    // Wider than the peg, dropped, still ¾" so the cut stays a peg stop — not a laminated leg.
    panels.push(
      panel(
        "rail",
        `${label} stop`,
        x - (knobW - peg) / 2,
        Math.max(0, y - 0.5),
        z + stick,
        knobW,
        peg,
        peg,
      ),
    );
  }
}

/**
 * One hall tree: cubby bench, then hooks on the back, hat shelf at the top.
 * A coat is ~36" long, so a higher hook does not lift it off a sitting person.
 * The coat hangs a few inches off the back. The seat is in front of that.
 * Overall height moves the hat shelf. Hooks stay near 64" so an adult can reach them.
 */
function buildCoatBench(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const W = u.width;
  const D = Math.max(u.depth, 14);
  const typedH = u.height;
  const lower = prompt.toLowerCase();
  const seatSaid = lower.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*seat(?:\s*height)?\b|seat(?:\s*height)?\s*(?:of\s*)?(\d+(?:\.\d+)?)/);
  const seatH = seatSaid
    ? Math.min(22, Math.max(16, parseFloat(seatSaid[1] || seatSaid[2] || "18")))
    : 18;
  const overallH = typedAxisOrUsual(prompt, "height", typedH >= 48 ? typedH : 72);
  const x0 = -W / 2;
  const post = 1.5;
  const rows = readHookRows(prompt);
  const hatBottom = overallH - P;
  const adultCenter = Math.min(64, hatBottom - 6);
  const kidCenter = 42;
  const showAdult = rows !== "kids";
  const showKids = rows !== "adult" && (rows === "kids" || adultCenter - kidCenter >= 12);
  const pegN = Math.max(3, Math.min(8, Math.round(W / 8)));
  const innerX = x0 + post;
  const innerW = W - post * 2;
  const bayW = innerW - P * 2;
  const cubbyN = u.cubbies && u.cubbies >= 2 ? u.cubbies : Math.max(2, Math.min(4, Math.round(W / 16)));
  const apronH = 3.5;
  const panels: Panel[] = [];
  panels.push(panel("upright", "Left post", x0, 0, 0, post, overallH, post, TWO_BY_TWO));
  panels.push(panel("upright", "Right post", x0 + W - post, 0, 0, post, overallH, post, TWO_BY_TWO));
  panels.push(panel("back", "Back", innerX, 0, 0, innerW, hatBottom, P));
  panels.push(panel("upright", "Left upright", innerX, 0, P, P, seatH, D - P));
  panels.push(panel("upright", "Right upright", innerX + innerW - P, 0, P, P, seatH, D - P));
  panels.push(panel("bottom", "Shoe shelf", innerX + P, 0, P, bayW, P, D - P));
  panels.push(panel("top", "Seat", innerX + P, seatH - P, P, bayW, P, D - P));
  panels.push(panel("rail", "Front apron", innerX + P, seatH - P - apronH, D - P, bayW, apronH, P));
  for (let i = 1; i < cubbyN; i++) {
    const x = innerX + (innerW * i) / cubbyN - P / 2;
    panels.push(panel("divider", `Cubby divider ${i}`, x, P, P, P, seatH - 2 * P, D - P * 2));
  }
  panels.push(panel("top", "Hat shelf", innerX, hatBottom, 0, innerW, P, Math.min(10, D - 4)));
  const hang = (center: number, label: string) => {
    const y = center - 0.375;
    const railY = Math.max(seatH + 1, y - 1.25);
    panels.push(panel("rail", label === "Peg" ? "Peg rail" : "Kid peg rail", innerX, railY, P, innerW, 3.5, P));
    pushPegs(panels, pegN, innerX, y, P * 2 + 0.04, innerW, 3.5, 0.75, true, label);
  };
  if (showAdult) hang(adultCenter, "Peg");
  if (showKids) hang(rows === "kids" ? Math.min(kidCenter, adultCenter) : kidCenter, "Kid peg");
  const name = classDefaultDensifyTitle("Coat bench", prompt, { width: W, height: overallH, depth: D });
  const assumed = classDefaultAssumedNotes(prompt, "Coat bench", { width: W, height: overallH, depth: D });
  const hookTalk = showKids && showAdult
    ? `Adult hooks at ${Math.round(adultCenter)}", kid hooks at ${Math.round(kidCenter)}".`
    : showKids
      ? `Kid hooks at ${Math.round(Math.min(kidCenter, adultCenter))}".`
      : `Adult hooks at ${Math.round(adultCenter)}".`;
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: { width: W, height: overallH, depth: D },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes: [
      `${name}. Cubby bench, seat at ${seatH}". ${hookTalk} Hat shelf at the top. ¾" plywood, 2×2 posts.`,
      `Pegs stand about 3½" off the back, so a coat hangs behind the sitter instead of across the seat. Making the piece taller raises the hat shelf. Hooks stay near 64" so they can still be reached.`,
      `Screw the pegs into the rail, about 8" on center. Level it on the floor. Guidance only.`,
      ...assumed,
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: overallH, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "bench",
      family: "seat",
      affordances: affordances.includes("hooks") ? affordances : [...affordances, "hooks"],
      unit: {
        ...u,
        width: W,
        height: overallH,
        depth: D,
        doors: false,
        cubbies: cubbyN,
        shelfCount: undefined,
        drawersPerBank: undefined,
        rod: false,
        kneeW: undefined,
        counterH: undefined,
      },
    },
    assumptions: {
      load: "heavy",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  };
}

/** Floor-standing hall tree: seat, pegs, hat shelf. Not a wall board. */
function buildHallTree(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const typedH = /(?:tall|high|height)\b/.test(prompt.toLowerCase());
  const typedD = /(?:deep|depth)\b/.test(prompt.toLowerCase());
  const W = u.width;
  const H = typedH ? u.height : Math.max(u.height, 72);
  const D = typedD ? u.depth : Math.max(u.depth, 14);
  const x0 = -W / 2;
  const post = 1.5;
  const seatH = Math.min(18, Math.max(16, H * 0.25));
  const pegCount = Math.max(3, Math.min(6, Math.round(W / 8)));
  const panels: Panel[] = [];
  panels.push(panel("upright", "Left post", x0, 0, 0, post, H, post, TWO_BY_TWO));
  panels.push(panel("upright", "Right post", x0 + W - post, 0, 0, post, H, post, TWO_BY_TWO));
  panels.push(panel("bottom", "Shoe shelf", x0 + post, 4, post, W - post * 2, P, D - post));
  panels.push(panel("top", "Seat", x0, seatH, 0, W, P, D));
  panels.push(panel("back", "Back", x0 + post, seatH + P, 0, W - post * 2, H - seatH - P * 2, P));
  panels.push(panel("top", "Hat shelf", x0, H - P, 0, W, P, Math.min(D, 10)));
  pushPegs(panels, pegCount, x0 + post, seatH + 16, P + 0.05, W - post * 2, 3.25);
  const name = `Hall tree ${Math.round(W)}" × ${Math.round(H)}" × ${Math.round(D)}"`;
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
      `${name}. Floor-standing hall tree — seat at ${seatH}", ${pegCount} pegs, hat shelf. Not a wall coat board.`,
      `Screw the pegs into the back, about 8" on center, above the seat. Coats hang clear of the seat.`,
      "Level it on the floor. The posts carry the hat shelf. Guidance only.",
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "bench",
      family: "seat",
      affordances: affordances.includes("hooks") ? affordances : [...affordances, "hooks"],
      unit: { ...u, width: W, height: H, depth: D, doors: false, shelfCount: 0, drawersPerBank: undefined },
    },
    assumptions: { load: "heavy", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}


/**
 * A typed axis is the finished size, even when it is shorter than the class usual.
 * The usual fills only an axis that was not typed. A class default is not a typed axis.
 */
function typedAxisNumber(prompt: string, kind: "length" | "width" | "height" | "depth"): number | null {
  const t = prompt.toLowerCase().replace(/[″”]/g, '"');
  const words = { length: "long|length", width: "wide|width", height: "tall|high|height", depth: "deep|depth" }[kind];
  const n = String.raw`(\d+(?:\.\d+)?)`;
  const unit = String.raw`(?:ft|foot|feet|in|inch|inches|["'])?`;
  const m = t.match(new RegExp(n + String.raw`\s*` + unit + String.raw`\s*(?:` + words + String.raw`)\b`))
    ?? t.match(new RegExp(String.raw`\b(?:` + words + String.raw`)\s*` + n));
  if (!m) return null;
  const raw = parseFloat(m[1]);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return /(?:ft|foot|feet)/.test(m[0]) ? raw * 12 : raw;
}

function typedAxisOrUsual(prompt: string, kind: "length" | "width" | "height" | "depth", usual: number): number {
  return typedAxisNumber(prompt, kind) ?? usual;
}

/** Picnic table: top, attached benches, A-frame legs. Not a square dining table. */
function buildPicnic(spec: FittedSpec, prompt: string): YardProject {
  const u = spec.unit;
  const length = typedAxisNumber(prompt, "length") ?? typedAxisNumber(prompt, "width") ?? 72;
  const tableH = typedAxisOrUsual(prompt, "height", 29);
  const topD = typedAxisOrUsual(prompt, "depth", 28);
  const benchH = 17;
  const benchW = 10;
  const gap = 8;
  const overallD = topD + (benchW + gap) * 2;
  const x0 = -length / 2;
  const topZ = -topD / 2;
  const leg = 1.5;
  const panels: Panel[] = [];
  panels.push(panel("top", "Table top", x0, tableH - P, topZ, length, P, topD));
  // End inset stays on the typed length. A short top does not park the legs past the ends.
  const inset = Math.min(10, Math.max(leg, (length - leg * 2) / 4));
  const seatLen = Math.max(leg * 2, length - 4);
  for (const x of [x0 + inset, x0 + length - inset - leg]) {
    panels.push(panel("upright", "Leg", x, 0, topZ + 1, leg, tableH - P, leg, TWO_BY_TWO));
    panels.push(panel("upright", "Leg", x, 0, topZ + topD - 1 - leg, leg, tableH - P, leg, TWO_BY_TWO));
  }
  panels.push(panel("rail", "Table stretcher", x0 + inset, tableH - P - 3.5, -leg / 2, length - inset * 2, 3.5, leg));
  const benchYs = benchH - P;
  for (const side of [-1, 1] as const) {
    const z = side < 0 ? topZ - gap - benchW : topZ + topD + gap;
    const label = side < 0 ? "Near bench" : "Far bench";
    panels.push(panel("top", `${label} seat`, x0 + (length - seatLen) / 2, benchYs, z, seatLen, P, benchW));
    for (const x of [x0 + inset, x0 + length - inset - leg]) {
      panels.push(panel("upright", `${label} leg`, x, 0, z + 1, leg, benchH - P, leg, TWO_BY_TWO));
      panels.push(panel("upright", `${label} leg`, x, 0, z + benchW - 1 - leg, leg, benchH - P, leg, TWO_BY_TWO));
    }
  }
  const name = `Picnic table ${Math.round(length)}" × ${Math.round(tableH)}" × ${Math.round(overallD)}"`;
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: { width: length, height: tableH, depth: overallD },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes: [
      `${name}. Picnic table — ${length}" top, two attached benches at ${benchH}". Not a dining table.`,
      `The benches sit outside the top, ${gap}" clear of the table legs so you can sit. 2×2 legs, ¾" top and seats.`,
    ],
    historic: false,
    opening: { width: length, height: tableH, depth: overallD, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "table",
      family: "table",
      unit: { ...u, width: length, height: tableH, depth: overallD, doors: false, shelfCount: 0 },
    },
    assumptions: { load: "heavy", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}

/** Standing shop top — legs and a work surface, not an open bin. */
function buildShopTop(spec: FittedSpec, prompt: string): YardProject {
  const u = spec.unit;
  const lower = prompt.toLowerCase();
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  const topT = 1.5;
  const legW = 1.5;
  const legD = 3.5;
  const legH = H - topT;
  const potting = isPottingBench(lower);
  const wantShelf = (u.shelfCount ?? 0) > 0 || /lower\s+shel|bottom\s+shel/.test(lower);
  const panels: Panel[] = [];
  const lumber = "lumber-2x4-8";
  panels.push(panel("upright", "Front left leg", x0, 0, D - legD, legW, legH, legD, lumber));
  panels.push(panel("upright", "Front right leg", x0 + W - legW, 0, D - legD, legW, legH, legD, lumber));
  panels.push(panel("upright", "Back left leg", x0, 0, 0, legW, legH, legD, lumber));
  panels.push(panel("upright", "Back right leg", x0 + W - legW, 0, 0, legW, legH, legD, lumber));
  panels.push(panel("top", potting ? "Potting top" : "Work top", x0, H - topT, 0, W, topT, D));
  const apronH = 3.5;
  panels.push(panel("rail", "Front apron", x0 + legW, legH - apronH, D - legD, W - legW * 2, apronH, P));
  panels.push(panel("rail", "Back apron", x0 + legW, legH - apronH, legD - P, W - legW * 2, apronH, P));
  if (wantShelf) {
    panels.push(
      panel(
        "shelf",
        "Lower shelf",
        x0 + legW,
        Math.max(8, Math.round(H * 0.32)),
        legD,
        W - legW * 2,
        P,
        D - legD * 2,
      ),
    );
  }
  const stem = potting ? "Potting bench" : "Workbench";
  const name = new RegExp(`^${stem}`, "i").test(spec.name) ? spec.name : `${stem} ${W}" × ${H}" × ${D}"`;
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
      potting
        ? `${name}. Potting bench — work top at ${H}" on 2×4 legs${wantShelf ? " with one lower shelf" : ""}. Not a sit bench.`
        : `${name}. Workbench — work top at ${H}" on 2×4 legs${wantShelf ? " with one lower shelf" : ""}. Standing shop top, not a desk and not a bin.`,
      wantShelf
        ? "The lower shelf sits between the legs. Glue and screw it into the leg faces."
        : "No lower shelf unless you ask for one. The aprons keep the legs from racking.",
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: spec.program === "bench" ? "desk" : spec.program,
      family: spec.family,
      unit: {
        ...u,
        width: W,
        height: H,
        depth: D,
        doors: false,
        shelfCount: wantShelf ? 1 : 0,
        drawersPerBank: undefined,
        kneeW: undefined,
      },
    },
    assumptions: { load: "heavy", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}

/**
 * Open-frame bench — a seat on four legs tied by aprons and low stretchers (porch, garden, dining,
 * plain bench). Storage under the seat comes only when it is typed or the class implies it
 * (mudroom, entry, shoe, boot, window seat). A back rises off the rear legs only when asked.
 */
function buildOpenBench(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const lower = prompt.toLowerCase();
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  const legStock = "lumber-2x4-8";
  const legW = 1.5;
  const legD = 3.5;
  const seatT = P;
  const legH = H - seatT;
  const apronH = 3.5;
  const wantBack = /\b(?:back|backrest|back\s*rest)\b/.test(lower) && !/\bbackless\b|no\s+back/.test(lower);
  const backH = wantBack ? 16 : 0;
  const panels: Panel[] = [];
  panels.push(panel("upright", "Front left leg", x0, 0, D - legD, legW, legH, legD, legStock));
  panels.push(panel("upright", "Front right leg", x0 + W - legW, 0, D - legD, legW, legH, legD, legStock));
  panels.push(panel("upright", wantBack ? "Back left post" : "Back left leg", x0, 0, 0, legW, legH + (wantBack ? seatT + backH : 0), legD, legStock));
  panels.push(panel("upright", wantBack ? "Back right post" : "Back right leg", x0 + W - legW, 0, 0, legW, legH + (wantBack ? seatT + backH : 0), legD, legStock));
  panels.push(panel("top", "Seat", x0, H - seatT, 0, W, seatT, D));
  panels.push(panel("rail", "Front apron", x0 + legW, legH - apronH, D - legD, W - legW * 2, apronH, P));
  panels.push(panel("rail", "Back apron", x0 + legW, legH - apronH, legD - P, W - legW * 2, apronH, P));
  panels.push(panel("rail", "Left end apron", x0 + (legW - P) / 2, legH - apronH, legD, P, apronH, D - legD * 2));
  panels.push(panel("rail", "Right end apron", x0 + W - legW + (legW - P) / 2, legH - apronH, legD, P, apronH, D - legD * 2));
  const stretchY = Math.max(4, Math.round(H * 0.25));
  panels.push(panel("rail", "Left stretcher", x0, stretchY, legD, legW, apronH, D - legD * 2, legStock));
  panels.push(panel("rail", "Right stretcher", x0 + W - legW, stretchY, legD, legW, apronH, D - legD * 2, legStock));
  if (wantBack) {
    panels.push(panel("rail", "Top back rail", x0 + legW, H + backH - apronH, 0, W - legW * 2, apronH, P));
    panels.push(panel("rail", "Lower back rail", x0 + legW, H + 3, 0, W - legW * 2, apronH, P));
  }
  const stem = sitBenchTitleStem(lower) ?? (/\bgarden\s+bench\b/.test(lower) ? "Garden bench" : /\bporch\s+bench\b/.test(lower) ? "Porch bench" : "Bench");
  const totalH = H + backH;
  const name = classDefaultDensifyTitle(stem, prompt, { width: W, height: totalH, depth: D });
  const assumed = classDefaultAssumedNotes(prompt, stem, { width: W, height: totalH, depth: D });
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: { width: W, height: totalH, depth: D },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes: [
      `${name}. Open-frame bench — the seat sits ${H}" high on four 2×4 legs, tied by aprons under the seat and stretchers near the floor${wantBack ? `, with a ${backH}" back on the rear posts` : ""}.`,
      "The aprons keep the legs square and carry the seat edges; the stretchers stop racking. Glue and screw each apron into the legs, then screw the seat down through the aprons.",
      wantBack
        ? "The back posts are the rear legs run up past the seat, so the back is part of the frame."
        : "Say \"with a back\" for a backrest on the rear legs, or \"with a shoe shelf\" / \"with cubbies\" for storage under the seat.",
      "Level it on the floor and sit-test before you finish.",
      ...assumed,
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: totalH, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "bench",
      family: "seat",
      affordances,
      unit: { ...u, width: W, height: totalH, depth: D, doors: false, cubbies: 0, shelfCount: 0, drawersPerBank: undefined, kneeW: undefined },
    },
    assumptions: { load: "heavy", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}

/** Porch swing you can name from the shape: stand, beam, hanging seat, back. */
function buildPorchSwing(spec: FittedSpec, prompt: string): YardProject {
  const u = spec.unit;
  const W = typedAxisNumber(prompt, "width") ?? typedAxisNumber(prompt, "length") ?? (u.width >= 36 ? u.width : 48);
  const standH = typedAxisOrUsual(prompt, "height", u.height >= 48 ? u.height : 78);
  const seatD = 18;
  const standD = Math.max(36, u.depth || 0, seatD + 16);
  const x0 = -W / 2;
  const z0 = -standD / 2;
  const post = 1.5;
  const seatY = 18;
  const backH = 14;
  const panels: Panel[] = [];
  for (const x of [x0, x0 + W - post]) {
    for (const z of [z0, z0 + standD - post]) {
      panels.push(panel("upright", "Stand post", x, 0, z, post, standH, post, TWO_BY_TWO));
    }
  }
  // Beam over the middle of the stand. Hangers drop from it to the seat ends.
  const beamZ = -post / 2;
  panels.push(panel("rail", "Beam", x0, standH - 3.5, beamZ, W, 3.5, post, TWO_BY_TWO));
  const railX = [x0 + 5, x0 + W - 5 - post];
  for (const x of railX) {
    panels.push(panel("rail", "Seat rail", x, seatY, -seatD / 2, post, P, seatD));
    panels.push(
      panel(
        "rail",
        "Hanger",
        x,
        seatY + P,
        beamZ,
        post,
        standH - 3.5 - (seatY + P),
        post,
        TWO_BY_TWO,
      ),
    );
  }
  const slatX = railX[0] + post + 0.15;
  const slatW = railX[1] - slatX - 0.15;
  for (let i = 0; i < 4; i++) {
    const z = -seatD / 2 + 1 + i * ((seatD - 3) / 4);
    panels.push(panel("deck", `Seat slat ${i + 1}`, slatX, seatY, z, slatW, P, 2.25));
  }
  for (let i = 0; i < 3; i++) {
    const y = seatY + P + 1.5 + i * 4;
    panels.push(panel("rail", `Back slat ${i + 1}`, slatX, y, -seatD / 2, slatW, 2.25, P));
  }
  const name =
    /frame/i.test(spec.name) || /frame/.test(prompt.toLowerCase())
      ? `Porch swing frame ${Math.round(W)}" × ${Math.round(standH)}"`
      : `Porch swing ${Math.round(W)}" × ${Math.round(standH)}"`;
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: { width: W, height: standH, depth: standD },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes: [
      `${name}. Hanging seat under a beam — clear swing between the posts. Not a stick scribble and not a bench on the floor.`,
      `Seat at ${seatY}". The hangers drop from the beam so the seat can swing. Sit facing out.`,
    ],
    historic: false,
    opening: { width: W, height: standH, depth: standD, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "bench",
      family: "seat",
      unit: { ...u, width: W, height: standH, depth: standD, doors: false, shelfCount: 0 },
    },
    assumptions: { load: "heavy", units: "inches", installMode: "freestanding", wallType: "wood_stud", use: "person" },
  };
}

/** Sleep-frame corner post — solid 2x2 (name starts with Leg so cut list + Buy match tables). */
function sleepFrameLeg(
  name: string,
  x: number,
  y: number,
  z: number,
  face: number,
  height: number,
): Panel {
  return panel("upright", name, x, y, z, face, height, face, TWO_BY_TWO);
}

/** Drawer box + its own cut-list front (not a hinged door — no cabinet-hinge BOM). */
function pushDrawerWithFront(
  panels: Panel[],
  boxName: string,
  frontName: string,
  x: number,
  y: number,
  z: number,
  boxW: number,
  boxH: number,
  boxD: number,
  frontW: number,
) {
  panels.push(panel("drawer", boxName, x, y, z, boxW, boxH, boxD));
  // Face people see — thin ply at the front of the bay; own cut-list line.
  panels.push(panel("rail", frontName, x + (boxW - frontW) / 2, y, z + Math.max(0, boxD - P), frontW, boxH, P));
}


/** Hung media ledge — typed W×H×D, wall cleat/stud joins, clear below for TV stand. */
function buildWallMediaLedge(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const W = u.width;
  const H = Math.max(u.height, P + 1.5);
  const D = u.depth;
  const x0 = -W / 2;
  const cleatH = Math.min(2.5, Math.max(1.5, H - P));
  const panels: Panel[] = [];
  // Ledger / French cleat against the wall; ledge shelf sits on it.
  panels.push(panel("rail", "Wall cleat", x0, 0, 0, W, cleatH, P));
  panels.push(panel("shelf", "Media ledge", x0, cleatH, P, W, P, Math.max(D - P, 2)));
  // Low front lip so gear cannot slide off — still an open ledge (hung-open).
  panels.push(panel("rail", "Front lip", x0, cleatH + P, D - P, W, Math.min(1.25, Math.max(0.75, H - cleatH - P)), P));
  // Soft leftover: envelopePanels() drops type=rail, so rails-only media ledge AABB
  // was H≈¾″ (shelf ply) while typed overall H (e.g. 6″/8″) stayed on HUD — same class
  // as bedside Book/Print. Mirror bedside: Media backstop as type=back from y=0 with
  // height H (top face = typed H). Cleat + lip stay rails (mount + cradle).
  panels.push(panel("back", "Media backstop", x0, 0, P, W, H, P));
  const stem = mediaIdentityLabel(prompt.toLowerCase()) || identityTitleStem(prompt.toLowerCase()) || "Media ledge";
  const name = `${stem} ${W}" × ${H}" × ${D}"`;
  const clearNote = /55/.test(prompt)
    ? "Keep the 55\" TV stand footprint clear below the ledge — open below, not a floor box."
    : "Keep the TV stand footprint clear below the ledge — open below, not a floor box.";
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
      `${name}. Wall media ledge hung-open on a wall cleat — lags into studs / French cleat joinery; not a weekend picture ledge.`,
      clearNote,
      "Mount the cleat to studs; the ledge screws down onto the cleat. Guidance only — confirm the wall type.",
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "media",
      family: "hung-open",
      affordances: affordances.includes("cleats") ? affordances : [...affordances, "cleats"],
      unit: {
        ...u,
        width: W,
        height: H,
        depth: D,
        doors: false,
        shelfCount: 1,
        drawersPerBank: undefined,
        rod: false,
        kneeW: undefined,
        counterH: undefined,
        mirror: false,
        bays: undefined,
      },
    },
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "wall",
      wallType: "wood_stud",
    },
  };
}

/** Tip-rail hung-open — picture/photo/art ledge or picture/tip rail.
 * Typed W×H×D; Wall cleat + shelf + Front lip + Picture backstop spanning typed H.
 * Same envelope honesty class as media ledge / floating lip / bedside (rails dropped by envelopePanels). */
function buildPictureLedge(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const W = u.width;
  const H = Math.max(u.height, P + 1.5);
  const D = u.depth;
  const x0 = -W / 2;
  const cleatH = Math.min(2.5, Math.max(1.5, H - P));
  const lipH = Math.min(1.5, Math.max(0.75, Math.min(H - cleatH - P, 1.25)));
  const lower = prompt.toLowerCase();
  const stem = pictureLedgeTitleStem(lower);
  const panels: Panel[] = [];
  panels.push(panel("rail", "Wall cleat", x0, 0, 0, W, cleatH, P));
  panels.push(panel("shelf", stem, x0, cleatH, P, W, P, Math.max(D - P, 2)));
  // Low front lip cradles tipped frames / prints — never a flat decal, never Picture frame steal.
  panels.push(panel("rail", "Front lip", x0, cleatH + P, D - P, W, lipH, P));
  // envelopePanels() drops type=rail — Picture backstop as type=back from y=0 with height H
  // so AABB top face == typed overall H (media / floating lip / bedside class).
  panels.push(panel("back", "Picture backstop", x0, 0, P, W, H, P));
  const name = classDefaultDensifyTitle(stem, prompt, { width: W, height: H, depth: D });
  const ledgeAssumed = classDefaultAssumedNotes(prompt, stem, { width: W, height: H, depth: D });
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
      `${name}. Tip-rail hung-open on a wall cleat — Front lip + Picture backstop span ${H}" so frames tip upright against the back; never a weekend Picture frame, never a Media ledge, never a flat decal, never a storage closet envelope.`,
      "Mount the cleat to studs; the ledge screws down onto the cleat. Guidance only — confirm the wall type.",
      ...ledgeAssumed,
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "storage",
      family: "hung-open",
      affordances: affordances.includes("cleats") ? affordances : [...affordances, "cleats"],
      unit: {
        ...u,
        width: W,
        height: H,
        depth: D,
        doors: false,
        shelfCount: 1,
        drawersPerBank: undefined,
        rod: false,
        kneeW: undefined,
        counterH: undefined,
        mirror: false,
        bays: undefined,
      },
    },
    assumptions: {
      load: "light",
      units: "inches",
      installMode: "wall",
      wallType: "wood_stud",
    },
  };
}

function buildBedsideShelf(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const W = u.width;
  const H = Math.max(u.height, P + 2);
  const D = u.depth;
  const x0 = -W / 2;
  const cleatH = Math.min(2.5, Math.max(1.5, H - P));
  const lipH = Math.min(2.5, Math.max(1.5, Math.min(H - cleatH - P, 2.25)));
  const lower = prompt.toLowerCase();
  // Print / 5×7 upright when typed — else book envelope (batch-22 default).
  const printHold = wantsPrintHold(lower) && !wantsBookHold(lower);
  const fiveBySeven = /5\s*[×x]\s*7/.test(lower);
  const holdNoun = printHold ? (fiveBySeven ? "5×7 print" : "print") : "book";
  const lipName = printHold ? "Print front lip" : "Book front lip";
  const backName = printHold ? "Print backstop" : "Book backstop";
  const envelope = printHold ? "print envelope" : "book envelope";
  const panels: Panel[] = [];
  panels.push(panel("rail", "Wall cleat", x0, 0, 0, W, cleatH, P));
  panels.push(panel("shelf", "Bedside shelf", x0, cleatH, P, W, P, Math.max(D - P, 2)));
  // Envelope — front lip cradles a real book/print upright, never a flat decal.
  panels.push(panel("rail", lipName, x0, cleatH + P, D - P, W, lipH, P));
  // Soft leftover: envelopePanels() drops type=rail, so shelf-only AABB was H≈¾″
  // (ply thickness) while typed overall was ~6″ — same class of lie as desk worktop
  // stacking above typed H. Mirror desk: an envelope-counted face spans typed H —
  // Book/Print backstop as type=back from y=0 with height H (top face = typed H).
  // Cleat + lip stay rails (mount + cradle). Universal bedside hung-open class.
  panels.push(panel("back", backName, x0, 0, P, W, H, P));
  const name = `Bedside shelf ${W}" × ${H}" × ${D}"`;
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
      `${name}. Bedside shelf hung-open on a wall cleat — holds a real ${holdNoun} upright in a ${envelope} with a front lip; never a flat decal, never a Nightstand, never a Picture ledge.`,
      "Mount the cleat to studs; the shelf screws down onto the cleat. Guidance only — confirm the bedside height.",
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "storage",
      family: "hung-open",
      affordances: affordances.includes("cleats") ? affordances : [...affordances, "cleats"],
      unit: {
        ...u,
        width: W,
        height: H,
        depth: D,
        doors: false,
        shelfCount: 1,
        drawersPerBank: undefined,
        rod: false,
        kneeW: undefined,
        counterH: undefined,
        mirror: false,
        bays: undefined,
      },
    },
    assumptions: {
      load: "light",
      units: "inches",
      installMode: "wall",
      wallType: "wood_stud",
    },
  };
}

function buildHungOpen(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const lower = prompt.toLowerCase();
  if (isBedsideShelf(lower)) {
    return buildBedsideShelf(spec, prompt, affordances);
  }
  if (isPictureLedge(lower)) {
    return buildPictureLedge(spec, prompt, affordances);
  }
  if (isWallMediaLedge(lower) || (/\bmedia\b/.test(lower) && /\bledge\b/.test(lower))) {
    return buildWallMediaLedge(spec, prompt, affordances);
  }
  const u = spec.unit;
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  const innerW = W - P * 2;
  const backT = P;
  const shelfN = u.shelfCount && u.shelfCount > 0 ? u.shelfCount : 3;
  const lips = affordances.includes("jar-lips");
  const rails = affordances.includes("bottle-rails") && !lips;
  const panels: Panel[] = [];
  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
  for (let i = 0; i < shelfN; i++) {
    const y = shelfN === 1 ? 0 : (i * (H - P)) / (shelfN - 1);
    panels.push(panel("shelf", `Shelf ${i + 1}`, x0 + P, y, backT, innerW, P, D - backT));
    if (lips) {
      panels.push(panel("rail", `Jar lip ${i + 1}`, x0 + P, y + P, D - P, innerW, 1.25, P));
    } else if (rails && i < shelfN - 1) {
      panels.push(panel("rail", `Bottle rail ${i + 1}`, x0 + P, y + P, D - P, innerW, 1.5, P));
    }
  }
  panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, backT));
  const kind = lips ? "Jar rack" : rails ? "Bottle rack" : /shel/.test(prompt.toLowerCase()) ? "Wall shelf" : "Wall rack";
  const mediaStem = mediaIdentityLabel(lower) || identityTitleStem(lower);
  const name = mediaStem
    ? `${mediaStem} ${W}" × ${H}" × ${D}"`
    : spec.name.match(/rack|shelf|shelves|ledge/i)
      ? spec.name
      : `${kind} ${W}" × ${H}" × ${D}"`;
  const lipNote = lips
    ? "Jar lips on every shelf so jars cannot slide off."
    : rails
      ? "Bottle rails on the shelf fronts so bottles cannot roll off."
      : "Open shelves. Glue them; do not pin them.";
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
      `${name}. Wall-mounted open rack — not a floor box. ¾" plywood.`,
      lipNote,
      "Hang the rack on studs through the back. Do not mark a footprint on the floor.",
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "storage",
      family: "hung-open",
      affordances,
      unit: {
        ...u,
        width: W,
        height: H,
        depth: D,
        doors: false,
        shelfCount: shelfN,
        drawersPerBank: undefined,
        rod: false,
        kneeW: undefined,
        counterH: undefined,
        mirror: false,
      },
    },
    assumptions: {
      load: rails ? "heavy" : "medium",
      units: "inches",
      installMode: "wall",
      wallType: "wood_stud",
    },
  };
}


function buildRadiatorCover(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  const innerW = W - P * 2;
  const panels: Panel[] = [];
  // Open-backed cover: uprights + top shelf + bottom rail + front grille slats.
  // Heat needs a path — no full back panel and no door.
  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
  panels.push(panel("top", "Top shelf", x0 + P, H - P, 0, innerW, P, D));
  panels.push(panel("rail", "Bottom rail", x0 + P, 0, D - P, innerW, 3.5, P));
  const slatN = Math.max(5, Math.min(11, Math.round(innerW / 3.5)));
  const gap = innerW / slatN;
  const slatW = Math.max(1.25, Math.min(2, gap * 0.45));
  for (let i = 0; i < slatN; i++) {
    const x = x0 + P + gap * i + (gap - slatW) / 2;
    panels.push(
      panel("rail", `Grille slat ${i + 1}`, x, 3.5, D - P, slatW, Math.max(8, H - P - 3.5), P),
    );
  }
  const name = `Radiator cover ${W}" × ${H}" × ${D}"`;
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
      `${name}. Open-backed radiator cover with a top shelf and ${slatN} front grille slats — not a closed cabinet. ¾" plywood.`,
      "Leave air space around the radiator. Do not trap heat against a sealed back. Guidance only — confirm clearances for your radiator.",
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "storage",
      family: "floor-carcase",
      affordances,
      unit: {
        ...u,
        width: W,
        height: H,
        depth: D,
        doors: false,
        shelfCount: 0,
        drawersPerBank: undefined,
        rod: false,
        kneeW: undefined,
        counterH: undefined,
      },
    },
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  };
}

function buildHungCabinet(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  const innerW = W - P * 2;
  const backT = P;
  const shelfN = u.shelfCount && u.shelfCount > 0 ? u.shelfCount : 2;
  const fold = affordances.includes("fold-down-board");
  const panels: Panel[] = [];
  const face = shallowWallCabinetFace(D, backT);
  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
  panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, backT));
  panels.push(panel("bottom", "Bottom", x0 + P, 0, backT, innerW, P, D - backT));
  panels.push(panel("top", "Top", x0 + P, H - P, backT, innerW, P, D - backT));
  if (!fold) {
    const innerH = H - P * 2;
    for (let i = 1; i <= shelfN; i++) {
      const y = P + (innerH * i) / (shelfN + 1);
      panels.push(panel("shelf", `Shelf ${i}`, x0 + P, y, backT, innerW, P, face.shelfDepth));
    }
  } else {
    const boardW = Math.max(10, innerW - 0.25);
    const boardLen = Math.max(30, Math.round((H - P * 2 - 2) * 8) / 8);
    const legLen = Math.min(32, Math.max(24, Math.round(H * 0.62 * 8) / 8));
    panels.push(panel("deck", "Fold-down board", x0 + P + (innerW - boardW) / 2, P, D - P * 2, boardW, boardLen, P));
    panels.push(panel("deck", "Support leg", x0 + P + (innerW - 1.5) / 2, P, D - P * 3, 1.5, legLen, P));
  }
  const doorN = fold ? 1 : typedDoorCount(prompt) ?? (W > 28 ? 2 : 1);
  if (fold) {
    panels.push(panel("door", "Door", x0 + 0.08, 0.08, face.doorZ, W - 0.16, H - 0.16, face.doorT));
  } else {
    const leafH = H - 0.16;
    const bayW = W / doorN;
    const leafW = bayW - 0.2;
    for (let i = 0; i < doorN; i++) {
      const label =
        doorN === 1 ? "Door" : doorN === 2 ? (i === 0 ? "Left door" : "Right door") : `Door ${i + 1}`;
      panels.push(panel("door", label, x0 + i * bayW + 0.1, 0.08, face.doorZ, leafW, leafH, face.doorT));
    }
  }
  const lowerPrompt = prompt.toLowerCase();
  const name = isKitchenUpper(lowerPrompt)
    ? spec.name.match(/upper/i)
      ? spec.name
      : `Upper cabinet ${W}" × ${H}" × ${D}"`
    : isLaundryFoldDown(lowerPrompt) || (fold && /laundry/.test(lowerPrompt))
      ? (spec.name.match(/laundry/i) ? spec.name : `Laundry fold-down ${W}" × ${H}" × ${D}"`)
    : isIroningCabinet(lowerPrompt)
      ? (spec.name.match(/ironing/i) ? spec.name : `Ironing cabinet ${W}" × ${H}" × ${D}"`)
    : spec.name.match(/cabinet|ironing|medicine|laundry|fold/i)
      ? spec.name
      : fold
        ? `Fold-down cabinet ${W}" × ${H}" × ${D}"`
        : `Wall cabinet ${W}" × ${H}" × ${D}"`;
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
      fold && /laundry/i.test(name)
        ? `${name}. Wall-mounted laundry fold-down — a shallow cabinet with a hinged fold surface inside, not a freestanding folding table and not a floor box. ¾" plywood.`
        : `${name}. Wall-mounted cabinet — not a floor box. ¾" plywood.`,
      fold
        ? "The board stores upright and hinges down on a piano hinge. A support leg kicks out to the floor. Hang the carcase on studs through the back."
        : doorN > 1
          ? `Hang the carcase on studs through the back. ${doorN} doors with concealed hinges (${doorN} hinge pairs). Shelves stop ${HINGE_ARM_CLEAR_IN}" short of the door so the hinge arm can close. Glue the shelves; do not pin them.`
          : `Hang the carcase on studs through the back. Concealed hinges on the door. Shelves stop ${HINGE_ARM_CLEAR_IN}" short of the door so the hinge arm can close. Glue the shelves; do not pin them.`,
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "storage",
      family: "hung-cabinet",
      affordances,
      unit: {
        ...u,
        width: W,
        height: H,
        depth: D,
        doors: true,
        shelfCount: fold ? 0 : shelfN,
        drawersPerBank: undefined,
        rod: false,
        kneeW: undefined,
        counterH: undefined,
        mirror: affordances.includes("mirror") || u.mirror,
      },
    },
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "wall",
      wallType: "wood_stud",
    },
  };
}


/** Floor shoe storage: open cubbies / shoe shelves — not bookcase pin shelves. */
/** What a collection shelf holds: the clear height, depth and longest unsupported span it needs. */
type CollectionKind = { label: string; clear: number; depth: number; bayMax: number; heavy: boolean; tiers: number };
function collectionKind(x: string): CollectionKind {
  const l = x.toLowerCase();
  if (/\b(?:records?|vinyl|lps?|albums?)\b/.test(l)) return { label: "LP records", clear: 13, depth: 14, bayMax: 17, heavy: true, tiers: 3 };
  if (/\b(?:comics?|manga|graphic\s+novels?)\b/.test(l)) return { label: "comics", clear: 11, depth: 10, bayMax: 32, heavy: true, tiers: 4 };
  if (/\b(?:books?|paperbacks?|novels?)\b/.test(l)) return { label: "books", clear: 11, depth: 11, bayMax: 32, heavy: true, tiers: 4 };
  if (/\b(?:dvds?|blu-?rays?|games?|cds?|cassettes?|tapes?)\b/.test(l)) return { label: "cases", clear: 8, depth: 7, bayMax: 32, heavy: false, tiers: 4 };
  if (/\b(?:model\s+cars?|die-?cast|hot\s+wheels|matchbox|minis?|miniatures?)\b/.test(l)) return { label: "small models", clear: 4, depth: 6, bayMax: 36, heavy: false, tiers: 5 };
  if (/\b(?:mugs?|cups?|glass(?:es)?|teacups?)\b/.test(l)) return { label: "mugs", clear: 6, depth: 7, bayMax: 36, heavy: false, tiers: 4 };
  if (/\b(?:robots?|lego|legos|figures?|figurines?|action\s+figures?|funkos?|pops?|toys?|statues?|models?|sneakers?|trophies)\b/.test(l))
    return { label: "display pieces", clear: /\brobots?|statues?|trophies\b/.test(l) ? 12 : 10, depth: 10, bayMax: 36, heavy: false, tiers: 4 };
  return { label: "display pieces", clear: 10, depth: 10, bayMax: 36, heavy: false, tiers: 4 };
}

/** "shelf / bookshelf for my X collection": an open display shelf with tiers sized for X. */
function buildCollectionShelf(spec: FittedSpec, prompt: string, affordances: HouseAffordance[], what: string): YardProject {
  const u = spec.unit;
  const k = collectionKind(what);
  const typed = typedOpeningStorageAxes(prompt);
  const backT = 0.25;
  const W = typed.width ? u.width : 36;
  const D = typed.depth ? u.depth : Math.max(k.depth, 8);
  const spokenTiers = spokenTierCount(prompt);
  const asked = spokenTiers != null ? Math.min(10, spokenTiers) : null;
  const pitch = k.clear + P;
  const typedH = typed.height ? u.height : null;
  const fitN = typedH != null ? Math.max(1, Math.floor((typedH - P + 1e-6) / pitch)) : null;
  const tiers = asked != null ? (fitN != null ? Math.min(asked, fitN) : asked) : fitN ?? k.tiers;
  const H = typedH ?? Math.round((tiers * pitch + P) * 16) / 16;
  const tierClear = (H - P * (tiers + 1)) / tiers;
  const innerW = W - 2 * P;
  const bays = Math.max(1, Math.ceil((innerW + P) / (k.bayMax + P)));
  const bayW = (innerW - (bays - 1) * P) / bays;
  const x0 = -W / 2;
  const at = prompt.toLowerCase().indexOf(what);
  const whatTitle = (at >= 0 ? prompt.slice(at, at + what.length) : what).replace(/\s+/g, " ").trim();
  const name = /^(?:records?|vinyl|lps?)$/i.test(whatTitle) ? "Record shelf" : `Display shelf for a ${whatTitle} collection`;
  const panels: Panel[] = [];
  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
  panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, backT));
  panels.push(panel("bottom", "Bottom", x0 + P, 0, backT, innerW, P, D - backT));
  panels.push(panel("top", "Top", x0 + P, H - P, backT, innerW, P, D - backT));
  for (let i = 1; i < tiers; i++) {
    const y = Math.round(i * (tierClear + P) * 16) / 16;
    if (bays > 1) {
      for (let b = 0; b < bays; b++) {
        panels.push(panel("shelf", `Bay ${b + 1} shelf ${i}`, x0 + P + b * (bayW + P), y, backT, bayW, P, D - backT));
      }
    } else {
      panels.push(panel("shelf", tiers - 1 === 1 ? "Shelf" : `Shelf ${i}`, x0 + P, y, backT, innerW, P, D - backT));
    }
  }
  for (let b = 1; b < bays; b++) {
    panels.push(panel("divider", bays === 2 ? "Center divider" : `Bay divider ${b}`, x0 + P + b * bayW + (b - 1) * P, P, backT, P, H - 2 * P, D - backT));
  }
  const notes = [
    `${name}. ${tiers} open tier${tiers === 1 ? "" : "s"}, ${inchFrac(tierClear)}" clear each and ${inchFrac(D - backT)}" deep inside — sized for ${k.label}. Fixed shelves, glued and screwed. ¾" plywood.`,
    ...(k.heavy
      ? [
          `${k.label === "LP records" ? "LPs weigh about 35 lb per running foot" : `A full shelf of ${k.label} is heavy`}: ${bays > 1 ? `${bays === 2 ? "a center divider keeps" : "bay dividers keep"} every shelf span to ${inchFrac(bayW)}"` : `the span is ${inchFrac(bayW)}"`}, short enough that ¾" plywood will not sag.`,
        ]
      : []),
    ...(asked != null && tiers < asked ? [`${asked} tiers were asked; ${tiers} fit in the typed ${inchFrac(H)}" with ${inchFrac(k.clear)}" clear each. The size wins — add height for the rest.`] : []),
    ...(H > 30 ? ["Anti-tip: strap the top to a wall stud — a loaded shelf this tall can tip forward."] : []),
    "Guidance only — measure the tallest piece in your collection before you cut.",
    ...(typed.width ? [] : [`Assumed ${W}" wide — type a width to lock it.`]),
    ...(typed.height ? [] : [`Assumed ${inchFrac(H)}" tall (${tiers} tiers of ${inchFrac(k.clear)}") — type a height to lock it.`]),
    ...(typed.depth ? [] : [`Assumed ${inchFrac(D)}" deep for ${k.label} — type a depth to lock it.`]),
  ];
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: { width: W, height: H, depth: D },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes,
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "bookcase",
      family: "floor-carcase",
      affordances,
      unit: { ...u, width: W, height: H, depth: D, doors: false, shelfCount: Math.max(0, tiers - 1), drawersPerBank: undefined, rod: false, kneeW: undefined, counterH: undefined, mirror: false },
    },
    assumptions: { load: k.heavy ? "heavy" : "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}

/**
 * Ladder shelf / leaning shelf: two front rails that lean back toward the wall, two plumb back posts at
 * the wall, and shelves that get shallower as they climb (deep at the floor, still usable at the top).
 * The rails are side-profile parts (a face outline turned 90° so it lies along the depth). Every
 * opening clears SHELF_MIN_CLEAR; a typed height wins over the spoken count, with a note.
 */
function buildLadderShelf(spec: FittedSpec, prompt: string, affordances: HouseAffordance[], stem: string): YardProject {
  const u = spec.unit;
  const typed = typedOpeningStorageAxes(prompt);
  const r16 = (v: number) => Math.round(v * 16) / 16;
  const fl16 = (v: number) => Math.floor(v * 8 + 1e-6) / 8; // shop eighths (the bench rounds to 1/8)
  const W = typed.width ? u.width : 24;
  const H = typed.height ? u.height : 70;
  const D = typed.depth ? Math.max(8, u.depth) : Math.min(20, Math.max(12, Math.round(H * 0.24)));
  const topD = Math.min(D, Math.max(7, Math.round(D * 0.45)));
  const bw = 2.5; // rail / post width, ripped from the plywood
  const zf = (y: number) => D - ((D - topD) * y) / H; // front edge of the rail at height y
  const asked = spokenShelfCount(prompt) ?? spokenTierCount(prompt);
  const want = asked != null ? Math.min(10, Math.max(1, asked)) : H >= 60 ? 5 : H >= 40 ? 4 : 3;
  const yTop = r16(H - 1); // top of the highest shelf, just under the rail tops
  let yLow = Math.min(10, yTop);
  const pitchMin = SHELF_MIN_CLEAR + P;
  let n = want;
  if (n > 1 && (yTop - yLow) / (n - 1) < pitchMin) yLow = Math.max(4, yTop - pitchMin * (n - 1));
  if (n > 1 && (yTop - yLow) / (n - 1) < pitchMin - 1e-6) n = Math.max(1, Math.floor((yTop - yLow) / pitchMin + 1e-6) + 1);
  const pitch = n > 1 ? (yTop - yLow) / (n - 1) : 0;
  const tops = Array.from({ length: n }, (_, i) => r16(n === 1 ? yTop : yLow + i * pitch));
  const x0 = -W / 2;
  const x1 = W / 2;
  const innerW = W - 2 * P;
  const panels: Panel[] = [];
  // Front rails: face outline in rail-local (lx along the depth, y up), lx = D − z, turned 90° about Y.
  const lean = Math.atan((D - topD) / H);
  const leanDeg = Math.round((lean * 180) / Math.PI);
  const railW = r16(D - topD + bw);
  const railPts: [number, number][] = [[0, 0], [bw, 0], [railW, H], [r16(D - topD), H]];
  const zMid = (topD - bw + D) / 2;
  const blankL = Math.ceil((Math.hypot(D - topD, H) + bw * Math.sin(lean)) * 16) / 16;
  for (const [side, xr] of [["Left", x0], ["Right", x1 - P]] as const) {
    panels.push({
      ...panel("upright", `${side} leaning rail`, xr + P / 2 - railW / 2, 0, zMid - P / 2, railW, H, P),
      yaw: Math.PI / 2,
      polygon: { plane: "xy", pts: railPts },
      blank: { lengthIn: blankL, widthIn: bw, thicknessIn: P },
      cutNote: `Leaning rail: ${inchFrac(bw)}" strip, ${inchFrac(blankL)}" long. Cut the foot and the top ${leanDeg}° off square so the foot sits flat on the floor and the top is level.`,
    });
  }
  for (const [side, xr] of [["Left", x0], ["Right", x1 - P]] as const) {
    panels.push(panel("upright", `${side} back post`, xr, 0, 0, P, H, bw));
  }
  tops.forEach((t, i) => {
    const d = fl16(zf(t));
    panels.push(panel("shelf", n === 1 ? "Shelf" : `Shelf ${i + 1}`, x0 + P, r16(t - P), 0, innerW, P, d));
  });
  const clears = tops.slice(1).map((t, i) => t - P - tops[i]);
  const minClear = clears.length ? Math.min(...clears) : yTop - P;
  const shelfDs = panels.filter((x) => x.type === "shelf").map((x) => x.size.depth);
  const deepest = Math.max(...shelfDs);
  const shallowest = Math.min(...shelfDs);
  const name = stem;
  const notes = [
    `${name}. ${n} shel${n === 1 ? "f" : "ves"} between two leaning rails and two plumb back posts — ${inchFrac(deepest)}" deep at the bottom, ${inchFrac(shallowest)}" deep at the top. ${clears.length ? `${inchFrac(r16(minClear))}" clear between shelves.` : ""} ¾" plywood, fixed shelves, glued and screwed.`.replace(/\s{2,}/g, " "),
    `The leaning rails tip back ${leanDeg}° from plumb: ${inchFrac(D)}" from the wall at the floor, ${inchFrac(topD)}" at the top.`,
    ...(asked != null && n < asked ? [`${asked} shelves were asked; ${n} fit in the typed ${inchFrac(H)}" with at least ${SHELF_MIN_CLEAR}" clear between shelves. The size wins — add height for the rest.`] : []),
    "Anti-tip: screw each back post to a wall stud with an L bracket near the top — a loaded leaning shelf can tip forward.",
    ...(typed.width ? [] : [`Assumed ${inchFrac(W)}" wide — type a width to lock it.`]),
    ...(typed.height ? [] : [`Assumed ${inchFrac(H)}" tall — type a height to lock it.`]),
    ...(typed.depth ? [] : [`Assumed ${inchFrac(D)}" deep at the floor — type a depth to lock it.`]),
  ];
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: { width: W, height: H, depth: D },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes,
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "bookcase",
      family: "floor-carcase",
      affordances,
      unit: { ...u, width: W, height: H, depth: D, doors: false, shelfCount: n, drawersPerBank: undefined, rod: false, kneeW: undefined, counterH: undefined, mirror: false },
    },
    assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}

/** Litter box cabinet: a carcase that hides the box — a fixed entry panel with a cat hole, and a scoop door. */
export function isLitterCabinet(prompt: string): boolean {
  const l = prompt.toLowerCase();
  return /\blitter\s*(?:box(?:es)?|pan)?\b/.test(l) && /\b(?:cabinet|enclosure|cupboard|furniture|hider|hideaway|cover|console|bench|box\s+house|house)\b/.test(l.replace(/\blitter\s*box(?:es)?\b/g, " "));
}

const LITTER_BOX = { width: 19, depth: 15, height: 11 };
const LITTER_HOLE = 8;

function buildLitterCabinet(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const typed = typedOpeningStorageAxes(prompt);
  // Inside: the box plus room for the cat to step in beside it, and headroom to crouch.
  const W = typed.width ? u.width : 36;
  const D = typed.depth ? u.depth : 20;
  const H = typed.height ? u.height : 26;
  const x0 = -W / 2;
  const innerW = W - 2 * P;
  const innerH = H - 2 * P;
  const innerD = D - 0.25;
  const backT = 0.25;
  const typedBits = [typed.width ? `${inchFrac(W)}" wide` : "", typed.height ? `${inchFrac(H)}" tall` : "", typed.depth ? `${inchFrac(D)}" deep` : ""].filter(Boolean);
  const name = typedBits.length ? `Litter box cabinet ${typedBits.join(" × ")}` : "Litter box cabinet";
  const halfW = Math.round((W / 2 - 0.1) * 16) / 16;
  const holeY = Math.min(P + LITTER_HOLE / 2 + 2, H / 2);
  const panels: Panel[] = [];
  panels.push(panel("upright", "Left side", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right side", x0 + W - P, 0, 0, P, H, D));
  panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, backT));
  panels.push(panel("bottom", "Bottom", x0 + P, 0, backT, innerW, P, D - backT));
  panels.push(panel("top", "Top", x0 + P, H - P, backT, innerW, P, D - backT));
  const entry = panel("divider", "Entry panel", x0 + 0.1, 0, D, halfW, H, P);
  const r16 = (n: number) => Math.round(n * 16) / 16;
  entry.polygon = {
    plane: "xy",
    pts: [
      [0, 0],
      [r16(halfW), 0],
      [r16(halfW), H],
      [0, H],
    ],
    holes: [{ x: r16(halfW / 2), y: r16(holeY), r: LITTER_HOLE / 2 }],
  };
  entry.cutNote = `Cat entry: ${LITTER_HOLE}" round hole, center ${inchFrac(halfW / 2)}" from the left edge and ${inchFrac(holeY)}" up. Drill a starter hole and cut it with a jigsaw; sand the edge smooth.`;
  panels.push(entry);
  panels.push(panel("door", "Scoop door", x0 + W - halfW, 0, D, halfW, H, P));
  const fits = innerW >= LITTER_BOX.width + 6 && innerD >= LITTER_BOX.depth + 1 && innerH >= LITTER_BOX.height + 8;
  const notes = [
    `${name}. A carcase that hides the litter box: the left front is a fixed entry panel with an ${LITTER_HOLE}" cat hole, the right front is a scoop door on two hinges. ¾" plywood.`,
    `Inside ${inchFrac(innerW)}" wide × ${inchFrac(innerD)}" deep × ${inchFrac(innerH)}" tall — sized for a large ${LITTER_BOX.width}" × ${LITTER_BOX.depth}" × ${LITTER_BOX.height}" litter box with room for the cat to step in and crouch.`,
    ...(fits ? [] : [`The typed size is tight for a ${LITTER_BOX.width}" × ${LITTER_BOX.depth}" box — measure yours; the size you typed wins.`]),
    "Seal the inside (bottom and lower sides) with two coats of water-based poly so spills wipe up. Drill a few 1\" vent holes high in the back, or leave a ½\" gap under the top.",
    "Level it on the floor. Guidance only — measure your litter box and your cat before you cut.",
    ...(typed.width ? [] : [`Assumed 36" wide (litter cabinet default) — type a width to lock it.`]),
    ...(typed.height ? [] : [`Assumed 26" tall (litter cabinet default) — type a height to lock it.`]),
    ...(typed.depth ? [] : [`Assumed 20" deep (litter cabinet default) — type a depth to lock it.`]),
  ];
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: { width: W, height: H, depth: D + P },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes,
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "storage",
      family: "floor-carcase",
      affordances: affordances.filter((a) => a !== "cubbies"),
      unit: { ...u, width: W, height: H, depth: D, doors: true, shelfCount: 0, cubbies: undefined, drawersPerBank: undefined, rod: false, kneeW: undefined, counterH: undefined, mirror: false },
    },
    assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
  };
}

function buildShoeRack(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const W = u.width;
  const D = u.depth;
  const x0 = -W / 2;
  const innerW = W - P * 2;
  const backT = 0.25;
  // A spoken shelf count means usable shoe tiers (the floor board and the top are not counted).
  // Each tier clears SHOE_TIER_CLEAR. A typed height wins: fewer tiers fit, and the notes say so.
  const spokenTiers = spokenTierCount(prompt);
  const asked = spokenTiers != null ? Math.min(8, spokenTiers) : null;
  const typedH = typedHeightInches(prompt) ?? (asked == null ? 18 : null);
  const tierPitch = SHOE_TIER_CLEAR + P;
  const fitN = typedH != null ? Math.max(1, Math.floor((typedH - P + 1e-6) / tierPitch)) : null;
  const tiers = asked != null ? (fitN != null ? Math.min(asked, fitN) : asked) : fitN ?? 2;
  const H = typedH ?? Math.round((tiers * tierPitch + P) * 16) / 16;
  const tierClear = (H - P * (tiers + 1)) / tiers;
  // Bays wide enough for a pair of shoes (≥ 9" clear) unless a cubby count was spoken.
  const spokenCubbies = spokenCubbyCount(prompt);
  const cubbyN =
    spokenCubbies && spokenCubbies >= 2
      ? Math.max(2, Math.min(10, spokenCubbies))
      : Math.max(1, Math.min(8, Math.floor((W - P) / (SHOE_BAY_MIN + P))));
  const panels: Panel[] = [];
  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
  panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, backT));
  panels.push(panel("bottom", "Bottom", x0 + P, 0, backT, innerW, P, D - backT));
  for (let i = 1; i < tiers; i++) {
    const y = Math.round(i * (tierClear + P) * 16) / 16;
    panels.push(panel("shelf", tiers - 1 === 1 ? "Shoe shelf" : `Shoe shelf ${i}`, x0 + P, y, backT, innerW, P, D - backT));
  }
  panels.push(panel("top", "Top", x0 + P, H - P, backT, innerW, P, D - backT));
  const shelfN = tiers;
  for (let i = 1; i < cubbyN; i++) {
    const x = x0 + (W * i) / cubbyN - P / 2;
    panels.push(panel("divider", `Cubby divider ${i}`, x, P, backT, P, H - 2 * P, D - backT));
  }
  const bayW = (W - P * (cubbyN + 1)) / cubbyN;
  const shoeStem = "Shoe rack";
  const name = classDefaultDensifyTitle(shoeStem, prompt, { width: W, height: H, depth: D });
  const shoeAssumed = classDefaultAssumedNotes(prompt, shoeStem, { width: W, height: H, depth: D });
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
      `${name}. ${tiers} open shoe tier${tiers === 1 ? "" : "s"}, ${inchFrac(tierClear)}" clear each${cubbyN > 1 ? `, in ${cubbyN} bays about ${inchFrac(bayW)}" wide` : ""}${bayW >= SHOE_BAY_MIN - 0.01 ? " — room for a pair of shoes in every spot" : " — narrow cubbies hold one shoe each (a pair needs about 9\" of width)"}. Fixed shelves, glued and screwed. ¾" plywood.`,
      `${cubbyN > 1 ? "Glue and screw each cubby divider into the bottom, the shoe shelves and the top. " : ""}The floor board and the top close the box${asked != null ? "; the spoken count is the usable tiers" : ""}.`,
      ...(asked != null && tiers < asked ? [`${asked} tiers were asked; ${tiers} fit in the typed ${inchFrac(H)}" with ${SHOE_TIER_CLEAR}" clear each. The size wins — add height for the rest.`] : []),
      "Level it on the floor. Guidance only — confirm height for your entry.",
      ...shoeAssumed,
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "storage",
      family: "floor-carcase",
      affordances: affordances.includes("cubbies") ? affordances : [...affordances, "cubbies"],
      unit: {
        ...u,
        width: W,
        height: H,
        depth: D,
        doors: false,
        shelfCount: shelfN,
        cubbies: cubbyN,
        drawersPerBank: undefined,
        rod: false,
        kneeW: undefined,
        counterH: undefined,
        mirror: false,
      },
    },
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  };
}




/** Ottoman / pouf / footstool — solid top densify; square W=D when typed; never Storage / House wire. */
function buildOttoman(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  let W = u.width;
  let H = u.height;
  let D = u.depth;
  // Square plan when W≈D intent
  if (Math.abs(W - D) > 0.05 && Math.abs(W - H) < 0.05 && H > D) {
    // misread W×W×H as W×H×D
    D = W;
    H = u.depth;
  }
  if (Math.abs(W - D) > 0.05 && /square|ottoman|pouf|foot/.test(prompt.toLowerCase())) {
    const side = Math.max(W, D);
    // prefer equal when both look like plan dims
    if (Math.abs(W - D) < 6) {
      /* keep */
    } else if (H <= 20 && W > 20 && D > 20) {
      /* already plan */
    }
  }
  const x0 = -W / 2;
  const panels: Panel[] = [];
  const leg = Math.max(P, 1.5);
  const cushion = 3.5;
  const topY = Math.max(cushion, H - cushion);
  panels.push(panel("upright", "Front left leg", x0, 0, D - leg, leg, topY, leg));
  panels.push(panel("upright", "Front right leg", x0 + W - leg, 0, D - leg, leg, topY, leg));
  panels.push(panel("upright", "Back left leg", x0, 0, 0, leg, topY, leg));
  panels.push(panel("upright", "Back right leg", x0 + W - leg, 0, 0, leg, topY, leg));
  panels.push(panel("top", "Cushion top", x0, topY, 0, W, cushion, D));
  panels.push(panel("rail", "Front apron", x0 + leg, Math.max(0, topY - 3), D - leg, Math.max(6, W - leg * 2), 3, P));
  panels.push(panel("rail", "Back apron", x0 + leg, Math.max(0, topY - 3), leg - P, Math.max(6, W - leg * 2), 3, P));
  panels.push(panel("rail", "Left apron", x0 + leg - P, Math.max(0, topY - 3), leg, P, 3, Math.max(4, D - leg * 2)));
  panels.push(panel("rail", "Right apron", x0 + W - leg, Math.max(0, topY - 3), leg, P, 3, Math.max(4, D - leg * 2)));
  const name = `Ottoman ${W}" × ${H}" × ${D}"`;
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
      `${name}. Ottoman — solid top over a sit frame at ${H}" tall, square ${W}" × ${D}" plan. Not Storage, not a Yard House wire skeleton. ¾" plywood.`,
      `Solid top densify — sit-load apron frame. Guidance only — confirm ${H}" seat height.`,
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "bench",
      family: "seat",
      affordances,
      unit: {
        ...u,
        width: W,
        height: H,
        depth: D,
        doors: false,
        shelfCount: 0,
        drawersPerBank: undefined,
        rod: false,
        cubbies: undefined,
        kneeW: undefined,
        counterH: undefined,
      },
    },
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
      use: "person",
    },
  };
}


/**
 * Seating-lounge Seat deck cut size — width + depth honor typed overall/seat footprint
 * (not leg-inset). Soft-park root cause: lounge typed ~30″ W densified Seat at W−leg×2
 * (~27″) and typed 24″ seat D at seatD−leg×2 (~21″) while header held. Legs sit under the
 * deck (flush/overhang), so cut W×D == typed W × typed seat D. Shared by lounge / easy /
 * club / rocking sit densify — never entry bench / stool / Adirondack paths.
 */
function seatingLoungeSeatDeck(args: {
  x0: number;
  width: number;
  seatDepth: number;
  leg: number;
}): { x: number; z: number; w: number; d: number; crossX: number; crossW: number } {
  // args.leg kept for call-site compatibility.
  // Seat deck + cross-W faces (Backrest, front seat rail) span full typed W×D (legs under / flush).
  // Side rails stay between-leg in depth — long axis is seat D, not a typed-W lie.
  void args.leg;
  const d = Math.max(8, args.seatDepth);
  const w = Math.max(8, args.width);
  return { x: args.x0, z: 0, w, d, crossX: args.x0, crossW: w };
}

/** Lounge / easy / club chair — seat + back + legs; honor seat H + seat D; never House wire. */
function buildLoungeChair(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const seatH = u.height;
  const seatD = u.depth;
  const W = u.width;
  const backH = Math.max(14, Math.round(seatH * 0.95));
  const overallH = seatH + backH;
  const x0 = -W / 2;
  const leg = Math.max(P, 1.5);
  const panels: Panel[] = [];
  panels.push(panel("upright", "Front left leg", x0, 0, seatD - leg, leg, seatH, leg));
  panels.push(panel("upright", "Front right leg", x0 + W - leg, 0, seatD - leg, leg, seatH, leg));
  panels.push(panel("upright", "Back left leg", x0, 0, 0, leg, overallH, leg));
  panels.push(panel("upright", "Back right leg", x0 + W - leg, 0, 0, leg, overallH, leg));
  const seatDeck = seatingLoungeSeatDeck({ x0, width: W, seatDepth: seatD, leg });
  panels.push(panel("deck", "Seat", seatDeck.x, seatH - P, seatDeck.z, seatDeck.w, P, seatDeck.d));
  // Backrest + front seat rail match seat deck W (not silent W−leg×2). Side rails stay between-leg in D.
  // Backrest board screws to the FRONT faces of the back legs (full seat width, never through them).
  panels.push(panel("rail", "Backrest", seatDeck.crossX, seatH, leg, seatDeck.crossW, backH, P));
  panels.push(panel("rail", "Front seat rail", seatDeck.crossX, seatH - 3, seatD - leg - P, seatDeck.crossW, 3, P));
  panels.push(panel("rail", "Side rail left", x0 + leg, Math.max(2, seatH * 0.35), leg, P, 2.5, Math.max(4, seatD - leg * 2)));
  panels.push(panel("rail", "Side rail right", x0 + W - leg - P, Math.max(2, seatH * 0.35), leg, P, 2.5, Math.max(4, seatD - leg * 2)));
  const name = `Lounge chair ${W}" × ${seatH}" × ${seatD}"`;
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: { width: W, height: seatH, depth: seatD },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes: [
      `${name}. Lounge chair — real sit anatomy: seat at ${seatH}" seat height, ${seatD}" seat depth, backrest + legs/frame. Not Yard House wire, not naked Bench/Chair, not Adirondack. ¾" plywood.`,
      `Seat height ${seatH}" held; seat depth ${seatD}" held. Seat deck + Backrest + front seat rail span typed overall W (legs under); side rails span between legs in depth. Sit-test before you finish.`,
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: seatH, depth: seatD, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "bench",
      family: "seat",
      affordances,
      unit: {
        ...u,
        width: W,
        height: seatH,
        depth: seatD,
        doors: false,
        shelfCount: 0,
        drawersPerBank: undefined,
        rod: false,
        cubbies: undefined,
        kneeW: undefined,
        counterH: undefined,
      },
    },
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
      use: "person",
    },
  };
}

/** Rocking chair — seat height held + curved rocker rails under legs (≠ skis/sled). */
function buildRockingChair(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const seatH = u.height;
  const W = u.width;
  const D = Math.max(u.depth, 28);
  const backH = Math.max(14, Math.round(seatH * 0.95));
  const overallH = seatH + backH;
  const x0 = -W / 2;
  const leg = Math.max(P, 1.5);
  const rockerLift = 1.25;
  const rockerLen = D + 4;
  const panels: Panel[] = [];
  panels.push(panel("upright", "Front left leg", x0, rockerLift, D - leg - 2, leg, seatH - rockerLift, leg));
  panels.push(panel("upright", "Front right leg", x0 + W - leg, rockerLift, D - leg - 2, leg, seatH - rockerLift, leg));
  panels.push(panel("upright", "Back left leg", x0, rockerLift, 2, leg, overallH - rockerLift, leg));
  panels.push(panel("upright", "Back right leg", x0 + W - leg, rockerLift, 2, leg, overallH - rockerLift, leg));
  const seatDeck = seatingLoungeSeatDeck({ x0, width: W, seatDepth: D, leg });
  panels.push(panel("deck", "Seat", seatDeck.x, seatH - P, seatDeck.z, seatDeck.w, P, seatDeck.d));
  // Backrest matches seat deck W (same seatingLoungeSeatDeck cross-W rule as lounge/easy).
  // Backrest on the front faces of the back legs (they stand 2" in from the back).
  panels.push(panel("rail", "Backrest", seatDeck.crossX, seatH, 2 + leg, seatDeck.crossW, backH, P));
  // Curved rocker rails under the legs — named Rocker (not ski/sled).
  panels.push(panel("rail", "Rocker 1", x0, 0, -2, P, rockerLift + 0.5, rockerLen));
  panels.push(panel("rail", "Rocker 2", x0 + W - P, 0, -2, P, rockerLift + 0.5, rockerLen));
  const name = `Rocking chair ${W}" × ${seatH}" × ${D}"`;
  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: { width: W, height: seatH, depth: D },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes: [
      `${name}. Rocking chair — seat height ${seatH}" held. Curved rocker rails under the legs (Rocker 1 / Rocker 2) — not skis, not a sled, not Yard House wire. ¾" plywood.`,
      `Rocker densify: two curved rocker rails carry the legs. Sit-test the ${seatH}" seat height before you finish.`,
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: seatH, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "bench",
      family: "seat",
      affordances,
      unit: {
        ...u,
        width: W,
        height: seatH,
        depth: D,
        doors: false,
        shelfCount: 0,
        drawersPerBank: undefined,
        rod: false,
        cubbies: undefined,
        kneeW: undefined,
        counterH: undefined,
      },
    },
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
      use: "person",
    },
  };
}

function buildDaybed(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  const post = Math.max(P, 1.5);
  // Sleep deck sits low enough that the backrest is a real back, still inside the typed height.
  const deckY = Math.min(Math.max(12, Math.round(H * 0.5)), Math.max(12, H - 9));
  const backH = Math.max(8, H - deckY - P);
  const innerW = Math.max(12, W - post * 2);
  const innerD = Math.max(20, D - post * 2);
  const panels: Panel[] = [];
  panels.push(sleepFrameLeg("Leg front left", x0, 0, D - post, post, deckY + P));
  panels.push(sleepFrameLeg("Leg front right", x0 + W - post, 0, D - post, post, deckY + P));
  panels.push(sleepFrameLeg("Leg back left", x0, 0, 0, post, H));
  panels.push(sleepFrameLeg("Leg back right", x0 + W - post, 0, 0, post, H));
  panels.push(panel("deck", "Sleep deck", x0 + post, deckY, post, innerW, P, innerD));
  panels.push(panel("rail", "Front apron", x0 + post, Math.max(0, deckY - 3.5), D - post - P, innerW, 3.5, P));
  panels.push(panel("rail", "Backrest", x0 + post, deckY + P, post, innerW, backH, 1.5));
  panels.push(panel("rail", "Left side rail", x0 + post, deckY + P, post, P, Math.min(4, backH), innerD));
  panels.push(panel("rail", "Right side rail", x0 + W - post - P, deckY + P, post, P, Math.min(4, backH), innerD));

  const name = spec.name.match(/day\s*bed/i) ? spec.name : `Daybed ${W}" × ${H}" × ${D}"`;
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
      `${name}. One sleep deck at ~${deckY}" with a backrest — sit or sleep. Not a bunk stack, not a loft, not a hollow box.`,
      `2×2 posts + ¾" plywood deck. Side rails keep a mattress on the platform. Guidance only — confirm twin/full mattress size before you cut.`,
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "bench",
      family: "seat",
      affordances: affordances.includes("sleep-platforms")
        ? affordances
        : [...affordances, "sleep-platforms"],
      unit: {
        ...u,
        width: W,
        height: H,
        depth: D,
        doors: false,
        shelfCount: 0,
        drawersPerBank: undefined,
        rod: false,
        cubbies: undefined,
        kneeW: undefined,
        counterH: undefined,
      },
    },
    assumptions: {
      load: "heavy",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
      use: "person",
    },
  };
}

function buildPlatformBed(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  const post = Math.max(P, 1.5);
  const railH = Math.min(4, Math.max(2.5, H * 0.35));
  const deckY = Math.max(P, H - P - 0.01);
  const innerW = Math.max(12, W - post * 2);
  const innerD = Math.max(24, D - post * 2);
  const panels: Panel[] = [];
  // Low corner posts — solid 2x2 (not laminated ply strips, not a House wire skeleton).
  panels.push(sleepFrameLeg("Leg front left", x0, 0, D - post, post, H));
  panels.push(sleepFrameLeg("Leg front right", x0 + W - post, 0, D - post, post, H));
  panels.push(sleepFrameLeg("Leg back left", x0, 0, 0, post, H));
  panels.push(sleepFrameLeg("Leg back right", x0 + W - post, 0, 0, post, H));
  // Sleep deck — mattress sits on this platform.
  panels.push(panel("deck", "Sleep deck", x0 + post, deckY - P, post, innerW, P, innerD));
  // Side rails keep a mattress on the platform.
  panels.push(panel("rail", "Left side rail", x0 + post, deckY, post, P, railH, innerD));
  panels.push(panel("rail", "Right side rail", x0 + W - post - P, deckY, post, P, railH, innerD));
  panels.push(panel("rail", "Head rail", x0 + post, deckY, post, innerW, railH, P));
  panels.push(panel("rail", "Foot rail", x0 + post, deckY, D - post - P, innerW, railH, P));
  panels.push(panel("rail", "Front apron", x0 + post, Math.max(0, deckY - P - 3.5), D - post - P, innerW, 3.5, P));

  const name = spec.name.match(/platform\s*bed/i) ? spec.name : `Platform bed ${W}" × ${H}" × ${D}"`;
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
      `${name}. Sleep deck at ~${Math.round(deckY - P)}" — mattress on the platform. Side rails keep a mattress on the sleep surface. Not a hollow box, not a Yard House wire skeleton.`,
      `2×2 posts + ¾" plywood sleep deck. Platform sits ~${H}" tall × ${W}" wide × ${D}" long. Guidance only — confirm mattress size before you cut.`,
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "storage",
      family: "bunk",
      affordances: affordances.includes("sleep-platforms")
        ? affordances
        : [...affordances, "sleep-platforms"],
      unit: {
        ...u,
        width: W,
        height: H,
        depth: D,
        doors: false,
        shelfCount: 0,
        drawersPerBank: undefined,
        rod: false,
        cubbies: undefined,
        kneeW: undefined,
        counterH: undefined,
      },
    },
    assumptions: {
      load: "heavy",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
      use: "person",
    },
  };
}

function buildBunkBed(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const H = u.height;
  const post = Math.max(P, 1.5);
  const loft = isLoftBed(prompt.toLowerCase());
  // Posts stand outside the mattress. A frame that only matches the mattress on the outside
  // leaves a short deck (twin is 75 long; 1½" posts on each end ate that down to 72).
  const mattress = mattressDeck(prompt.toLowerCase()) ?? { width: 38, length: 75 };
  let W = u.width;
  let D = u.depth;
  if (W - post * 2 < mattress.width - 0.25) W = mattress.width + post * 2;
  if (D - post * 2 < mattress.length - 0.25) D = mattress.length + post * 2;
  const x0 = -W / 2;
  // Twin bunk: lower deck ~12", upper ~H-16" (guard room above mattress).
  // Loft: one elevated deck only — open floor under for desk/storage (not a second bunk).
  const lowerY = Math.min(14, Math.max(10, Math.round(H * 0.18)));
  const upperY = Math.min(H - 14, Math.max(lowerY + 28, Math.round(H * 0.72)));
  const guardH = 5;
  const innerW = Math.max(12, W - post * 2);
  const innerD = Math.max(24, D - post * 2);
  const panels: Panel[] = [];
  const TWO_BY_FOUR = "lumber-2x4-8";
  // Person load on ¾" wants a hold about every 21". Bearers sit under the deck, not in the bed.
  const pushBearers = (label: string, deckY: number) => {
    const allow = 20;
    const bearerH = 3.5;
    const bearerT = 1.5;
    const n = Math.max(1, Math.ceil(innerD / allow) - 1);
    const gap = innerD / (n + 1);
    for (let i = 1; i <= n; i++) {
      const z = post + gap * i - bearerT / 2;
      panels.push(panel("rail", `${label} bearer ${i}`, x0 + post, deckY - bearerH, z, innerW, bearerH, bearerT, TWO_BY_FOUR));
    }
  };
  // Four corner posts — solid 2x2 (same class as platform/daybed; not laminated ply strips).
  panels.push(sleepFrameLeg("Leg front left", x0, 0, D - post, post, H));
  panels.push(sleepFrameLeg("Leg front right", x0 + W - post, 0, D - post, post, H));
  panels.push(sleepFrameLeg("Leg back left", x0, 0, 0, post, H));
  panels.push(sleepFrameLeg("Leg back right", x0 + W - post, 0, 0, post, H));
  if (!loft) {
    panels.push(panel("deck", "Lower bunk", x0 + post, lowerY, post, innerW, P, innerD));
    pushBearers("Lower", lowerY);
  }
  panels.push(panel("deck", loft ? "Loft deck" : "Upper bunk", x0 + post, upperY, post, innerW, P, innerD));
  pushBearers(loft ? "Loft" : "Upper", upperY);
  // Guard rails on the elevated deck long sides.
  panels.push(panel("rail", "Upper left rail", x0 + post, upperY + P, post, innerW, guardH, P));
  panels.push(panel("rail", "Upper right rail", x0 + post, upperY + P, D - post - P, innerW, guardH, P));
  panels.push(panel("rail", "Upper head rail", x0 + post, upperY + P, post, P, guardH, innerD));
  panels.push(panel("rail", "Upper foot rail", x0 + W - post - P, upperY + P, post, P, guardH, innerD));

  const sized = `${W}" × ${H}" × ${D}"`;
  const name = loft
    ? spec.name.match(/loft/i)
      ? spec.name.replace(/\d+(?:\.\d+)?"\s*×\s*\d+(?:\.\d+)?"\s*×\s*\d+(?:\.\d+)?"/, sized)
      : `Loft bed ${sized}`
    : spec.name.match(/bunk/i)
      ? spec.name.replace(/\d+(?:\.\d+)?"\s*×\s*\d+(?:\.\d+)?"\s*×\s*\d+(?:\.\d+)?"/, sized)
      : `Bunk bed ${sized}`;
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
      loft
        ? `${name}. One elevated sleep platform on a post frame at ~${upperY}" — open floor under. Not a hollow box, not a twin bunk.`
        : `${name}. Two sleep platforms on a post frame — lower at ~${lowerY}", upper at ~${upperY}". Not a hollow box.`,
      `2×2 posts stand outside the mattress (${mattress.width}" × ${mattress.length}"). ¾" plywood decks with 2×4 bearers under them, not in the bed. Guard rails ~${guardH}" above the deck. Add a ladder or steps separately if you need them.`,
      "Guidance only — person load is heuristic, not stamped engineering. Confirm mattress size before you cut.",
    ],
    historic: false,
    opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
    fitted: {
      ...spec,
      name,
      program: "storage",
      family: "bunk",
      affordances: affordances.includes("sleep-platforms")
        ? affordances
        : [...affordances, "sleep-platforms"],
      unit: {
        ...u,
        width: W,
        height: H,
        depth: D,
        doors: false,
        shelfCount: 0,
        drawersPerBank: undefined,
        rod: false,
        cubbies: undefined,
        kneeW: undefined,
        counterH: undefined,
      },
    },
    assumptions: {
      load: "heavy",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
      use: "person",
    },
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

  // Corner-unit class: typed corner intent (or a corner spec from Measure) builds
  // right-triangle / quarter-round shelves against two walls meeting at 90°.
  if (spec.unit.odd || isOddShapePrompt(prompt)) {
    return buildOddShape(spec, prompt);
  }
  if (spec.unit.corner || isCornerUnitPrompt(prompt)) {
    return buildCornerUnit(spec, prompt);
  }

  const u = spec.unit;
  // BATCH6: bookshelf/bookcase fitted to W×H×D opening — honor opening order on the carcase.
  {
    const pl = prompt.toLowerCase();
    const openingFitBuild =
      (/bookcase|bookshelf/.test(pl) && (/fitted\s+to/.test(pl) || /\bopening\b/.test(pl)));
    if (openingFitBuild) {
      const t = prompt.replace(/×/g, "x").replace(/″/g, '"');
      const m = t.match(
        /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*(?:x|by)\s*(\d+(?:\.\d+)?)(?:\s*(?:in|inch|inches|")?\s*(?:x|by)\s*(\d+(?:\.\d+)?))?/i,
      );
      if (m && m[3]) {
        u.width = parseFloat(m[1]);
        u.height = parseFloat(m[2]);
        u.depth = parseFloat(m[3]);
        if (spec.opening) {
          spec.opening.width = u.width;
          spec.opening.height = u.height;
          spec.opening.depth = u.depth;
        }
        spec.name = `Bookcase ${u.width}" × ${u.height}" × ${u.depth}"`;
      }
    }
  }
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  const panels: Panel[] = [];
  const house = detectHouseFamily(prompt);
  const family: HouseFamily | undefined = spec.family ?? house?.family;
  const affordances: HouseAffordance[] = spec.affordances ?? house?.affordances ?? [];

  const sleepLower = prompt.toLowerCase();
  if (isPorchSwingFrame(sleepLower)) {
    return buildPorchSwing(spec, prompt);
  }
  if (/picnic/.test(sleepLower)) {
    return buildPicnic(spec, prompt);
  }
  const nightstand =
    (/nightstand/.test(sleepLower) || (/bedside/.test(sleepLower) && !isBedsideShelf(sleepLower))) &&
    !isBedsideShelf(sleepLower);
  if ((spec.program === "table" || family === "table") && !nightstand) {
    return buildTable(spec, prompt);
  }

  if (isBedsideShelf(sleepLower) || identityTitleStem(sleepLower) === "Bedside shelf") {
    return buildBedsideShelf(spec, prompt, affordances);
  }

  if (isDaybed(sleepLower) || identityTitleStem(sleepLower) === "Daybed") {
    return buildDaybed(spec, prompt, affordances);
  }

  if (isOttoman(sleepLower) || identityTitleStem(sleepLower) === "Ottoman") {
    return buildOttoman(spec, prompt, affordances);
  }
  if (isRockingChair(sleepLower) || identityTitleStem(sleepLower) === "Rocking chair") {
    return buildRockingChair(spec, prompt, affordances);
  }
  if (isLoungeChair(sleepLower) || identityTitleStem(sleepLower) === "Lounge chair") {
    return buildLoungeChair(spec, prompt, affordances);
  }

  if (isPlatformBed(sleepLower) || identityTitleStem(sleepLower) === "Platform bed") {
    return buildPlatformBed(spec, prompt, affordances);
  }

  if (
    family === "bunk" ||
    isBunkBed(sleepLower) ||
    isLoftBed(sleepLower) ||
    (affordances.includes("sleep-platforms") && !isDaybed(sleepLower) && !isPlatformBed(sleepLower))
  ) {
    return buildBunkBed(spec, prompt, affordances);
  }

  // Ironing board wall mount — hung-open mount + PDF mount height + clear swing (not portal / Yard House wire).
  if (isIroningWallMount(prompt) || identityTitleStem(prompt.toLowerCase()) === "Ironing board wall mount") {
    const boardLen = Math.max(
      36,
      pick(prompt, /(?:board|for\s+a)\s+(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″]|″)?/i, W) || W,
    );
    const mountW = Math.max(W, boardLen);
    const mountH = Math.min(H, 10);
    const mountD = Math.min(D, 6);
    const mountFromOpening = 36;
    panels.push(panel("rail", "Mount rail", x0, 0, 0, mountW, mountH, P));
    panels.push(panel("cleat", "Wall cleat", x0, mountH * 0.35, 0, mountW, P, P));
    panels.push(
      panel("deck", "Ironing board", x0 + Math.max(0, (mountW - boardLen) / 2), P, P, boardLen, Math.max(12, mountH - P), P),
    );
    const name = `Ironing board wall mount ${mountW}" × ${mountH}" × ${mountD}"`;
    return {
      id: createId("proj"),
      name,
      prompt,
      kind: "closet",
      overall: { width: mountW, height: mountH, depth: mountD },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `${name}. Ironing board wall mount for a ${boardLen}" board — clear wall mount, not a Yard House wire skeleton and not a key/coat portal. ¾" plywood.`,
        `Mount height from the wall: ${mountFromOpening}" up from the finished floor (PDF states mount height). Keep clear swing so the board clears the wall and door swing when folded down.`,
        `Clear swing: the ${boardLen}" board hinges down clear of the wall — lag the mount rail into studs. Guidance only.`,
      ],
      historic: false,
      opening: { ...spec.opening, width: mountW, height: mountH, depth: mountD, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        family: "hung-open",
        unit: { ...u, width: mountW, height: mountH, depth: mountD, doors: false, shelfCount: 0, drawersPerBank: undefined },
      },
      assumptions: { load: "medium", units: "inches", installMode: "wall", wallType: "wood_stud" },
    };
  }

  if (isIroningCabinet(prompt) && !isIroningWallMount(prompt)) {
    const innerW = W - P * 2;
    const backT = P;
    const boardW = Math.max(10, innerW - 0.25);
    const boardLen = Math.max(30, Math.round((H - P * 2 - 2) * 8) / 8);
    const legLen = Math.min(32, Math.max(24, Math.round((H * 0.62) * 8) / 8));
    const legW = 1.5;
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
    panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, backT));
    panels.push(panel("bottom", "Bottom", x0 + P, 0, backT, innerW, P, D - backT));
    panels.push(panel("top", "Top", x0 + P, H - P, backT, innerW, P, D - backT));
    panels.push(panel("door", "Door", x0 + 0.08, 0.08, D - P, W - 0.16, H - 0.16, P));
    panels.push(panel("deck", "Ironing board", x0 + P + (innerW - boardW) / 2, P, D - P * 2, boardW, boardLen, P));
    panels.push(
      panel(
        "deck",
        "Support leg",
        x0 + P + (innerW - legW) / 2,
        P,
        D - P * 3,
        legW,
        legLen,
        P,
      ),
    );
    const name = `Ironing cabinet ${W}" × ${H}" × ${D}"`;
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
        `${name}. Wall-mounted cabinet with a fold-down ironing board inside — not a floor box. ¾" plywood.`,
        `The ${boardLen}" × ${boardW}" board stores upright and hinges down on a piano hinge (a long continuous hinge along the bottom edge). A ${legLen}" support leg folds out to the floor.`,
        "Hang the carcase on studs through the back. Concealed hinges on the door. Not a closet and not a freestanding rectangle on the floor.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        unit: { ...u, width: W, height: H, depth: D, doors: true, shelfCount: 0, drawersPerBank: undefined, rod: false },
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }

  if (isMedicineCabinet(prompt)) {
    const innerW = W - P * 2;
    const backT = P;
    const face = shallowWallCabinetFace(D, backT);
    const shelfN = u.shelfCount && u.shelfCount > 0 ? u.shelfCount : 2;
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
    panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, backT));
    panels.push(panel("bottom", "Bottom", x0 + P, 0, backT, innerW, P, D - backT));
    panels.push(panel("top", "Top", x0 + P, H - P, backT, innerW, P, D - backT));
    const innerH = H - P * 2;
    for (let i = 1; i <= shelfN; i++) {
      const y = P + (innerH * i) / (shelfN + 1);
      panels.push(panel("shelf", `Shelf ${i}`, x0 + P, y, backT, innerW, P, face.shelfDepth));
    }
    panels.push(panel("door", "Door", x0 + 0.08, 0.08, face.doorZ, W - 0.16, H - 0.16, face.doorT));
    panels.push(panel("mirror", "Mirror", x0 + 1.1, 1.1, face.mirrorZ, W - 2.2, H - 2.2, face.mirrorT));
    const name = `Medicine cabinet ${W}" × ${H}" × ${D}"`;
    const studNote = backReachesTwoStuds(innerW)
      ? "Hang the carcase on studs through the back."
      : `The back is ${innerW}" wide, so it cannot hit two studs at ${STUD_CENTER_IN}" centers. Lag the corner that hits a stud and use rated wall anchors at the others — not four corner screws into studs.`;
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
        `${name}. Wall-mounted bathroom cabinet with a mirrored door and ${shelfN} shelves inside — not a floor vanity and not a closet. ¾" plywood. Finished depth is the ${D}" you typed; the door does not add a slab past that.`,
        `${studNote} Typical center sits about 60–66" off the floor (eye height). Concealed hinges on the door. Shelves stop ${HINGE_ARM_CLEAR_IN}" short of the door so it can close. Glue the mirror to the outside face of the door.`,
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        unit: {
          ...u,
          width: W,
          height: H,
          depth: D,
          doors: true,
          shelfCount: shelfN,
          drawersPerBank: undefined,
          rod: false,
          kneeW: undefined,
          counterH: undefined,
          mirror: true,
        },
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }

  if (isOverToilet(prompt) || family === "straddle") {
    const innerW = W - P * 2;
    const tall = H >= 48;
    if (!tall) {
      const shelfN = u.shelfCount && u.shelfCount > 0 ? u.shelfCount : 2;
      panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
      panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
      panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, P));
      panels.push(panel("bottom", "Bottom", x0 + P, 0, P, innerW, P, D - P));
      panels.push(panel("top", "Top", x0 + P, H - P, P, innerW, P, D - P));
      const innerH = H - P * 2;
      for (let i = 1; i <= shelfN; i++) {
        const y = P + (innerH * i) / (shelfN + 1);
        panels.push(panel("shelf", `Shelf ${i}`, x0 + P, y, P, innerW, P, D - P));
      }
      const name = `Over-toilet ${W}" × ${H}" × ${D}"`;
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
          `${name}. Wall-mounted cabinet above the toilet tank — not a floor vanity. ¾" plywood.`,
          "Hang the carcase on studs through the back. Typical bottom sits about 8–12\" above the tank.",
        ],
        historic: false,
        opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
        fitted: {
          ...spec,
          name,
          program: "storage",
          unit: { ...u, width: W, height: H, depth: D, doors: false, shelfCount: shelfN, drawersPerBank: undefined, rod: false, kneeW: undefined, counterH: undefined },
        },
        assumptions: { load: "medium", units: "inches", installMode: "wall", wallType: "wood_stud" },
      };
    }
    const tankClear = Math.min(34, Math.max(28, Math.round((H * 0.47) * 8) / 8));
    const backT = 0.25;
    const shelfN = u.shelfCount && u.shelfCount > 0 ? u.shelfCount : 3;
    const upperN = Math.max(1, shelfN - 1);
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
    panels.push(panel("shelf", "Tank shelf", x0 + P, tankClear, 0, innerW, P, D));
    panels.push(panel("top", "Top", x0 + P, H - P, 0, innerW, P, D));
    const y0 = tankClear + P;
    const y1 = H - P;
    for (let i = 1; i <= upperN; i++) {
      const y = y0 + ((y1 - y0) * i) / (upperN + 1);
      panels.push(panel("shelf", `Shelf ${i}`, x0 + P, y, 0.1, innerW, P, D - 0.2));
    }
    panels.push(panel("back", "Upper back", x0 + P, tankClear, 0, innerW, H - tankClear, backT));
    const name = `Over-toilet ${W}" × ${H}" × ${D}"`;
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
        `${name}. Floor étagère that straddles the toilet — open under the tank shelf, not a closed floor box. ¾" plywood.`,
        `The ${tankClear}" tank shelf sits above a typical toilet tank. Legs (the uprights) go to the floor on either side. Lag the uprights into studs so it cannot tip.`,
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        unit: { ...u, width: W, height: H, depth: D, doors: false, shelfCount: shelfN, drawersPerBank: undefined, rod: false, kneeW: undefined, counterH: undefined },
      },
      assumptions: { load: "medium", units: "inches", installMode: "wall", wallType: "wood_stud" },
    };
  }

  // Slot-rack class (plate / magazine / dish) — spoken N slots densify like open-cubby dividers; never Storage.
  if (isSlotRack(prompt.toLowerCase()) || identityTitleStem(prompt.toLowerCase()) === "Plate rack" || identityTitleStem(prompt.toLowerCase()) === "Magazine rack") {
    const slotLower = prompt.toLowerCase();
    const stem = slotRackTitle(slotLower);
    const spokenSlots = spokenSlotCount(prompt);
    const slotN = Math.max(2, Math.min(24, spokenSlots != null ? spokenSlots : 3));
    const innerW = W - P * 2;
    const backT = P;
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
    panels.push(panel("bottom", "Bottom", x0 + P, 0, backT, innerW, P, D - backT));
    panels.push(panel("top", "Top", x0 + P, H - P, backT, innerW, P, D - backT));
    panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, backT));
    // N slots → N−1 vertical dividers (open-cubby / open-shelving slot densify class).
    // Equal bays: every slot (end bays included) is the same clear width.
    const bay = (innerW - (slotN - 1) * P) / slotN;
    for (let i = 1; i < slotN; i++) {
      const x = x0 + P + i * bay + (i - 1) * P;
      panels.push(panel("divider", `Slot ${i}`, x, P, backT, P, H - 2 * P, D - backT));
    }
    const bayW = inch16(bay);
    const name = `${stem} ${W}" × ${H}" × ${D}"`;
    const slotWord = slotN === 3 ? "three" : slotN === 2 ? "two" : String(slotN);
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
        `${name}. Open ${stem.toLowerCase()} with ${slotN} plate slots (${slotWord} slots, ~${bayW}" bays) and dividers — not a hollow Storage box. ¾" plywood.`,
        `Glue and screw each of the ${slotN - 1} plate slot dividers (Slot 1–${slotN - 1}) into the top, bottom, and back — ${slotN} slots between the uprights, no extra board against the right upright. Hit studs if wall-lagged. Guidance only — confirm the ${W}" × ${H}" × ${D}" opening.`,
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        family: "floor-carcase",
        unit: { ...u, width: W, height: H, depth: D, doors: false, shelfCount: 0, drawersPerBank: undefined, rod: false },
      },
      assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
    };
  }

  if (isSpiceRack(prompt)) {
    const innerW = W - P * 2;
    const backT = P;
    const shelfN = u.shelfCount && u.shelfCount > 0 ? u.shelfCount : 3;
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
    for (let i = 0; i < shelfN; i++) {
      const y = shelfN === 1 ? 0 : (i * (H - P)) / (shelfN - 1);
      panels.push(panel("shelf", `Shelf ${i + 1}`, x0 + P, y, backT, innerW, P, D - backT));
      panels.push(panel("rail", `Jar lip ${i + 1}`, x0 + P, y + P, D - P, innerW, 1.25, P));
    }
    panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, backT));
    const name = `Spice rack ${W}" × ${H}" × ${D}"`;
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
        `${name}. Wall-mounted open spice rack with jar lips — not a floor box and not a medicine cabinet. ¾" plywood.`,
        "Hang the rack on studs through the back. Typical bottom sits about 48–54\" off the floor so jars are at counter height. Glue the shelves; do not pin them.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        unit: {
          ...u,
          width: W,
          height: H,
          depth: D,
          doors: false,
          shelfCount: shelfN,
          drawersPerBank: undefined,
          rod: false,
          kneeW: undefined,
          counterH: undefined,
          mirror: false,
        },
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }

  if (isWineRack(prompt)) {
    const innerW = W - P * 2;
    const backT = P;
    const spokenBottles = spokenBottleCount(prompt);
    const saidShelves = /\d+\s*shel/i.test(prompt);
    const layout = wineRackLayout({
      W,
      H,
      t: P,
      asked: spokenBottles,
      shelfCount: saidShelves ? u.shelfCount : undefined,
      heightTyped: typedHeightInches(prompt) != null,
      fill: wantsBottleFill(prompt),
    });
    const { rows, cols, grid, cellW, cellH, openShelves, openClear, plinth } = layout;
    const HR = layout.H;
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, HR, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, HR, D));
    // Bottom shelf, then one shelf per bottle row at the bottle pitch (cell + board).
    // A plinth (spare typed height under ~6") lifts the rows so the top cap lands at the typed height.
    const rowFloor = (r: number) => plinth + (r === 0 ? 0 : P + r * cellH + (r - 1) * P);
    // The plinth sits back from the front like a toe kick (never behind the back panel).
    const plinthZ = Math.max(backT, D - P - Math.min(WINE_PLINTH_SETBACK, Math.max(0, D - backT - 2 * P)));
    if (plinth > 0) panels.push(panel("kick", "Plinth", x0 + P, 0, plinthZ, innerW, plinth, P));
    const gridTopY = rowFloor(rows);
    // Each bottle slides in over a scalloped cradle rail: one scallop per bottle, cut low enough that a
    // 3 1/2" bottle clears the row above, and the neck rests in the scallop.
    const bottleCentres = grid && cols >= 2
      ? Array.from({ length: cols }, (_, c) => c * (cellW + P) + cellW / 2)
      : Array.from({ length: cols }, (_, c) => (c + 0.5) * (innerW / cols));
    const cradle = wineCradle(cellH);
    for (let r = 0; r <= rows; r++) {
      const y = rowFloor(r);
      // Middle shelves of a divider grid are notched (egg-crate) — their own cut line.
      const gridShelf = grid && cols >= 2 && r > 0 && r < rows;
      const nm = gridShelf ? `Grid shelf ${r}` : `Shelf ${r + 1}`;
      panels.push(panel("shelf", nm, x0 + P, y, backT, innerW, P, D - backT));
      // Front rail on every bottle-row floor (never the cap) — keeps rails inside overall H.
      if (r < rows) {
        const rail = panel("rail", `Bottle rail ${r + 1}`, x0 + P, y + P, D - P, innerW, WINE_RAIL_H, P);
        rail.polygon = { plane: "xy", pts: wineCradleOutline(innerW, bottleCentres, cradle.floor) };
        rail.cutNote = `Scalloped cradle: ${bottleCentres.length} scallops ${inch16(WINE_BOTTLE_CLEAR)}" wide, cut down to ${inch16(cradle.floor)}" of rail, one centred on each bottle. Trace the arcs from the plan and cut with a jigsaw.`;
        panels.push(rail);
      }
    }
    // Open shelves above the bottle rows (typed height taller than the count needs), then the top cap.
    // The last open shelf is the top cap, at the typed height — nothing stands above it.
    let extraShelves = 0;
    for (let k = 1; k <= openShelves; k++) {
      const y = gridTopY + P + k * openClear + (k - 1) * P;
      const cap = k === openShelves;
      panels.push(panel("shelf", cap ? `Shelf ${rows + 1 + k}` : `Open shelf ${k}`, x0 + P, y, backT, innerW, P, D - backT));
      extraShelves++;
    }
    // Grid racks: one opening per bottle. Dividers sit on exact centres (cell + board),
    // stop behind the front rails, span only the bottle rows, and half-lap over every
    // shelf they cross.
    if (grid && cols >= 2) {
      for (let c = 1; c < cols; c++) {
        const x = x0 + P + c * cellW + (c - 1) * P;
        panels.push(panel("divider", `Bottle divider ${c}`, x, plinth + P, backT, P, gridTopY - plinth - P, D - backT - P));
      }
    }
    panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, HR, backT));
    const name = `Wine rack ${W}" × ${HR}" × ${D}"`;
    const inch = inch16;
    const slotVoice = wineCapacityVoice(layout, spokenBottles, HR);
    const openingVoice = grid
      ? `Each opening is ${inch(cellW)}" wide × ${inch(cellH)}" tall clear (at least 3.5" both ways so a bottle fits, one bottle high).`
      : `Rows are ${inch(cellH)}" tall clear and ${inch(innerW)}" wide — about ${cols} bottles side by side, each with ${inch(innerW / cols)}" of width.`;
    return {
      id: createId("proj"),
      name,
      prompt,
      kind: "closet",
      overall: { width: W, height: HR, depth: D },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `${name}. Wall-mounted open wine rack. ${slotVoice} Not a bookcase and not a hollow box.`,
        `Bottles lie on their sides, necks facing out. ${openingVoice} Glue a ${inch(WINE_RAIL_H)}" scalloped cradle rail on the front of every bottle-row shelf: one ${inch(WINE_BOTTLE_CLEAR)}" wide scallop per bottle, cut down to ${inch(cradle.floor)}", so each bottle slides in with ${inch(cradle.clear)}" clear above the cradle and its neck rests in the scallop.${grid && cols >= 2 ? ` The ${cols - 1} divider${cols - 1 === 1 ? "" : "s"} half-lap over the ${Math.max(0, rows - 1)} middle shel${rows - 1 === 1 ? "f" : "ves"} (egg-crate).` : ""} Glue the shelves; do not pin them — a loaded row is heavy.`,
        "Hang the rack on studs through the back. Typical bottom sits about 36–42\" off the floor, or sit it on a counter and still lag it so it cannot tip. Guidance only.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: HR, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        unit: {
          ...u,
          width: W,
          height: HR,
          depth: D,
          doors: false,
          shelfCount: rows + 1 + extraShelves,
          drawersPerBank: undefined,
          rod: false,
          kneeW: undefined,
          counterH: undefined,
          mirror: false,
        },
      },
      assumptions: {
        load: "heavy",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }


  // Shallow shelf spanning a door portal above the swing — clear swing below; not a floor carcase.
  if (isPortalSpanShelf(prompt.toLowerCase())) {
    const spanLower = prompt.toLowerCase();
    const portalW = W;
    const portalTriple = prompt.replace(/×/g, "x").match(/(\d+(?:\.\d+)?)\s*(?:x|by)\s*(\d+(?:\.\d+)?)/i);
    const portalH = Math.max(
      H,
      portalTriple ? Math.max(parseFloat(portalTriple[1]), parseFloat(portalTriple[2])) : H,
    );
    // Shallow into the portal so the door keeps clear swing below.
    const shelfD = Math.max(3, Math.min(D > 1 && D < 10 ? D : 4, 6));
    const cleatH = Math.max(3, Math.min(3.5, shelfD));
    panels.push(panel("rail", "Cleat", x0, 0, 0, portalW, cleatH, P));
    panels.push(panel("shelf", "Over-door shelf", x0, cleatH, 0, portalW, P, shelfD));
    const stackH = cleatH + P;
    // Above the swing arc — high on the portal envelope.
    const mountFromOpening = Math.round(Math.min(portalH - 6, Math.max(72, portalH * 0.9)));
    const label = portalSpanShelfTitle(spanLower);
    const notes = [
      `${label} spanning a ${portalW}" × ${portalH}" door portal above the swing — clear swing below. ¾" plywood.`,
      `Mount height from the opening: ${mountFromOpening}" up from the finished floor (above the swing arc). Keep clear swing below so the door clears under the shelf.`,
      `Span the full ${portalW}" portal width. Hit studs through the cleat. Guidance only — portal span shelf, not a shelving niche.`,
    ];
    return {
      id: createId("proj"),
      name: `${label} ${portalW}" portal`,
      prompt,
      kind: "closet",
      overall: { width: portalW, height: portalH, depth: shelfD },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes,
      historic: false,
      opening: {
        ...spec.opening,
        width: portalW,
        height: portalH,
        depth: shelfD,
        kind: "alcove",
      },
      fitted: {
        ...spec,
        unit: {
          ...u,
          width: portalW,
          height: portalH,
          depth: shelfD,
          doors: false,
          shelfCount: 1,
          drawersPerBank: undefined,
        },
        program: "storage",
        family: "hung-open",
        name: `${label} ${portalW}" portal`,
        affordances: affordances.includes("cleats") ? affordances : [...affordances, "cleats"],
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }

  // Towel rail in a door portal — clear swing; not a shelving niche / linen closet.
  // When hooks/pegs are also typed, densify BOTH towel rail + hooks (universal towel+hook class).
  if (isTowelPortalRail(prompt.toLowerCase())) {
    const towelLower = prompt.toLowerCase();
    const withHooks = towelPortalWantsHooks(towelLower);
    const portalW = W;
    const portalTriple = prompt.replace(/×/g, "x").match(/(\d+(?:\.\d+)?)\s*(?:x|by)\s*(\d+(?:\.\d+)?)/i);
    const portalH = Math.max(
      H,
      portalTriple ? Math.max(parseFloat(portalTriple[1]), parseFloat(portalTriple[2])) : H,
    );
    const railD = Math.max(2.5, Math.min(D > 1 && D < 10 ? D : 3.5, 4));
    const railH = Math.max(3.5, Math.min(5, railD + 1));
    // Cut identity: towel rail always; hooks densify via notes/steps (not towel-only path).
    panels.push(panel("back", withHooks ? "Towel + hook rail" : "Towel rail", x0, 0, 0, portalW, railH, P));
    const mountFromOpening = Math.round(Math.min(60, Math.max(48, portalH * 0.55)));
    const hookSaid = towelLower.match(/(\d+)\s*hooks?/);
    const hooks = hookSaid
      ? Math.max(2, Math.min(12, parseInt(hookSaid[1], 10)))
      : Math.max(3, Math.min(8, Math.round(portalW / 6)));
    const notes = withHooks
      ? [
          `Towel + hook rail in a ${portalW}" × ${portalH}" door portal — ${hooks} hooks on the towel rail. Clear swing. ¾" plywood.`,
          `Mount height from the opening: ${mountFromOpening}" up from the finished floor. Keep clear swing so the door clears the towels.`,
          `Screw ${hooks} hooks into the rail, about 6" on center. Span the full ${portalW}" portal width. Hit studs. Guidance only — portal rail, not a shelving niche.`,
        ]
      : [
          `Towel rail in a ${portalW}" × ${portalH}" door portal — clear swing. ¾" plywood.`,
          `Mount height from the opening: ${mountFromOpening}" up from the finished floor. Keep clear swing so the door clears the towels.`,
          `Span the full ${portalW}" portal width. Hit studs. Guidance only — portal rail, not a shelving niche.`,
        ];
    const title = withHooks
      ? `Towel + hook rail ${portalW}" portal · ${hooks} hooks`
      : `Towel rail ${portalW}" portal`;
    return {
      id: createId("proj"),
      name: title,
      prompt,
      kind: "closet",
      overall: { width: portalW, height: portalH, depth: railD },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes,
      historic: false,
      opening: {
        ...spec.opening,
        width: portalW,
        height: portalH,
        depth: railD,
        kind: "alcove",
      },
      fitted: {
        ...spec,
        unit: {
          ...u,
          width: portalW,
          height: portalH,
          depth: railD,
          doors: false,
          shelfCount: 0,
          drawersPerBank: undefined,
        },
        name: title,
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }

  // Shoe cubbies in a door portal — open bays + shelves, clear swing; not a shoe rail / niche.
  if (isShoePortalCubbies(prompt.toLowerCase())) {
    const shoeLower = prompt.toLowerCase();
    const portalW = W;
    const portalTriple = prompt.replace(/×/g, "x").match(/(\d+(?:\.\d+)?)\s*(?:x|by)\s*(\d+(?:\.\d+)?)/i);
    const portalH = Math.max(
      H,
      portalTriple ? Math.max(parseFloat(portalTriple[1]), parseFloat(portalTriple[2])) : H,
    );
    // Shallow into the portal so the door keeps clear swing.
    const cubbyD = Math.max(8, Math.min(D > 4 ? D : 12, 14));
    const pairSaid = shoeLower.match(/(\d+)\s*pairs?/);
    const pairs = pairSaid
      ? Math.max(2, Math.min(12, parseInt(pairSaid[1], 10)))
      : Math.max(2, Math.min(8, Math.round(portalW / 9)));
    const cubbyN = pairs;
    const backT = 0.25;
    const shelfN = Math.max(2, Math.min(4, Math.round((Math.min(portalH * 0.35, 28) - P) / 6)));
    const boxH = Math.max(14, Math.min(portalH * 0.4, shelfN * 6 + P));
    const innerW = portalW - P * 2;
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, boxH, cubbyD));
    panels.push(panel("upright", "Right upright", x0 + portalW - P, 0, 0, P, boxH, cubbyD));
    panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, boxH, backT));
    for (let i = 0; i < shelfN; i++) {
      const y = i === 0 ? 0 : (boxH - P) * (i / (shelfN - 1 || 1));
      const label = i === 0 ? "Shoe shelf" : `Shoe shelf ${i + 1}`;
      panels.push(panel("shelf", label, x0 + P, Math.min(y, boxH - P), backT, innerW, P, cubbyD - backT));
    }
    if (shelfN === 1) {
      panels.push(panel("top", "Top", x0 + P, boxH - P, backT, innerW, P, cubbyD - backT));
    }
    for (let i = 1; i < cubbyN; i++) {
      const x = x0 + (portalW * i) / cubbyN - P / 2;
      panels.push(panel("divider", `Cubby divider ${i}`, x, P, backT, P, boxH - 2 * P, cubbyD - backT));
    }
    const mountFromOpening = Math.round(Math.min(18, Math.max(4, portalH * 0.08)));
    const bayW = Math.round(((portalW - P * (cubbyN + 1)) / cubbyN) * 10) / 10;
    const notes = [
      `Shoe cubbies in a ${portalW}" × ${portalH}" door portal — ${pairs} pairs / ${cubbyN} bays (~${bayW}" wide), clear swing. ¾" plywood.`,
      `Mount height from the opening: ${mountFromOpening}" up from the finished floor (bottom of the cubby box). Keep clear swing so the door clears the footwear.`,
      `Glue and screw each cubby divider into the shoe shelves and back. Hit studs. Guidance only — portal cubbies, not a shelving niche.`,
    ];
    return {
      id: createId("proj"),
      name: `Shoe cubbies ${portalW}" portal · ${pairs} pairs`,
      prompt,
      kind: "closet",
      overall: { width: portalW, height: portalH, depth: cubbyD },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes,
      historic: false,
      opening: {
        ...spec.opening,
        width: portalW,
        height: portalH,
        depth: cubbyD,
        kind: "alcove",
      },
      fitted: {
        ...spec,
        unit: {
          ...u,
          width: portalW,
          height: portalH,
          depth: cubbyD,
          doors: false,
          shelfCount: shelfN,
          cubbies: cubbyN,
          drawersPerBank: undefined,
        },
        program: "storage",
        name: `Shoe cubbies ${portalW}" portal · ${pairs} pairs`,
        affordances: affordances.includes("cubbies") ? affordances : [...affordances, "cubbies"],
      },
      assumptions: {
        load: "light",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }

  // Shoe rail in a door portal — pairs on a rail, clear swing; not a shelving niche.
  // Pegs are cut plywood (one per pair) so steps never invent hardware missing from the cut list.
  if (isShoePortalRail(prompt.toLowerCase())) {
    const shoeLower = prompt.toLowerCase();
    const portalW = W;
    const portalTriple = prompt.replace(/×/g, "x").match(/(\d+(?:\.\d+)?)\s*(?:x|by)\s*(\d+(?:\.\d+)?)/i);
    const portalH = Math.max(
      H,
      portalTriple ? Math.max(parseFloat(portalTriple[1]), parseFloat(portalTriple[2])) : H,
    );
    // Typed D is how far pegs may stick into the portal (clear swing). Cap at 4".
    const pegLen = Math.max(3, Math.min(D, 4));
    // Rail face height stays on the wall plane — keep it ≤ pegLen so cut dims honor the typed depth envelope.
    const railH = Math.max(3.5, Math.min(pegLen, 5));
    panels.push(panel("back", "Shoe rail", x0, 0, 0, portalW, railH, P));
    const pairSaid = shoeLower.match(/(\d+)\s*pairs?/);
    const pairs = pairSaid
      ? Math.max(2, Math.min(12, parseInt(pairSaid[1], 10)))
      : Math.max(2, Math.min(8, Math.round(portalW / 9)));
    const pegFace = Math.max(1.5, Math.min(2.25, Math.round(railH * 0.45 * 8) / 8));
    for (let i = 0; i < pairs; i++) {
      const x = x0 + (portalW * (i + 1)) / (pairs + 1) - P / 2;
      panels.push(
        panel("divider", `Shoe peg ${i + 1}`, x, (railH - pegFace) / 2, P, P, pegFace, pegLen),
      );
    }
    const mountFromOpening = Math.round(Math.min(18, Math.max(6, portalH * 0.12)));
    const notes = [
      `Shoe rail in a ${portalW}" × ${portalH}" door portal — ${pairs} pairs on ${pairs} × ${pegLen}" plywood pegs. ¾" plywood.`,
      `Mount height from the opening: ${mountFromOpening}" up from the finished floor. Keep clear swing so the door clears the footwear.`,
      `Screw each shoe peg into the rail about 8–9" on center. Hit studs. Guidance only — portal not a shelving niche.`,
    ];
    return {
      id: createId("proj"),
      name: `Shoe rail ${portalW}" portal · ${pairs} pairs`,
      prompt,
      kind: "closet",
      overall: { width: portalW, height: portalH, depth: pegLen },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes,
      historic: false,
      opening: {
        ...spec.opening,
        width: portalW,
        height: portalH,
        depth: pegLen,
        kind: "alcove",
      },
      fitted: {
        ...spec,
        unit: {
          ...u,
          width: portalW,
          height: portalH,
          depth: pegLen,
          doors: false,
          shelfCount: 0,
          drawersPerBank: undefined,
        },
        program: "storage",
      },
      assumptions: {
        load: "light",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }

  // Coat + cubby dual wall — four cubbies + full-width coat rod, honor fitted D (not Coat rod–only / D12).
  if (isCoatCubbyWall(prompt.toLowerCase())) {
    const cubbyN =
      u.cubbies && u.cubbies >= 2
        ? Math.max(2, Math.min(10, u.cubbies))
        : Math.max(4, Math.min(6, Math.round(W / 12)));
    const backT = 0.25;
    const rodY = Math.min(H - 8, Math.max(60, Math.round(H * 0.72)));
    const shelfN = u.shelfCount && u.shelfCount >= 1 ? Math.min(3, u.shelfCount) : 1;
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
    panels.push(panel("back", "Back", x0 + P, 0, 0, W - P * 2, H, backT));
    panels.push(panel("bottom", "Bottom", x0 + P, 0, backT, W - P * 2, P, D - backT));
    panels.push(panel("top", "Top", x0 + P, H - P, backT, W - P * 2, P, D - backT));
    for (let i = 1; i < cubbyN; i++) {
      const x = x0 + (W * i) / cubbyN - P / 2;
      panels.push(panel("divider", `Cubby divider ${i}`, x, P, backT, P, H - 2 * P, D - backT));
    }
    // Mid shelves for cubby bays when tall.
    if (H >= 48) {
      const yMid = Math.round((H / 2) * 8) / 8;
      panels.push(panel("shelf", "Cubby shelf", x0 + P, yMid, backT, W - P * 2, P, D - backT));
    }
    panels.push(panel("rail", "Coat rod", x0 + P, rodY, D * 0.45, W - P * 2, 1.25, 1.25));
    const bayW = Math.round(((W - P * (cubbyN + 1)) / cubbyN) * 10) / 10;
    const name = `Coat and cubby wall ${W}" × ${H}" × ${D}"`;
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
        `${name}. Dual affordance: ${cubbyN} cubbies (~${bayW}" bays) and a full-width coat rod — not Coat rod–only. Fitted depth ${D}". ¾" plywood.`,
        `Full-width coat rod spans the ${W}" opening at ${rodY}" up. Glue and screw each cubby divider into the shelves and back.`,
        `Four cubbies densify with dividers. Hit studs if wall-lagged. Guidance only — confirm the ${W}" × ${H}" × ${D}" opening.`,
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D },
      fitted: {
        ...spec,
        name,
        program: "storage",
        family: "floor-carcase",
        affordances: affordances.includes("cubbies")
          ? affordances.includes("hooks")
            ? affordances
            : [...affordances, "hooks"]
          : affordances.includes("hooks")
            ? [...affordances, "cubbies"]
            : [...affordances, "cubbies", "hooks"],
        unit: {
          ...u,
          width: W,
          height: H,
          depth: D,
          doors: false,
          cubbies: cubbyN,
          shelfCount: shelfN,
          drawersPerBank: undefined,
          rod: true,
        },
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "alcove",
        wallType: "wood_stud",
      },
    };
  }

  // Open cubby wall / mudroom / toy·kids cubbies — floor carcase with N divider bays (never bare Storage / empty box).
  if (isOpenCubbyWall(prompt.toLowerCase()) || isMudroomCubbyWall(prompt.toLowerCase())) {
    const lower = prompt.toLowerCase();
    const stem = openCubbyWallTitle(lower);
    const cubbyN =
      u.cubbies && u.cubbies >= 2
        ? Math.max(2, Math.min(12, u.cubbies))
        : Math.max(3, Math.min(6, Math.round(W / 12)));
    const backT = 0.25;
    const shelfN =
      u.shelfCount && u.shelfCount >= 1
        ? Math.min(6, u.shelfCount)
        : H >= 40
          ? 1
          : 0;
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
    panels.push(panel("back", "Back", x0 + P, 0, 0, W - P * 2, H, backT));
    panels.push(panel("bottom", "Bottom", x0 + P, 0, backT, W - P * 2, P, D - backT));
    panels.push(panel("top", "Top", x0 + P, H - P, backT, W - P * 2, P, D - backT));
    for (let i = 1; i < cubbyN; i++) {
      const x = x0 + (W * i) / cubbyN - P / 2;
      panels.push(panel("divider", `Cubby divider ${i}`, x, P, backT, P, H - 2 * P, D - backT));
    }
    if (shelfN >= 1) {
      for (let s = 1; s <= shelfN; s++) {
        const y = Math.round(((H * s) / (shelfN + 1)) * 8) / 8;
        panels.push(
          panel("shelf", shelfN === 1 ? "Cubby shelf" : `Cubby shelf ${s}`, x0 + P, y, backT, W - P * 2, P, D - backT),
        );
      }
    }
    const bayW = Math.round(((W - P * (cubbyN + 1)) / cubbyN) * 10) / 10;
    const name = `${stem} ${W}" × ${H}" × ${D}"`;
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
        `${name}. Open cubby wall with ${cubbyN} bays (~${bayW}" wide) and dividers — not a hollow Storage box and not a sit bench. ¾" plywood.`,
        `Glue and screw each cubby divider into the shelves and back. Hit studs if wall-lagged. Guidance only — confirm the ${W}" × ${H}" × ${D}" opening.`,
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D },
      fitted: {
        ...spec,
        name,
        program: "storage",
        family: "floor-carcase",
        affordances: affordances.includes("cubbies") ? affordances : [...affordances, "cubbies"],
        unit: {
          ...u,
          width: W,
          height: H,
          depth: D,
          doors: false,
          cubbies: cubbyN,
          shelfCount: shelfN,
          drawersPerBank: undefined,
          rod: false,
        },
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "alcove",
        wallType: "wood_stud",
      },
    };
  }

  {
    const ladderStem = ladderShelfTitleStem(prompt.toLowerCase());
    if (ladderStem) return buildLadderShelf(spec, prompt, affordances, ladderStem);
  }
  if (isLitterCabinet(prompt)) {
    return buildLitterCabinet(spec, prompt, affordances);
  }
  {
    const lower = prompt.toLowerCase();
    const held =
      heldCollection(lower) ??
      (/\b(?:vinyl|records|lps|record\s+(?:shelf|shelves|bookshelf|bookcase|storage|cabinet|cube))\b/.test(lower) &&
      /\b(?:shel(?:f|ves)|bookshelf|bookcase|storage|cabinet|cubes?)\b/.test(lower) &&
      !/\b(?:player|turntable|stereo)\b/.test(lower)
        ? "record"
        : null);
    if (held && !/\b(?:wine|bottles?|shoes?|jars?|spices?|plants?)\b/.test(held)) {
      return buildCollectionShelf(spec, prompt, affordances, held);
    }
  }

  // Shoe storage on a floor carcase → cubbies / open bays (not pin shelves).
  // Seat (mudroom) keeps its own cubby bench; hung racks stay hung-open.
  if (
    family !== "seat" &&
    family !== "hung-open" &&
    family !== "hung-cabinet" &&
    (isShoeStorage(prompt) ||
      (family === "floor-carcase" &&
        affordances.includes("cubbies") &&
        wantsShoes(prompt.toLowerCase())))
  ) {
    return buildShoeRack(spec, prompt, affordances);
  }

  if (isRadiatorCover(prompt) || (identityTitleStem(prompt.toLowerCase()) === "Radiator cover")) {
    return buildRadiatorCover(spec, prompt, affordances);
  }

  if ((spec.program === "bench" || family === "seat") && !isDaybed(prompt.toLowerCase()) && !isSeatingLoungeClass(prompt.toLowerCase())) {
    if (/coat/.test(prompt.toLowerCase()) && /bench/.test(prompt.toLowerCase())) {
      return buildCoatBench(spec, prompt, affordances);
    }
    // Storage under the seat only when typed or implied by the class; a plain bench is an open frame.
    {
      const bl = prompt.toLowerCase();
      const storageBench =
        affordances.includes("hooks") ||
        isBootTrayBench(bl) ||
        isBookBinBench(bl) ||
        /window\s*seat|banquette|mudroom|\bentry|hall|foyer|shoes?\b|boots?\b|cubb|storage|\bbays?\b|shel(?:f|ves)|\bbins?\b|basket|cabinet|drawer|\blid\b|\btoys?\b|\bbooks?\b|opening|fitted/.test(bl);
      if (!storageBench) return buildOpenBench(spec, prompt, affordances);
    }
    const innerW = W - P * 2;
    const cubbyN =
      u.cubbies && u.cubbies >= 2 ? u.cubbies : Math.max(2, Math.min(4, Math.round(W / 16)));
    const backT = 0.25;
    const apronH = Math.min(3.5, Math.max(2.5, Math.round((H * 0.2) * 8) / 8));
    const bootTray = isBootTrayBench(prompt.toLowerCase()) || (/boot/.test(prompt.toLowerCase()) && /tray/.test(prompt.toLowerCase()));
    const bookBin = isBookBinBench(prompt.toLowerCase());
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
    panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, backT));
    panels.push(panel("bottom", bootTray ? "Boot tray" : bookBin ? "Book bin" : "Shoe shelf", x0 + P, 0, backT, innerW, P, D - backT));
    panels.push(panel("top", "Seat", x0 + P, H - P, backT, innerW, P, D - backT));
    panels.push(
      panel("rail", "Front apron", x0 + P, H - P - apronH, D - P, innerW, apronH, P),
    );
    for (let i = 1; i < cubbyN; i++) {
      const x = x0 + (W * i) / cubbyN - P / 2;
      panels.push(
        panel("divider", `Cubby divider ${i}`, x, P, backT, P, H - 2 * P, D - backT),
      );
    }
    const wantHooks = affordances.includes("hooks");
    const pegH = wantHooks ? Math.max(10, Math.min(18, Math.round(H * 0.7))) : 0;
    if (wantHooks) {
      // Coat + bench / entry tree: peg rail rises above the seat on the back plane.
      panels.push(panel("rail", "Peg rail", x0, H, 0, W, pegH, P));
      const pegs = Math.max(3, Math.min(8, Math.round(W / 6)));
      pushPegs(panels, pegs, x0, H + Math.max(2, pegH * 0.35), P + 0.04, W, Math.min(3.25, Math.max(2.5, D * 0.22)));
    }
    const sitTitle = sitBenchTitleStem(prompt.toLowerCase());
    const coatBench = wantHooks && /coat/.test(prompt.toLowerCase());
    const stackH = H + pegH;
    // Coat + peg rail uses stacked height; other named sits keep seat H.
    // Class-default densify: bare entry bench must not stamp stock W×H×D as typed.
    const benchStem = coatBench ? "Coat bench" : sitTitle || "Bench";
    const benchH = coatBench ? stackH : H;
    const name = classDefaultDensifyTitle(benchStem, prompt, { width: W, height: benchH, depth: D });
    const benchAssumed = classDefaultAssumedNotes(prompt, benchStem, { width: W, height: benchH, depth: D });
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
        bootTray
          ? `${name}. Boot tray bench with a recessed boot tray under the seat and ${cubbyN} bays — tray densify + sit-load, not Boot bench without tray. ¾" plywood.`
          : bookBin
          ? `${name}. Book bin bench with an open book bin under the seat and ${cubbyN} bays — bin densify + sit-load, not a naked Bench. ¾" plywood.`
          : wantHooks
          ? `${name}. Cubby bench with ${cubbyN} shoe bays and a ${pegH}" peg rail for coats — entry combo, not a hollow box. ¾" plywood.`
          : sitTitle === "Window seat"
            ? `${name}. Sittable window seat at ${H}" seat height with ${cubbyN} open bays under the lid line — weight-bearing seat, not a hollow storage box. ¾" plywood.`
          : `${name}. Sittable cubby bench with ${cubbyN} open shoe bays — not a hollow storage box. ¾" plywood.`,
        bootTray
          ? `The boot tray, cubby dividers, and front apron carry sit load so the ${innerW}" seat does not sag. Glue and screw each divider into the seat, boot tray, and back.`
          : bookBin
          ? `The book bin, cubby dividers, and front apron carry sit load so the ${innerW}" seat does not sag. Glue and screw each divider into the seat, book bin, and back.`
          : `The cubby dividers and front apron carry sit load so the ${innerW}" seat does not sag. Glue and screw each divider into the seat, shoe shelf, and back.`,
        wantHooks
          ? `Screw ${Math.max(3, Math.min(8, Math.round(W / 6)))} coat hooks into the peg rail, about 6" on center. Level it on the floor. Guidance only.`
          : sitTitle === "Window seat"
            ? `Set it under the sill at ${H}" seat height. Sit-test before you finish — dividers carry sit load. Guidance only — confirm the ${H}" seat height for the window.`
          : "Level it on the floor. Sit-test before you finish. Guidance only — confirm the seat height for your entry.",
        ...benchAssumed,
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: stackH, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "bench",
        family: "seat",
        affordances,
        unit: {
          ...u,
          width: W,
          height: stackH,
          depth: D,
          doors: false,
          cubbies: cubbyN,
          shelfCount: undefined,
          drawersPerBank: undefined,
          rod: false,
          kneeW: undefined,
          counterH: undefined,
        },
      },
      assumptions: {
        load: "heavy",
        units: "inches",
        installMode: "freestanding",
        wallType: "wood_stud",
      },
    };
  }


  // Pegboard wall panel fitted to an opening — slab panel anatomy (not Yard House wire).
  if (isPegboard(prompt.toLowerCase()) || identityTitleStem(prompt.toLowerCase()) === "Pegboard") {
    const panelD = Math.min(D, Math.max(P, 0.75));
    const board = panel("back", "Pegboard panel", x0, 0, 0, W, H, panelD);
    const holes: { x: number; y: number; r: number }[] = [];
    const step = 4;
    for (let x = step; x < W - 1; x += step) {
      for (let y = step; y < H - 1; y += step) {
        holes.push({ x, y, r: 0.28 });
      }
    }
    board.polygon = {
      plane: "xy",
      pts: [
        [0, 0],
        [W, 0],
        [W, H],
        [0, H],
      ],
      holes,
    };
    panels.push(board);
    pushPegs(panels, Math.max(4, Math.min(8, Math.round(W / 8))), x0, H * 0.55, panelD + 0.04, W, 2.25);
    const name = `Pegboard ${W}" × ${H}"`;
    return {
      id: createId("proj"),
      name,
      prompt,
      kind: "closet",
      overall: { width: W, height: H, depth: panelD + 2.3 },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `${name}. Pegboard wall panel fitted to a ${W}" × ${H}" opening — panel anatomy, not a Yard House wire skeleton. ¾" pegboard / plywood panel.`,
        "Clear wall mount: lag into studs through the panel (or French cleat). Guidance only — confirm the opening.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: panelD, kind: "alcove" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        family: "slab",
        unit: { ...u, width: W, height: H, depth: panelD, doors: false, shelfCount: 0, drawersPerBank: undefined },
      },
      assumptions: { load: "medium", units: "inches", installMode: "wall", wallType: "wood_stud" },
    };
  }

  // Laundry sorter — floor carcase with N real Bin parts (not Storage / open-bay-only).
  if (isLaundrySorter(prompt.toLowerCase()) || identityTitleStem(prompt.toLowerCase()) === "Laundry sorter") {
    const bins = Math.max(2, Math.min(6, spokenBinCount(prompt) ?? 3));
    const backT = P;
    const innerW = W - P * 2;
    const innerD = D - backT;
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
    panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, backT));
    panels.push(panel("bottom", "Bottom", x0 + P, 0, backT, innerW, P, innerD));
    panels.push(panel("top", "Top", x0 + P, H - P, backT, innerW, P, innerD));
    for (let i = 1; i < bins; i++) {
      const x = x0 + (W * i) / bins - P / 2;
      panels.push(panel("divider", `Bin divider ${i}`, x, P, backT, P, H - 2 * P, innerD));
    }
    const bayW = Math.round(((W - P * (bins + 1)) / bins) * 10) / 10;
    for (let i = 0; i < bins; i++) {
      const x = x0 + P + (i * (bayW + P));
      panels.push(panel("bay", `Bin ${i + 1}`, x, P, backT, bayW, H - 2 * P, Math.min(4, innerD)));
    }
    const name = `Laundry sorter ${W}" × ${H}" × ${D}"`;
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
        `${name}. Laundry sorter with ${bins} real bins (~${bayW}" wide each) — not a Storage unit and not open-bay-only shelves. ¾" plywood.`,
        `Glue and screw each bin divider into the top, bottom, and back. Three-bin laundry sorter densifies Bin 1–${bins}.`,
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        family: "floor-carcase",
        unit: { ...u, width: W, height: H, depth: D, doors: false, shelfCount: 0, drawersPerBank: undefined, bays: bins },
      },
      assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
    };
  }

  // Drying rack — vertical standards + N rungs (not Storage unit without rungs).
  if (isDryingRack(prompt.toLowerCase()) || identityTitleStem(prompt.toLowerCase()) === "Drying rack") {
    const rungs = Math.max(2, Math.min(12, spokenRungCount(prompt) ?? 4));
    const stdD = Math.min(D, Math.max(3, P * 2));
    panels.push(panel("upright", "Left standard", x0, 0, 0, P, H, stdD));
    panels.push(panel("upright", "Right standard", x0 + W - P, 0, 0, P, H, stdD));
    for (let i = 0; i < rungs; i++) {
      const y = rungs === 1 ? H * 0.5 : (i * (H - P * 2)) / (rungs - 1) + P;
      panels.push(panel("rail", `Rung ${i + 1}`, x0 + P, y, 0, W - P * 2, P, D));
    }
    const name = `Drying rack ${W}" × ${H}" × ${D}"`;
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
        `${name}. Drying rack with ${rungs} rungs — not a Storage unit. ¾" plywood / lumber standards.`,
        `Rungs hold laundry at the typed depth (${D}"). Lag or freestand the standards. Guidance only.`,
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        family: "floor-carcase",
        unit: { ...u, width: W, height: H, depth: D, doors: false, shelfCount: 0, drawersPerBank: undefined },
      },
      assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
    };
  }

  // Lumber rack — vertical standards + N arms (not Storage unit without arms).
  if (isLumberRack(prompt.toLowerCase()) || identityTitleStem(prompt.toLowerCase()) === "Lumber rack") {
    const arms = Math.max(2, Math.min(12, spokenArmCount(prompt) ?? 4));
    const stdD = Math.min(D, Math.max(3, P * 2));
    panels.push(panel("upright", "Left standard", x0, 0, 0, P, H, stdD));
    panels.push(panel("upright", "Right standard", x0 + W - P, 0, 0, P, H, stdD));
    for (let i = 0; i < arms; i++) {
      const y = arms === 1 ? H * 0.5 : (i * (H - P * 2)) / (arms - 1) + P;
      panels.push(panel("rail", `Arm ${i + 1}`, x0 + P, y, 0, W - P * 2, P, D));
    }
    const name = `Lumber rack ${W}" × ${H}" × ${D}"`;
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
        `${name}. Lumber rack with ${arms} arms — not a Storage unit. ¾" plywood / lumber standards.`,
        `Arms hold stock at the typed depth (${D}"). Lag the standards into studs. Guidance only.`,
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        family: "floor-carcase",
        unit: { ...u, width: W, height: H, depth: D, doors: false, shelfCount: 0, drawersPerBank: undefined },
      },
      assumptions: { load: "heavy", units: "inches", installMode: "wall", wallType: "wood_stud" },
    };
  }

  const headboard = (/headboard/.test(prompt.toLowerCase()) || family === "slab") && !isPegboard(prompt.toLowerCase());
  if (headboard) {
    // Typed depth/thickness is real: laminate ¾" plies to the spoken depth.
    // Untyped headboard stays a single ¾" wall slab (freeze: wall-span only).
    const depthTyped =
      /\d[\d.]*\s*(?:in|inch|inches|["″'])?\s*(?:deep|depth|thick)/i.test(prompt) ||
      /\b(?:deep|depth|thick(?:ness)?)\b[^\d]{0,16}\d/i.test(prompt);
    const wantD = depthTyped ? Math.max(P, Math.min(D, 4)) : P;
    const plies = Math.max(1, Math.round(wantD / P));
    const slabD = plies * P;
    const slabH = Math.max(14, H);
    for (let i = 0; i < plies; i++) {
      const label = plies === 1 ? "Headboard" : `Headboard ply ${i + 1}`;
      panels.push(panel("back", label, x0, 0, i * P, W, slabH, P));
    }
    const wallFit = /wall\s*span|fitted to a/.test(prompt.toLowerCase());
    const plyNote =
      plies > 1
        ? ` ${plies}×¾" plywood plies laminated face-to-face to ${slabD}" deep — stock the aisle sells, not a magic thick board.`
        : ` from ¾" plywood.`;
    const name =
      plies > 1 ? `Headboard ${W}" × ${slabH}" × ${slabD}"` : `Headboard ${W}" × ${slabH}"`;
    return {
      id: createId("proj"),
      name,
      prompt,
      kind: "closet",
      overall: { width: W, height: slabH, depth: slabD },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        wallFit
          ? `One ${W}" × ${slabH}" headboard fitted to the ${W}" wall span — ${slabH}" tall${plyNote} No box — it sits behind the mattress.`
          : `One ${W}" × ${slabH}" × ${slabD}" headboard${plyNote} No box — it sits behind the mattress.`,
        plies > 1
          ? "Glue the plies face-to-face, clamp flat, then hang on a french cleat or lag into studs. Guidance only."
          : "Hang on a french cleat or lag into studs. Guidance only.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: slabH, depth: slabD },
      fitted: { ...spec, unit: { ...u, width: W, height: slabH, depth: slabD, doors: false, shelfCount: 0, drawersPerBank: undefined }, name },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "alcove",
        wallType: "wood_stud",
      },
    };
  }

  const coatLower = prompt.toLowerCase();
  // Key + mail shelf — shelf + hooks below + PDF mount height (not Storage / Picture ledge / portal).
  if (isKeyMailShelf(coatLower)) {
    const railH = Math.max(4, Math.min(H > 4 ? H - P : 6, 10));
    const shelfD = Math.max(4, Math.min(D > 2 ? D : 6, 10));
    const hookSaid = coatLower.match(/(\d+)\s*hooks?/);
    const hookWord = coatLower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+hooks?\b/);
    const hookWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    const hooks = hookSaid
      ? Math.max(2, Math.min(12, parseInt(hookSaid[1], 10)))
      : hookWord && hookWords[hookWord[1]] != null
        ? Math.max(2, Math.min(12, hookWords[hookWord[1]]))
        : 4;
    const mountFromOpening = Math.round(Math.min(60, Math.max(48, (H > 20 ? H : 54) * 0.7)));
    panels.push(panel("back", "Peg rail", x0, 0, 0, W, railH, P));
    panels.push(panel("top", "Mail shelf", x0, railH, 0, W, P, shelfD));
    const stackH = railH + P;
    const name = `Key and mail shelf ${W}" × ${stackH}" × ${shelfD}"`;
    return {
      id: createId("proj"),
      name,
      prompt,
      kind: "closet",
      overall: { width: W, height: stackH, depth: shelfD },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `${name}. Key and mail shelf with ${hooks} hooks below the shelf — not a Storage unit, not a Picture ledge, not a portal steal. ¾" plywood.`,
        `Mount height from the wall: ${mountFromOpening}" up from the finished floor (PDF states mount height). Clear wall mount — lag into studs through the rail.`,
        `Screw ${hooks} hooks into the rail below the mail shelf, about 6" on center. Hit studs. Guidance only.`,
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: stackH, depth: shelfD, kind: "alcove" },
      fitted: {
        ...spec,
        unit: {
          ...u,
          width: W,
          height: stackH,
          depth: shelfD,
          doors: false,
          shelfCount: 1,
          drawersPerBank: undefined,
        },
        program: "storage",
        family: "hung-open",
        name,
        affordances: affordances.includes("hooks") ? affordances : [...affordances, "hooks"],
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }

  // Coat hook board — singular board + hooks + PDF mount height (≠ Coat rack / Tool / portal).
  if (isCoatHookBoard(coatLower)) {
    const boardW = W;
    const boardH = Math.max(4, Math.min(H, 12));
    const boardD = Math.max(0.75, Math.min(D, 1.5));
    const hookSaid = coatLower.match(/(\d+)\s*hooks?/);
    const hookWord = coatLower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+hooks?\b/);
    const hookWords: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    };
    const hooks = hookSaid
      ? Math.max(2, Math.min(12, parseInt(hookSaid[1], 10)))
      : hookWord && hookWords[hookWord[1]] != null
        ? Math.max(2, Math.min(12, hookWords[hookWord[1]]))
        : Math.max(3, Math.min(8, Math.round(boardW / 6)));
    const mountFromOpening = Math.round(Math.min(66, Math.max(54, 60)));
    panels.push(panel("back", "Hook board", x0, 0, 0, boardW, boardH, boardD));
    pushPegs(panels, hooks, x0, Math.max(0.6, boardH * 0.35), boardD + 0.04, boardW, 3.25);
    const name = `Coat hook board ${boardW}" × ${boardH}"`;
    const named = namedStockFromPrompt(prompt);
    const stockId = named && named.category === "lumber" ? named.id : PLY;
    if (stockId !== PLY) {
      for (const pan of panels) pan.materialId = stockId;
    }
    return {
      id: createId("proj"),
      name,
      prompt,
      kind: "closet",
      overall: { width: boardW, height: boardH, depth: boardD + 3.3 },
      instances: [],
      panels,
      primaryMaterialId: stockId,
      notes: [
        `${name}. Wall-mounted coat hook board with ${hooks} hooks — clear wall mount, not a Coat rack / Tool rail / portal steal. Board densify.`,
        `Mount height from the wall: ${mountFromOpening}" up from the finished floor. PDF states mount height. Clear wall mount — lag into studs through the board.`,
        `Screw ${hooks} coat hooks into the board, about 6" on center. Hit studs. Guidance only — coat hook board, not a Bridge / Tool / portal.`,
        ...(H > boardH + 0.4
          ? [`You typed ${Math.round(H * 10) / 10}" tall. A hook board is a plate, so this one is ${boardH}" tall — not a cabinet that height.`]
          : []),
        ...(D > boardD + 0.4
          ? [`You typed ${Math.round(D * 10) / 10}" deep. The board is ${boardD}" thick plywood, not a ${Math.round(D * 10) / 10}" deep case.`]
          : []),
      ],
      historic: false,
      opening: { width: boardW, height: boardH, depth: boardD, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        family: "hung-open",
        unit: {
          ...u,
          width: boardW,
          height: boardH,
          depth: boardD + 3.3,
          doors: false,
          shelfCount: 0,
          drawersPerBank: undefined,
          rod: false,
        },
        affordances: (spec.affordances ?? []).includes("hooks")
          ? spec.affordances
          : [...(spec.affordances ?? []), "hooks"],
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }

  const portalHook = isPortalHookRail(coatLower);
  const leashRail = isLeashRail(coatLower);
  const pegRail = isPegRail(coatLower);
  const toolRail = isToolRail(coatLower) || leashRail || pegRail;
  const coatRack =
    !/shoe/.test(coatLower) &&
    !/towel/.test(coatLower) &&
    !isCoatCubbyWall(coatLower) &&
    !isCoatHookBoard(coatLower) &&
    !isKeyMailShelf(coatLower) &&
    (portalHook ||
      toolRail ||
      (/coat/.test(coatLower) && /rack|rail|rod|tree|peg|hook/.test(coatLower)) ||
      /hall\s*tree|entry\s*tree/.test(coatLower));
  // Coat + bench stays the seat/cubby path when both are named — hooks affordance flags the pegs.
  if (coatRack && !(/coat/.test(coatLower) && /bench/.test(coatLower)) && !isCoatCubbyWall(coatLower)) {
    if (/hall\s*tree|coat\s*tree|entry\s*tree/.test(coatLower) && !/wall|portal/.test(coatLower)) {
      return buildHallTree(spec, prompt, affordances);
    }
    const portal = portalHook || isDoorPortal(coatLower);
    // Portal dims (e.g. 32×80) are the opening envelope — rail mounts inside, clear swing.
    const portalW = W;
    const portalTriple = prompt.replace(/×/g, "x").match(/(\d+(?:\.\d+)?)\s*(?:x|by)\s*(\d+(?:\.\d+)?)/i);
    const portalH = portal
      ? Math.max(H, portalTriple ? Math.max(parseFloat(portalTriple[1]), parseFloat(portalTriple[2])) : H)
      : H;
    const shelfD = Math.max(3, Math.min(D, portal ? 4 : 12));
    const standing = !portal && H >= 36;
    const railH = portal
      ? Math.max(4, Math.min(6, shelfD + 2))
      : standing
        ? Math.max(24, H - P)
        : Math.max(4, Math.min(H - P, 24));
    panels.push(panel("back", standing ? "Back board" : "Peg rail", x0, 0, 0, portalW, railH, P));
    // Hat shelf is coat/hat language — bare portal hook rails (key rail, …) stay a peg rail only.
    const wantHatShelf = !toolRail && !leashRail && !pegRail && (/coat|hat/.test(coatLower) || (!portalHook && !portal));
    if (wantHatShelf) {
      panels.push(panel("top", "Hat shelf", x0, railH, 0, portalW, P, shelfD));
    }
    const stackH = wantHatShelf ? railH + P : railH;
    const hookSaid = coatLower.match(/(\d+)\s*hooks?/) || (pegRail ? coatLower.match(/(\d+)\s*pegs?/) : null);
    const hookWord =
      coatLower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+hooks?\b/) ||
      (pegRail ? coatLower.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+pegs?\b/) : null);
    const hookWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    const hooks = hookSaid
      ? Math.max(2, Math.min(12, parseInt(hookSaid[1], 10)))
      : hookWord && hookWords[hookWord[1]] != null
        ? Math.max(2, Math.min(12, hookWords[hookWord[1]]))
        : Math.max(3, Math.min(8, Math.round(portalW / 6)));
    const proudPegs = wantHatShelf && !portal;
    if (!(/rod/.test(coatLower) && !/peg|hook|rack/.test(coatLower))) {
      // A 3¼" peg under a 4–8" hat shelf disappears in the 3/4 view — the piece
      // reads as a tray. Coat pegs run past that shelf, with a stop on the tip.
      const pegZ = P + 0.04;
      const pegLen = proudPegs
        ? Math.round((Math.max(0, shelfD - pegZ) + 3.25) * 8) / 8
        : Math.min(3.25, Math.max(2.25, shelfD - P - 0.35));
      const pegY = proudPegs
        ? Math.max(0.6, railH - 2.25)
        : Math.max(0.5, railH * 0.42);
      pushPegs(panels, hooks, x0, pegY, pegZ, portalW, pegLen, 0.75, proudPegs);
    }
    const mountFromOpening = Math.round(Math.min(60, Math.max(48, portalH * 0.7)));
    const pegNoun = pegRail ? "pegs" : "hooks";
    const label = leashRail
      ? "Leash rail"
      : pegRail
      ? "Peg rail"
      : isToolRail(coatLower)
      ? "Tool rail"
      : portalHook
      ? portalHookRailTitle(coatLower)
      : /rod/.test(coatLower)
        ? "Coat rod"
        : /rail/.test(coatLower)
          ? "Coat rail"
          : "Coat rack";
    const hangNoun = /coat/.test(coatLower) ? "coats" : /key/.test(coatLower) ? "keys" : "hooks";
    const notes = portal
      ? /rod/.test(coatLower) && /coat/.test(coatLower)
        ? [
            `${label} spanning a ${portalW}" × ${portalH}" door portal full width — clear swing. ¾" plywood / rod.`,
            `Mount height from the opening: ${mountFromOpening}" up from the finished floor. Keep clear swing so the door clears the coats.`,
            `Span the full ${portalW}" portal width. Hit studs. Guidance only — portal span, not a shelving niche.`,
          ]
        : [
          `${label} in a ${portalW}" × ${portalH}" door portal — ${hooks} hooks on a ${railH}" peg rail. ¾" plywood.`,
          `Mount height from the opening: ${mountFromOpening}" up from the finished floor. Keep clear swing so the door clears the ${hangNoun}.`,
          `Screw ${hooks} hooks into the rail, about 6" on center. Hit studs. Guidance only — portal rail, not a shelving niche.`,
        ]
      : toolRail
        ? [
            leashRail
              ? `Leash rail spanning ${portalW}" — clear wall mount. ${hooks} hooks on a ${railH}" peg rail. ¾" plywood.`
              : pegRail
              ? `Peg rail spanning ${portalW}" — clear wall mount. ${hooks} pegs on a ${railH}" peg rail. ¾" plywood.`
              : `Tool rail spanning ${portalW}" — clear wall mount. ${hooks} hooks on a ${railH}" peg rail. ¾" plywood.`,
            `Mount height from the opening: ${mountFromOpening}" up from the finished floor. PDF states mount height. Clear wall mount — lag into studs through the rail.`,
            leashRail
              ? `Screw ${hooks} hooks into the rail, about 6" on center. Hit studs. Guidance only — leash rail, not a Bridge / Tool / key portal steal.`
              : pegRail
              ? `Screw ${hooks} pegs into the rail, about 6" on center. Hit studs. Guidance only — peg rail, not a Bridge / Tool / key / leash steal.`
              : `Screw ${hooks} hooks into the rail, about 6" on center. Hit studs. Guidance only — tool rail, not a Bridge / coat portal.`,
          ]
        : [
          standing
            ? `Wall-mounted coat board: ${portalW}" × ${stackH}" with an ${shelfD}" hat shelf. ¾" plywood.`
            : `Wall-mounted ${label.toLowerCase()}: ${portalW}" peg rail (${railH}") with an ${shelfD}" hat shelf. ¾" plywood.`,
          wantHatShelf
            ? `${hooks} pegs stand about 3" past the hat shelf, each with a stop so a coat doesn't slide off. Screw them into the rail, about 6" on center. Hit studs.`
            : `Screw ${hooks} coat hooks into the rail, about 6" on center. Hit studs.`,
          "Guidance only — not a cubby. No leftover shelves. Size follows what you typed.",
        ];
    return {
      id: createId("proj"),
      name: toolRail
        ? `${label} ${portalW}" · ${hooks} ${pegNoun}`
        : portal
        ? /rod/.test(coatLower) && /coat/.test(coatLower)
          ? `${label} ${portalW}" portal · full width`
          : `${label} ${portalW}" portal · ${hooks} hooks`
        : `${label} ${portalW}" × ${stackH}" × ${shelfD}"`,
      prompt,
      kind: "closet",
      overall: { width: portalW, height: portal ? portalH : stackH, depth: shelfD },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes,
      historic: false,
      opening: {
        ...spec.opening,
        width: portalW,
        height: portal ? portalH : stackH,
        depth: shelfD,
        kind: portal ? "alcove" : spec.opening.kind,
      },
      fitted: {
        ...spec,
        unit: {
          ...u,
          width: portalW,
          height: portal ? portalH : stackH,
          depth: shelfD,
          doors: false,
          shelfCount: 0,
          drawersPerBank: undefined,
        },
        program: "storage",
        family: "hung-open",
        name: portal
          ? /rod/.test(coatLower) && /coat/.test(coatLower)
            ? `${label} ${portalW}" portal · full width`
            : `${label} ${portalW}" portal · ${hooks} hooks`
          : `${label} ${portalW}" × ${stackH}" × ${shelfD}"`,
        affordances: affordances.includes("hooks") ? affordances : [...affordances, "hooks"],
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "wall",
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


  // Lid-chest class — hinged OR lift-off; never Yard House wire / Storage.
  // Toy chest stays Toy chest; species-named chests (cedar/oak/…) honor species in title + substitute note when densify stays ply.
  // Lift-off / removable / loose lid ≠ piano hinge / Operate swing (universal lid-attachment class).
  // Planter (no lid) and crate (door) stay on their own builders.
  {
    const lidLower = prompt.toLowerCase();
    const lidStem = identityTitleStem(lidLower);
    const liftOff = isLiftOffLidPrompt(lidLower) || isLiftOffLidChest(lidLower);
    if (
      isHingedLidChest(lidLower) ||
      isLiftOffLidChest(lidLower) ||
      lidStem === "Toy chest" ||
      (lidStem === "Chest" && /hinged\s*lid|\blid\b/.test(lidLower))
    ) {
      const toy = isToyChest(lidLower) || lidStem === "Toy chest";
      const innerW = W - P * 2;
      panels.push(panel("upright", "Left side", x0, 0, 0, P, H, D));
      panels.push(panel("upright", "Right side", x0 + W - P, 0, 0, P, H, D));
      panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, P));
      panels.push(panel("rail", "Front", x0 + P, 0, D - P, innerW, H - P, P));
      panels.push(panel("bottom", "Bottom", x0 + P, 0, P, innerW, P, D - P * 2));
      // Hinged Operate matches /^Lid\b/; lift-off uses "Lift-off lid" so no Open/Shut swing.
      panels.push(panel("top", liftOff ? "Lift-off lid" : "Lid", x0, H - P, 0, W, P, D));
      const stem = honorSpeciesInTitle(toy ? "Toy chest" : isStorageBox(lidLower) ? storageBoxTitleStem(lidLower) : "Chest", prompt);
      // Class-default densify honesty — bare "cedar chest with hinged lid" must not stamp stock W×H×D as typed.
      const chestAxes = typedClassDefaultAxes(prompt);
      const name =
        chestAxes.width && chestAxes.height && chestAxes.depth
          ? `${stem} ${W}" × ${H}" × ${D}"`
          : stampTypedAxesTitle(stem, chestAxes, { width: W, height: H, depth: D });
      const chestAssumed: string[] = [];
      if (!chestAxes.width) {
        chestAssumed.push(`Assumed ${W}" wide (chest class default) — type a width to lock it.`);
      }
      if (!chestAxes.height) {
        chestAssumed.push(`Assumed ${H}" tall (chest class default) — type a height to lock it.`);
      }
      if (!chestAxes.depth) {
        chestAssumed.push(`Assumed ${D}" deep (chest class default) — type a depth to lock it.`);
      }
      // Multi-lid / dual / split — densify stays one Lid panel; never silent-collapse.
      if (isMultiLidPrompt(lidLower)) {
        const n = spokenLidCount(lidLower);
        const asked =
          n != null && n >= 2
            ? `${n} lids`
            : /\bsplit\b/i.test(lidLower)
              ? "split lid"
              : /\bdual\b/i.test(lidLower)
                ? "dual lids"
                : "multi-lid";
        chestAssumed.push(
          `Assumed one lid — typed ${asked} isn't separate geometry yet. This densify stays a single lid panel.`,
        );
      }
      const chestSizeTalk =
        chestAxes.width && chestAxes.height && chestAxes.depth
          ? `Honor typed ${W}" wide × ${D}" deep × ${H}" tall.`
          : "Class defaults fill untyped axes — type Measure to lock size.";
      const priorAff: HouseAffordance[] = spec.affordances ?? [];
      const lidAff: HouseAffordance[] = liftOff
        ? priorAff.filter((a) => a !== "hinged-lid")
        : priorAff.includes("hinged-lid")
          ? priorAff
          : [...priorAff, "hinged-lid"];
      return {
        id: createId("proj"),
        name,
        prompt,
        kind: "closet",
        overall: { width: W, height: H, depth: D },
        instances: [],
        panels,
        primaryMaterialId: PLY,
        notes: (() => {
          const sub =
            speciesStockHonestyTalk(prompt, '¾" plywood') ??
            speciesSubstituteNote(prompt, '¾" plywood');
          if (liftOff) {
            return [
              toy
                ? `${name}. Lift-off-lid toy chest — floor main box with a removable lid (no piano hinge), not a Yard House wire skeleton and not Storage. ¾" plywood.`
                : `${name}. Lift-off-lid chest — floor main box with a removable lid (no piano hinge), not a Yard House wire skeleton and not Storage. ¾" plywood.`,
              `Lift-off lid ${W}" × ${D}". ${chestSizeTalk} The lid sits on the main box and lifts straight off — not hinged along the back edge. No piano hinge or lid stay.`,
              ...chestAssumed,
              ...(sub ? [sub] : []),
              "Guidance only — lift the lid off and set it back on. Not an Operate swing lid.",
            ];
          }
          return [
            toy
              ? `${name}. Hinged-lid toy chest — floor main box with a real lid on a piano hinge along the back edge, not a Yard House wire skeleton and not Storage. ¾" plywood.`
              : `${name}. Hinged-lid chest — floor main box with a real lid on a piano hinge along the back edge, not a Yard House wire skeleton and not Storage. ¾" plywood.`,
            `Lid ${W}" × ${D}". ${chestSizeTalk} Piano hinge (a long continuous hinge) along the back edge of the lid into the main box back/top edge. Add a lid stay so the lid cannot slam.`,
            ...chestAssumed,
            ...(sub ? [sub] : []),
            "Guidance only — open/close test the lid. Soft-close optional.",
          ];
        })(),
        historic: false,
        opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
        fitted: {
          ...spec,
          name,
          program: "storage",
          family: "floor-carcase",
          affordances: lidAff,
          unit: { ...u, width: W, height: H, depth: D, doors: false, shelfCount: 0, drawersPerBank: undefined },
        },
        assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
      };
    }
  }

  // Planter box — open top (no lid / doors); honor typed W×D×H; never Wire skeleton cube.
  if (isPlanterBox(prompt.toLowerCase()) || identityTitleStem(prompt.toLowerCase()) === "Planter box") {
    const innerW = W - P * 2;
    panels.push(panel("upright", "Left side", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right side", x0 + W - P, 0, 0, P, H, D));
    panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, P));
    panels.push(panel("rail", "Front", x0 + P, 0, D - P, innerW, H, P));
    panels.push(panel("bottom", "Bottom", x0 + P, 0, P, innerW, P, D - P * 2));
    const name = `Planter box ${W}" × ${H}" × ${D}"`;
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
        `${name}. Open top planter box — bottom + four sides, no lid and no doors. Soil / planting volume. ¾" plywood.`,
        `Open top: fill with soil; typed ${W}" wide × ${D}" deep × ${H}" tall. Not a Wire-frame skeleton and not a sealed storage cube.`,
        "Guidance only — set level outdoors. Drainage holes optional.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: H, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name,
        program: "storage",
        family: "floor-carcase",
        unit: { ...u, width: W, height: H, depth: D, doors: false, shelfCount: 0, drawersPerBank: undefined },
      },
      assumptions: { load: "medium", units: "inches", installMode: "freestanding", wallType: "wood_stud" },
    };
  }

  const crate = /crate|dog\s*-?\s*house|doghouse|kennel/.test(prompt.toLowerCase());
  if (crate) {
    const innerW = W - P * 2;
    const doorGap = 1.5;
    // Door sits on the floor (y = P); clear opening to top underside is H − 2P.
    // Size the door for a real spoken top air gap (not H − P − gap, which only leaves T).
    const doorH = Math.max(12, H - 2 * P - doorGap);
    const slatSide = (x: number, name: string) => {
      panels.push(panel("upright", `${name} front post`, x, 0, D - P, P, H, P));
      panels.push(panel("upright", `${name} back post`, x, 0, 0, P, H, P));
      const n = Math.max(3, Math.min(5, Math.round(H / 7)));
      for (let i = 0; i < n; i++) {
        const y = 2 + ((H - 6) * i) / Math.max(1, n - 1);
        panels.push(panel("rail", `${name} slat ${i + 1}`, x, y, P, P, 2, D - P * 2));
      }
    };
    slatSide(x0, "Left");
    slatSide(x0 + W - P, "Right");
    const backN = Math.max(3, Math.min(5, Math.round(H / 7)));
    for (let i = 0; i < backN; i++) {
      const y = 2 + ((H - 6) * i) / Math.max(1, backN - 1);
      panels.push(panel("rail", `Back slat ${i + 1}`, x0 + P, y, 0, innerW, 2, P));
    }
    panels.push(panel("bottom", "Floor", x0 + P, 0, P, innerW, P, D - P));
    panels.push(panel("top", "Top", x0 + P, H - P, P, innerW, P, D - P));
    const doorW = innerW - 0.12;
    const door = panel("door", "Door", x0 + P + 0.06, P, D - P, doorW, doorH, P);
    const holes: { x: number; y: number; r: number }[] = [];
    const cols = Math.max(2, Math.round(doorW / 6));
    const rows = Math.max(3, Math.round(doorH / 6));
    const r = Math.min(1.5, doorW / (cols + 3));
    for (let c = 1; c <= cols; c++) {
      for (let row = 1; row <= rows; row++) {
        holes.push({ x: (doorW * c) / (cols + 1), y: (doorH * row) / (rows + 1), r });
      }
    }
    door.polygon = {
      plane: "xy",
      pts: [
        [0, 0],
        [doorW, 0],
        [doorW, doorH],
        [0, doorH],
      ],
      holes,
    };
    panels.push(door);
    const dog = /dog/.test(prompt.toLowerCase());
    const name = dog ? `Dog house ${W}" × ${H}" × ${D}"` : /kennel/.test(prompt.toLowerCase()) ? `Kennel ${W}" × ${H}" × ${D}"` : `Crate ${W}" × ${H}" × ${D}"`;
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
        `${name}. Wooden kennel the dog goes inside — slatted sides and back, a floor, a top, and a hinged door you can see through. ¾" plywood. No shelves.`,
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
      name: `Kitchen island ${W}" × ${stackH}" × ${D}"`,
      prompt,
      kind: "closet",
      overall: { width: W, height: stackH, depth: D },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `Kitchen island ${W}" × ${stackH}" × ${D}". Open both sides — no back. ¾" plywood carcase; counter is two ¾" plies laminated to 1½"; 3½" toekick.`,
        "Bottom shelf and one middle shelf are glued in. Not a closet. Not a dining table.",
        "Guidance only — level it on the floor. Confirm the real kitchen.",
      ],
      historic: false,
      opening: { ...spec.opening, width: W, height: stackH, depth: D, kind: "room" },
      fitted: {
        ...spec,
        name: `Kitchen island ${W}" × ${stackH}" × ${D}"`,
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

  const lowerPrompt = prompt.toLowerCase();
  // Plain wall shelves (not jar/spice/wine racks, not cabinets) sit on cleats — same honesty as floating.
  const wallShelfCleats =
    /wall/.test(lowerPrompt) &&
    /shel(?:f|ves)\b/.test(lowerPrompt) &&
    !/cabinet|jar|spice|wine|bottle|rack for|media|picture|bedside|cubb/.test(lowerPrompt);
  // Cleat-mounted singular wall shelf: honor typed W×D×thickness as ONE shelf (not multi stack).
  const shelfThick = spokenShelfThickness(prompt);
  const singularCleatShelf =
    wallShelfCleats &&
    /\bshelf\b/.test(lowerPrompt) &&
    !/\bshelves\b/.test(lowerPrompt) &&
    (/cleat/.test(lowerPrompt) || shelfThick != null || /singular|single/.test(lowerPrompt));
  if (singularCleatShelf) {
    const cleatH = 2.5;
    const depthTyped =
      /\d[\d.]*\s*(?:in|inch|inches|["″])?\s*(?:deep|depth)\b|\b(?:deep|depth)\b[^\d]{0,16}\d|\d[\d.]*\s*(?:in|inch|inches|["″])?\s*d(?![a-z])/i.test(prompt) ||
      /\d+[\d.]*\s*(?:x|by|×)\s*\d+[\d.]*\s*(?:x|by|×)\s*\d+/i.test(prompt);
    const Df = depthTyped ? D : Math.min(D, 8);
    const T = shelfThick != null ? shelfThick : P;
    // Ledger cleat against the wall; one thick shelf sits on it and screws down.
    panels.push(panel("rail", "Wall cleat", x0, 0, 0, W, cleatH, P));
    panels.push(panel("shelf", "Shelf", x0, cleatH, P, W, T, Df));
    const name = `Wall shelf ${W}" × ${Df}" × ${T}"`;
    return {
      id: createId("proj"),
      name,
      prompt,
      kind: "closet",
      overall: { width: W, height: T, depth: Df },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `${name}. One cleat-mounted wall shelf (${T}" thick) on a Wall cleat — not a multi Wall shelves stack, not floating boards. ¾" plywood (laminate plies when thicker than stock).`,
        "Mount the cleat to studs; the shelf screws down onto the cleat. Cleat-mounted — hush floating. Guidance only — confirm the wall type.",
        "Guidance only — hit a stud. Drywall anchors will not hold a loaded shelf.",
      ],
      historic: false,
      opening: { width: W, height: T, depth: Df, kind: "room" },
      fitted: {
        ...spec,
        name,
        unit: { ...u, width: W, height: T, depth: Df, doors: false, drawersPerBank: undefined, shelfCount: 1 },
        opening: { width: W, height: T, depth: Df, kind: "room" },
        affordances: (spec.affordances ?? []).includes("cleats")
          ? spec.affordances
          : [...(spec.affordances ?? []), "cleats"],
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }
  // Spoken N brackets on a wall/floating shelf: shelf board + N ply brackets.
  // Not a cleat + tall Shelf backstop (that lied when people typed "two brackets").
  const bracketN = spokenBracketCount(prompt);
  if (
    bracketN != null &&
    /shel/.test(lowerPrompt) &&
    (/floating|wall-?mounted|wall\s+shel/.test(lowerPrompt) || wallShelfCleats) &&
    !/cabinet|jar|spice|wine|bottle|media|picture|bedside|cubb|bookcase|bookshelf/.test(lowerPrompt)
  ) {
    const depthTyped =
      /\d[\d.]*\s*(?:in|inch|inches|["″])?\s*(?:deep|depth)\b|\b(?:deep|depth)\b[^\d]{0,16}\d|\d[\d.]*\s*(?:in|inch|inches|["″])?\s*d(?![a-z])/i.test(prompt) ||
      /\d+[\d.]*\s*(?:x|by|×)\s*\d+[\d.]*\s*(?:x|by|×)\s*\d+/i.test(prompt);
    const Df = depthTyped ? D : Math.min(D, 8);
    const heightTyped = /(?:tall|high|height)\b/i.test(prompt);
    // Bracket rise: typed tall wins; else ~6–8″ under the shelf (not a silent 18″ backstop).
    const bracketH = heightTyped
      ? Math.max(4, Math.min(H > P ? H - P : H, 16))
      : Math.min(8, Math.max(6, Df));
    const outH = bracketH + P;
    const bracketD = Math.max(3, Math.min(Df - 0.25, Df));
    // Shelf sits on the brackets; thin ply brackets are type=rail (Arm / cleat class).
    panels.push(panel("shelf", "Shelf", x0, bracketH, 0, W, P, Df));
    const inset = Math.min(4, Math.max(2, W * 0.08));
    const span = Math.max(0, W - inset * 2 - P);
    for (let i = 0; i < bracketN; i++) {
      const t = bracketN === 1 ? 0.5 : i / (bracketN - 1);
      const bx = x0 + inset + t * span;
      const label = bracketN === 1 ? "Bracket" : `Bracket ${i + 1}`;
      panels.push(panel("rail", label, bx, 0, 0, P, bracketH, bracketD));
    }
    const floatStem = /floating/.test(lowerPrompt) ? "Floating shelf" : "Wall shelf";
    const name = classDefaultDensifyTitle(floatStem, prompt, { width: W, height: outH, depth: Df });
    const assumed = classDefaultAssumedNotes(prompt, floatStem, { width: W, height: outH, depth: Df });
    return {
      id: createId("proj"),
      name,
      prompt,
      kind: "closet",
      overall: { width: W, height: outH, depth: Df },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `${name}. One ${W}" × ${Df}" shelf on ${bracketN} plywood bracket${bracketN === 1 ? "" : "s"} — not a Wall cleat, not a tall Shelf backstop, not a multi Wall shelves stack. ¾" plywood.`,
        `Lag each bracket into studs; sit the shelf on the brackets and screw down. Guidance only — confirm the wall type.`,
        "Guidance only — hit a stud. Drywall anchors will not hold a loaded shelf.",
        ...assumed,
      ],
      historic: false,
      opening: { width: W, height: outH, depth: Df, kind: "room" },
      fitted: {
        ...spec,
        name,
        unit: {
          ...u,
          width: W,
          height: outH,
          depth: Df,
          doors: false,
          drawersPerBank: undefined,
          shelfCount: 1,
        },
        opening: { width: W, height: outH, depth: Df, kind: "room" },
        affordances: (spec.affordances ?? []).includes("brackets")
          ? spec.affordances
          : [...(spec.affordances ?? []), "brackets"],
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }

  const floating =
    ((/floating|wall-?mounted/.test(lowerPrompt) || wallShelfCleats) && /shel/.test(lowerPrompt));
  if (floating) {
    const wantsLip =
      /\blip\b|with\s+(?:a\s+)?lip|front\s+lip|jar\s+lip/.test(lowerPrompt) &&
      !/jar\s+rack|spice|bottle/.test(lowerPrompt);
    const singularShelf =
      /\bshelf\b/.test(lowerPrompt) && !/\bshelves\b/.test(lowerPrompt);
    // Honor spoken / singular count — never invent a multi stack for one floating shelf.
    const n = Math.max(
      1,
      Math.min(8, singularShelf ? 1 : u.shelfCount && u.shelfCount > 0 ? u.shelfCount : 3),
    );
    const cleatH0 = 2.5;
    const depthTyped =
      /\d[\d.]*\s*(?:in|inch|inches|["″])?\s*(?:deep|depth)\b|\b(?:deep|depth)\b[^\d]{0,16}\d|\d[\d.]*\s*(?:in|inch|inches|["″])?\s*d(?![a-z])/i.test(prompt) ||
      /\d+[\d.]*\s*(?:x|by|×)\s*\d+[\d.]*\s*(?:x|by|×)\s*\d+/i.test(prompt);
    const Df = depthTyped ? D : Math.min(D, 8);
    // Typed overall H wins — densify lip/backstop/spacers so envelope AABB == typed H
    // (do not invent gap=10 stacks that overshoot, then hide behind snapHud).
    const envelopeH = Math.max(
      H > 0 ? H : n === 1 ? (wantsLip ? 6 : P) : n * (cleatH0 + P) + Math.max(0, n - 1) * 10,
      n === 1 ? (wantsLip ? P + 2 : P) : n * (P + 1.5),
    );
    const lipH = wantsLip
      ? Math.min(1.25, Math.max(0.75, Math.min(envelopeH - cleatH0 - P, 1.25)))
      : 0;

    if (n === 1) {
      // Typed tall / lip / multi-stack envelope need a type=back face (rails drop out of AABB).
      // Bare floating with untyped thin H stays shelf+cleat — no silent 18″ Shelf backstop.
      const heightTypedFloat = /(?:tall|high|height)\b/i.test(lowerPrompt);
      const useEnvelope =
        wantsLip ||
        heightTypedFloat ||
        (n === 1 && envelopeH > cleatH0 + P + 0.5) ||
        (n > 1 && envelopeH > P + 0.1);
      const outH = useEnvelope ? envelopeH : P;
      const cleatH = Math.min(cleatH0, Math.max(1.5, outH - P - (wantsLip ? lipH : 0)));
      panels.push(panel("rail", "Wall cleat", x0, 0, 0, W, cleatH, P));
      panels.push(panel("shelf", "Shelf", x0, cleatH, P, W, P, Df));
      if (wantsLip) {
        panels.push(panel("rail", "Front lip", x0, cleatH + P, Df - P, W, lipH, P));
      }
      // Soft leftover: envelopePanels drops rails — without a type=back face, AABB collapses
      // to shelf ply (or ignores typed H). Shelf backstop spans typed overall H (media/bedside).
      if (useEnvelope) {
        panels.push(panel("back", "Shelf backstop", x0, 0, P, W, outH, P));
      }
      const floatStem = /floating/.test(lowerPrompt) || wantsLip ? "Floating shelf" : "Wall shelf";
      const name = classDefaultDensifyTitle(
        floatStem,
        prompt,
        /floating/.test(lowerPrompt) || wantsLip
          ? { width: W, height: outH, depth: Df }
          : { width: W, height: Df, depth: P },
      );
      // Wall shelf legacy stamped W×D×P — densify gate only covers floating shelf class.
      const floatAssumed = classDefaultAssumedNotes(prompt, floatStem, { width: W, height: outH, depth: Df });
      return {
        id: createId("proj"),
        name,
        prompt,
        kind: "closet",
        overall: { width: W, height: outH, depth: Df },
        instances: [],
        panels,
        primaryMaterialId: PLY,
        notes: [
          wantsLip
            ? `One cleat-mounted ${W}" × ${Df}" floating shelf with a front lip and Shelf backstop spanning ${outH}" — typed overall H, not a multi Floating shelves stack. ¾" plywood.`
            : /floating/.test(lowerPrompt)
              ? `One cleat-mounted ${W}" × ${Df}" floating shelf on a Wall cleat — Shelf backstop is ${outH}"${/(?:tall|high|height)\b/.test(lowerPrompt) ? " (typed)" : ""}. ¾" plywood. No box — no uprights.`
              : `One cleat-mounted ${W}" × ${Df}" wall shelf on a Wall cleat. ¾" plywood. No box — no uprights.`,
          "Mount the cleat to studs; the shelf screws down onto the cleat. Cleat-mounted — hush floating. Guidance only — confirm the wall type.",
          "Guidance only — hit a stud. Drywall anchors will not hold a loaded shelf.",
          ...floatAssumed,
        ],
        historic: false,
        opening: { width: W, height: outH, depth: Df, kind: "room" },
        fitted: {
          ...spec,
          name,
          unit: {
            ...u,
            width: W,
            height: outH,
            depth: Df,
            doors: false,
            drawersPerBank: undefined,
            shelfCount: 1,
          },
          opening: { width: W, height: outH, depth: Df, kind: "room" },
          affordances: (spec.affordances ?? []).includes("cleats")
            ? spec.affordances
            : [...(spec.affordances ?? []), "cleats"],
        },
        assumptions: {
          load: "medium",
          units: "inches",
          installMode: "wall",
          wallType: "wood_stud",
        },
      };
    }

    // Multi floating / wall shelves: N separate shelves, each on its own wall cleat hidden behind a
    // front fascia. Every opening clears a usable height (SHELF_MIN_CLEAR). A typed height is the
    // envelope (the size wins); when the spoken count does not fit, fewer shelves are built and the
    // notes state the shortfall.
    const heightTypedStack = /(?:tall|high|height)\b/i.test(lowerPrompt);
    const cleatH = cleatH0;
    const fasciaH = cleatH + P;
    let nBuilt = n;
    let pitch = SHELF_DEFAULT_CLEAR + P;
    if (heightTypedStack && n > 1) {
      const room = Math.max(0, envelopeH - cleatH - P);
      const fit = Math.max(1, Math.floor(room / (SHELF_MIN_CLEAR + P) + 1e-6) + 1);
      nBuilt = Math.min(n, fit);
      pitch = nBuilt > 1 ? room / (nBuilt - 1) : 0;
    }
    const gap = pitch - P;
    // With a typed-height backstop on the wall, the cleats screw through it (one ply forward).
    const zOff = heightTypedStack ? P : 0;
    for (let i = 0; i < nBuilt; i++) {
      const y = Math.round(i * pitch * 16) / 16;
      const label = ` ${i + 1}`;
      panels.push(panel("rail", `Wall cleat${label}`, x0, y, zOff, W, cleatH, P));
      panels.push(panel("shelf", `Shelf${label}`, x0, y + cleatH, zOff, W, P, Df - zOff));
      // Fascia under the front edge hides the cleat: the shelf reads as a floating slab.
      panels.push(panel("rail", `Front fascia${label}`, x0, y, Df - P, W, wantsLip ? fasciaH + 1 : cleatH, P));
    }
    const stackTop = Math.round(((nBuilt - 1) * pitch + cleatH + P) * 16) / 16;
    // A typed height keeps the backstop so the envelope matches what was typed.
    if (heightTypedStack) panels.push(panel("back", "Shelf backstop", x0, 0, 0, W, envelopeH, P));
    void lipH;
    const stackH = heightTypedStack ? envelopeH : stackTop;
    const name = /floating/.test(lowerPrompt)
      ? `Floating shelves ${W}" × ${stackH}" × ${Df}"`
      : `Wall shelves ${W}" × ${stackH}" × ${Df}"`;
    return {
      id: createId("proj"),
      name,
      prompt,
      kind: "closet",
      overall: { width: W, height: stackH, depth: Df },
      instances: [],
      panels,
      primaryMaterialId: PLY,
      notes: [
        `${nBuilt} separate ${inchFrac(W)}" × ${inchFrac(Df)}" ${/floating/.test(lowerPrompt) ? "floating" : "wall"} shelves, each on its own wall cleat hidden behind a front fascia${wantsLip ? " that stands up as a lip" : ""}. ¾" plywood.${heightTypedStack ? ` The Shelf backstop spans the typed ${inchFrac(stackH)}".` : ""}`,
        `Shelves sit ${inchFrac(pitch)}" apart top to top, leaving ${inchFrac(gap)}" clear between them. Each cleat screws into at least two studs with 3" structural screws; the shelf screws down onto its cleat.`,
        ...(nBuilt < n ? [`${n} shelves were asked; ${nBuilt} fit in the typed ${inchFrac(envelopeH)}" with at least ${SHELF_MIN_CLEAR}" clear between shelves. The size wins — add height for the rest.`] : []),
        "Guidance only — hit a stud. Confirm the wall type.",
      ],
      historic: false,
      opening: { width: W, height: stackH, depth: Df, kind: "room" },
      fitted: {
        ...spec,
        name,
        unit: { ...u, width: W, height: stackH, depth: Df, doors: false, drawersPerBank: undefined, shelfCount: nBuilt },
        opening: { width: W, height: stackH, depth: Df, kind: "room" },
        affordances: (spec.affordances ?? []).includes("cleats")
          ? spec.affordances
          : [...(spec.affordances ?? []), "cleats"],
      },
      assumptions: {
        load: "medium",
        units: "inches",
        installMode: "wall",
        wallType: "wood_stud",
      },
    };
  }


  // Multi-drawer nightstand (spoken "two drawers") uses the general bank path below.
  // Spoken no-drawers: skip the one-drawer nightstand special (was silent-collapsing via drawersPerBank==null).
  if (
    nightstand &&
    !isNoDrawersPrompt(prompt.toLowerCase()) &&
    (u.drawersPerBank == null || u.drawersPerBank <= 1)
  ) {
    const drawerH = Math.min(6.5, Math.max(4.5, Math.round(H * 0.28 * 8) / 8));
    const shelfY = Math.max(P + 6, H - P - drawerH - P);
    const drawerY = shelfY + P;
    panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
    panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
    panels.push(panel("back", "Back", x0 + P, 0, 0, W - P * 2, H, 0.25));
    panels.push(panel("top", "Top", x0 + P, H - P, 0, W - P * 2, P, D));
    panels.push(panel("bottom", "Bottom", x0 + P, 0, 0, W - P * 2, P, D));
    panels.push(panel("shelf", "Shelf", x0 + P, shelfY, 0.1, W - P * 2, P, D - 0.2));
    // Honest box from clear bay opening (between uprights × drawerH × D).
    const nsBox = drawerBoxFromOpening(W - P * 2, drawerH, D);
    pushDrawerWithFront(
      panels,
      "Drawer",
      "Drawer front",
      x0 + P + 0.5,
      drawerY,
      0.15,
      nsBox.boxW,
      nsBox.boxH,
      nsBox.boxD,
      nsBox.frontW,
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

  if (family === "hung-open") return buildHungOpen(spec, prompt, affordances);
  if (family === "hung-cabinet") return buildHungCabinet(spec, prompt, affordances);

  if (isStandingShopTop(prompt.toLowerCase())) {
    return buildShopTop(spec, prompt);
  }

  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, D));
  panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, D));
  const backT = 0.25;
  const kickH = 3.5;
  const kitchenBase =
    isKitchenBase(prompt.toLowerCase()) ||
    (family === "floor-carcase" &&
      !!u.doors &&
      /(?:base\s+cabinet|kitchen\s+cabinet)/.test(prompt.toLowerCase()));
  // Media / kitchen-base toekick is only honest with a raised bottom (island class).
  // A kick strip in front of a floor-level bottom is fake — raise the bottom or omit the kick.
  const wantKick = spec.program === "media" || kitchenBase;
  const bottomY = wantKick ? kickH : 0;
  const bayN = u.bays && u.bays >= 2 ? u.bays : 1;
  // Equal bay clears: (innerW − divider stock) / bays. Floor-to-eighth shelf cuts never overtrue.
  const bayClearExact = bayN >= 2 ? (W - P * (bayN + 1)) / bayN : W - P * 2;
  const bayShelfW = bayN >= 2 ? Math.floor(bayClearExact * 8) / 8 : bayClearExact;
  if (bayN >= 2) {
    // Dividers seat BETWEEN bottom and top — never full-height twins of the uprights.
    // Height clears top+bottom ply; depth clears ¼" back (same class as bay shelves).
    const divY = bottomY + P;
    const divH = Math.max(P, H - P - divY);
    for (let i = 1; i < bayN; i++) {
      const x = x0 + i * (bayClearExact + P);
      panels.push(panel("divider", `Bay divider ${i}`, x, divY, backT, P, divH, D - backT));
    }
  }
  panels.push(panel("back", "Back", x0 + P, 0, 0, W - P * 2, H, backT));
  panels.push(panel("top", "Top", x0 + P, H - P, 0, W - P * 2, P, D));
  panels.push(panel("bottom", "Bottom", x0 + P, bottomY, 0, W - P * 2, P, D));
  if (wantKick) {
    panels.push(panel("kick", "Toekick", x0 + P, 0, D - kickH, W - P * 2, kickH, P));
  }

  const hasKnee = (spec.program === "vanity" || spec.program === "desk") && (u.kneeW ?? 0) > 8;
  const counterY = u.counterH ?? (spec.program === "desk" ? H : 34);
  // Desk/vanity worktop (two ¾" plies → 1½"): top face = typed overall/counter H.
  // Same honesty as kitchen island + tableFitted — never stack thickness above typed H
  // (that lied envelope AABB H+1.5, e.g. desk typed 29 → AABB 30.5).
  const workTopT = 1.5;

  if (hasKnee) {
    const knee = Math.min(u.kneeW ?? 22, W - 10);
    const kneeL = -knee / 2;
    const kneeR = knee / 2;
    const leftW = kneeL - x0;
    const rightW = x0 + W - kneeR;
    const workTopFace = Math.min(counterY, H);
    const boxH = Math.max(P * 2, workTopFace - workTopT);
    // The knee is open to the floor: the bottom runs under each bank only, never across the knee.
    const fullBottom = panels.findIndex((p) => p.type === "bottom" && p.name === "Bottom");
    if (fullBottom >= 0) {
      const by = panels[fullBottom].position.y;
      panels.splice(
        fullBottom,
        1,
        panel("bottom", "Left bottom", x0 + P, by, 0, Math.max(P, leftW - P * 2), P, D),
        panel("bottom", "Right bottom", kneeR + P, by, 0, Math.max(P, rightW - P * 2), P, D),
      );
    }
    panels.push(panel("divider", "Left knee divider", kneeL - P, 0, 0, P, boxH, D));
    panels.push(panel("divider", "Right knee divider", kneeR, 0, 0, P, boxH, D));
    panels.push(panel("kick", "Left toekick", x0 + P, 0, D - P, leftW - P, 3.5, P));
    panels.push(panel("kick", "Right toekick", kneeR + P, 0, D - P, rightW - P, 3.5, P));
    // Spoken/typed total drawer count drives fronts (pencil=1 → one wing). Else legacy 3/bank.
    const spokenTotal = spokenDrawerCount(prompt);
    const leftCounts: number[] = [];
    const rightCounts: number[] = [];
    if (spokenTotal != null) {
      const nL = Math.ceil(spokenTotal / 2);
      const nR = Math.floor(spokenTotal / 2);
      for (let i = 0; i < nL; i++) leftCounts.push(i);
      for (let i = 0; i < nR; i++) rightCounts.push(i);
    } else {
      // drawersPerBank is set when drawers densify (desk default 3/bank). Undefined = no banks
      // (no-drawers ask, standing shop top, or drawers gated off) — never invent here.
      const n = u.drawersPerBank ?? 0;
      for (let i = 0; i < n; i++) {
        leftCounts.push(i);
        rightCounts.push(i);
      }
    }
    const span = boxH - 3.5;
    const nL = Math.max(1, leftCounts.length);
    const nR = Math.max(1, rightCounts.length);
    for (let i = 0; i < leftCounts.length; i++) {
      const dh = span / nL;
      const y = 3.5 + i * dh;
      const leftBox = drawerBoxFromOpening(leftW - P, dh, D, { slideClearIn: 0.1, frontInsetIn: 0.05 });
      pushDrawerWithFront(
        panels,
        leftCounts.length === 1 ? "Drawer" : `Left drawer ${i + 1}`,
        leftCounts.length === 1 && rightCounts.length === 0 ? "Drawer front" : `Left drawer front ${i + 1}`,
        x0 + P,
        y,
        0.15,
        leftBox.boxW,
        leftBox.boxH,
        leftBox.boxD,
        leftBox.frontW,
      );
    }
    for (let i = 0; i < rightCounts.length; i++) {
      const dh = span / nR;
      const y = 3.5 + i * dh;
      const rightBox = drawerBoxFromOpening(rightW - P, dh, D, { slideClearIn: 0.1, frontInsetIn: 0.05 });
      pushDrawerWithFront(
        panels,
        `Right drawer ${i + 1}`,
        `Right drawer front ${i + 1}`,
        kneeR + P,
        y,
        0.15,
        rightBox.boxW,
        rightBox.boxH,
        rightBox.boxD,
        rightBox.frontW,
      );
    }
    panels.push(panel("counter", spec.program === "desk" ? "Desktop" : "Counter", x0, boxH, 0, W, workTopT, D));
    if (u.mirror && spec.program === "vanity") {
      const mh = Math.max(8, (u.upperStart ?? Math.min(H, 54)) - workTopFace - 3);
      panels.push(panel("mirror", "Mirror", kneeL, workTopFace + 2, 0.4, knee, mh, 0.2));
    }
  } else if (u.drawersPerBank) {
    const n = u.drawersPerBank;
    const dh = (H - 4) / n;
    for (let i = 0; i < n; i++) {
      const bankBox = drawerBoxFromOpening(W - P * 2, dh, D);
      pushDrawerWithFront(
        panels,
        `Drawer ${i + 1}`,
        n === 1 ? "Drawer front" : `Drawer front ${i + 1}`,
        x0 + P + 0.5,
        3.5 + i * dh,
        0.15,
        bankBox.boxW,
        bankBox.boxH,
        bankBox.boxD,
        bankBox.frontW,
      );
    }
  }

  // Media shelf behind a desk: ABOVE/behind the top — never eats knee clear.
  const deskMediaBehind =
    spec.program === "desk" &&
    hasKnee &&
    /media\s*shelf|shelf behind|laptop|upright/.test(prompt.toLowerCase());
  if (deskMediaBehind) {
    const laptopM = prompt.match(/(\d+(?:\.\d+)?)\s*"?\s*laptop/i);
    const laptopH = laptopM ? parseFloat(laptopM[1]) : 13;
    const behindD = Math.max(8, Math.min(12, Math.round(laptopH * 0.7)));
    // Sit on the worktop face (typed counterY/H) — not stacked above thickness.
    panels.push(
      panel("shelf", "Media shelf behind", x0 + P, counterY, -behindD, W - P * 2, P, behindD),
    );
    panels.push(
      panel(
        "rail",
        "Laptop upright stop",
        x0 + P,
        counterY + P,
        -behindD,
        W - P * 2,
        Math.min(2, Math.max(1, laptopH * 0.12)),
        P,
      ),
    );
  }

  const wbLowerShelf =
    isStandingShopTop(prompt.toLowerCase()) &&
    ((u.shelfCount ?? 0) > 0 || /lower\s+shel|bottom\s+shel/.test(prompt.toLowerCase()));
  const shelfZone0 = wbLowerShelf
    ? P
    : hasKnee
      ? (u.upperStart ?? counterY + 2)
      : bottomY + P;
  const shelfZone1 = wbLowerShelf
    ? Math.max(P * 2, (u.counterH ?? counterY) - 2)
    : u.upperStart
      ? H
      : H - P;
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
        for (let b = 0; b < bayN; b++) {
          const x = x0 + P + b * (bayClearExact + P);
          panels.push(panel("shelf", `Bay ${b + 1} shelf ${i}`, x, y, backT, bayShelfW, P, D - backT));
        }
      } else if (u.upperStart && W >= 36) {
        const bay = (W - P * 3) / 2;
        panels.push(panel("shelf", `Left shelf ${i}`, x0 + P, y, 0.1, bay, P, D - 0.2));
        panels.push(panel("shelf", `Right shelf ${i}`, P / 2, y, 0.1, bay, P, D - 0.2));
      } else {
        const shelfLabel =
          spec.program === "media" &&
          (isAvTower(prompt.toLowerCase()) || /\b(?:\d+|two|three|four)\s+(?:open\s+)?bays?\b/.test(prompt.toLowerCase()))
            ? `Bay ${i} shelf`
            : isFilingShelf(prompt.toLowerCase())
              ? `Bay ${i} shelf`
            : (isStandingShopTop(prompt.toLowerCase()) || isPrinterStand(prompt.toLowerCase())) && shelves === 1
              ? /lower|bottom/.test(prompt.toLowerCase())
                ? "Bottom shelf"
                : "Lower shelf"
            : shelves === 1
              ? "Shelf"
              : `Shelf ${i}`;
        panels.push(panel("shelf", shelfLabel, x0 + P, y, 0.1, W - P * 2, P, D - 0.2));
      }
    }
  }

  // Soundbar hold envelope on media shelf — front lip cradles a real bar, never a flat decal.
  const promptForMedia = prompt.toLowerCase();
  if (
    spec.program === "media" &&
    (wantsSoundbarHold(promptForMedia) || isMediaShelf(promptForMedia)) &&
    !hasKnee
  ) {
    const lipH = Math.min(2.5, Math.max(1.5, Math.min(4, H * 0.2)));
    panels.push(
      panel("rail", "Soundbar front lip", x0 + P, P, D - P, W - P * 2, lipH, P),
    );
  }
  // Linen / closet climb step-shelf — weight-bearing mid tread; freeze envelope stays typed.
  const climbStepShelf =
    (spec.program === "closet" || /linen/.test(prompt.toLowerCase())) &&
    /step-?shelf|climb\s+step|weight-bearing/.test(prompt.toLowerCase());
  if (climbStepShelf) {
    const midY = Math.round(H * 0.45);
    const treadD = Math.min(D + 4, Math.max(D, 10));
    const treadW = W - P * 2;
    panels.push(panel("shelf", "Climb step-shelf", x0 + P, midY, 0.1, treadW, P, treadD - 0.2));
    panels.push(panel("rail", "Step nosing", x0 + P, midY + P, treadD - P - 0.2, treadW, 1.25, P));
  }

  if (rodY != null) {
    // One rod per bay. A single span through full-height dividers cannot be seated.
    if (bayN >= 2) {
      for (let b = 0; b < bayN; b++) {
        const x = x0 + P + b * (bayClearExact + P);
        panels.push(panel("rail", `Bay ${b + 1} hanging rod`, x, rodY, D * 0.45, bayClearExact, 1.25, 1.25));
        panels[panels.length - 1].materialId = "closet-rod";
      }
    } else {
      panels.push(panel("rail", "Hanging rod", x0 + P, rodY, D * 0.45, W - P * 2, 1.25, 1.25));
      panels[panels.length - 1].materialId = "closet-rod";
    }
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

  // Media defaults open-front (TV console), but stereo/cabinet prompts that ask for doors keep them.
  // Spoken door negation / open-front never densifies leaves (isNoDoorsPrompt → u.doors false).
  const mediaPromptLower = prompt.toLowerCase();
  const mediaWantsDoors =
    spec.program === "media" &&
    !!u.doors &&
    !isNoDoorsPrompt(mediaPromptLower) &&
    (/\bdoors?\b/.test(mediaPromptLower) || isStereoCabinet(mediaPromptLower));
  if (u.doors && (spec.program !== "media" || mediaWantsDoors)) {
    // Storage-hutch class: lower cabinet doors + open upper shelves (china silhouette).
    // Vanity dual-zone keeps doors on the upper; hutch flips doors to the base.
    const hutchLowerDoors = isStorageHutch(prompt.toLowerCase()) && !!u.upperStart;
    const doorY = hutchLowerDoors ? 0 : (u.upperStart ?? 0);
    const doorH = hutchLowerDoors ? u.upperStart! : (H - doorY);
    const typedDoors = typedDoorCount(prompt);
    if (typedDoors != null) {
      const bayW = W / typedDoors;
      for (let i = 0; i < typedDoors; i++) {
        const label =
          typedDoors === 1
            ? "Door"
            : typedDoors === 2
              ? i === 0
                ? "Left door"
                : "Right door"
              : `Door ${i + 1}`;
        panels.push(panel("door", label, x0 + i * bayW + 0.1, doorY, D - P, bayW - 0.2, doorH, P));
      }
    } else if (bayN >= 2) {
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
      ? deskMediaBehind
        ? `Work surface at ${counterY}". Knee ${u.kneeW}" clear stays open — media shelf behind holds a laptop upright without eating the knee.`
        : (u.drawersPerBank ?? 0) > 0
          ? `Work surface at ${counterY}". Knee ${u.kneeW}" clear, drawers in the wings.`
          : `Work surface at ${counterY}". Knee ${u.kneeW}" clear — open pedestals, no drawers.`
      : spec.program === "media"
        ? [
            wantsSoundbarHold(mediaPromptLower) || isMediaShelf(mediaPromptLower)
              ? `Media shelf / ledge carcase with a real soundbar hold envelope — front lip cradles the bar, never a flat decal.`
              : isAvTower(mediaPromptLower)
                ? mediaWantsDoors
                  ? `AV tower floor carcase with doors that earn keep.`
                  : `AV tower floor carcase with three usable open bays matching the cut list. Open front. No leftover doors.`
                : isStereoCabinet(mediaPromptLower)
                  ? `Stereo cabinet floor carcase${mediaWantsDoors ? " with doors that earn keep" : ""}.`
                  : mediaWantsDoors
                    ? bayN >= 2
                      ? `${bayN} bays with divider${bayN > 2 ? "s" : ""} so the top and shelves don't span the full ${W}". Doors that earn keep.${/\b(?:tv|media\s*console|console)\b/.test(mediaPromptLower) && !/\b(?:sideboard|buffet|credenza)\b/.test(mediaPromptLower) ? " TV sits on top." : ""}`
                      : `Floor carcase with doors that earn keep.${/\b(?:tv|media\s*console|console)\b/.test(mediaPromptLower) && !/\b(?:sideboard|buffet|credenza)\b/.test(mediaPromptLower) ? " TV sits on top." : ""}`
                    : bayN >= 2
                      ? `Open front. ${bayN} bays with divider${bayN > 2 ? "s" : ""} so the top and shelves don't span the full ${W}".${/\b(?:sideboard|buffet|credenza)\b/.test(mediaPromptLower) ? "" : " TV sits on top."} No leftover doors.`
                      : /\b(?:sideboard|buffet|credenza)\b/.test(mediaPromptLower)
                        ? "Open front. No leftover doors."
                        : "Open front. TV sits on top. No leftover doors.",
            isAvTower(mediaPromptLower) || /\b(?:three|3)\s+(?:open\s+)?bays?\b/.test(mediaPromptLower)
              ? `${Math.max(3, shelves + 1)} usable open bays (stacked). Glue and screw the shelves; do not pin them.`
              : shelves
                ? `${shelves} fixed ${mediaWantsDoors ? "" : "open "}shelf line${shelves === 1 ? "" : "s"}. Glue and screw; do not pin them.`
                : "Glue the shelves; do not pin them.",
          ].join(" ")
        : kitchenBase
          ? [
              `Kitchen base cabinet — floor carcase with door${u.doors ? "(s)" : ""}, 3½" toekick, counter height ~${H}".`,
              shelves
                ? `${shelves} fixed shelf line${shelves === 1 ? "" : "s"} inside. Glue and screw; do not pin them.`
                : "Solid carcase with door(s).",
            ].join(" ")
          : climbStepShelf
            ? `One weight-bearing climb step-shelf at mid height to reach the top — freeze dims stay ${W}" × ${H}" × ${D}".`
          : isFilingShelf(prompt.toLowerCase())
            ? (() => {
                const bayN = Math.max(2, shelves + 1);
                return `Filing shelf — ${bayN} open bays (stacked), open front, not a drawer File cabinet. ${shelves} fixed open shelf line${shelves === 1 ? "" : "s"}. Glue and screw; do not pin them.`;
              })()
          : isPrinterStand(prompt.toLowerCase())
            ? shelves === 1
              ? `Printer stand with exactly one lower shelf under the top — not a Storage unit. Honor typed W×D×H.`
              : shelves
                ? `Printer stand with ${shelves} shelf line${shelves === 1 ? "" : "s"} — not a Storage unit.`
                : `Printer stand carcase — not a Storage unit. Shelf only when typed.`
          : shelves
            ? `${shelves} adjustable shelf line${shelves === 1 ? "" : "s"}.`
            : "Solid carcase.",
    alcove
      ? "Anchor uprights into studs. Shim the tight side. Do not rack the box to match a wonky wall."
      : "Level it. Add a back (already on the bench) so it cannot rack.",
    ...(!alcove && isKidsBookcase(prompt.toLowerCase())
      ? [
          `Kids bookcase: ${inchFrac(H)}" tall so a child reaches the top shelf. Anti-tip: strap the top to a wall stud anyway — kids climb shelves.`,
        ]
      : []),
    guidanceConfirmTalk(`${prompt} ${spec.name ?? ""}`, alcove ? "alcove" : "floor"),
  ];

  if (spec.typedAxes && isClassDefaultDensifyPrompt(prompt)) {
    const promptLowerAssumed = prompt.toLowerCase();
    // Universal densify Assumed klass — stem from identity, not a growing per-noun cascade.
    const stem =
      identityTitleStem(promptLowerAssumed) ||
      mediaIdentityLabel(promptLowerAssumed) ||
      (/linen/.test(promptLowerAssumed)
        ? "Linen"
        : spec.program === "vanity" || /\bvanity\b/.test(promptLowerAssumed)
          ? "Vanity"
          : isHingedLidChest(promptLowerAssumed) || (/\bchest\b/.test(promptLowerAssumed) && !/of\s+drawers/.test(promptLowerAssumed))
            ? "Chest"
            : /\bhutch\b/.test(promptLowerAssumed)
              ? "Hutch"
              : spec.program === "bookcase"
                ? "Bookcase"
                : spec.program === "media"
                  ? "Media console"
                  : spec.program === "closet" || spec.program === "wardrobe" || spec.program === "pantry"
                    ? "Closet"
                    : "Unit");
    const klass = `${stem.toLowerCase()} class default`;
    // Densified envelope honesty — stamp only typed axes into the title; note the rest.
    if (!spec.typedAxes.width) {
      notes.push(`Assumed ${W}" wide (${klass}) — type a width to lock it.`);
    }
    if (!spec.typedAxes.height) {
      notes.push(`Assumed ${H}" tall (${klass}) — type a height to lock it.`);
    }
    if (!spec.typedAxes.depth) {
      notes.push(`Assumed ${D}" deep (${klass}) — type a depth to lock it.`);
    }
  }

  // Keep TV / Media console identity through Measure dim merges — never naked "Media",
  // and always stamp live W×H×D onto the title.
  const promptLower = prompt.toLowerCase();
  const mediaStem =
    spec.program === "media"
      ? identityTitleStem(promptLower) || mediaIdentityLabel(promptLower) || "Media console"
      : identityTitleStem(promptLower);
  const storageAxes = spec.typedAxes;
  // Class-default densify: stamp only typed axes (incl. bare = stem only). Full triple keeps classic.
  const storagePartial =
    isClassDefaultDensifyPrompt(prompt) &&
    storageAxes &&
    !(storageAxes.width && storageAxes.height && storageAxes.depth);
  const stampFull = (stem: string) =>
    storagePartial
      ? stampTypedAxesTitle(stem, storageAxes!, { width: W, height: H, depth: D })
      : `${stem} ${W}" × ${H}" × ${D}"`;
  const name = mediaStem
    ? stampFull(mediaStem)
    : kitchenBase && !/base|kitchen/i.test(spec.name)
      ? stampFull(/kitchen/.test(promptLower) ? "Kitchen base" : "Base cabinet")
      : (() => {
          const cleaned = spec.name
            .replace(/\s+\d+(?:\.\d+)?"\s*×\s*\d+(?:\.\d+)?"(?:\s*×\s*\d+(?:\.\d+)?")?\s*$/, "")
            .replace(/\s+\d+(?:\.\d+)?"\s+(?:wide|tall|deep)\s*$/i, "")
            .trim();
          // Scrub leftover naked Media / naked Bench (named sit) from an older brief.
          let stem = /^Media$/i.test(cleaned) ? "Media console" : cleaned || spec.name;
          const sitScrub = sitBenchTitleStem(promptLower);
          if (/^Bench$/i.test(stem) && sitScrub) {
            stem = sitScrub;
          }
          return stampFull(stem);
        })();
  const notesNamed = notes.map((n, i) => (i === 0 ? n.replace(spec.name, name) : n));

  return {
    id: createId("proj"),
    name,
    prompt,
    kind: "closet",
    overall: { width: W, height: H, depth: D },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes: notesNamed,
    historic: false,
    opening: spec.opening,
    fitted: { ...spec, name },
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