import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

describe("figure steps", () => {
  it("a figure shelf names its parts and skips closet pin lines", () => {
    for (const prompt of ["plywood cat bookshelf", "dachshund shelf"]) {
      const text = buildPlan(generateFromPrompt(prompt)).instructions.map((s) => `${s.title} ${s.description}`).join(" ");
      assert.doesNotMatch(text, /pin hole|back is already/i);
      assert.match(text, /parts on this list|parts on the bench/);
    }
    const tree = buildPlan(generateFromPrompt("cat tree")).instructions.map((s) => s.title).join(" ");
    assert.match(tree, /scratching post/);
  });
});
