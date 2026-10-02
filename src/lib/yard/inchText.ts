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

/** Picked-part card on the bench: W × H × D in shop fractions. */
export function partCardDims(size: { width: number; height: number; depth: number }): string {
  return inchDims(size.width, size.height, size.depth);
}

/** Short in-part nest size: 22 1/2×1 1/2 (shop fractions, no marks). */
export function nestPartDims(w: number, h: number): string {
  return `${inchFrac(w)}×${inchFrac(h)}`;
}

export type NestLabelLayout = {
  /** Letter (and size, for strips) on one line that fits inside the part. */
  text: string;
  dims: string | null;
  name: boolean;
  fontSize: number;
  x: number;
  y: number;
  anchor: "middle" | "start";
  /** Degrees; 90 runs the label along a tall thin strip. */
  rotate: number;
};

/**
 * Where a sheet-nest label sits inside its part. Roomy parts center the letter with the size
 * under it. Thin strips (rails stacked on a sheet) get one line sized to the strip and run along
 * it from the end, so neighbouring strips never print on top of each other.
 */
export function nestLabelLayout(p: { x: number; y: number; width: number; height: number; label?: string; name?: string }): NestLabelLayout {
  const short = Math.min(p.width, p.height);
  const long = Math.max(p.width, p.height);
  const letter = p.label || "?";
  const dims = nestPartDims(p.width, p.height);
  if (short < 6) {
    const fs = Math.max(0.9, Math.min(2.4, short * 0.7));
    const line = `${letter}  ${dims}`;
    const fits = line.length * fs * 0.55 < long - 2;
    const text = fits ? line : letter;
    const horiz = p.width >= p.height;
    return horiz
      ? { text, dims: null, name: false, fontSize: fs, x: p.x + 1, y: p.y + p.height / 2 + fs * 0.35, anchor: "start", rotate: 0 }
      : { text, dims: null, name: false, fontSize: fs, x: p.x + p.width / 2 + fs * 0.35, y: p.y + 1, anchor: "start", rotate: 90 };
  }
  const fs = Math.min(7, Math.max(2.4, short * 0.28));
  const showDims = short > 8;
  const showName = short > 12 && Boolean(p.name);
  return {
    text: letter,
    dims: showDims ? dims : null,
    name: showName,
    fontSize: fs,
    x: p.x + p.width / 2,
    y: p.y + p.height / 2 + (showName ? -fs * 0.35 : showDims ? -fs * 0.15 : fs * 0.35),
    anchor: "middle",
    rotate: 0,
  };
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

/**
 * Read a size the way a person types it on a tape: "31 1/2", "31-1/2", "31½", "31.5", "2' 6"",
 * "3 ft", "48 in". NaN when it is not a size yet (half-typed "31 1/").
 */
export function parseInch(raw: string | number | undefined | null): number {
  if (raw == null) return NaN;
  if (typeof raw === "number") return raw;
  let s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/½/g, " 1/2")
    .replace(/¼/g, " 1/4")
    .replace(/¾/g, " 3/4")
    .replace(/⅛/g, " 1/8")
    .replace(/⅜/g, " 3/8")
    .replace(/⅝/g, " 5/8")
    .replace(/⅞/g, " 7/8")
    .replace(/⁄/g, "/")
    .replace(/(?:"|″|”|\binches\b|\binch\b|\bin\b)\s*$/g, "")
    .trim();
  if (!s) return NaN;
  let feet = 0;
  const fm = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|’|′|\bft\b|\bfeet\b|\bfoot\b)\s*(.*)$/);
  if (fm) {
    feet = parseFloat(fm[1]);
    s = fm[2].replace(/(?:"|″|”)\s*$/, "").trim();
    if (!s) return feet * 12;
  }
  s = s.replace(/(\d)\s*-\s*(\d)/g, "$1 $2").replace(/\s+/g, " ").trim();
  const m = s.match(/^(?:(\d+(?:\.\d+)?|\.\d+)(?: (\d+)\/(\d+))?|(\d+)\/(\d+))$/);
  if (!m) return NaN;
  let v: number;
  if (m[4] != null) {
    if (+m[5] === 0) return NaN;
    v = +m[4] / +m[5];
  } else {
    v = parseFloat(m[1]);
    if (m[2] != null) {
      if (+m[3] === 0) return NaN;
      v += +m[2] / +m[3];
    }
  }
  return Number.isFinite(v) ? feet * 12 + v : NaN;
}

/** A size field's text: shop fractions, no inch mark (the label carries it). */
export function fieldInch(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "";
  return inchFrac(n);
}

/**
 * A typed inch number, fractions included: "24", "9.5", "1/4", "3 1/2", "3-1/2". Use this (never a bare
 * \d+(?:\.\d+)?) in any size parser or title stripper, or "1/4 inch dowels" turns into "1/ dowels".
 */
export const INCH_NUM = String.raw`(?:\d+(?:\s+|-)\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`;

/** Parse an INCH_NUM match: "3 1/2" → 3.5, "1/4" → 0.25, "9.5" → 9.5. NaN when it is not a number. */
export function parseInchNum(s: string): number {
  const t = s.trim();
  const mixed = t.match(/^(\d+)(?:\s+|-)(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[2]) > 0 && Number(mixed[3]) > 0 ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]) : NaN;
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) > 0 ? Number(frac[1]) / Number(frac[2]) : NaN;
  return /^\d+(?:\.\d+)?$/.test(t) ? parseFloat(t) : NaN;
}

/** Remove typed sizes ("1/4 inch", "24 in", "3 1/2\"", "6 ft") from a title, fractions and all. */
export function stripTypedSizes(text: string): string {
  return text.replace(new RegExp(String.raw`(?<![\w/])${INCH_NUM}\s*(?:-\s*)?(?:in\b|inch(?:es)?\b|ft\b|foot\b|feet\b|"|″|'|′)`, "gi"), " ");
}
