import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

describe("handrail hardware", () => {
  it("a 30 inch stool buys carriage bolts and installs the rail", () => {
    const project = generateFromPrompt("step stool 30 inches");
    const plan = buildPlan(project);
    const bolts = plan.bom.find((line) => /carriage bolt/i.test(line.name));
    assert.ok(bolts);
    assert.equal(bolts.quantity, 4);
    const titles = plan.instructions.map((step) => step.title).join(" ");
    assert.match(titles, /Bolt the handrail/);
    const named = plan.instructions.flatMap((step) => step.partsUsed ?? []);
    assert.ok(project.panels.every((panel) => named.includes(panel.name) || named.includes("*")));
  });
});
