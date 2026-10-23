/**
 * Class C41 · a feature word never picks the build. Doors, drawers, a lid, casters or wheels, and shelves typed after
 * the head noun ("kitchen cart with doors on casters", "bench with drawers", "chest with a lid") are features of the
 * head noun's build: the head noun picks the family, and each feature is built on it as a front, a lid or hardware.
 * When the family has nowhere to put one, the build says so in a note rather than dropping the word.
 */
import type { YardProject } from "./types";
import { typedHeadNoun } from "./headNoun";
import { ROLLING, isCasterPart } from "./casterParts";

export type TypedFeature = "doors" | "drawers" | "lid" | "casters" | "shelves";
/** The nouns a feature word can be. A build titled by one of these when the typed head noun is not one picked the wrong family. */
export const FEATURE_NOUN = /^(?:doors?|drawers?|lids?|wheels?|casters?|castors?|shel(?:f|ves))$/;

const WORDS: Record<TypedFeature, RegExp> = {
  doors: /\bdoors?\b/,
  drawers: /\bdrawers?\b/,
  lid: /\blids?\b/,
  casters: /\b(?:casters?|castors?|wheels?)\b/,
  shelves: /\bshel(?:f|ves)\b/,
};
const NEGATED = (w: string) => new RegExp(`\\b(?:no|without|w/o|minus)\\s+(?:a\\s+|any\\s+)?(?:[a-z]+\\s+)?${w}`);

/** The part of the prompt after its head noun phrase ("with doors on casters"), where feature words live. */
export function featureTail(prompt: string): string {
  const lower = prompt.toLowerCase();
  const m = lower.match(/\s(?:with|w\/|plus|and|on|having|that has)\s/);
  return m && m.index !== undefined ? lower.slice(m.index) : "";
}

/** The features typed after the head noun, each once ("kitchen cart with doors on casters" → doors, casters). */
export function typedFeatures(prompt: string): TypedFeature[] {
  const head = typedHeadNoun(prompt);
  if (!head || FEATURE_NOUN.test(head)) return [];
  const tail = featureTail(prompt);
  const out: TypedFeature[] = [];
  for (const f of Object.keys(WORDS) as TypedFeature[]) {
    const m = tail.match(WORDS[f]);
    if (!m || NEGATED(m[0]).test(tail)) continue;
    out.push(f);
  }
  if (!out.includes("casters") && ROLLING.test(prompt) && /\brolling\b|\bmobile\b/i.test(prompt)) out.push("casters");
  return out;
}

const partText = (p: YardProject) => [...p.panels.map((x) => x.name ?? ""), ...(p.instances ?? []).map((i) => (i as { name?: string }).name ?? "")].join("\n");

/** The build has the feature as a part (a door, a drawer front, a lid, a caster or wheel, a shelf). */
export function featureBuilt(p: YardProject, f: TypedFeature): boolean {
  if (f === "casters" && p.panels.some(isCasterPart)) return true;
  if (f === "drawers" && p.panels.some((x) => !!(x as { drawerPart?: string }).drawerPart)) return true;
  if (f === "doors" && p.kind !== "opening" && p.panels.some((x) => x.type === "door")) return true;
  return WORDS[f].test(partText(p).toLowerCase());
}

/** A note that answers the ask: it says the feature was asked for, or what was built without it or in its place. */
const ANSWERS = /\byou asked\b|\btyped\b|\bwithout\b|\binstead\b|\bcannot\b|\bcan't\b/i;
/** The build's notes answer the feature (built some other way, or refused with a reason); a passing mention is not one. */
export function featureNoted(p: YardProject, f: TypedFeature): boolean {
  return (p.notes ?? []).some((n) => WORDS[f].test(n.toLowerCase()) && ANSWERS.test(n));
}

const SAY = (w: string, h: string, f: TypedFeature) =>
  f === "lid" || !/s$/.test(w) ? `You asked for a ${w}; this ${h} is built without one for now.` : `You asked for ${w}; this ${h} is built without them for now.`;

/** Every typed feature is built or named in a note: a feature the family cannot take is refused out loud, never dropped. */
export function withFeatureNotes(p: YardProject, prompt: string): YardProject {
  if (!p.panels?.length && !(p.instances ?? []).length) return p;
  const missing = typedFeatures(prompt).filter((f) => !featureBuilt(p, f) && !featureNoted(p, f));
  if (!missing.length) return p;
  const tail = featureTail(prompt);
  const head = typedHeadNoun(prompt) ?? "build";
  const notes = missing.map((f) => SAY(tail.match(WORDS[f])?.[0] ?? f, head, f));
  return { ...p, notes: [...(p.notes ?? []), ...notes] };
}

/** The title's head noun, sizes dropped ("Prehung Interior 36×80 door" → door). */
export function titleHeadNoun(name: string): string | null {
  const ws = name.toLowerCase().replace(/[\d½¼¾⅛⅜⅝⅞/×x"″'.-]+(?=\s|$)/g, " ").split(/[^a-z]+/).filter((w) => w.length > 1);
  return ws.length ? ws[ws.length - 1] : null;
}
