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
  | "sleep-platforms";

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
  /vanity|closet|cabinet|cabinetry|desk|bookcase|bookshelf|pantry|wardrobe|built-?in|alcove|linen|mudroom|workbench|nightstand|bedside|dresser|media cons|console|\btv\b|sideboard|credenza|hutch|island|\btable\b|shelves|\bshelf\b|\bledge\b|drawer|storage|\bbench\b|\bseat\b|banquette|\brack\b|crate|headboard|bunk|loft\s*bed|platform\s*beds?|shoe|coat|hall\s*tree|coat\s*tree|entry\s*tree|range\s*hood|kitchen\s*hood|\bhood\b|cubb|organizer|etagere|étagère|space[- ]?saver|over[- ]?(the[- ]?)?toilet|fold[- ]?down|drop[- ]?down|\blaundry\b|radiator|\bday\s*beds?\b|\bstereo\b|soundbar|(?:\bav\b|a\.?\s*v\.?)\s*tower|media\s*tower|entertainment/;

function isWindowPrompt(lower: string) {
  if (/window seat/.test(lower)) return false;
  if (/andersen|rough opening/.test(lower)) return true;
  if (/\bwindow\b/.test(lower) && !/cabinet|box|seat/.test(lower)) return true;
  return false;
}

function isNotHouse(lower: string) {
  if (isWindowPrompt(lower)) return true;
  if (/eiffel|taj|mahal|pyramid|giraffe|rocket|looks like|lattice tower/.test(lower)) return true;
  if (
    /popsicle|craft stick|toothpick|paper towel|lego|mailing tube|cedar/.test(lower) &&
    (!HOUSE_NOUN.test(lower) ||
      /(?:picture|photo|art)\s*ledge|\bpicture\s*ledge\b|soft-?launch|leaves?\s+free|(?:paper\s*)?plane.{0,40}\bramp\b/.test(lower))
  ) {
    return true;
  }
  if (/\bchair\b|\bstool\b/.test(lower) && !/desk|vanity|\btable\b/.test(lower)) return true;
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
  if (/planter|raised (garden )?bed|garden box/.test(lower) && !/plant\s*stand|pot\s*stand/.test(lower)) return true;
  // Bridge spans only — a shelf/rail spanning a door portal stays house hung-open.
  if (/bridge|viaduct|overpass|trestle/.test(lower)) return true;
  if (/(?:\bspan\b|spanning)/.test(lower) && !/door\s*portal|portal|doorway|door opening|wall\s*span/.test(lower)) {
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
  if (isWallMediaLedge(lower) || isMediaShelf(lower) || isStereoCabinet(lower) || isAvTower(lower)) return true;
  if (wantsSoundbarHold(lower) && /shelf|ledge|console|cabinet|media/.test(lower)) return true;
  if (/\bmedia\b|\btv\b/.test(lower) && /console|cabinet|sideboard|credenza|entertainment/.test(lower)) return true;
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
  if (/round|circular|diameter|\bdia\b/.test(lower)) return "round";
  if (/\bsquare\b/.test(lower)) return "square";
  if (/\brect(?:angle)?\b|\brectangular\b/.test(lower)) return "rect";
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

/** Door portal / doorway / door opening envelope (fitted hang — not a garden arch). */
export function isDoorPortal(lower: string) {
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
  if (!isDoorPortal(lower)) return false;
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
  return /platform\s*beds?\b/.test(lower) || (/\bplatform\b/.test(lower) && /\bbeds?\b/.test(lower));
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
  // House carcase + mid climb step-shelf is an add-on — keep Closet / linen / desk titles.
  if (
    /linen|closet|wardrobe|pantry|bookcase|\bdesk\b|\bvanity\b|cabinet|mudroom|nightstand|dresser|alcove|built-?in|sideboard|credenza/.test(
      lower,
    )
  ) {
    return null;
  }
  // Real benches stay Bench — only climb/step stools claim this stem.
  if (/\bbench\b/.test(lower) && !/step-?up|climb\s+step|climb\s+stool|step\s*stool|two-?\s*step|three-?\s*step/.test(lower)) return null;
  const climbHay = lower.replace(/[″″]/g, '"').replace(/[–—]/g, "-");
  if (
    !/step-?up(?:\s+stool)?|step\s*stool|climb\s+step|climb\s+stool|two-?\s*step|three-?\s*step|each\s+step|one\s+climb\s+step|step-?shelf|rise\s*(?:[×xby]|and)\s*.*run|weight-bearing\s+climb|holds?\s+a\s+kid\s+standing|kid\s+stands|top\s+tread/.test(
      climbHay,
    )
  ) {
    return null;
  }
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
  if (/workbench/.test(lower)) return null;
  if (!/\bbench\b/.test(lower)) return null;
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
  // Kitchen-typed base keeps "Kitchen base" stem (not bare Base cabinet only).
  if (isKitchenBase(lower)) return /kitchen/.test(lower) ? "Kitchen base" : "Base cabinet";
  if (isKitchenUpper(lower)) return "Upper cabinet";
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
  // Desk / vanity work surfaces win over a trailing "media shelf" add-on.
  if (/\bdesk\b|workbench|work table/.test(lower)) return "Desk";
  if (/\bvanity\b/.test(lower)) return "Vanity";
  // Chest / File cabinet — never naked Storage unit (medicine chest stays Medicine cabinet via hung path).
  if (/file\s*cabinet|filing\s*cabinet|\bfiling\b/.test(lower)) return "File cabinet";
  if (/\bchest\b/.test(lower) && !/medicine/.test(lower)) return "Chest";
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
  if (isMudroomCubbyWall(lower)) return "Mudroom cubbies";
  // Coat rod/rail spanning a door portal — not a shelving niche / storage unit.
  if (/coat/.test(lower) && /rod|rail|rack|tree|peg|hook/.test(lower) && isDoorPortal(lower)) {
    return /rod/.test(lower) ? "Coat rod" : /rail/.test(lower) ? "Coat rail" : "Coat rack";
  }
  if (/coat/.test(lower) && /rod|rail|rack|tree|peg|hook/.test(lower)) {
    return /rod/.test(lower) ? "Coat rod" : /rail/.test(lower) ? "Coat rail" : "Coat rack";
  }
  if (wantsShoes(lower)) return "Shoe rack";
  const media = mediaIdentityLabel(lower);
  if (media) return media;
  // Linen closet keeps Linen stem — never bare Closet (Entry bench pattern).
  if (/\blinen\b/.test(lower)) return "Linen";
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
    !/\bmedia\b|\btv\b|console|sideboard|credenza|entertainment|\bstereo\b|soundbar/.test(lower) &&
    !isAvTower(lower)
  ) {
    return null;
  }
  if (/entertainment\s*cent(?:er|re)/.test(lower)) return "Entertainment center";
  if (/\btv\b/.test(lower) && /console/.test(lower)) return "TV console";
  if (/media\s*console/.test(lower)) return "Media console";
  if (/sideboard/.test(lower)) return "Sideboard";
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
  if (/\bdesk\b|workbench|work table/.test(lower)) return "desk";
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
  if (/\btable\b/.test(lower) && !/work table/.test(lower)) return "table";
  if (
    /\bmedia\b|\btv\b|console|sideboard|credenza|entertainment|\bstereo\b|soundbar/.test(lower) ||
    isAvTower(lower) ||
    isStereoCabinet(lower) ||
    isWallMediaLedge(lower) ||
    isMediaShelf(lower)
  ) {
    return "media";
  }
  if (isMudroomCubbyWall(lower)) return "storage";
  if (/\bmudroom\b|window seat|day\s*bed|banquette/.test(lower)) return "bench";
  if (/\bcloset\b|linen|alcove|built-?in|closet system|storage system/.test(lower)) return "closet";
  if (/\bbench\b/.test(lower) && !/workbench/.test(lower)) return "bench";
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
  // House media ledge (wall media + TV stand footprint clear below) stays house:
  // bare "print" must not match inside "footprint".
  if (isWallMediaLedge(lower) || isHouseMediaCarcase(lower) || isBedsideShelf(lower) || isPlatformBed(lower)) {
    // keep house path
  } else if (
    /(?:picture|photo|art)\s*ledge|\bpicture\s*ledge\b/.test(lower) ||
    (/\bledge\b/.test(lower) && /(?:\bprint\b|tip|lean|popsicle|craft|weekend)/.test(lower)) ||
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
    !isPortalSpanShelf(lower)
  ) {
    return null;
  }

  // Coat + bench is a floor seat with a peg rail — not a wall-only coat rack.
  const coatBench = /coat/.test(lower) && /bench/.test(lower);

  const fold = isIroning(lower) || isFoldDown(lower);

  const wallLang =
    !coatBench &&
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
      isBedsideShelf(lower));

  const mount: HouseMount = isOverToilet(lower) ? "straddle" : wallLang ? "wall" : "floor";

  const sit =
    isDaybed(lower) ||
    ((/\bbench\b|window seat|mudroom|banquette|\bseat\b/.test(lower) && !/workbench/.test(lower) && !isMudroomCubbyWall(lower)));
  const work =
    (/\bdesk\b|workbench|work table|\bvanity\b|\bsink\b|island|ironing|\btable\b/.test(lower) &&
      !/console table|sofa table|entry console|bedside table|night table/.test(lower));
  const hangUse =
    (/coat/.test(lower) && /rack|rail|rod|hook|peg/.test(lower)) ||
    (/closet|wardrobe/.test(lower) && /rod|hang/.test(lower)) ||
    isPortalHookRail(lower) ||
    isTowelPortalRail(lower);
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
  else if (/headboard/.test(lower)) family = "slab";
  // Fold-down is a hung board in a shallow cabinet — not a freestanding table,
  // even if someone said "fold-down table". "Laundry folding table" stays table
  // because isFoldDown requires fold-down / drop-down, not "folding".
  else if (fold) family = "hung-cabinet";
  else if (program === "table") family = "table";
  else if (program === "bench" || (sit && !/vanity|desk/.test(lower))) family = "seat";
  else if (mount === "wall") family = opening === "open" ? "hung-open" : "hung-cabinet";
  else family = "floor-carcase";

  const affordances: HouseAffordance[] = [];
  const add = (a: HouseAffordance) => {
    if (!affordances.includes(a)) affordances.push(a);
  };
  if (wantsJars(lower) || isSpiceRack(lower)) add("jar-lips");
  if (wantsBottles(lower) || isWineRack(lower)) add("bottle-rails");
  if (fold || isIroning(lower)) add("fold-down-board");
  if (!isDaybed(lower) && (program === "bench" || /cubb/.test(lower) || (sit && family === "seat"))) add("cubbies");
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
    program === "desk" ||
    (/nightstand/.test(lower) && !isBedsideShelf(lower)) ||
    (/bedside/.test(lower) && !isBedsideShelf(lower)) ||
    /dresser|hutch/.test(lower)
  ) {
    add("drawers");
  }
  if (
    (/coat/.test(lower) && /rack|rail|rod|hook|peg|bench|tree/.test(lower)) ||
    /hook|peg rail|coat\s*rail|coat\s*rod/.test(lower) ||
    /hall\s*tree|entry\s*tree/.test(lower) ||
    (/coat/.test(lower) && /bench/.test(lower)) ||
    isPortalHookRail(lower)
  ) {
    add("hooks");
  }
  if (
    (/floating/.test(lower) && /shel/.test(lower)) ||
    (/wall/.test(lower) && /shel(?:f|ves)\b/.test(lower) && !/cabinet|jar|spice|wine|bottle/.test(lower)) ||
    isWallMediaLedge(lower) ||
    (/\bledge\b/.test(lower) && /\bmedia\b/.test(lower)) ||
    isPortalSpanShelf(lower) ||
    isBedsideShelf(lower)
  ) {
    add("cleats");
  }
  if (family === "bunk" || isBunkBed(lower) || isLoftBed(lower) || isDaybed(lower) || isPlatformBed(lower)) add("sleep-platforms");

  return { family, mount, use, opening, affordances, program };
}

export function houseFamilyOf(prompt: string): HouseFamily | null {
  return detectHouseFamily(prompt)?.family ?? null;
}
