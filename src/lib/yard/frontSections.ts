import type { Panel } from "./types";
import { P, panel, isNoDoorsPrompt, isNoDrawersPrompt } from "./fittedShared";
import { drawerBoxFromOpening } from "./shopPlural";
import { slideForDepth } from "./stockLook";

/**
 * Front sections (class F17 doors-drawers, 10-17). A carcase's front is split into sections, and each section owns its
 * own opening: a drawer section holds every requested drawer (stacked, and split into columns when the carcase is wider
 * than one drawer should be), a door section owns the opening its doors close, and shelves sit only in a door or open
 * section. No two of a door, a drawer front, a drawer box and a shelf share one volume. A requested drawer count always
 * builds, and an ask that names drawers and no doors gets no doors.
 */

/** A drawer wider than this sags and racks on its slides; a wider carcase splits its drawers into columns. */
export const DRAWER_COLUMN_MAX_IN = 36;
/** A drawer opening that shares the carcase with doors or shelves: a sensible utensil/tool drawer. */
export const SHARED_DRAWER_ROW_IN = 7;
const BACK_T = 0.25;

/** The ask names drawers (and does not take them away). */
export const asksDrawers = (lower: string) => /\bdrawers?\b/.test(lower) && !isNoDrawersPrompt(lower);
/** The ask names doors (and does not take them away). */
export const asksDoors = (lower: string) => /\bdoors?\b/.test(lower) && !isNoDoorsPrompt(lower);

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
  columns: number[];
};

/**
 * The drawer section across an inner span [x0, x0 + innerW], under `yTop` (the top's underside) and over `yBottom`
 * (the bottom's top face). It fills the carcase when nothing else shares the front; otherwise it takes a sensible
 * height at the top and sits on its own floor, so the doors or shelves below have their own opening.
 */
export function drawerSection(o: { x0: number; innerW: number; yBottom: number; yTop: number; depth: number; count: number; width: number; shares: boolean }): DrawerSection {
  const columns = drawerColumns(o.count, o.width);
  const rows = Math.max(...columns);
  const clear = o.yTop - o.yBottom;
  const secH = o.shares ? Math.round(Math.min(clear / 2, rows * SHARED_DRAWER_ROW_IN) * 8) / 8 : clear;
  const y0 = o.yTop - secH;
  const panels: Panel[] = [];
  if (o.shares) panels.push(panel("bottom", "Drawer bay bottom", o.x0, y0 - P, BACK_T, o.innerW, P, o.depth - BACK_T));
  const cols = columns.length;
  const colW = (o.innerW - (cols - 1) * P) / cols;
  for (let k = 1; k < cols; k++) panels.push(panel("divider", cols === 2 ? "Drawer bay divider" : `Drawer bay divider ${k}`, o.x0 + k * colW + (k - 1) * P, y0, BACK_T, P, secH, o.depth - BACK_T));
  // The box is as deep as the longest standard slide the inside depth takes, so the slide on the Buy list is the box's.
  const boxD = slideForDepth(o.depth - BACK_T);
  columns.forEach((m, k) => {
    const rowH = secH / m;
    const cx = o.x0 + k * (colW + P);
    for (let i = 0; i < m; i++) {
      const box = drawerBoxFromOpening(colW, rowH, o.depth);
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
  return { panels, y0, belowTop: o.shares ? y0 - P : null, columns };
}
