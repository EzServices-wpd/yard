import { namedFormReachesHead } from "./form";
import { detectWeekendMech } from "./weekendFamily";
/**
 * Spec 007 L1 · live path. One answer, shared by the bar handler (run-prompt.ts) and the invariants, to "does this
 * prompt go to the learner?". The engine is asked first: a build from the purpose resolver or the form library that
 * is not a generic stand-in is the engine's own, and the learner never pre-empts it.
 */
import { engineOwnsForm, namedFormOf } from "./form";
import { resolvePurpose } from "./purposeForms";
import { needsRecipeLookup } from "./recipeBuild";
import { findRecipe } from "./recipes";
import { UNIT_ITEM_NOTE } from "./unitItems";
import type { YardProject } from "./types";

/** The marks a generic stand-in leaves: a placeholder, an unmatched body, a "simple X sized for it", the spine-only boat. */
export function genericFormMark(p: YardProject): string | null {
  if (p.displayOnly) return "Not learned yet";
  const notes = (p.notes ?? []).join(" / ");
  if (/No class matched/.test(notes)) return "unmatched body";
  if (/Yard built an? .{1,80}? as a simple /.test(notes)) return "simple stand-in";
  if (p.kind === "vessel" && p.name === "Boat" && (p.instances?.length ?? 0) < 20) return "spine-only boat";
  return null;
}

const STOP = /^(?:a|an|the|my|our|for|to|of|with|and|from|inch|inches|wide|tall|high|deep|long|foot|feet)$/;
function titleCarriesTypedWords(prompt: string, p: YardProject): boolean {
  const title = (p.name ?? "").toLowerCase();
  return prompt.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.test(w)).every((w) => title.includes(w.replace(/s$/, "")));
}

/** A library form owns a prompt only when it names the typed head noun ("wall clock" is a clock, not a Wall). */
export function typedHeadNoun(prompt: string): string | null {
  const ws = prompt.toLowerCase().replace(/\d[\d./]*\s*(?:"|in(?:ch(?:es)?)?|ft|feet|foot|')?/g, " ").split(/[^a-z]+/).filter((w) => w.length > 1 && !STOP.test(w));
  return ws.length ? ws[ws.length - 1].replace(/(?:es|s)$/, "") : null;
}
export function namedFormOwnsHead(prompt: string): boolean {
  return namedFormReachesHead(prompt, typedHeadNoun(prompt));
}

/** The engine built this prompt from its own form library or purpose table (not a generic stand-in). */
export function engineBuiltForm(prompt: string, p: YardProject): boolean {
  if (genericFormMark(p) || p.standIn || p.unmatched) return false;
  return !!resolvePurpose(prompt) || namedFormOwnsHead(prompt) || !!detectWeekendMech(prompt);
}

/**
 * The learner gate. A half-read compound noun (some typed word ignored) still learns; otherwise the learner runs
 * only when the engine has no form of its own: not a unit item, not an engine-library form, and the old checks
 * (craft stock nobody asked for, a build whose name shares no typed word) say so.
 */
export function routesToLearner(prompt: string, p: YardProject, half: boolean): boolean {
  if (findRecipe(prompt) || p.pocket) return false;
  if ((p.notes ?? []).some((n) => n.startsWith(UNIT_ITEM_NOTE))) return false;
  if (half) {
    // A purpose ask is consumed whole by the resolver; a named form whose title carries the "ignored" word
    // ("Dutch Windmill", "Covered Bridge") read it. A real half-read ("lap desk" → Desk) still learns.
    const readAll = !!resolvePurpose(prompt) || (namedFormOwnsHead(prompt) && !genericFormMark(p) && titleCarriesTypedWords(prompt, p));
    if (!readAll) return true;
  }
  if (engineBuiltForm(prompt, p)) return false;
  const craftGuess = /popsicle|craft|stick/i.test(p.primaryMaterialId ?? "") && !/popsicle|craft|stick|toy|model|miniature|kids?'? craft/i.test(prompt);
  return craftGuess || needsRecipeLookup(p, prompt, engineOwnsForm(prompt, p), false);
}
