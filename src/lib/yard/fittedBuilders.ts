/**
 * Specialty fitted carcase builders (bench, hung, beds, litter, …).
 */
import { createId } from "@/lib/utils";
import { typedAxisNumber } from "./typedAxis";
import { inchFrac } from "./inchText";
import type { FittedSpec, Panel, YardProject } from "./types";
import type { HouseAffordance } from "./family";
import { drawerBoxFromOpening } from "./shopPlural";
import { featureBay, heldCollection } from "./heldObjects";
import { readHookRows } from "./face";
import {
  detectHouseFamily, identityTitleStem, mediaIdentityLabel, sitBenchTitleStem,
  isCoatHookBoard, isPegRail, isLeashRail, isKeyMailShelf, isWallMediaLedge,
  isPictureLedge, pictureLedgeTitleStem, isBedsideShelf, isRadiatorCover, isPorchSwingFrame,
  isOttoman, isLoungeChair, isRockingChair, isDaybed, isPlatformBed, isBunkBed, isLoftBed,
  isLadderShelfFurniture, ladderShelfTitleStem, isWorkbench, isPottingBench, isStandingShopTop,
  isAvTower, isFilingShelf, wantsShoes, wantsPrintHold, wantsBookHold, isKitchenUpper,
  isLaundryFoldDown, isCoatCubbyWall, isOpenCubbyWall, isMudroomCubbyWall, isBootTrayBench,
  isBookBinBench, isPegboard, isToolRail, isDryingRack, isUtilityShelf, isPlanterBox,
  isStorageBox, storageBoxTitleStem, isToyChest, isHingedLidChest, isLiftOffLidChest,
  isSeatingLoungeClass, isAdirondackChair, isOutdoorSideTable, isSideEndTable, sideEndTableStem,
  isDiningTable, isPrepTable, isButcherCart, isServingCart, isPrinterStand, isLumberRack,
  isMediaShelf, isOpenKitchenShelving, isStereoCabinet, isHouseMediaCarcase, isFoldDown,
  isIroningWallMount, isLaundrySorter, isFoldingTable, isPortalHookRail, isPortalSpanShelf,
  isTowelPortalRail, isShoePortalRail, isShoePortalCubbies, portalHookRailTitle, portalSpanShelfTitle,
  openCubbyWallTitle, towelPortalWantsHooks, isDoorPortal, isMultiLidPrompt, spokenLidCount,
  isLiftOffLidPrompt, isStorageHutch, isMagazineRack, isPlateRack, isSlotRack, slotRackTitle,
  isKitchenBase, isKitchenIsland, isSofaConsoleTable, tableTopShape, type HouseFamily,
} from "./family";
import {
  classDefaultDensifyTitle, classDefaultAssumedNotes, typedOpeningStorageAxes,
  stampTypedAxesTitle, honorSpeciesInTitle, guidanceConfirmTalk,
} from "./voiceHonesty";
import {
  P, PLY, PLY_BACKER, TWO_BY_TWO, DOOR_MIRROR_T, panel, pushPegs, pick,
  spokenShelfCount, spokenCubbyCount, spokenArmCount, spokenBracketCount, spokenBinCount,
  spokenRungCount, spokenSlotCount, spokenShelfThickness, spokenDrawerCount, typedDoorCount,
  isNoDrawersPrompt, isNoDoorsPrompt, HINGE_ARM_CLEAR_IN, typedHeightInches, cabinetStem,
  isWineRack, isShoeStorage, isOverToilet, isSpiceRack, isSpiceCabinet, isIroningCabinet,
  isMedicineCabinet, spokenTierCount, spokenBottleCount, shallowWallCabinetFace, SHELF_MIN_CLEAR,
} from "./fittedShared";
import { inch16, wineRackLayout, wineCapacityVoice, WINE_BOTTLE_CLEAR } from "./fittedWine";
import { mattressDeck, framedSleep } from "./fittedParse";


/** Shoe tier clear height (a pair of everyday shoes stands in about 6–7"). */
export const SHOE_TIER_CLEAR = 7;
/** Shoe bay clear width (a pair side by side). */
export const SHOE_BAY_MIN = 9;
/** Default clear between stacked wall shelves when no height is typed. */
export const SHELF_DEFAULT_CLEAR = 10;

export function buildCoatBench(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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
export function buildHallTree(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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


export { typedAxisNumber };

export function typedAxisOrUsual(prompt: string, kind: "length" | "width" | "height" | "depth", usual: number): number {
  return typedAxisNumber(prompt, kind) ?? usual;
}

/** Picnic table: top, attached benches, A-frame legs. Not a square dining table. */
export function buildPicnic(spec: FittedSpec, prompt: string): YardProject {
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
  const benchYs = benchH - P;
  // Each end is one frame: a 2×4 top cleat under the top and a 2×4 seat support under both seats,
  // bolted to the legs. The stretcher runs between the top cleats.
  const stud = "lumber-2x4-8";
  const ends = [x0 + inset + leg, x0 + length - inset - leg - 1.5];
  for (const x of ends) {
    panels.push(panel("rail", "Top cleat", x, tableH - P - 3.5, topZ + 1, 1.5, 3.5, topD - 2, stud));
    panels.push(panel("rail", "Seat support", x, benchYs - 3.5, topZ - gap - benchW + 1, 1.5, 3.5, topD + (gap + benchW - 1) * 2, stud));
  }
  panels.push(panel("rail", "Table stretcher", ends[0] + 1.5, tableH - P - 3.5, -leg / 2, ends[1] - ends[0] - 1.5, 3.5, leg));
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
      "Each end is one frame: a 2×4 top cleat under the top and a 2×4 seat support under both seats, bolted to the legs; the stretcher runs between the top cleats.",
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
export function buildShopTop(spec: FittedSpec, prompt: string): YardProject {
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
export function buildOpenBench(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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
export function buildPorchSwing(spec: FittedSpec, prompt: string): YardProject {
  const u = spec.unit;
  const W = typedAxisNumber(prompt, "width") ?? typedAxisNumber(prompt, "length") ?? (u.width >= 36 ? u.width : 48);
  const standH = typedAxisOrUsual(prompt, "height", u.height >= 48 ? u.height : 78);
  const seatD = 18;
  const standD = Math.max(36, u.depth || 0, seatD + 16);
  const x0 = -W / 2;
  const z0 = -standD / 2;
  const seatY = 18;
  const backH = 14;
  const panels: Panel[] = [];
  // Post-and-beam stand: 4×4 posts, a 2×6 header across each end pair, the 2×6 beam on edge on the headers.
  const post = 3.5;
  const headY = standH - 11;
  for (const x of [x0, x0 + W - post]) {
    for (const z of [z0, z0 + standD - post]) {
      panels.push(panel("upright", "Stand post", x, 0, z, post, headY, post, FRAME.post4));
    }
    panels.push(panel("rail", "End header", x + 1, headY, z0, 1.5, BED_RAIL_H, standD, FRAME.rail));
  }
  const beamZ = -0.75;
  panels.push(panel("rail", "Beam", x0, standH - BED_RAIL_H, beamZ, W, BED_RAIL_H, 1.5, FRAME.rail));
  // Seat frame: two 2×4 seat rails on edge with cross rails and a centre rail; slats sit on top.
  const railX = [x0 + post + 4, x0 + W - post - 4 - 1.5];
  const railY = seatY - 3.5;
  for (const x of railX) panels.push(panel("rail", "Seat rail", x, railY, -seatD / 2, 1.5, 3.5, seatD, FRAME.stud));
  const inX = railX[0] + 1.5;
  const inW = railX[1] - inX;
  for (const z of [-seatD / 2, seatD / 2 - 1.5]) panels.push(panel("rail", "Seat cross rail", inX, railY, z, inW, 3.5, 1.5, FRAME.stud));
  panels.push(panel("rail", "Centre seat rail", inX + inW / 2 - 0.75, railY, -seatD / 2 + 1.5, 1.5, 3.5, seatD - 3, FRAME.stud));
  // Chains (drawn as hangers) run from the beam to the outside of each seat rail.
  for (const [i, x] of railX.entries()) {
    panels.push(panel("rail", "Hanger", i === 0 ? x - 1.5 : x + 1.5, railY, beamZ, 1.5, standH - BED_RAIL_H - railY, 1.5, TWO_BY_TWO));
  }
  const slatX = railX[0];
  const slatW = railX[1] + 1.5 - slatX;
  for (let i = 0; i < 4; i++) {
    const z = -seatD / 2 + i * ((seatD - 3.5) / 3);
    panels.push(panel("deck", `Seat slat ${i + 1}`, slatX, seatY, z, slatW, P, 3.5));
  }
  // Back: 2×2 back posts bolted to the rear ends of the seat rails, slats between them.
  for (const x of railX) panels.push(panel("upright", "Back post", x, railY, -seatD / 2 - 1.5, 1.5, seatY + backH - railY, 1.5, TWO_BY_TWO));
  for (let i = 0; i < 3; i++) {
    const y = seatY + P + 1.5 + i * 4;
    panels.push(panel("rail", `Back slat ${i + 1}`, inX, y, -seatD / 2 - 1.125, inW, 2.25, P));
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
      "4×4 stand posts carry a 2×6 header at each end; the 2×6 beam stands on edge on the headers. The seat is a 2×4 frame (side, cross and centre rails) under 1×4 slats, with 2×2 back posts.",
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
export function sleepFrameLeg(
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
export function pushDrawerWithFront(
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
export function buildWallMediaLedge(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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
export function buildPictureLedge(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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

export function buildBedsideShelf(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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

export function buildHungOpen(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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


export function buildRadiatorCover(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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

export function buildHungCabinet(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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
  // The doors close on the carcase front, so the box is the typed depth less the door: shelves then stop
  // the hinge clearance short of the door, not a door-thickness more.
  const box = face.box;
  panels.push(panel("upright", "Left upright", x0, 0, 0, P, H, box));
  panels.push(panel("upright", "Right upright", x0 + W - P, 0, 0, P, H, box));
  panels.push(panel("back", "Back", x0 + P, 0, 0, innerW, H, backT));
  panels.push(panel("bottom", "Bottom", x0 + P, 0, backT, innerW, P, box - backT));
  panels.push(panel("top", "Top", x0 + P, H - P, backT, innerW, P, box - backT));
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
export function collectionKind(x: string): CollectionKind {
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
export function buildCollectionShelf(spec: FittedSpec, prompt: string, affordances: HouseAffordance[], what: string): YardProject {
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
export function buildLadderShelf(spec: FittedSpec, prompt: string, affordances: HouseAffordance[], stem: string): YardProject {
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

export const LITTER_BOX = { width: 19, depth: 15, height: 11 };
export const LITTER_HOLE = 8;

export function buildLitterCabinet(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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

export function buildShoeRack(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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
  // A positional triple ("40x18x14") already put its height on the unit — the box is that tall, not 18.
  const tripleH = typedOpeningStorageAxes(prompt).height && Number.isFinite(u.height) ? u.height : null;
  const typedH = typedHeightInches(prompt) ?? tripleH ?? (asked == null ? 18 : null);
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
export function buildOttoman(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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
export function seatingLoungeSeatDeck(args: {
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
export function buildLoungeChair(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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
export function buildRockingChair(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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

export function buildDaybed(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
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

export function buildPlatformBed(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  let W = u.width;
  const H = u.height;
  let D = u.depth;
  // Shared bed frame: 4×4 legs to the rail tops, the deck 1½" under them on slats, ledgers and rails.
  // A named mattress fits between the legs.
  const mattress = mattressDeck(prompt.toLowerCase());
  if (mattress && W - 7 < mattress.width - 0.25) W = mattress.width + 7;
  if (mattress && D - 7 < mattress.length - 0.25) D = mattress.length + 7;
  const x0 = -W / 2;
  const panels: Panel[] = [];
  pushBedPosts(panels, x0, W, D, H, false);
  pushBedLevel(panels, { label: "", x0, W, D, postX: 3.5, postZ: 3.5, deckTop: H - 1.5, floorUnder: true });
  const sized = `${inchFrac(W)}" × ${inchFrac(H)}" × ${inchFrac(D)}"`;
  const name = spec.name.match(/platform\s*bed/i)
    ? spec.name.replace(/\d+(?:\.\d+)?"\s*×\s*\d+(?:\.\d+)?"\s*×\s*\d+(?:\.\d+)?"/, sized)
    : `Platform bed ${sized}`;
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
      `${name}. Sleep deck at ${inchFrac(H - 1.5)}" — mattress on the platform, inside side rails that stand 1 1/2" above it.`,
      `Four 4×4 legs; 2×6 side and end rails bolt between them with 16 3/8" × 5 1/2" bed-rail bolts; 2×2 ledgers screwed inside the side rails with structural screws carry 1×4 slats, and the ¾" plywood sleep deck lies on the slats. A 2×4 centre rail on legs holds the slats mid-span. Guidance only — confirm mattress size before you cut.`,
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

/** Real bed-frame lumber: rails, ledgers, slats, guards and ladder are what real beds are built from. */
/** Frame lumber shared by beds, swings and other people-carrying frames. */
const FRAME = { rail: "lumber-2x6-8", ledger: "lumber-2x2-8", slat: "lumber-1x4-8", guard: "lumber-1x8-8", stud: "lumber-2x4-8", post4: "lumber-4x4-8" };
const BED_RAIL_H = 5.5;
const BED_RAIL_T = 1.5;
/** Thickest mattress the guards are set for: guard tops stand 5" above it (16 CFR 1513). */
export const BED_MATTRESS_T = 6;

/**
 * Shared bed-frame structure (bunk, loft, platform): the load runs deck → slats → ledger cleats →
 * side rails → posts → floor. Side and end rails (2×6) butt between the posts on bed-rail bolts, a
 * 2×2 ledger is screwed inside each side rail, 1×4 slats span rail to rail on the ledgers, and the
 * ¾" deck lies on the slats. A level with floor under it and a wide or long span gets a centre rail
 * on edge with legs to the floor. A raised level (underside over 30") gets guards on both long sides
 * and both ends, tops 5" above the thickest mattress; the ladder-side guard leaves a 15" opening.
 */
export function pushBedLevel(
  panels: Panel[],
  o: { label: string; x0: number; W: number; D: number; postX: number; postZ: number; deckTop: number; floorUnder: boolean; ladder?: { top: number } },
): { bolts: number; guardTop?: number } {
  const { label, x0, W, D, postX, postZ, deckTop: Y } = o;
  const pre = label ? `${label} ` : "";
  const innerW = W - postX * 2;
  const innerD = D - postZ * 2;
  const railTop = Y + 1.5;
  const railY = railTop - BED_RAIL_H;
  // Side rails (along the length) and end rails, flush with the posts' inside faces.
  panels.push(panel("rail", `${pre}left side rail`.replace(/^./, (c) => c.toUpperCase()), x0 + postX - BED_RAIL_T, railY, postZ, BED_RAIL_T, BED_RAIL_H, innerD, FRAME.rail));
  panels.push(panel("rail", `${pre}right side rail`.replace(/^./, (c) => c.toUpperCase()), x0 + W - postX, railY, postZ, BED_RAIL_T, BED_RAIL_H, innerD, FRAME.rail));
  panels.push(panel("rail", `${pre}head rail`.replace(/^./, (c) => c.toUpperCase()), x0 + postX, railY, postZ - BED_RAIL_T, innerW, BED_RAIL_H, BED_RAIL_T, FRAME.rail));
  panels.push(panel("rail", `${pre}foot rail`.replace(/^./, (c) => c.toUpperCase()), x0 + postX, railY, D - postZ, innerW, BED_RAIL_H, BED_RAIL_T, FRAME.rail));
  // Ledger cleats inside the side rails carry the slats.
  const slatT = 0.75;
  const ledgerTop = Y - P - slatT;
  panels.push(panel("cleat", `${pre}left ledger`.replace(/^./, (c) => c.toUpperCase()), x0 + postX, ledgerTop - 1.5, postZ, 1.5, 1.5, innerD, FRAME.ledger));
  panels.push(panel("cleat", `${pre}right ledger`.replace(/^./, (c) => c.toUpperCase()), x0 + W - postX - 1.5, ledgerTop - 1.5, postZ, 1.5, 1.5, innerD, FRAME.ledger));
  // Slats about every 12" (3½" wide), rail to rail, resting on the ledgers.
  const slatW = 3.5;
  const nSlat = Math.max(3, Math.ceil(innerD / 12) + 1);
  const pitch = (innerD - slatW) / (nSlat - 1);
  for (let i = 0; i < nSlat; i++) {
    panels.push(panel("rail", `${pre}slat ${i + 1}`.replace(/^./, (c) => c.toUpperCase()), x0 + postX, ledgerTop, postZ + i * pitch, innerW, slatT, slatW, FRAME.slat));
  }
  panels.push(panel("deck", label ? `${label} deck` : "Sleep deck", x0 + postX, Y - P, postZ, innerW, P, innerD));
  // Centre support: a 2×4 on edge under the slats, end rail to end rail, on legs to the floor.
  if (o.floorUnder && railY > 4) {
    const cTop = ledgerTop;
    const cY = cTop - 3.5;
    panels.push(panel("rail", `${pre}centre rail`.replace(/^./, (c) => c.toUpperCase()), -0.75, cY, postZ, 1.5, 3.5, innerD, FRAME.stud));
    const nLeg = innerD > 60 ? (innerW > 50 ? 2 : 1) : 0;
    for (let i = 1; i <= nLeg; i++) {
      const z = postZ + (innerD * i) / (nLeg + 1) - 1.75;
      panels.push(panel("upright", `${pre}centre leg${nLeg > 1 ? ` ${i}` : ""}`.replace(/^./, (c) => c.toUpperCase()), -0.75, 0, z, 1.5, cY, 3.5, FRAME.stud));
    }
  }
  let guardTop: number | undefined;
  if (railY > 30) {
    // Guards: tops 5" above the thickest mattress; a 1×8 leaves no gap a child's head fits above the rail.
    guardTop = Y + BED_MATTRESS_T + 5;
    const gH = 7.25;
    const gY = guardTop - gH;
    const gT = P;
    const open = 15;
    panels.push(panel("rail", `${pre}wall-side guard`.replace(/^./, (c) => c.toUpperCase()), x0 + postX - BED_RAIL_T, gY, postZ, gT, gH, innerD, FRAME.guard));
    panels.push(panel("rail", `${pre}ladder-side guard`.replace(/^./, (c) => c.toUpperCase()), x0 + W - postX + BED_RAIL_T - gT, gY, postZ + open, gT, gH, innerD - open, FRAME.guard));
    panels.push(panel("rail", `${pre}head guard`.replace(/^./, (c) => c.toUpperCase()), x0 + postX, gY, postZ - gT, innerW, gH, gT, FRAME.guard));
    panels.push(panel("rail", `${pre}foot guard`.replace(/^./, (c) => c.toUpperCase()), x0 + postX, gY, D - postZ, innerW, gH, gT, FRAME.guard));
  }
  return { bolts: 16, guardTop };
}

/** Four corner posts: doubled 2×4s (3" × 3½") for a tall frame, solid 4×4 legs for a low one. */
function pushBedPosts(panels: Panel[], x0: number, W: number, D: number, H: number, doubled: boolean) {
  const corners: [string, number, number][] = [
    ["front left", x0, D - 3.5],
    ["front right", x0 + W - (doubled ? 3 : 3.5), D - 3.5],
    ["back left", x0, 0],
    ["back right", x0 + W - (doubled ? 3 : 3.5), 0],
  ];
  for (const [where, x, z] of corners) {
    if (doubled) {
      panels.push(panel("upright", `Post ${where} A`, x, 0, z, 1.5, H, 3.5, FRAME.stud));
      panels.push(panel("upright", `Post ${where} B`, x + 1.5, 0, z, 1.5, H, 3.5, FRAME.stud));
    } else panels.push(panel("upright", `Leg ${where}`, x, 0, z, 3.5, H, 3.5, FRAME.post4));
  }
}

/** Ladder on the open long side: two 2×4 stiles from the floor to the guard top, 2×2 rungs about every 10". */
function pushBedLadder(panels: Panel[], x0: number, W: number, postZ: number, top: number, fromY: number) {
  const x = x0 + W - 1.5;
  panels.push(panel("upright", "Ladder stile head", x, 0, postZ, 1.5, top, 3.5, FRAME.stud));
  panels.push(panel("upright", "Ladder stile foot", x, 0, postZ + 15, 1.5, top, 3.5, FRAME.stud));
  const n = Math.max(2, Math.floor((fromY - 4) / 10));
  const step = fromY / (n + 1);
  for (let i = 1; i <= n; i++) panels.push(panel("rail", `Ladder rung ${i}`, x, step * i - 0.75, postZ + 3.5, 1.5, 1.5, 11.5, FRAME.ledger));
}

export function buildBunkBed(spec: FittedSpec, prompt: string, affordances: HouseAffordance[]): YardProject {
  const u = spec.unit;
  const H = u.height;
  const lower = prompt.toLowerCase();
  const loft = isLoftBed(lower);
  // Doubled 2×4 posts stand outside the mattress: 3" across the width, 3½" along the length.
  const postX = 3;
  const postZ = 3.5;
  const mattress = mattressDeck(lower) ?? { width: 38, length: 75 };
  let W = u.width;
  let D = u.depth;
  if (W - postX * 2 < mattress.width - 0.25) W = mattress.width + postX * 2;
  if (D - postZ * 2 < mattress.length - 0.25) D = mattress.length + postZ * 2;
  const x0 = -W / 2;
  // Upper guard tops sit ½" under the post tops; the lower deck sits about a foot up.
  const upperY = H - 0.5 - BED_MATTRESS_T - 5;
  const lowerY = Math.min(12, Math.max(8, upperY - 40));
  const panels: Panel[] = [];
  pushBedPosts(panels, x0, W, D, H, true);
  if (!loft) pushBedLevel(panels, { label: "Lower", x0, W, D, postX, postZ, deckTop: lowerY, floorUnder: true });
  const up = pushBedLevel(panels, { label: loft ? "Loft" : "Upper", x0, W, D, postX, postZ, deckTop: upperY, floorUnder: false });
  pushBedLadder(panels, x0, W, postZ, up.guardTop ?? upperY, upperY - P);
  const bolts = (loft ? 1 : 2) * 16;
  const headroom = upperY - 4 - (loft ? 0 : lowerY + BED_MATTRESS_T);
  const guardH = BED_MATTRESS_T + 5;
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
        ? `${name}. One elevated sleep platform on a post frame at ${inchFrac(upperY)}" — open floor under, ${inchFrac(headroom)}" clear beneath its rails.`
        : `${name}. Two sleep platforms on a post frame — lower deck at ${inchFrac(lowerY)}", upper at ${inchFrac(upperY)}"; ${inchFrac(headroom)}" sitting room above a ${BED_MATTRESS_T}" lower mattress.`,
      `Four doubled 2×4 posts stand outside the ${mattress.width}" × ${mattress.length}" mattress. 2×6 side and end rails bolt between the posts with ${bolts} 3/8" × 5 1/2" bed-rail bolts; 2×2 ledgers screwed inside the side rails with structural screws carry 1×4 slats, and the ¾" plywood deck lies on the slats.${loft ? "" : " A 2×4 centre rail on a centre leg holds the lower slats mid-span."}`,
      `1×8 guards run both long sides and both ends of the ${loft ? "loft" : "upper bunk"}, tops ${guardH}" above the deck (5" above a ${BED_MATTRESS_T}" mattress); the ladder-side guard leaves a 15" opening for the ladder. The 2×4 ladder screws to the side rails and stands on the floor.`,
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

