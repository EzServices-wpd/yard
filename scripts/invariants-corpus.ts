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
  // Compact feet-inches (Critic #103 F1: "5ft6in" read as 6"): no space, no inch mark, and a lone inch mark.
  w: ["24 1/2", "24½", "24-1/2", "24.5", `2' 1/2"`, "2 ft 6 in", `2'6"`, "2ft6in", "2ft6", "30in"],
  d: ["12 1/2", "12½", "12-1/2", "12.5", `1' 1/2"`, "1 ft 2 in", `1'2"`, "1ft2in", "1ft2", "14in"],
  h: ["30 1/2", "30½", "30-1/2", "30.5", `2' 6 1/2"`, "2 ft 6 in", `2'6"`, "2ft6in", "2ft6", "30in"],
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
  // Critic #103 F1 shots pr-07 / pr-08: these built 6", 6" and 3".
  out.push("bookcase 5ft6in tall", "bookcase 5ft6 tall", "cabinet 2ft3in wide");
  // Too small to hold its parts (#103 F2, I38): refused, named, never built at zero or below. ('water wheel 1/2 wide'
  // keeps real parts since #90, so it is no I38 case; its overlap in a 1/2" model is an open fit class, logged for Critic.)
  out.push("bookcase 1/2 wide", "cabinet 1/2 wide", "shelf 1/4 wide", "bookcase 1 wide", "bookcase 1 deep", "bookcase 2 tall", "table 1/2 tall", "stool 1 wide", "abacus 1/2 tall", "kids tipi 1/2 wide");
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
/** Resized builds a class fix has broken before (#90): resized water wheels (I1) and counted rows (I30, I36). */
export const RESIZED = [
  "water wheel 24 wide", "water wheel 30 wide", "garden water wheel 24 wide",
  "abacus 2 wide", "abacus 3 wide", "abacus 4 wide", "abacus 6 wide", "abacus 8 wide", "abacus 8 wide 12 rods", "abacus 8 1/4 wide 12 rods",
  "abacus 10 wide 15 rods", "abacus 3 wide 3 rods", "abacus 30 rods",
  // Fractional typed widths take the same fit check (Critic #90e): built at the typed width, or refused below the minimum.
  "abacus 2 1/8 wide", "abacus 2 3/16 wide", "abacus 2 1/4 wide", "abacus 2 5/16 wide", "abacus 2 3/8 wide", "abacus 2 7/16 wide",
  "abacus 1 1/2 wide", "abacus 1 9/16 wide", "abacus 1 wide 1 rod", "abacus 1 1/4 wide 2 rods", "abacus 1 3/8 wide 1 rod",
  "abacus 2 1/8 wide 1 rod", "abacus 2 1/16 wide", "abacus 1 1/2 wide 5 rods", "abacus 1 1/2 wide 20 rods", "abacus 3 3/16 wide 3 rods",
];
export function corpus(): string[] {
  return [...new Set([...EVAL_PROMPTS, ...IDEAS.map((i) => i.prompt), ...DREAMS.map((d) => d.prompt), ...RECIPES.recipes.map((r) => recipePrompt(r)), ...seededSizes(), ...typedForms(), ...RESIZED])];
}
