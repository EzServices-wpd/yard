/** Learned-recipe gate (CI, every push and recipe-bot PR): each learned recipe not held must pass. */
import { RECIPES } from "../src/lib/yard/recipes.ts";
import { learnedRecipeFailures } from "../src/lib/yard/learnedGate.ts";

let bad = 0;
for (const r of RECIPES.recipes.filter((x) => x.learned)) {
  const f = learnedRecipeFailures(r);
  if (r.held) { console.log(`HELD ${r.key} (${f.length} open: ${f.slice(0, 3).join("; ")})`); continue; }
  if (f.length) { bad++; console.log(`FAIL ${r.key}: ${f.join("; ")}`); } else console.log(`PASS ${r.key}`);
}
if (bad) process.exit(1);
console.log("LEARNED RECIPES OK");
