/**
 * I35 (F21 typed size): one reader for a typed measure, so every size parser downstream reads one plain form.
 * Before, each parser matched `\d+(?:\.\d+)?` on its own: "24 1/2 wide" read the 1/2 (a 2" shelf), "24½" read 24,
 * "2' 1/2"" read 2, and "2 ft 6 in" was 30 only on a few axes. canonicalMeasures rewrites every shop way of writing
 * a length into decimal inches before any parser sees the prompt:
 *   24 1/2, 24-1/2, 24½, 24.5     → 24.5
 *   2' 1/2", 2 ft 6 in, 2'6", 2 feet 6 inches → 24.5" / 30"
 * Stock names keep their own spelling: a bare fraction ("1/2 plywood", "3/4\" ply") and a mixed number that is not a
 * size ("1 1/2 inch screws") are left alone; only a number that sizes an axis (a size word after it, or a place in a
 * W x D x H string, "27 1/2 square", "92 5/8 long") or a feet-and-inches pair is rewritten.
 */
import { plainFractions, readLengths, readNumber } from "./lengthReader";
import { inchFrac } from "./inchText";

// A unit word ends at any non-letter, a digit included: "5ft6in" is 5 ft 6 in ("ft\b" would miss it and read 6").
const FT = String.raw`(?:'|ft(?![a-z])\.?|feet(?![a-z])|foot(?![a-z]))`;
const IN = String.raw`(?:"|in(?![a-z])\.?|inch(?:es)?(?![a-z]))`;
/** What makes a number a size: an axis word after it, or the x / by of a W x D x H string. */
const AXIS_AFTER = String.raw`(?=\s*(?:${IN}|${FT})?\s*(?:wide|w|deep|d|tall|t|high|h|long|l|square|round|across|diameter|dia|x|×|by)\b|\s*(?:"|')?\s*[x×](?=\s*\d))`;
const AXIS_BEFORE = String.raw`(?<=(?:\d\s*(?:"|')?\s*(?:[x×]|\bby)\s*))`;

export { readNumber };

const dec = (n: number) => String(Math.round(n * 10000) / 10000);
const AXIS_WORD = /^\s*(?:wide|deep|tall|high|long)\b/i;
const STOCK_AFTER = /^\s*(?:thick|x|×|by|plywood|ply|screws?|nails?|brads?|bolts?|dowels?|pipes?|pvc|conduit|boards?|lumber|holes?|dia|diameter|skewers?|sticks?|rods?|tub(?:e|es|ing)|hinges?|staples?|pocket|squares?|casters?|wheels?|legs?)(?![a-z])/i;

/**
 * NR-1: the lengths the one reader (lengthReader) reads, said as inches. Feet and inches ("2' 1/2"", "2 ft 6 in",
 * "2 1/2 ft 3 in" = 33, row 658) are total inches. Feet, metric and spelled lengths that size an axis ("2.5 ft wide",
 * "1829mm tall", "seventy-two inches tall") are inches (metric to the nearest 1/16"). A mixed number with a unit
 * ("castle 20 1/2"", "2 1/2 ft", row 623) is one decimal. Without an inch mark the inches after feet need an axis word
 * after them: "6 ft 2 x 4 frame" is a length and a stock, never 74" x 4. Stock names ("1 1/2 inch screws") keep theirs.
 */
function lengthsAsInches(s: string): string {
  // On an arch a feet word stays feet (as "4 ft long" does): release's span rule (promptHelpers.parseSize) reads it, so
  // "4 feet wide" is the walk-through span and "30 wide" a narrow trellis arch, as on release (NR-3 owns that rule).
  const arch = /\barch/i.test(s);
  for (const l of readLengths(s).reverse()) {
    if (!l.unit) continue;
    const after = s.slice(l.end), rest = l.raw.slice(l.num.length);
    const half = /^\s+and\s+(?:a|one)\s+(?:half|quarter)/i.exec(rest)?.[0] ?? "";
    const pair = l.unit === "ft" && /\d/.test(rest);
    // "4 ft long" stays: a stock's length ("2x4 bench 4 ft long") reads in feet downstream.
    const feetWord = arch && !pair && /^\s*-?\s*(?:ft|feet|foot)/i.test(rest);
    const sizes = AXIS_WORD.test(after) && !feetWord && (l.unit === "ft" ? !/^\s*long/i.test(after) : l.unit !== "in");
    const r = /m$/.test(l.unit) ? Math.round(l.inches * 16) / 16 : l.inches;
    // A spelled number with a unit is its digits wherever it is ("quarter inch plywood" → "1/4 inch plywood", row 608).
    const said = (v: number) => (v < 1 ? inchFrac(v) : dec(v)) + rest.slice(half.length);
    const out = pair || sizes ? `${dec(r)}"` : l.spelled || half ? said(l.value) : /\d[\s-]+\d+\/\d+/.test(l.num) && !STOCK_AFTER.test(after) ? dec(l.value) + rest : null;
    if (out != null) s = s.slice(0, l.start) + out + after;
  }
  return s;
}

/** The prompt with every typed size written as plain decimal inches (see the module note). */
export function canonicalMeasures(prompt: string): string {
  // Unicode fractions read as shop fractions: "24½" → "24 1/2", "½" → "1/2".
  let s = plainFractions(prompt);
  s = s.replace(/[″”]/g, '"').replace(/[‘’′]/g, "'");
  s = lengthsAsInches(s);
  // Compact feet-inches, nothing between the foot mark and the inches ("2ft6 x 12 x 30", "5ft6", "2'6 x 12 x 30"): the
  // inches need no mark or axis word. A lone "x N" after it is a stock ("6ft2x4" stays a 6 ft 2x4).
  s = s.replace(new RegExp(String.raw`\b(\d+(?:\.\d+)?)\s*(?:'|ft\.?|feet|foot)(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)(?![\d./])`, "gi"), (all, ft: string, inch: string, at: number, whole: string) => {
    const f = Number(ft), i = readNumber(inch);
    if (!Number.isFinite(f) || !Number.isFinite(i) || i >= 12) return all;
    // Inside a W x D x H string ("24 x 1ft2 x 30") it is a size whatever follows.
    const stock = /^\s*[x×]\s*\d+(?:\.\d+)?(?!\s*[x×\d./])/.test(whole.slice(at + all.length)) && !/[x×]\s*$/.test(whole.slice(0, at));
    if (stock) return all;
    return `${dec(f * 12 + i)}"`;
  });
  // A mixed or bare fraction that sizes an axis: "24 1/2 wide", "24-1/2\" x 14", "36 x 14 x 24 1/2".
  const sized = new RegExp(String.raw`(?<![\d./])(\d+(?:\.\d+)?(?:\s+|-)\d+\/\d+)(?![\d/])(?:${AXIS_AFTER})`, "gi");
  s = s.replace(sized, (all, n: string) => (Number.isFinite(readNumber(n)) ? dec(readNumber(n)) : all));
  // A bare fraction sizes an axis only before a size word ("3/4 deep"); "3/4 x 4 x 8" is a sheet's name.
  const bare = new RegExp(String.raw`(?<![\d./-])(?<!\d\s)(\d+\/\d+)(?![\d/])(?=\s*(?:${IN})?\s*(?:wide|deep|tall|high|long)\b)`, "gi");
  s = s.replace(bare, (all, n: string) => (Number.isFinite(readNumber(n)) ? dec(readNumber(n)) : all));
  const trailing = new RegExp(String.raw`${AXIS_BEFORE}(\d+(?:\.\d+)?(?:\s+|-)\d+\/\d+)(?![\d/])`, "gi");
  s = s.replace(trailing, (all, n: string) => (Number.isFinite(readNumber(n)) ? dec(readNumber(n)) : all));
  return s;
}

/** Whether canonicalMeasures changes a typed size (not only its quote marks): the words typed are then kept for display. */
export function rewritesMeasures(prompt: string): boolean {
  return canonicalMeasures(prompt) !== prompt.replace(/[″”]/g, '"').replace(/[‘’′]/g, "'");
}

export type TypedMeasures = { width?: number; depth?: number; height?: number; tuple?: number[] };

/** The sizes a prompt types, in inches, read through canonicalMeasures: axis words ("24 1/2 wide") and a W x D x H string. */
export function typedMeasures(prompt: string): TypedMeasures {
  const s = canonicalMeasures(prompt).toLowerCase();
  const out: TypedMeasures = {};
  const AX = { wide: "width", deep: "depth", tall: "height", high: "height" } as const;
  for (const m of s.matchAll(/(?<![\d.x×])(\d+(?:\.\d+)?)\s*(ft(?![a-z])\.?|feet(?![a-z])|foot(?![a-z])|'|"|in(?![a-z])\.?|inch(?:es)?(?![a-z]))?\s*(wide|deep|tall|high)\b/g)) {
    const k = AX[m[3] as keyof typeof AX];
    out[k] ??= Number(m[1]) * (m[2] && /^(?:f|')/.test(m[2]) ? 12 : 1);
  }
  const t = s.match(/(?<![\d.])(\d+(?:\.\d+)?)\s*(?:"|in(?![a-z]))?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|in(?![a-z]))?\s*[x×]\s*(\d+(?:\.\d+)?)(?![\d.])\s*(?:"|in(?![a-z])|inch(?:es)?(?![a-z]))?(?!\s*(?:ft|feet|foot|'))/);
  if (t) out.tuple = [Number(t[1]), Number(t[2]), Number(t[3])];
  return out;
}
