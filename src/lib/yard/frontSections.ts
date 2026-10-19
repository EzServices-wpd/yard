import type { Panel } from "./types";
import { frontCue } from "./cueRules";
import { createId } from "@/lib/utils";
import { SLIDE_LENGTHS_IN, slideForDepth } from "./stockLook";

/**
 * Front sections (class F17 doors-drawers, 10-17). A carcase's front is split into sections, and each section owns its
 * own opening: a drawer section holds every requested drawer (stacked, and split into columns when the carcase is wider
 * than one drawer should be), a door section owns the opening its doors close, and shelves sit only in a door or open
 * section. No two of a door, a drawer front, a drawer box and a shelf share one volume. A requested drawer count always
 * builds, and an ask that names drawers and no doors gets no doors.
 */

/** A drawer wider than this sags and racks on its slides; a wider carcase splits its drawers into columns. */
export const DRAWER_COLUMN_MAX_IN = 36;
/** A drawer front taller than this is no drawer anyone builds: a taller carcase keeps a drawer bank and opens the rest. */
export const DRAWER_ROW_MAX_IN = 15;
/** A drawer row in a drawer bank at the foot of a tall carcase (a sweater or linen drawer). */
export const BANK_DRAWER_ROW_IN = 10;
/** The drawers would each stand taller than a real drawer if they filled this span alone. */
export function drawersTooTallToFill(count: number, width: number, clear: number): boolean {
  return clear / Math.max(...drawerColumns(count, width)) > DRAWER_ROW_MAX_IN + 1e-6;
}
/** A drawer opening that shares the carcase with doors or shelves: a sensible utensil/tool drawer. */
export const SHARED_DRAWER_ROW_IN = 7;
const BACK_T = 0.25;
const P = 0.75;
const isNoDrawersPrompt = (lower: string) => frontCue(lower, "drawers").none;
const isNoDoorsPrompt = (lower: string) => frontCue(lower, "doors").none;
/** A part of a front section (materialId: the carcase stock; 3/4" plywood unless the caller sets one). */
function panel(type: Panel["type"], name: string, x: number, y: number, z: number, w: number, h: number, d: number, materialId = "plywood-3-4-4x8"): Panel {
  return { id: createId(type.slice(0, 2)), type, name, position: { x, y, z }, size: { width: w, height: h, depth: d }, materialId };
}

/** The ask names drawers (and does not take them away). */
export const asksDrawers = (lower: string) => /\bdrawers?\b/.test(lower) && !isNoDrawersPrompt(lower);
/** The ask names doors (and does not take them away). */
export const asksDoors = (lower: string) => /\bdoors?\b/.test(lower) && !isNoDoorsPrompt(lower);

const WORD_N: Record<string, number> = { a: 1, an: 1, one: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
/** The drawer count the ask names: "3 drawers", "two drawers", "a drawer"; bare "drawers" is two, "drawer" one. */
export function askedDrawerCount(lower: string): number {
  if (!asksDrawers(lower)) return 0;
  const m = lower.match(/\b(\d+|an?|one|single|two|three|four|five|six|seven|eight|nine|ten)\s+(?:[a-z]+\s+)?drawers?\b/);
  const n = m ? WORD_N[m[1]] ?? Number(m[1]) : /\bdrawers\b/.test(lower) ? 2 : 1;
  return Math.max(1, Math.min(12, n));
}

/** Doors stay on only when the ask does not name drawers without doors. */
export function doorsKept(lower: string, unitDoors: boolean): boolean {
  return unitDoors && !(asksDrawers(lower) && !asksDoors(lower));
}

/** Drawers per column: one column up to DRAWER_COLUMN_MAX_IN wide, more past it; the left columns take any extra. */
export function drawerColumns(count: number, width: number): number[] {
  const cols = Math.max(1, Math.min(count, Math.ceil(width / DRAWER_COLUMN_MAX_IN - 1e-6)));
  return Array.from({ length: cols }, (_, k) => Math.floor(count / cols) + (k < count % cols ? 1 : 0));
}

const COLUMN_WORD = (k: number, cols: number) =>
  cols === 1 ? "" : cols === 2 ? (k === 0 ? "Left " : "Right ") : cols === 3 ? ["Left ", "Middle ", "Right "][k] : `Column ${k + 1} `;

export type DrawerSection = {
  panels: Panel[];
  /** Bottom of the drawer section (the top face of its floor when it shares the carcase). */
  y0: number;
  /** Top of the space left for doors or open shelves below it (the underside of the drawer floor), or null when the drawers fill the carcase. */
  belowTop: number | null;
  /** Bottom of the open space left above a drawer bank at the foot of the carcase (the top face of its cap), or null. */
  aboveBottom: number | null;
  columns: number[];
};

/**
 * The drawer section across an inner span [x0, x0 + innerW], under `yTop` (the top's underside) and over `yBottom`
 * (the bottom's top face). It fills the carcase when nothing else shares the front; otherwise it takes a sensible
 * height at the top and sits on its own floor, so the doors or shelves below have their own opening.
 */
export function drawerSection(o: { x0: number; innerW: number; yBottom: number; yTop: number; depth: number; count: number; width: number; shares: boolean; rowIn?: number; atFoot?: boolean }): DrawerSection {
  const columns = drawerColumns(o.count, o.width);
  const rows = Math.max(...columns);
  const clear = o.yTop - o.yBottom;
  const secH = o.shares ? Math.round(Math.min(clear / 2, rows * (o.rowIn ?? SHARED_DRAWER_ROW_IN)) * 8) / 8 : clear;
  // A shared section sits at the top on its own floor, or (atFoot) on the carcase bottom under its own cap.
  const foot = o.shares && !!o.atFoot;
  const y0 = foot ? o.yBottom : o.yTop - secH;
  const panels: Panel[] = [];
  if (o.shares && !foot) panels.push(panel("bottom", "Drawer bay bottom", o.x0, y0 - P, BACK_T, o.innerW, P, o.depth - BACK_T));
  if (foot) panels.push(panel("bottom", "Drawer bay top", o.x0, y0 + secH, BACK_T, o.innerW, P, o.depth - BACK_T));
  const cols = columns.length;
  const colW = (o.innerW - (cols - 1) * P) / cols;
  for (let k = 1; k < cols; k++) panels.push(panel("divider", cols === 2 ? "Drawer bay divider" : `Drawer bay divider ${k}`, o.x0 + k * colW + (k - 1) * P, y0, BACK_T, P, secH, o.depth - BACK_T));
  // The box is as deep as the longest standard slide the inside depth takes, so the slide on the Buy list is the box's.
  // A box shallower than the shortest slide runs on its own wood runners, an 1/8" short of the back.
  const inside = o.depth - BACK_T;
  const runners = inside < SLIDE_LENGTHS_IN[0];
  const boxD = runners ? Math.floor((inside - 0.125) * 8) / 8 : slideForDepth(inside);
  const r8 = (n: number) => Math.round(n * 8) / 8;
  columns.forEach((m, k) => {
    const rowH = secH / m;
    const cx = o.x0 + k * (colW + P);
    for (let i = 0; i < m; i++) {
      // Side-mount slides take 1/2" a side; wood runners a 1/16" a side.
      const box = { boxW: r8(colW - (runners ? 0.125 : 1)), boxH: r8(rowH - 0.125), frontW: r8(colW - (runners ? 0.0625 : 0.25)) };
      const one = o.count === 1;
      const word = COLUMN_WORD(k, cols);
      const boxName = one ? "Drawer" : `${word}${word ? "drawer" : "Drawer"} ${i + 1}`;
      const frontName = one ? "Drawer front" : `${word}${word ? "drawer" : "Drawer"} front ${i + 1}`;
      const y = y0 + i * rowH;
      const z = o.depth - boxD;
      panels.push(panel("drawer", boxName, cx + (colW - box.boxW) / 2, y, z, box.boxW, box.boxH, boxD));
      panels.push(panel("rail", frontName, cx + (colW - box.frontW) / 2, y, o.depth - P, box.frontW, box.boxH, P));
    }
  });
  return { panels, y0, belowTop: o.shares && !foot ? y0 - P : null, aboveBottom: foot ? y0 + secH + P : null, columns };
}
