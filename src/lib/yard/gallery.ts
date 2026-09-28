import { POCKET_SHORT } from "./pocket";

export type GalleryPlan = {
  slug: string;
  label: string;
  size: string;
  prompt: string;
  blurb: string;
  group: "house" | "weekend";
};

/**
 * Public gallery — stable slugs for freeze canaries and impress builds already on the bench.
 * Each card opens /workspace?q=… with the same prompt the guards walk.
 */
export const GALLERY: GalleryPlan[] = [
  {
    slug: "pocket-vanity",
    label: "Pocket vanity",
    size: "38 × 102 × 17",
    prompt: POCKET_SHORT,
    blurb: "Knee, drawers, uppers — the unit the bathroom pocket actually holds.",
    group: "house",
  },
  {
    slug: "linen-closet",
    label: "Linen closet",
    size: "31.5 × 78 × 16",
    prompt: "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep",
    blurb: "The alcove you typed is the unit you get.",
    group: "house",
  },
  {
    slug: "nightstand",
    label: "Nightstand",
    size: "20 × 24 × 16 · one drawer",
    prompt: "nightstand 20 wide 16 deep 24 tall with one drawer",
    blurb: "One drawer and an open shelf for the bedside.",
    group: "house",
  },
  {
    slug: "vanity-36",
    label: "36″ vanity with two doors",
    size: "36 × 32 × 21",
    prompt: 'bathroom vanity 36" wide × 21" deep × 32" tall with two doors',
    blurb: "Two doors, a kick, the width you typed.",
    group: "house",
  },
  {
    slug: "l-desk",
    label: "L desk",
    size: "60 × 48 · 30 tall",
    prompt: "L-shaped corner desk 60 by 48 30 tall",
    blurb: "Corner desk on an L footprint — both legs at the size you typed.",
    group: "house",
  },
  {
    slug: "corner-bookshelf",
    label: "Corner bookshelf",
    size: "6″ along each wall · 60 tall",
    prompt: "corner bookshelf, 6 inches along each wall, 60 tall, five shelves",
    blurb: "Triangle shelves in the corner. Five shelves, 60 tall.",
    group: "house",
  },
  {
    slug: "sloped-bookshelf",
    label: "Sloped bookshelf",
    size: "48 wide · 60 high · 30 low",
    prompt: "bookshelf under a sloped ceiling 48 wide 60 tall at the high side 30 at the low side",
    blurb: "Raked top under a sloped ceiling. Shelves step with the roof.",
    group: "house",
  },
  {
    slug: "round-table",
    label: "Round table",
    size: "40″ round · 30 tall · 3 legs",
    prompt: "40 inch round table with 3 legs",
    blurb: "Actually round. Three legs, aprons span post to post.",
    group: "house",
  },
  {
    slug: "cedar-chest",
    label: "Cedar chest",
    size: "36 × 30 × 16 · hinged lid",
    prompt: "cedar chest with a hinged lid",
    blurb: "Floor chest with a hinged lid. Cedar stock when you name it.",
    group: "house",
  },
  {
    slug: "floating-shelf",
    label: "Floating shelf",
    size: "36 wide · 8 deep · brackets",
    prompt: "floating shelf with brackets",
    blurb: "A shelf that hangs. Brackets and the span you typed.",
    group: "house",
  },
  {
    slug: "tv-console",
    label: "TV console",
    size: "70 × 30 × 16",
    prompt: "TV console 70 wide 30 tall 16 deep",
    blurb: "Three open bays, shelves, toekick.",
    group: "house",
  },
  {
    slug: "coffee-table",
    label: "Coffee table with lower shelf",
    size: "40 × 18 × 40 · lower shelf",
    prompt: "coffee table with lower shelf",
    blurb: "Coffee height with a lower shelf underneath.",
    group: "house",
  },
  {
    slug: "catapult",
    label: "Popsicle catapult",
    size: "~2 ft",
    prompt: "popsicle stick catapult",
    blurb: "A-frame, axle, throwing arm, payload cup. Whole sticks, glue.",
    group: "weekend",
  },
  {
    slug: "eiffel",
    label: "Popsicle Eiffel",
    size: "3 ft",
    prompt: "3 foot Eiffel Tower from popsicle sticks",
    blurb: "Four arches, four piers, one shaft. The height you typed.",
    group: "weekend",
  },
];

export function galleryBySlug(slug: string): GalleryPlan | undefined {
  return GALLERY.find((g) => g.slug === slug);
}

export function galleryWorkspaceHref(plan: GalleryPlan): string {
  return `/workspace?q=${encodeURIComponent(plan.prompt)}`;
}
