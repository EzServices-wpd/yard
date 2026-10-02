import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { buildPlan } from "../src/lib/yard/report.ts";

function stockLine(prompt: string, catalogId: string) {
  const plan = buildPlan(generateFromPrompt(prompt));
  const line = plan.bom.find((b) => b.catalogId === catalogId);
  assert.ok(line, catalogId);
  return line;
}

test("garden arch buys 10 ft PVC by the stick, not one pipe per cut", () => {
  const line = stockLine("6 foot garden arch from 3/4 inch PVC pipe", "pvc-3-4-sch40");
  assert.equal(line.unit, "ea");
  assert.ok(line.quantity < 18, `expected shared sticks, got ${line.quantity}`);
  assert.ok(line.quantity >= 4, `four 45 in legs need at least two sticks, got ${line.quantity}`);
  assert.match(line.notes ?? "", /from \d+ whole sticks/);
});

test("6 ft 2x4 ladder shares studs for the rungs", () => {
  const line = stockLine("6 foot ladder from 2x4", "lumber-2x4-8");
  assert.equal(line.quantity, 3, "a 72 in rail shares a stud with an 18 in rung; the rest fit in one more");
  assert.match(line.notes ?? "", /from 3 whole sticks/);
});
