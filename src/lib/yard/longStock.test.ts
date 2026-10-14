import { it } from "node:test";
import assert from "node:assert/strict";
import { getCatalogItem } from "./catalog.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan, longerLumber, overlongCuts } from "./report.ts";

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
