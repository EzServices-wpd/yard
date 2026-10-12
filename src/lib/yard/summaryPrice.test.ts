import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

// The summary line and Check card price is the Buy total.
for (const q of ["abacus", "water wheel", "coat rack", "linen closet 31.5 wide 78 tall 16 deep"]) {
  it(`${q}: summary price = Buy total`, () => {
    const pl = buildPlan(generateFromPrompt(q));
    const sum = pl.bom.reduce((t, b) => t + (b.estimatedCost ?? 0), 0);
    const m = pl.feasibility.summary.match(/~\$([\d,.]+)/);
    assert.ok(m, pl.feasibility.summary);
    assert.ok(Math.abs(Number(m![1].replace(/,/g, "")) - sum) < 0.51, `${m![1]} vs ${sum}`);
  });
}
