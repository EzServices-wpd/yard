/**
 * One detector for weekend / hobbyist structure prompts.
 * Sibling of house family.ts. Five families — not a .ts file per noun.
 *
 *   lattice  tower, space frame, Eiffel-class
 *   arch     garden arch, walk-through portal
 *   truss    bridge, Warren
 *   figure   animal, person, named character-ish craft
 *   frame    simple box/frame in craft stock
 *
 * Named freeze chips (Eiffel, PVC garden arch, straw Warren) stay as
 * overrides. Novel nouns reuse a family, densified at the bound catalog
 * stock. Unnamed stock stays the wire-frame placeholder.
 */

import { detectHouseFamily } from "./family";
import type { StructureKind } from "./types";

export type WeekendFamily = "lattice" | "arch" | "truss" | "figure" | "frame";

/** Freeze-chip specials. Routing them through the family would risk the green chips. */
export type WeekendOverride = "eiffel" | "arch" | "bridge";

export type WeekendHit = {
  family: WeekendFamily;
  override?: WeekendOverride;
  kind: StructureKind;
  name: string;
};

/** Universal weekend mechanism classes — densify / steps / honesty key off these. */
export type WeekendMech = "launcher" | "media-hold" | "climb" | "pot-hold";

/** Catapult-class + free-projectile ramp / soft-launch / marble trough (vehicle incline ≠ climb). */
const LAUNCHER_NOUN =
  /\b(catapult|trebuchet|mangonel|onager|ballista|launcher|slingshot)\b|soft-?launch|free\s+projectile|leaves the ramp|leaves?\s+free|marble\s+(?:trough|run|ramp)|(?:popsicle\s+)?(?:run|trough).{0,24}leaves|(?:paper\s*)?plane.{0,48}\bramp\b|\bramp\b.{0,48}(?:plane|projectile|launch|leaves)|\btrough\b.{0,40}(?:marble|launch|leaves)|\bramp\b|\btrough\b/;

/** Picture/easel/cookbook OR a real device/print lean-stand that binds tip angle + envelope. */
const MEDIA_HOLD_NOUN =
  /(?:picture|photo|poster|art)\s*(?:lean\s*)?frame|(?:picture|photo|art)\s*ledge|\bpicture\s*ledge\b|\bcraft\s*frame\b|lean\s*frame|\beasel\b|cookbook|recipe\s+book|recipe[- ]?card|phone\s*(?:lean\s*)?stand|lean\s*stand|laptop\s*lean|(?:tablet|device|book|photo|laptop|music\s*sheet|sheet\s*music|recipe[- ]?card)\s*(?:stand|lean)|music\s*sheet|sheet\s*music|tablet\s*lean|open\s+(?:book|laptop)|\b(?:phone|laptop)\b.{0,48}(?:\d+\s*°|\d+\s*deg(?:rees)?|tip|lean|hold|stand)|holds?\s+a\s+(?:real\s+)?(?:open\s+)?(?:phone|tablet|device|laptop|book|cookbook|print|photo|sheet|music\s*sheet|card|4\s*[×x]\s*6|5\s*[×x]\s*7|8\s*[×x]\s*10)|(?:real\s+)?(?:4\s*[×x]\s*6\s*|5\s*[×x]\s*7\s*|8\s*[×x]\s*10\s*)?(?:print|card)|recipe\s+video|\d+\s*°\s*tip/;
/** Plant / pot stand that holds a real pot upright — envelope + densify, not a Tree silhouette. */
const POT_HOLD_NOUN =
  /plant\s*stand|pot\s*stand|figurine\s*stand|holds?\s+a\s+real\s+.{0,24}\b(?:pot|figurine)\b|\b(?:pot|figurine)\b.{0,32}upright|upright.{0,24}\b(?:pot|figurine)\b|\bfigurine\b.{0,40}(?:stand|base|tall|upright)/;


/** Weight-bearing human step (rise/run). Never vehicle incline alone. */
const CLIMB_HUMAN =
  /\bladder\b|step-?up(?:\s+stool)?|climb\s+step|climb\s+stool|step\s*stool|one-?\s*step|two-?\s*step|each\s+step|top\s+tread|the\s+tread|step-?shelf|weight-bearing.{0,28}(?:step|shelf|mid)|(?:\d+\s*["″]?\s*)?rise\s*(?:[×xby]|and)\s*(?:\d+\s*["″]?\s*)?run|\bone\s+climb\s+step\b|holds?\s+a\s+kid\s+standing|kid\s+stands/;

/** Vehicle incline / craft ramp for a free projectile — launcher, not climb. */
function isVehicleIncline(hay: string): boolean {
  if (CLIMB_HUMAN.test(hay)) return false;
  return (
    /\bramp\b|\btrough\b|\bincline\b|soft-?launch|projectile|leaves the ramp|leaves?\s+free|marble\s+(?:trough|run)/.test(hay) ||
    (/(?:paper\s*)?plane/.test(hay) && /\bramp\b|launch/.test(hay)) ||
    (/marble/.test(hay) && /(?:run|trough|launch|leaves)/.test(hay))
  );
}

function isHumanClimb(hay: string): boolean {
  return CLIMB_HUMAN.test(hay);
}

/** Mechanism class for any matching family — not a noun .ts file. */
export function detectWeekendMech(prompt: string): WeekendMech | null {
  const hay = looksHay(prompt);
  // Climb = weight-bearing human step (rise/run). Do not overload with vehicle incline.
  if (isHumanClimb(hay)) return "climb";
  if (LAUNCHER_NOUN.test(hay) || isVehicleIncline(hay)) return "launcher";
  if (POT_HOLD_NOUN.test(hay)) return "pot-hold";
  if (MEDIA_HOLD_NOUN.test(hay)) return "media-hold";
  return null;
}

/** Tip angle in degrees when the prompt names one (media-hold stands). */
export function mediaHoldTipDeg(prompt: string): number | null {
  const hay = looksHay(prompt);
  const m =
    hay.match(/(\d+(?:\.\d+)?)\s*°/) ||
    hay.match(/(\d+(?:\.\d+)?)\s*deg(?:rees)?/) ||
    hay.match(/(\d+(?:\.\d+)?)\s*tip/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 && n < 90 ? n : null;
}

/** Rise × run inches for a climb step when typed. */
export function climbRiseRun(prompt: string): { rise: number; run: number } | null {
  const hay = looksHay(prompt);
  // Accept "7 rise × 9 run", "7 rise by 9 run", and natural "7 inch rise 9 inch run".
  const m = hay.match(
    /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″])?\s*rise\s*(?:(?:[×x]|by|and)\s*)?(\d+(?:\.\d+)?)\s*(?:in|inch|inches|["″])?\s*run/i,
  );
  if (!m) return null;
  const rise = parseFloat(m[1]);
  const run = parseFloat(m[2]);
  if (!Number.isFinite(rise) || !Number.isFinite(run) || rise <= 0 || run <= 0) return null;
  return { rise, run };
}

/** Ramp length in inches when the prompt names one (launcher ramp). */
export function launcherRampLengthIn(prompt: string): number | null {
  const hay = looksHay(prompt);
  const m =
    hay.match(/(\d+(?:\.\d+)?)\s*"?\s*(?:popsicle\s+)?(?:ramp|run|trough)/) ||
    hay.match(/(?:ramp|run|trough)[^\d]{0,12}(\d+(?:\.\d+)?)\s*"?/) ||
    hay.match(/(\d+(?:\.\d+)?)\s*"?\s*popsicle/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isMediaDeviceStand(prompt: string): boolean {
  const hay = looksHay(prompt);
  return /phone|tablet|device|laptop|lean\s*stand|tablet\s*lean|laptop\s*lean|recipe\s+video|recipe[- ]?card|real\s+phone|music\s*sheet|sheet\s*music|\bcard\b/.test(hay) && !/(?:picture|photo|poster|art)\s*frame/.test(hay);
}

/**
 * Tip-angled lean that holds a real book/device/print — same envelope anatomy
 * as a phone stand (lip + tipped back), not a flat picture-frame rabbet.
 * Universal: any media-hold that names tip / open book / easel / cookbook.
 */
export function wantsMediaTipHold(prompt: string): boolean {
  const hay = looksHay(prompt);
  // Flat picture frames stay rabbet/backing — tip/lean/easel/print-hold claim tip-hold anatomy.
  if (
    /(?:picture|photo|poster|art)\s*frame/.test(hay) &&
    mediaHoldTipDeg(prompt) == null &&
    !/easel|lean|tip|open\s+book|holds?\s+a\s+real|print/.test(hay)
  ) {
    return false;
  }
  if (isMediaDeviceStand(prompt)) return true;
  if (/lean\s*frame|photo\s+lean|\beasel\b|cookbook|recipe\s+book|recipe[- ]?card|open\s+book|open\s+laptop|laptop\s*lean|(?:book)\s*stand|music\s*sheet|sheet\s*music|tablet\s*lean/.test(hay)) return true;
  if (/picture\s*ledge|(?:photo|art)\s*ledge|\bledge\b/.test(hay) && /print|photo|tip|lean|hold|upright/.test(hay)) return true;
  if (/holds?\s+a\s+real\s+(?:print|photo|sheet|music\s*sheet|card|4\s*[×x]\s*6|5\s*[×x]\s*7|8\s*[×x]\s*10)|(?:real\s+)?(?:4\s*[×x]\s*6\s*|5\s*[×x]\s*7\s*|8\s*[×x]\s*10\s*)?(?:print|card)/.test(hay) && /lean|tip|frame|stand|hold|ledge/.test(hay)) {
    return true;
  }
  if (mediaHoldTipDeg(prompt) != null && /easel|stand|lean|hold|frame|ledge|book|cookbook|photo|picture|print|sheet|tablet|laptop|music|card|recipe/.test(hay)) return true;
  return false;
}

export function wantsPotHold(prompt: string): boolean {
  const hay = looksHay(prompt);
  return POT_HOLD_NOUN.test(hay);
}

/** Pot diameter inches when typed (plant / pot stand envelope). */
export function potHoldDiameterIn(prompt: string): number | null {
  const hay = looksHay(prompt);
  // Figurine / stand footprint: "2×2 base" → envelope base size.
  const basePair = hay.match(/(\d+(?:\.\d+)?)\s*"?\s*[x×by]\s*(\d+(?:\.\d+)?)\s*"?\s*base/);
  if (basePair) {
    const a = parseFloat(basePair[1]);
    const b = parseFloat(basePair[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) return Math.max(a, b);
  }
  const m =
    hay.match(/(\d+(?:\.\d+)?)\s*"?\s*diameter/) ||
    hay.match(/(?:pot|planter|figurine)[^\d]{0,16}(\d+(?:\.\d+)?)\s*"?\s*diameter/) ||
    hay.match(/(\d+(?:\.\d+)?)\s*"?\s*(?:pot|planter)\b/) ||
    hay.match(/(?:pot|planter)[^\d]{0,12}(\d+(?:\.\d+)?)\s*"?/) ||
    hay.match(/holds?\s+a\s+real\s+(\d+(?:\.\d+)?)\s*"?\s*(?:pot)?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Pot height inches when typed (e.g. 4" diameter × 4" tall). */
export function potHoldHeightIn(prompt: string): number | null {
  const hay = looksHay(prompt);
  const m =
    hay.match(/diameter\s*[x×by]\s*(\d+(?:\.\d+)?)\s*"?\s*(?:tall|high|height)?/) ||
    hay.match(/base\s*[x×by]\s*(\d+(?:\.\d+)?)\s*"?\s*(?:tall|high|height)?/) ||
    hay.match(/(\d+(?:\.\d+)?)\s*"?\s*(?:tall|high)\b/) ||
    hay.match(/(?:pot|planter|figurine)[^\d]{0,40}(\d+(?:\.\d+)?)\s*"?\s*(?:tall|high)\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 && n < 48 ? n : null;
}

/**
 * Figurine / figure hold (same pot-hold mech class) — figure envelope, not pot diameter.
 * Universal: figurine / figure words bind footprint talk away from pot-bleed copy.
 */
export function isFigurineHold(prompt: string): boolean {
  return /\bfigurines?\b/.test(looksHay(prompt));
}

/**
 * Figure envelope talk for densify notes — prefers "2×2 base × 3 tall figurine"
 * over pot-diameter bleed language.
 */
export function figureHoldEnvelopeTalk(prompt: string): string {
  const hay = looksHay(prompt);
  const basePair = hay.match(/(\d+(?:\.\d+)?)\s*"?\s*[x×by]\s*(\d+(?:\.\d+)?)\s*"?\s*base/);
  const tall = potHoldHeightIn(prompt);
  if (basePair) {
    const a = basePair[1];
    const b = basePair[2];
    if (tall != null) return `${a}″×${b}″ base × ${tall}″ tall figurine`;
    return `${a}″×${b}″ base figurine`;
  }
  const dia = potHoldDiameterIn(prompt);
  if (dia != null && tall != null) return `${dia}″ × ${dia}″ base × ${tall}″ tall figurine`;
  if (dia != null) return `${dia}″ × ${dia}″ base figurine`;
  if (tall != null) return `${tall}″ tall figurine`;
  return "typed figurine";
}

/** Marble / free-projectile diameter inches (⅝ → 0.625). */
export function marbleDiameterIn(prompt: string): number | null {
  const hay = looksHay(prompt)
    .replace(/⅝/g, "5/8")
    .replace(/⅜/g, "3/8")
    .replace(/⅞/g, "7/8")
    .replace(/¼/g, "1/4")
    .replace(/½/g, "1/2")
    .replace(/¾/g, "3/4");
  const frac =
    hay.match(/(\d+)\s*\/\s*(\d+)\s*"?\s*marble/) ||
    hay.match(/a\s+(\d+)\s*\/\s*(\d+)\s*"?\s*marble/);
  if (frac) {
    const a = parseFloat(frac[1]);
    const b = parseFloat(frac[2]);
    if (b > 0 && Number.isFinite(a)) return a / b;
  }
  const m =
    hay.match(/(\d+(?:\.\d+)?)\s*"?\s*marble/) ||
    hay.match(/marble[^\d]{0,12}(\d+(?:\.\d+)?)\s*"?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 && n < 4 ? n : null;
}

export function isLauncherRamp(prompt: string): boolean {
  const hay = looksHay(prompt);
  return (
    isVehicleIncline(hay) ||
    ((/\bramp\b|\btrough\b|marble\s+run|popsicle\s+run/.test(hay) || softLaunchHay(hay)) && !isHumanClimb(hay))
  );
}

function softLaunchHay(hay: string): boolean {
  return /soft-?launch|leaves?\s+free|free\s+projectile/.test(hay);
}

/** How many human climb treads the prompt asks for (1 = single step stool). */
export function climbStepCount(prompt: string): number {
  const hay = looksHay(prompt);
  if (/\bladder\b/.test(hay) && !/step-?up|step\s*stool|climb\s+stool|rise\s*[×xby]/.test(hay)) return 0;
  // Word counts before "top tread" / "each step" defaults — three-step + top tread must stay 3.
  if (/three-?\s*step|\b3\s*-?\s*steps?\b/.test(hay)) return 3;
  if (/four-?\s*step|\b4\s*-?\s*steps?\b/.test(hay)) return 4;
  const numbered = hay.match(/(\d+)\s*-?\s*steps?(?:\s+climb|\s+stool|\b)/);
  if (numbered) {
    const n = parseInt(numbered[1], 10);
    if (Number.isFinite(n) && n >= 1 && n <= 8) return n;
  }
  if (/one-?\s*step|single\s+step|one\s+climb\s+step|step-?up\b/.test(hay) && !/two-?\s*step|three-?\s*step|\b[2-8]\s*-?\s*steps?\b/.test(hay)) {
    return 1;
  }
  if (/two-?\s*step|second\s+(?:step|tread)/.test(hay)) return 2;
  // "each step" / "top tread" alone imply multi-step only when two-step cues exist; else 2.
  if (/each\s+step|top\s+tread/.test(hay) && /two|2\s*-?\s*step|second/.test(hay)) return 2;
  if (/each\s+step|top\s+tread/.test(hay) && !/one\s+climb\s+step|single\s+step|one-?\s*step|step-?up\b/.test(hay)) {
    // Multi-step climb stool with rise×run but no explicit count — prefer 2 only when not three+.
    if (!/three|four|\b[3-8]\s*-?\s*step/.test(hay)) return 2;
  }
  if (/step-?up|climb\s+step|climb\s+stool|step\s*stool|step-?shelf|one\s+climb\s+step|one-?\s*step|rise\s*[×xby]|holds?\s+a\s+kid\s+standing|kid\s+stands|the\s+tread/.test(hay)) {
    return 1;
  }
  return 0;
}

/** Held media noun for tip-hold copy — cookbook/easel stay open book (freeze tip-hold). */
export function mediaHoldHeldLabel(prompt: string): string {
  const hay = looksHay(prompt);
  if (/cookbook|recipe\s+book|open\s+book/.test(hay) || (/\beasel\b/.test(hay) && /book|cookbook|recipe/.test(hay))) {
    return "open book";
  }
  if (/\beasel\b/.test(hay) && /book|cookbook|recipe/.test(hay)) return "open book";
  if (/music\s*sheet|sheet\s*music|holds?\s+a\s+real\s+sheet/.test(hay)) return "music sheet";
  if (/recipe[- ]?card|\bcard\b|4\s*[×x]\s*6/.test(hay) && !/phone|tablet/.test(hay)) return "recipe card";
  if (/print|photo|picture|5\s*[×x]\s*7|8\s*[×x]\s*10/.test(hay) && !/phone|tablet/.test(hay)) return "print";
  if (/laptop|open\s+laptop/.test(hay)) return "open laptop";
  if (/phone/.test(hay)) return "phone";
  if (/tablet|device/.test(hay)) return "device";
  if (/book/.test(hay)) return "open book";
  return "phone or tablet";
}

export function isClimbSingleStep(prompt: string): boolean {
  const hay = looksHay(prompt);
  if (/\bladder\b/.test(hay) && !/step-?up|step\s*stool|climb\s+stool|rise\s*[×xby]/.test(hay)) return false;
  const n = climbStepCount(prompt);
  return n === 1;
}

/** One or more human climb treads (stool / step-shelf), not a multi-rung ladder. */
export function isClimbStepStool(prompt: string): boolean {
  const n = climbStepCount(prompt);
  return n >= 1;
}


const FIGURE_NOUN =
  /giraffe|horse|\bdog\b|\bcat\b|animal|creature|dinosaur|t-?rex|raptor|dino|robot|android|person|human|\bman\b|\bwoman\b|figure|statue|liberty|bird|eagle|dragon|unicorn|elephant|lion|bear|wolf|fox|deer|\bcow\b|\bpig\b|sheep|goat|camel|llama|zebra|moose|kangaroo|monkey|\bape\b|gorilla|troll|ogre|alien|character|mascot|godzilla|pokemon|pokémon|sonic|mario|charizard|pikachu|kaiju|wyvern|yoda|batman|spiderman|iron man|hulk/;

/** Keep dog / dinosaur / animal titles — never naked Figure drift (like TV console identity). */
export function figureIdentityLabel(lower: string): string | null {
  const hay = lower.toLowerCase();
  if (!FIGURE_NOUN.test(hay) && !/\banimals?\b|creature/.test(hay)) return null;
  if (/statue of liberty|\bliberty\b/.test(hay)) return "Liberty";
  if (/giraffe/.test(hay)) return "Giraffe";
  if (/dinosaur|t-?rex|raptor|dino/.test(hay)) return "Dinosaur";
  if (/charizard|dragon|wyvern|godzilla|kaiju/.test(hay)) return "Wyvern";
  if (/robot|android/.test(hay)) return "Robot";
  if (/\bdogs?\b|puppy|puppies/.test(hay)) return "Dog";
  if (/\bcats?\b|kitten/.test(hay)) return "Cat";
  if (/\bhorses?\b|pony|ponies/.test(hay)) return "Horse";
  if (/person|human|\bman\b|\bwoman\b|statue|stick\s*figure|\bfigure\b/.test(hay)) return "Figure";
  if (/\banimals?\b|creature/.test(hay)) return "Animal";
  const named = hay.match(
    /\b(bird|eagle|unicorn|elephant|lion|bear|wolf|fox|deer|cow|pig|sheep|goat|camel|llama|zebra|moose|kangaroo|monkey|ape|gorilla|troll|ogre|alien|pokemon|pokémon|sonic|mario|pikachu|yoda|batman|spiderman|hulk)\b/,
  );
  if (named) {
    const w = named[1];
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return "Animal";
}


const LATTICE_NOUN =
  /lattice|space\s*frame|geodesic|pylon|\btower\b|spire|skyscraper|\bcolumn\b|\bstack\b|\bmast\b|lookout/;

const ARCH_NOUN = /arch|gateway|portal|arbor|arbour|pergola/;

const TRUSS_NOUN = /bridge|span|viaduct|overpass|trestle|warren|\btruss\b/;

const FRAME_NOUN = /\bbox\b|\bcube\b|\bframe\b|platform|catapult|trebuchet|mangonel|onager|ballista|launcher|slingshot|easel|scaffold|\bladder\b|soft-?launch|\bramp\b|\btrough\b|marble\s+run|phone\s*(?:lean\s*)?stand|lean\s*stand|lean\s*frame|picture\s*ledge|(?:photo|art)\s*ledge|\bledge\b|tablet\s*lean|laptop\s*lean|music\s*sheet|sheet\s*music|recipe[- ]?card|plant\s*stand|pot\s*stand|step-?up|step\s*stool|one-?\s*step|step-?shelf|climb\s+step|climb\s+stool|two-?\s*step|three-?\s*step/;

/** Dedicated recipes in form.ts HITS — do not steal them onto a weekend family. */
const HISTORIC_SPECIAL =
  /taj|mahal|pyramid|giza|khufu|colosseum|coliseum|empire state|chrysler building|space needle|cn tower|leaning tower|\bpisa\b|parthenon|stonehenge|sydney opera|big ben|clock tower|westminster|washington monument|obelisk|lighthouse|windmill|pagoda|mosque|minaret|castle|fort|\bkeep\b|battlement|turret/;

function isWindowPrompt(lower: string) {
  if (/window seat/.test(lower)) return false;
  if (/andersen|rough opening/.test(lower)) return true;
  if (/\bwindow\b/.test(lower) && !/cabinet|box|seat/.test(lower)) return true;
  return false;
}

function isNotWeekend(lower: string) {
  if (detectHouseFamily(lower)) return true;
  if (isWindowPrompt(lower)) return true;
  // Step-up / climb stools are weekend climb — not house chairs.
  if (/\bchair\b|\bstool\b/.test(lower) && !/desk|vanity|\btable\b/.test(lower)) {
    if (/step-?up|climb\s+step|climb\s+stool|step\s*stool|two-?\s*step|each\s+step|rise\s*[×xby]/.test(lower)) return false;
    return true;
  }
  // Ladder is a weekend frame (lumber cut-list or craft sticks). Stairs stay out.
  if (/stairs|staircase/.test(lower)) return true;
  if (/birdhouse/.test(lower)) return true;
  if (/planter|raised (garden )?bed|garden box/.test(lower) && !/plant\s*stand|pot\s*stand/.test(lower)) return true;
  if (HISTORIC_SPECIAL.test(lower)) return true;
  return false;
}

function looksHay(prompt: string): string {
  const lower = prompt
    .toLowerCase()
    .replace(/[″″]/g, '"')
    .replace(/[′']/g, "'")
    .replace(/[–—]/g, "-");
  const looks = lower.match(/looks like (?:an? |the )?([a-z][a-z\s-]{2,40})/);
  return looks ? `${looks[1]} ${lower}` : lower;
}

/**
 * Classify a prompt into a weekend structure family, or null when this is
 * a house / window / chair / historic special / not a craft structure.
 */
export function detectWeekendFamily(prompt: string): WeekendHit | null {
  const hay = looksHay(prompt);
  if (isNotWeekend(hay)) return null;

  if (/eiffel/.test(hay)) {
    return { family: "lattice", override: "eiffel", kind: "eiffel", name: "Eiffel" };
  }

  if (/garden\s*arch|arbor|arbour|pergola/.test(hay)) {
    return { family: "arch", override: "arch", kind: "arch", name: "Garden arch" };
  }

  if (/golden gate/.test(hay)) {
    return { family: "truss", override: "bridge", kind: "bridge", name: "Golden Gate" };
  }
  if (/brooklyn bridge|suspension/.test(hay)) {
    return { family: "truss", override: "bridge", kind: "bridge", name: "Brooklyn Bridge" };
  }
  if (/arc de triomphe|triumphal arch/.test(hay)) {
    return { family: "arch", override: "arch", kind: "arch", name: "Arc de Triomphe" };
  }

  // Generic freeze-chip shapes: garden-arch language already returned.
  // A named "bridge" / "warren" stays the straw-Warren override (kind bridge).
  if (TRUSS_NOUN.test(hay)) {
    return { family: "truss", override: "bridge", kind: "bridge", name: /warren/.test(hay) ? "Warren bridge" : "Bridge" };
  }

  if (/statue of liberty|\bliberty\b/.test(hay)) {
    return { family: "figure", kind: "figure", name: "Liberty" };
  }
  if (/giraffe/.test(hay)) {
    return { family: "figure", kind: "figure", name: "Giraffe" };
  }

  // Space frame before generic "frame".
  if (LATTICE_NOUN.test(hay) || /eiffel-?class|lattice tower/.test(hay)) {
    return { family: "lattice", kind: "lattice", name: /space\s*frame/.test(hay) ? "Space frame" : "Lattice tower" };
  }

  if (ARCH_NOUN.test(hay)) {
    return { family: "arch", kind: "arch", name: "Arch" };
  }

  // Mechanism classes win even when the noun is "stand" / "stool" / "ramp".
  {
    const mech = detectWeekendMech(hay);
    if (mech || FRAME_NOUN.test(hay)) {
      if (mech === "climb") {
        const rr = climbRiseRun(hay);
        const steps = climbStepCount(hay);
        const base = /step-?up|stool|climb\s+stool|one-?\s*step|two-?\s*step|three-?\s*step|each\s+step|the\s+tread/.test(hay)
          ? "Step stool"
          : /step-?shelf/.test(hay)
            ? "Step shelf"
            : /towel/.test(hay)
              ? "Towel ladder"
              : /blanket|quilt/.test(hay)
                ? "Blanket ladder"
                : "Ladder";
        const stepTalk =
          steps >= 2 ? `${steps}-step` : rr != null ? `${rr.rise}" rise × ${rr.run}" run` : "";
        const name =
          base === "Step stool" && steps >= 2
            ? rr != null
              ? `Step stool · ${steps} steps · ${rr.rise}" rise × ${rr.run}" run`
              : `Step stool · ${steps} steps`
            : rr != null
              ? `${base} ${rr.rise}" rise × ${rr.run}" run`
              : base;
        void stepTalk;
        return { family: "frame", kind: "ladder", name };
      }
      if (mech === "launcher" || (FRAME_NOUN.test(hay) && detectWeekendMech(hay) === "launcher")) {
        const name = isLauncherRamp(hay)
          ? /marble|trough/.test(hay)
            ? "Marble trough"
            : /(?:paper\s*)?plane/.test(hay)
              ? "Plane ramp"
              : "Launch ramp"
          : /trebuchet/.test(hay)
            ? "Trebuchet"
            : "Catapult";
        return { family: "frame", kind: "frame", name };
      }
      if (mech === "pot-hold") {
        return {
          family: "frame",
          kind: "frame",
          name: /figurine/.test(hay) ? "Figurine stand" : "Plant stand",
        };
      }
      if (mech === "media-hold") {
        const name = wantsMediaTipHold(hay)
          ? /cookbook|recipe\s+book/.test(hay) || (/\beasel\b/.test(hay) && /book/.test(hay))
            ? "Cookbook easel"
            : /\beasel\b/.test(hay)
              ? "Easel"
              : /recipe[- ]?card|\bcard\b/.test(hay)
                ? "Recipe card lean"
                : /music\s*sheet|sheet\s*music/.test(hay)
                  ? "Music sheet stand"
                  : /laptop/.test(hay)
                    ? "Laptop lean"
                    : /tablet/.test(hay)
                    ? "Tablet lean"
                    : /phone/.test(hay)
                      ? /lean|charg/.test(hay)
                        ? "Phone lean"
                        : "Phone stand"
                      : /picture\s*ledge|(?:photo|art)\s*ledge|\bledge\b/.test(hay)
                        ? "Picture ledge"
                        : /print|photo\s+lean|lean\s*frame/.test(hay)
                        ? "Photo lean"
                        : /book/.test(hay)
                          ? "Book stand"
                          : "Device stand"
          : /easel/.test(hay)
            ? "Easel"
            : "Picture frame";
        return { family: "frame", kind: "frame", name };
      }
      if (FRAME_NOUN.test(hay)) {
        const name = /scaffold/.test(hay) ? "Scaffold" : "Frame";
        return { family: "frame", kind: "frame", name };
      }
    }
  }

  if (FIGURE_NOUN.test(hay)) {
    const name = figureIdentityLabel(hay) ?? "Animal";
    return { family: "figure", kind: "figure", name };
  }

  return null;
}

export function weekendFamilyOf(prompt: string): WeekendFamily | null {
  return detectWeekendFamily(prompt)?.family ?? null;
}

/** True when generate should densify via the lattice-tower graph (not a hollow taper). */
export function weekendUsesLatticeGraph(prompt: string, kind: StructureKind): boolean {
  if (kind === "eiffel" || kind === "lattice") return true;
  const hit = detectWeekendFamily(prompt);
  return hit?.family === "lattice" && (kind === "tower" || kind === "lattice" || kind === "eiffel");
}
