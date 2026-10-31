import { sheetWallT } from "./hollowDrawers";
import { inchFrac } from "./inchText";
import { sheetCutDims } from "./shopPlural";
import type { Panel } from "./types";

/** Rows 683/690: a laminated part's layers, read off the built part the way the cut list lays it up: count × the part's own sheet (two ¾" or three ½"). */
const PLY_WORD: Record<number, string> = { 2: "two", 3: "three", 4: "four" };
const PLY_GLYPH: Record<string, string> = { "0.5": "½", "0.75": "¾", "1.5": "1½" };
export function plies(p: Panel | undefined, total = false): string {
  const t = sheetWallT(p?.materialId ?? "");
  const n = p ? Math.max(2, Math.round(sheetCutDims(p.size.width, p.size.height, p.size.depth).thicknessIn / t)) : 2;
  const x = total ? n * t : t;
  return total ? `${PLY_GLYPH[String(x)] ?? inchFrac(x)}"` : `${PLY_WORD[n] ?? n} ${PLY_GLYPH[String(x)] ?? inchFrac(x)}"`;
}

/** The note's counter clause, from the same layers the step and the cut list read. */
export const counterPlies = (p: Panel | undefined) => `counter is ${plies(p)} plies laminated to ${plies(p, true)}`;
