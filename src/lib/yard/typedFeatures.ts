/**
 * Class C41 · a feature word never picks the build. Doors, drawers, a lid, casters or wheels, and shelves typed after
 * the head noun ("kitchen cart with doors on casters", "bench with drawers", "chest with a lid") are features of the
 * head noun's build: the head noun picks the family, and each feature is built on it as a front, a lid or hardware.
 * When the family has nowhere to put one, the build says so in a note rather than dropping the word.
 */
import type { YardProject } from "./types";
import { typedHeadNoun } from "./headNoun";
import { ROLLING, isCasterPart } from "./casterParts";
import { isClothesRodPrompt, rodsAsked } from "./hangingClearance";
import { NUM, readCount } from "./countWords";
import { headerShelfCount, shelfLineCount } from "./shelfSpan";

export type TypedFeature = "doors" | "drawers" | "lid" | "casters" | "shelves" | "rods" | "double hang" | "pull-outs";
/** The nouns a feature word can be. A build titled by one of these when the typed head noun is not one picked the wrong family. */
export const FEATURE_NOUN = /^(?:doors?|drawers?|lids?|wheels?|casters?|castors?|shel(?:f|ves))$/;

const WORDS: Record<TypedFeature, RegExp> = {
  doors: /\bdoors?\b/,
  drawers: /\bdrawers?\b/,
  lid: /\blids?\b/,
  casters: /\b(?:casters?|castors?|wheels?)\b/,
  shelves: /\bshel(?:f|ves)\b/,
  rods: /\b(?:(?:hanging|clothes|closet)\s+)?rods?\b/,
  "double hang": /\bdouble[\s-]*(?:hang(?:ing)?|rods?)\b/,
  "pull-outs": /\b(?:pull|slide|roll)[\s-]*outs?(?:\s+(?:shel(?:f|ves)|drawers?|trays?|baskets?|bins?))?\b/,
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
    // Rods are read as a count (readCounts); double hang and pull-outs only as Ezra's card words them, on its heads.
    if (f === "rods" || (f in CARD_SAYS && !CARD_SAYS[f as keyof typeof CARD_SAYS](tail, head))) continue;
    const m = tail.match(WORDS[f]);
    // "with 0 shelves" asks for none: the count reader answers it, never "you asked for shelves".
    if (!m || NEGATED(m[0]).test(tail) || readCounts(prompt)[f]?.[0] === 0) continue;
    out.push(f);
  }
  if (!out.includes("casters") && ROLLING.test(prompt) && /\brolling\b|\bmobile\b/i.test(prompt)) out.push("casters");
  return out;
}

/** Class F: the words Ezra's card approved for the new features, on the card's heads only; null says nothing. */
const CARD_SAYS = {
  "double hang": (tail: string, head: string) => (/^(?:wardrobe|closet|armoire)$/.test(head) && /\bdouble[\s-]*(?:hang(?:ing)?|rods?)\b/.test(tail) ? "double hang" : null),
  "pull-outs": (tail: string, head: string) => {
    if (!/^(?:cabinet|pantry)$/.test(head)) return null;
    const m = tail.match(/\b(pull|slide|roll)[\s-]*outs?\s+(shelves|drawers|trays)\b/);
    const said = m && ({ "pull shelves": "pull out shelves", "pull drawers": "pull-out drawers", "roll trays": "roll out trays", "slide shelves": "slide out shelves" } as Record<string, string>)[`${m[1]} ${m[2]}`];
    return said ?? null;
  },
};

/** Class F: the features a typed count can name. */
const COUNTED = ["doors", "drawers", "shelves", "rods", "casters"] as const;
/**
 * Class F (rows 569/570, I41): the count typed for each feature, anywhere in the prompt ("6 drawer dresser", "with 3
 * shelves", "two doors"), and 0 for "no rods" / "without shelves". A rod count is hangingClearance's own reading; in a
 * clothes closet "2 rails" are rods too.
 */
export function typedCounts(prompt: string): Partial<Record<TypedFeature, number>> {
  return Object.fromEntries(Object.entries(readCounts(prompt)).map(([f, [n]]) => [f, n]));
}

/** Each typed count with the words that typed it ("3 shelves", "no rods", "2 rails"). */
function readCounts(prompt: string): Partial<Record<TypedFeature, [number, string]>> {
  const head = typedHeadNoun(prompt);
  if (!head || FEATURE_NOUN.test(head)) return {};
  const lower = prompt.toLowerCase();
  const out: Partial<Record<TypedFeature, [number, string]>> = {};
  for (const f of COUNTED) {
    const w = f === "rods" && isClothesRodPrompt(lower) ? `(?:${WORDS.rods.source}|(?<!drawer\\s)rails?\\b)` : WORDS[f].source;
    // One reader (countWords.readCount) for the checker and compose.
    const r = readCount(lower, w);
    // rodsAsked reads clothes rods; "fishing rod holder for 6 rods" is a capacity, never a part count.
    const rods = f === "rods" && isClothesRodPrompt(lower) ? rodsAsked(prompt) : 0;
    if (rods) out[f] = [rods, r?.n ? r.words : `${rods} rods`];
    else if (r) out[f] = [r.n, r.words];
  }
  return out;
}

/** How many of a counted feature the build has: doors, drawer boxes, shelf levels, rods, casters. */
export function builtCount(p: YardProject, f: TypedFeature): number {
  const ps = p.panels ?? [];
  if (f === "doors") return p.kind === "opening" ? 0 : ps.filter((x) => x.type === "door").length;
  if (f === "drawers") return new Set(ps.filter((x) => x.drawerId).map((x) => x.drawerId)).size || ps.filter((x) => /\bdrawer\b/i.test(x.name) && /\bfront\b/i.test(x.name)).length;
  // The header's own count (pdf headerFeatures); a header that names none ("Bay 1 shelf", "Bottom shelf") still
  // counts its shelf lines. Shelf rails, cleats and supports are not shelves.
  if (f === "shelves") {
    return headerShelfCount(ps) || shelfLineCount(ps.filter((x) => (x.type === "shelf" || /\bshelf\b/i.test(x.name)) && !/\b(?:rails?|cleats?|supports?|pins?|brackets?|lips?)\b/i.test(x.name)));
  }
  if (f === "casters") return ps.filter(isCasterPart).length;
  return [...ps, ...(p.instances ?? [])].filter((x) => /\brods?\b/i.test((x as { name?: string }).name ?? "")).length;
}

/** The notes say the typed count back ("3 open shoe tiers"), answer the typed words ("2 rails") or the feature (featureNoted). */
function countNoted(p: YardProject, f: TypedFeature, n: number, typed: string): boolean {
  const said = new RegExp(`\\b(?:${n}|${Object.keys(NUM)[n] ?? n})\\s+(?:[a-z]+\\s+){0,2}(?:${WORDS[f].source}|tiers?|levels?)`, "i");
  return featureNoted(p, f) || (p.notes ?? []).some((x) => said.test(x) || (x.toLowerCase().includes(typed) && ANSWERS.test(x)));
}

/** Typed counts the build neither honours nor answers in a note. */
export function countsDropped(p: YardProject, prompt: string): [TypedFeature, number, number][] {
  // A Combined build (compose.ts) answers any typed shelf count with its own Shelf product, as release did: its
  // header counts that product's shelves, not the host's, so a count note there would name the wrong number.
  const shelfProduct = (p.notes ?? []).some((n) => n.startsWith("Combined:") && /\bShelf\b/.test(n));
  return Object.entries(readCounts(prompt)).flatMap(([f, [n, typed]]) => {
    if (f === "shelves" && shelfProduct) return [];
    const b = builtCount(p, f as TypedFeature);
    return b === n || countNoted(p, f as TypedFeature, n, typed) ? [] : [[f as TypedFeature, n, b] as [TypedFeature, number, number]];
  });
}

const partText = (p: YardProject) => [...p.panels.map((x) => x.name ?? ""), ...(p.instances ?? []).map((i) => (i as { name?: string }).name ?? "")].join("\n");

/** The build has the feature as a part (a door, a drawer front, a lid, a caster or wheel, a shelf). */
export function featureBuilt(p: YardProject, f: TypedFeature): boolean {
  if (f === "rods") return builtCount(p, f) > 0;
  if (f === "double hang") {
    // A double-hang pair: two rods over the same floor, one above the other.
    const rods = p.panels.filter((x) => /hanging rod/i.test(x.name));
    return rods.some((a) => rods.some((b) => b.position.y > a.position.y + 1 && b.position.x < a.position.x + a.size.width && a.position.x < b.position.x + b.size.width));
  }
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
  // An opening (a prehung door) picked for a typed feature is the wrong family: I41 flags it, a note can't answer it.
  if ((!p.panels?.length && !(p.instances ?? []).length) || p.kind === "opening") return p;
  const missing = typedFeatures(prompt).filter((f) => !featureBuilt(p, f) && !featureNoted(p, f));
  const said = (f: TypedFeature) => readCounts(prompt)[f]?.[1];
  const head = typedHeadNoun(prompt) ?? "build";
  // A count the build does not match: the note says what was asked and how many are built (class F).
  const counts = countsDropped(p, prompt).filter(([f]) => !missing.includes(f));
  if (!missing.length && !counts.length) return p;
  const tail = featureTail(prompt);
  const word = (f: TypedFeature) => (f in CARD_SAYS ? CARD_SAYS[f as keyof typeof CARD_SAYS](tail, head) : null) ?? tail.match(WORDS[f])?.[0] ?? f;
  const notes = [
    ...missing.map((f) => SAY(word(f), head, f)),
    ...counts.map(([f, , b]) => `You asked for ${said(f) ?? f}; this ${head} has ${b || "none"}.`),
  ];
  return { ...p, notes: [...(p.notes ?? []), ...notes] };
}

/** The title's head noun, sizes dropped ("Prehung Interior 36×80 door" → door). */
export function titleHeadNoun(name: string): string | null {
  const ws = name.toLowerCase().replace(/[\d½¼¾⅛⅜⅝⅞/×x"″'.-]+(?=\s|$)/g, " ").split(/[^a-z]+/).filter((w) => w.length > 1);
  return ws.length ? ws[ws.length - 1] : null;
}
