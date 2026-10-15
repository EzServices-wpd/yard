/** The invariant corpus: every built-in idea, learned recipe and eval prompt, plus seeded random sizes. */
import { readFileSync } from "node:fs";
import { IDEAS } from "../src/lib/yard/ideas.ts";
import { DREAMS } from "../src/lib/yard/promptDreams.ts";
import { RECIPES } from "../src/lib/yard/recipes.ts";
import { recipePrompt } from "../src/lib/yard/recipeIdeas.ts";

export const EVAL_PROMPTS: string[] = JSON.parse(readFileSync(new URL("../evals/prompts.json", import.meta.url), "utf8")).prompts;

/** Mulberry32: the same sizes on every run and every machine. */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const SIZED: [string, [number, number], [number, number], [number, number]][] = [
  ["bookcase", [18, 72], [30, 96], [8, 16]],
  ["desk", [36, 72], [28, 31], [20, 32]],
  ["bench", [30, 72], [16, 20], [12, 18]],
  ["wall cabinet", [16, 36], [20, 36], [8, 14]],
  ["coffee table", [30, 60], [16, 20], [18, 30]],
  ["nightstand", [14, 24], [22, 30], [14, 20]],
  ["corner bookshelf", [24, 60], [36, 84], [24, 48]],
  ["mudroom bench", [30, 60], [16, 20], [14, 18]],
];
export function seededSizes(seed = 20261015, perNoun = 2): string[] {
  const r = rng(seed);
  const pick = ([a, b]: [number, number]) => Math.round((a + r() * (b - a)) * 2) / 2;
  return SIZED.flatMap(([noun, w, h, d]) => Array.from({ length: perNoun }, () => `${noun} ${pick(w)} wide ${pick(h)} tall ${pick(d)} deep`));
}
export function corpus(): string[] {
  return [...new Set([...EVAL_PROMPTS, ...IDEAS.map((i) => i.prompt), ...DREAMS.map((d) => d.prompt), ...RECIPES.recipes.map((r) => recipePrompt(r)), ...seededSizes()])];
}
