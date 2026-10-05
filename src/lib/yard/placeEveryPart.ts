/**
 * Every model part is placed in one step, after the parts it rests on.
 * A missing step is written from the part, not from a class template.
 */
import { faceScrewInches, stockThickness } from "./shopJoin";
import { inchFrac } from "./inchText";
import type { AssemblyStep, YardProject } from "./types";
import { supportsOf, type SupportInfo } from "./supportGraph";
import { ANATOMY_NOTE } from "./classAnatomy";

type Part = { key: string; name: string; kind: string };

const PREP = /^(confirm|read|measure|check|lay out|mark|do not cut|before)/i;

function fastenerTalk(project: YardProject): string {
  const join = project.shopJoin;
  const id = project.primaryMaterialId ?? "";
  if (join === "dowel") return "2 dowels and glue per joint, the same dowels on the Buy list. No face screws.";
  if (join === "biscuit") return "#20 biscuits and glue, the same biscuits on the Buy list. No face screws.";
  if (join === "pocket") return "pocket screws, the same pocket screws on the Buy list. No face screws.";
  if (join === "glue" || /popsicle|chipboard|cardboard|dowel|balsa/.test(id)) return "glue, the same glue on the Buy list.";
  if (/pvc|pipe/.test(id)) return "solvent cement, the same cement on the Buy list.";
  const len = inchFrac(faceScrewInches(stockThickness(project)));
  return `#8 x ${len}" screws, the same screws on the Buy list.`;
}

function partsOf(project: YardProject): Part[] {
  if (project.panels.length) {
    return project.panels
      .filter((p) => p.type !== "drawer")
      .map((p) => ({ key: p.id, name: p.name, kind: p.type || "part" }));
  }
  const roles = new Map<string, number>();
  for (const inst of project.instances) {
    const role = inst.role || "member";
    roles.set(role, (roles.get(role) ?? 0) + 1);
  }
  return [...roles.entries()].map(([role, n]) => ({
    key: role,
    name: n === 1 ? role : `${n} ${role}s`,
    kind: role,
  }));
}

function mentions(step: AssemblyStep, part: Part): boolean {
  const used = (step.partsUsed ?? []).map((s) => s.toLowerCase()).filter((s) => s !== "*" && s !== "all");
  const kind = part.kind.toLowerCase();
  const name = part.name.toLowerCase();
  const fam = familyWord(part.name);
  if (used.length) {
    const title = step.title.toLowerCase();
    return (
      (fam.includes(" ") && title.includes(plural(fam, 2))) ||
      used.includes(kind) ||
      used.includes(name) ||
      used.includes(part.key.toLowerCase()) ||
      (fam.includes(" ") && (used.includes(fam) || used.includes(plural(fam, 2))))
    );
  }
  const text = `${step.title} ${step.description}`.toLowerCase();
  if (name.length > 3 && text.includes(name)) return true;
  if (fam.includes(" ") && (text.includes(plural(fam, 2)) || text.includes(fam))) return true;
  if (new RegExp(`to the ${name}|onto the ${name}|on the ${name}`).test(text)) return true;
  return new RegExp(`\\b${kind}s?\\b`).test(text);
}

function isBuild(step: AssemblyStep): boolean {
  return !PREP.test(step.title) && !/^Cut\b/i.test(step.title);
}

const POSITION = /^(left|right|front|back|top|bottom|lower|upper|middle|inner|outer|center|centre)$/;

/** A part's family word: "Left upright" → "upright", "Leg front left 1" → "leg", "Left drawer front 2" → "drawer front". */
export function familyWord(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\d+/g, " ")
    .split(/\s+/)
    .filter((w) => w && w !== "step");
  if (!words.length) return name.toLowerCase();
  const last = words[words.length - 1];
  const core = words.filter((w) => !POSITION.test(w));
  if (/^(front|back|top|bottom)$/.test(last) && core.length && words.length > 1 && !POSITION.test(words[words.length - 2])) {
    return `${core[core.length - 1]} ${last}`;
  }
  return core.length ? core.join(" ") : words.join(" ");
}

function plural(word: string, n: number): string {
  if (n === 1) return word;
  if (/(s|sh|ch|x)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

/** The real support named in plain words: "the floor", "both uprights", "the 4 legs", "the Bottom". */
function supportTalk(project: YardProject, info: SupportInfo | undefined): string {
  if (!info || info.how === "floor") return "the floor";
  if (!info.on.length) return "the parts it meets";
  const names = project.panels.length
    ? info.on.map((id) => project.panels.find((p) => p.id === id)?.name ?? "").filter(Boolean)
    : info.on.map((role) => {
        const n = project.instances.filter((i) => (i.role || "member") === role).length;
        return n === 1 ? role : `${n} ${plural(role, n)}`;
      });
  if (!project.panels.length) return names.map((n) => `the ${n}`).join(" and ");
  const byFamily = new Map<string, number>();
  for (const n of names) byFamily.set(familyWord(n), (byFamily.get(familyWord(n)) ?? 0) + 1);
  const bits = [...byFamily.entries()].map(([w, n]) => (n === 1 ? `the ${names.find((x) => familyWord(x) === w)}` : n === 2 ? `both ${plural(w, 2)}` : `the ${n} ${plural(w, n)}`));
  return bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}` : bits[0];
}

/** One sentence that sets the part on its real support with the way it really holds. */
function placeSentence(project: YardProject, part: Part, info: SupportInfo | undefined, fix: string): string {
  const onto = supportTalk(project, info);
  switch (info?.how) {
    case "floor":
      return `Set the ${part.name} on the floor, square to the marks. It is the base the next parts fasten to.`;
    case "hinges":
      return `Hang the ${part.name} on its hinges on ${onto}.`;
    case "front":
      return `Set the ${part.name} on the face of ${onto} and fasten it from inside the drawer with ${fix}`;
    case "rests":
      return `Set the ${part.name} on ${onto}. Fasten it with ${fix}`;
    default:
      return `Fasten the ${part.name} to ${onto} with ${fix}`;
  }
}

/** True when the step already says what the part sits on and how it holds. */
function namesSupport(project: YardProject, step: AssemblyStep, info: SupportInfo | undefined): boolean {
  const text = `${step.title} ${step.description}`.toLowerCase();
  if (!info) return true;
  if (info.how === "floor") return /floor|stand|footprint|on the marks|bench/.test(text);
  if (info.how === "hinges") return /hinge/.test(text);
  if (info.how === "front") return /drawer box|drawer/.test(text) && /screw|glue/.test(text);
  if (!/glue|screw|dowel|biscuit|pocket|cement|pin|nail|tape|tab/.test(text)) return false;
  // The support's family word ("leg front") or its assembly word ("leg", "body", "floor").
  const words = project.panels.length
    ? info.on.flatMap((id) => {
        const fam = familyWord(project.panels.find((p) => p.id === id)?.name ?? "");
        return [fam, fam.split(" ")[0]];
      })
    : info.on.map((r) => r.toLowerCase());
  return words.some((w) => w && (text.includes(w) || text.includes(plural(w, 2))));
}

function renumber(steps: AssemblyStep[]): AssemblyStep[] {
  return steps.map((s, i) => ({ ...s, step: i + 1 }));
}

/** The step index that places each part, or -1. */
export function placementIndex(project: YardProject, steps: AssemblyStep[]): Map<string, number> {
  const placed = new Map<string, number>();
  const parts = partsOf(project);
  steps.forEach((step, i) => {
    if (!isBuild(step)) return;
    for (const part of parts) {
      if (!placed.has(part.key) && mentions(step, part)) placed.set(part.key, i);
    }
  });
  return placed;
}

const INSERTED = "This part was on the model and not yet in a step.";

export function placeEveryPart(project: YardProject, steps: AssemblyStep[]): AssemblyStep[] {
  const parts = partsOf(project);
  if (!parts.length || !steps.length) return steps;
  let out = steps.map((s) => ({ ...s }));
  const fix = fastenerTalk(project);
  const supports = supportsOf(project);
  const placed = () => placementIndex(project, out);
  const firstBuild = () => Math.max(0, out.findIndex(isBuild));
  const dependents = (key: string) => parts.filter((p) => supports.get(p.key)?.on.includes(key));

  // Class-anatomy steps are written in support order (floor, base, body, top) and name each support.
  const handWritten = (project.notes ?? []).some((n) => n.startsWith(ANATOMY_NOTE));
  if (!handWritten) out = splitByLayer(project, out, parts, supports, fix);
  for (const part of parts) {
    const info = supports.get(part.key);
    const at = placed().get(part.key);
    if (at == null) {
      // Insert right after the parts it rests on, and before any part that rests on it.
      const where = placed();
      const after = (info?.on ?? []).map((k) => where.get(k)).filter((n): n is number => n != null);
      const before = dependents(part.key).map((p) => where.get(p.key)).filter((n): n is number => n != null);
      const lo = after.length ? Math.max(...after) + 1 : info?.how === "floor" ? firstBuild() : Math.max(firstBuild(), out.length - 1);
      const hi = before.length ? Math.min(...before) : out.length;
      const insertAt = Math.max(0, Math.min(lo, hi, out.length));
      const sentence = placeSentence(project, part, info, fix);
      const verb = info?.how === "hinges" ? "Hang" : info?.how === "rests" || info?.how === "floor" || info?.how === "front" ? "Set" : "Fasten";
      out.splice(insertAt, 0, {
        step: insertAt + 1,
        title: `${verb} the ${part.name}`,
        description: sentence,
        tips: INSERTED,
        partsUsed: [project.panels.length ? part.name : part.kind],
      });
      continue;
    }
    const step = out[at];
    if (handWritten || namesSupport(project, step, info)) continue;
    step.description = `${step.description} ${placeSentence(project, part, info, fix)}`;
  }

  // A part placed before the part it rests on: move the support's own inserted step up front.
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    const where = placed();
    for (const part of parts) {
      const at = where.get(part.key);
      if (at == null) continue;
      for (const key of supports.get(part.key)?.on ?? []) {
        const j = where.get(key);
        if (j == null || j <= at || out[j].tips !== INSERTED) continue;
        const [step] = out.splice(j, 1);
        out.splice(at, 0, step);
        moved = true;
        break;
      }
      if (moved) break;
    }
    if (!moved) break;
  }
  return renumber(out);
}

/** Support depth: floor parts 0, a part on them 1, and so on. */
function levels(parts: Part[], supports: Map<string, SupportInfo>): Map<string, number> {
  const lv = new Map<string, number>();
  for (const p of parts) if (supports.get(p.key)?.how === "floor") lv.set(p.key, 0);
  // A part sits one layer above the highest part it rests on.
  for (const partial of [false, true]) {
    for (let round = 0; round < parts.length; round++) {
      let grew = false;
      for (const p of parts) {
        if (lv.has(p.key)) continue;
        const keys = (supports.get(p.key)?.on ?? []).filter((k) => parts.some((q) => q.key === k));
        const on = keys.map((k) => lv.get(k)).filter((n): n is number => n != null);
        if (on.length && (partial || on.length === keys.length)) {
          lv.set(p.key, Math.max(...on) + 1);
          grew = true;
        }
      }
      if (!grew) break;
    }
  }
  return lv;
}

/**
 * One catch-all step that places many parts on several support layers ("Brace the frame" covering rails
 * and treads) becomes one step per layer, in support order, each naming the real support.
 */
function splitByLayer(
  project: YardProject,
  steps: AssemblyStep[],
  parts: Part[],
  supports: Map<string, SupportInfo>,
  fix: string,
): AssemblyStep[] {
  if (!project.panels.length) return steps;
  const lv = levels(parts, supports);
  const where = placementIndex(project, steps);
  const out: AssemblyStep[] = [];
  steps.forEach((step, i) => {
    const mine = parts.filter((p) => where.get(p.key) === i);
    const layers = [...new Set(mine.map((p) => lv.get(p.key) ?? 99))].sort((a, b) => a - b);
    const unnamed = mine.some((p) => !namesSupport(project, step, supports.get(p.key)));
    if (mine.length < 6 || layers.length < 2 || !isBuild(step) || !unnamed) {
      out.push(step);
      return;
    }
    layers.forEach((L, k) => {
      const group = mine.filter((p) => (lv.get(p.key) ?? 99) === L);
      const byTalk = new Map<string, Part[]>();
      for (const p of group) {
        const info = supports.get(p.key);
        const key = `${info?.how ?? "side"}|${supportTalk(project, info)}`;
        byTalk.set(key, [...(byTalk.get(key) ?? []), p]);
      }
      const sentences = [...byTalk.entries()].map(([key, ps]) => {
        const [how, talk] = key.split("|");
        const list = listNames(ps.map((p) => p.name));
        if (how === "floor") return `Stand the ${list} on the floor, square to the marks.`;
        if (how === "rests") return `Set the ${list} on ${talk}.`;
        if (how === "hinges") return `Hang the ${list} on ${talk} with their hinges.`;
        return `Fasten the ${list} to ${talk}.`;
      });
      const fastens = group.some((p) => !["floor", "hinges"].includes(supports.get(p.key)?.how ?? ""));
      const body = `${sentences.join(" ")}${fastens ? ` Fasten each one with ${fix}` : ""}`;
      const fam = [...new Set(group.map((p) => familyWord(p.name)))];
      out.push({
        ...step,
        title: k === 0 ? step.title : `Set the ${listNames(fam.map((w) => plural(w, 2)))}`,
        description: k === 0 ? `${step.description} ${body}` : body,
        tips: k === 0 ? step.tips : "Each layer goes on after the parts it rests on.",
        partsUsed: group.map((p) => p.name),
      });
    });
  });
  return out;
}

function listNames(names: string[]): string {
  const u = [...new Set(names)];
  return u.length > 1 ? `${u.slice(0, -1).join(", ")} and ${u[u.length - 1]}` : u[0] ?? "";
}
