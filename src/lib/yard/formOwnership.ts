/**
 * Hotfix (canaries live): one rule for "the engine owns this shape", used by the live bar before the learner.
 * An engine-owned shape always wins; the learner runs only when no form exists.
 */
import { isLockedForm, namedFormReachesHead } from "./form";
import { detectWeekendMech } from "./weekendFamily";
import { typedHeadNoun, STOP } from "./headNoun";
import type { YardProject } from "./types";

/** The bench holds a stand-in, not a form (display-only block, unmatched body, "No class matched"). */
export function genericBuild(p: YardProject): boolean {
  return !!p.displayOnly || !!p.standIn || !!p.unmatched || (p.notes ?? []).some((n) => /No class matched|as a simple/i.test(n));
}

/** The engine built a real form for this prompt: a locked landmark, a library form reaching the head noun, or a weekend mechanism. */
export function engineBuiltForm(prompt: string, p: YardProject): boolean {
  if (genericBuild(p)) return false;
  // A dedicated builder's own build (submarine tube block, …) is a form too; unmatched bodies were excluded above.
  return isLockedForm(p.kind) || p.kind === "custom" || namedFormReachesHead(prompt, typedHeadNoun(prompt)) || !!detectWeekendMech(prompt);
}

/** Every content word typed is in the title ("Dutch Windmill"): a half-read check that fired on a modifier the form used. */
export function titleCarriesTypedWords(prompt: string, p: YardProject): boolean {
  const title = (p.name ?? "").toLowerCase();
  return prompt.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2 && !STOP.test(w)).every((w) => title.includes(w.replace(/s$/, "")));
}

/** The live bar keeps the engine build: it owns the shape and read the whole prompt (or its title carries every word). */
export function engineKeepsPrompt(prompt: string, p: YardProject, half: boolean): boolean {
  return engineBuiltForm(prompt, p) && (!half || titleCarriesTypedWords(prompt, p));
}
