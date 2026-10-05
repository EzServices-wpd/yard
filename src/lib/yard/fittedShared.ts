/**
 * Shared constants and helpers for the fitted engine modules.
 */
import { createId } from "@/lib/utils";
import type { Panel } from "./types";
import { isSideEndTable, wantsShoes } from "./family";

export const PLY = "plywood-3-4-4x8";
export const PLY_BACKER = "plywood-1-4-4x8";
export const TWO_BY_TWO = "lumber-2x2-8";
export const P = 0.75;
/** Stud spacing the hang steps assume. A back narrower than this cannot take a screw in two studs. */
export const STUD_CENTER_IN = 16;
/** Concealed hinge arm sticks in from the door's inner face. Shelves must stop short of it. */
export const HINGE_ARM_CLEAR_IN = 0.75;
export const DOOR_MIRROR_T = 0.12;

/** Keep the typed noun. "spice cabinet" stays Spice cabinet, not a bare Cabinet. */
export function cabinetStem(lower: string): string {
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

export function tableClassHeight(lower: string): number {
  if (/coffee|cocktail/.test(lower)) return 18;
  // Side / end tables sit at sofa-arm height: ~22" (class range 18–22").
  if (isSideEndTable(lower)) return 22;
  if (/changing(?:\s*pad)?\s*tables?/.test(lower)) return 36;
  if (/bar\s*-?\s*height/.test(lower)) return 42;
  if (/counter\s*-?\s*height/.test(lower)) return 36;
  return 30;
}

export function isIroningCabinet(text: string) {
  return /ironing/.test(text.toLowerCase());
}

export function isMedicineCabinet(text: string) {
  return /medicine/.test(text.toLowerCase());
}

export function isSpiceRack(text: string) {
  const lower = text.toLowerCase();
  return /spice/.test(lower) && /rack/.test(lower);
}

export function isSpiceCabinet(text: string) {
  const lower = text.toLowerCase();
  return /spice/.test(lower) && /cabinet/.test(lower);
}

export function isWineRack(text: string) {
  const lower = text.toLowerCase();
  return /wine/.test(lower) && /rack/.test(lower);
}

export function isShoeStorage(text: string) {
  return wantsShoes(text.toLowerCase());
}

export function isOverToilet(text: string) {
  const lower = text.toLowerCase();
  if (/toilet\s*paper/.test(lower)) return false;
  return /over[- ]?(the[- ]?)?toilet|toilet[- ]?(cabinet|storage|shelf|etagere|étagère)|space[- ]?saver/.test(lower);
}

export function pick(text: string, re: RegExp, fallback: number) {
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
export function isNoDrawersPrompt(lower: string): boolean {
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
export function isNoDoorsPrompt(lower: string): boolean {
  return (
    /\b(?:no|zero|without|sans)\s+(?:any\s+)?doors?\b/.test(lower) ||
    /\bdoorless\b/.test(lower) ||
    /\b0\s*-?\s*doors?\b/.test(lower) ||
    /\bdoors?\s*[:=]\s*0\b/.test(lower) ||
    /\bopen\s*-?\s*front\b/.test(lower)
  );
}

/** Spoken/typed drawer count — digits or words; overrides family defaults (nightstand=1, bank=3). */
export function spokenDrawerCount(text: string): number | null {
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
export function typedDoorCount(text: string): number | null {
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

/**
 * Feature nouns a count can bind to. A number never reaches past another one:
 * "2 doors and 6 shelves" is 6 shelves, not 2.
 */
export const FEATURE_NOUN = "(?:doors?|drawers?|shel(?:f|ves|ving)|cubb(?:y|ies)|hooks?|steps?)";

/** Up to `max` filler words between a count and its noun — never another feature noun, never another number. */
export function countBridge(max = 3): string {
  return `(?:(?!${FEATURE_NOUN}\\b)(?!\\d)[\\w'-]+\\s+){0,${max}}`;
}

/** Spoken usable-tier count: "4 shelves", "three tiers", "5 levels", "4 rows". */
export function spokenTierCount(text: string): number | null {
  const s = spokenShelfCount(text);
  if (s != null) return s;
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const m = text.toLowerCase().match(new RegExp(`\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+${countBridge(1)}(?:tiers?|levels?|rows?)\\b`));
  if (!m) return null;
  const n = /\d/.test(m[1]) ? parseInt(m[1], 10) : words[m[1]];
  return n >= 1 && n <= 12 ? n : null;
}

/** Spoken/typed shelf count — digits or words; honor "one lower shelf" / adjective between count and shelf. */
export function spokenShelfCount(text: string): number | null {
  const lower = text.toLowerCase();
  // Allow short intervening adjectives: "two floating shelves", "3 wall shelves", "one open shelf".
  const bridge = countBridge(3);
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
export function spokenArmCount(text: string): number | null {
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
export function spokenBracketCount(text: string): number | null {
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

export function spokenBinCount(text: string): number | null {
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
export function spokenRungCount(text: string): number | null {
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

export function spokenSlotCount(text: string): number | null {
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
export function spokenShelfThickness(text: string): number | null {
  const m =
    text.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″'])?\s*thick\b/i) ||
    text.match(/\bthick(?:ness)?\s*(?:of\s*)?(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n < 0.5 || n > 4) return null;
  return n;
}

/** Spoken cubby / bay count — digit or word ("six cubbies" → 6). */
export function spokenCubbyCount(text: string): number | null {
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




export const CRAFT = /popsicle|craft stick|toothpick|paper towel|toilet paper|straw|dowel|pvc|lego|mailing tube/;
export const MAKER = /eiffel|taj|mahal|pyramid|giraffe|rocket|looks like|lattice tower/;
export const BUILDER =
  /vanity|closet|cabinet|cabinetry|desk|bookcase|bookshelf|pantry|wardrobe|built-?in|alcove|linen|mudroom|workbench|potting\s*bench|nightstand|bedside|dresser|media cons|console|\btv\b|sideboard|credenza|hutch|island|table|prep\s*table|butcher|cart|shelving|shelves|shelf|\bledge\b|drawer|storage|bench seat|window seat|system|\brack\b|crate|headboard|bunk|loft\s*bed|day\s*bed|platform\s*beds?|shoe|coat|towel|range\s*hood|kitchen\s*hood|\bhood\b|\bstereo\b|soundbar|(?:\bav\b|a\.?\s*v\.?)\s*tower|media\s*tower|entertainment|pegboard|peg\s*board|tool\s*rail|leash\s*rail|lumber\s*rack|wall\s*panel|ironing|laundry\s*sorter|\bsorter\b|drying\s*rack|utility\s*shel|folding\s*table|boot\s*tray|key\s*(?:and|&)\s*mail|mail\s*shelf|coat\s*(?:and|&)?\s*cubb|toy\s*cubb|cubby\s*wall|kids\s*cubb|book\s*bin|\bchest\b|toy\s*box|hinged\s*lid|planter|adirondack|porch\s*swing|outdoor\s*side\s*table|side\s*table/;


export function panel(
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
export function pushPegs(
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

export const SHELF_MIN_CLEAR = 7;
export const KIDS_BOOKCASE_H = 42;
export function isKidsBookcase(lower: string): boolean {
  return /\b(?:kids?|kid'?s|kids'|child(?:ren)?(?:'?s)?|toddlers?|nursery|playroom)\b/.test(lower) && /\b(?:bookcases?|bookshel(?:f|ves)|book\s+shel(?:f|ves))\b/.test(lower);
}

