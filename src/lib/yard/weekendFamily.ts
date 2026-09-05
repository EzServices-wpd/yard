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

const LAUNCHER_NOUN =
  /\b(catapult|trebuchet|mangonel|onager|ballista|launcher|slingshot)\b/;
const MEDIA_HOLD_NOUN =
  /(?:picture|photo|poster|art)\s*frame|\bcraft\s*frame\b|\beasel\b/;
const CLIMB_NOUN = /\bladder\b/;

/** Mechanism class for any matching family — not a noun .ts file. */
export function detectWeekendMech(prompt: string): WeekendMech | null {
  const hay = looksHay(prompt);
  if (LAUNCHER_NOUN.test(hay)) return "launcher";
  if (MEDIA_HOLD_NOUN.test(hay)) return "media-hold";
  if (CLIMB_NOUN.test(hay)) return "climb";
  return null;
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

const FRAME_NOUN = /\bbox\b|\bcube\b|\bframe\b|platform|catapult|trebuchet|mangonel|onager|ballista|launcher|slingshot|easel|scaffold|\bladder\b/;

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
  if (/\bchair\b|\bstool\b/.test(lower) && !/desk|vanity|\btable\b/.test(lower)) return true;
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

  if (FRAME_NOUN.test(hay)) {
    const mech = detectWeekendMech(hay);
    if (mech === "climb") {
      return { family: "frame", kind: "ladder", name: "Ladder" };
    }
    const name =
      mech === "launcher"
        ? /trebuchet/.test(hay)
          ? "Trebuchet"
          : "Catapult"
        : mech === "media-hold"
          ? /easel/.test(hay)
            ? "Easel"
            : "Picture frame"
          : /scaffold/.test(hay)
            ? "Scaffold"
            : "Frame";
    return { family: "frame", kind: "frame", name };
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
