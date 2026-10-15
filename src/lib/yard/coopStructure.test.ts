import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { placementIndex } from "./placeEveryPart.ts";

// Real-structure class (coop): a chicken coop is not a box on legs. It needs a door, a nest box, a roost
// higher than the nest, and hardware cloth, all in the model, Buy and steps.
describe("chicken coop real structure", () => {
  const p = generateFromPrompt("chicken coop");
  const plan = buildPlan(p);
  const named = (re: RegExp) => p.panels.filter((x) => re.test(x.name));
  const text = [...p.notes, ...plan.instructions.map((s) => s.description)].join(" ");
  it("has a pop door in the front with its stile, hinges and a barrel bolt on Buy", () => {
    const [door] = named(/^Pop door$/);
    assert.ok(door && door.position.z === 0 && door.size.width >= 10 && door.size.height >= 12);
    assert.equal(named(/^Door stile$/).length, 1);
    assert.equal(plan.bom.find((b) => /butt hinge/.test(b.name))?.quantity, 4);
    assert.ok(plan.bom.some((b) => /barrel bolt/.test(b.name) && (b.estimatedCost ?? 0) > 0));
  });
  it("has a 12in nest box on the floor and a flat 2x4 roost on cleats, higher than the nest", () => {
    const top = named(/^Nest box top$/)[0];
    const roost = named(/^Roost$/)[0];
    assert.ok(top && named(/^Nest box (side|lip)$/).length === 2);
    assert.ok(roost && roost.materialId === "lumber-2x4-8" && roost.size.depth === 3.5 && roost.size.height === 1.5);
    assert.ok(roost.position.y > top.position.y + top.size.height, "roost above the nest");
    assert.equal(named(/^Roost cleat/).length, 2);
    for (const c of named(/^Roost cleat/)) assert.ok(Math.abs(c.position.y + c.size.height - roost.position.y) < 0.01, `${c.name} carries the roost`);
  });
  it("hardware cloth covers the front mesh and vents, priced on Buy", () => {
    assert.ok(plan.bom.some((b) => /hardware cloth/.test(b.name) && (b.estimatedCost ?? 0) > 0));
    assert.match(text, /hardware cloth over them/);
  });
  it("the roost goes in no earlier than both cleats; every Buy line is priced and sums to the total", () => {
    const idx = placementIndex(p, plan.instructions);
    const at = (n: string) => idx.get(p.panels.find((x) => x.name === n)!.id)!;
    assert.ok(at("Roost") >= at("Roost cleat left") && at("Roost") >= at("Roost cleat right"));
    assert.ok(plan.bom.every((b) => b.estimatedCost != null), "unpriced Buy line");
    const sum = Math.round(plan.bom.reduce((t, b) => t + (b.estimatedCost ?? 0), 0) * 100) / 100;
    assert.ok(Math.abs(sum - plan.totals.estCostUsd) < 0.02);
  });
  it("a rabbit hutch is unchanged: no coop parts", () => {
    assert.ok(!generateFromPrompt("rabbit hutch").panels.some((x) => /Roost|Nest box|Pop door/.test(x.name)));
  });
});
