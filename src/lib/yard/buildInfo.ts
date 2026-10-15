import { learnedRecipeFailures } from "./learnedGate";
import { findRecipe, RECIPES } from "./recipes";
import { shadowsBuiltIn } from "./promptMain";
import type { YardProject } from "./types";

/** The checks every recipe build runs before it is saved (learnedGate.ts); named for the "How this was built" panel. */
export const GATE_CHECKS = ["Recipe shape and defining parts", "Every part is real stock", "Cut list matches Buy", "Plain wording", "Every part has a step", "Round parts drawn round", "Hinged parts meet their edge"];

/** Built-in shapes Critic FLAGGED: Unverified until a regrade clears them (remove the entry then). */
export const FLAGGED_BUILT_INS: { test: RegExp; why: string }[] = [
  { test: /\bpicnic\s+tables?\b/i, why: "Critic flagged it: waiting on a regrade" },
];

export type BuildInfo = { source: "Built-in shape" | "Saved recipe" | "New lookup" | "Placeholder"; trust: "Trusted" | "Unverified"; passed: string[]; failed: string[] };

/** Where the bench build came from and how far to trust it. Reads local data only: no AI, no network. */
export function buildInfo(project: Pick<YardProject, "prompt" | "typedPrompt" | "notes" | "displayOnly"> & Partial<Pick<YardProject, "supportOffer">>): BuildInfo {
  const info = baseInfo(project);
  // A span warning that is still up means the build is not done: never show Trusted beside it.
  const spanOpen = project.supportOffer?.kind === "span" && project.supportOffer.needed && !project.supportOffer.included;
  if (spanOpen && info.trust === "Trusted") return { ...info, trust: "Unverified", failed: [...info.failed, "A shelf spans too far: press Add support"] };
  return info;
}

function baseInfo(project: Pick<YardProject, "prompt" | "typedPrompt" | "notes" | "displayOnly">): BuildInfo {
  const prompt = project.typedPrompt || project.prompt;
  if (project.displayOnly) return { source: "Placeholder", trust: "Unverified", passed: [], failed: ["Not learned yet"] };
  const recipe = findRecipe(prompt);
  // A learned recipe the engine shadows is ignored: what builds is the built-in shape.
  // Trusted only once graded: a built-in shape whose noun has an ungraded or flagged recipe (e.g. toy airplane) is Unverified.
  const ungraded = RECIPES.recipes.some((r) => r.trust !== "trusted" && findRecipe(prompt, { ...RECIPES, recipes: [{ ...r, modifiers: [] }] }));
  const flagged = FLAGGED_BUILT_INS.find((f) => f.test.test(prompt));
  if ((!recipe || shadowsBuiltIn(recipe, prompt)) && flagged) return { source: "Built-in shape", trust: "Unverified", passed: ["Yard engine guards (run on every release)"], failed: [flagged.why] };
  if (!recipe || shadowsBuiltIn(recipe, prompt)) return { source: "Built-in shape", trust: ungraded ? "Unverified" : "Trusted", passed: ["Yard engine guards (run on every release)"], failed: ungraded ? ["Not graded yet"] : [] };
  const failed = learnedRecipeFailures(recipe, prompt);
  const saved = RECIPES.recipes.some((r) => r.key === recipe.key);
  const unverified = recipe.trust !== "trusted" || !!recipe.held || failed.length > 0 || /^Unverified:/.test(project.notes?.[0] ?? "");
  return { source: saved ? "Saved recipe" : "New lookup", trust: unverified ? "Unverified" : "Trusted", passed: failed.length ? [] : GATE_CHECKS, failed };
}
