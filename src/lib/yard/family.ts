/**
 * One detector for house prompts.
 * Mount (wall / floor / straddle) + use (sit / store / hang / work) +
 * openings (open / door / fold-down) pick a family. Affordances are
 * flags on that family — not a new .ts file per noun.
 *
 * Untaught house nouns reuse a shape (hung-open, floor-carcase, table,
 * seat, …) instead of falling through to a generic plywood floor box.
 */

import type { FittedProgram } from "./types";

export type HouseMount = "wall" | "floor" | "straddle";
export type HouseUse = "sit" | "store" | "hang" | "work";
export type HouseOpening = "open" | "door" | "fold-down";

export type HouseFamily =
  | "table"
  | "floor-carcase"
  | "hung-open"
  | "hung-cabinet"
  | "seat"
  | "slab"
  | "bunk"
  | "straddle";

export type HouseAffordance =
  | "jar-lips"
  | "bottle-rails"
  | "fold-down-board"
  | "cubbies"
  | "door"
  | "hanging-rods"
  | "mirror"
  | "drawers"
  | "hooks"
  | "cleats"
  | "sleep-platforms"
  | "hinged-lid";

export type HouseHit = {
  family: HouseFamily;
  mount: HouseMount;
  use: HouseUse;
  opening: HouseOpening;
  affordances: HouseAffordance[];
  program: FittedProgram;
};

/** Nouns that belong on the fitted / house path — not a figure, not a window. */
const HOUSE_NOUN =
  /vanity|closet|cabinet|cabinetry|desk|bookcase|bookshelf|pantry|wardrobe|built-?in|alcove|linen|mudroom|workbench|potting\s*bench|nightstand|bedside|dresser|media cons|console|\btv\b|sideboard|buffet|credenza|hutch|island|\btable\b|prep\s*table|butcher|cart|shelving|shelves|\bshelf\b|\bledge\b|drawer|storage|\bbench\b|\bseat\b|banquette|\brack\b|crate|headboard|bunk|loft\s*bed|platform\s*beds?|shoe|coat|hall\s*tree|coat\s*tree|entry\s*tree|range\s*hood|kitchen\s*hood|\bhood\b|cubb|organizer|etagere|étagère|space[- ]?saver|over[- ]?(the[- ]?)?toilet|fold[- ]?down|drop[- ]?down|\blaundry\b|radiator|\bday\s*beds?\b|\bstereo\b|soundbar|(?:\bav\b|a\.?\s*v\.?)\s*tower|media\s*tower|entertainment|pegboard|peg\s*board|tool\s*rail|leash\s*rail|peg\s*rail|printer\s*stand|filing\s*shelf|file\s*cabinet|lumber\s*rack|wall\s*panel|ironing|laundry\s*sorter|\bsorter\b|drying\s*rack|utility\s*shel|folding\s*table|umbrella\s*stand|boot\s*tray|key\s*(?:and|&)\s*mail|mail\s*shelf|planter|adirondack|porch\s*swing|outdoor\s*side\s*table|side\s*table|lounge\s*chair|easy\s*chair|club\s*chair|rocking\s*chair|\bottoman\b|\bpouf\b|foot\s*stool|footstool|\bchest\b|toy\s*box|hinged\s*lid|book\s*bin/;

function isWindowPrompt(lower: string) {
  if (/window seat/.test(lower)) return false;
  if (/andersen|pella|jeld-?wen|marvin|rough opening|casement|double.?hung|single.?hung|awning|hopper/.test(lower)) return true;
  if (/\bwindow\b/.test(lower) && !/cabinet|box|seat/.test(lower)) return true;
  return false;
}

function isNotHouse(lower: string) {
  if (isWindowPrompt(lower)) return true;
  if (/eiffel|taj|mahal|pyramid|giraffe|rocket|looks like|lattice tower/.test(lower)) return true;
  if (
    /popsicle|craft stick|toothpick|paper towel|lego|mailing tube|cedar/.test(lower) &&
    (!HOUSE_NOUN.test(lower) ||
      /soft-?launch|leaves?\s+free|(?:paper\s*)?plane.{0,40}\bramp\b/.test(lower))
  ) {
    return true;
  }
  if (isPorchSwingFrame(lower)) return true;
  // Seating lounge class (lounge / rocking / ottoman) stays house/fitted — never craft House-wire steal.
  if (isSeatingLoungeClass(lower)) {
    /* keep house path */
  } else if (/\bchair\b|\bstool\b/.test(lower) && !/desk|vanity|\btable\b/.test(lower)) return true;
  // Climb step-shelf on a linen/closet stays house — not a free ladder eject.
  if (
    /ladder|stairs|staircase/.test(lower) &&
    !isBunkBed(lower) &&
    !isLoftBed(lower) &&
    !(HOUSE_NOUN.test(lower) && /step-?shelf|climb\s+step/.test(lower))
  ) {
    return true;
  }
  if (/birdhouse/.test(lower)) return true;
  // Planter box stays house (open-top fitted) — not craft Wire skeleton.
  // Bridge spans only — a shelf/rail spanning a door portal or wall-mount tool rail stays house.
  if (/bridge|viaduct|overpass|trestle/.test(lower) && !/tool\s*rail|pegboard|lumber\s*rack/.test(lower)) return true;
  if (
    /(?:\bspan\b|spanning)/.test(lower) &&
    !/door\s*portal|portal|doorway|door opening|wall\s*span|tool\s*rail|wall\s*mount|clear\s*wall|hooks?|pegboard|peg\s*board|lumber\s*rack/.test(
      lower,
    )
  ) {
    return true;
  }
  return false;
}

function isOverToilet(lower: string) {
  if (/toilet\s*paper/.test(lower)) return false;
  return /over[- ]?(the[- ]?)?toilet|toilet[- ]?(cabinet|storage|shelf|etagere|étagère)|space[- ]?saver/.test(
    lower,
  );
}

function isIroning(lower: string) {
  return /ironing/.test(lower);
}

/** Explicit fold-down / drop-down — not "folding table". */
export function isFoldDown(lower: string) {
  return /fold[- ]?down|drop[- ]?down/.test(lower);
}

export function isLaundryFoldDown(lower: string) {
  return /laundry/.test(lower) && isFoldDown(lower);
}

export function isRadiatorCover(lower: string) {
  return /radiator/.test(lower);
}
/** Sofa / entry / console table — shallow table, not a TV media carcase. */
export function isSofaConsoleTable(lower: string) {
  return /sofa\s*table|console\s*table|entry\s*console/.test(lower);
}

/** Wall / media ledge — hung-open house path; never weekend picture-ledge tip-hold. */
export function isWallMediaLedge(lower: string) {
  if (/(?:picture|photo|art)\s*ledge|\bpicture\s*ledge\b/.test(lower) && !/\bmedia\b|\btv\b|soundbar|stereo/.test(lower)) {
    return false;
  }
  if (/\bmedia\b/.test(lower) && /\bledge\b/.test(lower)) return true;
  if (/wall/.test(lower) && /\bledge\b/.test(lower) && /media|\btv\b|soundbar|stereo|entertainment|clear below|stand footprint|footprint clear/.test(lower)) {
    return true;
  }
  return false;
}

/** Tip-rail hung-open envelope — picture/photo/art ledge or picture/tip rail.
 * Lip + backstop spanning typed H (same honesty class as media ledge / floating lip).
 * Not media ledge, not bedside, not freestanding weekend tip-stand / Picture frame. */
export function isPictureLedge(lower: string) {
  if (isWallMediaLedge(lower) || isBedsideShelf(lower)) return false;
  if (/(?:picture|photo|art)\s*ledge|\bpicture\s*ledge\b/.test(lower)) return true;
  if (/\bpicture\s*rail\b|\btip[- ]?rail\b/.test(lower)) return true;
  return false;
}

/** Title stem for tip-rail hung-open — Picture rail when named, else Picture ledge. */
export function pictureLedgeTitleStem(lower: string): string {
  if (/\bpicture\s*rail\b/.test(lower)) return "Picture rail";
  if (/\btip[- ]?rail\b/.test(lower)) return "Tip rail";
  if (/\bphoto\s*ledge\b/.test(lower)) return "Photo ledge";
  if (/\bart\s*ledge\b/.test(lower)) return "Art ledge";
  return "Picture ledge";
}

/** Media shelf (incl. soundbar hold) — positive shelf/ledge identity, not bare Media console. */
export function isMediaShelf(lower: string) {
  if (/\bdesk\b|workbench|\bvanity\b/.test(lower)) return false;
  if (/media\s*shelf|soundbar\s*shelf/.test(lower)) return true;
  if (/\bmedia\b/.test(lower) && /\bshelf\b/.test(lower) && !/console|cabinet|tower/.test(lower)) return true;
  return false;
}

/** Stereo cabinet / stereo unit — never naked Storage unit. */
export function isStereoCabinet(lower: string) {
  return /\bstereo\b/.test(lower);
}

/** AV / media component tower — floor carcase, never lattice/wire House skeleton. */
export function isAvTower(lower: string) {
  return /(?:\bav\b|a\.?\s*v\.?)\s*tower|media\s*tower|component\s*tower|av\s*rack/.test(lower);
}

/** Prompt asks to cradle a real soundbar (envelope + lip, never a decal). */
export function wantsSoundbarHold(lower: string) {
  return /sound\s*-?\s*bar|holds?\s+a\s+real\s+soundbar/.test(lower);
}

/** House media family nouns that must beat weekend craft steals. */
export function isHouseMediaCarcase(lower: string) {
  if (isSofaConsoleTable(lower)) return false;
  // Hutch is storage-hutch class (china silhouette) — never media buffet/sideboard steal.
  if (isStorageHutch(lower)) return false;
  if (isWallMediaLedge(lower) || isMediaShelf(lower) || isStereoCabinet(lower) || isAvTower(lower)) return true;
  if (wantsSoundbarHold(lower) && /shelf|ledge|console|cabinet|media/.test(lower)) return true;
  if (/\bmedia\b|\btv\b/.test(lower) && /console|cabinet|sideboard|buffet|credenza|entertainment/.test(lower)) return true;
  if (/\b(?:sideboard|buffet|credenza)\b/.test(lower)) return true;
  return false;
}

/**
 * Table top footprint shape from the prompt — universal, not a noun list.
 * Oval beats round (elliptical tops are not discs). Square is plan W=D.
 * Null when no shape word; callers default freestanding tables to rect.
 */
export type TableTopShape = "round" | "oval" | "square" | "rect";

export function tableTopShape(lower: string): TableTopShape | null {
  if (/\boval\b|elliptical|\bellipse\b/.test(lower)) return "oval";
  if (/\b(?:round|circular)\b|\bdiameter\b|\bdia\b/.test(lower)) return "round";
  if (/\bsquare\b/.test(lower)) return "square";
  if (/\brect(?:angle)?\b|\brectangular\b/.test(lower)) return "rect";
  // Outdoor side table typed N×N×H (equal plan axes) → square footprint.
  if (isOutdoorSideTable(lower)) {
    const m = lower.replace(/[″"]/g, '"').match(
      /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*[×xby]\s*(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s*[×xby]\s*(\d+(?:\.\d+)?)/i,
    );
    if (m) {
      const a = parseFloat(m[1]);
      const b = parseFloat(m[2]);
      const c = parseFloat(m[3]);
      // 20×20×18 tall → square; 20×18×20 W×H×D display still square plan when W=D after parse.
      if (Math.abs(a - b) < 0.2 && c > 0) return "square";
      if (Math.abs(a - c) < 0.2 && b > 0) return "square";
    }
  }
  return null;
}

/** Title prefix stamped for shaped tops (Round / Oval / Square). */
export function tableShapeTitlePrefix(shape: TableTopShape | null | undefined): string {
  if (shape === "round") return "Round ";
  if (shape === "oval") return "Oval ";
  if (shape === "square") return "Square ";
  return "";
}


function isMedicine(lower: string) {
  return /medicine/.test(lower);
}

function isSpiceRack(lower: string) {
  return /spice/.test(lower) && /rack/.test(lower);
}

function isWineRack(lower: string) {
  return /wine/.test(lower) && /rack/.test(lower);
}

function wantsJars(lower: string) {
  return /\bjar|\bspice/.test(lower);
}

function wantsBottles(lower: string) {
  return /wine|bottle/.test(lower);
}

/** Shoe storage intent — rack, cubbies, or store — not a bare "shoe". */
export function wantsShoes(lower: string) {
  if (!/\bshoes?\b|\bboots?\b/.test(lower)) return false;
  return /rack|rail|store|storage|cubb|organizer/.test(lower);
}

/** Shoe rail in a door portal — pairs on a rail, not a shelving niche. */
export function isShoePortalRail(lower: string) {
  return (
    /\bshoes?\b/.test(lower) &&
    /rail|rack/.test(lower) &&
    !/cubb/.test(lower) &&
    isDoorPortal(lower)
  );
}

/** Shoe cubbies in a door portal — bays + shelves, clear swing; not a shoe rail. */
export function isShoePortalCubbies(lower: string) {
  return (
    /\bshoes?\b/.test(lower) &&
    /cubb/.test(lower) &&
    isDoorPortal(lower)
  );
}

/** Mudroom cubbies / cubby wall / cubby carcase — not a sit bench.
 * Strangers type "mudroom cubbies 48 wide 72 high 16 deep" without saying wall/alcove.
 * Explicit bench/seat/window seat still keep the seat family. */
export function isMudroomCubbyWall(lower: string) {
  if (!/\bmudroom\b/.test(lower)) return false;
  if (/\bbench\b|\bseat\b|window seat|banquette/.test(lower)) return false;
  return /cubb/.test(lower);
}

/** Towel rail in a door portal — clear swing; not a shelving niche. */
export function isTowelPortalRail(lower: string) {
  return (
    /\btowels?\b/.test(lower) &&
    /rail|bar|rack/.test(lower) &&
    isDoorPortal(lower)
  );
}

/**
 * Towel portal that also densifies hooks/pegs — BOTH towel rail + hooks
 * (not towel-only path winning). Coat/key/over-door stay on portal hook-rail.
 */
export function towelPortalWantsHooks(lower: string) {
  return isTowelPortalRail(lower) && /\bhooks?\b|\bpegs?\b/.test(lower);
}


/** Workbench — shop work top; positive Workbench stem (not Desk-only / Storage). */
export function isWorkbench(lower: string) {
  return /workbench|work\s*bench/.test(lower) && !/potting/.test(lower);
}

/** Potting bench — standing outdoor/potting work top; never sit shoe-cubby Bench. */
export function isPottingBench(lower: string) {
  return /potting\s*bench/.test(lower);
}

/** Standing shop tops (workbench + potting) — not sit benches, not Desk knee pedestals. */
export function isStandingShopTop(lower: string) {
  return isWorkbench(lower) || isPottingBench(lower);
}

/** Porch swing frame — hanging seat / clear swing frame; never naked Bench / Storage. */
export function isPorchSwingFrame(lower: string) {
  // "clear swing" on an ironing board is the board's arc, not a porch swing.
  if (/ironing/.test(lower)) return false;
  if (/porch\s*swing|swing\s*frame/.test(lower)) return true;
  if (/\bswing\b/.test(lower) && /(?:hanging\s*seat|clear\s*swing|frame)/.test(lower)) return true;
  return false;
}

/** Planter box / garden box / raised bed — open-top box; honor typed W×D×H. */
export function isPlanterBox(lower: string) {
  if (/plant\s*stand|pot\s*stand/.test(lower)) return false;
  return /planter(?:\s*box)?|raised\s*(?:garden\s*)?bed|garden\s*box|flower\s*bed/.test(lower);
}

/** Adirondack chair — outdoor seat family; never Custom closet steal via "seat height". */
export function isAdirondackChair(lower: string) {
  return /adirondack/i.test(lower);
}

/** Rocking chair — curved rocker rails under legs; never skis/sled / House wire. */
export function isRockingChair(lower: string) {
  if (isAdirondackChair(lower)) return false;
  if (/rocking\s*chair|\brocker\b/.test(lower)) return true;
  if (/rocking/.test(lower) && /\bchair\b/.test(lower)) return true;
  return false;
}

/**
 * Lounge / easy / club chair — sit anatomy (seat + back + legs); never Yard House wire.
 * Adirondack / rocking keep their own stems.
 */
export function isLoungeChair(lower: string) {
  if (isAdirondackChair(lower) || isRockingChair(lower)) return false;
  if (/lounge\s*chair|easy\s*chair|club\s*chair/.test(lower)) return true;
  if (/\blounge\b/.test(lower) && /\bchair\b/.test(lower)) return true;
  return false;
}

/** Ottoman / pouf / footstool — solid top sit cube; never Storage / Yard House wire. */
export function isOttoman(lower: string) {
  return /\bottoman\b|\bpouf\b|foot\s*stool|footstool/.test(lower);
}

/** Seating lounge class — prefer seat/chair family over naked House wire. */
export function isSeatingLoungeClass(lower: string) {
  return isLoungeChair(lower) || isRockingChair(lower) || isOttoman(lower);
}

/**
 * True when the prompt names a sit-on chair/stool.
 * "Chair space" is knee room under a vanity — never a seating steal.
 */
export function namesSitChair(lower: string) {
  const hay = lower.replace(/chair[\s-]+space/g, " ");
  return /\bchair\b|\bstool\b/.test(hay);
}

/** Outdoor side table — positive Outdoor side table stem (not naked Table). */
export function isOutdoorSideTable(lower: string) {
  if (/outdoor\s*side\s*table|side\s*table/.test(lower)) return true;
  if (/outdoor/.test(lower) && /\btable\b/.test(lower) && !/prep|folding|sofa|console|coffee|dining|work\s*table/.test(lower)) {
    return true;
  }
  return false;
}

/** Pegboard wall panel fitted to an opening — panel anatomy, never naked House wire. */
export function isPegboard(lower: string) {
  if (/pegboard|peg\s*board/.test(lower)) return true;
  if (/wall\s*panel/.test(lower) && /peg|tool\s*wall|fitted/.test(lower)) return true;
  return false;
}

/**
 * Coat hook board — board + hooks + mount height (weekend craft / hung-open).
 * Never Coat rack / Tool / portal steal when board + hooks (+ optional pine).
 */
export function isCoatHookBoard(lower: string) {
  if (isCoatCubbyWall(lower)) return false;
  if (/tool\s*rail|leash\s*rail|peg\s*rail|key\s*(?:and|&)\s*mail|ironing/.test(lower)) return false;
  if (/coat\s*hook\s*board|hook\s*board|coat\s*board/.test(lower)) return true;
  if (/coat/.test(lower) && /hook/.test(lower) && /\bboard\b/.test(lower)) return true;
  return false;
}

/**
 * Peg rail — hung-open peg rail (tool-rail / leash pattern) with peg identity.
 * Never Tool / Key / Leash / Coat steal when peg rail is named.
 */
export function isPegRail(lower: string) {
  if (isCoatHookBoard(lower)) return false;
  if (/tool\s*rail|leash\s*rail|key\s*rail|coat\s*rail|key\s*(?:and|&)\s*mail/.test(lower)) return false;
  if (/peg\s*rail|peg\s*rack/.test(lower)) return true;
  if (/\bpegs?\b/.test(lower) && /rail|wall\s*mount|clear\s*wall|spann|mount\s*height/.test(lower) && !/tool|leash|key|coat|towel|shoe/.test(lower)) {
    return true;
  }
  return false;
}

/**
 * Tool rail — wall-mounted hook rail for tools (clear wall mount / span).
 * Never Bridge, never key/coat/peg portal steal when tool rail is named.
 */
export function isToolRail(lower: string) {
  if (isCoatHookBoard(lower)) return false;
  if (/leash\s*rail/.test(lower) || isLeashRail(lower)) return false;
  if (isPegRail(lower)) return false;
  if (/tool\s*rail/.test(lower)) return true;
  // Hook rail with tool language — peg rail identity stays isPegRail above.
  if (/hook\s*rail/.test(lower) && /tool|wall\s*mount|clear\s*wall|spanning/.test(lower) && !/coat|key|towel|shoe|peg/.test(lower)) {
    return true;
  }
  if (/peg\s*rail/.test(lower) && /tool/.test(lower) && /wall\s*mount|clear\s*wall|spanning/.test(lower)) return true;
  return false;
}

/** Leash rail — hung-open hook rail (tool-rail pattern). Never Bridge / Tool / Key steal. */
export function isLeashRail(lower: string) {
  if (/leash\s*rail|dog\s*leash(?:\s*rail)?|leash\s*hook/.test(lower)) return true;
  if (/\bleash\b/.test(lower) && /rail|hook/.test(lower) && /wall\s*mount|clear\s*wall|spann|hooks?|mount\s*height/.test(lower)) {
    return true;
  }
  return false;
}

/** Filing shelf — open-bay file shelf (not drawer File cabinet densify). */
export function isFilingShelf(lower: string) {
  if (/filing\s*shelf|file\s*shelf/.test(lower)) return true;
  if (/\bfiling\b/.test(lower) && /(?:open\s+)?bays?|open\s+front|open\s+shelf/.test(lower)) return true;
  if (/\bfiling\b/.test(lower) && /\bshelf\b|\bshelves\b/.test(lower) && !/cabinet|drawer/.test(lower)) return true;
  return false;
}

/** Printer stand — positive Printer stand stem (never naked Storage); shelf only when typed. */
export function isPrinterStand(lower: string) {
  if (/printer\s*stand|printer\s*cart|printer\s*table/.test(lower)) return true;
  if (/\bprinter\b/.test(lower) && /stand|cart|shelf|table/.test(lower)) return true;
  return false;
}

/** Floor lamp / lamp stand — weekend pot-hold class stem (never Lattice tower / Eiffel / climb lace). */
export function isFloorLampStand(lower: string) {
  if (/floor\s*lamp(?:\s*stand)?|lamp\s*stand/.test(lower)) return true;
  if (/\blamp(?:\s*base)?\b/.test(lower) && /holds?\s+a\s+real|upright|envelope/.test(lower) && /stand|base/.test(lower)) return true;
  return false;
}

export function floorLampTitleStem(lower: string): "Floor lamp stand" | "Lamp stand" {
  return /floor\s*lamp/.test(lower) ? "Floor lamp stand" : "Lamp stand";
}

/** Key + mail shelf — shelf + hooks below; never Storage / Picture ledge / portal steal. */
export function isKeyMailShelf(lower: string) {
  if (/key\s*(?:and|&)\s*mail|mail\s*(?:and|&)\s*key|key.?mail\s*shelf|mail\s*and\s*key|key\s*hook\s*shelf/.test(lower)) return true;
  if (/\bkey\b/.test(lower) && /\bmail\b/.test(lower) && /shelf|ledge|hook/.test(lower)) return true;
  return false;
}

/**
 * Coat + cubby dual wall — four cubbies + full-width coat rod (not Coat rod–only).
 * Sit bench / coat+bench stay seat path.
 */
export function isCoatCubbyWall(lower: string) {
  if (!/coat/.test(lower)) return false;
  if (!/cubb/.test(lower)) return false;
  if (/\bbench\b|\bseat\b|window seat|banquette/.test(lower)) return false;
  return true;
}

/**
 * Open cubby carcase / cubby wall — toy, kids, mudroom, or named cubby wall.
 * Universal F/F/P: positive stem + spoken N cubbies with dividers; never bare Storage.
 * Not a sit bench, not coat+cubby (rod dual), not shoe portal/rack.
 */
export function isOpenCubbyWall(lower: string) {
  if (/\bbench\b|\bseat\b|window seat|banquette/.test(lower)) return false;
  if (isCoatCubbyWall(lower)) return false;
  if (wantsShoes(lower) || isShoePortalCubbies(lower) || isShoePortalRail(lower)) return false;
  if (isMudroomCubbyWall(lower)) return true;
  if (/cubb/.test(lower) && /wall|unit|carcase|cabinet|organizer/.test(lower)) return true;
  if (/cubb/.test(lower) && /toy|kids|play|nursery|child/.test(lower)) return true;
  return false;
}

/** Positive stem for open cubby walls — never bare Storage / Closet. */
export function openCubbyWallTitle(lower: string): string {
  if (/\bmudroom\b/.test(lower)) return "Mudroom cubbies";
  if (/toy/.test(lower)) return "Toy cubby wall";
  if (/kids|play|nursery|child/.test(lower)) return "Kids cubby wall";
  // Prefer Wall cubby stem wording (batch-37); cubby wall identity still held.
  return "Wall cubby";
}

/** Boot tray bench — tray densify + sit-load (not Boot bench without tray). */
export function isBootTrayBench(lower: string) {
  return /boot/.test(lower) && /tray/.test(lower) && /\bbench\b/.test(lower);
}

/** Book bin / bin bench — sit-load + bin densify; never naked Bench. */
export function isBookBinBench(lower: string) {
  if (!/\bbench\b/.test(lower)) return false;
  if (/workbench/.test(lower) || isPottingBench(lower)) return false;
  if (isBootTrayBench(lower)) return false;
  if (/book/.test(lower) && /\bbin\b/.test(lower)) return true;
  if (/\bbin\b/.test(lower) && !/laundry|sorter|hamper|boot/.test(lower)) return true;
  return false;
}

/** Toy chest / toy box — kids/play/nursery path only (not every hinged-lid chest). */
export function isToyChest(lower: string) {
  if (/medicine/.test(lower)) return false;
  if (/toy\s*(?:chest|box)/.test(lower)) return true;
  if (/\bchest\b/.test(lower) && /hinged\s*lid|\blid\b/.test(lower) && /toy|kids|play|child|nursery/.test(lower)) return true;
  return false;
}

/**
 * Lift-off / removable / loose lid — NOT hinged Operate.
 * Universal lid-attachment class: stranger said the lid comes off, not piano-hinge.
 */
export function isLiftOffLidPrompt(lower: string) {
  return (
    /lift[\s-]?off\s+lid/i.test(lower) ||
    /removable\s+lid/i.test(lower) ||
    /loose\s+lid/i.test(lower) ||
    /unhinged\s+lid/i.test(lower) ||
    /lid\s+lifts?\s+off/i.test(lower) ||
    /lid\s+comes?\s+off/i.test(lower)
  );
}

/**
 * Chest / trunk / box lid anatomy (hinged OR lift-off).
 * Not medicine / file / tool cabinet drawer chests.
 */
export function isLidChestAnatomy(lower: string) {
  if (isToyChest(lower)) return true;
  if (/medicine|file\s*cabinet|filing\s*cabinet|tool\s*chest|tool\s*cabinet/.test(lower)) return false;
  // Drawer-bank / chest of drawers stay drawer path unless a lid is typed.
  if (/of\s+drawers/.test(lower)) return false;
  if (/drawer/.test(lower) && !/hinged\s*lid|\blid\b/.test(lower)) return false;
  // Explicit lid on chest/trunk/box (includes lift-off / removable / hinged wording).
  if (/(?:\bchest\b|\btrunk\b|\bbox\b)/.test(lower) && /hinged\s*lid|\blid\b/.test(lower)) {
    return true;
  }
  // Bare chest class (cedar / blanket / hope / storage / …) — lid densify by default.
  if (/\bchest\b/.test(lower)) return true;
  return false;
}

/**
 * OPERATE class: hinged-lid chest / trunk / box.
 * Toy path OR chest/trunk/box + lid — not lift-off/removable (those are isLiftOffLidChest).
 */
export function isHingedLidChest(lower: string) {
  if (isLiftOffLidPrompt(lower)) return false;
  return isLidChestAnatomy(lower);
}

/** Lift-off lid chest — same carcase + lid panel, no piano hinge / Operate swing. */
export function isLiftOffLidChest(lower: string) {
  if (!isLiftOffLidPrompt(lower)) return false;
  if (/medicine|file\s*cabinet|filing\s*cabinet|tool\s*chest|tool\s*cabinet/.test(lower)) return false;
  if (/of\s+drawers/.test(lower)) return false;
  return /(?:\bchest\b|\btrunk\b|\bbox\b|toy\s*box)/.test(lower) || isToyChest(lower);
}

/**
 * Spoken/typed lid count — digits or words (optional "hinged" bridge).
 * null = no explicit count; callers use isMultiLidPrompt for plural/dual/split.
 */
export function spokenLidCount(lower: string): number | null {
  // Allow attachment adjectives between count and lid: hinged / lift-off / removable / …
  const bridge = "(?:(?:hinged|lift[\\s-]?off|removable|loose|unhinged|dual|split)\\s+)?";
  const digit = lower.match(new RegExp(`\\b(\\d+)\\s*-?\\s*${bridge}lids?\\b`));
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
  const word = lower.match(
    new RegExp(
      `\\b(one|two|three|four|five|six|seven|eight|single)\\s*-?\\s*${bridge}lids?\\b`,
    ),
  );
  if (word && words[word[1]] != null) return words[word[1]];
  if (/\b(?:a|the|one|single)\s+(?:hinged\s+|lift[\s-]?off\s+|removable\s+)?lid\b/.test(lower)) return 1;
  return null;
}

/**
 * Multi-lid / dual-lid / split-lid intent — engine still densifies one Lid panel.
 * Callers must Assumed "one lid" honesty (never silent-collapse).
 * Universal count densify — not cedar-noun-only.
 */
export function isMultiLidPrompt(lower: string): boolean {
  const n = spokenLidCount(lower);
  if (n != null && n >= 2) return true;
  // dual/split/multi + optional attachment word + lid(s): "split lid", "dual hinged lids"
  if (/\b(?:dual|split|multi)[\s-]+(?:(?:hinged|lift[\s-]?off|removable|loose|unhinged)[\s-]+)?lids?\b/.test(lower)) {
    return true;
  }
  // Bare plural "lids" / "hinged lids" (no digit/word count) — multi intent.
  if (/\blids\b/.test(lower) && !/\blid\s+stay|\blid\s+support/.test(lower)) return true;
  return false;
}

/**
 * Storage-hutch class — tall floor carcase, china-hutch silhouette:
 * lower cabinet doors + upper open shelves. Never a dresser / chest-of-drawers
 * drawer bank. Universal mechanism on \bhutch\b (kitchen / china / buffet hutch).
 */
export function isStorageHutch(lower: string) {
  return /\bhutch\b/.test(lower);
}

/** Lumber rack — arms hold stock; never naked Storage unit. */
export function isLumberRack(lower: string) {
  if (/lumber\s*rack|timber\s*rack|pipe\s*arm/.test(lower)) return true;
  if (/\brack\b/.test(lower) && /lumber|timber/.test(lower)) return true;
  if (/\barms?\b/.test(lower) && /lumber|timber|rack/.test(lower)) return true;
  return false;
}

/** Laundry sorter — N real bins; never naked Storage unit. */
export function isLaundrySorter(lower: string) {
  if (/laundry\s*sorter/.test(lower)) return true;
  if (/\bsorter\b/.test(lower) && /laundry|clothes|wash|bin/.test(lower)) return true;
  if (/laundry/.test(lower) && /\bbins?\b/.test(lower) && /triple|three|\b3\b|sorter/.test(lower)) return true;
  return false;
}

/** Folding table — freestanding work top; never naked Table / Storage / fold-down cabinet. */
export function isFoldingTable(lower: string) {
  if (isFoldDown(lower) || isLaundryFoldDown(lower)) return false;
  if (/prep\s*table/.test(lower)) return false;
  return /folding\s*table|laundry\s+folding(?:\s+table)?|folding\s+laundry\s*table/.test(lower);
}

/** Drying rack — N rungs; never naked Storage. */
export function isDryingRack(lower: string) {
  if (/drying\s*rack|clothes\s*drying|laundry\s*drying/.test(lower)) return true;
  if (/\brack\b/.test(lower) && /dry|rung/.test(lower) && !/spice|wine|shoe|coat|lumber|tool|towel|media/.test(lower)) {
    return true;
  }
  return false;
}

/** Utility shelf / utility shelving — never naked Storage unit. */
export function isUtilityShelf(lower: string) {
  if (isOpenKitchenShelving(lower) || isLaundrySorter(lower) || isDryingRack(lower)) return false;
  if (/utility\s*shel(?:f|ves|ving)/.test(lower)) return true;
  if (/\butility\b/.test(lower) && /shel(?:f|ves|ving)/.test(lower)) return true;
  return false;
}

/**
 * Ironing board wall mount — clear wall mount + PDF mount height + clear swing.
 * Not portal/key/coat steal; not Yard House wire. Explicit cabinet stays Ironing cabinet.
 */
export function isIroningWallMount(lower: string) {
  if (!/ironing/.test(lower)) return false;
  // "wall mounted ironing board cabinet" stays Ironing cabinet.
  if (/cabinet/.test(lower)) return false;
  if (/ironing\s*board\s*wall[- ]*mount|wall[- ]*mount(?:ed)?\s+ironing|ironing.{0,24}wall[- ]*mount/.test(lower)) return true;
  if (/ironing\s*board/.test(lower) && /(?:mount\s+height|clear\s*swing|mount(?:ed)?\s+for|board\s+mount)/.test(lower)) {
    return true;
  }
  return false;
}

/** Door portal / doorway / door opening envelope (fitted hang — not a garden arch). */
export function isDoorPortal(lower: string) {
  // Ironing board wall mount uses clear-swing language — never a door portal steal.
  if (/ironing/.test(lower)) return false;
  // Leash / tool-rail clear wall mount — never a door portal steal via "spanning".
  if (isLeashRail(lower) || isToolRail(lower) || isPegRail(lower)) return false;
  // Key + mail shelf is freestanding hung shelf — never portal steal.
  if (isKeyMailShelf(lower)) return false;
  if (/door\s*portal|portal|doorway|door opening/.test(lower)) return true;
  // Bare "door" + hang/swing language — not a cabinet / crate door panel.
  if (
    /\bdoor\b/.test(lower) &&
    /clear\s*swing|over[- ]?door|above\s+(?:the\s+)?swing|swing\s+clear|(?:hook|peg|rail|rack|mount)/.test(
      lower,
    ) &&
    !/cabinet|closet|vanity|cupboard|crate|soft-?close|hinge\s*door|door\s*front|drawer/.test(lower)
  ) {
    return true;
  }
  // Clear swing / over-door without naming portal — still a door envelope for hung fittings.
  if (
    /clear\s*swing|over[- ]?door|above\s+(?:the\s+)?swing|swing\s+clear/.test(lower) &&
    /(?:hook|peg|rail|rack|shel(?:f|ves)|mount|coat|towel|shoe)/.test(lower)
  ) {
    return true;
  }
  return false;
}

/**
 * Hung peg/hook rail in a door portal — same hung-open portal class as coat rail.
 * Shape-based (rail/rack + hooks/pegs, or * rail fitted with clear swing), not a noun list.
 * Shoe / towel keep their own portal paths.
 */
export function isPortalHookRail(lower: string) {
  if (isCoatHookBoard(lower)) return false;
  if (!isDoorPortal(lower)) return false;
  // Tool rail is clear wall-mount shop class — never key/coat portal steal.
  if (isToolRail(lower)) return false;
  // Leash rail is hung-open entry class (tool-rail pattern) — never portal / Bridge steal.
  if (isLeashRail(lower)) return false;
  // Peg rail is hung-open peg identity — never portal / Tool steal.
  if (isPegRail(lower)) return false;
  // Key + mail shelf is hung-open entry class — never portal / Picture ledge steal.
  if (isKeyMailShelf(lower)) return false;
  // Ironing board wall mount is hung-open shop/laundry class — never portal steal.
  if (isIroningWallMount(lower) || /ironing/.test(lower)) return false;
  if (isShoePortalRail(lower) || isShoePortalCubbies(lower) || isTowelPortalRail(lower)) return false;
  if (/coat/.test(lower) && /rod|rail|rack|tree|peg|hook/.test(lower)) return true;
  if (/hook|peg/.test(lower) && /rail|rack|board/.test(lower)) return true;
  // Hooks/pegs densify in a door portal even without the word "rail".
  if (/hooks?|pegs?/.test(lower) && /clear\s*swing|mount|over[- ]?door/.test(lower)) return true;
  // Untaught "* rail" fitted in a portal with clear swing / mount / hooks densify.
  if (
    /\brail\b/.test(lower) &&
    /fitted|mount|clear\s*swing|hooks?/.test(lower) &&
    !/towel|shoe|closet|curtain|bottle|wine/.test(lower)
  ) {
    return true;
  }
  return false;
}

/** Display stem for a portal hook rail — Key rail, Peg rail, Coat rail, … */
export function portalHookRailTitle(lower: string): string {
  if (/coat/.test(lower)) {
    return /rod/.test(lower) ? "Coat rod" : /rail/.test(lower) ? "Coat rail" : "Coat rack";
  }
  const named = lower.match(/\b([a-z][a-z-]{1,20})\s+rail\b/);
  if (named && !/door|portal|full|clear|mount|towel|shoe/.test(named[1])) {
    const stem = named[1];
    return stem.charAt(0).toUpperCase() + stem.slice(1) + " rail";
  }
  if (/peg/.test(lower)) return "Peg rail";
  if (/hook/.test(lower)) return "Hook rail";
  return "Peg rail";
}

/**
 * Shallow shelf spanning a door portal above the swing — portal span class,
 * not a freestanding floor carcase / shelving niche.
 */
export function isPortalSpanShelf(lower: string) {
  if (!isDoorPortal(lower)) return false;
  if (!/shel(?:f|ves)\b/.test(lower)) return false;
  if (/\bshoes?\b/.test(lower) || /cubb/.test(lower)) return false;
  return /above\s+(?:the\s+)?swing|over[- ]?door|clear\s+swing\s+below|swing\s+below|spanning|shallow/.test(
    lower,
  );
}

export function portalSpanShelfTitle(lower: string): string {
  if (/over[- ]?door/.test(lower) || /above\s+(?:the\s+)?swing/.test(lower)) return "Over-door shelf";
  if (/hat\s*shelf/.test(lower)) return "Hat shelf";
  return "Shelf";
}

/** Kitchen upper → wall hung cabinet (not a floor box). */
export function isKitchenUpper(lower: string) {
  if (/base\s+cabinet|lower\s+cabinet|floor[- ]?cabinet/.test(lower)) return false;
  return /(?:kitchen\s+)?upper\s+cabinet|upper\s+(?:kitchen\s+)?cabinet/.test(lower);
}

/** Kitchen base / lower → floor carcase with door(s) + toekick (~34.5). */
export function isKitchenBase(lower: string) {
  if (isKitchenUpper(lower)) return false;
  if (/(?:kitchen\s+)?base\s+cabinet|base\s+(?:kitchen\s+)?cabinet|(?:kitchen\s+)?lower\s+cabinet|lower\s+(?:kitchen\s+)?cabinet/.test(lower)) {
    return true;
  }
  // Bare "kitchen cabinet" leans base — island/hood/wall stay out.
  return (
    /kitchen/.test(lower) &&
    /cabinet/.test(lower) &&
    !/island|hood|medicine|ironing|wall\s+cabinet|spice|wine|over[- ]?(the[- ]?)?toilet/.test(lower)
  );
}

/** Prep table — work surface; never naked Table / Storage. */
export function isPrepTable(lower: string) {
  if (isKitchenBase(lower) || isKitchenUpper(lower)) return false;
  if (/kitchen\s+island|\bisland\b/.test(lower)) return false;
  if (/butcher|\bcart\b/.test(lower)) return false;
  return /prep\s*table|prep\s*bench|kitchen\s+prep/.test(lower);
}

/** Dining table — positive Dining table stem when dining + table (never naked Table).
 * Protects: Round Table (no dining), Prep table, Outdoor side table, coffee/sofa/console. */
export function isDiningTable(lower: string) {
  if (/\bbench\b/.test(lower)) return false;
  if (isPrepTable(lower) || isOutdoorSideTable(lower) || isFoldingTable(lower) || isSofaConsoleTable(lower)) return false;
  if (/coffee\s*table|sofa\s*table|console\s*table|side\s*table|entry\s*console|work\s*table/.test(lower)) return false;
  if (/dining\s*table/.test(lower)) return true;
  if (/\bdining\b/.test(lower) && /\btable\b/.test(lower)) return true;
  return false;
}

/** Serving cart — serving + cart (not butcher). Never steal into Kitchen cart / Butcher block cart. */
export function isServingCart(lower: string) {
  if (/butcher/.test(lower)) return false;
  if (/serving\s*cart/.test(lower)) return true;
  return /serving/.test(lower) && /\bcart\b/.test(lower);
}

/** Butcher-block / kitchen cart — cart honesty; never naked Storage unit.
 * Serving cart is a separate stem (isServingCart) — do not steal serving → Kitchen cart. */
export function isButcherCart(lower: string) {
  if (isKitchenBase(lower) || /kitchen\s+island|\bisland\b/.test(lower)) return false;
  if (isServingCart(lower)) return false;
  if (/butcher\s*block\s*cart|butcher\s*cart|butcher\s*block/.test(lower)) return true;
  if (/kitchen\s+cart/.test(lower)) return true;
  if (/\bcart\b/.test(lower) && /butcher|block/.test(lower)) return true;
  return /\bcart\b/.test(lower) && /kitchen|butcher|prep/.test(lower) && !/serving/.test(lower);
}

/** Slot-rack class (plate / magazine / dish) — spoken slot densify like open-cubby dividers; never Storage. */
export function isPlateRack(lower: string) {
  if (/spice|wine|coat|shoe|towel|drying|lumber|tool|peg|laundry|pot/.test(lower)) return false;
  if (/plate\s*rack/.test(lower)) return true;
  if (/\bplates?\b/.test(lower) && /\brack\b/.test(lower)) return true;
  return false;
}

export function isMagazineRack(lower: string) {
  if (/spice|wine|coat|shoe|towel|drying|lumber|tool|peg/.test(lower)) return false;
  if (/magazine\s*rack/.test(lower)) return true;
  return /magazine/.test(lower) && /\brack\b/.test(lower);
}

/** Plate / magazine / dish racks that densify spoken N slots (universal slot class). */
export function isSlotRack(lower: string) {
  if (isPlateRack(lower) || isMagazineRack(lower)) return true;
  if (/spice|wine|coat|shoe|towel|drying|lumber|tool|peg|plate|magazine/.test(lower)) return false;
  if (/dish\s*rack/.test(lower)) return true;
  return false;
}

export function slotRackTitle(lower: string): string {
  if (isPlateRack(lower)) return "Plate rack";
  if (isMagazineRack(lower)) return "Magazine rack";
  if (/dish\s*rack/.test(lower)) return "Dish rack";
  return "Plate rack";
}

/** Open kitchen / fitted open shelving — never naked Storage unit. */
export function isOpenKitchenShelving(lower: string) {
  if (isKitchenBase(lower) || isKitchenUpper(lower) || isButcherCart(lower) || isServingCart(lower) || isSlotRack(lower)) return false;
  if (/kitchen\s+island|\bisland\b/.test(lower)) return false;
  if (/bookcase|bookshelf|spice|wine|medicine|coat|shoe|utility|laundry|drying|plate|magazine/.test(lower)) return false;
  if (/open\s+kitchen\s+shelving|kitchen\s+shelving|open\s+shelving/.test(lower)) return true;
  if (/shelving\s+niche|fitted[^.]{0,40}shelving|shelving[^.]{0,40}fitted|shelving[^.]{0,40}opening/.test(lower)) return true;
  if (/open\s+shel(?:f|ves|ving)/.test(lower) && /kitchen|fitted|opening|niche/.test(lower)) return true;
  return false;
}

/** Kitchen island — freestanding work island; never bare Island / Storage. */
export function isKitchenIsland(lower: string) {
  if (isKitchenBase(lower) || isPrepTable(lower) || isButcherCart(lower) || isServingCart(lower)) return false;
  return /kitchen\s+island|\bisland\b/.test(lower);
}

/** Twin/full/queen bunk — two sleep platforms on a frame, not a hollow box. */
export function isBunkBed(lower: string) {
  if (isLoftBed(lower)) return false;
  if (/raised (garden )?bed|garden box|flower bed|planter/.test(lower) && !/plant\s*stand|pot\s*stand/.test(lower)) return false;
  return /\bbunk\b|bunk\s*beds?|bunkbeds?/.test(lower);
}

/** Elevated single sleep platform on posts — bunk family, one deck. */
export function isLoftBed(lower: string) {
  if (/raised (garden )?bed|garden box|flower bed|planter/.test(lower) && !/plant\s*stand|pot\s*stand/.test(lower)) return false;
  return /\bloft\s*beds?\b/.test(lower);
}
/** Daybed — one sleep deck you can sit on; not a bunk/loft stack. */
export function isDaybed(lower: string) {
  if (isBunkBed(lower) || isLoftBed(lower)) return false;
  return /\bday\s*beds?\b/.test(lower);
}

/** Low platform bed — sleep deck on a low frame; never Yard House wire / craft platform. */
export function isPlatformBed(lower: string) {
  if (isBunkBed(lower) || isLoftBed(lower) || isDaybed(lower)) return false;
  if (/raised (garden )?bed|garden box|flower bed|planter/.test(lower) && !/plant\s*stand|pot\s*stand/.test(lower)) return false;
  const namedStock =
    /popsicle|craft\s*sticks?|toothpicks?|\bskewers?\b|\bstraws?\b|\bdowels?\b|\bpvc\b|plywood|\b[124]\s*[x×]\s*\d+|\bpine\b|\boak\b|\bcedar\b|\bwalnut\b|\bmaple\b|\bcherry\b|\bfir\b|\bspruce\b|\bpoplar\b|\bbamboo\b/.test(
      lower,
    );
  const mattressBed =
    /\b(?:bed\s*frames?|beds?)\b/.test(lower) &&
    /mattress|\bking\b|\bqueen\b|\btwin\b|\bfull\b|cal(?:ifornia)?\s*king/.test(lower) &&
    !namedStock &&
    !/doll|crib|headboard|\bdog\b|\bpet\b|\bcat\b|planter|garden/.test(lower);
  return (
    /platform\s*beds?\b/.test(lower) ||
    (/\bplatform\b/.test(lower) && /\bbeds?\b/.test(lower)) ||
    (/\bplatform\b/.test(lower) &&
      /mattress|\bking\b|\bqueen\b|\btwin\b|\bfull\b|cal(?:ifornia)?\s*king/.test(lower) &&
      !/plant|pot|monitor|umbrella|lamp|stand/.test(lower)) ||
    mattressBed
  );
}

/** Prompt asks to cradle a real book upright (envelope + lip, never a decal). */
export function wantsBookHold(lower: string) {
  return /holds?\s+a\s+real\s+book|book\s+upright|upright\s+book|book\s+envelope|cradles?\s+(?:a\s+)?book/.test(lower);
}

/** Prompt asks to cradle a real print / 5×7 upright (envelope + lip, never a decal). */
export function wantsPrintHold(lower: string) {
  return (
    /holds?\s+a\s+real\s+(?:5\s*[×x]\s*7\s+)?print|print\s+upright|upright\s+print|print\s+envelope|5\s*[×x]\s*7\s+print|cradles?\s+(?:a\s+)?print|photo\s+upright|frame\s+upright/.test(
      lower,
    )
  );
}

/** Bedside shelf — shallow shelf/envelope; never Nightstand drawers, never Picture ledge. */
export function isBedsideShelf(lower: string) {
  if (/nightstand/.test(lower) && /drawer/.test(lower)) return false;
  if (/picture\s*ledge|(?:photo|art)\s*ledge/.test(lower) && !/bedside/.test(lower)) return false;
  if (/bedside\s*shelf/.test(lower)) return true;
  if (/bedside/.test(lower) && /\bshelf\b/.test(lower)) return true;
  if (/bedside/.test(lower) && wantsBookHold(lower) && !/nightstand|drawer|table/.test(lower)) return true;
  if (/bedside/.test(lower) && wantsPrintHold(lower) && !/nightstand|drawer|table/.test(lower)) return true;
  return false;
}


/**
 * Climb / step-up stool identity — survives house-brief merge and Measure/stock densify.
 * Closet/linen with a climb step-shelf stays Closet (not Step stool). Bare benches stay Bench.
 */
export function climbIdentityLabel(lower: string): string | null {
  // Floor lamp / lamp stand is pot-hold — never climb lace / Step stool steal.
  if (isFloorLampStand(lower)) return null;
  // House carcase + mid climb step-shelf is an add-on — keep Closet / linen / desk titles.
  if (
    /linen|closet|wardrobe|pantry|bookcase|\bdesk\b|\bvanity\b|cabinet|mudroom|nightstand|dresser|alcove|built-?in|sideboard|buffet|credenza/.test(
      lower,
    )
  ) {
    return null;
  }
  // Real benches stay Bench — only climb/step stools claim this stem.
  if (/\bbench\b/.test(lower) && !/step-?up|climb\s+step|climb\s+stool|step\s*stool|two-?\s*step|three-?\s*step/.test(lower)) return null;
  const climbHay = lower.replace(/[″″]/g, '"').replace(/[–—]/g, "-");
  if (
    !/step-?up(?:\s+stool)?|step\s*stool|climb\s+step|climb\s+stool|climb(?:ing)?\s*triangle|pikler|step\s*triangle|two-?\s*step|three-?\s*step|each\s+step|one\s+climb\s+step|step-?shelf|rise\s*(?:[×xby]|and)\s*.*run|weight-bearing\s+climb|holds?\s+a\s+kid\s+standing|kid\s+stands|top\s+tread|three\s+treads|\d+\s*treads/.test(
      climbHay,
    )
  ) {
    return null;
  }
  if (/climb(?:ing)?\s*triangle|pikler|step\s*triangle/.test(climbHay)) return "Climb triangle";
  if (/step-?up|stool|two-?\s*step|three-?\s*step|climb\s+stool|each\s+step/.test(climbHay)) return "Step stool";
  if (/step-?shelf/.test(lower)) return "Step shelf";
  if (/\bladder\b/.test(lower)) return "Ladder";
  return "Step stool";
}

/**
 * Named sit identity — room/context qualifier + bench (or banquette / window seat)
 * must never collapse to naked "Bench". workbench stays on the desk path; bare
 * "bench" stays the program noun. Dining/Hall hold like Entry/Mudroom.
 */
const SIT_BENCH_ROOM = "dining|hall|entry|mudroom|coat|porch|patio|garden|boot|piano";

export function sitBenchTitleStem(lower: string): string | null {
  if (/window\s*seat/.test(lower)) return "Window seat";
  if (/banquette/.test(lower)) return "Banquette";
  if (/workbench/.test(lower) || isPottingBench(lower) || /potting/.test(lower)) return null;
  if (!/\bbench\b/.test(lower)) return null;
  // Boot tray bench before loose boot → Boot bench steal.
  if (isBootTrayBench(lower) || (/boot/.test(lower) && /tray/.test(lower))) return "Boot tray bench";
  // Book bin / bin bench — positive stem (never naked Bench).
  if (isBookBinBench(lower)) {
    if (/book/.test(lower)) return "Book bin bench";
    if (/toy/.test(lower)) return "Toy bin bench";
    return "Bin bench";
  }
  // Prefer adjacent "<room> bench" (dining bench, hall bench, entry bench, …).
  const adj = lower.match(new RegExp(`\\b(${SIT_BENCH_ROOM})\\s+bench\\b`));
  if (adj) {
    const w = adj[1];
    return w.charAt(0).toUpperCase() + w.slice(1) + " bench";
  }
  // Looser: room word anywhere + bench (legacy "entry … bench" / mudroom prompts).
  const loose = lower.match(new RegExp(`\\b(${SIT_BENCH_ROOM})\\b`));
  if (loose) {
    const w = loose[1];
    return w.charAt(0).toUpperCase() + w.slice(1) + " bench";
  }
  return null;
}

/**
 * Stable display stem from family detectors — used by parse + house-brief merge
 * so typed width cannot wipe "Base cabinet" down to naked "Storage".
 */
export function identityTitleStem(lower: string): string | null {
  // Floor lamp / lamp stand — pot-hold stem before Lattice / climb / Storage steals.
  if (isFloorLampStand(lower)) return floorLampTitleStem(lower);
  // Entry / mudroom class — positive stems before Coat rod / Storage / Bridge steals.
  if (isBootTrayBench(lower) || (/boot/.test(lower) && /tray/.test(lower) && /\bbench\b/.test(lower))) return "Boot tray bench";
  if (isBookBinBench(lower)) return sitBenchTitleStem(lower) || "Book bin bench";
  if (isToyChest(lower)) return "Toy chest";
  if (/\bhutch\b/.test(lower)) return /kitchen/.test(lower) ? "Kitchen hutch" : "Hutch";
  if (isHingedLidChest(lower)) return "Chest";
  if (isCoatCubbyWall(lower)) return "Coat and cubby wall";
  if (isKeyMailShelf(lower)) return "Key and mail shelf";
  if (isCoatHookBoard(lower)) return "Coat hook board";
  if (isLeashRail(lower)) return "Leash rail";
  if (isPegRail(lower)) return "Peg rail";
  if (isPrinterStand(lower)) return "Printer stand";
  if (isFilingShelf(lower)) return "Filing shelf";
  // Kitchen-typed base keeps "Kitchen base" stem (not bare Base cabinet only).
  if (isKitchenBase(lower)) return /kitchen/.test(lower) ? "Kitchen base" : "Base cabinet";
  if (isKitchenUpper(lower)) return "Upper cabinet";
  // Kitchen work / island class pack — positive stems, never naked Table / Island / Storage.
  if (isKitchenIsland(lower)) return "Kitchen island";
  if (isPrepTable(lower)) return "Prep table";
  if (isServingCart(lower)) return "Serving cart";
  if (isButcherCart(lower)) {
    if (/butcher/.test(lower)) return "Butcher block cart";
    return "Kitchen cart";
  }
  if (isDiningTable(lower)) return "Dining table";
  if (/changing(?:\s*pad)?\s*tables?/.test(lower)) return "Changing table";
  if (isSlotRack(lower)) return slotRackTitle(lower);
  if (isOpenKitchenShelving(lower)) {
    if (/open\s+kitchen\s+shelving|kitchen\s+shelving/.test(lower)) return "Open kitchen shelving";
    return "Open shelving";
  }
  if (isLoftBed(lower)) return "Loft bed";
  if (isBunkBed(lower)) return "Bunk bed";
  if (isLaundryFoldDown(lower)) return "Laundry fold-down";
  // Sit family: Window seat / Banquette / Dining·Hall·Entry·Mudroom·Coat bench — never naked Bench.
  const sitStem = sitBenchTitleStem(lower);
  if (sitStem) return sitStem;
  if (isRadiatorCover(lower)) return "Radiator cover";
  if (isDaybed(lower)) return "Daybed";
  if (isPlatformBed(lower)) return "Platform bed";
  if (isBedsideShelf(lower)) return "Bedside shelf";
  if (isSofaConsoleTable(lower)) {
    if (/sofa\s*table/.test(lower)) return "Sofa table";
    if (/entry\s*console/.test(lower)) return "Entry console";
    return "Console table";
  }
  // Laundry / utility class — positive stems; never naked Table / Storage / Yard House wire.
  if (isFoldingTable(lower)) return "Folding table";
  if (isLaundrySorter(lower)) return "Laundry sorter";
  if (isDryingRack(lower)) return "Drying rack";
  if (isUtilityShelf(lower)) return "Utility shelf";
  if (isIroningWallMount(lower)) return "Ironing board wall mount";
  // Potting / outdoor work top — before sit Bench steal (bench noun in the name).
  if (isPottingBench(lower)) return "Potting bench";
  // Outdoor / porch class — positive stems before Bench / Table / Closet steals.
  if (isPorchSwingFrame(lower)) return "Porch swing frame";
  if (isPlanterBox(lower)) return "Planter box";
  // Seating lounge class — before Adirondack / naked Chair steals.
  if (isRockingChair(lower)) return "Rocking chair";
  if (isLoungeChair(lower)) return "Lounge chair";
  if (isOttoman(lower)) return "Ottoman";
  if (isAdirondackChair(lower)) return "Adirondack chair";
  if (isOutdoorSideTable(lower)) return "Outdoor side table";
  // Garage / shop class — positive stems before Desk / Storage / portal steals.
  if (isWorkbench(lower)) return "Workbench";
  if (isPegboard(lower)) return "Pegboard";
  if (isToolRail(lower)) return "Tool rail";
  if (isLumberRack(lower)) return "Lumber rack";
  // Desk / vanity work surfaces win over a trailing "media shelf" add-on.
  if (/\bdesk\b|work table/.test(lower)) return "Desk";
  if (/\bvanity\b/.test(lower)) return "Vanity";
  // Chest / File cabinet — never naked Storage unit (medicine chest stays Medicine cabinet via hung path).
  if (/file\s*cabinet|filing\s*cabinet|\bfiling\b/.test(lower)) return "File cabinet";
  if (/\bchest\b/.test(lower) && !/medicine/.test(lower)) return /toy/.test(lower) ? "Toy chest" : "Chest";
  if (/\bdresser\b/.test(lower)) return "Dresser";
  // Nightstand only when not a bedside shelf (shelf / book envelope stays Bedside shelf).
  if (/nightstand/.test(lower) || (/bedside/.test(lower) && !isBedsideShelf(lower))) return "Nightstand";
  // Climb/step stools before media — "reach a shelf" must not become Media/Bench.
  const climb = climbIdentityLabel(lower);
  if (climb) return climb;
  if (isShoePortalCubbies(lower)) return "Shoe cubbies";
  if (isShoePortalRail(lower)) return "Shoe rail";
  if (isTowelPortalRail(lower)) return towelPortalWantsHooks(lower) ? "Towel + hook rail" : "Towel rail";
  if (isPortalSpanShelf(lower)) return portalSpanShelfTitle(lower);
  if (isPortalHookRail(lower)) return portalHookRailTitle(lower);
  if (isOpenCubbyWall(lower) || isMudroomCubbyWall(lower)) return openCubbyWallTitle(lower);
  // Coat rod/rail spanning a door portal — not a shelving niche / storage unit.
  if (/coat/.test(lower) && /rod|rail|rack|tree|peg|hook/.test(lower) && isDoorPortal(lower)) {
    return /rod/.test(lower) ? "Coat rod" : /rail/.test(lower) ? "Coat rail" : "Coat rack";
  }
  if (/coat/.test(lower) && /rod|rail|rack|tree|peg|hook/.test(lower)) {
    return /rod/.test(lower) ? "Coat rod" : /rail/.test(lower) ? "Coat rail" : "Coat rack";
  }
  if (wantsShoes(lower)) return "Shoe rack";
  if (isPictureLedge(lower)) return pictureLedgeTitleStem(lower);
  const media = mediaIdentityLabel(lower);
  if (media) return media;
  // Linen closet keeps Linen stem — never bare Closet (Entry bench pattern).
  if (/\blinen\b/.test(lower)) return "Linen";
  // Bookcase / floating shelf stems — densify Assumed klass (never naked Storage unit).
  if (/bookcase|bookshelf/.test(lower)) return "Bookcase";
  if (/floating/.test(lower) && /shelves/.test(lower)) return "Floating shelves";
  if (/floating/.test(lower) && /shelf/.test(lower)) return "Floating shelf";
  return null;
}

/** Keep TV / media / stereo / AV / shelf / ledge identity — never naked Media or Storage. */
export function mediaIdentityLabel(lower: string): string | null {
  // Sofa / entry / console tables are tables — never steal Media console identity.
  if (isSofaConsoleTable(lower)) return null;
  // Desk with a media shelf behind stays a desk (knee clear), not a media console.
  if (/\bdesk\b|workbench|\bvanity\b/.test(lower)) return null;
  // Stereo / AV before generic media — never Storage unit / lattice tower.
  if (isStereoCabinet(lower)) return "Stereo cabinet";
  if (isAvTower(lower)) return "AV tower";
  // Media shelf / ledge beat console — and beat "TV" stolen from "TV stand footprint".
  if (isWallMediaLedge(lower)) return "Media ledge";
  if (isMediaShelf(lower) || (wantsSoundbarHold(lower) && /shelf|ledge/.test(lower))) return "Media shelf";
  if (
    !/\bmedia\b|\btv\b|console|sideboard|buffet|credenza|entertainment|\bstereo\b|soundbar/.test(lower) &&
    !isAvTower(lower)
  ) {
    return null;
  }
  if (/entertainment\s*cent(?:er|re)/.test(lower)) return "Entertainment center";
  if (/\btv\b/.test(lower) && /console/.test(lower)) return "TV console";
  if (/media\s*console/.test(lower)) return "Media console";
  if (/sideboard/.test(lower)) return "Sideboard";
  if (/buffet/.test(lower)) return "Buffet";
  if (/credenza/.test(lower)) return "Credenza";
  // "55 TV stand footprint clear below" is hold language on a ledge — not a TV console.
  if (/\btv\b/.test(lower) && /stand\s+footprint|footprint\s+clear|clear below/.test(lower) && !/console/.test(lower)) {
    return null;
  }
  if (/\btv\b/.test(lower)) return "TV console";
  if (/console/.test(lower)) return "Media console";
  if (/\bmedia\b/.test(lower)) return "Media console";
  return null;
}

function programFromNoun(lower: string): FittedProgram {
  if (isStorageHutch(lower)) return "storage";
  if (isPlanterBox(lower)) return "storage";
  if (isOttoman(lower)) return "bench";
  if (isLoungeChair(lower) || isRockingChair(lower)) return "bench";
  if (isOutdoorSideTable(lower)) return "table";
  if (isPottingBench(lower) || /\bdesk\b|workbench|work table/.test(lower)) return "desk";
  if (isMedicine(lower) || isOverToilet(lower) || isSpiceRack(lower) || isWineRack(lower)) return "storage";
  if (/\bvanity\b|\bsink\b/.test(lower)) return "vanity";
  if (/bookcase|bookshelf|\bbooks\b/.test(lower)) return "bookcase";
  if (/pantry/.test(lower)) return "pantry";
  if (/wardrobe/.test(lower)) return "wardrobe";
  if (isBedsideShelf(lower)) return "storage";
  if (/nightstand/.test(lower) || (/bedside/.test(lower) && !isBedsideShelf(lower))) return "storage";
  if (isSofaConsoleTable(lower)) return "table";
  if (isPlatformBed(lower)) return "storage";
  if (isDaybed(lower)) return "bench";
  if (isPrepTable(lower) || isFoldingTable(lower) || isDiningTable(lower)) return "table";
  if (isSlotRack(lower) || isServingCart(lower) || isButcherCart(lower)) return "storage";
  if (/\btable\b/.test(lower) && !/work table/.test(lower)) return "table";
  if (
    /\bmedia\b|\btv\b|console|sideboard|buffet|credenza|entertainment|\bstereo\b|soundbar/.test(lower) ||
    isAvTower(lower) ||
    isStereoCabinet(lower) ||
    isWallMediaLedge(lower) ||
    isMediaShelf(lower)
  ) {
    return "media";
  }
  if (isCoatCubbyWall(lower) || isOpenCubbyWall(lower) || isMudroomCubbyWall(lower)) return "storage";
  if (isKeyMailShelf(lower) || isLeashRail(lower) || isPegRail(lower) || isPrinterStand(lower) || isFilingShelf(lower)) return "storage";
  if (/\bmudroom\b|window seat|day\s*bed|banquette/.test(lower)) return "bench";
  if (/\bcloset\b|linen|alcove|built-?in|closet system|storage system/.test(lower)) return "closet";
  if (/\bbench\b/.test(lower) && !/workbench/.test(lower) && !isPottingBench(lower)) return "bench";
  if (/bathroom/.test(lower) && !/closet|linen|alcove|medicine|toilet/.test(lower)) return "vanity";
  return "storage";
}

/**
 * Classify a prompt into a house family, or null when this is not a house build
 * (window, chair, popsicle Eiffel, garden arch, …).
 */
export function detectHouseFamily(prompt: string): HouseHit | null {
  const lower = prompt.toLowerCase();
  if (isNotHouse(lower)) return null;
  // Weekend craft tip-hold / soft-launch — never a house ledge or portal noun.
  // House media ledge + tip-rail picture/photo/art ledge / picture rail stay hung-open:
  // bare "print" must not match inside "footprint".
  if (
    isWallMediaLedge(lower) ||
    isPictureLedge(lower) ||
    isHouseMediaCarcase(lower) ||
    isBedsideShelf(lower) ||
    isPlatformBed(lower)
  ) {
    // keep house path
  } else if (
    (/\bledge\b/.test(lower) && /(?:\bprint\b|tip|lean|popsicle|craft|weekend)/.test(lower) && !isPictureLedge(lower)) ||
    (/soft-?launch|leaves?\s+free|(?:paper\s*)?plane.{0,40}\bramp\b/.test(lower) && /weekend|craft|popsicle|cedar|marble/.test(lower))
  ) {
    return null;
  }
  if (
    !HOUSE_NOUN.test(lower) &&
    !wantsJars(lower) &&
    !wantsBottles(lower) &&
    !isOverToilet(lower) &&
    !isTowelPortalRail(lower) &&
    !isShoePortalRail(lower) &&
    !isShoePortalCubbies(lower) &&
    !isPortalHookRail(lower) &&
    !isPortalSpanShelf(lower) &&
    !isPegboard(lower) &&
    !isToolRail(lower) &&
    !isLeashRail(lower) &&
    !isPegRail(lower) &&
    !isKeyMailShelf(lower) &&
    !isPrinterStand(lower) &&
    !isFilingShelf(lower) &&
    !isCoatCubbyWall(lower) &&
    !isLumberRack(lower) &&
    !isWorkbench(lower) &&
    !isPottingBench(lower) &&
    !isLaundrySorter(lower) &&
    !isFoldingTable(lower) &&
    !isDryingRack(lower) &&
    !isUtilityShelf(lower) &&
    !isIroningWallMount(lower) &&
    !isPlanterBox(lower) &&
    !isPlatformBed(lower) &&
    !isSeatingLoungeClass(lower) &&
    !isOutdoorSideTable(lower) &&
    !isToyChest(lower) &&
    !isHingedLidChest(lower) &&
    !isBookBinBench(lower) &&
    !isPictureLedge(lower) &&
    !/ironing/.test(lower)
  ) {
    return null;
  }

  // Coat + bench is a floor seat with a peg rail — not a wall-only coat rack.
  const coatBench = /coat/.test(lower) && /bench/.test(lower);

  const fold = isIroning(lower) || isFoldDown(lower);

  const wallLang =
    !coatBench &&
    !isCoatCubbyWall(lower) &&
    (/wall[- ]?hung|wall[- ]?mount|hang(?:s|ing)? on (?:the )?wall|floating|wall[- ]?(?:shelf|shelves|rack|cabinet|cubb|organizer|ledge)|wall.{0,28}(?:media\s*)?ledge|media\s*ledge|on the wall|wall\b.{0,24}\bcabinet\b/.test(
      lower,
    ) ||
      isWallMediaLedge(lower) ||
      isKitchenUpper(lower) ||
      isSpiceRack(lower) ||
      isWineRack(lower) ||
      isMedicine(lower) ||
      isIroning(lower) ||
      fold ||
      (/coat/.test(lower) && /rack|rail|rod|tree|peg|hook/.test(lower)) ||
      /hall\s*tree|coat\s*tree|entry\s*tree/.test(lower) ||
      /range\s*hood|kitchen\s*hood|extractor\s*hood/.test(lower) ||
      (/\bhood\b/.test(lower) && !/child|robin|likelihood/.test(lower)) ||
      (wantsJars(lower) && /shelf|rack|ledge/.test(lower)) ||
      (wantsBottles(lower) && /shelf|rack/.test(lower)) ||
      isTowelPortalRail(lower) ||
      isShoePortalRail(lower) ||
      isShoePortalCubbies(lower) ||
      isPortalHookRail(lower) ||
      isPortalSpanShelf(lower) ||
      isBedsideShelf(lower) ||
      isPictureLedge(lower) ||
      isPegboard(lower) ||
      isToolRail(lower) ||
      isLeashRail(lower) ||
      isPegRail(lower) ||
      isKeyMailShelf(lower) ||
      isIroningWallMount(lower));

  const mount: HouseMount = isOverToilet(lower) ? "straddle" : wallLang ? "wall" : "floor";

  const sit =
    isDaybed(lower) ||
    isSeatingLoungeClass(lower) ||
    ((/\bbench\b|window seat|mudroom|banquette|\bseat\b/.test(lower) &&
      !/workbench/.test(lower) &&
      !isPottingBench(lower) &&
      !isPorchSwingFrame(lower) &&
      !isAdirondackChair(lower) &&
      !isSeatingLoungeClass(lower) &&
      !isMudroomCubbyWall(lower) &&
      !isOpenCubbyWall(lower)));
  const work =
    (isPottingBench(lower) ||
      (/\bdesk\b|workbench|work table|\bvanity\b|\bsink\b|island|ironing|\btable\b/.test(lower) &&
        !/console table|sofa table|entry console|bedside table|night table/.test(lower)));
  const hangUse =
    (/coat/.test(lower) && /rack|rail|rod|hook|peg/.test(lower)) ||
    (/closet|wardrobe/.test(lower) && /rod|hang/.test(lower)) ||
    isPortalHookRail(lower) ||
    isTowelPortalRail(lower) ||
    isToolRail(lower) ||
    isLeashRail(lower) ||
    isPegRail(lower) ||
    isKeyMailShelf(lower);
  const use: HouseUse = sit ? "sit" : work ? "work" : hangUse ? "hang" : "store";

  const door =
    (/door/.test(lower) && !isDoorPortal(lower)) ||
    isMedicine(lower) ||
    isIroning(lower) ||
    fold ||
    /crate/.test(lower) ||
    (/cabinet/.test(lower) && !isOverToilet(lower) && !/spice|wine/.test(lower)) ||
    (/closet|pantry|wardrobe/.test(lower) && !/coat/.test(lower));
  const opening: HouseOpening = isBunkBed(lower) ? "open" : fold ? "fold-down" : door ? "door" : "open";

  const program = programFromNoun(lower);

  let family: HouseFamily;
  if (mount === "straddle" || isOverToilet(lower)) family = "straddle";
  else if (isBunkBed(lower) || isLoftBed(lower)) family = "bunk";
  else if (isPlatformBed(lower)) family = "bunk";
  else if (isDaybed(lower)) family = "seat";
  else if (/headboard/.test(lower) || isPegboard(lower)) family = "slab";
  else if (isCoatHookBoard(lower) || isToolRail(lower) || isLeashRail(lower) || isPegRail(lower) || isKeyMailShelf(lower) || isIroningWallMount(lower) || isPictureLedge(lower)) family = "hung-open";
  else if (isCoatCubbyWall(lower) || isOpenCubbyWall(lower) || isMudroomCubbyWall(lower)) family = "floor-carcase";
  else if (isDryingRack(lower) || isLaundrySorter(lower) || isUtilityShelf(lower) || isLumberRack(lower)) {
    family = "floor-carcase";
  }
  // Fold-down is a hung board in a shallow cabinet — not a freestanding table,
  // even if someone said "fold-down table". "Laundry folding table" stays table
  // because isFoldDown requires fold-down / drop-down, not "folding".
  else if (fold && !isFoldingTable(lower) && !isIroningWallMount(lower)) family = "hung-cabinet";
  else if (program === "table" || isFoldingTable(lower)) family = "table";
  else if (program === "bench" || (sit && !/vanity|desk/.test(lower))) family = "seat";
  else if (mount === "wall") family = opening === "open" ? "hung-open" : "hung-cabinet";
  else family = "floor-carcase";

  const affordances: HouseAffordance[] = [];
  const add = (a: HouseAffordance) => {
    if (!affordances.includes(a)) affordances.push(a);
  };
  if (wantsJars(lower) || isSpiceRack(lower)) add("jar-lips");
  if (wantsBottles(lower) || isWineRack(lower)) add("bottle-rails");
  if ((fold || isIroning(lower)) && !isIroningWallMount(lower)) add("fold-down-board");
  if (!isDaybed(lower) && !isSeatingLoungeClass(lower) && (program === "bench" || /cubb/.test(lower) || (sit && family === "seat"))) add("cubbies");
  // Floor shoe storage → cubbies / open bays (not bookcase pin shelves).
  if (wantsShoes(lower) && (family === "floor-carcase" || family === "seat" || /rack|cubb/.test(lower))) {
    add("cubbies");
  }
  // Hung-open + jars/bottles already flagged above; keep lips/rails on novel wall shelves.
  if (family === "hung-open" && wantsJars(lower)) add("jar-lips");
  if (family === "hung-open" && wantsBottles(lower)) add("bottle-rails");
  if (opening === "door" || door) add("door");
  if (
    /rod|hang/.test(lower) ||
    program === "wardrobe" ||
    (program === "closet" && /system|walk-?in|along the wall|wall of closets/.test(lower) && !/linen|towel/.test(lower))
  ) {
    add("hanging-rods");
  }
  if (/mirror/.test(lower) || program === "vanity" || isMedicine(lower)) add("mirror");
  if (
    /drawer/.test(lower) ||
    program === "vanity" ||
    (program === "desk" && !isStandingShopTop(lower)) ||
    (isStandingShopTop(lower) && /drawer/.test(lower)) ||
    (/nightstand/.test(lower) && !isBedsideShelf(lower)) ||
    (/bedside/.test(lower) && !isBedsideShelf(lower)) ||
    /dresser/.test(lower)
  ) {
    add("drawers");
  }
  // Storage-hutch class densifies lower cabinet doors (not dresser drawer bank).
  if (isStorageHutch(lower)) add("door");
  if (
    (/coat/.test(lower) && /rack|rail|rod|hook|peg|bench|tree/.test(lower)) ||
    /hook|peg rail|coat\s*rail|coat\s*rod/.test(lower) ||
    /hall\s*tree|entry\s*tree/.test(lower) ||
    (/coat/.test(lower) && /bench/.test(lower)) ||
    isPortalHookRail(lower) ||
    isToolRail(lower)
  ) {
    add("hooks");
  }
  if (
    (/floating/.test(lower) && /shel/.test(lower)) ||
    (/wall/.test(lower) && /shel(?:f|ves)\b/.test(lower) && !/cabinet|jar|spice|wine|bottle/.test(lower)) ||
    isWallMediaLedge(lower) ||
    isPictureLedge(lower) ||
    (/\bledge\b/.test(lower) && /\bmedia\b/.test(lower)) ||
    isPortalSpanShelf(lower) ||
    isBedsideShelf(lower)
  ) {
    add("cleats");
  }
  if (family === "bunk" || isBunkBed(lower) || isLoftBed(lower) || isDaybed(lower) || isPlatformBed(lower)) add("sleep-platforms");
  if (isHingedLidChest(lower)) add("hinged-lid");

  return { family, mount, use, opening, affordances, program };
}

export function houseFamilyOf(prompt: string): HouseFamily | null {
  return detectHouseFamily(prompt)?.family ?? null;
}
