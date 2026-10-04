/**
 * Every model part is placed in one step, after the parts it rests on.
 * A missing step is written from the part, not from a class template.
 */
import { faceScrewInches, stockThickness } from "./shopJoin";
import { inchFrac } from "./inchText";
import type { AssemblyStep, YardProject } from "./types";

type Part = { key: string; name: string; kind: string; support: string };

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
      .map((p) => ({ key: p.id, name: p.name, kind: p.type || "part", support: supportFor(p.name, p.type || "") }));
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
    support: supportFor(role, role),
  }));
}

function supportFor(name: string, kind: string): string {
  const hay = `${name} ${kind}`.toLowerCase();
  if (/\bleg\b/.test(hay)) return "";
  if (/back|backrest|door|brace/.test(hay)) return "seat";
  if (/seat|top|lid|shelf|tread|deck|desktop/.test(hay)) return "legs";
  if (/rail|apron|stretcher|slat/.test(hay)) return "legs";
  return "";
}

function mentions(step: AssemblyStep, part: Part): boolean {
  const used = (step.partsUsed ?? []).map((s) => s.toLowerCase()).filter((s) => s !== "*" && s !== "all");
  const kind = part.kind.toLowerCase();
  const name = part.name.toLowerCase();
  if (used.length) return used.includes(kind) || used.includes(name) || used.includes(part.key.toLowerCase());
  const text = `${step.title} ${step.description}`.toLowerCase();
  if (name.length > 3 && text.includes(name)) return true;
  return new RegExp(`\\b${kind}s?\\b`).test(text);
}

function isBuild(step: AssemblyStep): boolean {
  return !PREP.test(step.title) && !/^Cut\b/i.test(step.title);
}

function ontoTalk(project: YardProject, part: Part): string {
  if (part.support === "seat") return "the seat";
  const hasLegs = project.panels.some((p) => /leg/i.test(p.name)) || project.instances.some((i) => i.role === "leg");
  if (hasLegs) return "the legs and aprons";
  if (project.panels.some((p) => /upright/i.test(p.name) || p.type === "upright")) return "the uprights";
  return "the frame";
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

export function placeEveryPart(project: YardProject, steps: AssemblyStep[]): AssemblyStep[] {
  const parts = partsOf(project);
  if (!parts.length || !steps.length) return steps;
  const out = steps.map((s) => ({ ...s }));
  const fix = fastenerTalk(project);
  const placed = () => placementIndex(project, out);

  for (const part of parts) {
    const at = placed().get(part.key);
    if (at == null) {
      const supportAt = part.support ? supportIndex(project, out, part.support) : out.length - 2;
      const insertAt = Math.min(out.length, Math.max(0, (supportAt ?? out.length - 2) + 1));
      const onto = ontoTalk(project, part);
      out.splice(insertAt, 0, {
        step: insertAt + 1,
        title: `Set the ${part.name} on ${onto}`,
        description: `Set the ${part.name} on ${onto}. Fasten it with ${fix}`,
        tips: "This part was on the model and not yet in a step.",
        partsUsed: [part.kind],
      });
      continue;
    }
    const step = out[at];
    const text = `${step.title} ${step.description}`.toLowerCase();
    const namesSupport = !part.support || /on the legs|on the aprons|on the uprights|on the seat|on the frame|set the .+ on|attach .+ to/.test(text);
    const namesFix = /glue|screw|dowel|biscuit|pocket|cement|pin|nail/.test(text);
    if (namesSupport && namesFix) continue;
    const onto = ontoTalk(project, part);
    step.description = `${step.description} Set the ${part.name} on ${onto}. Fasten it with ${fix}`;
  }
  return renumber(out);
}

function supportIndex(project: YardProject, steps: AssemblyStep[], support: string): number | undefined {
  const parts = partsOf(project);
  const placed = placementIndex(project, steps);
  const keys = parts.filter((p) => new RegExp(support === "legs" ? "leg|upright|post|apron" : "seat|top|deck", "i").test(`${p.name} ${p.kind}`));
  const indexes = keys.map((p) => placed.get(p.key)).filter((n): n is number => n != null);
  return indexes.length ? Math.max(...indexes) : undefined;
}
