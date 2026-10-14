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
// Table rows name keys directly: "| ferris-wheel, glider (note) | FLAGGED |" (in ledger order, so later rows win).
const keys = new Set(store.recipes.map((r) => r.key));
for (const m of ledger.matchAll(/^\| (?:Seeds: )?([a-z0-9, ()-]+?(?:\([^)]*\))?[a-z0-9, ()-]*) \| (TRUSTED|FLAGGED)\b/gm)) {
  for (const k of m[1].replace(/\([^)]*\)/g, "").split(",").map((x) => x.trim())) if (keys.has(k)) verdicts.set(k, m[2] === "TRUSTED" ? "trusted" : "candidate");
}
for (const r of store.recipes) {
  const v = verdicts.get(r.key);
  // A FLAGGED verdict holds the recipe (off Ideas, Unverified when typed); TRUSTED unholds it.
  if (!v || (r.trust === v && (v === "trusted" ? !r.held : !!r.held))) continue;
  r.trust = v;
  if (v === "trusted") delete r.held;
  else r.held = "Critic FLAGGED";
  console.log(`${r.key}: ${v}`);
}
writeFileSync(file, JSON.stringify(store, null, 1) + "\n");
