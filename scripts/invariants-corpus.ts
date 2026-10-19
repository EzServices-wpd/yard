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
/**
 * I35 typed forms: every shop way of writing a size, on each axis alone and inside a W x D x H string
 * (live 10-19: "shelf 24 1/2\" wide" built 2" wide).
 */
const FORMS: Record<"w" | "d" | "h", string[]> = {
  w: ["24 1/2", "24½", "24-1/2", "24.5", `2' 1/2"`, "2 ft 6 in", `2'6"`],
  d: ["12 1/2", "12½", "12-1/2", "12.5", `1' 1/2"`, "1 ft 2 in", `1'2"`],
  h: ["30 1/2", "30½", "30-1/2", "30.5", `2' 6 1/2"`, "2 ft 6 in", `2'6"`],
};
export function typedForms(nouns = ["shelf", "bookcase", "cabinet"]): string[] {
  const out: string[] = [];
  for (const noun of nouns) {
    for (const f of FORMS.w) out.push(`${noun} ${f} wide`, `${noun} ${f} x 12 x 30`);
    for (const f of FORMS.d) out.push(`${noun} ${f} deep`, `${noun} 24 x ${f} x 30`);
    for (const f of FORMS.h) out.push(`${noun} ${f} tall`, `${noun} 24 x 12 x ${f}`);
  }
  // Key prompts that read as 2, 2, 2, 2 and 8 on main 49aa20f (answer keys 10-19).
  out.push("nightstand 22 1/2 wide", "nightstand 22-1/2 wide", `nightstand 22 1/2" wide`, "bookshelf 75 1/2 tall", "table 92 5/8 long");
  return out;
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
  return [...new Set([...EVAL_PROMPTS, ...IDEAS.map((i) => i.prompt), ...DREAMS.map((d) => d.prompt), ...RECIPES.recipes.map((r) => recipePrompt(r)), ...seededSizes(), ...typedForms()])];
}
