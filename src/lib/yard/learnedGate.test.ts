import assert from "node:assert/strict";
import { it } from "node:test";
import { RECIPES } from "./recipes.ts";
import { learnedRecipeFailures } from "./learnedGate.ts";

it("learned gate: the Critic-failed water wheel and abacus fail it; a learned recipe is flagged apart from seeds", () => {
  const get = (k: string) => RECIPES.recipes.find((r) => r.key === k)!;
  assert.ok(learnedRecipeFailures(get("water-wheel")).some((f) => /wider than one|footprint/.test(f)));
  assert.ok(learnedRecipeFailures(get("abacus")).some((f) => /no catalogue item/.test(f)));
  assert.ok(RECIPES.recipes.filter((r) => r.learned).every((r) => r.trust === "candidate"));
});
