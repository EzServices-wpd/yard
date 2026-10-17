/**
 * Card size ↔ drawing size. A card's size is formatted from the engine dims its drawing shows (PR 3 #2, Batch C).
 * Pure, no engine import. Feature numbers ("30 low", "24″ knee") are not overall sizes and are skipped.
 */
export type Dims = { width: number; height: number; depth: number };

/** Relative tolerance: curated sizes round (a "3 ft" tower is 37.4″, a 36″ crate is 36 × 25 × 23 actual stock). */
export const SIZE_TOL = 0.06;
const FEATURE = /\b(knee|low|seat|opening|drop|reach)\b/i;

/** Overall numbers in inches a size string claims, or null when it claims none (feature-only or empty). */
export function sizeNumbers(size: string | undefined | null): number[] | null {
  if (!size) return null;
  // "60 × 30 × 29 · 24″ knee": the feature segment is not an overall size; the rest still is.
  const overall = size.split("·").filter((seg) => !FEATURE.test(seg)).join(" ");
  const out: number[] = [];
  const re = /(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\/(\d+))?\s*(ft|feet|foot|′|')?/gi;
  for (const m of overall.matchAll(re)) {
    let n = Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
    if (m[4]) n *= 12;
    out.push(n);
  }
  return out.length ? out : null;
}

/** Every number the size claims is one of the model's overall dims (each dim used once), within SIZE_TOL. */
export function sizeMatches(size: string | undefined | null, d: Dims): boolean {
  const nums = sizeNumbers(size);
  if (!nums) return false;
  const left = [d.width, d.height, d.depth];
  return nums.every((n) => {
    const i = left.findIndex((v) => Math.abs(v - n) <= Math.max(0.5, v * SIZE_TOL));
    if (i < 0) return false;
    left.splice(i, 1);
    return true;
  });
}

/** Inches as the shop prints them: whole or nearest 1/16, the drawings' own precision ("31 1/2", "6 5/16"). */
export function inch(n: number): string {
  const e = Math.round(n * 16) / 16;
  const w = Math.floor(e);
  let num = Math.round((e - w) * 16);
  if (!num) return String(w);
  let den = 16;
  while (num % 2 === 0) { num /= 2; den /= 2; }
  return `${w ? `${w} ` : ""}${num}/${den}`;
}

/** Inches spoken: 31.5 → "31 and a half", 17.75 → "17 and three quarters", 6.3125 → "6 and five sixteenths". */
export function inchWords(n: number): string {
  const e = Math.round(n * 16) / 16;
  const w = Math.floor(e);
  const f = Math.round((e - w) * 16);
  const FR = ["", "a sixteenth", "an eighth", "three sixteenths", "a quarter", "five sixteenths", "three eighths", "seven sixteenths", "a half",
    "nine sixteenths", "five eighths", "eleven sixteenths", "three quarters", "thirteen sixteenths", "seven eighths", "fifteen sixteenths"];
  if (!f) return String(w);
  return w ? `${w} and ${FR[f]}` : FR[f];
}

/** Engine-solved dims in the drawing's own order. `round`: the top is a circle, so width is its diameter. */
export type SolvedDims = Dims & { round?: boolean };

/**
 * The one size format (BATCH-C-PLAN.md, size rule): always formatted from the engine's solved dimensions,
 * never from a typed string. "W × D × H in" ("31 1/2 × 16 × 78 in"); a round top prints "40 dia × 30 in".
 * `aria` spells it out for screen readers ("31 and a half inches wide, 16 deep, 78 tall").
 */
export function formatSize(d: SolvedDims | null | undefined): { text: string; aria: string } {
  if (!d) return { text: "", aria: "" };
  if (d.round) return { text: `${inch(d.width)} dia × ${inch(d.height)} in`, aria: `${inchWords(d.width)} inches across, ${inchWords(d.height)} tall` };
  return {
    text: `${inch(d.width)} × ${inch(d.depth)} × ${inch(d.height)} in`,
    aria: `${inchWords(d.width)} inches wide, ${inchWords(d.depth)} deep, ${inchWords(d.height)} tall`,
  };
}

/** A drawing's size: its own dimension labels (what the engine drew), else the model's solved box. */
export function drawingSize(svg: string, overall: Dims): { text: string; aria: string } {
  return formatSize(drawnDims(svg) ?? overall);
}

/**
 * Every size printed on / and /ideas matches this (the size pattern test). One number is a whole, a whole and a
 * fraction ("3 1/2"), or, under an inch, a bare fraction ("3/4": the headboard is one 60 × 3/4 × 48 in panel).
 */
const N = String.raw`(?:\d+(?: \d+\/\d+)?|\d+\/\d+)`;
export const SIZE_PATTERN = new RegExp(String.raw`^${N} × ${N} × ${N} in$|^${N} dia × ${N} in$`);

/** Sizes the drawing itself prints (its dimension labels), in inches: width, depth, height (a round top: dia, height). */
export function drawnDims(rawSvg: string): SolvedDims | null {
  const labels = [...rawSvg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1].replace(/&quot;/g, '"'));
  const num = (t: string) => {
    const m = t.match(/(\d+(?:\.\d+)?)?(?:\s*(\d+)\/(\d+))?\s*(["'])/);
    if (!m || (!m[1] && !m[2])) return NaN;
    const n = Number(m[1] ?? 0) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
    return m[4] === "'" ? n * 12 : n;
  };
  const ns = labels.map(num).filter((n) => Number.isFinite(n));
  if (ns.length === 3) return { width: ns[0], depth: ns[1], height: ns[2] };
  if (ns.length === 2 && /dia/.test(labels[0])) return { width: ns[0], depth: ns[0], height: ns[1], round: true };
  return null;
}

