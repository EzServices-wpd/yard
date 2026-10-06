/**
 * buildFitted — FittedSpec → YardProject (main carcase assembly).
 */
import { featureBay } from "./heldObjects";
import { inchFrac } from "./inchText";
import { heldCollection } from "./heldObjects";
import { readHookRows } from "./face";
import { createId } from "@/lib/utils";
import { drawerBoxFromOpening } from "./shopPlural";
import type { FittedProgram, FittedSpec, FittedUnit, Panel, PocketWalls, YardProject } from "./types";
import { buildPocket, clearancesAt, looksLikePocket, parsePocket } from "./pocket";
import { buildTable } from "./tableFitted";
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
  isStereoCabinet, isToolRail, isToyChest, isHingedLidChest, isLiftOffLidChest, isLiftOffLidPrompt, isOpenTopChest,
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
import { namedLumberFromPrompt } from "./namedLumberSpecies";
import { detectMaterial, isWireStock } from "./promptHelpers";
import { buildCornerUnit, cornerSpecFromPrompt, isCornerUnitPrompt } from "./corner";
import { buildOddShape, isOddShapePrompt, oddSpecFromPrompt } from "./oddShapes";
import {
  P, PLY, PLY_BACKER, TWO_BY_TWO, DOOR_MIRROR_T, STUD_CENTER_IN, HINGE_ARM_CLEAR_IN,
  panel, pushPegs, pick, cabinetStem, shallowWallCabinetFace, backReachesTwoStuds,
  tableClassHeight, isIroningCabinet, isMedicineCabinet, isSpiceRack, isSpiceCabinet, isWineRack,
  isShoeStorage, isOverToilet, isNoDrawersPrompt, isNoDoorsPrompt, spokenDrawerCount, typedDoorCount,
  spokenTierCount, spokenShelfCount, spokenArmCount, spokenBracketCount, spokenBinCount, spokenRungCount,
  spokenBottleCount, typedHeightInches, spokenSlotCount, spokenShelfThickness, spokenCubbyCount,
  SHELF_MIN_CLEAR, isKidsBookcase, KIDS_BOOKCASE_H, isStorageInOpening, formChangeNotes,
} from "./fittedShared";
import {
  WINE_BOTTLE_CLEAR, WINE_RAIL_H, WINE_CRADLE_LIP, WINE_ROW_CLEAR, WINE_ROW_SLACK, WINE_ROW_MAX_CLEAR,
  WINE_OPEN_MIN, WINE_OPEN_MAX, WINE_PLINTH_SETBACK, wineCradle, wineCradleOutline, wantsBottleFill,
  wineRackLayout, inch16, wineCapacityVoice, type WineRackLayout,
} from "./fittedWine";
import { detectProgram } from "./fittedDetect";
import {
  LITTER_BOX,
  LITTER_HOLE,
  SHELF_DEFAULT_CLEAR,
  SHOE_BAY_MIN,
  SHOE_TIER_CLEAR,
  buildBedsideShelf,
  buildBunkBed,
  buildCoatBench,
  buildCollectionShelf,
  buildDaybed,
  buildHallTree,
  buildHungCabinet,
  buildHungOpen,
  buildLadderShelf,
  buildLitterCabinet,
  buildLoungeChair,
  buildOpenBench,
  buildOttoman,
  buildPicnic,
  buildPictureLedge,
  buildPlatformBed,
  buildPorchSwing,
  buildRadiatorCover,
  buildRockingChair,
  buildShoeRack,
  buildShopTop,
  buildWallMediaLedge,
  collectionKind,
  isLitterCabinet,
  pushDrawerWithFront,
  seatingLoungeSeatDeck,
  sleepFrameLeg,
} from "./fittedBuilders";

/** The face of a typed ¾" board (1×4 … 1×12), named the way it was typed ("Walnut 1×8"). */
function typedBoardFace(prompt: string): { face: number; stock: string } | null {
  const board = detectMaterial(prompt);
  const face = board?.dims?.width;
  if (board?.category !== "lumber" || board.formFactor !== "board" || board.dims?.height !== 0.75 || !face) return null;
  const size = board.name.match(/\d\s*[×x]\s*\d+/)?.[0].replace(/\s/g, "").replace("x", "×") ?? board.name;
  const species = namedLumberFromPrompt(prompt)?.display;
  return { face, stock: species ? `${species} ${size}` : size };
}

const depthTypedIn = (prompt: string) =>
  /\d[\d.]*\s*(?:in|inch|inches|["″])?\s*(?:deep|depth)\b|\b(?:deep|depth)\b[^\d]{0,16}\d|\d[\d.]*\s*(?:in|inch|inches|["″])?\s*d(?![a-z])/i.test(prompt) ||
  /\d+[\d.]*\s*(?:x|by|×)\s*\d+[\d.]*\s*(?:x|by|×)\s*\d+/i.test(prompt);

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
    const liftOff = !isOpenTopChest(lidLower) && (isLiftOffLidPrompt(lidLower) || isLiftOffLidChest(lidLower));
    const openTop = isOpenTopChest(lidLower);
    if (
      isHingedLidChest(lidLower) ||
      isLiftOffLidChest(lidLower) ||
      openTop ||
      lidStem === "Toy chest" ||
      (lidStem === "Chest" && /hinged\s*lid|\blid\b/.test(lidLower))
    ) {
      const toy = isToyChest(lidLower) || lidStem === "Toy chest";
      const innerW = W - P * 2;
      panels.push(panel("upright", "Left side", x0, 0, 0, P, H, D));
      panels.push(panel("upright", "Right side", x0 + W - P, 0, 0, P, H, D));
      panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, P));
      panels.push(panel("rail", "Front", x0 + P, 0, D - P, innerW, openTop ? H : H - P, P));
      panels.push(panel("bottom", "Bottom", x0 + P, 0, P, innerW, P, D - P * 2));
      // Hinged Operate matches /^Lid\b/; lift-off uses "Lift-off lid" so no Open/Shut swing. Open top: no lid.
      if (!openTop) panels.push(panel("top", liftOff ? "Lift-off lid" : "Lid", x0, H - P, 0, W, P, D));
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
      if (isMultiLidPrompt(lidLower) && !openTop) {
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
      const lidAff: HouseAffordance[] = liftOff || openTop
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
          if (openTop) {
            return [
              `${name}. Open-top ${toy ? "toy chest" : stem.toLowerCase()} — floor main box with no lid, so there is no piano hinge or lid stay. ¾" plywood.`,
              ...chestAssumed,
              ...(sub ? [sub] : []),
              "Guidance only — round over the top edges; nothing closes over the opening.",
            ];
          }
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
          cueNotes: [...(spec.cueNotes ?? []), ...(openTop ? formChangeNotes(lidLower, stem, { lid: true }) : [])],
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
    !/cabinet|jar|spice|wine|bottle|rack for|media|picture|bedside|cubb/.test(lowerPrompt) &&
    // "bookshelf in the wall nook" is the fitted bookcase in that opening, not cleated wall shelves.
    !isStorageInOpening(lowerPrompt);
  // A wall or floating shelf cut from a typed ¾" board is one board deep (1×8 → 7 ¼") unless a depth is typed.
  const shelfFace = (/floating|wall-?mounted/.test(lowerPrompt) || wallShelfCleats) && /shel/.test(lowerPrompt) ? typedBoardFace(prompt) : null;
  if (shelfFace) {
    const one = /\bshelf\b/.test(lowerPrompt) && !/\bshelves\b/.test(lowerPrompt) && (spokenTierCount(lowerPrompt) ?? 1) <= 1;
    const said = `${one ? "The shelf is" : "Each shelf is"} ${inchFrac(shelfFace.face)}" deep, worked out from the ${shelfFace.stock}'s real face. Type a depth to change it.`;
    // The parse measured its board line against another default; this line is the one the shelves are built to.
    spec = { ...spec, cueNotes: [...(spec.cueNotes ?? []).filter((c) => !/^The ¾" parts are one /.test(c)), ...(depthTypedIn(prompt) ? [] : [said])] };
  }
  // Cleat-mounted singular wall shelf: honor typed W×D×thickness as ONE shelf (not multi stack).
  const shelfThick = spokenShelfThickness(prompt);
  const singularCleatShelf =
    wallShelfCleats &&
    /\bshelf\b/.test(lowerPrompt) &&
    !/\bshelves\b/.test(lowerPrompt) &&
    (/cleat/.test(lowerPrompt) || shelfThick != null || /singular|single/.test(lowerPrompt));
  if (singularCleatShelf) {
    const cleatH = 2.5;
    const depthTyped = depthTypedIn(prompt);
    const Df = depthTyped ? D : shelfFace?.face ?? Math.min(D, 8);
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
    const depthTyped = depthTypedIn(prompt);
    const Df = depthTyped ? D : shelfFace?.face ?? Math.min(D, 8);
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
    const assumed = classDefaultAssumedNotes(prompt, floatStem, { width: W, height: outH, depth: Df }).filter((n) => !shelfFace || !/" deep \(/.test(n));
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
    // Honor a spoken shelf / tier count first ("wall shelf with 2 tiers"), then the singular noun —
    // never invent a multi stack for one floating shelf.
    const spokenN = spokenTierCount(lowerPrompt);
    const n = Math.max(
      1,
      Math.min(8, spokenN ?? (singularShelf ? 1 : u.shelfCount && u.shelfCount > 0 ? u.shelfCount : 3)),
    );
    const cleatH0 = 2.5;
    const depthTyped = depthTypedIn(prompt);
    const Df = depthTyped ? D : shelfFace?.face ?? Math.min(D, 8);
    // Typed overall H wins — densify lip/backstop/spacers so envelope AABB == typed H
    // (do not invent gap=10 stacks that overshoot, then hide behind snapHud).
    // Only a typed height is an envelope: an untyped class height never invents a tall backstop.
    const heightTyped = /(?:tall|high|height)\b/i.test(lowerPrompt);
    const envelopeH = Math.max(
      H > 0 && (heightTyped || n > 1) ? H : n === 1 ? (wantsLip ? 6 : P) : n * (cleatH0 + P) + Math.max(0, n - 1) * 10,
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
      // The title size is the model's overall (W × H × D), never the shelf board's W × D × thickness.
      const name = classDefaultDensifyTitle(floatStem, prompt, { width: W, height: outH, depth: Df });
      // Wall shelf legacy stamped W×D×P — densify gate only covers floating shelf class.
      const floatAssumed = classDefaultAssumedNotes(prompt, floatStem, { width: W, height: outH, depth: Df }).filter((n) => !shelfFace || !/" deep \(/.test(n));
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