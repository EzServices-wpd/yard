/**
 * Ideas 12a (Ezra via Chief, 10-26): the page explores builds by kind, not one flat list. UI-side table: build type →
 * group. scripts/ideas-groups.test.ts fails when a listed type is in no group or in two, so a new type must be placed
 * here before it ships. Pure: no engine import.
 */
import { SECTION_SHOW, type IdeaCard } from "./feed";

export const GROUPS: { id: string; title: string; line: string; types: string }[] = [
  { id: "furniture", title: "Furniture", line: "Cabinets, shelves and beds, fitted to the room you typed.", types: "linen bookcase dresser pantry corner-bookshelf sloped-ceiling-bookcase shoe-rack bathroom-pocket-vanity wardrobe sideboard spice-cabinet over-toilet bunk-bed tv-console medicine-cabinet wine-rack coat-rack nightstand spice-rack desk dog-crate closet coat-closet floating-shelves window-seat mudroom-bench vanity andersen magazine-rack sofa-table hall-tree ottoman l-shaped-corner-desk under-stairs-shelves ironing-cabinet record-shelf butcher-block-cart dining-table kitchen-island coffee-table platform-bed radiator-cover headboard folding-table daybed round-table round-coffee-table wall-cabinet range-hood kitchen-base jar-rack utility-cabinet laptop-stand standing-desk-converter cat-tree shelf towel-ladder laundry-sorter utility-cart" },
  { id: "landmarks", title: "Landmarks and models", line: "Towers and bridges from sticks and straws.", types: "eiffel-tower lattice-tower brooklyn-bridge bridge lighthouse windmill white-house empire-state-building space-needle covered-bridge barn water-wheel" },
  { id: "weekend", title: "Weekend projects", line: "Out in the yard by Sunday.", types: "birdhouse ladder garden-arch garden-arch-base-molding raised-garden-bed dog-house bike-rack deck-box trellis chicken-coop mailbox-post firewood-unit workbench toolbox bird-feeder outdoor-storage-bench" },
  { id: "toys", title: "Toys and games", line: "Things to play with.", types: "soccer-goal rocket dollhouse abacus catapult swing-set sailboat dinosaur viking-ship train-engine cardboard-robot" },
  { id: "crafts", title: "Crafts", line: "Small makes for a table and an afternoon.", types: "picture-frame dog wall-mounted-mail-organizer key-holder-wall-mounted guitar-hanger jewelry-box" },
];
/** Where a type no row names lands on the page (never hidden); the coverage test keeps it empty. */
export const OTHER = { id: "more", title: "More builds", line: "", types: "" };

const GROUP_OF = new Map(GROUPS.flatMap((g) => g.types.split(" ").map((t) => [t, g.id] as const)));
export const groupOf = (buildType: string): string | undefined => GROUP_OF.get(buildType);

/** Hand-picked (Chief 10-26): checked, drawn builds that show what Yard does. A missing or unchecked one is skipped. */
export const FEATURED = ["eiffel-tower", "bathroom-pocket-vanity", "bridge", "abacus", "bunk-bed"];

/** The stock a card names ("from popsicle sticks" → "Popsicle sticks"); null when its note is not a stock. */
export function stockOf(c: Pick<IdeaCard, "stock">): string | null {
  const m = /^from (.+)$/.exec(c.stock ?? "");
  return m ? m[1][0].toUpperCase() + m[1].slice(1) : null;
}

export type Group = { id: string; title: string; line: string; cards: IdeaCard[] };
/** Every card once, in its group, in feed order (most built first); empty groups are dropped. */
export function groupCards(cards: IdeaCard[]): Group[] {
  return [...GROUPS, OTHER]
    .map((g) => ({ id: g.id, title: g.title, line: g.line, cards: cards.filter((c) => (groupOf(c.buildType) ?? OTHER.id) === g.id) }))
    .filter((g) => g.cards.length > 0);
}

/** The stock chip: only cards whose note names that stock; null shows all. */
export const withStock = (cards: IdeaCard[], stock: string | null) => (stock ? cards.filter((c) => stockOf(c) === stock) : cards);

/**
 * What a group shows: up to SECTION_SHOW drawn cards, then (once "See all" is open, or at once when none is drawn) the
 * rest as rows, `n` at a time. `button`: whether "See all" is offered; `shown` of `cards.length` is the count line.
 */
export function groupView(cards: IdeaCard[], open: boolean, n: number) {
  const top = cards.filter((c) => c.drawing).slice(0, SECTION_SHOW);
  const more = cards.filter((c) => !top.includes(c));
  const rows = open || top.length === 0 ? more.slice(0, n) : [];
  return { top, rows, left: more.length - rows.length, button: top.length > 0 && more.length > 0, label: `See all ${cards.length}`, shown: top.length + rows.length };
}
