/**
 * I37 · the silent-fallback hunter. A build that quietly fell back, or whose words still carry the engine's own, is
 * caught here before a person sees it:
 *  - no-class: the build fell back to a body with no class (a stand-in, an unmatched body, a generic box or slab, a
 *    simple stand-in, a spine-only boat, a not-learned card);
 *  - engine-word: the engine's own words reach a note, title or step ("fallback", "stand-in", "No class matched",
 *    "kind: …", a catalog id like plywood-3-4-4x8);
 *  - raw-name: a raw variable name (camelCase or snake_case);
 *  - nan: NaN, undefined, null, Infinity or [object Object];
 *  - zero: "drives 0" or a 0″ dimension;
 *  - decimal-inch: decimal inches (3.5") where the person reads fractions.
 * Pure and local: it reads the finished build and its plan, nothing else.
 */
import type { BuildPlan, YardProject } from "./types";
import { genericFormMark } from "./formOwnership";
import { genericFallbackBox } from "./genericBox";

export type HunterCheck = "no-class" | "engine-word" | "raw-name" | "nan" | "zero" | "decimal-inch";
export type HunterHit = { check: HunterCheck; what: string; where: string };
export const HUNTER_CHECKS: HunterCheck[] = ["no-class", "engine-word", "raw-name", "nan", "zero", "decimal-inch"];

/** The person-facing text of a build: its title, notes, steps, Buy rows and cut-list rows, each with where it sits. */
export function personText(p: YardProject, plan: BuildPlan): [string, string][] {
  return [
    ["title", p.name ?? ""],
    ...(p.notes ?? []).map((n, i): [string, string] => [`note ${i + 1}`, n]),
    ...plan.instructions.map((s): [string, string] => [`step ${s.step}`, `${s.title} ${s.description} ${s.tips ?? ""}`]),
    ...plan.bom.map((b): [string, string] => [`buy ${b.name}`, `${b.name} ${b.notes ?? ""}`]),
    ...plan.cutList.map((c): [string, string] => [`cut ${c.name}`, `${c.name} ${c.notes ?? ""} ${c.label ?? ""}`]),
  ];
}

const WORD_CHECKS: [HunterCheck, RegExp, string][] = [
  ["engine-word", /\bfall-?backs?\b/i, "fallback"],
  ["engine-word", /\bstand-?ins?\b|\bstandIn\b/i, "stand-in"],
  ["engine-word", /\bNo class matched\b/i, "No class matched"],
  ["engine-word", /\b(?:kind|family|program|anatomy|recipe|catalogId|materialId)\s*[:=]\s*\S/i, "internal field"],
  ["engine-word", /\b[a-z]+-[a-z0-9]+-[a-z0-9-]*\d[a-z0-9-]*\b/, "catalog id"],
  ["raw-name", /\b[a-z]{2,}(?:[A-Z][a-z0-9]+)+\b/, "camelCase name"],
  ["raw-name", /\b[a-z]+_[a-z0-9_]+\b/, "snake_case name"],
  ["nan", /\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b|\[object Object\]/, "NaN/undefined/null"],
  ["zero", /\bdrives 0\b/, "'drives 0'"],
  ["zero", /(?<![\d./]|between |from )0(?:\.0+)?\s?(?:″|"|-inch\b|\s?in\.?(?=\s|$))(?!\s*(?:to|-|–)\s*\d)/, "0″ dimension"],
  ["decimal-inch", /(?<![\d.])\d*\.\d+\s?(?:″|"|''|-?inch(?:es)?\b|in\.?(?=[\s,;)]|$))/, "decimal inches"],
];

/** Every hunter hit on one build, each named by its sub-check, the words matched and where they sit. */
export function hunt(p: YardProject, plan: BuildPlan): HunterHit[] {
  const out: HunterHit[] = [];
  if (p.standIn) out.push({ check: "no-class", what: "stand-in body", where: "model" });
  if (p.unmatched) out.push({ check: "no-class", what: "unmatched body", where: "model" });
  const mark = genericFormMark(p);
  if (mark && !(p.unmatched && mark === "unmatched body")) out.push({ check: "no-class", what: mark, where: "model" });
  if (genericFallbackBox(p)) out.push({ check: "no-class", what: "generic box", where: "model" });
  for (const [where, text] of personText(p, plan)) {
    for (const [check, re, what] of WORD_CHECKS) {
      const m = text.match(re);
      if (m && !out.some((h) => h.check === check && h.what === what)) out.push({ check, what: `${what} (“${m[0].trim()}”)`, where });
    }
  }
  return out;
}
