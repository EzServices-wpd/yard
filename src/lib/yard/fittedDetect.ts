/**
 * Detect whether a prompt is a fitted house brief and which program.
 */
import type { FittedProgram } from "./types";
import { looksLikePocket } from "./pocket";
import { detectWeekendMech } from "./weekendFamily";
import { isCornerUnitPrompt } from "./corner";
import { isOddShapePrompt } from "./oddShapes";
import { namedStockFromPrompt } from "./weekendStockHonesty";
import {
  climbIdentityLabel, detectHouseFamily, isLadderShelfFurniture, ladderShelfTitleStem,
  isAvTower, isBedsideShelf, isBootTrayBench, isBookBinBench, isBunkBed,
  isButcherCart, isDiningTable, isServingCart, isSlotRack,
  isCoatCubbyWall, isDryingRack, isFoldingTable, isHouseMediaCarcase,
  isIroningWallMount, isKeyMailShelf, isLaundrySorter, isLeashRail,
  isLumberRack, isPegboard, isPlanterBox, isPlatformBed, isPorchSwingFrame,
  isRadiatorCover, isOpenCubbyWall, isShoePortalCubbies, isShoePortalRail,
  isStereoCabinet, isToolRail, isToyChest, isHingedLidChest,
  isTowelPortalRail, isUtilityShelf, isWallMediaLedge, isPictureLedge,
  isWorkbench, isPottingBench, isSeatingLoungeClass, isLoftBed,
  isPortalHookRail, isPortalSpanShelf, isAdirondackChair, isMudroomCubbyWall, isDaybed, isSofaConsoleTable, isOutdoorSideTable,
} from "./family";
import {
  isWineRack, isShoeStorage, isOverToilet, isSpiceRack, isSpiceCabinet,
  isIroningCabinet, isMedicineCabinet, pick, CRAFT, MAKER, BUILDER,
} from "./fittedShared";

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
export function isBarePlanPair(lower: string): boolean {
  const t = lower
    .replace(/^(?:please\s+)?(?:give me|make me|build me|i need|i want)\s+(?:a|an)?\s*/i, "")
    .trim();
  if (BUILDER.test(t) || MAKER.test(t) || CRAFT.test(t)) return false;
  return /^\d+(?:\.\d+)?\s*(?:in|inch|inches|")?\s*(?:x|by|×)\s*\d+(?:\.\d+)?\s*(?:in|inch|inches|")?$/.test(t);
}

