import { uniqueSteps as uniqueDefault } from "./steps";
import { uniqueTableSteps } from "./tableSteps";
import { jobFurnitureSteps } from "./jobFurniture";
import { placeEveryPart } from "./placeEveryPart";
import type { AssemblyStep, YardProject } from "./types";

export function uniqueSteps(project: YardProject): AssemblyStep[] {
  const raw = (project.notes ?? []).some((n) => /no craft stock was named/.test(n))
    ? jobFurnitureSteps(project)
    : project.fitted?.program === "table" ? uniqueTableSteps(project) : uniqueDefault(project);
  const display = (project.notes ?? []).some((n) => /display model/i.test(n));
  const steps = raw
    .filter((s) => !/^Do not cut\b/i.test(s.title))
    .map((s) => display && /^(Sit on it|Load it|Stand on it)$/i.test(s.title)
      ? { ...s, title: "Set it on display", description: "This is a display model. Set it on a shelf. Do not sit on it, load it, or stand on it." }
      : s);
  return placeEveryPart(project, steps);
}
