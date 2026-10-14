/** Learned-recipe gate (CI, every push and recipe-bot PR): each learned recipe not held must pass. */
import { RECIPES } from "../src/lib/yard/recipes.ts";
import { learnedRecipeFailures } from "../src/lib/yard/learnedGate.ts";
import { shadowsBuiltIn, generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { buildInfo } from "../src/lib/yard/buildInfo.ts";

let bad = 0;
for (const r of RECIPES.recipes.filter((x) => x.learned)) {
  // A recipe for a noun the engine builds itself never builds: rejected at merge, held or not.
  if (shadowsBuiltIn(r)) { bad++; console.log(`FAIL ${r.key}: the engine builds "${r.key.replace(/-/g, " ")}" itself (shadowed key)`); continue; }
  const f = learnedRecipeFailures(r);
  if (r.held) { console.log(`HELD ${r.key} (${f.length} open: ${f.slice(0, 3).join("; ")})`); continue; }
  if (f.length) { bad++; console.log(`FAIL ${r.key}: ${f.join("; ")}`); } else console.log(`PASS ${r.key}`);
}
// Only graded recipes say Trusted: every ungraded key builds Unverified.
for (const r of RECIPES.recipes.filter((x) => x.trust !== "trusted")) {
  const q = r.key.replace(/-/g, " ");
  if (buildInfo(generateFromPrompt(q)).trust === "Trusted") { bad++; console.log(`FAIL ${r.key}: ungraded but labelled Trusted`); }
}
if (bad) process.exit(1);
console.log("LEARNED RECIPES OK");
