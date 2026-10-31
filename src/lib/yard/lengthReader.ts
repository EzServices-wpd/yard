/**
 * NR-1 (F21 typed size reads one way): the one length reader. Every spelling of one size reads the same inches:
 *   24 1/2, 24-1/2, 24½, 24.5, "24 and a half"            → 24.5 (with a unit, or bare for the caller to place)
 *   2 1/2 ft 3 in, 2'6", 2 ft 6 in, 5ft6in, 2.5 ft         → 33, 30, 30, 66, 30
 *   6mm, 19mm, 1829mm, 1.5 cm, 2 m                         → mm / 25.4, cm / 2.54, m × 39.37
 *   one inch, 1-inch, half inch, quarter inch, seventy-two inches → 1, 1, 0.5, 0.25, 72 (a spelled number needs a unit)
 * A length never starts inside another number ("2 1/2 ft 3 in" is 33, never "2 1/27", row 658). Callers decide what a
 * length sizes (stock names like "1/2 plywood" or "2x4" are theirs to skip); this module only reads.
 */

export type Unit = "in" | "ft" | "mm" | "cm" | "m";
/** One typed length. `num` is the number as typed, `spelled` when it was words ("seventy-two"). */
export type Length = { inches: number; value: number; unit: Unit | null; start: number; end: number; raw: string; num: string; spelled: boolean };

export const VULGAR: Record<string, string> = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅓": "1/3", "⅔": "2/3", "⅙": "1/6", "⅚": "5/6", "⅕": "1/5" };
// The space before a fraction stays unless a digit owns it ("shelf ½ deep" keeps its space, "24 ½" joins 24).
export const VULGAR_RE = new RegExp(`(?:(\\d)\\s*)?([${Object.keys(VULGAR).join("")}])`, "g");
/** Unicode fractions as shop fractions: "24½" → "24 1/2", "½" → "1/2". */
export const plainFractions = (t: string) => t.replace(VULGAR_RE, (_, d: string | undefined, f: string) => `${d ? `${d} ` : ""}${VULGAR[f]}`);

/** One typed number as inches ("24 1/2" → 24.5, "24-1/2" → 24.5, "3/4" → 0.75). NaN when it is not a number. */
export function readNumber(t: string): number {
  const s = plainFractions(t.trim());
  const m = s.match(/^(?:(\d+(?:\.\d+)?)(?:\s+|-))?(\d+)\/(\d+)$/);
  if (m) return Number(m[3]) ? Number(m[1] ?? 0) + Number(m[2]) / Number(m[3]) : NaN;
  return /^\d+(?:\.\d+)?$/.test(s) ? Number(s) : NaN;
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const HALVES: Record<string, number> = { half: 0.5, quarter: 0.25 };
const DIG = String.raw`\d+(?:\.\d+)?(?:\s+|-)\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?`;
const WORD = String.raw`(?<![a-z])(?:(?:(?:a|one|three)[\s-])?(?:half|quarters?)|(?:${TENS.slice(2).join("|")})(?:[\s-](?:${ONES.slice(1, 10).join("|")}))?|${[...ONES.slice(10)].reverse().join("|")}|${ONES.slice(1, 10).join("|")})(?![a-z])`;
const AND_HALF = String.raw`(\s+and\s+(?:a|one)\s+(?:half|quarter))?`;
const IN = String.raw`(?:''|["″”]|(?:in\.?|inch(?:es)?)(?![a-z]))`;
const AXIS = String.raw`(?=\s+(?:wide|deep|tall|high|long)\b)`;
/** NUM [unit]; after feet, inches that carry a mark or an axis word after them ("2 ft 6 in", "2'6\"", "2 ft 6 wide"). */
const LEN = new RegExp(
  String.raw`(?<![\d./]|[a-wyz])(${DIG}|${WORD})${AND_HALF}(?:\s*-?\s*(?:(mm|millimet(?:er|re)s?)|(cm|centimet(?:er|re)s?)|(m|met(?:er|re)s?))(?![a-z])` +
    String.raw`|\s*-?\s*(${IN})|(?:\s*-?\s*(ft\.?|feet|foot)(?![a-z])|\s*('))(\s*(?:and\s+|-\s*)?(${DIG})(?:\s*${IN}|${AXIS}))?)?`,
  "gi",
);
const PER: Record<Unit, number> = { in: 1, ft: 12, mm: 1 / 25.4, cm: 1 / 2.54, m: 1000 / 25.4 };

function wordValue(w: string): number {
  const t = w.toLowerCase().replace(/[\s-]+/g, " ").replace(/^(?:a|one) (?=half|quarter)/, "");
  if (/^three quarters?$/.test(t)) return 0.75;
  if (t in HALVES || t === "quarters") return HALVES[t] ?? 0.25;
  const [a, b] = t.split(" ");
  return TENS.includes(a) ? TENS.indexOf(a) * 10 + (b ? ONES.indexOf(b) : 0) : ONES.indexOf(a);
}

/** Every length in the text, in order, non-overlapping. A bare number is a length with no unit (inches = value). */
export function readLengths(text: string): Length[] {
  const s = plainFractions(text);
  if (s.length !== text.length) return readLengths(s); // ponytail: positions are then on the plain-fraction text
  const out: Length[] = [];
  LEN.lastIndex = 0;
  for (let m = LEN.exec(s); m; m = LEN.exec(s)) {
    const [raw, num, half, mm, cm, metre, inch, ft, foot, tail, tailNum] = m;
    const spelled = /[a-z]/i.test(num);
    const value = (spelled ? wordValue(num) : readNumber(num)) + (half ? HALVES[/half/i.test(half) ? "half" : "quarter"] : 0);
    const unit: Unit | null = mm ? "mm" : cm ? "cm" : metre ? "m" : inch ? "in" : ft || foot ? "ft" : null;
    let end = m.index + raw.length;
    // Inches after feet join only under 12: "6 ft 14 in" is two lengths, read on from the 14.
    const joins = tail != null && readNumber(tailNum) < 12;
    if (tail != null && !joins) LEN.lastIndex = end -= tail.length;
    if (!Number.isFinite(value) || (spelled && !unit)) continue;
    const inches = (unit ? value * PER[unit] : value) + (joins ? readNumber(tailNum) : 0);
    out.push({ inches, value, unit, start: m.index, end, raw: s.slice(m.index, end), num, spelled });
  }
  return out;
}

/** The first length that starts at or after `pos`. `bareUnit` gives a unitless number its unit. */
export function readLength(text: string, pos = 0, o: { bareUnit?: Unit | null } = {}): Length | null {
  const l = readLengths(text).find((x) => x.start >= pos);
  if (!l || l.unit || !o.bareUnit) return l ?? null;
  return { ...l, unit: o.bareUnit, inches: l.value * PER[o.bareUnit] };
}

/** A W x D x H / "N by M" run at or after `pos`: its places in typed order. */
export function readTuple(text: string, pos = 0): { places: Length[]; start: number; end: number } | null {
  const ls = readLengths(text).filter((l) => l.start >= pos);
  for (let i = 0; i < ls.length; i++) {
    let j = i;
    while (j + 1 < ls.length && /^\s*(?:[x×*]|by)\s*$/i.test(text.slice(ls[j].end, ls[j + 1].start))) j++;
    if (j > i) return { places: ls.slice(i, j + 1), start: ls[i].start, end: ls[j].end };
  }
  return null;
}
