/**
 * Too small to build (Critic #103 F2, I38): 'bookcase 1/2 wide' built a Back, Top and Shelves -1" wide. A typed size
 * that can't hold its parts is refused, never built with parts at zero or below, and the refusal names the
 * smallest size that builds, in #90's shared pattern: '<Thing> · nothing built' and a note naming the minimum.
 * - A carcass (two uprights, a bottom and a back: bookcase, cabinet, shelf unit, dresser, desk, toy box) needs two panel thicknesses plus a minimum opening on every axis.
 * - Any other builder (a recipe, a stool) that still makes a part at or under zero is measured: the smallest size
 *   on the typed axis at which every part is real is found by rebuilding, and named.
 */
import { getCatalogItem } from "./catalog";
import { withArticle } from "./article";
import { inchFrac } from "./inchText";
import { canonicalMeasures, typedMeasures } from "./measureText";
import { buildPlan } from "./report";
import { closetShelfClearIn, closetShelfMinHeight, rodShelfMinHeight, typedRodDemand, typedShelfDemand } from "./shelfClear";
import { shelfLevelLayout, shelfLevelsFit } from "./shelfSpan";
import type { YardProject } from "./types";

/** The least clear opening a carcass keeps between its two panels on any axis. */
export const MIN_INTERIOR_IN = 1;
/** A typed size this small builds its plan to check every cut-list line is real. */
export const SMALL_TYPED_IN = 12;
/** The largest size the search for a minimum tries (no builder needs more to hold its parts). */
const SEARCH_MAX_IN = 120;
type Axis = "width" | "depth" | "height";
const WORD: Record<Axis, string> = { width: "wide", depth: "deep", height: "tall" };
const AXIS_WORDS: Record<Axis, string> = { width: "wide", depth: "deep", height: "tall|high" };

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

/** The typed sizes, per axis (an axis word wins over a W x D x H string). */
function typedAxes(prompt: string): Partial<Record<Axis, number>> {
  const t = typedMeasures(prompt);
  const out: Partial<Record<Axis, number>> = {};
  if (t.tuple) [out.width, out.depth, out.height] = t.tuple;
  for (const a of ["width", "depth", "height"] as const) if (t[a] != null) out[a] = t[a];
  return out;
}

/** The prompt with one typed axis set to `to` inches (axis word or its place in a W x D x H string). */
export function withAxis(prompt: string, axis: Axis, to: number): string {
  const s = canonicalMeasures(prompt);
  const word = new RegExp(String.raw`(?<![\d.])\d+(?:\.\d+)?(\s*(?:"|in(?![a-z])\.?|inch(?:es)?(?![a-z]))?\s*(?:${AXIS_WORDS[axis]})\b)`, "i");
  if (word.test(s)) return s.replace(word, (_, rest: string) => `${to}${rest}`);
  const k = { width: 0, depth: 1, height: 2 }[axis];
  return s.replace(/(?<![\d.])(\d+(?:\.\d+)?)(\s*(?:"|in)?\s*[x×]\s*)(\d+(?:\.\d+)?)(\s*(?:"|in)?\s*[x×]\s*)(\d+(?:\.\d+)?)/, (all, a, x1, b, x2, c) => {
    const v = [a, b, c];
    v[k] = String(to);
    return `${v[0]}${x1}${v[1]}${x2}${v[2]}`;
  });
}

function refused(p: YardProject, why: string): YardProject {
  // Nothing is built, so no note about the parts it would have had ("Bead is 0\" across", I37 zero) rides along.
  return { ...p, name: askedNoun(p), panels: [], instances: [], notes: [], refused: why, cardNote: why };
}


/**
 * The refusal for a build too small to hold its parts, or null when it builds. `rebuild` builds a prompt (the same
 * engine, one call deeper) for the search.
 */
export function tooSmallRefusal(p: YardProject, prompt: string, rebuild: (prompt: string) => YardProject): YardProject | null {
  if (p.refused) return null;
  const typed = typedAxes(prompt);
  const noun = askedNoun(p);
  const lower = noun.toLowerCase();
  // A carcass: two panels and an opening on every axis.
  const n = (t: string) => p.panels.filter((q) => q.type === t).length;
  if (n("upright") >= 2 && n("back") >= 1 && n("bottom") >= 1) {
    const c = getCatalogItem(p.primaryMaterialId);
    const t = c?.formFactor === "sheet" ? c.dims.thickness ?? c.dims.height : undefined;
    if (t) {
      const min = up16(2 * t + MIN_INTERIOR_IN);
      for (const a of ["width", "depth", "height"] as const) {
        const v = typed[a];
        if (v != null && v < min - 1e-6) {
          return refused(p, `${withArticle(lower, true)} needs at least ${inchFrac(min)}" ${WORD[a]}: two ${inchFrac(t)}" panels and a ${inchFrac(MIN_INTERIOR_IN)}" opening between them. Nothing is built at ${inchFrac(v)}".`);
        }
      }
    }
  }
  const small = Object.values(typed).some((v) => v != null && v < SMALL_TYPED_IN);
  if (!nonPositiveParts(p, small).length) return null;
  // Any builder: the smallest size on a typed axis at which every part is real, found by rebuilding.
  for (const a of ["width", "depth", "height"] as const) {
    const v = typed[a];
    if (v == null) continue;
    const ok = (to: number) => { const q = rebuild(withAxis(prompt, a, to)); return !q.refused && q.panels.length > 0 && !nonPositiveParts(q, to < SMALL_TYPED_IN).length; };
    // The first size that builds, doubling up from the typed one (a huge size can fail for its own reasons), then halve.
    let lo = Math.round(v * 16), hi = Math.max(lo * 2, 16);
    while (hi <= SEARCH_MAX_IN * 16 && !ok(hi / 16)) { lo = hi; hi *= 2; }
    if (hi > SEARCH_MAX_IN * 16) continue;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ok(mid / 16)) hi = mid; else lo = mid; }
    const min = hi / 16;
    return refused(p, `${withArticle(lower, true)} needs at least ${inchFrac(min)}" ${WORD[a]} for its parts to fit. Nothing is built at ${inchFrac(v)}".`);
  }
  return null;
}

/**
 * A typed shelf count never shrinks. Each level keeps 7" clear. A rod is in the minimum only
 * when one was typed. The height is closetShelfMinHeight, the same number #112 names.
 */
export function shelfCountRefusal(p: YardProject, prompt: string, _rebuild: (prompt: string) => YardProject): YardProject | null {
  void _rebuild;
  if (p.refused || !p.panels.length) return null;
  const asked = typedShelfDemand(prompt);
  if (asked == null || shelfLevelsFit(p.panels, asked)) return null;
  // Corner shelves are named Triangle, not Shelf. This minimum is the even carcass stack only.
  const layout = shelfLevelLayout(p.panels);
  if (layout.levels === 0) return null;
  const noun = askedNoun(p).toLowerCase();
  const withRod = typedRodDemand(prompt);
  const min = withRod ? rodShelfMinHeight(asked) : closetShelfMinHeight(asked);
  // Already at least that tall: the miss is not this height, so the build stands.
  if (p.overall.height + 1e-6 >= min) return null;
  const word = asked === 1 ? "shelf" : "shelves";
  const rod = withRod ? " and a hanging rod" : "";
  return refused(p, `${withArticle(noun, true)} needs at least ${inchFrac(min)}" tall for ${asked} ${word} with ${inchFrac(closetShelfClearIn())}" clear between them${rod}. Nothing is built at ${inchFrac(p.overall.height)}".`);
}
