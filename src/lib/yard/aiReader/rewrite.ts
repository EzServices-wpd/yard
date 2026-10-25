/**
 * Spec → the words the engine reads, and which words build (I49). The engine reads words, not JSON, so only a
 * measurement the regex path could misread is replaced by its axis-labelled fraction-inch form ("30x18x72" →
 * "30 wide 18 deep 72 tall", "90cm wide" → "35 7/16 wide"); every other typed word stays. No edit → the identical
 * prompt → the byte-identical build. Rules (classes, no keyword lists):
 *  1. The reader may change a size or count, never the object: a rewrite that builds another kind, builder or
 *     stand-in, or turns a build into a refusal, falls back to the typed words.
 *  2. Every size the reader read is built (±1/8") or refused, never silently widened or dropped; else typed words.
 *  3. A size the regex build already has keeps its words (whole feet ±3": a "3 foot" Eiffel at 37 3/8" is 3 feet).
 *  4. Two different overall values on one axis settle nothing.
 *  5. A typed number is never rewritten: only one measurement in feet or metric (a unit the regex path may misread)
 *     becomes inches. A bare or inch number, and every pair or triple ("30x18x72", "60 by 80"), keep the typed words,
 *     so with the reader on or off a bare triple builds the same (what a bare triple means is row 457, Ezra's call).
 *  6. A count edit only turns a number word next to its noun into digits ("two-step" → "2 steps"): never lower, never moved.
 */
import { generateFromPrompt } from "../promptMain";
import { inchFrac } from "../inchText";
import type { YardProject } from "../types";
import type { ReaderSize, ReaderSpec } from "./spec";
import { quoteUnit, typedAxisAfter } from "./validate";

const WORD = { W: "wide", D: "deep", H: "tall", L: "long" } as const;
const MIN_CONFIDENCE = 0.7;
const sixteenth = (n: number) => Math.round(n * 16) / 16;
const NUMBER_WORD = /-|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|pair|dual|couple)\b/i;

/** One measurement in feet or metric: the only quotes the reader may rewrite (a typed inch number is kept as typed). */
const rewritable = (s: ReaderSize) => {
  const q = s.quote.toLowerCase(), unit = quoteUnit(q), nums = q.match(/\d+(?:\.\d+)?(?:[\s-]+\d+\/\d+)?|\d+\/\d+/g) ?? [];
  const metricUnits = new Set(q.match(/\d\s*(cm|mm|m)\b|centimet|millimet|met(?:er|re)/g)?.map((u) => u.replace(/^\d\s*/, "")) ?? []);
  // One measurement only: one metric number in one unit, or feet (with at most its inches: 6 ft 2 in).
  // At most one axis word, and feet carry only their own inches (< 12): "4 ft 30 wide" is two sizes, never rewritten.
  const axisWords = q.match(/\b(?:wide|width|deep|depth|tall|high|height|long|length)\b/g) ?? [];
  return unit !== "in" && !/[x×*,]|\bby\b/i.test(q) && axisWords.length <= 1 && (unit === "ft" ? nums.length === 1 || (nums.length === 2 && parseFloat(nums[1]) < 12) : nums.length === 1 && metricUnits.size <= 1);
};
const replaceOnce = (out: string, quote: string, to: string) => {
  const lo = out.toLowerCase(), qo = quote.toLowerCase();
  let i = lo.indexOf(qo);
  while (i >= 0 && (/[a-z0-9.\/-]/.test(lo[i - 1] ?? " ") || /[a-z0-9.\/]/.test(lo[i + qo.length] ?? " "))) i = lo.indexOf(qo, i + 1);
  return i < 0 ? null : out.slice(0, i) + to + out.slice(i + quote.length);
};

export type Edit = { from: string; to: string };
export function specToPrompt(prompt: string, spec: ReaderSpec, honored: (s: ReaderSize) => boolean = () => false): { prompt: string; edits: Edit[]; sizes: ReaderSize[] } {
  const edits: Edit[] = [];
  const used: ReaderSize[] = [];
  const usable = spec.sizes.filter((s) => s.of === "overall" && s.confidence >= MIN_CONFIDENCE && s.axis in WORD);
  const perAxis = new Map<string, Set<number>>();
  for (const s of usable) perAxis.set(s.axis, (perAxis.get(s.axis) ?? new Set()).add(sixteenth(s.inches)));
  const byQuote = new Map<string, ReaderSize[]>();
  for (const s of usable) byQuote.set(s.quote, [...(byQuote.get(s.quote) ?? []), s]);
  let out = prompt;
  for (const [quote, sizes] of byQuote) {
    if (sizes.length !== 1 || !rewritable(sizes[0]) || honored(sizes[0]) || (perAxis.get(sizes[0].axis)?.size ?? 0) > 1) continue;
    // The axis word already typed after the quote ("1.8 m tall") stays; only the number is rewritten.
    const to = typedAxisAfter(out, quote) ? inchFrac(sizes[0].inches) : `${inchFrac(sizes[0].inches)} ${WORD[sizes[0].axis as keyof typeof WORD]}`;
    const next = replaceOnce(out, quote, to);
    if (next === null) continue;
    out = next;
    edits.push({ from: quote, to });
    used.push(...sizes);
  }
  // Counts typed as words or hyphen compounds ("two-step", "3-drawer") → "2 steps", "3 drawers"; the quote only.
  for (const c of spec.counts) {
    if (c.confidence < MIN_CONFIDENCE || c.thing === "other" || c.thing === "pieces" || !NUMBER_WORD.test(c.quote)) continue;
    if (new RegExp(`\\b${c.n}\\s+${c.thing.replace(/s$/, "")}`, "i").test(c.quote)) continue;
    const to = `${c.n} ${c.n === 1 ? (c.thing === "shelves" ? "shelf" : c.thing === "cubbies" ? "cubby" : c.thing.replace(/s$/, "")) : c.thing}`;
    const next = replaceOnce(out, c.quote, to);
    if (next === null) continue;
    out = next;
    edits.push({ from: c.quote, to });
  }
  return { prompt: out.replace(/\s+/g, " ").trim(), edits, sizes: used };
}

/** The build already stands at this size, within the precision typed (whole feet ±3", else ±1/8"). */
export function honoredBy(p: YardProject, s: ReaderSize): boolean {
  const box = p.pocket?.unit ?? p.overall;
  if (!box) return false;
  const nums = s.quote.match(/\d+(?:\.\d+)?/g) ?? [];
  const wholeFeet = nums.length === 1 && Number.isInteger(+nums[0]) && /\b(?:ft|feet|foot)\b|['′]/i.test(s.quote);
  const tol = wholeFeet ? 3 : 0.125; // the precision of the typed words, never the model's unit label
  const near = (v: number) => Math.abs(v - s.inches) <= tol;
  return s.axis === "W" ? near(box.width) : s.axis === "D" ? near(box.depth) : s.axis === "H" ? near(box.height) : s.axis === "L" ? near(Math.max(box.width, box.depth)) : true;
}

export type Choice = { buildPrompt: string; used: boolean; edits: Edit[]; reason: string };
const identity = (p: YardProject) => [p.kind, p.fitted?.program ?? "", p.pocket ? "pocket" : "", p.standIn ? "standIn" : "", p.unmatched ? "unmatched" : "", p.displayOnly ? "display" : "", (p.name ?? "").split(/[\s·]/)[0].toLowerCase()].join("|");

export function chooseBuildPrompt(prompt: string, spec: ReaderSpec | null, gen: (q: string) => YardProject = (q) => generateFromPrompt(q)): Choice {
  const keep = (reason: string, edits: Edit[] = []): Choice => ({ buildPrompt: prompt, used: false, edits, reason });
  if (!spec) return keep("no reading (off, failed, capped or late): regex path");
  const a = gen(prompt);
  const { prompt: rewritten, edits, sizes } = specToPrompt(prompt, spec, (s) => honoredBy(a, s));
  if (!edits.length || rewritten === prompt) return keep("the regex build already has every size read: no edit");
  const b = gen(rewritten);
  if (identity(a) !== identity(b)) return keep(`rewrite changes the object (${identity(a)} → ${identity(b)}): regex path`, edits);
  if (b.refused && !a.refused) return keep("rewrite turns a build into a refusal: regex path", edits);
  if (!b.refused && !sizes.every((s) => honoredBy(b, s))) return keep("rewrite does not build every size read: regex path", edits);
  return { buildPrompt: rewritten, used: true, edits, reason: "reader rewrite builds the same object at the sizes typed" };
}
