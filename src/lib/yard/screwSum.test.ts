import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

describe("screw sum", () => {
  it("a coffee table step quotes the same screw total Buy summed", () => {
    const plan = buildPlan(generateFromPrompt("coffee table"));
    const note = plan.bom.find((line) => /screw/i.test(line.name))?.notes ?? "";
    const total = note.match(/(\d+) screws from the model's joints/)?.[1];
    assert.ok(total);
    const steps = plan.instructions.map((step) => step.description).join(" ");
    assert.match(steps, new RegExp(`${total} screws from the model's joints`));
  });
});
