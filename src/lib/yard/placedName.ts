/**
 * A fastening clause moves onto a later step only when every screw that clause describes
 * is counted on that later step.
 *
 * Two clauses qualify. The knee-divider line "the desktop screws down into the divider tops"
 * (or "the counter…") names only the top-into-divider screws, and those are inside the
 * desktop or counter step's Drive N. "Screw through the bottom and the vanity counter into
 * each divider." names one real joint, counter into divider, counted on the counter step.
 *
 * A mixed through-sentence also tells you to drive screws that this step still counts
 * (top, bottom, seat, or shelf into the dividers, plus the back). Moving the whole sentence
 * would strip that instruction off the Drive N that still counts those screws. Splitting it
 * would be new wording, so the sentence stays where it was written.
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

/**
 * Move a fastening sentence that names a part still ahead onto the step that places it.
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
      const clauses = sentence.split(/;\s+/);
      if (clauses.length > 1) {
        const kept: string[] = [];
        for (const clause of clauses) {
          const late = ahead(clause, i);
          const fastens = /\b(?:screw|screws|fasten)\b/i.test(clause);
          if (!late.length || !fastens || COUNTED.test(clause)) {
            kept.push(clause);
            continue;
          }
          const target = Math.max(...late.map((name) => at.get(name)!));
          if (named(clause).some((name) => (at.get(name) ?? i) > target)) {
            kept.push(clause);
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
      if (!THROUGH.test(sentence.trim()) || COUNTED.test(sentence) || !COUNTER_DIVIDERS.test(sentence.trim())) {
        stays[i].push(sentence);
        continue;
      }
      const late = ahead(sentence, i);
      if (!late.length) {
        stays[i].push(sentence);
        continue;
      }
      const target = Math.max(...late.map((name) => at.get(name)!));
      if (named(sentence).some((name) => (at.get(name) ?? i) > target)) {
        stays[i].push(sentence);
        continue;
      }
      moves.push({ to: target, text: sentence.trim() });
      changed = true;
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
