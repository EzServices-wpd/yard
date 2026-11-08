/**
 * One shelf-stack minimum for bookcases, bookshelves, wardrobes, closets, pantries and linen closets.
 * #112 (hanging clearance) uses this same height: ten shelves, rod left out, is 86 3/4".
 * Folded clothes want about 7" clear. No toe kick — the engine builds none on these cases.
 */

/** Clear opening a shelf stack is built to leave, face to face. */
export const CLOSET_SHELF_CLEAR_IN = 7;
/** A tighter opening is not a shelf. The gap is never set below this. */
export const SHELF_CLEAR_FLOOR_IN = 4;
/** Shortest hang kept under a rod that stays. */
export const MIN_HANG_ROOM_IN = 40;
/** From the rod's stored y up to the shelf zone. The hat keeps this much room. */
export const ROD_SHELF_LIFT_IN = 2;

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
