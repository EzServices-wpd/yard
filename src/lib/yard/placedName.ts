/**
 * A step may name a part as already in place only when an earlier step, or this step, attached it.
 *
 * Fastening text is written from the joint ("through the top, bottom, and back") before the thin
 * back is moved to after the dividers it screws into. A clause moves onto a later step only when
 * every screw that clause describes is counted on that later step: the knee line "the desktop
 * screws down into the divider tops", and "Screw through the bottom and the vanity counter into
 * each divider." Moving a mixed through-sentence would strip the screws this step still counts.
 * The names in that sentence that a later step attaches are dropped from the list instead. The
 * list keeps the words it already had. The later step already says which edges it fastens.
 */
import type { AssemblyStep, YardProject } from "./types";

const FROZEN =
  /^(?:confirm|cut|read|lay out|do not|print|count|mark|level|seal|splice|prep|label|glue up|join sheet|drill|sand|finish|paint|before|shim)\b/i;
const STOP = new Set([
  "side", "edge", "face", "wall", "base", "part", "door", "rail", "post", "leg", "lid", "box", "step",
  "end", "foot", "feet", "arm", "board", "panel", "frame", "apron", "riser", "tread",
]);
const SIDE = /^(?:left|right|front|back|center|centre)\s+/i;
const THROUGH = /^(?:Screw through|Set the joints the stock uses, through|Tape or glue through)\b/i;
const COUNTED = /(?:Drive|drives) \d+ × #8 |with \d+ × #8 |counted in another step|brings the build to \d+/;
/** Counter into each divider is the only joint this sentence describes, and that joint is counted on the counter step. */
const COUNTER_DIVIDERS = /^Screw through the bottom and the vanity counter into each divider\.$/;

function family(name: string): string {
  return name.replace(/\s+\d+$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
}

function phrases(name: string): string[] {
  const fam = family(name);
  const out = new Set<string>();
  const keep = (phrase: string) => {
    const words = phrase.split(/\s+/).filter(Boolean);
    if (!words.length || (words.length === 1 && STOP.has(words[0]))) return;
    out.add(words.join(" "));
  };
  keep(fam);
  const bare = fam.replace(SIDE, "");
  if (bare !== fam) keep(bare);
  return [...out];
}

const escRe = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function phraseRe(phrase: string): RegExp {
  const words = phrase.split(/\s+/);
  const body = words
    .map((w, i) => (i === words.length - 1 ? (w === "shelf" ? "shel(?:f|ves)" : `${escRe(w)}s?`) : escRe(w)))
    .join("\\s+");
  return new RegExp(`\\b${body}\\b`, "i");
}

function mentions(sentence: string, phrase: string): boolean {
  const re = new RegExp(phraseRe(phrase).source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence))) {
    const after = sentence.slice(m.index + m[0].length);
    if (/^\s+(?:edges?|of|face|faces|ends?)\b/i.test(after)) continue;
    const prior = sentence.slice(0, m.index);
    if (/\bdrawer\s+$/i.test(prior)) continue;
    return true;
  }
  return false;
}

function namesPart(sentence: string, name: string): boolean {
  return phrases(name).some((p) => mentions(sentence, p));
}

function attaches(step: AssemblyStep, name: string): boolean {
  if (FROZEN.test(step.title)) return false;
  const hit = (text: string) => namesPart(text, name);
  const join = step.description?.match(/One join: attach ([^.]+?) to /i);
  if (join && hit(join[1])) return true;
  const lay = step.description?.match(/^Lay the[^.]*/i);
  if (lay && hit(lay[0])) return true;
  const used = (step.partsUsed ?? []).some((u) => u.toLowerCase() === name.toLowerCase());
  if (!used) return false;
  const obj = step.title.split(/\s+to\b/i)[0];
  if (hit(obj)) return true;
  const last = family(name).split(/\s+/).pop() ?? "";
  const word = last === "shelf" ? "shel(?:f|ves)" : `${escRe(last)}s?`;
  return new RegExp(`\\b${word}\\b`, "i").test(obj);
}

function placedAt(steps: AssemblyStep[], names: string[]): Map<string, number> {
  const at = new Map<string, number>();
  for (const name of names) {
    const i = steps.findIndex((s) => attaches(s, name));
    if (i >= 0) at.set(name, i);
  }
  return at;
}

function finish(kept: string[], original: string): string {
  const text = kept.join("; ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (/[.!?]$/.test(original.trim()) && !/[.!?]$/.test(text)) return `${text}.`;
  return text;
}

const THROUGH_HEAD = /^(Screw through|Tape or glue through|Set the joints the stock uses, through)\s+/i;

function listItems(list: string): string[] {
  return list
    .replace(/,\s+and\s+/gi, ", ")
    .replace(/\s+and\s+/gi, ", ")
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinItems(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** The "through …" list, with the "into …" target set aside. The target is the part this step is fastening. */
function throughParts(sentence: string): { head: string; items: string[]; into: string } | null {
  const trimmed = sentence.trim();
  const head = trimmed.match(THROUGH_HEAD);
  if (!head) return null;
  let body = trimmed.slice(head[0].length).replace(/\.$/, "");
  let into = "";
  const intoAt = body.search(/\s+into\s+/i);
  if (intoAt >= 0) {
    into = body.slice(intoAt);
    body = body.slice(0, intoAt);
  }
  return { head: head[1], items: listItems(body), into };
}

/**
 * True when every part this list item names is attached by a later step.
 * An item that also names a part already attached stays whole: splitting "shelf or top" would be new wording.
 */
function itemEntirelyLater(
  item: string,
  i: number,
  named: (text: string) => string[],
  ahead: (text: string, i: number) => string[],
): boolean {
  const who = named(item);
  if (!who.length) return false;
  const late = ahead(item, i);
  return late.length > 0 && late.length === who.length;
}

/**
 * Drop through-list items whose parts are all attached later.
 * Returns the original sentence when the list is already in order, or "" when nothing in the list is in place yet.
 */
function dropUnplacedThrough(
  sentence: string,
  i: number,
  named: (text: string) => string[],
  ahead: (text: string, i: number) => string[],
): string {
  const parts = throughParts(sentence);
  if (!parts) return sentence;
  const later = (item: string) => itemEntirelyLater(item, i, named, ahead);
  if (!parts.items.some(later)) return sentence;
  const keep = parts.items.filter((item) => !later(item));
  if (!keep.length) return "";
  let first = keep[0];
  if (/^the\s+/i.test(parts.items[0]) && !/^the\s+/i.test(first)) first = `the ${first}`;
  const period = /\.$/.test(sentence.trim());
  const text = `${parts.head} ${joinItems([first, ...keep.slice(1)])}${parts.into}`;
  return period ? `${text}.` : text;
}

/** "The back is already on" names a part a later step still has to attach. The sentence is that claim. */
function alreadyOnLater(
  sentence: string,
  i: number,
  named: (text: string) => string[],
  ahead: (text: string, i: number) => string[],
): boolean {
  if (!/\balready on\b/i.test(sentence) || COUNTED.test(sentence)) return false;
  const claim = sentence.split(/\balready on\b/i)[0] ?? "";
  const late = new Set(ahead(sentence, i));
  return named(claim).some((part) => late.has(part));
}

/**
 * "to the back edges of A, B, and C" names A, B, and C as already in place.
 * Drop a name only when every part that item names is attached later and some other name stays.
 * An emptied list has no approved wording, so the sentence is left for review.
 */
function dropUnplacedEdges(
  sentence: string,
  i: number,
  named: (text: string) => string[],
  ahead: (text: string, i: number) => string[],
): string {
  const m = sentence.match(/back edges of ([^.]+?) with /i);
  if (!m || m.index == null) return sentence;
  const items = listItems(m[1]);
  const later = (item: string) => itemEntirelyLater(item, i, named, ahead);
  const drop = items.filter(later);
  if (!drop.length || drop.length === items.length) return sentence;
  let list = m[1];
  for (const item of drop) list = withoutItem(list, item);
  if (!list.trim() || list === m[1]) return sentence;
  return sentence.slice(0, m.index) + `back edges of ${list} with ` + sentence.slice(m.index + m[0].length);
}

/** Take one name out of a comma/and list and leave the separators the sentence already used. */
function withoutItem(list: string, item: string): string {
  const esc = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`,\\s*${esc}(?=,|\\s+and\\b|$)`, "i"),
    new RegExp(`^${esc}\\s*,\\s*`, "i"),
    new RegExp(`^${esc}\\s+and\\s+`, "i"),
    new RegExp(`\\s+and\\s+${esc}$`, "i"),
  ];
  for (const re of patterns) {
    if (!re.test(list)) continue;
    return list
      .replace(re, "")
      .replace(/,\s+and\b/i, " and")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return list;
}

function keepThrough(
  text: string,
  i: number,
  named: (text: string) => string[],
  ahead: (text: string, i: number) => string[],
): string {
  if (!THROUGH.test(text.trim()) || COUNTED.test(text)) return text;
  return dropUnplacedThrough(text, i, named, ahead);
}

/**
 * Move a fastening sentence that names a part still ahead onto the step that places it.
 * A through-list that mixes parts already attached with a part attached later keeps the
 * sentence on this step and drops only the later names.
 * Returns the same array when every fastening sentence already waits its turn.
 */
export function fastenAfterPlacement(project: YardProject, steps: AssemblyStep[]): AssemblyStep[] {
  if (!project.panels.length || steps.length < 2) return steps;
  const names = [...new Set(project.panels.filter((p) => !p.drawerId).map((p) => p.name))];
  const at = placedAt(steps, names);
  const named = (sentence: string) => names.filter((name) => namesPart(sentence, name));
  const ahead = (sentence: string, i: number) => named(sentence).filter((name) => (at.get(name) ?? -1) > i);

  const stays: string[][] = steps.map(() => []);
  const moves: { to: number; text: string }[] = [];
  let changed = false;

  steps.forEach((step, i) => {
    if (FROZEN.test(step.title)) {
      stays[i] = [step.description ?? ""];
      return;
    }
    for (const sentence of (step.description ?? "").split(/(?<=[.!?])\s+/).filter(Boolean)) {
      if (alreadyOnLater(sentence, i, named, ahead)) {
        changed = true;
        continue;
      }
      const clauses = sentence.split(/;\s+/);
      if (clauses.length > 1) {
        const kept: string[] = [];
        for (const clause of clauses) {
          const late = ahead(clause, i);
          const fastens = /\b(?:screw|screws|fasten)\b/i.test(clause);
          if (!late.length || !fastens || COUNTED.test(clause)) {
            const next = dropUnplacedEdges(keepThrough(clause, i, named, ahead), i, named, ahead);
            if (next !== clause) changed = true;
            if (next) kept.push(next);
            continue;
          }
          const target = Math.max(...late.map((name) => at.get(name)!));
          if (named(clause).some((name) => (at.get(name) ?? i) > target)) {
            const next = dropUnplacedEdges(keepThrough(clause, i, named, ahead), i, named, ahead);
            if (next !== clause) changed = true;
            if (next) kept.push(next);
            continue;
          }
          let text = clause.trim();
          if (!/[.!?]$/.test(text)) text += ".";
          text = text.replace(/^[a-z]/, (c) => c.toUpperCase());
          moves.push({ to: target, text });
          changed = true;
        }
        const rest = finish(kept, sentence);
        if (rest) stays[i].push(rest);
        continue;
      }
      if (THROUGH.test(sentence.trim()) && !COUNTED.test(sentence) && COUNTER_DIVIDERS.test(sentence.trim())) {
        const late = ahead(sentence, i);
        if (late.length) {
          const target = Math.max(...late.map((name) => at.get(name)!));
          if (!named(sentence).some((name) => (at.get(name) ?? i) > target)) {
            moves.push({ to: target, text: sentence.trim() });
            changed = true;
            continue;
          }
        }
      }
      const next = dropUnplacedEdges(keepThrough(sentence, i, named, ahead), i, named, ahead);
      if (next !== sentence) changed = true;
      if (next) stays[i].push(next);
    }
  });

  if (!changed) return steps;
  const out = steps.map((step, i) => ({ ...step, description: stays[i].join(" ").replace(/\s+/g, " ").trim() }));
  for (const mv of moves) {
    const dest = out[mv.to];
    if ((dest.description ?? "").includes(mv.text)) continue;
    const desc = (dest.description ?? "").trim();
    out[mv.to] = { ...dest, description: desc ? `${desc} ${mv.text}` : mv.text };
  }
  return out;
}

/**
 * A fastening step names a part as already in place, and a later step is the one that attaches it.
 * Confirm and cut steps describe the whole build before anything is attached; they are not fastening steps.
 * The same read as fastenAfterPlacement: a through-list item counts only when every part it names is later.
 */
export function unplacedFastening(project: YardProject, steps: AssemblyStep[]): string[] {
  if (!project.panels.length || steps.length < 2) return [];
  const names = [...new Set(project.panels.filter((p) => !p.drawerId).map((p) => p.name))];
  const at = placedAt(steps, names);
  const named = (sentence: string) => names.filter((name) => namesPart(sentence, name));
  const ahead = (sentence: string, i: number) => named(sentence).filter((name) => (at.get(name) ?? -1) > i);
  const out: string[] = [];
  steps.forEach((step, i) => {
    if (/^(?:confirm|cut|read|lay out|do not|print|count|mark)\b/i.test(step.title)) return;
    for (const sentence of (step.description ?? "").split(/(?<=[.!?])\s+/).filter(Boolean)) {
      if (/\balready on\b/i.test(sentence)) {
        const claim = sentence.split(/\balready on\b/i)[0] ?? "";
        const late = new Set(ahead(sentence, i));
        for (const part of named(claim)) if (late.has(part)) out.push(`${step.title} says ${part} is already on before it is attached`);
      }
      const parts = throughParts(sentence);
      if (parts && !COUNTED.test(sentence)) {
        for (const item of parts.items) {
          if (!itemEntirelyLater(item, i, named, ahead)) continue;
          for (const part of ahead(item, i)) out.push(`${step.title} fastens through ${part} before it is attached`);
        }
      }
      const edges = sentence.match(/back edges of ([^.]+?) with /i);
      if (edges) {
        for (const item of listItems(edges[1])) {
          if (!itemEntirelyLater(item, i, named, ahead)) continue;
          for (const part of ahead(item, i)) out.push(`${step.title} names ${part} on a back edge before it is attached`);
        }
      }
    }
  });
  return out;
}
