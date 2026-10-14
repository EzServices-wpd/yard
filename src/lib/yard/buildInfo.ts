import { learnedRecipeFailures } from "./learnedGate";
import { findRecipe, RECIPES } from "./recipes";
import type { YardProject } from "./types";

/** The checks every recipe build runs before it is saved (learnedGate.ts); named for the "How this was built" panel. */
export const GATE_CHECKS = ["Recipe shape and defining parts", "Every part is real stock", "Cut list matches Buy", "Plain wording", "Every part has a step", "Round parts drawn round", "Hinged parts meet their edge"];

export type BuildInfo = { source: "Built-in shape" | "Saved recipe" | "New lookup" | "Placeholder"; trust: "Trusted" | "Unverified"; passed: string[]; failed: string[] };

/** Where the bench build came from and how far to trust it. Reads local data only: no AI, no network. */
export function buildInfo(project: Pick<YardProject, "prompt" | "typedPrompt" | "notes" | "displayOnly">): BuildInfo {
  const prompt = project.typedPrompt || project.prompt;
  if (project.displayOnly) return { source: "Placeholder", trust: "Unverified", passed: [], failed: ["Not learned yet"] };
  const recipe = findRecipe(prompt);
  if (!recipe) return { source: "Built-in shape", trust: "Trusted", passed: ["Yard engine guards (run on every release)"], failed: [] };
  const failed = learnedRecipeFailures(recipe, prompt);
  const saved = RECIPES.recipes.some((r) => r.key === recipe.key);
  const unverified = recipe.trust !== "trusted" || !!recipe.held || failed.length > 0 || /^Unverified:/.test(project.notes?.[0] ?? "");
  return { source: saved ? "Saved recipe" : "New lookup", trust: unverified ? "Unverified" : "Trusted", passed: failed.length ? [] : GATE_CHECKS, failed };
}
