import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { buildPlan } from "../src/lib/yard/report.ts";
import { uniqueSteps } from "../src/lib/yard/steps.ts";
import { findInterference } from "../src/lib/yard/interference.ts";

test("twin bunk deck fits a 75 inch mattress and bearers stay under it", () => {
  const prompt = "twin bunk bed";
  const project = generateFromPrompt(prompt);
  const decks = project.panels.filter((p) => p.type === "deck");
  assert.equal(decks.length, 2);
  for (const deck of decks) {
    const length = Math.max(deck.size.width, deck.size.depth);
    const width = Math.min(deck.size.width, deck.size.depth);
    assert.ok(length >= 75, `deck length ${length} is short of a 75" twin`);
    assert.ok(width >= 38, `deck width ${width} is short of a twin`);
    const bearers = project.panels.filter(
      (p) => /bearer/i.test(p.name) && Math.abs(p.position.y + p.size.height - deck.position.y) < 0.05,
    );
    assert.ok(bearers.length >= 2, "person load needs bearers under the deck");
    for (const b of bearers) {
      assert.ok(b.position.y + b.size.height <= deck.position.y + 0.05, "bearer stands in the bed");
      assert.equal(b.materialId, "lumber-2x4-8");
    }
    const zs = bearers.map((b) => b.position.z).sort((a, c) => a - c);
    let prev = deck.position.z;
    const end = deck.position.z + deck.size.depth;
    for (const z of zs) {
      assert.ok(z - prev <= 21, `unsupported run ${z - prev}" under ${deck.name}`);
      prev = z;
    }
    assert.ok(end - prev <= 21, `unsupported run ${end - prev}" at the foot of ${deck.name}`);
  }
  assert.equal(findInterference(project).length, 0);
  const steps = uniqueSteps(project);
  const set = steps.find((s) => /sleep platform/i.test(s.title));
  assert.ok(set);
  assert.match(set.description, /bearer/i);
  assert.match(set.description, /not in the sleeping surface/i);
  const guards = steps.find((s) => /guard/i.test(s.title));
  assert.ok(guards);
  assert.doesNotMatch(guards.description, /bearer/i);
  const plan = buildPlan(project);
  const buy = JSON.stringify(plan.bom);
  assert.match(buy, /2x4|2×4/i);
});
