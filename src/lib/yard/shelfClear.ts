/**
 * One shelf-stack minimum for bookcases, bookshelves, wardrobes, closets, pantries and linen closets.
 * #112 (hanging clearance) uses this same height: ten shelves, rod left out, is 86 3/4".
 * Folded clothes want about 7" clear. No toe kick — the engine builds none on these cases.
 */
import { purposeOf } from "./purpose";
import { FORM_NEUTRAL } from "./genericBox";

/** Clear opening a shelf stack is built to leave, face to face. */
export const CLOSET_SHELF_CLEAR_IN = 7;
/** A tighter opening is not a shelf. The gap is never set below this. */
export const SHELF_CLEAR_FLOOR_IN = 4;
/** Shortest hang kept under a rod that stays. */
export const MIN_HANG_ROOM_IN = 40;
/** From the rod's stored y up to the shelf zone. The hat keeps this much room. */
export const ROD_SHELF_LIFT_IN = 2;

/** The bookcase family's default shelf count (fittedBuild shelvesAsked, fittedParse). */
export const BOOKCASE_SHELF_COUNT = 5;
/** The cabinet family's default shelf count (fittedParse cabinet branch). */
export const CABINET_SHELF_COUNT = 2;
/** The shelving family's default shelf count (fittedParse shelf / shelves / shelving branch). */
export const SHELVING_SHELF_COUNT = 3;

const CARCASE_WORD = /^(?:storage|units?|cabinets?|shel(?:f|ves|ving)|cubbies|cubby)$/;

/** Head words before a with/for/from tail, with sizes, stock, and style words dropped. */
function headWords(prompt: string): string[] {
  const phrase = prompt.toLowerCase().replace(/^[a-z]+:\s*/, "").split(/\s+(?:with|for|from|of|out|in|that|to|made|using|on|at|by)\s+/)[0];
  return phrase.split(/[\s-]+/).filter((t) => !/\d/.test(t)).flatMap((t) => t.split(/[^a-z]+/)).filter((w) => w.length >= 3 && !FORM_NEUTRAL.test(w));
}

/**
 * A plain storage, cabinet, shelving, or cubby unit. A stored subject (bike storage,
 * wine storage, storage for bikes, a storage bed) is that subject's stand-in, not this carcase.
 */
export function plainShelfCarcase(prompt: string): boolean {
  if (purposeOf(prompt)) return false;
  const lower = prompt.toLowerCase();
  if (!/\b(?:storage|cabinets?|shel(?:f|ves|ving)|cubbies|cubby)\b/.test(lower)) return false;
  const held = lower.split(/\s+for\s+/).slice(1).join(" ");
  if (held && headWords(held).some((w) => !CARCASE_WORD.test(w))) return false;
  return headWords(lower).every((w) => CARCASE_WORD.test(w));
}

/**
 * Shelf count for a plain storage, cabinet, or shelving carcase that was given none.
 * Cabinet uses the cabinet family's count, shelving the shelving family's, and
 * open storage the bookcase family's. The builder caps this with shelvesThatFit.
 * Null when the ask is not that carcase.
 */
export function tallInteriorShelfCount(prompt: string): number | null {
  if (!plainShelfCarcase(prompt)) return null;
  const lower = prompt.toLowerCase();
  if (/\bcabinets?\b/.test(lower) && !/\bracks?\b/.test(lower)) return CABINET_SHELF_COUNT;
  if (/\bshel(?:f|ves|ving)\b/.test(lower) && !/\bcoat\b/.test(lower)) return SHELVING_SHELF_COUNT;
  if (/\bstorage\b/.test(lower) || /\bcubb/.test(lower)) return BOOKCASE_SHELF_COUNT;
  return null;
}

const SHELF_FAMILY = /\b(?:bookcases?|bookshel(?:f|ves)|wardrobes?|closets?|pantr(?:y|ies)|linens?)\b/i;
const TYPED_SHELF = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:adjustable\s+|fixed\s+|open\s+)?shel(?:f|ves)\b/i;
const SHELF_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

export function closetShelfClearIn(): number {
  return Math.max(SHELF_CLEAR_FLOOR_IN, CLOSET_SHELF_CLEAR_IN);
}

/** A typed shelf count on a bay-shelf carcass. "6 foot shelf" is a size, not six shelves. */
export function typedShelfDemand(prompt: string): number | null {
  if (!SHELF_FAMILY.test(prompt)) return null;
  const m = prompt.match(TYPED_SHELF);
  if (!m) return null;
  const n = /\d/.test(m[1]) ? parseInt(m[1], 10) : SHELF_WORDS[m[1].toLowerCase()];
  return n >= 1 && n <= 12 ? n : null;
}

/** A rod the person asked for. A wardrobe's default rod is not one. */
export function typedRodDemand(prompt: string): boolean {
  return /\brods?\b/i.test(prompt);
}

/**
 * Shortest overall height for `count` shelves at the gap, with the rod left out.
 * (count + 1) openings of (thick + clear), plus the top and the bottom.
 * The bottom opening is clear + thick (7 3/4" at 3/4" stock). Ten shelves: 86 3/4".
 */
export function closetShelfMinHeight(count: number, thick = 0.75, clear = closetShelfClearIn()): number {
  const gap = Math.max(SHELF_CLEAR_FLOOR_IN, clear);
  return (count + 1) * (thick + gap) + thick * 2;
}

/**
 * Shortest height when a typed rod stays: the bottom, 40" of hang, the lift into the
 * shelf zone, the same stack, and the top. Ten shelves: 128 3/4".
 */
export function rodShelfMinHeight(count: number, thick = 0.75, clear = closetShelfClearIn()): number {
  const gap = Math.max(SHELF_CLEAR_FLOOR_IN, clear);
  const stack = (count + 1) * (thick + gap);
  return stack + thick + (thick + MIN_HANG_ROOM_IN) + ROD_SHELF_LIFT_IN;
}

/**
 * A typed count keeps the closet gap. Lower the rod while a shirt can still hang.
 * Drop it when the full height holds the shelves. `unfit` means even that height does not.
 */
export function rodPlanForTypedShelves(o: {
  rodY: number;
  zoneTop: number;
  hangFloor: number;
  fullZone0: number;
  count: number;
  thick?: number;
  lift?: number;
  clear?: number;
}): { rodY: number } | { omitRod: true } | { unfit: true } {
  const thick = o.thick ?? 0.75;
  const clear = Math.max(SHELF_CLEAR_FLOOR_IN, o.clear ?? closetShelfClearIn());
  const lift = o.lift ?? ROD_SHELF_LIFT_IN;
  const stack = (o.count + 1) * (thick + clear);
  const fits = (zone: number) => zone + 1e-6 >= stack;
  if (fits(o.zoneTop - (o.rodY + lift))) return { rodY: o.rodY };
  const lowered = o.zoneTop - lift - stack;
  if (lowered + 1e-6 >= o.hangFloor && fits(o.zoneTop - (lowered + lift))) return { rodY: lowered };
  if (fits(o.zoneTop - o.fullZone0)) return { omitRod: true };
  return { unfit: true };
}
