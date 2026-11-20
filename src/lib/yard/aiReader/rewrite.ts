/**
 * Spec → the words the engine reads, and which words build (I49). The engine reads words, not JSON, so only a
 * measurement the regex path could misread is replaced by its axis-labelled fraction-inch form ("30x18x72" →
 * "30 wide 18 deep 72 tall", "90cm wide" → "35 7/16 wide"); every other typed word stays. No edit → the identical
 * prompt → the byte-identical build. Rules (classes, no keyword lists):
 *  1. The reader may change a size or count, never the object: a rewrite that builds another kind, builder or
 *     stand-in, or turns a build into a refusal, falls back to the typed words.
 *  2. Every size the reader read is built (±1/8") or refused, never silently widened or dropped; else typed words.
 *  3. A size the regex build already has keeps its words. That is a real length of the model in inches — the
 *     overall box, or a member cut running on that axis — within the precision typed (whole feet ±3": a "3 foot"
 *     Eiffel at 37 3/8" is 3 feet; else ±1/8"). A digit in the quote is not a size the model has.
 *  4. Two different overall values on one axis settle nothing.
 *  5. A typed number is never rewritten: only one measurement in feet or metric (a unit the regex path may misread)
 *     becomes inches. A bare or inch number, and every pair or triple ("30x18x72", "60 by 80"), keep the typed words,
 *     so with the reader on or off a bare triple builds the same (what a bare triple means is row 457, Ezra's call).
 *     One exception: a bare footprint read in feet ("3x6" → 3 ft by 6 ft) is labelled in inches when the model
 *     does not already have those lengths.
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
    // A bare footprint the reader read in feet ("3x6" → 36" by 72"), only when the model does not already
    // have those lengths. Every other pair or triple keeps the typed words (rule 5).
    if (sizes.length > 1) {
      const axes = new Set(sizes.map((s) => s.axis));
      const feet = /[x×]|\bby\b/i.test(quote) && sizes.every((s) => s.unit === "ft" && s.axis in WORD && s.of === "overall" && s.confidence >= MIN_CONFIDENCE);
      if (feet && axes.size === sizes.length && sizes.every((s) => !honored(s))) {
        const to = sizes.map((s) => `${inchFrac(s.inches)} ${WORD[s.axis as keyof typeof WORD]}`).join(" ");
        const next = replaceOnce(out, quote, to);
        if (next !== null) { out = next; edits.push({ from: quote, to }); used.push(...sizes); }
      }
      continue;
    }
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
    // "a pair of doors" → "2 doors", not "a 2 doors" (row 482).
    const from = /^pair\b/i.test(c.quote) && replaceOnce(out, `a ${c.quote}`, to) !== null ? `a ${c.quote}` : c.quote;
    const next = replaceOnce(out, from, to);
    if (next === null) continue;
    out = next;
    edits.push({ from, to });
  }
  return { prompt: out.replace(/\s+/g, " ").trim(), edits, sizes: used };
}

/** Lengths of members that run along one world axis, in inches (the cut, else the span). */
function memberLengths(p: YardProject, axis: "x" | "y" | "z"): number[] {
  const out: number[] = [];
  for (const i of p.instances ?? []) {
    if (!i.from || !i.to) continue;
    const d = { x: Math.abs(i.to.x - i.from.x), y: Math.abs(i.to.y - i.from.y), z: Math.abs(i.to.z - i.from.z) };
    const len = Math.hypot(d.x, d.y, d.z);
    if (!(len > 0.5) || d[axis] < len - 0.25) continue;
    out.push(typeof i.cutLength === "number" && i.cutLength > 0 ? i.cutLength : len);
  }
  return out;
}

/**
 * The build already stands at this size. Compared in inches against the model's own lengths — the overall
 * box on that axis, or a member cut running along it — never against a digit in the quote. Whole feet ±3"
 * (a "3 foot" Eiffel at 37 3/8" is 3 feet); every other reading ±1/8". An axis the model does not name is
 * honored only when some real length matches.
 */
export function honoredBy(p: YardProject, s: ReaderSize): boolean {
  const box = p.pocket?.unit ?? p.overall;
  if (!box || !(s.inches > 0)) return false;
  const nums = s.quote.match(/\d+(?:\.\d+)?/g) ?? [];
  const wholeFeet = nums.length === 1 && Number.isInteger(+nums[0]) && (s.unit === "ft" || s.unit === "ft-in" || /\b(?:ft|feet|foot)\b|['′]/i.test(s.quote));
  const tol = wholeFeet ? 3 : 0.125;
  const near = (v: number) => Math.abs(v - s.inches) <= tol;
  const any = [box.width, box.height, box.depth, ...(p.instances ?? []).map((i) => i.cutLength ?? 0)].some((v) => v > 0 && near(v));
  if (s.axis === "W") return near(box.width) || memberLengths(p, "x").some(near);
  if (s.axis === "D") return near(box.depth) || memberLengths(p, "z").some(near);
  if (s.axis === "H") return near(box.height) || memberLengths(p, "y").some(near);
  if (s.axis === "L") return near(Math.max(box.width, box.depth)) || memberLengths(p, "x").some(near) || memberLengths(p, "z").some(near);
  return any;
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
  // A count edit only turns a number word into digits: it never makes or moves a size ("6 ft two shelves" must not read
  // "6 ft 2", "2 x three drawers" must not read 2" x 3"). The build with the count edits must stand at the build without them (row 505).
  const sizeOnly = specToPrompt(prompt, { sizes: spec.sizes, counts: [] }, (s) => honoredBy(a, s)).prompt;
  // A refused build counts too: its box is the size it names, and a count edit must not turn a refusal into a build.
  if (sizeOnly !== rewritten) {
    const c = sizeOnly === prompt ? a : gen(sizeOnly), bx = b.pocket?.unit ?? b.overall, cx = c.pocket?.unit ?? c.overall;
    if (!bx || !cx || bx.width !== cx.width || bx.height !== cx.height || bx.depth !== cx.depth) return keep("a count edit moves a size: regex path", edits);
    if (!!b.refused !== !!c.refused) return keep("a count edit changes whether it builds: regex path", edits);
  }
  return { buildPrompt: rewritten, used: true, edits, reason: "reader rewrite builds the same object at the sizes typed" };
}
