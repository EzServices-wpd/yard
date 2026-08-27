import { uniqueSteps as uniqueDefault } from "./steps";
import { uniqueTableSteps } from "./tableSteps";
import type { AssemblyStep, YardProject } from "./types";

export function uniqueSteps(project: YardProject): AssemblyStep[] {
  if (project.fitted?.program === "table") return uniqueTableSteps(project);
  return uniqueDefault(project);
}
