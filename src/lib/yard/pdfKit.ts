/** Kit-manual PDF tokens and text helpers — one type scale, one grid, WinAnsi-safe text. */

import { inchFrac } from "./inchText";

export type RGB = [number, number, number];

export const KIT = {
  ink: [28, 26, 23] as RGB,
  muted: [110, 104, 96] as RGB,
  faint: [168, 162, 152] as RGB,
  rule: [214, 208, 198] as RGB,
  paper: [247, 244, 238] as RGB,
  accent: [214, 110, 38] as RGB,
  accentSoft: [252, 230, 210] as RGB,
  wood: [228, 206, 168] as RGB,
  woodEdge: [120, 96, 66] as RGB,
  ghost: [236, 234, 230] as RGB,
  ghostEdge: [196, 192, 186] as RGB,
  steel: [150, 156, 164] as RGB,
  steelDark: [92, 98, 106] as RGB,
};

/** Page grid, points on US Letter. */
export const GRID = {
  pageW: 612,
  pageH: 792,
  margin: 44,
  top: 70,
  bottom: 56,
  gutter: 16,
};

const FRACTION_CHARS: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
  "⅓": "1/3",
  "⅔": "2/3",
};

/** Keep every glyph inside the PDF's built-in fonts (WinAnsi). */
export function clean(s: string | null | undefined): string {
  if (!s) return "";
  let t = String(s);
  t = t.replace(/(\d)\s*([¼½¾⅛⅜⅝⅞⅓⅔])/g, (_m, d: string, f: string) => `${d} ${FRACTION_CHARS[f]}`);
  t = t.replace(/[¼½¾⅛⅜⅝⅞⅓⅔]/g, (f) => FRACTION_CHARS[f] ?? f);
  t = t
    .replace(/[″“”]/g, '"')
    .replace(/[′‘’]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/×/g, "x")
    .replace(/→/g, "->")
    .replace(/≈/g, "~")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/…/g, "...")
    .replace(/[•·]/g, "·")
    .replace(/\u00a0/g, " ");
  // Anything outside Latin-1 would print as garbage in the base-14 fonts.
  t = t.replace(/[\t\r\n]/g, " ").replace(/[^ -~\xa0-\xff]/g, "");
  return t.replace(/[ \t]+/g, " ").trim();
}


/** Tape-measure inches: 29.25 → 29 1/4". Rounds to 1/16. */
export function frac(n: number, unit = '"'): string {
  if (!Number.isFinite(n)) return "-";
  return `${inchFrac(n)}${unit}`;
}

/** Short plain sentences from a step description. */
export function sentences(text: string): string[] {
  const t = clean(text);
  if (!t) return [];
  const parts = t
    .split(/(?<=[.!?])\s+(?=["(A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
