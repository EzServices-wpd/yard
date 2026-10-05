import { uniqueSteps as uniqueDefault } from "./steps";
import { uniqueTableSteps } from "./tableSteps";
import { jobFurnitureSteps } from "./jobFurniture";
import { placeEveryPart } from "./placeEveryPart";
import { classAnatomySteps } from "./classAnatomy";
import type { AssemblyStep, YardProject } from "./types";
import { isBoughtHardwareName } from "./boughtHardware";
import { SCREWS_PER_HOOK } from "./hookCount";

export function uniqueSteps(project: YardProject): AssemblyStep[] {
  const raw = classAnatomySteps(project) ?? ((project.notes ?? []).some((n) => /no craft stock was named/.test(n))
    ? jobFurnitureSteps(project)
    : project.fitted?.program === "table" ? uniqueTableSteps(project) : uniqueDefault(project));
  const display = (project.notes ?? []).some((n) => /display model/i.test(n));
  const steps = raw
    .filter((s) => !/^Do not cut\b/i.test(s.title))
    .map((s) => display && /^(Sit on it|Load it|Stand on it)$/i.test(s.title)
      ? { ...s, title: "Set it on display", description: "This is a display model. Set it on a shelf where it can be seen and enjoyed." }
      : s);
  return placeEveryPart(project, withHardwareStep(project, withFrameStack(project, steps)));
}

/**
 * Bought hardware drawn in the model (coat hooks) goes on in one step, after the rail it screws to:
 * the rack's own hook step when it has one, else a step of its own. Board steps keep to boards.
 */
function withHardwareStep(project: YardProject, steps: AssemblyStep[]): AssemblyStep[] {
  const hw = project.panels.filter((p) => isBoughtHardwareName(p.name));
  if (!hw.length) return steps;
  const hwNames = new Set(hw.map((p) => p.name));
  const out = steps.map((s) => ({
    ...s,
    description: s.description.replace(/;?\s*Coat (?:hook|peg) \d+ — [^;.]*?"/g, ""),
    partsUsed: (s.partsUsed ?? []).filter((n) => !hwNames.has(n)),
  }));
  const own = out.findIndex((s) => /\b(?:hooks?|pegs?)\b/i.test(s.title) && /screw/i.test(`${s.title} ${s.description}`));
  if (own >= 0) {
    out[own] = { ...out[own], partsUsed: [...(out[own].partsUsed ?? []), ...hw.map((p) => p.name)] };
    return out;
  }
  const n = hw.length;
  const railAt = out.map((s, i) => ((s.partsUsed ?? []).some((name) => /rail/i.test(name)) ? i : -1)).filter((i) => i >= 0).pop();
  const at = railAt == null ? Math.max(0, out.length - 1) : railAt + 1;
  out.splice(at, 0, {
    step: 0,
    title: `Screw ${n} coat hooks to the peg rail`,
    description: `Mark ${n} holes on the peg rail, evenly spaced, 1 1/2" up from its bottom edge. Screw ${n} hooks into the rail with ${SCREWS_PER_HOOK} screws each (${n * SCREWS_PER_HOOK} screws).`,
    tips: "The hook pack on the Buy list is the whole kit besides screws.",
    partsUsed: hw.map((p) => p.name),
  });
  return out.map((s, i) => ({ ...s, step: i + 1 }));
}

/**
 * A stick picture frame: the glazing, photo and backer go in after the spacer that holds them,
 * as their own step, so the clear sheet and backer are placed parts and not left off the build.
 */
function withFrameStack(project: YardProject, steps: AssemblyStep[]): AssemblyStep[] {
  if (project.shape?.classId !== "flat-frame" || !project.instances.length) return steps;
  const sheets = project.panels.filter((p) => p.type === "glass_panel" || p.name === "Backer");
  if (!sheets.length || steps.some((s) => sheets.some((p) => (s.partsUsed ?? []).includes(p.name)))) return steps;
  const glaze = sheets.find((p) => p.type === "glass_panel");
  const backer = sheets.find((p) => p.name === "Backer");
  const at = steps.findIndex((s) => /spacer/i.test(s.title));
  const glazeTalk = glaze ? `Peel the film off the ${glaze.name.toLowerCase()}, set it in the spacer opening against the lip, then ` : "";
  const step: AssemblyStep = {
    step: 0,
    title: glaze ? `Set the ${glaze.name.toLowerCase()}, photo and backer into the spacer` : "Set the photo and backer into the spacer",
    description: `Frame face down. ${glazeTalk}lay the photo face down on it${backer ? ", then the backer over the spacer sticks. Tape it on with four tabs (lift them to change the photo), or glue its edge for good" : ""}.`,
    tips: "The spacer opening is the photo size, so each layer drops in square.",
    partsUsed: sheets.map((p) => p.name),
  };
  const out = [...steps];
  out.splice(at < 0 ? out.length - 1 : at + 1, 0, step);
  return out.map((s, i) => ({ ...s, step: i + 1 }));
}
