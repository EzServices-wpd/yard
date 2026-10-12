import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

it("frame-and-panel doors: one panel stock, captured panel, glue-up before hanging, assembled door hung, no fallback steps", () => {
  const p = generateFromPrompt("pocket vanity with shaker fronts");
  const plan = buildPlan(p);
  const panel = plan.cutList.find((c) => /shaker panel/i.test(c.name))!;
  assert.equal(panel.thicknessIn, 0.25);
  assert.match(panel.notes ?? "", /groove/);
  const steps = plan.instructions.map((s) => `${s.title}: ${s.description}`);
  const glue = steps.findIndex((s) => /^Glue up the \d+ frame-and-panel door/.test(s));
  const hang = steps.findIndex((s) => /^Hang \d+ doors?/.test(s));
  assert.ok(glue >= 0 && glue < hang);
  assert.match(steps[hang], /Shaker door — 48 × 18 3\/4/);
  assert.ok(!/stile — 48/.test(steps[hang]));
  assert.ok(!plan.instructions.some((s) => /Shaker (?:panel|rail|stile)/i.test(s.title)));
  assert.equal(plan.cutList.find((c) => c.name === "Upright")?.material, '3/4" Plywood 4×10');
});

it("vanity wording: thin parts named for what they are, the door glue-up has no carcase placement, recessed panels are never called flush", () => {
  const plan = buildPlan(generateFromPrompt("pocket vanity with shaker fronts"));
  assert.ok(!plan.bom.some((b) => /thin back panels \([^)]*E/.test(b.notes ?? "")));
  const glue = plan.instructions.find((s) => /^Glue up the \d+ frame-and-panel/.test(s.title))!;
  assert.ok(!/Where:/.test(glue.description));
  assert.ok(!plan.instructions.some((s) => /flush with[^.]*shaker panels/i.test(s.description)));
  assert.ok(!plan.instructions.some((s) => /Drive 0 /.test(s.description)));
});
