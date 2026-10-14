import { detectMaterial, hasExplicitStock, promptNamingStock } from "./promptHelpers";
import type { YardProject } from "./types";

/**
 * Spec 003: the free Refine box. Merges a short phrase ("make it 6 inches taller", "add a drawer",
 * "use plywood", "two shelves") into the current prompt so the existing parser rebuilds it. No AI.
 */
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const NUM = `(\\d+(?:\\.\\d+)?|${WORDS.join("|")}|a|an)`;
const num = (s: string) => (/^an?$/i.test(s) ? 1 : WORDS.includes(s.toLowerCase()) ? WORDS.indexOf(s.toLowerCase()) : Number(s));
const AXIS: Record<string, ["width" | "height" | "depth", 1 | -1]> = {
  taller: ["height", 1], higher: ["height", 1], shorter: ["height", -1], lower: ["height", -1],
  wider: ["width", 1], longer: ["width", 1], narrower: ["width", -1],
  deeper: ["depth", 1], shallower: ["depth", -1],
};
const SET_AXIS: Record<string, "width" | "height" | "depth"> = { wide: "width", long: "width", tall: "height", high: "height", deep: "depth" };
const COUNTS: Record<string, RegExp> = { shelves: /shel(?:f|ves)/, drawers: /drawers?/, doors: /doors?/, cubbies: /cubb(?:y|ies)/, hooks: /hooks?/ };

const fmt = (n: number) => String(Math.round(n * 100) / 100);
const tidy = (s: string) => s.replace(/\s+/g, " ").replace(/\s+([,.;])/g, "$1").replace(/(?:,\s*)+$/, "").trim();

function withSizes(prompt: string, o: { width: number; height: number; depth: number }) {
  const t = prompt
    .replace(/\b\d+(?:\.\d+)?\s*(?:inches|inch|in\b|")?\s*(?:wide|tall|high|deep|long)\b,?/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s*(?:inches|inch|in\b|")?\s*by\s*\d+(?:\.\d+)?(?:\s*by\s*\d+(?:\.\d+)?)?\s*(?:inches|inch|in\b|")?/gi, " ");
  return tidy(`${tidy(t)}, ${fmt(o.width)} wide ${fmt(o.height)} tall ${fmt(o.depth)} deep`);
}

export function refinePrompt(prompt: string, phrase: string, project: Pick<YardProject, "overall" | "panels">): { prompt: string; materialId?: string } {
  const p = phrase.trim().toLowerCase().replace(/[.!]+$/, "");
  if (!p) return { prompt };
  const o = { ...project.overall };

  // Size by: "make it 6 inches taller", "2 in lower".
  const by = p.match(new RegExp(`${NUM}\\s*(?:inches|inch|in|")?\\s*(taller|higher|shorter|lower|wider|longer|narrower|deeper|shallower)\\b`));
  if (by) {
    const [axis, sign] = AXIS[by[2]];
    o[axis] = Math.max(1, o[axis] + sign * num(by[1]));
    return { prompt: withSizes(prompt, o) };
  }
  // Size to: "make it 40 tall", "36 inches wide".
  const to = p.match(/(\d+(?:\.\d+)?)\s*(?:inches|inch|in|")?\s*(wide|long|tall|high|deep)\b/);
  if (to && !/\b(shel|drawer|door|cubb|hook)/.test(p)) {
    o[SET_AXIS[to[2]]] = Number(to[1]);
    return { prompt: withSizes(prompt, o) };
  }
  // Counts: "add a drawer", "two shelves", "one less shelf", "remove a door".
  for (const [noun, re] of Object.entries(COUNTS)) {
    const m = p.match(new RegExp(`^(add|remove|drop)?\\s*(?:${NUM}\\s+)?(?:more\\s+|less\\s+|fewer\\s+)?(?:${re.source})\\b`));
    if (!m) continue;
    const n = m[2] ? num(m[2]) : 1;
    const stated = prompt.match(new RegExp(`${NUM}\\s+(?:${re.source})\\b`, "i"));
    const have = stated ? num(stated[1]) : project.panels.filter((x) => (noun === "drawers" ? /drawer.*front|front.*drawer/i : re).test(x.name.toLowerCase())).length;
    const less = m[1] === "remove" || m[1] === "drop" || /\b(less|fewer)\b/.test(p);
    const next = Math.max(0, m[1] === "add" || /\bmore\b/.test(p) ? have + n : less ? have - n : n);
    const base = tidy(prompt.replace(new RegExp(`(?:,?\\s*with\\s+)?${NUM}\\s+(?:${re.source})\\b`, "gi"), " "));
    return { prompt: tidy(`${base} with ${next} ${noun}`) };
  }
  // Stock: "use plywood", "make it from cedar", "in pine".
  const stock = p.match(/^(?:use|make it (?:from|out of|in)|from|out of|in|switch to)\s+(.+)$/);
  if (stock && hasExplicitStock(`from ${stock[1]}`)) {
    return { prompt: promptNamingStock(prompt, stock[1]), materialId: detectMaterial(`from ${stock[1]}`).id };
  }
  // Anything else goes to the parser as written.
  return { prompt: tidy(`${prompt}, ${phrase.trim()}`) };
}
