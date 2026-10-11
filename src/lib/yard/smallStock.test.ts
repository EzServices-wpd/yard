import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

it("small parts buy the smallest real sheet that yields them", () => {
  const plan = buildPlan(generateFromPrompt("wall shelf"));
  assert.ok(plan.bom.some((b) => b.catalogId === "plywood-3-4-2x4"));
  assert.ok(!plan.bom.some((b) => b.catalogId === "plywood-3-4-4x8"));
  assert.ok(plan.cutList.filter((c) => /Plywood/.test(c.material)).every((c) => /Project Panel/.test(c.material)));
});
it("a build that needs a full sheet still buys one", () => {
  const plan = buildPlan(generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep"));
  assert.ok(!plan.bom.some((b) => b.catalogId === "plywood-3-4-2x4"));
});
