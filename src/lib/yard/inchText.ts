/**
 * The one shop-inch formatter. Every user-facing dimension (notes, steps, cut list,
 * Buy notes, HUD, PDF) prints tape-measure fractions to the nearest 1/16" — never a
 * raw float (19.200000000000003) or a rounded decimal that hides ¾" as "0.8".
 */

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** 29.25 → "29 1/4", 0.75 → "3/4", 3.9 → "3 7/8", 24 → "24". No unit mark. */
export function inchFrac(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const neg = n < 0;
  const sixteenths = Math.round(Math.abs(n) * 16);
  const whole = Math.floor(sixteenths / 16);
  const rem = sixteenths % 16;
  let s: string;
  if (!rem) s = String(whole);
  else {
    const g = gcd(rem, 16);
    const f = `${rem / g}/${16 / g}`;
    s = whole ? `${whole} ${f}` : f;
  }
  return `${neg && s !== "0" ? "-" : ""}${s}`;
}

/** W × H × D in shop fractions with the inch mark on the last value: 22 1/2 × 1 1/2 × 3/4". */
export function inchDims(...ns: number[]): string {
  return `${ns.map(inchFrac).join(" × ")}"`;
}

// A decimal inch value in running text: followed by an inch mark / "in" / "inch", or a
// member of an "a × b × c" size chain. Money ($12.50), degrees, feet and ratios are untouched.
const DEC = String.raw`\d*\.\d+`;
const INCH_AFTER = new RegExp(String.raw`(?<![\d$.,/])(${DEC})(?=\s*(?:"|″|”|-?\s?in\b|-?\s?inch|-?\s?inches\b))`, "g");
const CHAIN_BEFORE = new RegExp(String.raw`(?<![\d$.,/])(${DEC}|\d+)(\s*[×x]\s*)(?=\d)`, "g");
const CHAIN_AFTER = new RegExp(String.raw`([×x]\s*)(${DEC})(?![\d.])(?!\s*(?:%|°|ft|feet|foot|'|lb))`, "g");

const asFrac = (raw: string) => inchFrac(parseFloat(raw));

/** Safety net: rewrite decimal inch values in user-facing text as shop fractions. */
export function fractionizeInches(text: string): string;
export function fractionizeInches(text: string | undefined): string | undefined;
export function fractionizeInches(text: string | undefined): string | undefined {
  if (!text || !/\d\.\d/.test(text)) return text;
  return text
    .replace(INCH_AFTER, (_m, n: string) => asFrac(n))
    .replace(CHAIN_BEFORE, (m, n: string, x: string) => (n.includes(".") ? `${asFrac(n)}${x}` : m))
    .replace(CHAIN_AFTER, (_m, x: string, n: string) => `${x}${asFrac(n)}`);
}

/** Long float leaks (19.200000000000003) or decimal inch values where a fraction belongs. */
export const RAW_LONG_DECIMAL = /\d+\.\d{3,}/;
export const RAW_DECIMAL_INCH = new RegExp(
  String.raw`(?<![\d$.,/])\d*\.\d+(?=\s*(?:"|″|”|-?\s?in\b|-?\s?inch))|(?<![\d$.,/])\d+\.\d+(?=\s*[×x]\s*\d)|[×x]\s*\d+\.\d+(?![\d.])(?!\s*(?:%|°|ft|feet|foot|'|lb))`,
);
