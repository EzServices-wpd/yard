import { detectMaterial, hasExplicitStock, promptNamingStock } from "./promptHelpers";
import { getCatalogItem } from "./catalog";
import { generateFromPrompt } from "./promptMain";
import { findInterference } from "./interference";
import type { Panel, YardProject } from "./types";

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

export function refinePrompt(prompt: string, phrase: string, project: Pick<YardProject, "overall" | "panels">): { prompt: string; materialId?: string; kind: "size" | "count" | "stock" | "text" } {
  const p = phrase.trim().toLowerCase().replace(/[.!]+$/, "");
  if (!p) return { prompt, kind: "text" };
  const o = { ...project.overall };

  // Size by: "make it 6 inches taller", "2 in lower".
  const by = p.match(new RegExp(`${NUM}\\s*(?:inches|inch|in|")?\\s*(taller|higher|shorter|lower|wider|longer|narrower|deeper|shallower)\\b`));
  if (by) {
    const [axis, sign] = AXIS[by[2]];
    o[axis] = Math.max(1, o[axis] + sign * num(by[1]));
    return { prompt: withSizes(prompt, o), kind: "size" };
  }
  // A bare comparative ("make it narrower") steps 2".
  const bare = p.match(/\b(taller|higher|shorter|lower|wider|longer|narrower|deeper|shallower)\b/);
  if (bare && !/\d/.test(p)) {
    const [axis, sign] = AXIS[bare[1]];
    o[axis] = Math.max(1, o[axis] + sign * 2);
    return { prompt: withSizes(prompt, o), kind: "size" };
  }
  // Size to: "make it 40 tall", "36 inches wide".
  const to = p.match(/(\d+(?:\.\d+)?)\s*(?:inches|inch|in|")?\s*(wide|long|tall|high|deep)\b/);
  if (to && !/\b(shel|drawer|door|cubb|hook)/.test(p)) {
    o[SET_AXIS[to[2]]] = Number(to[1]);
    return { prompt: withSizes(prompt, o), kind: "size" };
  }
  // Counts: "add a drawer", "two shelves", "one less shelf", "remove a door".
  for (const [noun, re] of Object.entries(COUNTS)) {
    const m = p.match(new RegExp(`^(add|remove|drop|no)?\\s*(?:the\\s+|all\\s+(?:the\\s+)?)?(?:${NUM}\\s+)?(?:more\\s+|less\\s+|fewer\\s+)?(?:${re.source})\\b`));
    if (!m) continue;
    const n = m[2] ? num(m[2]) : 1;
    const stated = prompt.match(new RegExp(`${NUM}\\s+(?:${re.source})\\b`, "i"));
    const have = stated ? num(stated[1]) : project.panels.filter((x) => (noun === "drawers" ? /drawer.*front|front.*drawer/i : re).test(x.name.toLowerCase())).length;
    const less = m[1] === "remove" || m[1] === "drop" || /\b(less|fewer)\b/.test(p);
    const all = m[1] === "no" || ((m[1] === "remove" || m[1] === "drop") && !m[2]);
    const next = all ? 0 : Math.max(0, m[1] === "add" || /\bmore\b/.test(p) ? have + n : less ? have - n : n);
    const base = tidy(prompt.replace(new RegExp(`(?:,?\\s*with\\s+)?${NUM}\\s+(?:${re.source})\\b`, "gi"), " "));
    return { prompt: tidy(`${base} with ${next} ${noun}`), kind: "count" };
  }
  // Stock: "use plywood", "make it from cedar", "in pine".
  const stock = p.match(/^(?:use|make it (?:from|out of|in)|from|out of|in|switch to)\s+(.+)$/);
  if (stock && hasExplicitStock(`from ${stock[1]}`)) {
    return { prompt: promptNamingStock(prompt, stock[1]), materialId: detectMaterial(`from ${stock[1]}`).id, kind: "stock" };
  }
  // Anything else goes to the parser as written.
  return { prompt: tidy(`${prompt}, ${phrase.trim()}`), kind: "text" };
}

const AXES = [["width", "Width"], ["height", "Height"], ["depth", "Depth"]] as const;
const COUNTED = [["shelf", "Shelves"], ["drawer", "Drawers"], ["door", "Doors"]] as const;
const n = (p: Pick<YardProject, "panels">, t: string) => p.panels.filter((x) => x.type === t).length;

/** What differs between two builds, in shop words ("Height 60" → 66""). */
export function describeChange(a: YardProject, b: YardProject): string[] {
  const out: string[] = [];
  for (const [k, label] of AXES) if (Math.abs(a.overall[k] - b.overall[k]) > 0.01) out.push(`${label} ${fmt(a.overall[k])}" → ${fmt(b.overall[k])}"`);
  for (const [t, label] of COUNTED) if (n(a, t) !== n(b, t)) out.push(`${label} ${n(a, t)} → ${n(b, t)}`);
  if (a.primaryMaterialId !== b.primaryMaterialId) out.push(`Stock ${getCatalogItem(a.primaryMaterialId)?.name ?? a.primaryMaterialId} → ${getCatalogItem(b.primaryMaterialId)?.name ?? b.primaryMaterialId}`);
  return out;
}

export type RefineResult = { project: YardProject | null; applied: string[]; notUnderstood: string[]; conflicts: string[]; refused: string[] };

const TARGET: Record<string, string[]> = { shelves: ["shelf"], drawers: ["drawer", "rail"], doors: ["door"], cubbies: ["divider", "cubby"], hooks: ["hook"] };
const stem = (name: string) => name.toLowerCase().replace(/\d.*$/, "").trim();
const types = (p: Pick<YardProject, "panels">) => p.panels.reduce<Record<string, number>>((m, x) => ((m[x.type] = (m[x.type] ?? 0) + 1), m), {});

/** Why a rebuilt project is not the same form with one change, or null when it fits. */
function formBreak(before: YardProject, after: YardProject, kind: string, noun?: string, want?: number): string | null {
  if (!stem(after.name).endsWith(stem(before.name)) || after.kind !== before.kind) return `it would turn the ${stem(before.name) || "build"} into a ${stem(after.name) || "different build"}`;
  const free = new Set(kind === "count" && noun ? TARGET[noun] ?? [] : []);
  const a = types(before), b = types(after);
  for (const t of new Set([...Object.keys(a), ...Object.keys(b)])) if (!free.has(t) && (a[t] ?? 0) !== (b[t] ?? 0)) return `it would change the ${t}s (${a[t] ?? 0} → ${b[t] ?? 0})`;
  if (noun && want != null && n(after, TARGET[noun]![0]) !== want) return `the form can't hold ${want} ${noun}`;
  if (findInterference(after).length > findInterference(before).length) return "the new parts would collide with the build";
  const doors = after.panels.filter((x) => x.type === "door");
  const over = (p: Panel, q: Panel) => p.position.x < q.position.x + q.size.width && q.position.x < p.position.x + p.size.width && p.position.y < q.position.y + q.size.height && q.position.y < p.position.y + p.size.height;
  if (noun === "drawers" && after.panels.some((d) => d.type === "drawer" && doors.some((x) => over(d, x)))) return "the drawers would sit behind the doors";
  return null;
}

/**
 * Refine the build on the bench: each clause ("taller and use plywood") is one change to size, a count or the
 * stock, applied in order and checked to keep the same form. Free text, conflicts and form breaks are reported,
 * never applied. Pure and local: no AI, no network.
 */
export function refineProject(project: YardProject, phrase: string): RefineResult {
  const out: RefineResult = { project: null, applied: [], notUnderstood: [], conflicts: [], refused: [] };
  const clauses = phrase.split(/\s*(?:,|;|\band\b|\bthen\b)\s*/i).map((c) => c.trim()).filter(Boolean);
  const touched = new Map<string, string>();
  let cur = project;
  for (const clause of clauses) {
    // The engine prompt rebuilds exactly this build (a fallback keeps its primitive).
    const r = refinePrompt(cur.prompt, clause, cur);
    if (r.kind === "text") { out.notUnderstood.push(clause); continue; }
    const next = generateFromPrompt(r.prompt, r.materialId ?? cur.primaryMaterialId);
    const changed = describeChange(cur, next);
    const keys = changed.map((c) => c.split(" ")[0]);
    const clash = keys.find((k) => touched.has(k));
    if (clash) { out.conflicts.push(`"${clause}" and "${touched.get(clash)}" both change ${clash.toLowerCase()}; kept the first`); continue; }
    if (!changed.length) { out.refused.push(`"${clause}": this build already has that`); continue; }
    const noun = r.kind === "count" ? Object.keys(COUNTS).find((k) => r.prompt.endsWith(` ${k}`)) : undefined;
    const want = noun ? Number(r.prompt.match(/with (\d+) \w+$/)?.[1]) : undefined;
    const why = formBreak(cur, next, r.kind, noun, want);
    if (why) { out.refused.push(`"${clause}": ${why}`); continue; }
    keys.forEach((k) => touched.set(k, clause));
    out.applied.push(...changed);
    cur = next;
  }
  out.project = cur === project ? null : cur;
  return out;
}
