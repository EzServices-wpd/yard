import assert from "node:assert/strict";
import { it } from "node:test";
import { RECIPES, rememberRecipe } from "./recipes.ts";
import { roughBlock } from "./recipeBuild.ts";
import { useYard } from "./store.ts";

it("a just-learned recipe wins over the closet fallback under the learning block (dog feeder stand on live)", () => {
  const p = "raised dog feeder stand";
  const s = useYard.getState();
  s.generate(p, undefined, undefined, { fresh: true });
  s.setProject({ ...roughBlock(p, useYard.getState().project), notes: [] });
  rememberRecipe({ ...RECIPES.recipes.find((r) => r.key === "abacus")!, key: "raised-dog-feeder-stand", title: "Raised Dog Feeder Stand", synonyms: [] });
  s.generate(p, undefined, undefined, { fresh: true });
  assert.equal(useYard.getState().project.kind, "custom");
  assert.equal(useYard.getState().project.name, "Raised Dog Feeder Stand");
});
