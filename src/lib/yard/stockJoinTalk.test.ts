import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

test("assembly fastener follows the picked stock join", () => {
  const p = generateFromPrompt("credenza 54 wide 28 tall 16 deep from corrugated cardboard");
  const plan = buildPlan(p);
  const text = plan.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
  assert.match(p.primaryMaterialId ?? "", /cardboard/);
  assert.equal(Math.round(p.overall.width), 54);
  assert.doesNotMatch(text, /Screw through/);
  assert.match(text, /Tape or glue/);
});
