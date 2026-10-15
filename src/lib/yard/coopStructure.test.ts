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
    assert.ok(door.hinged && p.panels.find((x) => x.id === door.hinged!.to)?.name === "Door stile");
    assert.equal(named(/^Door stile$/).length, 1);
    assert.equal(plan.bom.find((b) => /butt hinge/.test(b.name))?.quantity, 4);
    assert.ok(plan.bom.some((b) => /barrel bolt/.test(b.name) && (b.estimatedCost ?? 0) > 0));
  });
  it("has a 12in nest box raised about 24in and a flat 2x4 roost on cleats, higher than the nest", () => {
    const floor = named(/^Floor$/)[0];
    const bottom = named(/^Nest box bottom$/)[0];
    assert.ok(Math.abs(bottom.position.y - (floor.position.y + floor.size.height) - 24) < 0.5, "nest 24in up");
    const top = named(/^Nest box top$/)[0];
    const roost = named(/^Roost$/)[0];
    assert.ok(top && named(/^Nest box (side|lip|bottom)$/).length === 3);
    assert.ok(roost && roost.materialId === "lumber-2x4-8" && roost.size.depth === 3.5 && roost.size.height === 1.5);
    assert.ok(roost.position.y > top.position.y + top.size.height, "roost above the nest");
    assert.equal(named(/^Roost cleat/).length, 2);
    for (const c of named(/^Roost cleat/)) assert.ok(Math.abs(c.position.y + c.size.height - roost.position.y) < 0.01, `${c.name} carries the roost`);
  });
  it("hardware cloth covers the front mesh and vents, priced on Buy", () => {
    assert.ok(plan.bom.some((b) => /hardware cloth/.test(b.name) && (b.estimatedCost ?? 0) > 0));
    assert.match(text, /hardware cloth over them/);
  });
  it("F11 order: sides, then both cleats, then the roost in its own step; hinged parts hang last", () => {
    const idx = placementIndex(p, plan.instructions);
    const at = (n: string) => idx.get(p.panels.find((x) => x.name === n)!.id)!;
    assert.ok(at("Left side") < at("Roost cleat left") && at("Right side") < at("Roost cleat right"));
    assert.ok(at("Roost") > at("Roost cleat left") && at("Roost") > at("Roost cleat right"));
    assert.ok(at("Roost") !== at("Nest box bottom"));
    assert.ok(at("Pop door") > at("Door stile") && at("Roof") > at("Back"));
  });
  it("F7: hinged parts take no screws, and steps hang the door and roof, fit the bolt and staple the mesh", () => {
    const steps = plan.instructions.map((s) => `${s.title} ${s.description}`).join(" ");
    assert.match(steps, /Hang the pop door on 2 hinges[\s\S]*barrel bolt/);
    assert.match(steps, /Hang the roof on 2 hinges[\s\S]*No screws go through the roof/);
    assert.match(steps, /Staple the hardware cloth and drill the vents/);
    for (const s of plan.instructions) if (/Hang the roof/.test(s.title)) assert.doesNotMatch(s.description, /Drive \d+ ×/);
    assert.ok(plan.bom.some((b) => /galvanized butt hinges/.test(b.name)));
  });
  it("F26/F21: PT 2x4 floor frame (4 rims and a middle joist), PT 4x4 legs, exterior plywood, roll roofing, no glides", () => {
    assert.equal(named(/^Floor rim /).length, 4);
    assert.equal(named(/^Floor joist$/).length, 1);
    assert.ok(named(/^Leg /).every((l) => l.materialId === "lumber-4x4-8"));
    assert.ok(plan.bom.some((b) => /4×4 pressure-treated/.test(b.name)));
    assert.ok(plan.bom.some((b) => /exterior plywood/.test(b.name)));
    assert.ok(!plan.bom.some((b) => /^3\/4" Plywood 4×8$/.test(b.name)));
    assert.ok(plan.bom.some((b) => /roll roofing/.test(b.name)));
    assert.ok(!plan.bom.some((b) => /glide/i.test(b.name)));
    // Every cut-list stock is the treated or exterior version, rails and stile included.
    for (const c of plan.cutList) assert.match(c.material, /pressure-treated|exterior/, `${c.name}: ${c.material}`);
  });
  it("every Buy line is priced and sums to the total", () => {
    assert.ok(plan.bom.every((b) => b.estimatedCost != null), "unpriced Buy line");
    const sum = Math.round(plan.bom.reduce((t, b) => t + (b.estimatedCost ?? 0), 0) * 100) / 100;
    assert.ok(Math.abs(sum - plan.totals.estCostUsd) < 0.02);
  });
  it("a rabbit hutch gets the outdoor class (frame, PT legs, hinged roof) but no coop parts", () => {
    const h = generateFromPrompt("rabbit hutch");
    assert.ok(h.panels.some((x) => x.name === "Floor joist") && h.panels.find((x) => x.name === "Roof")?.hinged);
    assert.ok(!generateFromPrompt("rabbit hutch").panels.some((x) => /Roost|Nest box|Pop door/.test(x.name)));
  });
});
