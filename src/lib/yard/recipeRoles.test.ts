import assert from "node:assert/strict";
import { it } from "node:test";
import { buildRecipe, validateRecipe } from "./recipeBuild";
import { buildPlan } from "./report";
import treb from "./fixtures/trebuchet.recipe.json";
import type { Recipe } from "./recipes";

it("recipe roles reach the cut list and Buy; the axle is a bought dowel; the arm is one 2x4", () => {
  const r = treb as unknown as Recipe;
  const b = buildRecipe(r, "trebuchet from 2x4");
  assert.deepEqual(validateRecipe(r, b, "trebuchet from 2x4"), []);
  const plan = buildPlan(b.project);
  const names = plan.cutList.map((c: { name?: string; label?: string }) => c.name ?? c.label ?? "");
  for (const n of ["Throwing arm", "Counterweight box", "Upright left"]) assert.ok(names.some((x) => x.includes(n)), `${n} in ${names.join("; ")}`);
  assert.ok(!names.some((x) => /^(?:Top|Upright|Rail|Brace|Leg)$/.test(x)), names.join("; "));
  assert.ok(plan.bom.some((x) => /Dowel/.test(x.name)), "axle dowel bought");
  const arm = b.project.panels.find((p) => p.name === "Throwing arm")!;
  assert.deepEqual([arm.size.width, arm.size.height].sort(), [1.5, 3.5]);
  assert.ok(b.project.notes.some((n) => /Throwing arm pivots on the axle/.test(n)));
});
