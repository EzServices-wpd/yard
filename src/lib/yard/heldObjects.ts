/**
 * Held objects: the thing a stand, riser or shelf carries.
 *
 * Universal rules (not per-noun patches):
 * - A known build class (animal / figure shape, template, weekend family, climb) always wins over
 *   product-stand routing. The hold cue ("shelf", "stand", "for") only routes to a product stand when
 *   no build class matched.
 * - An animal word that names who USES a held thing ("dog bowl", "cat litter box", "bird feeder") is
 *   the user, not the shape. The object noun and its purpose decide the build.
 * - A material plus a size ("2x4, 60 inches") is never a product.
 * - An object with no drawing is sized from a class-default table of common held objects, never a
 *   tiny placeholder, and the size is stated in an Assumed note.
 */
import { detectShapeClass } from "./shapeTemplates";
import { detectTemplate } from "./formTemplates";
import { detectWeekendFamily } from "./weekendFamily";
import { climbIdentityLabel, identityTitleStem, isAvTower, isBedsideShelf, isHouseMediaCarcase, isPictureLedge, isPlatformBed, isWallMediaLedge } from "./family";
import { isOddShapePrompt } from "./oddShapes";
import { inchFrac } from "./inchText";

/** Animal word + the pet thing it uses. The animal is the user; the object noun is the build. */
export const PET_USE =
  /\b(?:dogs?|doggy|pupp(?:y|ies)|cats?|kitty|kittens?|pets?|birds?|rabbits?|bunn(?:y|ies)|hamsters?|guinea\s+pigs?|horses?|chickens?|parrots?)\s*-?\s*(?=(?:food\s+|water\s+)?(?:bowls?|dishes|feeders?|feeding|food|water|litter|beds?|crates?|kennels?|toys?|treats?|leash(?:es)?|ramps?|gates?|stairs|steps|cages?|hutch(?:es)?|perch(?:es)?)\b)/g;

/** Prompt with pet-use animal words removed ("raised dog bowl stand" → "raised bowl stand"). */
export function stripPetUse(text: string): string {
  return text.replace(PET_USE, "").replace(/\s+/g, " ").trim();
}

/** "for my Lego robot collection" / "record collection": the shelf displays X; X is not the build. */
export function heldCollection(lower: string): string | null {
  const m = lower.match(/\bfor\s+(?:(?:my|our|the|a|an|your)\s+)?([a-z0-9][a-z0-9\s'-]{1,40}?)\s+(?:collection|display)\b/);
  return m ? m[1].trim() : null;
}

/** The hold phrase after "for", or before a stand/riser noun. Null when nothing is held. */
export function heldPhrase(lower: string): string | null {
  const forM = lower.match(/\bfor\s+(?:(?:a|an|the|my|our|your|two|2|three|3)\s+)?([^,.;]+)/);
  if (forM) return forM[1].replace(/\s*\b\d+(?:\.\d+)?\s*(?:(?:in|inch|inches|"|ft|feet|foot)\b\s*(?:tall|high|wide|long|deep)?|(?:tall|high|wide|long|deep)\b).*$/, "").trim();
  const before = lower.match(/([a-z0-9][a-z0-9\s'-]{1,40}?)\s+(?:stands?|holders?|cradles?|risers?|shel(?:f|ves)|carts?)\b/);
  return before ? before[1].trim() : null;
}

/**
 * A known build class matched: the build wins over any product-stand or owned-board routing.
 * Returns a short label for the class, or null.
 */
export function namedBuildClass(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  // A purpose phrase ("for my robot collection") names what is held, not the build.
  const coll = heldCollection(lower);
  let hay = coll ? lower.replace(coll, " ") : lower;
  // An object noun that takes a purpose builds that object: "stand for a Rubik cube" is a stand and the
  // cube is what it holds. Only the words before "for" name the build.
  const purpose = hay.match(/^(.*?\b(?:stands?|shel(?:f|ves)|racks?|holders?|cradles?|risers?|carts?|cabinets?|display\s+cases?))\s+for\b/);
  if (purpose) hay = purpose[1];
  const pet = stripPetUse(hay);
  const shape = detectShapeClass(pet);
  if (shape) return `shape:${shape.profile.subject}`;
  const tmpl = detectTemplate(pet);
  if (tmpl) return `template:${tmpl}`;
  const climb = climbIdentityLabel(pet);
  if (climb) return `climb:${climb}`;
  const wk = detectWeekendFamily(pet);
  if (wk) return `weekend:${wk.family}:${wk.name}`;
  // Named house furniture (printer stand, TV console, media ledge, bedside shelf, odd-shape plates).
  const stem = identityTitleStem(pet);
  if (stem) return `house:${stem}`;
  if (isWallMediaLedge(pet) || isPictureLedge(pet) || isHouseMediaCarcase(pet) || isAvTower(pet) || isBedsideShelf(pet) || isPlatformBed(pet)) return "house:media";
  if (isOddShapePrompt(pet)) return "house:odd-shape";
  // Shop builds with their own form recipe (whole words).
  if (/\bsaw\s*-?\s*horses?\b/.test(pet)) return "form:Sawhorse";
  return null;
}

export type HeldObject = {
  /** Plain name for notes ("countertop microwave"). */
  label: string;
  /** Footprint across (x), depth (z), height (y), inches. */
  width: number;
  depth: number;
  height: number;
  /** Working load in pounds (filled weight for anything holding water). */
  pounds: number;
  water: boolean;
  /** Identical objects side by side on the deck (two dog bowls). */
  count: number;
  /** Usual deck height when the prompt says "stand" (inches). */
  standHeight: number;
  /** "Assumed …" sentence stating the size and weight. */
  note: string;
  /** The product's own catalog piece (listing / usual-family shape and size), drawn on the deck. */
  item?: import("./types").CatalogItem;
};

type Row = {
  re: RegExp;
  make: (q: string) => Omit<HeldObject, "note" | "count"> & { count?: number; sizeTalk?: string };
};

/** Glass aquarium by nominal gallons: footprint W×D, height H, filled weight (lb). */
const TANKS: { gal: number; w: number; d: number; h: number; lb: number; tag?: string }[] = [
  { gal: 5, w: 16, d: 8, h: 10, lb: 62 },
  { gal: 10, w: 20, d: 10, h: 12, lb: 111 },
  { gal: 15, w: 24, d: 12, h: 12, lb: 170 },
  { gal: 20, w: 24, d: 12, h: 16, lb: 225, tag: "high" },
  { gal: 29, w: 30, d: 12, h: 18, lb: 330 },
  { gal: 40, w: 36, d: 18, h: 16, lb: 458, tag: "breeder" },
  { gal: 55, w: 48, d: 13, h: 21, lb: 625 },
  { gal: 75, w: 48, d: 18, h: 21, lb: 850 },
  { gal: 90, w: 48, d: 18, h: 24, lb: 1050 },
  { gal: 125, w: 72, d: 18, h: 21, lb: 1400 },
];

function tankFor(q: string, water: boolean, word: string) {
  const g = q.match(/(\d+(?:\.\d+)?)\s*-?\s*(?:gal(?:lon)?s?|g)\b/);
  const want = g ? parseFloat(g[1]) : 20;
  const long = /\blong\b/.test(q);
  let row = TANKS.find((t) => t.gal >= want - 0.01) ?? TANKS[TANKS.length - 1];
  if (long && row.gal === 20) row = { gal: 20, w: 30, d: 12, h: 12, lb: 225, tag: "long" };
  const lb = water ? row.lb : Math.round(row.lb * 0.3);
  return {
    label: `${row.gal} gallon ${row.tag ? `${row.tag} ` : ""}${word}`,
    width: row.w,
    depth: row.d,
    height: row.h,
    pounds: lb,
    water,
    standHeight: 28,
  };
}

const ROWS: Row[] = [
  { re: /\b(?:fish\s*tanks?|aquariums?|fishtanks?)\b/, make: (q) => tankFor(q, true, "aquarium") },
  { re: /\b(?:terrariums?|vivariums?|reptile\s+tanks?|paludariums?)\b/, make: (q) => tankFor(q, false, "terrarium") },
  { re: /\bmicrowaves?\b/, make: () => ({ label: "countertop microwave", width: 20, depth: 15, height: 12, pounds: 35, water: false, standHeight: 30 }) },
  { re: /\btoaster\s+ovens?\b/, make: () => ({ label: "toaster oven", width: 18, depth: 14, height: 11, pounds: 20, water: false, standHeight: 30 }) },
  { re: /\bair\s*fryers?\b/, make: () => ({ label: "air fryer", width: 12, depth: 14, height: 13, pounds: 15, water: false, standHeight: 30 }) },
  { re: /\b(?:espresso|coffee)\s+(?:machines?|makers?)\b/, make: () => ({ label: "coffee maker", width: 12, depth: 14, height: 15, pounds: 20, water: true, standHeight: 30 }) },
  { re: /\bstand\s+mixers?\b|\bkitchenaid\b/, make: () => ({ label: "stand mixer", width: 14, depth: 9, height: 14, pounds: 25, water: false, standHeight: 30 }) },
  { re: /\b(?:instant\s*pots?|slow\s+cookers?|crock\s*pots?|pressure\s+cookers?)\b/, make: () => ({ label: "multi-cooker", width: 14, depth: 13, height: 13, pounds: 15, water: false, standHeight: 30 }) },
  {
    re: /\b(?:tvs?|televisions?)\b/,
    make: (q) => {
      const m = q.match(/(\d{2,3})\s*(?:"|″|in(?:ch(?:es)?)?)?\s*(?:-|\s)?\s*(?:inch\s+)?(?:tvs?|televisions?)\b/);
      const diag = m ? Math.max(24, Math.min(98, parseFloat(m[1]))) : 55;
      return {
        label: `${diag}″ TV on its feet`,
        width: Math.round(diag * 0.872),
        depth: Math.max(8, Math.round(diag * 0.18)),
        height: Math.round(diag * 0.49),
        pounds: Math.round(diag * 0.65),
        water: false,
        standHeight: 22,
      };
    },
  },
  { re: /\b3\s*d\s+printers?\b/, make: () => ({ label: "desktop 3D printer", width: 18, depth: 18, height: 18, pounds: 25, water: false, standHeight: 26 }) },
  { re: /\bprinters?\b/, make: () => ({ label: "home all-in-one printer", width: 18, depth: 16, height: 10, pounds: 25, water: false, standHeight: 26 }) },
  { re: /\b(?:record\s+players?|turntables?)\b/, make: () => ({ label: "turntable", width: 18, depth: 14, height: 6, pounds: 15, water: false, standHeight: 26 }) },
  { re: /\bsewing\s+machines?\b/, make: () => ({ label: "sewing machine", width: 16, depth: 8, height: 12, pounds: 18, water: false, standHeight: 29 }) },
  { re: /\b(?:game\s+consoles?|consoles?|playstation|xbox)\b/, make: () => ({ label: "game console", width: 16, depth: 10, height: 4, pounds: 10, water: false, standHeight: 22 }) },
  { re: /\bspeakers?\b/, make: () => ({ label: "bookshelf speaker", width: 8, depth: 9, height: 12, pounds: 15, water: false, standHeight: 26 }) },
  { re: /\blaptops?\b/, make: () => ({ label: "laptop", width: 14, depth: 10, height: 1, pounds: 5, water: false, standHeight: 6 }) },
  { re: /\b(?:bird\s*cages?|birdcages?)\b/, make: () => ({ label: "bird cage", width: 20, depth: 18, height: 30, pounds: 25, water: false, standHeight: 24 }) },
  { re: /\bcages?\b|\bhutch(?:es)?\b/, make: () => ({ label: "small-pet cage", width: 30, depth: 18, height: 16, pounds: 25, water: false, standHeight: 24 }) },
  {
    re: /\bbowls?\b|\bdishes\b/,
    make: (q) => {
      const n = /\b(?:one|single|1)\s+bowl\b/.test(q) ? 1 : /\b(?:three|3)\s+bowls?\b/.test(q) ? 3 : 2;
      const dia = /\bcat|kitty|kitten/.test(q) ? 6 : 8;
      const word = n === 1 ? "one" : n === 2 ? "two" : "three";
      return { label: `${word} ${inchFrac(dia)}″ pet bowl${n === 1 ? "" : "s"}`, width: dia, depth: dia, height: 3, pounds: 6 * n, water: true, standHeight: 6, count: n };
    },
  },
  { re: /\blitter\s*box(?:es)?\b/, make: () => ({ label: "large litter box", width: 19, depth: 15, height: 11, pounds: 25, water: false, standHeight: 6 }) },
  { re: /\b(?:water\s+jugs?|water\s+bottles?\s+5\s*gal|5\s*gal(?:lon)?\s+(?:water|jug))\b/, make: () => ({ label: "5 gallon water jug", width: 11, depth: 11, height: 19, pounds: 42, water: true, standHeight: 24 }) },
  { re: /\b(?:trash|garbage|recycling)\s+(?:cans?|bins?)\b/, make: () => ({ label: "13 gallon kitchen bin", width: 16, depth: 12, height: 26, pounds: 15, water: false, standHeight: 4 }) },
  {
    re: /\b(?:plants?|pots?|planters?|ferns?|succulents?|monstera)\b/,
    make: (q) => {
      const m = q.match(/(\d{1,2})\s*(?:"|″|in(?:ch(?:es)?)?)\s*(?:pot|planter)/);
      const pot = m ? parseFloat(m[1]) : 10;
      return { label: `${pot}″ potted plant`, width: pot, depth: pot, height: Math.round(pot * 0.9), pounds: Math.round(pot * 2), water: true, standHeight: 24 };
    },
  },
];

/** Class-default held object for this phrase, or null when nothing in the table matches. */
export function heldObjectFor(phrase: string): HeldObject | null {
  const q = phrase.toLowerCase();
  for (const row of ROWS) {
    if (!row.re.test(q)) continue;
    const r = row.make(q);
    const count = r.count ?? 1;
    const size = `${fmt(r.width)}″ wide × ${fmt(r.depth)}″ deep × ${fmt(r.height)}″ tall`;
    const load = r.water ? `about ${r.pounds} lb filled` : `about ${r.pounds} lb`;
    const note = `Assumed ${r.label}: ${size}, ${load} (usual size for that class). Type its real size to lock it.`;
    return { label: r.label, width: r.width, depth: r.depth, height: r.height, pounds: r.pounds, water: r.water, count, standHeight: r.standHeight, note };
  }
  return null;
}

function fmt(n: number): string {
  return inchFrac(n);
}
