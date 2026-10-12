/**
 * The learned-recipe gate: a recipe the live site learned (recipe bot, `learned: true`) reaches main and the
 * Ideas library only when its default build passes support, cut list vs Buy agreement and wording checks.
 * Seed recipes keep the standard validateRecipe checks; this gate is what the bot's auto-merge waits on.
 */
import { getCatalogItem } from "./catalog";
import { buildRecipe, ROUND_WORD, validateRecipe } from "./recipeBuild";
import { recipePrompt } from "./recipeIdeas";
import type { Recipe } from "./recipes";
import { buildPlan } from "./report";

/** Buy lines that are not cut stock: fasteners, glue, finish, glides, hardware. */
const SUPPLY = /screw|nail|glue|bolt|nut|washer|hinge|glide|finish|stain|sandpaper|brad|pin|latch|hook|bracket|dowel|bead/i;
/** Fitted-build wording that a freestanding (non-wall) recipe must never print. */
const FITTED = /\bcloset\b|\bfootprint\b|\bopening\b/i;

export function learnedRecipeFailures(recipe: Recipe, prompt = recipePrompt(recipe)): string[] {
  const built = buildRecipe(recipe, prompt);
  const fail = validateRecipe(recipe, built, prompt);
  const { panels } = built.project;
  const plan = buildPlan(built.project);
  // Round things are drawn round: a wheel, bead, disc or drum part needs a round shape, not a box.
  for (const part of recipe.parts) if (!part.shape && ROUND_WORD.test(`${part.role} ${part.name}`)) fail.push(`${part.name}: a ${part.role} drawn as a box`);
  // Cut list vs Buy: every part is a real catalogue item, no member is a glue-up billed as one stick,
  // and every cut-stock Buy line is used by some part.
  for (const p of panels) {
    const it = getCatalogItem(p.materialId);
    if (!it) { fail.push(`${p.name}: no catalogue item (${p.materialId})`); continue; }
    if (it.category === "lumber" && it.dims.width && it.dims.height) {
      const [a, b] = [p.size.width, p.size.height, p.size.depth].sort((m, n) => m - n);
      if (a > it.dims.height + 0.01 && b > it.dims.width + 0.01) fail.push(`${p.name}: ${a.toFixed(2)}×${b.toFixed(2)} is wider than one ${it.name}`);
    }
  }
  const cutStock = new Set(plan.cutList.map((c) => c.material));
  for (const b of plan.bom) if (!SUPPLY.test(b.name) && !cutStock.has(b.name)) fail.push(`Buy ${b.name}: no part is cut from it`);
  // Wording: a freestanding recipe prints no closet / footprint / opening text.
  if (!recipe.wall) {
    const text = [built.project.name, ...built.project.notes, ...plan.instructions.map((s) => `${s.title} ${s.description}`)].join("\n");
    const hit = text.match(FITTED);
    if (hit) fail.push(`fitted wording "${hit[0]}" on a freestanding build`);
  }
  return [...new Set(fail)];
}
