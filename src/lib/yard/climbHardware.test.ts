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

describe("kids and bathroom stools", () => {
  it("a kids bathroom stool gets pads, rounded corners, and a water-resistant finish", () => {
    const project = generateFromPrompt("kids bathroom step stool");
    const notes = project.notes.join(" ");
    assert.match(notes, /Round every corner/);
    assert.match(notes, /non-slip pad/);
    assert.match(notes, /water-resistant finish/);
    const plan = buildPlan(project);
    assert.ok(plan.bom.some((line) => /non-slip/i.test(line.name)));
    assert.ok(plan.bom.some((line) => /water-resistant/i.test(line.name)));
  });
});
