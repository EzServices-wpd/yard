/**
 * Too small to use (Critic #103 F2 and r2 rows 141/142, I38). 'bookcase 1/2 wide' built a Back, Top and Shelves -1"
 * wide; 'bookcase 2 1/2 wide' then built an 84" sliver because the minimum named was a geometric floor. A typed size
 * under the family's usable floor (usableFloors.ts) is refused on every axis, and a typed size that would build
 * parts running into each other, loose, or with a bay or drawer no hand fits into is refused too. The refusal names
 * the smallest size that is both usable and clean, in #90's shared pattern: '<Thing> · nothing built' and a note.
 */
import { withArticle } from "./article";
import { findRecipe } from "./recipes";
import { rowNeed } from "./recipeBuild";
import { inchFrac } from "./inchText";
import { canonicalMeasures, typedMeasures } from "./measureText";
import { buildPlan } from "./report";
import { STOP, typedHeadNoun, sentenceCase } from "./headNoun";
import { isUnitItem } from "./unitItems";
import { typedInteriorCounts } from "./closedStorage";
import { normalizeUserPrompt } from "./voiceHonesty";
import { cleanness, floorFamily, floorOn, outgrows, unusable, UNUSABLE, type Axis, type Cleanness } from "./usableFloors";
import type { YardProject } from "./types";

/** A typed size this small is measured for clean parts (overlaps, loose parts, bays, drawers), not just the table. */
export const SMALL_TYPED_IN = 12;
/** The largest size the search for a minimum tries (no builder needs more to hold its parts). */
const SEARCH_MAX_IN = 120;

const WORD: Record<Axis, string> = { width: "wide", depth: "deep", height: "tall" };
const AXIS_WORDS: Record<Axis, string> = { width: "wide", depth: "deep", height: "tall|high" };
const AXES = ["width", "depth", "height"] as const;

/**
 * Parts that are not real (what I38 forbids): a size at zero or below, or one so thin its cut-list line rounds to
 * zero (a 0.02" rim, a tipi pole at 1/2" wide). The plan is only built when some part is under 1/16" or a typed size
 * is under SMALL_TYPED_IN, so a normal build pays nothing.
 */
export function nonPositiveParts(p: YardProject, smallTyped = false): string[] {
  const out = p.panels.filter((q) => !(q.size.width > 0 && q.size.height > 0 && q.size.depth > 0)).map((q) => q.name);
  if (out.length || (!smallTyped && !p.panels.some((q) => Math.min(q.size.width, q.size.height, q.size.depth) < 1 / 16))) return out;
  return buildPlan(p).cutList.filter((c) => !(c.lengthIn > 0 && c.widthIn > 0 && c.thicknessIn > 0)).map((c) => c.name);
}

const up16 = (n: number) => Math.ceil(n * 16 - 1e-6) / 16;

/** The thing asked for, without the size the builder appended ("Bookcase 1/2\" wide" → "Bookcase"). */
export function askedNoun(p: YardProject): string {
  // The size starts at the first number written as inches or with a size word after it ("Cabinet 1/2\" x 30\" x 16\"",
  // "Stool 1\" x 18\" seat", "Bookcase 1/2\" wide"); a stock name before it ("2x4 Workbench") stays.
  return p.name.replace(/\s+\d[\d ./]*(?:"|'|\s*(?:in\b|inch|wide|deep|tall|high|long|x\s*\d)).*$/i, "").trim() || p.name;
}

/**
 * The object's name in a sentence (Critic r2 row 148: 'linen closet 2 wide' read "A linen needs…"): the card's name,
 * carried on to the head noun typed when the card name stops short of it ("Linen" + "linen closet" → "linen closet").
 */
export function refusalNoun(p: YardProject, prompt: string): string {
  // The object, never the card's details after it ("Picture frame · 5×7 photo · …" is a picture frame).
  const card = askedNoun(p).split(" · ")[0].trim().toLowerCase();
  const head = typedHeadNoun(prompt);
  if (!head || card.split(/\s+/).some((w) => w.replace(/(?<!s)s$/, "") === head)) return card;
  const words = prompt.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  // Only the plain words that run from the card's first word to the head noun ("linen closet"), never a size or count.
  const from = words.indexOf(card.split(/\s+/)[0]);
  const to = words.findIndex((w, i) => i >= from && w.replace(/(?<!s)s$/, "") === head);
  const run = from >= 0 && to >= from ? words.slice(from, to + 1) : [];
  return run.length && run.length <= 4 && run.every((w) => /^[a-z]+$/.test(w) && !STOP.test(w)) ? run.join(" ") : card;
}

/** The typed sizes, per axis (an axis word wins over a W x D x H string). */
export function typedAxes(prompt: string, stockTuple = false): Partial<Record<Axis, number>> {
  const t = typedMeasures(prompt);
  const out: Partial<Record<Axis, number>> = {};
  if (t.tuple && !stockTuple) [out.width, out.depth, out.height] = t.tuple;
  for (const a of AXES) if (t[a] != null) out[a] = t[a];
  return out;
}

const AXIS_RE = (words: string) => new RegExp(String.raw`(?<![\d.])\d+(?:\.\d+)?(\s*(?:"|in(?![a-z])\.?|inch(?:es)?(?![a-z]))?\s*(?:${words})\b)`, "i");
const TUPLE_RE = /(?<![\d.])(\d+(?:\.\d+)?)(\s*(?:"|in)?\s*[x×]\s*)(\d+(?:\.\d+)?)(\s*(?:"|in)?\s*[x×]\s*)(\d+(?:\.\d+)?)/;

/** The prompt with one typed axis set to `to` inches (axis word or its place in a W x D x H string). */
export function withAxis(prompt: string, axis: Axis, to: number): string {
  const s = canonicalMeasures(prompt);
  const word = AXIS_RE(AXIS_WORDS[axis]);
  if (word.test(s)) return s.replace(word, (_, rest: string) => `${to}${rest}`);
  const k = { width: 0, depth: 1, height: 2 }[axis];
  return s.replace(TUPLE_RE, (all, a, x1, b, x2, c) => {
    const v = [a, b, c];
    v[k] = String(to);
    return `${v[0]}${x1}${v[1]}${x2}${v[2]}`;
  });
}

/** The prompt with every typed size taken out: the same ask at the builder's own default size. */
export function withoutSizes(prompt: string): string {
  let s = canonicalMeasures(prompt).replace(TUPLE_RE, " ");
  for (const a of AXES) s = s.replace(new RegExp(AXIS_RE(AXIS_WORDS[a]).source, "gi"), " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Nothing built, named, showing the size typed on every typed axis (I35 holds a refusal to that too). */
function refused(p: YardProject, noun: string, typed: Partial<Record<Axis, number>>, why: string): YardProject {
  const overall = { ...p.overall };
  for (const a of AXES) if (typed[a] != null) overall[a] = typed[a]!;
  // The notes are the refusal alone: a note about the build (its shelf count, its stock) would talk about a size not built.
  return { ...p, name: sentenceCase(noun), panels: [], instances: [], overall, notes: [why], refused: why, cardNote: why };
}

const real = (q: YardProject) => !nonPositiveParts(q, true).length;

/**
 * The refusal for a build too small to use, or null when it builds. `rebuild` builds a prompt (the same engine, one
 * call deeper, drawers hollowed as at the top) for the default-size reference and the search for the minimum.
 */
export function tooSmallRefusal(p: YardProject, prompt: string, rebuild: (prompt: string) => YardProject): YardProject | null {
  // A pocket build is sized to a measured opening: its own fitting owns that size, not a usable floor.
  if (p.refused || p.displayOnly || isUnitItem(p) || p.pocket) return null;
  // The same words the build read: "2x4x8 bench" is 2x4 stock, not a 2" × 4" × 8" bench.
  const typed = typedAxes(prompt, !typedMeasures(normalizeUserPrompt(prompt)).tuple);
  if (!AXES.some((a) => typed[a] != null)) return null;
  const family = floorFamily(p);
  const recipe = family === "measured" ? findRecipe(prompt) : null;
  // #90's counted-row rule owns its row's axis (a typed count is refused there with the width it needs).
  const rowAxis = recipe?.count ? rowNeed(recipe)?.axis : undefined;
  // Measured: a size under 12", or a recipe scaled under its own designed size.
  const measured = (a: Axis, v: number) => a !== rowAxis && (v < SMALL_TYPED_IN - 1e-6 || (recipe != null && v < recipe.size[a] - 1e-6));
  let base: Cleanness | null = null;
  const reference = () => (base ??= cleanness(rebuild(withoutSizes(prompt))));
  const why = (q: YardProject, fit = true, hands = true) => unusable(q, reference, real, fit, hands);
  // A small typed size must be the size built: nothing clamped up, no part reaching past it (beyond the design's spill).
  const small = AXES.filter((a) => typed[a] != null && measured(a, typed[a]!));
  const outgrown = (q: YardProject, at: Partial<Record<Axis, number>>) => small.find((a) => outgrows(q, a, at[a] ?? typed[a]!, reference().spill[a]));
  const ok = (q: YardProject, at: Partial<Record<Axis, number>> = {}) => why(q) === null && !outgrown(q, at);
  /** The smallest size from `from` up on one axis that is usable and clean, or null when none up to SEARCH_MAX_IN. */
  const least = (a: Axis, from: number): number | null => {
    const at = (to: number) => ok(rebuild(withAxis(prompt, a, to)), { [a]: to });
    let lo = Math.round(from * 16), hi = lo;
    // The first inch in sixteenths (a clean size can sit just over the floor with an unclean band above it), then doubling.
    for (; hi <= lo + 16; hi++) if (at(hi / 16)) return hi / 16;
    lo = hi - 1;
    hi = Math.max(lo + 16, lo * 2);
    while (hi <= SEARCH_MAX_IN * 16 && !at(hi / 16)) { lo = hi; hi *= 2; }
    if (hi > SEARCH_MAX_IN * 16) return null;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (at(mid / 16)) hi = mid; else lo = mid; }
    return hi / 16;
  };
  /**
   * A recipe's smallest clean size on one axis, read down from its designed size (a clean size can sit inside an
   * unclean band, so the first failure going down marks the floor): 1" steps, then halving to 1/16".
   */
  const leastDown = (a: Axis, top: number, floor: number): number | null => {
    const at = (to: number) => ok(rebuild(withAxis(prompt, a, to)), { [a]: to });
    let hi = Math.round(top * 16);
    if (!at(hi / 16)) return null;
    let lo = hi;
    while (lo > floor * 16) { lo = Math.max(Math.round(floor * 16), lo - 16); if (!at(lo / 16)) break; hi = lo; }
    if (hi === lo) return hi / 16;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (at(mid / 16)) hi = mid; else lo = mid; }
    return hi / 16;
  };
  /** What the size just under a minimum lacks, as the refusal says it. */
  const lacksAt = (a: Axis, to: number) => {
    const q = rebuild(withAxis(prompt, a, to));
    return why(q) ?? (outgrown(q, { [a]: to }) ? UNUSABLE.outgrows : null);
  };
  const noun = refusalNoun(p, prompt);
  const say = (a: Axis, min: number, why: string, v: number) => refused(p, noun, typed, `${withArticle(noun, true)} needs at least ${inchFrac(min)}" ${WORD[a]}${/^for /.test(why) ? " " : ": "}${why}. Nothing is built at ${inchFrac(v)}".`);
  // Under the family's usable floor, on any typed axis.
  for (const a of AXES) {
    const v = typed[a];
    const f = v == null ? null : floorOn(p, a);
    if (v == null || !f || v >= f.inches - 1e-6) continue;
    const min = least(a, f.inches) ?? f.inches;
    // The usable floor names the minimum unless the build only comes clean above it; then what it lacks is named.
    return say(a, min, min > f.inches + 1e-6 ? lacksAt(a, min - 1 / 16) ?? UNUSABLE.overlap : f.why, v);
  }
  // At or over the floor: a small size must build clean (no overlap, nothing loose) with every shelf bay and drawer a
  // hand's room, and so must a typed shelf or drawer count (a default count is the builder's to fit, usableFloors.ts).
  const counts = typedInteriorCounts(prompt);
  const lacks = why(p, small.length > 0 || nonPositiveParts(p).length > 0, small.length > 0 || !!(counts.shelf || counts.drawer)) ?? (outgrown(p, {}) ? UNUSABLE.outgrows : null);
  if (!lacks) return null;
  const first = outgrown(p, {});
  const order = small.length ? [...(first ? [first] : []), ...small.filter((a) => a !== first)] : (["height", "width", "depth"] as const).filter((x) => typed[x] != null && x !== rowAxis);
  for (const a of order) {
    const v = typed[a]!;
    const top = recipe?.size[a];
    const min = (top != null && top > v ? leastDown(a, top, v) : null) ?? least(a, up16(v + 1 / 16));
    // The reason is what the size just under the minimum lacks (a 1/2" abacus has unreal parts; at 8" they collide).
    if (min != null) return say(a, min, lacksAt(a, min - 1 / 16) ?? lacks, v);
  }
  return null;
}
