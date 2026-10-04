import { uniqueSteps as uniqueDefault } from "./steps";
import { uniqueTableSteps } from "./tableSteps";
import { placeEveryPart } from "./placeEveryPart";
import type { AssemblyStep, YardProject } from "./types";

export function uniqueSteps(project: YardProject): AssemblyStep[] {
  const steps = project.fitted?.program === "table" ? uniqueTableSteps(project) : uniqueDefault(project);
  return placeEveryPart(project, steps);
}
