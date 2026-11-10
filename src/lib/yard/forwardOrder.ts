/**
 * Order read from the step text. A forward reference is a step that names a part,
 * as something it rests on or is fastened to, which a later step is the one that places.
 * No support graph and no placement index: the words and partsUsed are the whole record.
 */
import type { AssemblyStep } from "./types";
import { countPlural } from "./shopPlural";

const PREP = /^(?:confirm|cut|read|lay out|do not|print|count|mark|check|level|seal|splice|prep|label)\b/i;

/** One-word names that are edges and places, not a part a step fastens to. */
const STOP = new Set([
  "top", "back", "side", "end", "edge", "face", "floor", "wall", "base", "piece", "part",
  "joint", "screw", "hole", "mark", "list", "step", "box", "frame", "door", "panel",
  "board", "stock", "cut", "glue", "inch", "foot", "feet",
]);

export type ForwardRef = { step: number; target: string };

function bare(name: string): string {
  return name.replace(/^[A-Za-z]{1,2}\s+/, "").replace(/\s+\d+$/, "").trim().toLowerCase();
}

function samePart(used: string, name: string): boolean {
  const a = used.toLowerCase().trim();
  const b = name.toLowerCase().trim();
  return a === b || a.replace(/^[a-z]{1,2}\s+/, "") === b || b.replace(/^[a-z]{1,2}\s+/, "") === a;
}

const SIDE = /^(?:left|right|front|back|center|centre)$/;

/** "Left stringer" and "Center stringer" are both stringers. "Back post" is not every post. */
function phrasesFor(name: string, names: string[]): string[] {
  const b = bare(name);
  if (b.length < 3 || STOP.has(b)) return [];
  const words = b.split(/\s+/);
  const phrases = [b];
  if (words.length > 1 && SIDE.test(words[0])) {
    const family = words.slice(1).join(" ");
    const last = words[words.length - 1];
    const fellows = names.map(bare).filter((other) => other === family || other.endsWith(` ${last}`));
    const onlySides = fellows.every((other) => other === family || (SIDE.test(other.split(/\s+/)[0]) && other.slice(other.indexOf(" ") + 1) === family));
    if (onlySides && !STOP.has(family)) phrases.push(family);
  }
  return phrases;
}

/** Forms a reader would accept as this part: the bare name and its plural. */
function formsOf(name: string, names: string[]): string[] {
  const out = new Set<string>();
  for (const phrase of phrasesFor(name, names)) {
    out.add(phrase);
    const plural = countPlural(phrase, 2).toLowerCase();
    if (plural !== phrase) out.add(plural);
  }
  return [...out];
}

function placedBy(step: AssemblyStep, names: string[]): string[] {
  if (PREP.test(step.title)) return [];
  const used = (step.partsUsed ?? []).filter((u) => u !== "*" && u !== "all");
  if (!used.length) return [];
  return names.filter((name) => used.some((u) => samePart(u, name)));
}

function firstPlacement(steps: AssemblyStep[], names: string[]): Map<string, number> {
  const at = new Map<string, number>();
  steps.forEach((step, i) => {
    for (const name of placedBy(step, names)) {
      if (!at.has(name)) at.set(name, i);
    }
  });
  return at;
}

/**
 * Part names in this step's text that the step rests on or fastens to.
 * A longer phrase ("body sides") is not the part "body".
 */
export function textTargets(step: AssemblyStep, names: string[]): string[] {
  const text = `${step.title}. ${step.description}`.toLowerCase();
  const placing = new Set(placedBy(step, names));
  const hits = new Set<string>();
  const anchor = /\b(?:rests on|fastened to|fasten(?:ed|ing|s)?\b[^.]{0,90}?\bto|glue(?:d|s)?\b[^.]{0,70}?\bto|set(?:s|ting)?\b[^.]{0,70}?\bon|screw(?:ed|s|ing)?\b[^.]{0,90}?\b(?:to|through|into)|attach(?:ed|es|ing)?\b[^.]{0,90}?\bto|hang(?:s|ing)?\b[^.]{0,60}?\bon)\b/gi
  for (const match of text.matchAll(anchor)) {
    const clause = text.slice((match.index ?? 0) + match[0].length).split(/[.]/)[0] ?? "";
    for (const name of names) {
      if (placing.has(name) || hits.has(name)) continue;
      for (const form of formsOf(name, names)) {
        const re = new RegExp(`(?:^|\\b(?:the|both|each|its|a|\\d+|[a-z])\\s+|\\b)${form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        const found = re.exec(clause);
        if (!found) continue;
        const after = clause.slice(found.index + found[0].length);
        if (/^\s+[a-z]/.test(after) && !/^\s+(?:and|with|so|that|which|before|after|once|using)\b/.test(after)) continue;
        const numbered = after.match(/^\s+(\d+)\b/);
        const own = name.match(/(\d+)\s*$/)?.[1];
        if (numbered && own && numbered[1] !== own) continue;
        if (numbered && !own) continue;
        hits.add(name);
        break;
      }
    }
  }
  return [...hits];
}

/** Steps that name a part a later step places. */
export function forwardRefs(steps: AssemblyStep[], names: string[]): ForwardRef[] {
  const at = firstPlacement(steps, names);
  const out: ForwardRef[] = [];
  steps.forEach((step, i) => {
    for (const target of textTargets(step, names)) {
      const placed = at.get(target);
      if (placed != null && placed > i) out.push({ step: i, target });
    }
  });
  return out;
}

/**
 * Move a step to just after the latest part its text names, and repeat.
 * Keep the written order unless the result has no forward reference and fewer than it started with.
 */
export function settleForward(steps: AssemblyStep[], names: string[]): { steps: AssemblyStep[]; unresolved: boolean } {
  const start = forwardRefs(steps, names);
  if (!start.length) return { steps, unresolved: false };
  const tagged = steps.map((s, id) => ({ ...s, id }));
  const seen = new Set<string>();
  let cleared = false;
  for (let guard = 0; guard < tagged.length * 3; guard++) {
    const refs = forwardRefs(tagged, names);
    if (!refs.length) {
      cleared = true;
      break;
    }
    const at = firstPlacement(tagged, names);
    const i = refs[0].step;
    const late = Math.max(
      ...textTargets(tagged[i], names).map((name) => at.get(name) ?? -1).filter((j) => j > i),
    );
    const sig = `${tagged.map((s) => s.id).join(".")}:${i}`;
    if (late < 0 || seen.has(sig)) break;
    seen.add(sig);
    const [step] = tagged.splice(i, 1);
    tagged.splice(late > i ? late : late + 1, 0, step);
  }
  if (!cleared) return { steps, unresolved: true };
  const next = tagged.map(({ id: _id, ...s }) => s);
  const before = new Set(start.map((r) => `${steps[r.step]?.title}|${r.target}`));
  const after = forwardRefs(next, names);
  if (after.length || after.some((r) => !before.has(`${next[r.step]?.title}|${r.target}`))) return { steps, unresolved: true };
  return { steps: next, unresolved: false };
}
