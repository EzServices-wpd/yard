/**
 * The Ideas library grows from the recipe store: every trusted or passing recipe is a card, drawn from
 * the model Yard builds for it (no photos, no links). A recipe that fails its checks stays off the list.
 */
import { buildRecipe, validateRecipe } from "./recipeBuild";
import { RECIPES, type Recipe } from "./recipes";
import type { Panel } from "./types";
import COUNTS from "./promptCounts.json";

export type RecipeIdea = { id: string; label: string; prompt: string; size: string; blurb: string; panels: Panel[]; box: { width: number; height: number; depth: number } };

const inch = (n: number) => `${Math.round(n * 4) / 4}″`;

export function recipePrompt(r: Recipe): string {
  return [r.key.replace(/-/g, " "), ...(r.modifiers ?? []).map((m) => `with ${m}`)].join(" ");
}

export function recipeIdeas(recipes: Recipe[] = RECIPES.recipes): RecipeIdea[] {
  const out: RecipeIdea[] = [];
  for (const r of recipes) {
    if (r.held) continue;
    const prompt = recipePrompt(r);
    const built = buildRecipe(r, prompt);
    if (r.trust !== "trusted" && validateRecipe(r, built, prompt).length) continue;
    const s = built.size;
    out.push({ id: `recipe-${r.key}`, label: r.title, prompt, size: `${inch(s.width)} W × ${inch(s.depth)} D × ${inch(s.height)} H`, blurb: r.notes[0] ?? "", panels: built.project.panels, box: s });
  }
  return out;
}

/** How many cards the Popular recently feed shows. */
export const POPULAR_CAP = 12;

/** Popular recently: passing recipe builds ranked by prompt count (promptCounts.json, updated on the bot PR),
 * one card per head noun, capped. Ties keep store order. */
export function popularIdeas(counts: Record<string, number> = (COUNTS as { counts: Record<string, number> }).counts, recipes: Recipe[] = RECIPES.recipes): RecipeIdea[] {
  const rank = new Map(recipes.map((r, i) => [r.key, i]));
  const seen = new Set<string>();
  return recipeIdeas(recipes)
    .map((d) => ({ d, key: d.id.slice(7) }))
    .sort((a, b) => (counts[b.key] ?? 0) - (counts[a.key] ?? 0) || (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0))
    .filter(({ key }) => { const noun = key.split("-").slice(-1)[0]; if (seen.has(noun)) return false; seen.add(noun); return true; })
    .slice(0, POPULAR_CAP)
    .map(({ d }) => d);
}

/** Isometric faces of each part, back to front, in a unit view box: the card thumbnail. */
export function isoFaces(panels: Panel[], box: { width: number; height: number; depth: number }): { d: string; shade: number }[] {
  const c = Math.cos(Math.PI / 6), sn = 0.5;
  const P = (x: number, y: number, z: number): [number, number] => [(x - z) * c, (x + z) * sn - y];
  const corners = panels.flatMap((p) => [P(p.position.x, p.position.y, p.position.z), P(p.position.x + p.size.width, p.position.y + p.size.height, p.position.z + p.size.depth), P(p.position.x + p.size.width, p.position.y, p.position.z), P(p.position.x, p.position.y, p.position.z + p.size.depth), P(p.position.x, p.position.y + p.size.height, p.position.z)]);
  if (!corners.length) return [];
  const xs = corners.map((q) => q[0]), ys = corners.map((q) => q[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), k = 100 / Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0, 1e-6);
  const path = (pts: [number, number, number][]) => "M" + pts.map(([x, y, z]) => { const [u, v] = P(x, y, z); return `${((u - x0) * k).toFixed(1)},${((v - y0) * k).toFixed(1)}`; }).join("L") + "Z";
  const order = [...panels].sort((a, b) => a.position.x + a.position.z - a.position.y * 0.01 - (b.position.x + b.position.z - b.position.y * 0.01));
  void box;
  return order.flatMap((p) => {
    const { x, y, z } = p.position, { width: w, height: h, depth: d } = p.size;
    return [
      { d: path([[x, y + h, z], [x + w, y + h, z], [x + w, y + h, z + d], [x, y + h, z + d]]), shade: 0 },
      { d: path([[x, y, z + d], [x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d]]), shade: 1 },
      { d: path([[x + w, y, z], [x + w, y, z + d], [x + w, y + h, z + d], [x + w, y + h, z]]), shade: 2 },
    ];
  });
}
