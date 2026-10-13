/**
 * Lands Critic's verdicts in recipes.json: the latest "<Name> — TRUSTED|FLAGGED" line per recipe in the
 * ledger sets its trust. Usage: npx tsx scripts/apply-ledger.ts [/workspace/learned-recipes/LEDGER.md]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { findRecipe, type RecipeStore } from "../src/lib/yard/recipes";

const ledger = readFileSync(process.argv[2] ?? "/workspace/learned-recipes/LEDGER.md", "utf8");
const file = new URL("../src/lib/yard/recipes.json", import.meta.url);
const store = JSON.parse(readFileSync(file, "utf8")) as RecipeStore;
const verdicts = new Map<string, "trusted" | "candidate">();
for (const m of ledger.matchAll(/^- [^\n]*· ([^·\n]+?) — (TRUSTED|FLAGGED)\b/gm)) {
  const r = findRecipe(m[1].replace(/\(.*?\)/g, "").trim(), store);
  if (r) verdicts.set(r.key, m[2] === "TRUSTED" ? "trusted" : "candidate");
}
for (const r of store.recipes) {
  const v = verdicts.get(r.key);
  if (!v || r.trust === v) continue;
  r.trust = v;
  if (v === "trusted") delete r.held;
  console.log(`${r.key}: ${v}`);
}
writeFileSync(file, JSON.stringify(store, null, 1) + "\n");
