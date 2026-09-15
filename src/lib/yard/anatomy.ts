/**
 * Any prompt → one of six anatomies.
 * Named monuments are shortcuts. Unknown names still get a class,
 * a default silhouette, then Grok can replace the wire when the key is set.
 */

import type { StructureKind } from "./types";
import { detectHouseFamily, isAdirondackChair, isLoungeChair, isRockingChair, isOttoman, isSeatingLoungeClass, isDoorPortal, isPlanterBox, isPorchSwingFrame, isPortalHookRail, isPortalSpanShelf, isTowelPortalRail, isShoePortalRail, isShoePortalCubbies, isToyChest } from "./family";
import { detectWeekendFamily, detectWeekendMech, wantsPotHold } from "./weekendFamily";

export type Anatomy = "loft" | "shell" | "figure" | "span" | "carcase" | "opening" | "fitted";

export type FigureStance = "biped" | "quadruped" | "longneck" | "winged" | "liberty" | "wyvern";

export type AnatomyHit = {
  anatomy: Anatomy;
  kind: StructureKind;
  stance?: FigureStance;
  named?: string;
};

const OPENING = /window|rough opening|\bro\b|andersen/;
const FITTED =
  /closet|wardrobe|pantry|built-?in|cabinet|shelv|linen|vanity|alcove|pocket space|bookcase|bookshelf|dresser|nightstand|mudroom|\bdesk\b|\btv\b|console|sideboard|\btable\b|media unit|storage system|\brack\b|crate|headboard|shoe|coat|island|hutch|range\s*hood|kitchen\s*hood|extractor\s*hood|\bhood\b|\bbench\b|\bseat\b|cubb|\bledge\b|\bchest\b|toy\s*box|hinged\s*lid|book\s*bin/;

const LOFT =
  /tower|spire|pylon|obelisk|lighthouse|minaret|chimney|steeple|skyscraper|column|stack|rocket|pagoda|windmill|monument/;
const SHELL =
  /dome|capitol|mosque|rotunda|igloo|onion|basilica|stupa|planetarium|opera|pantheon|capitol|observatory|geodesic/;
const SPAN = /bridge|viaduct|overpass|trestle/;
const CARCASE = /chair|stool|table|desk|bed|bench|box|cube|frame|shelf|crate|cabinet/;
const FIGURE =
  /giraffe|horse|\bdog\b|\bcat\b|animal|creature|dinosaur|t-?rex|raptor|dino|robot|android|person|human|\bman\b|\bwoman\b|figure|statue|liberty|bird|eagle|dragon|unicorn|elephant|lion|bear|wolf|fox|deer|\bcow\b|\bpig\b|sheep|goat|camel|llama|zebra|moose|kangaroo|monkey|\bape\b|gorilla|troll|ogre|alien|character|mascot|godzilla|pokemon|pokémon|sonic|mario|charizard|pikachu|kaiju|wyvern/;
const LONGNECK = /giraffe|camel|llama|brachiosaurus|sauropod|flamingo/;
const WINGED = /bird|eagle|angel|pteranodon|wing/;
const WYVERN =
  /charizard|dragon|wyvern|godzilla|kaiju|griffin|phoenix|pterodactyl|bat\b/;
const BIPED =
  /person|human|man|woman|statue|liberty|robot|android|troll|ogre|mario|sonic|character|mascot|pikachu|yoda|batman|spiderman|iron man|hulk/;

export function classifyAnatomy(prompt: string): AnatomyHit {
  const lower = prompt.toLowerCase();
  const looks = lower.match(/looks like (?:an? |the )?([a-z][a-z\s-]{2,40})/);
  const hay = looks ? `${looks[1]} ${lower}` : lower;

  if (OPENING.test(hay) && !/stained/.test(hay) && !/window seat/.test(hay))
    return { anatomy: "opening", kind: "opening" };
  if (/\bladder\b/.test(hay)) return { anatomy: "carcase", kind: "ladder", named: "Ladder" };
  if (/stairs|staircase/.test(hay)) return { anatomy: "carcase", kind: "ladder" };
  if (/birdhouse/.test(hay)) return { anatomy: "carcase", kind: "house", named: "Birdhouse" };
  if (isPlanterBox(hay) || /planter|raised (garden )?bed|garden box/.test(hay)) {
    // Planter on house path uses fitted open-top; anatomy still carcase when craft.
    if (detectHouseFamily(hay)) return { anatomy: "fitted", kind: "closet", named: "Planter box" };
    return { anatomy: "carcase", kind: "furniture", named: "Planter box" };
  }
  // Porch swing frame — never FITTED seat→Custom closet / Bench steal.
  if (isPorchSwingFrame(hay)) return { anatomy: "carcase", kind: "frame", named: "Porch swing frame" };
  // Seating lounge class — fitted sit anatomy (not FITTED closet / House wire).
  if (isOttoman(hay)) return { anatomy: "fitted", kind: "closet", named: "Ottoman" };
  if (isRockingChair(hay)) return { anatomy: "fitted", kind: "closet", named: "Rocking chair" };
  if (isLoungeChair(hay)) return { anatomy: "fitted", kind: "closet", named: "Lounge chair" };
  // Adirondack / outdoor chair — never FITTED "seat height" → Custom closet.
  if (isAdirondackChair(hay) || (/\bchair\b|\bstool\b/.test(hay) && !/desk|vanity|\btable\b/.test(hay) && !isSeatingLoungeClass(hay))) {
    return {
      anatomy: "carcase",
      kind: "furniture",
      named: isAdirondackChair(hay) ? "Adirondack chair" : "Chair",
    };
  }
  if (detectHouseFamily(hay)) return { anatomy: "fitted", kind: "closet" };
  // Weekend mechs (climb step / launcher ramp / device stand) must not be stolen by "shelf" FITTED.
  // "seat height" on a chair already carved out above — bare seat still FITTED for benches.
  if (
    !detectWeekendMech(hay) &&
    !/step-?up|climb\s+step|rise\s*[×xby]\s*.*run/.test(hay) &&
    FITTED.test(hay)
  ) {
    return { anatomy: "fitted", kind: "closet" };
  }

  if (/eiffel/.test(hay)) return { anatomy: "loft", kind: "eiffel", named: "Eiffel" };
  if (/taj|mahal/.test(hay)) return { anatomy: "shell", kind: "taj", named: "Taj Mahal" };
  if (/pyramid|giza|khufu/.test(hay)) return { anatomy: "loft", kind: "pyramid", named: "Pyramid" };
  if (/statue of liberty|\bliberty\b/.test(hay))
    return { anatomy: "figure", kind: "figure", stance: "liberty", named: "Liberty" };
  if (/giraffe/.test(hay)) return { anatomy: "figure", kind: "figure", stance: "longneck", named: "Giraffe" };
  if (/empire state|chrysler building|skyscraper|willis tower|sears tower/.test(hay))
    return { anatomy: "loft", kind: "tower", named: /empire/.test(hay) ? "Empire State" : undefined };
  if (/space needle|cn tower/.test(hay)) return { anatomy: "loft", kind: "tower", named: "Space Needle" };
  if (/golden gate|brooklyn bridge|suspension bridge/.test(hay))
    return { anatomy: "span", kind: "bridge", named: /golden/.test(hay) ? "Golden Gate" : undefined };
  if (/sydney opera/.test(hay)) return { anatomy: "shell", kind: "dome", named: "Sydney Opera" };
  if (/colosseum|coliseum/.test(hay)) return { anatomy: "shell", kind: "custom", named: "Colosseum" };
  if (/parthenon/.test(hay)) return { anatomy: "carcase", kind: "custom", named: "Parthenon" };
  if (/stonehenge/.test(hay)) return { anatomy: "carcase", kind: "custom", named: "Stonehenge" };

  // "Spanning" a door portal is hung-open house — not a bridge.
  if (SPAN.test(hay) || (/(?:\bspan\b|spanning)/.test(hay) && !isDoorPortal(hay) && !/wall\s*span/.test(hay))) {
    return { anatomy: "span", kind: "bridge" };
  }
  if (SHELL.test(hay)) return { anatomy: "shell", kind: /taj|mosque/.test(hay) ? "taj" : "dome" };
  if (LONGNECK.test(hay)) return { anatomy: "figure", kind: "figure", stance: "longneck" };
  if (WYVERN.test(hay)) return { anatomy: "figure", kind: "figure", stance: "wyvern" };
  if (WINGED.test(hay) && !/plane|airplane/.test(hay))
    return { anatomy: "figure", kind: "figure", stance: "winged" };
  if (BIPED.test(hay) || /statue/.test(hay))
    return { anatomy: "figure", kind: "figure", stance: "biped" };
  if (FIGURE.test(hay)) return { anatomy: "figure", kind: "figure", stance: "quadruped" };
  const weekend = detectWeekendFamily(hay);
  if (weekend) {
    if (weekend.family === "figure") {
      return { anatomy: "figure", kind: "figure", named: weekend.name };
    }
    if (weekend.family === "lattice") {
      return { anatomy: "loft", kind: weekend.kind, named: weekend.name };
    }
    if (weekend.family === "arch" || weekend.family === "truss") {
      return { anatomy: "span", kind: weekend.kind, named: weekend.name };
    }
    return { anatomy: "carcase", kind: weekend.kind, named: weekend.name };
  }
  if (CARCASE.test(hay)) return { anatomy: "carcase", kind: "furniture" };
  if (LOFT.test(hay)) return { anatomy: "loft", kind: "lattice" };

  if (/plane|airplane|jet|\bcar\b|\btruck\b|\bwagon\b|\bbike\b|\bboat\b|\bship\b/.test(hay))
    return { anatomy: "figure", kind: "vehicle", stance: "quadruped" };
  if (isToyChest(hay)) return { anatomy: "fitted", kind: "closet", named: "Toy chest" };
  if (/house|cabin|shed|hut|cottage|barn|castle|fort/.test(hay) && !/hutch/.test(hay) && !/toy\s*(?:chest|box)|hinged\s*lid/.test(hay))
    return { anatomy: "carcase", kind: /castle|fort/.test(hay) ? "castle" : "house" };
  if (/arch|gateway|portal|arbor|arbour|pergola/.test(hay)) {
    // Door-portal fittings (hook rail / over-door shelf / towel / shoe) are fitted hung-open — not a garden arch.
    if (
      isPortalHookRail(hay) ||
      isPortalSpanShelf(hay) ||
      isTowelPortalRail(hay) ||
      isShoePortalRail(hay) ||
      isShoePortalCubbies(hay) ||
      (/coat/.test(hay) && /rod|rail|rack|hook|peg/.test(hay) && isDoorPortal(hay))
    ) {
      return { anatomy: "fitted", kind: "closet" };
    }
    return { anatomy: "span", kind: "arch" };
  }
  if (/wall|fence|palisade/.test(hay)) return { anatomy: "span", kind: "wall" };
  if (/tree|cactus|plant/.test(hay)) return { anatomy: "figure", kind: "plant", stance: "biped" };

  const sizeTall = /foot|ft|inch|in/.test(hay);
  // Pot-hold / floor-lamp stands are envelope frames — never loft Lattice just because they are N″ tall.
  if (sizeTall && /tall|high|tower/.test(hay) && !wantsPotHold(hay) && detectWeekendMech(hay) !== "pot-hold") {
    return { anatomy: "loft", kind: "lattice" };
  }
  return { anatomy: "figure", kind: "custom", stance: "quadruped" };
}

/** Second pass: encyclopedia extract can flip a generic class to the right anatomy. */
export function classifyFromSource(prompt: string, source: string): AnatomyHit {
  const first = classifyAnatomy(prompt);
  if (first.named) return first;
  const hay = `${prompt} ${source}`.toLowerCase();
  if (/pokémon|pokemon|fictional character|video game character/.test(hay)) {
    if (WYVERN.test(hay) || /dragon|lizard|wing/.test(hay))
      return { anatomy: "figure", kind: "figure", stance: "wyvern" };
    return { anatomy: "figure", kind: "figure", stance: "biped" };
  }
  if (/humanoid|primates|person\b/.test(hay) && first.anatomy === "figure")
    return { anatomy: "figure", kind: "figure", stance: "biped" };
  if (/suspension bridge/.test(hay)) return { anatomy: "span", kind: "bridge" };
  const extra = classifyAnatomy(hay);
  if (extra.named || extra.anatomy !== first.anatomy || extra.stance !== first.stance) return extra;
  return first;
}
