import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

const buy = (q: string) => buildPlan(generateFromPrompt(q));
it("baby gate: the hinges and latch the notes hang it on are drawn and bought", () => {
  const p = generateFromPrompt("baby gate");
  const b = buildPlan(p).bom.map((x) => x.name).join("|");
  assert.equal(p.panels.filter((x) => /^Hinge \d+$/.test(x.name)).length, 2);
  assert.ok(p.panels.some((x) => /^Latch \d+$/.test(x.name)));
  assert.match(b, /hinge/i);
  assert.match(b, /latch/i);
});
it("swing set: brackets are drawn, the legs stand as legs, no indoor glue", () => {
  const p = generateFromPrompt("swing set");
  assert.equal(p.panels.filter((x) => /^A-frame bracket \d+$/.test(x.name)).length, 2);
  const plan = buildPlan(p);
  assert.ok(!plan.bom.some((x) => /^wood glue$/i.test(x.name)), "no indoor glue on an outdoor frame");
  assert.ok(!plan.instructions.some((s) => /main box/i.test(s.title)));
});
it("coat closet buys no hooks it does not draw", () => {
  assert.ok(!buy("coat closet").bom.some((x) => /hook/i.test(x.name)));
});
