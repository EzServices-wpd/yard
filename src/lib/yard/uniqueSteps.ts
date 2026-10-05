import { uniqueSteps as uniqueDefault } from "./steps";
import { uniqueTableSteps } from "./tableSteps";
import { jobFurnitureSteps } from "./jobFurniture";
import { placeEveryPart } from "./placeEveryPart";
import { classAnatomySteps } from "./classAnatomy";
import type { AssemblyStep, YardProject } from "./types";

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
  return placeEveryPart(project, withFrameStack(project, steps));
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
