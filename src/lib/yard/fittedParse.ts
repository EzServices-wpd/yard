/**
 * parseBrief — measured prompt → FittedSpec.
 */
import { featureBay } from "./heldObjects";
import { inchFrac } from "./inchText";
import { heldCollection } from "./heldObjects";
import { readHookRows } from "./face";
import type { FittedProgram, FittedSpec, FittedUnit, PocketWalls } from "./types";
import { looksLikePocket, parsePocket } from "./pocket";
import { detectWeekendMech } from "./weekendFamily";
import {
  climbIdentityLabel, detectHouseFamily, identityTitleStem, isLadderShelfFurniture, ladderShelfTitleStem,
  mediaIdentityLabel, sitBenchTitleStem, isAdirondackChair, isLoungeChair, isRockingChair, isOttoman,
  isSeatingLoungeClass, isAvTower, isBedsideShelf, isBootTrayBench, isBookBinBench, isBunkBed,
  isButcherCart, isDiningTable, isServingCart, isPlateRack, isMagazineRack, isSlotRack, slotRackTitle,
  isCoatCubbyWall, isDaybed, isDryingRack, isFoldDown, isFoldingTable, isHouseMediaCarcase,
  isIroningWallMount, isKeyMailShelf, isCoatHookBoard, isKitchenBase, isKitchenIsland, isKitchenUpper,
  isLaundryFoldDown, isLaundrySorter, isLeashRail, isPegRail, isFilingShelf, isPrinterStand, isLoftBed,
  isLumberRack, isMediaShelf, isOpenKitchenShelving, isOutdoorSideTable, isSideEndTable, sideEndTableStem,
  isPegboard, isPlanterBox, isPlatformBed, isPorchSwingFrame, isPrepTable, isRadiatorCover,
  isMudroomCubbyWall, isOpenCubbyWall, openCubbyWallTitle, isShoePortalCubbies, isShoePortalRail,
  isStereoCabinet, isToolRail, isToyChest, isHingedLidChest, isLiftOffLidChest, isLiftOffLidPrompt,
  isMultiLidPrompt, spokenLidCount, isStorageHutch, isTowelPortalRail, isUtilityShelf, isWallMediaLedge,
  isPictureLedge, pictureLedgeTitleStem, isWorkbench, isPottingBench, isStandingShopTop, isStorageBox,
  storageBoxTitleStem, towelPortalWantsHooks, isDoorPortal, isPortalHookRail, isPortalSpanShelf,
  portalHookRailTitle, portalSpanShelfTitle, isSofaConsoleTable, tableTopShape, tableShapeTitlePrefix,
  wantsBookHold, wantsPrintHold, wantsShoes, wantsSoundbarHold, type HouseAffordance, type HouseFamily,
  type TableTopShape,
} from "./family";
import {
  honorSpeciesInTitle, speciesSubstituteNote, speciesStockHonestyTalk, deskWidthFromPrompt,
  tableSpanFromPrompt, nounSpanFromPrompt, openingWidthFromPrompt, stampTypedAxesTitle,
  typedOpeningStorageAxes, typedClassDefaultAxes, isClassDefaultDensifyPrompt, classDefaultDensifyTitle,
  classDefaultAssumedNotes, normalizeUserPrompt, spokenAxisInches, guidanceConfirmTalk,
} from "./voiceHonesty";
import { namedStockFromPrompt } from "./weekendStockHonesty";
import { detectMaterial, isWireStock } from "./promptHelpers";
import { cornerSpecFromPrompt, isCornerUnitPrompt } from "./corner";
import { isOddShapePrompt, oddSpecFromPrompt } from "./oddShapes";
import { detectProgram, looksLikeFitted } from "./fittedDetect";
import {
  P, PLY, pick, cabinetStem, tableClassHeight, isIroningCabinet, isMedicineCabinet, isSpiceRack,
  isSpiceCabinet, isWineRack, isShoeStorage, isOverToilet, isNoDrawersPrompt, isNoDoorsPrompt,
  spokenDrawerCount, typedDoorCount, spokenTierCount, spokenShelfCount, spokenArmCount,
  spokenBracketCount, spokenBinCount, spokenRungCount, spokenBottleCount, typedHeightInches,
  spokenSlotCount, spokenShelfThickness, spokenCubbyCount, shallowWallCabinetFace,
  isKidsBookcase, KIDS_BOOKCASE_H,
} from "./fittedShared";
import { inch16 } from "./fittedWine";

export function triple(text: string): { w?: number; h?: number; d?: number } {
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
export function mattressDeck(lower: string): { width: number; length: number } | null {
  if (/cal(?:ifornia)?\s*king/.test(lower)) return { width: 72, length: 84 };
  if (/\bking\b/.test(lower)) return { width: 76, length: 80 };
  if (/\bqueen\b/.test(lower)) return { width: 60, length: 80 };
  if (/\bfull\b|\bdouble\b/.test(lower)) return { width: 54, length: 75 };
  if (/\btwin\b/.test(lower)) return { width: 39, length: 75 };
  return null;
}

/** Bunk / loft frame is a couple inches wider than the mattress. An unnamed bunk stays the usual twin 42. */
export function framedSleep(lower: string): { width: number; length: number } {
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
    if (trip.w) width = trip.w;
    if (!Number.isFinite(depth) && trip.h) depth = trip.h;
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
  // A typed feature bay ("pocket for the trash can") sizes the open bay to the object it holds.
  const bayObject = featureBay(prompt)?.object ?? null;
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
      : bayObject && (program === "vanity" || program === "desk")
        ? Math.max(bayObject.width + 2, 8.5)
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
