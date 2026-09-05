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
export type WeekendMech = "launcher" | "media-hold" | "climb";

/** Catapult-class + free-projectile ramp / soft-launch (vehicle incline ≠ climb). */
const LAUNCHER_NOUN =
  /\b(catapult|trebuchet|mangonel|onager|ballista|launcher|slingshot)\b|soft-?launch|free\s+projectile|leaves the ramp|(?:paper\s*)?plane.{0,48}\bramp\b|\bramp\b.{0,48}(?:plane|projectile|launch|leaves)/;

/** Picture/easel OR a real device lean-stand that binds tip angle + envelope. */
const MEDIA_HOLD_NOUN =
  /(?:picture|photo|poster|art)\s*frame|\bcraft\s*frame\b|\beasel\b|phone\s*(?:lean\s*)?stand|lean\s*stand|(?:tablet|device|book)\s*stand|\bphone\b.{0,48}(?:\d+\s*°|\d+\s*deg(?:rees)?|tip|lean|hold|stand)|holds?\s+a\s+real\s+(?:phone|tablet|device)|recipe\s+video/;

/** Weight-bearing human step (rise/run). Never vehicle incline alone. */
const CLIMB_HUMAN =
  /\bladder\b|step-?up(?:\s+stool)?|climb\s+step|step-?shelf|weight-bearing.{0,28}(?:step|shelf|mid)|(?:\d+\s*"?\s*)?rise\s*[×xby]\s*(?:\d+\s*"?\s*)?run|\bone\s+climb\s+step\b|holds?\s+a\s+kid\s+standing/;

/** Vehicle incline / craft ramp for a free projectile — launcher, not climb. */
function isVehicleIncline(hay: string): boolean {
  if (CLIMB_HUMAN.test(hay)) return false;
  return (
    /\bramp\b|\bincline\b|soft-?launch|projectile|leaves the ramp/.test(hay) ||
    (/(?:paper\s*)?plane/.test(hay) && /\bramp\b|launch/.test(hay))
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
  const hay = looksHay(prompt).replace(/″/g, '"');
  const m = hay.match(
    /(\d+(?:\.\d+)?)\s*"?\s*rise\s*[×xby]\s*(\d+(?:\.\d+)?)\s*"?\s*run/i,
  );
  if (!m) return null;
  return { rise: parseFloat(m[1]), run: parseFloat(m[2]) };
}

/** Ramp length in inches when the prompt names one (launcher ramp). */
export function launcherRampLengthIn(prompt: string): number | null {
  const hay = looksHay(prompt).replace(/″/g, '"');
  const m =
    hay.match(/(\d+(?:\.\d+)?)\s*"?\s*(?:popsicle\s+)?ramp/) ||
    hay.match(/ramp[^\d]{0,12}(\d+(?:\.\d+)?)\s*"?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isMediaDeviceStand(prompt: string): boolean {
  const hay = looksHay(prompt);
  return /phone|tablet|device|lean\s*stand|recipe\s+video|real\s+phone/.test(hay) && !/(?:picture|photo|poster|art)\s*frame/.test(hay);
}

export function isLauncherRamp(prompt: string): boolean {
  const hay = looksHay(prompt);
  return isVehicleIncline(hay) || (/\bramp\b/.test(hay) && !isHumanClimb(hay));
}

export function isClimbSingleStep(prompt: string): boolean {
  const hay = looksHay(prompt);
  return /step-?up|climb\s+step|step-?shelf|one\s+climb\s+step|rise\s*[×xby]/.test(hay) && !/\bladder\b/.test(hay);
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

const FRAME_NOUN = /\bbox\b|\bcube\b|\bframe\b|platform|catapult|trebuchet|mangonel|onager|ballista|launcher|slingshot|easel|scaffold|\bladder\b|soft-?launch|\bramp\b|phone\s*(?:lean\s*)?stand|lean\s*stand|step-?up|step-?shelf|climb\s+step/;

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
    if (/step-?up|climb\s+step|rise\s*[×xby]/.test(lower)) return false;
    return true;
  }
  // Ladder is a weekend frame (lumber cut-list or craft sticks). Stairs stay out.
  if (/stairs|staircase/.test(lower)) return true;
  if (/birdhouse/.test(lower)) return true;
  if (/planter|raised (garden )?bed|garden box/.test(lower)) return true;
  if (HISTORIC_SPECIAL.test(lower)) return true;
  return false;
}

function looksHay(prompt: string): string {
  const lower = prompt.toLowerCase();
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
        const name = /step-?up|stool/.test(hay)
          ? "Step stool"
          : /step-?shelf/.test(hay)
            ? "Step shelf"
            : "Ladder";
        return { family: "frame", kind: "ladder", name };
      }
      if (mech === "launcher" || (FRAME_NOUN.test(hay) && detectWeekendMech(hay) === "launcher")) {
        const name = isLauncherRamp(hay)
          ? "Launch ramp"
          : /trebuchet/.test(hay)
            ? "Trebuchet"
            : "Catapult";
        return { family: "frame", kind: "frame", name };
      }
      if (mech === "media-hold") {
        const name = isMediaDeviceStand(hay)
          ? /phone/.test(hay)
            ? "Phone stand"
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
