import { getCatalogItem } from "./catalog";

/**
 * The carcase sheet thickness every sheet builder cuts at (uprights, tops, shelves, dividers, fronts, drawer boxes).
 * 3/4" unless the build runs inside `withSheetThickness`. A stock switch to another sheet rebuilds the whole model at
 * that sheet's thickness, so every fit-between width, opening and front is derived from the picked stock, never
 * thinned in place after a 3/4" layout.
 */
export let P = 0.75;

/** Run one build with every sheet part cut from a sheet `t` thick. */
export function withSheetThickness<T>(t: number, build: () => T): T {
  const was = P;
  P = t;
  try {
    return build();
  } finally {
    P = was;
  }
}

/** The thickness of a plywood sheet in the catalogue, or null for any other stock. */
export function plySheetThickness(materialId: string | undefined): number | null {
  const it = materialId ? getCatalogItem(materialId) : undefined;
  if (!it || it.category !== "sheet_goods" || !/^plywood-/i.test(it.id)) return null;
  return it.dims.thickness ?? null;
}

/** Safety and structural parts a stock switch never thins below STRUCTURAL_MIN_IN: bed guards, ladders and their
 * rungs, load rails (bed side, head, foot and centre rails, ledgers, aprons, stretchers, stringers). */
export const STRUCTURAL_PART = /\b(?:guards?|ladders?|ladder[- ](?:stiles?|sides?)|rungs?|(?:side|head|foot|bed|centre|center|load)\s+rails?|aprons?|stretchers?|ledgers?|stringers?)\b/i;
/** The thinnest stock a safety or structural part is ever cut from. */
export const STRUCTURAL_MIN_IN = 0.75;

/** The note a switch refused for parts no sheet of the picked thickness is sold long enough for starts with this. */
export const keptLongNote = (pickName: string) => `Kept on 3/4" plywood, not ${pickName}:`;
