/**
 * The one held flag for Ideas (live walk 10-19: "Popular recently" showed the held Ferris wheel and Colosseum).
 * A recipe the Critic or the learned-recipe gate held (`held` in src/lib/yard/recipes.json) never renders in any
 * Ideas section. Keys only: a synonym of a held recipe (planter-box on the window box) is not held, so the Trusted
 * built-in of that name stays. A static list so the Ideas client bundle never carries recipes.json (143 KB);
 * scripts/ideas-live-feed.test.ts fails when it drifts from recipes.json (re-run the snippet in that test).
 */
export const HELD_TYPES: ReadonlySet<string> = new Set([
  "adirondack-footrest",
  "barn-birdhouse",
  "beehive-box",
  "birdhouse-shaped-like-church",
  "colosseum",
  "compost-bin",
  "compost-tumbler-frame",
  "cribbage-board",
  "cutting-board",
  "deck-stairs",
  "ferris-wheel",
  "floating-desk",
  "glider",
  "knife-block",
  "knife-block-maple",
  "marble-run",
  "miter-saw-station",
  "mudroom-locker",
  "murphy-bed",
  "pergola",
  "rain-barrel-stand",
  "raised-dog-feeder-stand",
  "reindeer",
  "router-table",
  "sandbox",
  "sawbuck",
  "sundial",
  "taj-mahal",
  "tipi",
  "toy-airplane",
  "toy-train-track-riser",
  "treasure-chest",
  "wall-clock-frame",
  "window-box",
]);

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** True when this string is a held recipe key. Synonyms and built-in names are not keys. */
export const isHeldType = (type: string | null | undefined) => !!type && HELD_TYPES.has(slug(type));
