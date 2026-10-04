import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { applyShopJoin, fastenerLines } from "./shopJoin";

describe("shop join changes Buy and steps", () => {
  const project = generateFromPrompt("bookcase 36 wide 60 tall 11 deep", "plywood-3-4-4x8");
  const screws = buildPlan(project);
  const screwText = screws.bom.map((b) => b.name).join(" | ") + screws.instructions.map((s) => s.description).join("\n");

  for (const join of ["pocket", "dowel", "biscuit", "glue"] as const) {
    it(`${join} changes Buy and steps`, () => {
      const next = applyShopJoin({ ...project, shopJoin: join }, buildPlan({ ...project, shopJoin: join }));
      const text = next.bom.map((b) => b.name).join(" | ") + next.instructions.map((s) => s.description).join("\n");
      assert.notEqual(text, screwText, `${join} left Buy and steps unchanged`);
      const lines = fastenerLines(project, join).map((b) => b.name).join(" ");
      if (join === "pocket") assert.match(lines, /Pocket-hole screws 1 1\/4/);
      if (join === "dowel") assert.match(lines, /dowels/);
      if (join === "biscuit") assert.match(lines, /#20 biscuits/);
      if (join === "glue") assert.match(lines, /glue/i);
      assert.doesNotMatch(lines, /#8 x 1-1\/4" wood screws/);
    });
  }

  it("dowels list wood glue once", () => {
    const next = applyShopJoin({ ...project, shopJoin: "dowel" }, buildPlan({ ...project, shopJoin: "dowel" }));
    const glue = next.bom.filter((b) => /glue/i.test(b.name));
    assert.equal(glue.length, 1);
  });
});

describe("thickness picker", () => {
  it("1/2 plywood changes the cut list and the screw length", () => {
    const thick = buildPlan(generateFromPrompt("bookshelf 36 wide", "plywood-3-4-4x8"));
    const half = buildPlan(generateFromPrompt("bookshelf 36 wide", "plywood-1-2-4x8"));
    assert.notEqual(
      thick.cutList.map((c) => c.thicknessIn).join(","),
      half.cutList.map((c) => c.thicknessIn).join(","),
    );
    assert.match(half.bom.map((b) => b.name).join("|"), /#8 x 1" wood screws/);
    assert.match(thick.bom.map((b) => b.name).join("|"), /1-1\/4/);
  });
});
