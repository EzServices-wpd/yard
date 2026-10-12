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
    const text = [built.project.name, ...built.project.notes, plan.feasibility?.summary ?? "", ...(plan.feasibility?.issues ?? []).map((i) => i.message), ...plan.instructions.map((s) => `${s.title} ${s.description}`)].join("\n");
    const hit = text.match(FITTED);
    if (hit) fail.push(`fitted wording "${hit[0]}" on a freestanding build`);
  }
  // Every part has a real step: no "not yet in a step" fallback.
  if (plan.instructions.some((s) => /not yet in a step/i.test(`${s.tips ?? ""} ${s.description}`))) fail.push("a part has only a fallback step");
  // A ring floats unless some other part reaches across its open centre to the rim (spokes, a web).
  for (const ring of panels.filter((p) => p.polygon?.holes?.length && recipe.parts.some((q) => q.shape === "ring" && (q.name === p.name || q.name === p.name.replace(/ \d+$/, ""))))) {
    const [a, b] = ring.polygon!.plane === "zy" ? (["z", "y"] as const) : ring.polygon!.plane === "xy" ? (["x", "y"] as const) : (["x", "z"] as const);
    const k = (ax: "x" | "y" | "z") => (ax === "x" ? "width" : ax === "y" ? "height" : "depth");
    const c = [ring.position[a] + ring.size[k(a)] / 2, ring.position[b] + ring.size[k(b)] / 2];
    const inner = ring.polygon!.holes![0].r;
    const reach = (p: (typeof panels)[number]) => {
      const lo = [p.position[a], p.position[b]], hi = [p.position[a] + p.size[k(a)], p.position[b] + p.size[k(b)]];
      const far = Math.hypot(Math.max(Math.abs(lo[0] - c[0]), Math.abs(hi[0] - c[0])), Math.max(Math.abs(lo[1] - c[1]), Math.abs(hi[1] - c[1])));
      const near = Math.hypot(Math.max(lo[0] - c[0], 0, c[0] - hi[0]), Math.max(lo[1] - c[1], 0, c[1] - hi[1]));
      return near < inner - 0.05 && far >= inner;
    };
    const ax3 = (["x", "y", "z"] as const).find((x) => x !== a && x !== b)!;
    const overlaps = (p: (typeof panels)[number]) => p.position[ax3] <= ring.position[ax3] + ring.size[k(ax3)] + 0.05 && ring.position[ax3] <= p.position[ax3] + p.size[k(ax3)] + 0.05;
    if (!panels.some((p) => p !== ring && overlaps(p) && reach(p) && !/^dowel-/.test(p.materialId))) fail.push(`${ring.name} floats: nothing joins its rim to the hub`);
  }
  // Names and roles: each part is its own named thing, not every part one role ("rail" for posts, axle and wheel).
  const roles = new Set(recipe.parts.map((p) => p.role));
  if (recipe.parts.length >= 3 && roles.size < 2) fail.push(`every part has the role "${[...roles][0]}"`);
  const dup = recipe.parts.map((p) => p.name.toLowerCase()).find((n, i, a) => a.indexOf(n) !== i);
  if (dup) fail.push(`two parts are both named "${dup}"`);
  // Notes agree with the geometry: a stock a note names is one the parts are cut from, and a counted
  // part ("9 rods", "4 legs") is built that many times.
  const used = panels.map((p) => getCatalogItem(p.materialId)?.name.toLowerCase() ?? "").join(" | ");
  for (const note of recipe.notes) {
    for (const m of note.toLowerCase().matchAll(/\b(\d x\d|\dx\d|plywood|dowels?)\b/g)) {
      const want = m[1].replace(/s$/, "").replace(/x/, "×");
      if (!used.includes(want) && !used.includes(m[1].replace(/s$/, ""))) fail.push(`note names ${m[1]} but no part is cut from it`);
    }
    for (const m of note.toLowerCase().matchAll(/\b(\d+)\s+([a-z]+?)s?\b/g)) {
      const n = Number(m[1]);
      const named = panels.filter((p) => p.name.toLowerCase().replace(/ \d+$/, "").split(" ").includes(m[2]));
      if (named.length && named.length !== n) fail.push(`note says ${n} ${m[2]}, the model has ${named.length}`);
    }
  }
  return [...new Set(fail)];
}
