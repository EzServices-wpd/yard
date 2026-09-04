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
  | "cleats";

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
  /vanity|closet|cabinet|cabinetry|desk|bookcase|bookshelf|pantry|wardrobe|built-?in|alcove|linen|mudroom|workbench|nightstand|bedside|dresser|media cons|console|\btv\b|sideboard|credenza|hutch|island|\btable\b|shelves|\bshelf\b|\bledge\b|drawer|storage|\bbench\b|\bseat\b|\brack\b|crate|headboard|shoe|coat|range\s*hood|kitchen\s*hood|\bhood\b|cubb|organizer|etagere|étagère|space[- ]?saver|over[- ]?(the[- ]?)?toilet/;

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
    /popsicle|craft stick|toothpick|paper towel|lego|mailing tube/.test(lower) &&
    !HOUSE_NOUN.test(lower)
  ) {
    return true;
  }
  if (/\bchair\b|\bstool\b/.test(lower) && !/desk|vanity|\btable\b/.test(lower)) return true;
  if (/ladder|stairs|staircase/.test(lower)) return true;
  if (/birdhouse/.test(lower)) return true;
  if (/planter|raised (garden )?bed|garden box/.test(lower)) return true;
  if (/bridge|span|viaduct|overpass|trestle/.test(lower)) return true;
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
  return /rack|store|storage|cubb|organizer/.test(lower);
}

/** Keep TV / media console identity — never a naked "Media". */
export function mediaIdentityLabel(lower: string): string | null {
  if (!/\bmedia\b|\btv\b|console|sideboard|credenza|entertainment/.test(lower)) return null;
  if (/entertainment\s*cent(?:er|re)/.test(lower)) return "Entertainment center";
  if (/\btv\b/.test(lower) && /console/.test(lower)) return "TV console";
  if (/media\s*console/.test(lower)) return "Media console";
  if (/sideboard/.test(lower)) return "Sideboard";
  if (/credenza/.test(lower)) return "Credenza";
  if (/\btv\b/.test(lower)) return "TV console";
  if (/console/.test(lower)) return "Media console";
  return "Media console";
}

function programFromNoun(lower: string): FittedProgram {
  if (/\bdesk\b|workbench|work table/.test(lower)) return "desk";
  if (isMedicine(lower) || isOverToilet(lower) || isSpiceRack(lower) || isWineRack(lower)) return "storage";
  if (/\bvanity\b|\bsink\b/.test(lower)) return "vanity";
  if (/bookcase|bookshelf|\bbooks\b/.test(lower)) return "bookcase";
  if (/pantry/.test(lower)) return "pantry";
  if (/wardrobe/.test(lower)) return "wardrobe";
  if (/nightstand|bedside/.test(lower)) return "storage";
  if (/\btable\b/.test(lower) && !/work table|console table/.test(lower)) return "table";
  if (/\bmedia\b|\btv\b|console|sideboard|credenza/.test(lower)) return "media";
  if (/\bmudroom\b|window seat/.test(lower)) return "bench";
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
  if (!HOUSE_NOUN.test(lower) && !wantsJars(lower) && !wantsBottles(lower) && !isOverToilet(lower)) {
    return null;
  }

  const wallLang =
    /wall[- ]?hung|wall[- ]?mount|hang(?:s|ing)? on (?:the )?wall|floating|wall[- ]?(?:shelf|shelves|rack|cabinet|cubb|organizer|ledge)|on the wall/.test(
      lower,
    ) ||
    isSpiceRack(lower) ||
    isWineRack(lower) ||
    isMedicine(lower) ||
    isIroning(lower) ||
    (/coat/.test(lower) && /rack/.test(lower)) ||
    /range\s*hood|kitchen\s*hood|extractor\s*hood/.test(lower) ||
    (/\bhood\b/.test(lower) && !/child|robin|likelihood/.test(lower)) ||
    (wantsJars(lower) && /shelf|rack|ledge/.test(lower)) ||
    (wantsBottles(lower) && /shelf|rack/.test(lower));

  const mount: HouseMount = isOverToilet(lower) ? "straddle" : wallLang ? "wall" : "floor";

  const sit = (/\bbench\b|window seat|mudroom|\bseat\b/.test(lower) && !/workbench/.test(lower));
  const work =
    (/\bdesk\b|workbench|work table|\bvanity\b|\bsink\b|island|ironing|\btable\b/.test(lower) &&
      !/console table|bedside table|night table/.test(lower));
  const hangUse =
    (/coat/.test(lower) && /rack|hook|peg/.test(lower)) ||
    (/closet|wardrobe/.test(lower) && /rod|hang/.test(lower));
  const use: HouseUse = sit ? "sit" : work ? "work" : hangUse ? "hang" : "store";

  const fold = isIroning(lower) || /fold[- ]?down|drop[- ]?down/.test(lower);
  const door =
    /door/.test(lower) ||
    isMedicine(lower) ||
    isIroning(lower) ||
    /crate/.test(lower) ||
    (/cabinet/.test(lower) && !isOverToilet(lower) && !/spice|wine/.test(lower)) ||
    /closet|pantry|wardrobe/.test(lower);
  const opening: HouseOpening = fold ? "fold-down" : door ? "door" : "open";

  const program = programFromNoun(lower);

  let family: HouseFamily;
  if (mount === "straddle" || isOverToilet(lower)) family = "straddle";
  else if (/headboard/.test(lower)) family = "slab";
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
  if (program === "bench" || /cubb/.test(lower) || (sit && family === "seat")) add("cubbies");
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
    /nightstand|bedside|dresser|hutch/.test(lower)
  ) {
    add("drawers");
  }
  if ((/coat/.test(lower) && /rack|hook|peg/.test(lower)) || /hook|peg rail/.test(lower)) add("hooks");
  if (/floating/.test(lower) && /shel/.test(lower)) add("cleats");

  return { family, mount, use, opening, affordances, program };
}

export function houseFamilyOf(prompt: string): HouseFamily | null {
  return detectHouseFamily(prompt)?.family ?? null;
}
