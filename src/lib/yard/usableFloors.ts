/**
 * Usable floors (Critic #103 r2 row 141, P1): the smallest size a build is refused under is a size a person can use,
 * not the size at which its parts merely stop going negative. One shared table names, per family, the least usable
 * size on each axis and where that number comes from. A family is the engine's own build class (the fitted family and
 * program the builder chose, or the carcass it made), never the words of one item.
 *
 * On top of the table, a build is only usable when it builds cleanly (usableBuild): every part real (I38), no more
 * hidden overlaps (I26) or ungrounded parts (I1) than the same ask at its default size, every shelf bay a hand fits
 * into and every drawer a flat hand fits into. The minimum a refusal names is the smallest size that passes both.
 */
import { getCatalogItem } from "./catalog";
import { inchFrac } from "./inchText";
import { benchModelBox } from "./benchFrame";
import { isBoughtHardwareName } from "./boughtHardware";
import { ungroundedParts } from "./grounded";
import { drawerBoxes } from "./hollowDrawers";
import { hiddenOverlaps } from "./solids";
import type { YardProject } from "./types";

export type Axis = "width" | "depth" | "height";
export type FloorFamily = "storage" | "table" | "desk" | "workTop" | "seat" | "measured";

/** One axis of a family's floor: `inches`, plus `panels` panel thicknesses of the build's own sheet. */
export type AxisFloor = { inches: number; panels?: number; why: string; source: string };
export type FamilyFloor = { family: Exclude<FloorFamily, "measured">; label: string; width: AxisFloor; depth: AxisFloor; height: AxisFloor };

/** A bare hand, rolled, reaches into an opening 3 3/4" square (MIL-STD-1472G, one-hand access to the wrist, 95 mm). */
export const HAND_ROLLED_IN = 3.75;
/** A bare hand, flat, slides into an opening 2" by 4" (MIL-STD-1472G, one-hand access, flat hand 55 × 100 mm). */
export const HAND_FLAT_IN = { height: 2, width: 4 } as const;
/**
 * A pulled drawer is open on top: the flat hand goes in from above, so it needs the hand's 4" across between the sides,
 * not its thickness in height. Its depth only has to hold something: 1", a jewelry box's ring-tray drawer, the
 * shallowest drawer commonly made (common practice, no formal standard).
 */
export const DRAWER_LEAST_DEPTH_IN = 1;

const MIL = "MIL-STD-1472G (DoD human engineering), one-hand access opening, bare hand to the wrist";
const EN1729 = "EN 1729-1:2015 (chairs and tables for educational institutions), size mark 0, the smallest standard size";

/**
 * The floor table. Storage openings take a hand; seats, desks and work tops take the smallest standard school
 * furniture; tables take the smallest common low table. Inches, fractions only when said.
 */
export const USABLE_FLOORS: Record<FamilyFloor["family"], FamilyFloor> = {
  storage: {
    family: "storage",
    label: "Storage carcass (bookcase, shelf unit, cabinet, dresser, chest, box, rack)",
    width: { inches: HAND_ROLLED_IN, panels: 2, why: `a ${inchFrac(HAND_ROLLED_IN)}" opening a hand reaches into, between its two sides`, source: `${MIL}: rolled hand 3.75 in square` },
    height: { inches: HAND_ROLLED_IN, panels: 2, why: `a ${inchFrac(HAND_ROLLED_IN)}" opening a hand reaches into, between its bottom and top`, source: `${MIL}: rolled hand 3.75 in square` },
    depth: { inches: 3.5, why: "the depth of a 2x4 wall's stud bay, the shallowest standard cabinet", source: "A 2x4 stud is 3 1/2\" deep (dressed size, NIST PS 20 American Softwood Lumber Standard); recessed medicine cabinets are built to that bay" },
  },
  table: {
    family: "table",
    label: "Table (dining, end, coffee, side)",
    width: { inches: 12, why: "a top the size of the smallest common side table", source: "Common practice: drink and side tables start about 12\" across (no formal standard)" },
    depth: { inches: 12, why: "a top the size of the smallest common side table", source: "Common practice: drink and side tables start about 12\" across (no formal standard)" },
    height: { inches: 12, why: "the height of a low table used sitting on the floor", source: "Common practice: floor-seated low tables (chabudai) are about 30 cm / 12\" tall (no formal standard)" },
  },
  desk: {
    family: "desk",
    label: "Desk (a work top with knee room)",
    width: { inches: 21.625, why: "the least top one person works at (EN 1729)", source: `${EN1729}: least top length per person 550 mm (the reduced value)` },
    depth: { inches: 15.75, why: "the least top depth one person works at (EN 1729)", source: `${EN1729}: least top depth 400 mm (the reduced value)` },
    height: { inches: 15.75, why: `the lowest standard desk (EN 1729), with 12 13/16" of knee room under it`, source: `${EN1729}: table height 400 mm; leg room height 325 mm` },
  },
  workTop: {
    family: "workTop",
    label: "Work top (workbench, counter with no knee room)",
    width: { inches: 21.625, why: "the least top one person works at (EN 1729)", source: `${EN1729}: least top length per person 550 mm (the reduced value)` },
    depth: { inches: 15.75, why: "the least top depth one person works at (EN 1729)", source: `${EN1729}: least top depth 400 mm (the reduced value)` },
    height: { inches: 15.75, why: "the lowest standard work top (EN 1729)", source: `${EN1729}: table height 400 mm` },
  },
  seat: {
    family: "seat",
    label: "Seat (bench, stool, chair)",
    width: { inches: 8.25, why: "the narrowest standard seat (EN 1729)", source: `${EN1729}: least seat width 210 mm` },
    depth: { inches: 8.875, why: "the shallowest standard seat (EN 1729)", source: `${EN1729}: seat depth 225 mm` },
    height: { inches: 8.25, why: "the lowest standard seat (EN 1729)", source: `${EN1729}: seat height 210 mm` },
  },
};

const count = (p: YardProject, t: string) => p.panels.filter((q) => q.type === t).length;
/** Two sides, a bottom and a back: the carcass every storage builder makes. */
export const isCarcass = (p: YardProject) => count(p, "upright") >= 2 && count(p, "back") >= 1 && count(p, "bottom") >= 1;

/** The build's family, from the class the engine built it as (never from the words typed). */
export function floorFamily(p: YardProject): FloorFamily {
  const f = p.fitted;
  if (f?.program === "table" || f?.family === "table") return "table";
  if (f?.family === "seat" || f?.program === "bench" || p.kind === "furniture") return "seat";
  if (f?.program === "desk") return f.unit?.kneeW ? "desk" : "workTop";
  // Open wall pieces (a picture rail, a ledge) hold no hand-in storage unless they are a carcass: measured, not floored.
  if (f?.family === "floor-carcase" || f?.family === "hung-cabinet" || isCarcass(p)) return "storage";
  return "measured";
}

/** The sheet a carcass is cut from, as its panel thickness (3/4" plywood → 0.75). */
export function sheetThickness(p: YardProject): number {
  const c = getCatalogItem(p.primaryMaterialId);
  return c?.formFactor === "sheet" ? (c.dims.thickness ?? c.dims.height ?? 0.75) : 0.75;
}

const up16 = (n: number) => Math.ceil(n * 16 - 1e-6) / 16;

/** The family's least usable size on one axis, in inches (to 1/16), with why; null for a measured family. */
export function floorOn(p: YardProject, axis: Axis): { inches: number; why: string; floor: AxisFloor } | null {
  const fam = floorFamily(p);
  if (fam === "measured") return null;
  const f = USABLE_FLOORS[fam][axis];
  return { inches: up16(f.inches + (f.panels ?? 0) * sheetThickness(p)), why: f.why, floor: f };
}

/**
 * The least clear height of a shelf bay: the gap between two stacked shelves (or a bottom, a shelf and a top) that
 * span most of the carcass, with no drawer in it. Infinity when the build has no bays.
 */
export function leastBay(p: YardProject): number {
  if (!isCarcass(p)) return Infinity;
  const ups = p.panels.filter((q) => q.type === "upright");
  const x0 = Math.min(...ups.map((q) => q.position.x + q.size.width)), x1 = Math.max(...ups.map((q) => q.position.x));
  const inner = x1 - x0;
  if (!(inner > 0)) return Infinity;
  const flats = p.panels
    .filter((q) => (q.type === "shelf" || q.type === "bottom" || q.type === "top") && Math.min(q.position.x + q.size.width, x1) - Math.max(q.position.x, x0) >= inner / 2)
    .sort((a, b) => a.position.y - b.position.y);
  const drawers = p.panels.filter((q) => q.type === "drawer");
  let least = Infinity;
  for (let i = 1; i < flats.length; i++) {
    const lo = flats[i - 1], hi = flats[i];
    const y0 = lo.position.y + lo.size.height, y1 = hi.position.y;
    if (drawers.some((d) => d.position.y < y1 - 0.01 && d.position.y + d.size.height > y0 + 0.01)) continue;
    least = Math.min(least, y1 - y0);
  }
  return least;
}

/** The least inside of any drawer box (height over its bottom, width between its sides). Infinity when none. */
export function leastDrawer(p: YardProject): { height: number; width: number } {
  let height = Infinity, width = Infinity;
  for (const box of drawerBoxes(p.panels)) {
    const parts = box.drawerId ? p.panels.filter((q) => q.drawerId === box.drawerId) : [];
    const sides = parts.filter((q) => q.drawerPart === "side").sort((a, b) => a.position.x - b.position.x);
    const bottom = parts.find((q) => q.drawerPart === "bottom");
    width = Math.min(width, sides.length === 2 ? sides[1].position.x - (sides[0].position.x + sides[0].size.width) : box.size.width);
    height = Math.min(height, box.size.height - (bottom?.size.height ?? 0));
  }
  return { height, width };
}

/**
 * How far the made parts reach on each axis (the bench's model box: panels and sticks). Bought hardware drawn on the
 * model (a coat hook standing proud of its rail) reaches past the wood by design and is not part of the size.
 */
export function reach(p: YardProject): Record<Axis, number> {
  const b = benchModelBox({ ...p, panels: p.panels.filter((x) => !isBoughtHardwareName(x.name)) });
  return { width: b.maxX - b.minX, height: b.maxY - b.minY, depth: b.maxZ - b.minZ };
}

/**
 * What makes a build clean, measured once so a candidate size is held to the same ask at its default size. `spill` is
 * how far the default's parts reach past its stated size on each axis (an easel leg, a top's overhang): a typed size
 * is held to its own number plus that, never to a box the design was never inside.
 */
export type Cleanness = { overlaps: number; ungrounded: number; bay: number; drawer: { height: number; width: number }; spill: Record<Axis, number> };
export function cleanness(p: YardProject): Cleanness {
  const r = reach(p);
  const spill = { width: Math.max(0, r.width - p.overall.width), height: Math.max(0, r.height - p.overall.height), depth: Math.max(0, r.depth - p.overall.depth) };
  return { overlaps: hiddenOverlaps(p).length, ungrounded: ungroundedParts(p).length, bay: leastBay(p), drawer: leastDrawer(p), spill };
}

/**
 * A build outgrows the size typed on an axis when the builder made it bigger (a frame clamped up to its least size) or
 * its parts reach past the number shown by more than the design's own spill and a sixteenth (a 3/4" abacus frame
 * called 1/2" deep).
 */
export function outgrows(p: YardProject, a: Axis, typed: number, spill: number): boolean {
  // Past a sixteenth: the shop's own rounding (a shelf cut to the next 1/8" from 6 1/16") is the size typed.
  return Math.max(p.overall[a], reach(p)[a] - spill) > typed + 1 / 16 + 1e-6;
}

/** Why a size is not usable, as the refusal says it ("…needs at least 28 1/2" tall <why>"). */
export const UNUSABLE = {
  none: "for anything to build",
  real: "for every part to be real",
  bay: `for a hand's room (${inchFrac(HAND_ROLLED_IN)}") in every shelf bay`,
  drawer: `for a flat hand's room (${HAND_FLAT_IN.width}" across) and ${DRAWER_LEAST_DEPTH_IN}" of depth in every drawer`,
  overlap: "for its parts to fit without running into each other",
  outgrows: "for its parts to fit inside it",
  loose: "for every part to rest on the floor, a wall or another part",
} as const;

/**
 * Usable and clean: real parts (`realParts` is I38's check), when `hands` is asked every bay a rolled hand fits into and every drawer a
 * flat hand fits into, and, when `fit` is asked, no overlap or loose part. A build that falls short of the absolute
 * rule is held to the same ask at its default size instead (`base`, read only then), so a default never refuses
 * itself. Returns the first reason it isn't usable, or null.
 */
export function unusable(p: YardProject, base: () => Cleanness, realParts: (p: YardProject) => boolean, fit = true, hands = true): string | null {
  if (p.refused || !p.panels.length) return UNUSABLE.none;
  if (!realParts(p)) return UNUSABLE.real;
  if (!hands) return fit ? unclean(p, base) : null;
  const bay = leastBay(p), drawer = leastDrawer(p);
  if (bay < HAND_ROLLED_IN - 1e-6 && bay < base().bay - 1e-6) return UNUSABLE.bay;
  if ((drawer.height < DRAWER_LEAST_DEPTH_IN - 1e-6 && drawer.height < base().drawer.height - 1e-6) || (drawer.width < HAND_FLAT_IN.width - 1e-6 && drawer.width < base().drawer.width - 1e-6)) return UNUSABLE.drawer;
  return fit ? unclean(p, base) : null;
}

/** More overlaps or loose parts than the same ask at its default size. */
function unclean(p: YardProject, base: () => Cleanness): string | null {
  const overlaps = hiddenOverlaps(p).length;
  if (overlaps && overlaps > base().overlaps) return UNUSABLE.overlap;
  const loose = ungroundedParts(p).length;
  if (loose && loose > base().ungrounded) return UNUSABLE.loose;
  return null;
}

/**
 * Shelves spread evenly up a `zone`-tall stack (each `t` thick): how many of `asked` fit with every bay a rolled hand
 * reaches into, and the zone the full count needs. A typed count is never cut (it is refused instead, tooSmall.ts);
 * only a default count shrinks, and the card says so.
 */
export function shelvesThatFit(asked: number, zone: number, t: number): { fit: number; zoneFor: number } {
  const fit = Math.max(0, Math.min(asked, Math.floor((zone + 1e-6) / (HAND_ROLLED_IN + t)) - 1));
  return { fit, zoneFor: (asked + 1) * (HAND_ROLLED_IN + t) };
}
