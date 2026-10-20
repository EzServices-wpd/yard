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

const VULGAR: Record<string, string> = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅓": "1/3", "⅔": "2/3", "⅙": "1/6", "⅚": "5/6", "⅕": "1/5" };
// The space before a fraction stays unless a digit owns it ("shelf ½ deep" keeps its space, "24 ½" joins 24).
const VULGAR_RE = new RegExp(`(?:(\\d)\\s*)?([${Object.keys(VULGAR).join("")}])`, "g");

/** A typed number: "24 1/2", "24-1/2", "1/2", "24.5", "24". */
const NUM = String.raw`\d+(?:\.\d+)?(?:(?:\s+|-)\d+\/\d+)?|\d+\/\d+`;
// A unit word ends at any non-letter, a digit included: "5ft6in" is 5 ft 6 in ("ft\b" would miss it and read 6").
const FT = String.raw`(?:'|ft(?![a-z])\.?|feet(?![a-z])|foot(?![a-z]))`;
const IN = String.raw`(?:"|in(?![a-z])\.?|inch(?:es)?(?![a-z]))`;
/** What makes a number a size: an axis word after it, or the x / by of a W x D x H string. */
const AXIS_AFTER = String.raw`(?=\s*(?:${IN}|${FT})?\s*(?:wide|w|deep|d|tall|t|high|h|long|l|square|round|across|diameter|dia|x|×|by)\b|\s*(?:"|')?\s*[x×](?=\s*\d))`;
const AXIS_BEFORE = String.raw`(?<=(?:\d\s*(?:"|')?\s*(?:[x×]|\bby)\s*))`;

/** One typed number as inches ("24 1/2" → 24.5, "24-1/2" → 24.5, "3/4" → 0.75). NaN when it is not a number. */
export function readNumber(t: string): number {
  const s = t.trim().replace(VULGAR_RE, (_, d: string | undefined, f: string) => `${d ? `${d} ` : ""}${VULGAR[f]}`);
  const m = s.match(/^(?:(\d+(?:\.\d+)?)(?:\s+|-))?(\d+)\/(\d+)$/);
  if (m) return Number(m[3]) ? Number(m[1] ?? 0) + Number(m[2]) / Number(m[3]) : NaN;
  return /^\d+(?:\.\d+)?$/.test(s) ? Number(s) : NaN;
}

const dec = (n: number) => String(Math.round(n * 10000) / 10000);

/** The prompt with every typed size written as plain decimal inches (see the module note). */
export function canonicalMeasures(prompt: string): string {
  // Unicode fractions read as shop fractions: "24½" → "24 1/2", "½" → "1/2".
  let s = prompt.replace(VULGAR_RE, (_, d: string | undefined, f: string) => `${d ? `${d} ` : ""}${VULGAR[f]}`);
  s = s.replace(/[″”]/g, '"').replace(/[‘’′]/g, "'");
  // Feet and inches: "2' 1/2"", "2'6"", "2 ft 6 in", "2 feet 6 1/2 inches", "2 ft 6 wide" → total inches. Without an
  // inch mark the inches need an axis word after them: "6 ft 2 x 4 frame" is a length and a stock, never 74" x 4.
  s = s.replace(new RegExp(String.raw`\b(\d+(?:\.\d+)?)\s*${FT}\s*(?:and\s+|-\s*)?(${NUM})(?:\s*${IN}|(?=\s+(?:wide|deep|tall|high|long)\b))`, "gi"), (all, ft: string, inch: string) => {
    const f = Number(ft), i = readNumber(inch);
    if (!Number.isFinite(f) || !Number.isFinite(i) || i >= 12) return all;
    return `${dec(f * 12 + i)}"`;
  });
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
