import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findRecipe, gradeRecipe, normalizeNoun, parseRecipe, saveRecipe, type Recipe, type RecipeStore } from "./recipes.ts";

const bin: Recipe = {
  key: "compost-bin", synonyms: ["compost bay", "compost box"], version: 1, trust: "candidate", title: "Compost bin",
  size: { width: 36, height: 36, depth: 36 }, outdoor: true, count: { word: "bays", default: 1 },
  parts: [{ role: "post", name: "Post", box: [0, 0, 0, 0.1, 1, 0.1], kind: "member" }], notes: [],
};
const lib: RecipeStore = { schema: 1, recipes: [bin] };

describe("recipe store", () => {
  it("normalizes the noun", () => assert.equal(normalizeNoun("cedar compost bin, 3 bays 36 wide"), "cedar compost bin bays"));
  it("finds by key and synonyms", () => {
    assert.equal(findRecipe("cedar compost bin 3 bays", lib)?.key, "compost-bin");
    assert.equal(findRecipe("a compost box", lib)?.key, "compost-bin");
    assert.equal(findRecipe("bookshelf", lib), null);
  });
  it("modifiers gate a match", () => {
    const plane = { ...bin, key: "toy-airplane", synonyms: [], modifiers: ["propeller"] };
    assert.equal(findRecipe("toy airplane", { schema: 1, recipes: [plane] }), null);
    assert.equal(findRecipe("toy airplane with propeller", { schema: 1, recipes: [plane] })?.key, "toy-airplane");
  });
  it("grades promote and demote; saves version up as a candidate", () => {
    const up = gradeRecipe(lib, "compost-bin", "pass");
    assert.equal(up.recipes[0].trust, "trusted");
    const down = gradeRecipe(up, "compost-bin", "fail");
    assert.deepEqual([down.recipes[0].trust, down.recipes[0].version], ["candidate", 2]);
    assert.deepEqual([saveRecipe(up, bin).recipes[0].version, saveRecipe(up, bin).recipes[0].trust], [2, "candidate"]);
  });
  it("parses only a complete recipe", () => {
    assert.ok(parseRecipe(bin));
    assert.equal(parseRecipe({ ...bin, parts: [] }), null);
    assert.equal(parseRecipe({ ...bin, parts: [{ ...bin.parts[0], on: ["Nope"] }] }), null);
  });
});
