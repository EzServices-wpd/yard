/**
 * Listed in partsUsed is not placed.
 *
 * placementIndex is the first step that lists a part. Step order keeps reading that
 * index, so a thin back still listed on "Stand the main box" never moves a step.
 *
 * fastenedAt is the step that attaches the part: the earliest attach / set / lay /
 * glue / hang of that part, otherwise the listed step. Screw totals and the names
 * in "attach X to … with N" lines read fastenedAt. Placement talk (rests on, flush
 * with, through) is left as placement.ts writes it.
 * This pass never inserts, deletes, or retitles a step.
 */
import { placementIndex } from "./placeEveryPart";
import { partLetters } from "./pdfDraw";
import { cutListName } from "./shopPlural";
import { BUY_JOINTS, stepScrewCount } from "./stepJointScrews";
import type { AssemblyStep, BuildPlan, Panel, YardProject } from "./types";

type Joint = { a: string; b: string; screws: number };

const FROZEN =
  /^(?:confirm|cut|read|lay out|do not|print|count|mark|level|seal|splice|prep|label|glue up|join sheet|drill|sand|finish|paint|before|shim)\b/i;
const VERB =
  /\b(attach|set|lay|glue|hang|fasten|pin|screw|fit|slide|mount)\s+(?:the\s+|each\s+|every\s+)?(?:\d+\s+)?(?:both\s+|two\s+|three\s+|four\s+)?([a-z0-9][^.,;]*?)(?=\s+(?:to|onto|into|on|under|with|between|at|from)\b|[.,;]|$)/gi;
const ACCOUNTING = [
  /\s*In all, this step drives \d+ × #8 × [\d/ ]+" screws, from the model's joints\./g,
  /\s*Drive \d+ × #8 × [\d/ ]+" screws in this step, from the model's joints: one about every 8" along each joint \(at least 2\)\./g,
  /\s*These screws are counted in another step's total\./g,
  /\s*That brings the build to \d+ screws from the model's joints, the count on the Buy list\./g,
];

function singular(w: string): string {
  return w
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.replace(/ves$/, "f").replace(/ies$/, "y").replace(/s$/, ""))
    .join(" ");
}

function sentencesOf(desc: string): string[] {
  return desc.split(/(?<=[.!?])\s+/).filter(Boolean);
}

function joinSentences(parts: string[]): string {
  return parts.join(" ").replace(/[ \t]{2,}/g, " ").trim();
}

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

/** Panels a cut-list phrase names ("both E cubby dividers", "A", "the caster 1"). Empty when the phrase is not a part. */
function panelsInPhrase(phrase: string, panels: Panel[], letters: Map<string, string>): Panel[] {
  const raw = phrase.trim().replace(/^(?:both|each|all\s+\d+|the)\s+/i, "").trim();
  if (!raw) return [];
  const headed = raw.match(/^([A-Z]{1,2})(?:\s+(.*))?$/);
  if (headed) {
    const letter = headed[1];
    const rest = (headed[2] ?? "").trim();
    const nums = rest.match(/\d+/g) ?? [];
    const want = singular(rest);
    const words = want.split(" ").filter((w) => w.length > 2);
    return panels.filter((p) => {
      if (letters.get(p.id) !== letter) return false;
      if (nums.length && !nums.every((n) => new RegExp(`\\b${n}\\b`).test(p.name))) return false;
      if (!rest) return true;
      const name = singular(p.name);
      const fam = singular(cutListName(p.name, p.type));
      return name.includes(want) || fam.includes(want) || (words.length > 0 && words.every((w) => name.includes(w) || fam.includes(w)));
    });
  }
  const want = singular(raw);
  if (want.length < 4) return [];
  const nums = raw.match(/\d+/g) ?? [];
  return panels.filter((p) => {
    if (nums.length && !nums.every((n) => new RegExp(`\\b${n}\\b`).test(p.name))) return false;
    const name = singular(p.name);
    const fam = singular(cutListName(p.name, p.type));
    return name.includes(want) || fam.includes(want) || (fam.length > 4 && want.includes(fam));
  });
}

function verbPhrases(step: AssemblyStep): string[] {
  const text = `${step.title}. ${step.description ?? ""}`;
  const out: string[] = [];
  const re = new RegExp(VERB.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const verb = m[1].toLowerCase();
    const obj = m[2].trim();
    if (!obj || /^(?:through|the joints|it|them|this|that)\b/i.test(obj)) continue;
    if (verb === "screw" && /^on\b/i.test(text.slice(m.index + m[1].length))) continue;
    for (const piece of obj.split(/\s+and\s+/i)) {
      const p = piece.replace(/^(?:the|both|each)\s+/i, "").trim();
      if (p && !/^(?:it|them|main box|box)$/i.test(p)) out.push(p);
    }
  }
  return out;
}

/**
 * The step index that attaches each panel. A later "attach A Back" wins over an
 * earlier step that only lists the back. Parts with no attach verb keep the
 * listed step, which is what step order already uses.
 */
export function fastenedAt(project: YardProject, steps: AssemblyStep[], cutList: BuildPlan["cutList"]): Map<string, number> {
  const listed = placementIndex(project, steps);
  const at = new Map<string, number>(listed);
  if (!project.panels.length) return at;
  const letters = partLetters(project, cutList);
  const panels = project.panels.filter((p) => !p.drawerId || p.drawerPart === "front");
  const verbAt = new Map<string, number>();
  steps.forEach((step, i) => {
    if (FROZEN.test(step.title)) return;
    const used = new Set((step.partsUsed ?? []).map((n) => n.toLowerCase()));
    const named = used.size > 0 && ![...used].every((n) => n === "*" || n === "all");
    for (const phrase of verbPhrases(step)) {
      const hit = panelsInPhrase(phrase, panels, letters);
      const lettered = /^[A-Z]{1,2}(?:\s|$)/.test(phrase.trim());
      for (const p of hit) {
        if (!lettered && named && !used.has(p.name.toLowerCase())) continue;
        const prev = verbAt.get(p.id);
        if (prev == null || i < prev) verbAt.set(p.id, i);
      }
    }
  });
  for (const [id, i] of verbAt) at.set(id, i);
  return at;
}

function placedBy(at: Map<string, number>, i: number): (p: Panel) => boolean {
  return (p) => {
    const n = at.get(p.id);
    return n != null && n <= i;
  };
}

function filterList(list: string, panels: Panel[], letters: Map<string, string>, keep: (p: Panel) => boolean): { text: string; dropped: boolean; unknown: boolean } {
  const items = listItems(list);
  let dropped = false;
  let unknown = false;
  const kept: string[] = [];
  for (const item of items) {
    // "shelf or top" stays whole when either one is already attached. Splitting it would be new wording.
    if (/\bor\b/i.test(item)) {
      const placedAlt = (alt: string) => {
        if (panelsInPhrase(alt, panels, letters).some(keep)) return true;
        const word = singular(alt.replace(/^(?:the|nearest|a|an)\s+/gi, ""));
        return word.length >= 3 && panels.some((p) => singular(cutListName(p.name, p.type)) === word && keep(p));
      };
      if (item.split(/\s+or\s+/i).some(placedAlt)) kept.push(item);
      else dropped = true;
      continue;
    }
    const who = panelsInPhrase(item, panels, letters);
    if (!who.length) {
      unknown = true;
      kept.push(item);
      continue;
    }
    if (who.some(keep)) kept.push(item);
    else dropped = true;
  }
  return { text: joinItems(kept), dropped, unknown };
}

function screwsBetween(joints: Joint[], as: Set<string>, bs: Set<string>): number {
  let n = 0;
  for (const j of joints) {
    if (!j.screws) continue;
    if ((as.has(j.a) && bs.has(j.b)) || (as.has(j.b) && bs.has(j.a))) n += j.screws;
  }
  return n;
}

/** Shorten an "attach X to … with N" list to parts already attached, and set N from those joints. */
function rewriteAttach(sentence: string, i: number, panels: Panel[], letters: Map<string, string>, at: Map<string, number>, joints: Joint[]): string | null {
  const m = sentence.match(/^(.*\battach\s+(?:the\s+)?(?:[A-Z]{1,2}\s+)?[A-Za-z][A-Za-z ]*?)\s+to\s+(?:the back edges of\s+)?(.+?)\s+with\s+(\d+)\s+×\s+(#8\s+×\s+[\d/ ]+"\s+screws)([\s\S]*)$/i);
  if (!m) return null;
  if (/\bper\b/i.test(m[6]) || /back edges of/i.test(sentence)) return sentence;
  const keep = placedBy(at, i);
  const filtered = filterList(m[2], panels, letters, keep);
  if (!filtered.dropped) return sentence;
  const sub = m[1].match(/\battach\s+(?:the\s+)?(.+)$/i);
  const movers = sub ? panelsInPhrase(sub[1], panels, letters) : [];
  if (!filtered.text) return "";
  const moverIds = new Set(movers.map((p) => p.id));
  let between = 0;
  if (moverIds.size) {
    for (const item of listItems(filtered.text)) {
      const targets = panelsInPhrase(item, panels, letters);
      if (targets.length) between += screwsBetween(joints, moverIds, new Set(targets.map((p) => p.id)));
    }
  }
  const n = between || Number(m[3]);
  if (!n) return "";
  const toEdges = /back edges of/i.test(sentence);
  const bridge = toEdges ? "to the back edges of" : "to";
  const rest = m[5] ?? "";
  return `${m[1].replace(/\s+$/, "")} ${bridge} ${filtered.text} with ${n} × ${m[4]}${rest}`;
}

function isAccounting(sentence: string): boolean {
  return /In all, this step drives |Drive \d+ × #8 |These screws are counted in another step|brings the build to \d+/.test(sentence);
}

function rewriteDescriptions(
  steps: AssemblyStep[],
  panels: Panel[],
  letters: Map<string, string>,
  at: Map<string, number>,
  joints: Joint[],
): AssemblyStep[] {
  const out = steps.map((step, i) => {
    if (FROZEN.test(step.title)) return step;
    const stay: string[] = [];
    let pendingWhere = false;
    for (const original of sentencesOf(step.description ?? "")) {
      if (isAccounting(original)) {
        stay.push(original);
        continue;
      }
      if (/\balready on\b/i.test(original)) {
        const claim = original.split(/\balready on\b/i)[0] ?? "";
        const late = panels.filter((p) => panelsInPhrase(claim, [p], letters).length && (at.get(p.id) ?? i) > i);
        if (late.length) {
          if (/^Where:/.test(original)) pendingWhere = true;
          continue;
        }
      }
      const attached = rewriteAttach(original, i, panels, letters, at, joints);
      let sentence = attached ?? original;
      if (attached === "") {
        stay.push(original);
        continue;
      }
      // Placement talk (rests on, flush with, through) stays as placement.ts writes it; the honesty guard regenerates it.
      if (pendingWhere && !/^Where:/.test(sentence)) {
        sentence = `Where: ${sentence.replace(/^Where:\s*/, "")}`;
        pendingWhere = false;
      }
      stay.push(sentence);
    }
    const description = joinSentences(stay);
    return description === (step.description ?? "") ? step : { ...step, description };
  });

  return out;
}

/** A fastening clause moved onto this step stays last, where the shopper reads it as the close of the step. */
function addAccounting(desc: string, extra: string): string {
  const parts = sentencesOf(desc);
  const last = parts[parts.length - 1] ?? "";
  if (/^(?:Screw through|The desktop screws|Tape or glue through|Set the joints the stock uses)/.test(last)) {
    parts.splice(parts.length - 1, 0, extra.replace(/\.$/, "") + ".");
    return joinSentences(parts);
  }
  const base = desc.trim();
  return `${base}${/[.!?]$/.test(base) || !base ? "" : "."} ${extra}`.trim();
}

function stripAccounting(desc: string): string {
  let d = desc;
  for (const re of ACCOUNTING) d = d.replace(re, "");
  return d.replace(/\s{2,}/g, " ").trim();
}

function statedWith(desc: string): number {
  let n = 0;
  for (const m of desc.matchAll(/with (\d+) × #8 /g)) n += Number(m[1]);
  return n;
}

function firstDrive(desc: string): number | null {
  if (/counted in another step's total\./.test(desc)) return 0;
  const m = desc.match(/(?:Drive|drives) (\d+) × #8 /);
  return m ? Number(m[1]) : null;
}

/** Screws stepScrewCount would add for this description. */
function contribution(desc: string): number {
  const drive = firstDrive(desc);
  if (drive != null) return drive;
  return statedWith(desc);
}

function screwLength(plan: BuildPlan): string | null {
  const line = plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""));
  const raw = line?.name.match(/#8 x ([\d/ -]+)"/)?.[1];
  return raw ? raw.replace(/-/g, " ") : null;
}

function recount(steps: AssemblyStep[], at: Map<string, number>, joints: Joint[], plan: BuildPlan): AssemblyStep[] | null {
  const per = new Map<number, number>();
  for (const j of joints) {
    if (!(j.screws > 0)) continue;
    const a = at.get(j.a);
    const b = at.get(j.b);
    if (a == null || b == null) return null;
    const i = Math.max(a, b);
    per.set(i, (per.get(i) ?? 0) + j.screws);
  }
  const len = screwLength(plan);
  if (!len) return null;
  const total = joints.reduce((n, j) => n + (j.screws > 0 ? j.screws : 0), 0);
  const out = steps.map((s) => ({ ...s, description: stripAccounting(s.description ?? "") }));
  out.forEach((s, i) => {
    const want = per.get(i) ?? 0;
    const have = contribution(s.description);
    if (have === want) return;
    if (firstDrive(s.description) != null) return;
    const stated = statedWith(s.description);
    let extra = "";
    if (want === 0 && stated > 0) extra = "These screws are counted in another step's total.";
    else if (want > 0 && stated > 0) extra = `In all, this step drives ${want} × #8 × ${len}" screws, from the model's joints.`;
    else if (want > 0) extra = `Drive ${want} × #8 × ${len}" screws in this step, from the model's joints: one about every 8" along each joint (at least 2).`;
    if (!extra) return;
    s.description = addAccounting(s.description, extra);
  });
  const last = Math.max(-1, ...per.keys());
  if (last >= 0 && out[last] && total > 0) {
    const s = out[last];
    s.description = `${s.description.replace(/\s*$/, "")} That brings the build to ${total} screws from the model's joints, the count on the Buy list.`;
  }
  return out;
}

function sameOrder(before: AssemblyStep[], after: AssemblyStep[]): boolean {
  return before.length === after.length && before.every((s, i) => s.title === after[i].title && s.step === after[i].step);
}

/**
 * Rewrite screw totals and part names from parts attached at or before each step.
 * Titles and step sequence stay exactly as they were.
 */
function understated(steps: AssemblyStep[]): boolean {
  return steps.some((s) => {
    const d = s.description ?? "";
    const total = d.match(/(?:In all, this step drives|Drive) (\d+) × #8 /);
    const said = [...d.matchAll(/with (\d+) × #8 /g)].reduce((n, m) => n + Number(m[1]), 0);
    return !!total && said > 0 && Number(total[1]) < said;
  });
}

/**
 * The step that can drive a part's screws. An attach verb later than the first listing is the real
 * close (a back listed while the box is stood, fastened after). A verb match earlier than the listing
 * names some other part: the screws wait until the part is actually in a step.
 */
export function closableAt(project: YardProject, steps: AssemblyStep[], cutList: BuildPlan["cutList"]): Map<string, number> {
  const listed = placementIndex(project, steps);
  const attached = fastenedAt(project, steps, cutList);
  const at = new Map<string, number>();
  for (const id of new Set([...listed.keys(), ...attached.keys()])) {
    const a = attached.get(id);
    const b = listed.get(id);
    if (a == null || b == null) {
      const i = a ?? b;
      if (i != null) at.set(id, i);
      continue;
    }
    at.set(id, Math.max(a, b));
  }
  return at;
}

export function applyFastenedPlacement(project: YardProject, plan: BuildPlan): BuildPlan {
  if (!project.panels.length || plan.instructions.length < 2) return plan;
  const before = plan.instructions;
  const at = closableAt(project, before, plan.cutList);
  const letters = partLetters(project, plan.cutList);
  const panels = project.panels;
  const joints = (BUY_JOINTS.get(project) ?? []) as Joint[];
  let instructions = rewriteDescriptions(before, panels, letters, at, joints);
  if (joints.length && joints.some((j) => j.screws > 0)) {
    const counted = recount(instructions, at, joints, plan);
    if (counted && stepScrewCount({ ...plan, instructions: counted }) === joints.reduce((n, j) => n + (j.screws > 0 ? j.screws : 0), 0)) {
      // A step never states a total below the "with N" it already tells the reader to drive.
      if (understated(counted) && !understated(before)) return plan;
      instructions = counted;
    }
  }
  if (!sameOrder(before, instructions)) {
    throw new Error("fastened placement changed step order");
  }
  if (instructions.every((s, i) => s.description === before[i].description)) return plan;
  return { ...plan, instructions };
}
