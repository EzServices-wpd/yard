/**
 * Part ceiling (bridge-cap class). A build with more than MAX_PARTS parts is refused in plain words and names the
 * largest size of it that builds; it is never cut short (the old renderer stop sold half a tower). 8,000 is the
 * bench's renderer limit. The builders count as they go (blocks, stick graphs, toProject), so a runaway size stops
 * at the ceiling instead of building every part first.
 */
import { inchFrac } from "./inchText";
import { canonicalMeasures } from "./measureText";

export const MAX_PARTS = 8000;

export class TooManyParts extends Error {
  constructor(readonly parts: number) {
    super(`More than ${MAX_PARTS} parts`);
  }
}

/** Throws TooManyParts when `parts` is over the ceiling. */
export function checkParts(parts: number): void {
  if (parts > MAX_PARTS) throw new TooManyParts(parts);
}

const N = String.raw`\d+(?:\.\d+)?`;
const FT = String.raw`(?:ft\b|feet\b|foot\b|')`;
const SIZE = new RegExp(
  String.raw`(?<![\w/.])(?![124]\s*[x×]\s*(?:2|3|4|6|8|10|12)\b)(${N})(\s*[x×]\s*)(${N})(?:(\s*[x×]\s*)(${N}))?|(?<![\w/.])(${N})(\s*(?:${FT}|"|in(?:ch(?:es)?)?\b)?\s*-?\s*(?:wide|tall|high|deep|long|across)\b|\s*(?:${FT}|"|in(?:ch(?:es)?)?\b))`,
  "gi",
);

/** The typed envelope sizes scaled by k and rounded down (whole feet, 1/16" otherwise), and the size words, or null when no size is typed. */
export function scaledSizes(prompt: string, k: number): { prompt: string; words: string[] } | null {
  const words: string[] = [];
  const down = (n: string, ft: boolean) => {
    const v = Number(n) * k;
    return ft ? String(k === 1 ? Number(n) : Math.max(1, Math.floor(v))) : inchFrac(Math.max(1 / 16, Math.floor(v * 16 + 1e-6) / 16));
  };
  const out = canonicalMeasures(prompt).replace(SIZE, (_all, a, x1, b, x2, c, n, unit) => {
    const w = n != null ? `${down(n, new RegExp(FT, "i").test(unit))}${unit}` : `${down(a, false)}${x1}${down(b, false)}${x2 ?? ""}${c != null ? down(c, false) : ""}`;
    words.push(w.trim());
    return w;
  });
  return words.length ? { prompt: out, words } : null;
}

/**
 * The largest scale of the typed sizes that builds under the ceiling: halve until one builds, then narrow it down.
 * `builds` builds a prompt and says whether it stays under the ceiling.
 */
export function largestBuilding(prompt: string, builds: (prompt: string) => boolean): string[] | null {
  if (scaledSizes(prompt, 1) == null) return null;
  let lo = 0, hi = 1;
  for (let k = 0.5; k >= 1 / 64; k /= 2) {
    if (builds(scaledSizes(prompt, k)!.prompt)) { lo = k; break; }
    hi = k;
  }
  if (!lo) return null;
  for (let i = 0; i < 4; i++) {
    const mid = (lo + hi) / 2;
    if (builds(scaledSizes(prompt, mid)!.prompt)) lo = mid; else hi = mid;
  }
  return scaledSizes(prompt, lo)!.words;
}
