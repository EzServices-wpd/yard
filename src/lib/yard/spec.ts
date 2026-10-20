/**
 * One spec object per prompt (YARD-SPEC "Architecture"): built once at intake (generateFromPrompt → `project.spec`)
 * from the person's own words and the build. It holds the object noun; W, D and H, each marked typed or assumed;
 * typed counts and features; stock and species; and the refusal. Surfaces read it instead of deciding on their own.
 * First reader: the PDF cover (typedAxesTalk). A typed axis is never assumed; a whole bought item is its trade size.
 */
import { modelFinishedDepth } from "./modelSize";
import { namedLumberFromPrompt } from "./namedLumberSpecies";
import { frac } from "./pdfKit";
import { askedNoun } from "./tooSmall";
import { isBedLongWide, typedAxesOf, type Axis } from "./typedAxesRead";
import { isUnitItem } from "./unitItems";
import type { YardProject } from "./types";

export type SpecAxis = { inches: number; typed: boolean; assumed: boolean };
export type YardSpec = {
  noun: string;
  size: Record<Axis, SpecAxis>;
  /** Nothing typed: the build stands at its design size. */
  stock: boolean;
  /** Assumed part sizes that are not the overall (an L-desk wing's depth): "desk 24" deep". */
  parts: string[];
  /** Counts the person typed ("3 shelves" → { shelves: 3 }). */
  counts: Record<string, number>;
  /** Features the person named (casters, doors, drawers …). */
  features: string[];
  /** The build's primary stock and the species named, if any. */
  stockId: string;
  species: string | null;
  refusal: string | null;
};

const AXES: Axis[] = ["width", "height", "depth"];
const WORD: Record<Axis, string> = { width: "wide", height: "tall", depth: "deep" };
const inches = (t: string) => t.trim().split(/\s+/).reduce((n, w) => n + (w.includes("/") ? Number(w.split("/")[0]) / Number(w.split("/")[1]) : Number(w)), 0);
const NOTE = /^Assumed\s+(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(?:"|″|in)?\s*(wide|tall|deep|long)\b(?:\s*\(([^)]*)\))?/i;
/** A note about the overall ("(default size)", "(bookcase class default)"), not a part. */
const overallNote = (paren?: string) => !paren || /^(?:[a-z]+\s+)?(?:class\s+)?default(?:\s+size)?$/i.test(paren.trim());
const NUMBER: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const COUNTED = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(?:[a-z-]+\s+)?(shelves|shelf|drawers?|doors?|bays?|cubbies|cubby|rungs?|steps?|legs?|hooks?|cubes?|baskets?|tiers?)\b/gi;
const FEATURES = ["casters", "wheels", "doors", "drawers", "shelves", "hinges", "slides", "handles", "pulls", "knobs", "hooks", "mirror", "toe kick", "back", "lid", "cubbies", "rod"];

/** The unit the plan is about: a pocket build's unit (its overall is the room pocket it stands in), else the overall. */
export function specBox(project: Pick<YardProject, "overall" | "pocket">): { width: number; height: number; depth: number } {
  const u = project.pocket?.unit;
  return u ? { width: u.width, height: u.height, depth: u.depth } : project.overall;
}

/** Build the spec from the person's words (the raw prompt, never an engine rewrite) and the built project. */
export function buildSpec(project: YardProject, typedWords?: string, opts: { override?: boolean } = {}): YardSpec {
  const words = project.typedPrompt ?? typedWords ?? project.prompt ?? "";
  const box = specBox(project);
  const finished = modelFinishedDepth(project.panels, box.depth);
  const bed = isBedLongWide(project.notes);
  const typedSet = typedAxesOf(words, bed, { ...box, depth: finished }, box);
  const assumed: Partial<Record<Axis, boolean>> = {};
  const parts: string[] = [];
  for (const n of project.notes ?? []) {
    const m = String(n).trim().match(NOTE);
    if (!m) continue;
    const a: Axis = /long/i.test(m[2]) ? "width" : /wide/i.test(m[2]) ? (bed ? "depth" : "width") : /tall/i.test(m[2]) ? "height" : "depth";
    const v = inches(m[1]);
    // An overall note speaks for the built box or not at all: a stale one (a room pocket's) is never a second size.
    if (Math.abs(v - box[a]) < 0.5 || (a === "depth" && Math.abs(v - finished) < 0.07)) assumed[a] = true;
    else if (!overallNote(m[3])) parts.push(`${m[3]!.replace(/\s+/g, " ").trim().replace(/\s*(?:class\s+)?default$/i, "")} ${frac(v)} ${WORD[a]}`);
  }
  const lp = words.toLowerCase();
  const noDigits = !/\d/.test(lp);
  // Digits that size nothing ("3 bays", "20lb tank") type no axis: with no dimension triple and no bare length, an
  // axis no number names is assumed.
  const sized = /\d\s*(?:"|″|in\b|inch|ft\b|feet|foot|'|cm\b|mm\b)?\s*(?:[x×]|by)\s*\d/.test(lp) || /\d\s*(?:'|ft\b|feet|foot|cm\b|mm\b|"|″|in\b|inch(?:es)?\b)(?!\s*(?:wide|width|long|length|tall|high|height|deep|depth))/.test(lp);
  if (!noDigits && !sized) for (const a of AXES) assumed[a] = true;
  const stock = noDigits && !parts.length && (!Object.keys(assumed).length || AXES.every((a) => assumed[a]));
  if (stock) AXES.forEach((a) => (assumed[a] = true));
  // A typed axis is never assumed. C11: a whole bought item is its known trade size, never an assumed size.
  // A bench edit (Measure, a size override, a refit hole) types every axis.
  if (opts.override) AXES.forEach((a) => typedSet.add(a));
  for (const a of typedSet) assumed[a] = false;
  const unit = isUnitItem(project);
  const size = Object.fromEntries(AXES.map((a) => [a, { inches: a === "depth" ? finished : box[a], typed: typedSet.has(a), assumed: !unit && !!assumed[a] }])) as Record<Axis, SpecAxis>;
  const counts: Record<string, number> = {};
  for (const m of words.matchAll(COUNTED)) counts[m[2].toLowerCase()] = NUMBER[m[1].toLowerCase()] ?? Number(m[1]);
  return {
    noun: askedNoun(project),
    size,
    stock,
    parts: unit ? [] : parts,
    counts,
    features: FEATURES.filter((f) => new RegExp(String.raw`\b${f.replace(/s$/, "")}(?:s|es)?\b`, "i").test(lp)),
    stockId: project.primaryMaterialId,
    species: namedLumberFromPrompt(words)?.display ?? null,
    refusal: project.refused ?? null,
  };
}

/** The project's spec: the one set at intake, or (an older saved build) read the same way now. */
export function specOf(project: YardProject): YardSpec {
  return project.spec ?? buildSpec(project);
}
