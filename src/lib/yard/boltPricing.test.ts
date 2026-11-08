import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

describe("carriage bolts from notes are sized and priced; PT stock is named the same everywhere", () => {
  const p = generateFromPrompt("picnic table");
  const plan = buildPlan(p);
  it("picnic: 18 3/8 x 4-1/2 galvanized carriage bolts with nut and washer, priced, inside the total", () => {
    const b = plan.bom.find((x) => /carriage bolt/i.test(x.name));
    assert.ok(b && /3\/8" × 4-1\/2" galvanized/.test(b.name) && /nut and washer/.test(b.name));
    assert.equal(b.quantity, 18);
    assert.ok((b.estimatedCost ?? 0) > 0);
    const sum = Math.round(plan.bom.reduce((t, x) => t + (x.estimatedCost ?? 0), 0) * 100) / 100;
    assert.ok(Math.abs(sum - plan.totals.estCostUsd) < 0.02);
  });
  it("every Buy line that names hardware has a price", () => {
    for (const q of ["picnic table", "30 inch stool with handrail"]) for (const x of buildPlan(generateFromPrompt(q)).bom) if (/bolt/i.test(x.name)) assert.ok((x.estimatedCost ?? 0) > 0, `${q}: ${x.name}`);
  });
  it("picnic: cut list and step 2 name the PT stock Buy prices", () => {
    const mats = new Set(plan.cutList.map((c) => c.material));
    assert.deepEqual([...mats].sort(), ["2×4 pressure-treated (8 ft)", "2×6 pressure-treated (8 ft)"]);
    const text = plan.instructions.map((s) => `${s.title} ${s.description}`).join(" ");
    assert.doesNotMatch(text, /2×4 Stud \(8 ft\)|2×6 \(8 ft\)/);
    for (const m of mats) assert.ok(plan.bom.some((b) => b.name === m));
  });
});
