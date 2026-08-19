/**
 * Any prompt → one of six anatomies.
 * Named monuments are shortcuts. Unknown names still get a class,
 * a default silhouette, then Grok can replace the wire when the key is set.
 */

import type { StructureKind } from "./types";

export type Anatomy = "loft" | "shell" | "figure" | "span" | "carcase" | "opening" | "fitted";

export type FigureStance = "biped" | "quadruped" | "longneck" | "winged" | "liberty";

export type AnatomyHit = {
  anatomy: Anatomy;
  kind: StructureKind;
  stance?: FigureStance;
  named?: string;
};

const OPENING = /window|rough opening|\bro\b|andersen/;
const FITTED =
  /closet|wardrobe|pantry|built-?in|cabinet|shelv|linen|vanity|alcove|pocket space|bookcase|bookshelf|dresser|nightstand|mudroom|workbench/;

const LOFT =
  /tower|spire|pylon|obelisk|lighthouse|minaret|chimney|steeple|skyscraper|column|stack|rocket|pagoda|windmill|monument/;
const SHELL =
  /dome|capitol|mosque|rotunda|igloo|onion|basilica|stupa|planetarium|opera|pantheon|capitol|observatory|geodesic/;
const SPAN = /bridge|span|viaduct|overpass|trestle/;
const CARCASE = /chair|stool|table|desk|bed|bench|box|cube|frame|shelf|crate|cabinet/;
const FIGURE =
  /giraffe|horse|dog|cat|animal|creature|dinosaur|t-?rex|raptor|dino|robot|android|person|human|man|woman|figure|statue|liberty|bird|eagle|dragon|unicorn|elephant|lion|bear|wolf|fox|deer|cow|pig|sheep|goat|camel|llama|zebra|moose|kangaroo|monkey|ape|gorilla|troll|ogre|alien|character|mascot|godzilla|pokemon|sonic|mario/;
const LONGNECK = /giraffe|camel|llama|brachiosaurus|sauropod|flamingo/;
const WINGED = /bird|eagle|angel|dragon|pteranodon|plane|airplane|wing/;
const BIPED = /person|human|man|woman|statue|liberty|robot|android|troll|ogre|mario|sonic|character|mascot/;

export function classifyAnatomy(prompt: string): AnatomyHit {
  const lower = prompt.toLowerCase();
  const looks = lower.match(/looks like (?:an? |the )?([a-z][a-z\s-]{2,40})/);
  const hay = looks ? `${looks[1]} ${lower}` : lower;

  if (OPENING.test(hay) && !/stained/.test(hay)) return { anatomy: "opening", kind: "opening" };
  if (FITTED.test(hay)) return { anatomy: "fitted", kind: "closet" };

  if (/eiffel/.test(hay)) return { anatomy: "loft", kind: "eiffel", named: "Eiffel" };
  if (/taj|mahal/.test(hay)) return { anatomy: "shell", kind: "taj", named: "Taj Mahal" };
  if (/pyramid|giza|khufu/.test(hay)) return { anatomy: "loft", kind: "pyramid", named: "Pyramid" };
  if (/statue of liberty|\bliberty\b/.test(hay))
    return { anatomy: "figure", kind: "figure", stance: "liberty", named: "Liberty" };
  if (/giraffe/.test(hay)) return { anatomy: "figure", kind: "figure", stance: "longneck", named: "Giraffe" };

  if (SPAN.test(hay)) return { anatomy: "span", kind: "bridge" };
  if (SHELL.test(hay)) return { anatomy: "shell", kind: /taj|mosque/.test(hay) ? "taj" : "dome" };
  if (LONGNECK.test(hay)) return { anatomy: "figure", kind: "figure", stance: "longneck" };
  if (WINGED.test(hay) && !/plane|airplane/.test(hay))
    return { anatomy: "figure", kind: "figure", stance: "winged" };
  if (BIPED.test(hay) || /statue/.test(hay))
    return { anatomy: "figure", kind: "figure", stance: "biped" };
  if (FIGURE.test(hay)) return { anatomy: "figure", kind: "figure", stance: "quadruped" };
  if (CARCASE.test(hay)) return { anatomy: "carcase", kind: "furniture" };
  if (LOFT.test(hay)) return { anatomy: "loft", kind: "tower" };

  if (/plane|airplane|jet|car|truck|wagon|bike|boat|ship/.test(hay))
    return { anatomy: "figure", kind: "vehicle", stance: "quadruped" };
  if (/house|cabin|shed|hut|cottage|barn|castle|fort/.test(hay))
    return { anatomy: "carcase", kind: /castle|fort/.test(hay) ? "castle" : "house" };
  if (/wall|fence|palisade/.test(hay)) return { anatomy: "span", kind: "wall" };
  if (/arch|gateway|portal/.test(hay)) return { anatomy: "span", kind: "arch" };
  if (/tree|cactus|plant/.test(hay)) return { anatomy: "figure", kind: "plant", stance: "biped" };

  const sizeTall = /foot|ft|inch|in/.test(hay);
  if (sizeTall && /tall|high|tower/.test(hay)) return { anatomy: "loft", kind: "tower" };
  return { anatomy: "figure", kind: "custom", stance: "quadruped" };
}
