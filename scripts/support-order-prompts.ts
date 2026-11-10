/**
 * The exact prompt set graded for support order.
 * src/lib/yard/supportOrder.prompts.json is this function's output, sorted.
 * The PR body lists movers and unresolved prompts from this set only,
 * using unresolvedFaults in supportOrder.ts as the only unresolved definition.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IDEAS } from "../src/lib/yard/ideas.ts";
import { RECIPES } from "../src/lib/yard/recipes.ts";
import { recipePrompt } from "../src/lib/yard/recipeIdeas.ts";
import { STRESS_PROMPTS } from "../src/lib/yard/stressPrompts.ts";
import { corpus } from "./invariants-corpus.ts";
import { SWEEPS } from "./class-sweep-prompts.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Benches the stock sweep adds on top of Ideas and recipes. */
const EXTRA = [
  "folding table",
  "folding table 6 foot",
  "8 foot folding table",
  "step stool",
  "storage bench",
  "shoe bench",
  "coat bench",
  "shoe bench 36 wide",
];

const STOCKS = ["", " from pvc", " from 3/4 inch dowel", " from 2x2"];

/**
 * Wordings a full sweep has to contain. Prefix stock ("2x2 shoe rack", "pvc mirror")
 * and suffix stock ("shoe rack from 2x2") are both real prompts, as are the
 * popsicle-stick catapult and the cedar garbage-bin 2x2 forms.
 */
export const SUPPORT_ORDER_NAMED = [
  "2x2 shoe rack",
  "shoe rack from 2x2",
  "popsicle stick catapult",
  "pvc mirror",
  "cedar garbage bin enclosure from 2x2",
  "cedar garbage bin enclosure from 2x2 for two bins",
  "cedar garbage bin enclosure for two bins from 2x2",
  "2x2 cedar garbage bin enclosure",
  "2x2 cedar garbage bin enclosure for two bins",
];

const norm = (q: string) => q.replace(/\s+/g, " ").trim();

/** Every prompt the support-order disclosure grades, in stable order. */
export function supportPromptSet(): string[] {
  const prompts = new Set<string>();
  const base = [...new Set([...IDEAS.map((i) => i.prompt), ...RECIPES.recipes.map(recipePrompt), ...EXTRA])];
  for (const b of base) for (const s of STOCKS) prompts.add(norm(`${b}${s}`));
  for (const p of corpus()) prompts.add(norm(p));
  for (const p of STRESS_PROMPTS) prompts.add(norm(p));
  for (const p of Object.values(SWEEPS).flatMap((s) => s.prompts)) prompts.add(norm(p));
  const dir = join(root, "evals/corpus");
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json") || f === "answer-keys.json") continue;
    const j = JSON.parse(readFileSync(join(dir, f), "utf8")) as {
      prompts?: { prompt?: string }[];
      canaries?: { prompt?: string }[];
    };
    for (const row of [...(j.prompts ?? []), ...(j.canaries ?? [])]) {
      if (row?.prompt) prompts.add(norm(row.prompt));
    }
  }
  for (const p of JSON.parse(readFileSync(join(root, "evals/prompts.json"), "utf8")).prompts as string[]) {
    prompts.add(norm(p));
  }
  const goldens = JSON.parse(readFileSync(join(root, "src/lib/yard/promptSnapshots.goldens.json"), "utf8")) as {
    prompt: string;
  }[];
  for (const g of goldens) prompts.add(norm(g.prompt));
  for (const p of SUPPORT_ORDER_NAMED) prompts.add(norm(p));
  return [...prompts].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
