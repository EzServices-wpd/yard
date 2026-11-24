/**
 * A unitless "N by N" / "N x N" whose next word is a count noun is a grid count, not inches.
 * `triple()` (the fitted prompt size reader) and `unlabeledTriple` (the honesty twin) both
 * skip that span. Overall size is cells × cell size + the carcase stock those builders already use.
 */
import { BANK_DRAWER_ROW_IN } from "./frontSections";
import { P } from "./fittedShared";

/** Open cubby wall bay module: `Math.round(W / 12)` when nobody typed a count (`fittedBuild`). */
const CUBBY_BAY_IN = 12;
/** `SHELF_DEFAULT_CLEAR` in fittedBuilders: the opening a shelf grid uses when no cell size is typed. */
const SHELF_CELL_IN = 10;
/** The 1/4" back the open cubby wall already sets behind a cube opening. */
const CUBE_BACK_IN = 0.25;

export type GridFamily = "opening" | "drawer" | "shelf";

export type CountGrid = {
  cols: number;
  rows: number;
  /** The count noun as typed ("cubbies", "drawers"). */
  noun: string;
  family: GridFamily;
  /** Clear opening, inches. Typed ("12 inch cubes") or the family's existing cell module. */
  cell: number;
  /** A cube cell: depth is one cell plus the back the builder already adds. */
  cube: boolean;
  index: number;
  pairLength: number;
  width: number;
  height: number;
  depth?: number;
};

const NOUN =
  "cubbyholes|cubbyhole|cubbies|cubby|compartments|compartment|cubes|cube|drawers|drawer|shelves|shelf|bays|bay";
const PAIR = new RegExp(
  String.raw`(?<![\d./])(\d+)(?![\d.])(\s*(?:in(?:ch(?:es)?)?|ft|feet|foot|'|")?)(\s*)(x|×|by)(\s*)(\d+)(?![\d.])`,
  "gi",
);
const UNIT = /in(?:ch(?:es)?)?|ft|feet|foot|'|"/i;
const LUMBER_B = new Set([2, 3, 4, 6, 8, 10, 12]);

function familyOf(noun: string): GridFamily {
  if (/^drawers?$/.test(noun)) return "drawer";
  if (/^shel(?:f|ves)$/.test(noun)) return "shelf";
  return "opening";
}

function defaultCell(family: GridFamily): number {
  if (family === "drawer") return BANK_DRAWER_ROW_IN;
  if (family === "shelf") return SHELF_CELL_IN;
  return CUBBY_BAY_IN;
}

/** Compact lumber names ("1x4", "2x4") stay stock. A spaced "2 x 4" does not. */
function compactLumber(raw: string, joiner: string, a: number, b: number): boolean {
  if (/\s/.test(raw) || !/^[x×]$/i.test(joiner)) return false;
  return (a === 1 || a === 2 || a === 4) && LUMBER_B.has(b);
}

function cellSize(text: string, family: GridFamily): { inches: number; cube: boolean } | null {
  const re = new RegExp(
    String.raw`(?<![\d./])(\d+(?:\.\d+)?)(?![\d.])\s*(?:in(?:ch(?:es)?)?|")\s+(${NOUN})\b`,
    "gi",
  );
  for (const m of text.matchAll(re)) {
    const noun = m[2].toLowerCase();
    if (familyOf(noun) !== family) continue;
    const inches = Number(m[1]);
    if (inches > 0 && inches <= 96) return { inches, cube: /^cubes?$/.test(noun) };
  }
  return null;
}

/**
 * The first unitless pair tied directly to a count noun, or null.
 * A unit on either number ("24 by 36 inch shelf") stays a size. A third number stays a triple.
 */
export function countGrid(text: string): CountGrid | null {
  const src = text.replace(/×/g, "x");
  for (const m of src.matchAll(new RegExp(PAIR.source, "gi"))) {
    const a = Number(m[1]);
    const b = Number(m[6]);
    const joiner = m[4];
    if (!(a >= 1 && b >= 1)) continue;
    if (UNIT.test(m[2] ?? "")) continue;
    const at = m.index ?? 0;
    const pairEnd = at + m[0].length;
    const rest = src.slice(pairEnd);
    if (/^\s*(?:in(?:ch(?:es)?)?|ft|feet|foot|'|")/i.test(rest)) continue;
    if (/^\s*(?:x|×|by)\s*\d/i.test(rest)) continue;
    const nounM = rest.match(new RegExp(String.raw`^\s+(${NOUN})\b`, "i"));
    if (!nounM) continue;
    if (compactLumber(m[0], joiner, a, b)) continue;
    const noun = nounM[1].toLowerCase();
    const family = familyOf(noun);
    const said = cellSize(src, family);
    const cell = said?.inches ?? defaultCell(family);
    const cube = /^cubes?$/.test(noun) || !!said?.cube;
    // A board between every cell, plus the two outer walls. Drawer rows have no shelf between them, so the height adds only the top and the bottom.
    const width = a * cell + (a + 1) * P;
    const height = b * cell + (family === "drawer" ? 2 : b + 1) * P;
    return {
      cols: a,
      rows: b,
      noun,
      family,
      cell,
      cube,
      index: at,
      pairLength: m[0].length,
      width,
      height,
      depth: cube ? cell + CUBE_BACK_IN : undefined,
    };
  }
  return null;
}

/** The prompt with a count-grid pair removed, so a size reader cannot take those numbers as inches. */
export function withoutCountGrid(text: string): string {
  const g = countGrid(text);
  if (!g) return text;
  return `${text.slice(0, g.index)} ${text.slice(g.index + g.pairLength)}`;
}
