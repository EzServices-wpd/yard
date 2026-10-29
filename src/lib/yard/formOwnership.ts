import { namedFormReachesHead } from "./form";
import { detectWeekendMech } from "./weekendFamily";
/**
 * Spec 007 L1 · live path. One answer, shared by the bar handler (run-prompt.ts) and the invariants, to "does this
 * prompt go to the learner?". The engine is asked first: a build from the purpose resolver or the form library that
 * is not a generic stand-in is the engine's own, and the learner never pre-empts it.
 */
import { engineOwnsForm, isLockedForm } from "./form";
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

import { STOP, typedHeadNoun } from "./headNoun";
import { builderNameCarries, withoutReadModifiers } from "./builderName";
import { genericBoxOverAsk } from "./genericBox";
import { closedCarcaseReadsAsk } from "./closedStorage";
import { ignoredTypedWords } from "./promptMain";
import { houseFamilyOf } from "./family";
export { typedHeadNoun };
const stem = (w: string) => w.replace(/ves$/, "f").replace(/ies$/, "y").replace(/s$/, "");
/** The typed head noun when the engine's family table classifies its noun phrase ("utility cabinet", "tv stand"). */
export function familyHeadNoun(prompt: string): string | null {
  const head = typedHeadNoun(prompt);
  return head && houseFamilyOf(prompt.split(/\swith\s/i)[0]) ? head : null;
}
/**
 * I48: the feature words of a known family's ask ("with shelves", "with 3 drawers"), counted or not, are read when the
 * model has parts named for them, the same as a typed count: a feature never sends a family to the learner.
 */
function featureWords(prompt: string): Set<string> {
  if (!familyHeadNoun(prompt)) return new Set();
  const tail = prompt.toLowerCase().split(/\swith\s/).slice(1).join(" ");
  return new Set(tail.split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.test(w)));
}
function titleCarriesTypedWords(prompt: string, p: YardProject): boolean {
  const title = (p.name ?? "").toLowerCase();
  const features = featureWords(prompt);
  const parts = features.size ? p.panels.map((x) => x.name.toLowerCase()) : [];
  return prompt.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.test(w)).every((w) =>
    title.includes(w.replace(/s$/, "")) || (features.has(w) && parts.some((n) => n.includes(stem(w)))));
}

/** A library form owns a prompt only when it names the typed head noun ("wall clock" is a clock, not a Wall). */
export function namedFormOwnsHead(prompt: string): boolean {
  return namedFormReachesHead(prompt, typedHeadNoun(prompt));
}

/** The engine built this prompt from its own form library or purpose table (not a generic stand-in). */
export function engineBuiltForm(prompt: string, p: YardProject): boolean {
  if (genericFormMark(p) || p.standIn || p.unmatched) return false;
  // Hotfix #41: locked landmarks and a dedicated builder's custom build (submarine) are forms too.
  // Row 51 widened: a dedicated builder whose own name carries the typed head noun ("Train engine" for "a steam train").
  return isLockedForm(p.kind) || p.kind === "custom" || !!resolvePurpose(prompt) || namedFormOwnsHead(prompt) || namedFormOwnsHead(withoutReadModifiers(prompt)) || !!detectWeekendMech(prompt) ||
    builderNameCarries(p, prompt, typedHeadNoun(prompt));
}

/** A purpose ask is consumed whole; a named form whose title carries every typed word read them all. */
function readAll(prompt: string, p: YardProject): boolean {
  return !!resolvePurpose(prompt) || titleCarriesTypedWords(prompt, p);
}

/** Hotfix #41: the live bar keeps the engine build — it owns the shape and read the whole prompt. */
export function engineKeepsPrompt(prompt: string, p: YardProject, half: boolean): boolean {
  // Critic 10-17: the generic fallback box never keeps a prompt that asks for another form.
  if (genericBoxOverAsk(prompt, p)) return false;
  return engineBuiltForm(prompt, p) && (!half || readAll(prompt, p));
}

/**
 * The learner gate. A half-read compound noun (some typed word ignored) still learns; otherwise the learner runs
 * only when the engine has no form of its own: not a unit item, not an engine-library form, and the old checks
 * (craft stock nobody asked for, a build whose name shares no typed word) say so.
 */
/** A non-empty sheet shell is the engine's own build of the typed envelope. */
function isBuiltSheetShell(p: YardProject): boolean {
  if (!p.panels || p.panels.length < 4 || p.displayOnly) return false;
  const id = p.primaryMaterialId ?? "";
  return /cardboard|sheet|plywood|chipboard|corrugated/i.test(id);
}

export function routesToLearner(prompt: string, p: YardProject, half: boolean): boolean {
  if (findRecipe(prompt) || p.pocket) return false;
  if ((p.notes ?? []).some((n) => n.startsWith(UNIT_ITEM_NOTE))) return false;
  // Critic 10-17: a build wins over the learner only when it is the asked-for form, never the generic fallback box.
  // A built sheet shell of the typed envelope is the engine's own form. The learner never replaces a non-empty sheet shell with a placeholder.
  if (isBuiltSheetShell(p)) return false;
  if (genericBoxOverAsk(prompt, p)) return true;
  // Refiner :20: a closed storage carcase that holds the typed size and interior counts read the whole ask.
  if (closedCarcaseReadsAsk(prompt, p, () => (half ? ignoredTypedWords(p, prompt) : []))) return false;
  // A real half-read ("lap desk" → Desk) still learns; "Dutch Windmill" / a purpose ask read every word.
  if (half && !readAll(prompt, p)) return true;
  if (engineKeepsPrompt(prompt, p, half)) return false;
  const craftGuess = /popsicle|craft|stick/i.test(p.primaryMaterialId ?? "") && !/popsicle|craft|stick|toy|model|miniature|kids?'? craft/i.test(prompt);
  return craftGuess || needsRecipeLookup(p, prompt, engineOwnsForm(prompt, p), false);
}

/**
 * C10: every size the brief needs was typed (width, height and depth), so the house brief (an xAI server call that
 * can only re-guess them) has nothing to add. The engine's build and its price are the answer, with no wait.
 */
export function typedSizeComplete(parsed: { typedAxes?: { width?: boolean; height?: boolean; depth?: boolean } } | null | undefined): boolean {
  const t = parsed?.typedAxes;
  return !!t && !!t.width && !!t.height && !!t.depth;
}
