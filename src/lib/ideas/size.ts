/**
 * Card size ↔ drawing size. A card's subtitle size must describe the model its drawing shows (PR 3 #2).
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

/** Inches as the shop prints them: whole or nearest 1/8 ("31 1/2"). */
export function inch(n: number): string {
  const e = Math.round(n * 8) / 8;
  const w = Math.floor(e);
  const f = Math.round((e - w) * 8);
  if (!f) return String(w);
  const g = f % 4 === 0 ? 2 : f % 2 === 0 ? 4 : 8;
  const num = g === 2 ? 1 : g === 4 ? f / 2 : f;
  return `${w ? `${w} ` : ""}${num}/${g}`;
}

/** The curated size when it matches the drawing; otherwise the model's W × H × D. Size format unchanged (decisions.md #2). */
export function displaySize(curated: string | undefined | null, d: Dims | null | undefined): string {
  if (!d) return curated ?? "";
  if (sizeMatches(curated, d)) return curated!;
  return `${inch(d.width)} × ${inch(d.height)} × ${inch(d.depth)}`;
}
