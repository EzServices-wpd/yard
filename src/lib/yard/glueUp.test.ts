import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

// The saw step cuts a glue-up's layers, and a drawer is never treated as a lamination.
it("glue-ups: saw step cuts the layers; drawers are not laminations", () => {
  const ww = buildPlan(generateFromPrompt("water wheel")).instructions;
  assert.match(ww.find((s) => /^Cut /.test(s.title))!.description, /5 hub layers 3 7\/8 × 3 7\/8 × 3\/4"/);
  for (const q of ["pocket vanity", "dresser"]) {
    const g = buildPlan(generateFromPrompt(q)).instructions.find((s) => s.title === "Glue up the thick parts");
    assert.ok(!g || !/drawer/i.test(g.description), q);
  }
});
