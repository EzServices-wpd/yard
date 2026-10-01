/**
 * How Ideas grows.
 * Typing a prompt does not file a card. A printed plan is a candidate only.
 * Yard then asks: was this the thing they meant, is it sound, and is it new?
 * Same idea at another size, or the same idea in other words, stays off the list.
 */

import type { IdeaGroup } from "./ideas";

export const IDEA_LIBRARY_SECTIONS = [
  "Fitted to a hole",
  "Sit and work",
  "Hang on the wall",
  "Store",
  "Weekend",
] as const;

export type IdeaLibrarySection = (typeof IDEA_LIBRARY_SECTIONS)[number];

export type IdeaCandidate = {
  prompt: string;
  name: string;
  size: string;
  kind: string;
  stock: string;
  pieces: number;
  feasibility: "ok" | "warnings" | "critical";
  summary: string;
  honestyOk: boolean;
  wire: boolean;
  /** Cut list, or step titles when the plan is whole stock. */
  parts: string;
  warnings: string;
  /** install · family · affordances, as built. */
  place: string;
  steps: number;
};

export type LearnedIdea = {
  id: string;
  group: IdeaGroup;
  section: IdeaLibrarySection;
  label: string;
  size: string;
  prompt: string;
  blurb: string;
  stock?: string;
  addedAt: string;
};

export type KnownIdea = { prompt: string; label: string };

const LEARNED_KEY = "yard_ideas_learned_v1";
const JUDGED_KEY = "yard_ideas_judged_v1";
const MAX_LEARNED = 48;
const MAX_JUDGED = 200;

export const IDEAS_CHANGED = "yard-ideas-changed";

const STOP =
  /\b(inch|inches|in|ft|foot|feet|mm|cm|wide|width|tall|high|height|deep|depth|long|length|by|x|and|with|a|an|the|from|of|for|to|on|into|at|my|me)\b/g;

export function normalizeIdeaPrompt(s: string): string {
  return s
    .toLowerCase()
    .replace(/[″”"']/g, " ")
    .replace(/×/g, "x")
    .replace(/(\d)\s*x\s*(\d)/g, "$1 x $2")
    .replace(/[^a-z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Idea identity with sizes and filler stripped. "48 inch desk" and "60 inch desk" share a stem when the rest matches. */
export function ideaStem(prompt: string): string {
  return normalizeIdeaPrompt(prompt).replace(/\d+(?:\.\d+)?/g, " ").replace(STOP, " ").replace(/\s+/g, " ").trim();
}

function normTok(t: string): string {
  if (t.endsWith("ves") && t.length > 4) return t.slice(0, -3) + "f";
  if (/(?:s|x|z|ch|sh)es$/.test(t) && t.length > 4) return t.slice(0, -2);
  if (t.endsWith("ies") && t.length > 5) return t.slice(0, -3) + "y";
  if (t.endsWith("s") && !t.endsWith("ss") && t.length > 3) return t.slice(0, -1);
  return t;
}

/** Content words of an idea, order-free, light plurals folded. */
export function ideaTokens(prompt: string): string[] {
  return [...new Set(ideaStem(prompt).split(" ").filter((t) => t.length >= 3).map(normTok))];
}

function foldText(s: string): string {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0)
    .map(normTok)
    .join(" ");
}

/**
 * Same words in a different order, or one leftover word, is still one idea.
 * "coat rack" and "coat rack with bench" stay apart — the extra object is the difference.
 */
export function stemsTooClose(a: string, b: string): boolean {
  const left = ideaTokens(a);
  const right = ideaTokens(b);
  if (left.length < 2 || right.length < 2) return false;
  const B = new Set(right);
  let inter = 0;
  for (const t of left) if (B.has(t)) inter++;
  const union = new Set([...left, ...right]).size;
  if (!union) return false;
  return inter / union >= 0.75 && union - inter <= 1;
}

export function knownMatch(c: Pick<IdeaCandidate, "prompt" | "name">, known: KnownIdea[]): KnownIdea | null {
  const norm = normalizeIdeaPrompt(c.prompt);
  const stem = ideaStem(c.prompt);
  const name = softLabel(c.name);
  for (const k of known) {
    if (normalizeIdeaPrompt(k.prompt) === norm) return k;
    if (stem.length >= 3 && ideaStem(k.prompt) === stem) return k;
    if (stemsTooClose(c.prompt, k.prompt)) return k;
    const label = softLabel(k.label);
    if (name.length >= 3 && label.length >= 3 && name === label) return k;
  }
  return null;
}

export function softLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function ideaSignature(c: IdeaCandidate): string {
  return [
    normalizeIdeaPrompt(c.prompt),
    c.kind,
    c.size,
    String(c.pieces),
    c.feasibility,
    c.honestyOk ? "1" : "0",
    normalizeIdeaPrompt(c.stock),
    c.wire ? "w" : "s",
    String(c.steps),
    normalizeIdeaPrompt(c.parts).slice(0, 96),
  ].join("|");
}

/**
 * Cheap gate before a librarian call.
 * `call: false` means do not file and do not spend a model call.
 */
export function localLibraryDecision(
  c: IdeaCandidate,
  known: KnownIdea[],
): { call: boolean; reason: string; match?: string } {
  const prompt = c.prompt.trim();
  if (prompt.length < 8) return { call: false, reason: "too short" };
  if (c.wire) return { call: false, reason: "no real stock" };
  if (c.pieces < 1) return { call: false, reason: "empty" };
  if (c.feasibility === "critical") return { call: false, reason: "not good" };
  if (!c.honestyOk) return { call: false, reason: "not what was asked" };
  if (c.steps < 1 && c.pieces < 3) return { call: false, reason: "not good" };

  const hit = knownMatch(c, known);
  if (hit) return { call: false, reason: "already built", match: hit.label };
  return { call: true, reason: "candidate" };
}

export type CardDraft = {
  label: string;
  size: string;
  blurb: string;
  section: string;
  group: string;
  stock: string | null;
};

const GENERIC_LABEL = /^(idea|project|build|untitled|custom|thing|plan|new idea)$/i;

function clip(s: string, n: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, n);
}

function hashStem(stem: string): string {
  let h = 2166136261;
  for (let i = 0; i < stem.length; i++) {
    h ^= stem.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Last check after the librarian says yes. Rejects duplicates and cards that don't belong on the list. */
export function acceptIdeaCard(
  raw: CardDraft,
  candidate: IdeaCandidate,
  known: KnownIdea[],
): LearnedIdea | null {
  const label = clip(raw.label ?? "", 48);
  const blurb = clip(raw.blurb ?? "", 180);
  if (label.length < 2 || blurb.length < 8) return null;
  if (GENERIC_LABEL.test(label)) return null;
  if (softLabel(label).length < 3) return null;

  const group: IdeaGroup = raw.group === "weekend" ? "weekend" : raw.group === "house" ? "house" : candidate.kind === "figure" || /popsicle|straw|skewer|pvc|jumbo/i.test(candidate.prompt) ? "weekend" : "house";
  let section = IDEA_LIBRARY_SECTIONS.find((s) => s === raw.section);
  if (group === "weekend") section = "Weekend";
  if (group === "house" && section === "Weekend") section = "Sit and work";
  if (!section) section = group === "weekend" ? "Weekend" : "Sit and work";

  const stem = ideaStem(candidate.prompt);
  const labelKey = softLabel(label);
  for (const k of known) {
    if (stem.length >= 3 && ideaStem(k.prompt) === stem) return null;
    if (softLabel(k.label) === labelKey) return null;
  }

  let size = clip(raw.size || candidate.size, 48);
  if (!size) size = candidate.size || "as built";

  let stock: string | undefined;
  const spoken = clip(raw.stock ?? "", 42);
  if (group === "weekend" && spoken && !/plywood|wire|placeholder/i.test(spoken)) {
    stock = /^from\b/i.test(spoken) ? spoken : `from ${spoken}`;
  }

  return {
    id: `kept-${hashStem(stem || normalizeIdeaPrompt(candidate.prompt))}`,
    group,
    section,
    label,
    size,
    prompt: clip(candidate.prompt, 400),
    blurb,
    stock,
    addedAt: new Date().toISOString(),
  };
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function listLearnedIdeas(): LearnedIdea[] {
  if (typeof window === "undefined") return [];
  const rows = safeParse<LearnedIdea[]>(localStorage.getItem(LEARNED_KEY));
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => r && typeof r.id === "string" && typeof r.prompt === "string" && typeof r.label === "string");
}

export function saveLearnedIdea(idea: LearnedIdea) {
  if (typeof window === "undefined") return;
  try {
    const rows = listLearnedIdeas().filter((r) => r.id !== idea.id && ideaStem(r.prompt) !== ideaStem(idea.prompt));
    rows.unshift(idea);
    localStorage.setItem(LEARNED_KEY, JSON.stringify(rows.slice(0, MAX_LEARNED)));
    window.dispatchEvent(new Event(IDEAS_CHANGED));
  } catch {
    /* quota */
  }
}

type JudgedRow = { added: boolean; known?: string };
type Judged = Record<string, JudgedRow>;

export function readJudgement(sig: string): JudgedRow | null {
  if (typeof window === "undefined") return null;
  const map = safeParse<Judged>(localStorage.getItem(JUDGED_KEY));
  if (!map || typeof map !== "object") return null;
  const row = map[sig];
  if (!row || typeof row.added !== "boolean") return null;
  return row;
}

export function rememberJudgement(sig: string, added: boolean, known?: string) {
  if (typeof window === "undefined") return;
  try {
    const map = safeParse<Judged>(localStorage.getItem(JUDGED_KEY)) ?? {};
    map[sig] = known ? { added, known } : { added };
    const keys = Object.keys(map);
    if (keys.length > MAX_JUDGED) {
      for (const k of keys.slice(0, keys.length - MAX_JUDGED)) delete map[k];
    }
    localStorage.setItem(JUDGED_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export type SearchableIdea = {
  label: string;
  size: string;
  blurb: string;
  section: string;
  stock?: string;
  prompt: string;
};

function hasWord(folded: string, token: string): boolean {
  for (const w of folded.split(" ")) {
    if (!w) continue;
    if (w === token) return true;
    // "book" finds "bookshelf". Never the reverse — a stray "s" must not hit "shelf".
    if (token.length >= 4 && w.startsWith(token)) return true;
  }
  return false;
}

/** Rank for the Ideas search. -1 means it does not match. Every word must hit. */
export function ideaSearchScore(idea: SearchableIdea, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const tokens = q
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => normTok(t.replace(/[^a-z0-9]/g, "")))
    .filter((t) => t.length > 0);
  if (!tokens.length) return 0;
  const label = foldText(idea.label);
  const hay = foldText([idea.label, idea.size, idea.blurb, idea.section, idea.stock ?? "", idea.prompt].join(" "));
  if (!tokens.every((t) => hasWord(hay, t))) return -1;
  const folded = tokens.join(" ");
  let score = 0;
  if (label === folded) score += 100;
  else if (label.startsWith(folded)) score += 70;
  else if (tokens.every((t) => hasWord(label, t))) score += 46;
  else if (hasWord(label, folded)) score += 40;
  const section = foldText(idea.section);
  const stock = foldText(idea.stock ?? "");
  for (const t of tokens) {
    if (hasWord(label, t)) score += 10;
    else if (hasWord(section, t) || hasWord(stock, t)) score += 4;
    else score += 1;
  }
  return score;
}
