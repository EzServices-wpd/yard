/**
 * Wine-rack geometry and voice helpers.
 */
import { inchFrac } from "./inchText";
import { spokenBottleCount, pick, P } from "./fittedShared";

export const WINE_BOTTLE_CLEAR = 3.5;
export const WINE_BOTTLE_SPAN = 3.75;

export type WineRackLayout = {
  rows: number;
  cols: number;
  /** true = divider grid, one opening per bottle; false = open rows, bottles side by side. */
  grid: boolean;
  capacity: number;
  /** Asked count did not fit at the bottle pitch within the height. */
  heightCapped: boolean;
  /** Short of the count: overall height that fits every asked bottle at this width. */
  fitH?: number;
  /** Short of the count: overall width that fits every asked bottle at this height. */
  fitW?: number;
  cellW: number;
  /** Clear height of every bottle row. */
  cellH: number;
  /** Overall height (derived from the rows when no height was typed). */
  H: number;
  /** Open shelves above the bottle grid (typed height taller than the count needs). */
  openShelves: number;
  /** Clear height of each open shelf space. */
  openClear: number;
  /** Spare height under ~6" clear: the bottle rows sit on a plinth this tall so the top cap lands at the typed height. */
  plinth: number;
  /** True when the height came from the rows, not from a typed/default height. */
  derivedH: boolean;
  /** Bottles fill the typed height ("as many as fit" / no count). */
  filled: boolean;
  /** The stranger typed the height (vs the default height). */
  heightTyped: boolean;
};

/** Front cradle rail on every bottle row: tall enough to hold the neck, scalloped so the bottle passes. */
export const WINE_RAIL_H = 1.5;
/** Highest a cradle scallop floor sits: a 3/4" lip, lower when the row needs it so a 3 1/2" bottle clears with 1/16" to spare. */
export const WINE_CRADLE_LIP = 0.75;

/** Cradle scallop floor and the clear height a bottle gets above it on a row of `cellH` clear. */
export function wineCradle(cellH: number): { floor: number; clear: number } {
  const floor = Math.max(1 / 8, Math.min(WINE_CRADLE_LIP, cellH - WINE_BOTTLE_CLEAR - 1 / 16));
  return { floor, clear: cellH - floor };
}

/**
 * Face outline ("xy", rail-local) of a scalloped cradle rail: a WINE_RAIL_H board with one circular
 * scallop WINE_BOTTLE_CLEAR wide per bottle centre, bottoming out at `floor`. The scallop radius is at
 * least the bottle radius, so a bottle resting on the scallop floor passes through it.
 */
export function wineCradleOutline(w: number, centres: number[], floor: number): [number, number][] {
  const c = WINE_BOTTLE_CLEAR;
  const d = WINE_RAIL_H - floor;
  const R = (c * c / 4 + d * d) / (2 * d);
  const pts: [number, number][] = [[0, 0], [w, 0], [w, WINE_RAIL_H]];
  const round64 = (v: number) => Math.round(v * 64) / 64;
  for (const cx of [...centres].sort((a, b) => b - a)) {
    for (let i = 0; i <= 16; i++) {
      const x = cx + c / 2 - (i * c) / 16;
      const y = floor + R - Math.sqrt(Math.max(0, R * R - (x - cx) ** 2));
      pts.push([round64(Math.min(w, Math.max(0, x))), round64(Math.min(WINE_RAIL_H, y))]);
    }
  }
  pts.push([0, WINE_RAIL_H]);
  return pts;
}

/** Bottle row pitch: 3¾" clear opening + one ¾" shelf ≈ 4½", the same rule as the columns. */
export const WINE_ROW_CLEAR = 3.75;
/**
 * Row tolerance: a bottle row may take up to ¼" of spare height (3¾" → 4" clear) and no more.
 * Why ¼": the widest common 750 ml bottle (Champagne/sparkling) is about 3½" across, so a 4" row
 * still cradles it with ½" to slide a hand in, one bottle high, inside the 4–4¼" cubbies of store-bought
 * racks. Past that a bottle sits loose and the row starts to read as a shelf. Spare beyond ¼" a row
 * goes to a plinth (or a capped open shelf at 6"+ clear), so the rows stay on the standard pitch.
 */
export const WINE_ROW_SLACK = 0.25;
/** Largest bottle row we ever build — the standard row plus the slack, one bottle high. */
export const WINE_ROW_MAX_CLEAR = WINE_ROW_CLEAR + WINE_ROW_SLACK;
/** Open-shelf clear above a bottle grid: 6" (stemless glasses, a corkscrew) up to 12" (decanters, books). */
export const WINE_OPEN_MIN = 6;
export const WINE_OPEN_MAX = 12;
/** A plinth sits back from the front like a toe kick. */
export const WINE_PLINTH_SETBACK = 3.5;

/** "as many as fit" / "fill it" / "max bottles" — fill the height with bottles. */
export function wantsBottleFill(text: string): boolean {
  return /\bas many (?:bottles )?as (?:will )?fit\b|\bfill(?:s|ed)?\b(?! ?in)|\bmax(?:imum)? (?:bottles|capacity)\b/i.test(text);
}

/**
 * Wine rack grid. Board thickness counts: columns = floor((inner + t) / (3.5 + t)).
 * Rows sit on the bottle pitch (3¾" clear + board) and take at most ¼" of spare each (WINE_ROW_SLACK):
 * - a typed bottle count wins: the grid is sized to the count, rounded up to a full grid;
 *   no typed height → the carcass is only as tall as those rows; typed height → the leftover
 *   above the grid becomes capped open shelves 6–12" clear (under 6" of spare, the rows sit on a plinth);
 * - no count (or "as many as fit") with a height → bottle rows fill it, spare under the rows is a plinth.
 * A height too short for the count keeps the height, builds the full rows that fit, and names the
 * height (and width) that fit every bottle, measured with the openings this build makes.
 */
export function wineRackLayout(o: {
  W: number;
  H: number;
  t: number;
  asked: number | null;
  shelfCount?: number;
  heightTyped?: boolean;
  fill?: boolean;
}): WineRackLayout {
  const { W, t, asked } = o;
  const innerW = W - 2 * t;
  const maxCols = Math.max(1, Math.floor((innerW + t) / (WINE_BOTTLE_CLEAR + t) + 1e-9));
  const pitch = WINE_ROW_CLEAR + t;
  const gridOf = (rows: number, cell: number) => rows * cell + (rows - 1) * t;
  const base = { openShelves: 0, openClear: 0, plinth: 0, derivedH: false, filled: false, heightTyped: !!o.heightTyped };
  // Spare height under the rows: ≤ ¼" a row spreads into the rows; anything more is a plinth.
  const settle = (rows: number, spare: number) =>
    spare <= rows * WINE_ROW_SLACK + 1e-9
      ? { cellH: WINE_ROW_CLEAR + Math.max(0, spare) / rows, plinth: 0 }
      : { cellH: WINE_ROW_CLEAR, plinth: spare };
  // Fill a fixed inner height with standard-pitch rows; the spare is settled above.
  const fill = (innerH: number) => {
    const rows = Math.max(1, Math.floor((innerH + t) / pitch + 1e-9));
    return { rows, ...settle(rows, innerH - gridOf(rows, WINE_ROW_CLEAR)) };
  };
  // The size that fits every asked bottle (rounded up to the next 1/4").
  const up4 = (n: number) => Math.ceil(n * 4 - 1e-9) / 4;
  if (asked != null && asked >= 1) {
    const cols = Math.min(maxCols, asked);
    const cellW = (innerW - (cols - 1) * t) / cols;
    const wantRows = Math.ceil(asked / cols);
    if (!o.heightTyped) {
      const H = 2 * t + gridOf(wantRows, WINE_ROW_CLEAR);
      return { ...base, rows: wantRows, cols, grid: true, capacity: wantRows * cols, heightCapped: false, cellW, cellH: WINE_ROW_CLEAR, H, derivedH: true };
    }
    const innerH = o.H - 2 * t;
    const maxRows = Math.max(1, Math.floor((innerH + t) / pitch + 1e-9));
    if (o.fill || wantRows >= maxRows) {
      // A typed height is a hard cap; the count is a target. Build the full rows that fit.
      const f = fill(innerH);
      const capacity = f.rows * cols;
      const heightCapped = capacity < asked;
      // Fit sizes come from the openings this build makes (its row pitch, opening width and board),
      // so the named size rebuilds to a rack that holds every bottle.
      const colsNeed = Math.ceil(asked / f.rows);
      const fitH = heightCapped ? up4(2 * t + gridOf(wantRows, f.cellH)) : undefined;
      const fitW = heightCapped ? up4(2 * t + colsNeed * cellW + (colsNeed - 1) * t) : undefined;
      return { ...base, rows: f.rows, cols, grid: true, capacity, heightCapped, cellW, cellH: f.cellH, H: o.H, filled: !!o.fill, plinth: f.plinth, fitH, fitW };
    }
    // The count wins: grid for the count, leftover height becomes open shelves above it.
    const rows = wantRows;
    // Height above the grid's closing shelf, up to the typed top.
    const above = o.H - (2 * t + gridOf(rows, WINE_ROW_CLEAR));
    let openShelves = 0;
    let openClear = 0;
    let spare = 0;
    if (above + 1e-9 >= WINE_OPEN_MIN + t) {
      // Fewest capped open shelves with each space ≤ 12" clear, split evenly (≥ 6" clear);
      // the last one is closed by the top cap at the typed height.
      let n = Math.max(1, Math.ceil((above - 1e-9) / (WINE_OPEN_MAX + t)));
      let c = above / n - t;
      if (c < WINE_OPEN_MIN - 1e-9) {
        n -= 1;
        c = WINE_OPEN_MAX;
      }
      openShelves = n;
      openClear = c;
      spare = above - n * (c + t);
    } else {
      // Under 6" clear of spare: no sliver shelf — the rows sit on a plinth, top cap at the typed height.
      spare = above;
    }
    const s = settle(rows, spare);
    return { ...base, rows, cols, grid: true, capacity: rows * cols, heightCapped: false, cellW, cellH: s.cellH, H: o.H, openShelves, openClear, plinth: s.plinth };
  }
  // Open rows (no dividers): bottles side by side on pitch shelves, or the spoken shelf count.
  const perRow = Math.max(1, Math.floor(innerW / WINE_BOTTLE_SPAN + 1e-9));
  const innerH = o.H - 2 * t;
  if (o.shelfCount && o.shelfCount > 1) {
    const maxRows = Math.max(1, Math.floor((innerH + t) / (WINE_BOTTLE_CLEAR + t) + 1e-9));
    const rows = Math.max(1, Math.min(maxRows, o.shelfCount - 1));
    return { ...base, rows, cols: perRow, grid: false, capacity: rows * perRow, heightCapped: false, cellW: innerW / perRow, cellH: (innerH - (rows - 1) * t) / rows, H: o.H };
  }
  // Open rows on the standard pitch, one bottle high; spare under the rows is a plinth.
  const f = fill(innerH);
  return { ...base, rows: f.rows, cols: perRow, grid: false, capacity: f.rows * perRow, heightCapped: false, cellW: innerW / perRow, cellH: f.cellH, H: o.H, plinth: f.plinth, filled: !!o.heightTyped };
}

/** Shop inches to the nearest 1/16" (3.9 → 3 7/8, 3.97 → 4). */
export function inch16(n: number): string {
  return inchFrac(n);
}
export function _inch16Legacy(n: number): string {
  const e = Math.round(n * 16);
  const whole = Math.floor(e / 16);
  let num = e % 16;
  let den = 16;
  while (num && num % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  return num ? (whole ? `${whole} ${num}/${den}` : `${num}/${den}`) : `${whole}`;
}

/** Plain capacity sentence for the notes — the real layout, never the row count alone. */
export function wineCapacityVoice(l: WineRackLayout, asked: number | null, H: number): string {
  const grid = `${l.rows} row${l.rows === 1 ? "" : "s"} × ${l.cols} across`;
  const pitchVoice = `rows on a ${inch16(l.cellH + 0.75)}" pitch, one bottle high`;
  const shelfWord = `${l.openShelves} open shel${l.openShelves === 1 ? "f" : "ves"}`;
  const heightWord = l.heightTyped ? `the ${inch16(l.H)}" height you typed` : `the full ${inch16(l.H)}" height`;
  const plinthVoice = l.plinth > 0
    ? ` The bottle rows sit on a ${inch16(l.plinth)}" plinth, recessed like a kick strip, so the top cap lands at ${heightWord}.`
    : "";
  const openUse = l.openClear < 8 ? "stemless glasses, a corkscrew and stoppers" : "glasses, decanters or books";
  const heightVoice = l.derivedH
    ? ` Built ${inch16(l.H)}" tall — just the rows the bottles need.`
    : l.openShelves > 0
      ? ` Above the bottles: ${shelfWord}, ${inch16(l.openClear)}" clear${l.openShelves === 1 ? "" : " each"}, for ${openUse} — capped at the ${inch16(l.H)}" height you typed.${plinthVoice}`
      : l.plinth > 0
        ? plinthVoice
        : l.filled
          ? ` Bottle rows fill the ${inch16(l.H)}" height.`
          : "";
  if (!l.grid) {
    return `Holds about ${l.capacity} bottles — ${l.rows} rows of about ${l.cols} bottles each, lying side by side on open shelves (${pitchVoice}).${plinthVoice}`;
  }
  if (asked == null || l.capacity === asked) {
    return `Holds ${l.capacity} bottles${l.openShelves ? `, with ${shelfWord} above` : ""} — ${grid}, one opening per bottle (${pitchVoice}).${heightVoice}`;
  }
  if (l.capacity > asked) {
    return `Holds ${l.capacity} bottles (room for the ${asked} bottles you asked for${l.openShelves ? `), with ${shelfWord} above (` : "; "}${grid}, one opening per bottle, ${pitchVoice}).${heightVoice}`;
  }
  // The typed size wins; say the shortfall and the size that fits them all.
  const fitVoice = l.fitH
    ? `; about ${inch16(l.fitH)}" tall fits all ${asked}${l.fitW && l.fitW <= 96 ? ` (or about ${inch16(l.fitW)}" wide at ${inch16(H)}" tall)` : ""}`
    : "";
  return `Holds ${l.capacity} bottles at this height — ${asked - l.capacity} short of the ${asked} you asked for${fitVoice}. ${grid}, one opening per bottle (${pitchVoice}), inside the ${inch16(H)}" height you typed.${heightVoice}`;
}

/** Spoken slot count for plate/magazine/dish/wine racks ("three slots" / "sixteen slots" / "12 slots" / "16 slots"). */
