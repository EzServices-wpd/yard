import type { YardProject } from "./types";

/**
 * Row 51: words that say how a build is finished, moved, fitted, placed or what it holds, never which object it is.
 * "black painted bookshelf" is a bookshelf, "blanket chest" a chest, "fitted bookcase under stairs" a bookcase.
 * Widened: a model's style (skeleton, steam), a table's use (sewing, writing), what a shelf holds (vinyl records), a
 * mount (wall mounted). Words that change the object ("lap" desk, "standing" desk, "hanging" planter, "chicken"
 * tractor) are NOT here: a hanging planter is a pot on chains, not a planter box.
 */
export const READ_MODIFIER = /^(?:painted|stained|primed|finished|unfinished|varnished|oiled|rolling|mobile|fitted|built|builtin|nook|alcove|stairs?|blanket|hope|storage|skeleton|steam|diesel|sewing|writing|computer|gaming|vinyl|mounted)$/;

/** The prompt without its read modifiers: "a dinosaur skeleton" names a dinosaur. */
export function withoutReadModifiers(prompt: string): string {
  return prompt.split(/(\s+)/).filter((w) => !READ_MODIFIER.test(w.toLowerCase())).join("").replace(/\s+/g, " ").trim();
}

/**
 * Row 51 (own noun by name): the words a builder owns. Its own name counts only when it is the builder's name, not
 * the typed words echoed back as a title ("Mailbox Post" for "mailbox post" is an echo; "Train engine" for "steam
 * train" and "Andersen 100 Series double hung" for "Andersen window" are the builder's own). A builder kind also owns
 * the plain nouns people use for it (an opening is a window or a door).
 */
const KIND_NOUNS: Record<string, string> = {
  opening: "window windows door doors doorway",
};

const words = (s: string) => s.toLowerCase().replace(/\d[\d\s./'"″′×x-]*/g, " ").split(/[^a-z]+/).filter((w) => w.length >= 3);

/** The builder's own name words when the name is not just the typed words echoed back; otherwise none. */
export function builderNameWords(p: YardProject, prompt: string): string[] {
  const typed = new Set(words(prompt).map((w) => w.replace(/s$/, "")));
  const name = words(p.name ?? "");
  const echo = name.every((w) => typed.has(w.replace(/s$/, "")));
  return echo ? [] : name;
}

/** Everything the builder owns: kind, family, fitted program, its own name, and its kind's plain nouns. */
export function builderOwnText(p: YardProject, prompt: string): string {
  return [p.kind, p.fitted?.family ?? "", p.fitted?.program ?? "", ...builderNameWords(p, prompt), KIND_NOUNS[p.kind] ?? ""].join(" ").toLowerCase();
}

/** The builder's own (non-echo) name carries the typed head noun: "Train engine" for "a steam train". */
export function builderNameCarries(p: YardProject, prompt: string, head: string | null): boolean {
  if (!head) return false;
  const h = head.replace(/s$/, "");
  return builderNameWords(p, prompt).some((w) => w.replace(/s$/, "") === h);
}
