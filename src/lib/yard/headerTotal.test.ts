import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

// The header price is the sum of the Buy rows for every build, dowels and hooks included.
for (const q of ["water wheel", "abacus", "coat rack", "pocket vanity", "bookshelf"]) {
  it(`${q}: header equals Buy rows`, () => {
    const plan = buildPlan(generateFromPrompt(q));
    const sum = plan.bom.reduce((t, b) => t + (b.estimatedCost ?? 0), 0);
    assert.ok(Math.abs(plan.totals.estCostUsd - sum) < 0.01, `${plan.totals.estCostUsd} vs ${sum}`);
  });
}
