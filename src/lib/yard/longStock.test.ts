import { it } from "node:test";
import assert from "node:assert/strict";
import { getCatalogItem } from "./catalog.ts";
import { boardSection } from "./recipeBuild.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan, cutStepCount, longerLumber, overlongCuts } from "./report.ts";

// A part longer than its board: buy the longer board if sold, else splice it with a step.
it("long stock: longer board when the catalogue has it, otherwise a splice step", () => {
  assert.equal(longerLumber(getCatalogItem("lumber-2x10-8")!, 120)?.id, "lumber-2x10-10");
  assert.equal(longerLumber(getCatalogItem("lumber-2x8-8")!, 120), undefined);
  const plan = buildPlan(generateFromPrompt("pergola"));
  assert.ok(overlongCuts(plan).some((c) => c.lengthIn === 120));
  const splice = plan.instructions.find((s) => s.title === "Splice the long members");
  assert.match(splice!.description, /120" rafter/);
  assert.ok(plan.instructions.findIndex((s) => s === splice) > plan.instructions.findIndex((s) => /^Cut\b/.test(s.title)));
  plan.instructions.forEach((s, i) => assert.equal(s.step, i + 1));
});

// The saw step counts what the cut list counts: the pergola's rafters are 16 glue layers in both.
it("cut step counts match the cut list; the splice step and Buy say the splice", () => {
  for (const q of ["pergola", "water wheel", "bookcase", "workbench", "linen closet"]) {
    const plan = buildPlan(generateFromPrompt(q));
    const n = cutStepCount(plan);
    if (n != null) assert.equal(n, plan.cutList.reduce((s, c) => s + c.quantity, 0), q);
  }
  const plan = buildPlan(generateFromPrompt("pergola"));
  assert.match(plan.instructions.find((s) => /^Cut the/.test(s.title))!.description, /8 Rafters 120 × 5 1\/2 × 1 1\/2"/);
  assert.match(plan.instructions.find((s) => /^Splice/.test(s.title))!.description, /Never splice mid-span/);
  assert.match(plan.bom.find((b) => b.catalogId === "lumber-2x6-8")!.notes!, /spliced/);
});

// Dimensional lumber is real board sizes: the pergola rafter is one 1 1/2 × 5 1/2 2×6; Buy adds the 12" lap per splice.
it("lumber members are real board sections; splices buy their overlap", () => {
  const project = generateFromPrompt("pergola");
  const rafter = project.panels.find((p) => p.name === "Rafter 1")!;
  assert.deepEqual([rafter.size.width, rafter.size.height].sort((a, b) => a - b), [1.5, 5.5]);
  const plan = buildPlan(project);
  assert.equal(plan.cutList.find((c) => c.name === "Rafter")!.quantity, 8);
  // 8 × 120" rafters spliced with a 12" lap: 8 full boards + 8 × 36" offcuts at two per board = 12.
  assert.equal(plan.bom.find((b) => b.catalogId === "lumber-2x6-8")!.quantity, 12);
  assert.equal(boardSection("lumber-2x6-8", { width: 1.8, height: 3.84, depth: 120 })?.height, 5.5);
  assert.equal(boardSection("lumber-2x8-8", { width: 120, height: 7.25, depth: 3.6 }), null); // a deliberate glue-up
});
