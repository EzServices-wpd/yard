import type { Panel } from "./types";

/**
 * C13 casters, one source of truth: the mobility words and the parts the casters step adds. withCasters makes them;
 * every check that asks "what is this build's form?" (the generic-box rule) leaves them out, because casters are
 * hardware under a build, never its form.
 */
/** Mobility words: "rolling bookshelf", "kitchen island on casters", "cart with wheels". Never a rolling pin. */
export const ROLLING = /\brolling\b(?!\s+(?:pin|ball|marble|hills?|stock|shutter|ladder))|\bon\s+(?:locking\s+)?(?:casters|castors|wheels)\b|\bwith\s+(?:locking\s+)?(?:casters|castors)\b|\bmobile\b(?=\s+[a-z])/i;
/** The same words, every occurrence, for stripping them out of a prompt. */
const ROLLING_ALL = new RegExp(ROLLING.source, "gi");

export const CASTER_NAME = (n: number) => `Caster ${n}`;
export const casterPartId = (projectId: string, n: number) => `${projectId}-caster-${n}`;
/** A part the casters step added (the caster under each corner). */
export function isCasterPart(x: Pick<Panel, "id" | "name">): boolean {
  return /-caster-\d+$/.test(x.id ?? "") || /^Caster \d+$/.test(x.name ?? "");
}
/** The prompt without its mobility words: "rolling under-stairs storage" → "under-stairs storage". */
export function withoutMobility(prompt: string): string {
  return prompt.replace(ROLLING_ALL, " ").replace(/\s+/g, " ").trim();
}
