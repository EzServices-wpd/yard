import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

describe("A plain robot gets an honest default body", () => {
  it("robot (no material): cardboard boxes, the plan says how to change it", () => {
    const project = generateFromPrompt("robot");
    const plan = buildPlan(project);
    assert.equal(project.instances.length, 0, "no stick lattice");
    assert.ok(project.panels.length >= 12, `panels ${project.panels.length}`);
    assert.ok(/No material typed/.test(plan.instructions[0]?.description ?? ""), plan.instructions[0]?.description);
    assert.ok(!plan.instructions.some((s) => /\brings?\b|\btips\b/i.test(s.title)));
  });
});

describe("Hardware on Buy shows in the model, with no phantom parts", () => {
  for (const prompt of ["coat rack 36 wide five hooks", "coat rack with 4 pegs", "entry bench with coat hooks"]) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      const drawn = project.panels.filter((p) => /^Coat hook \d+$/.test(p.name)).length;
      const buy = Number(plan.bom.find((b) => /coat hooks/i.test(b.name))?.notes?.match(/^(\d+) hooks/)?.[1] ?? NaN);
      const step = plan.instructions.find((s) => /^Screw \d+ (?:coat )?hooks/.test(s.title));
      assert.ok(step, plan.instructions.map((s) => s.title).join(" | "));
      assert.equal(drawn, buy, "model hooks = Buy hooks");
      assert.equal(Number(step!.title.match(/\d+/)?.[0]), buy, "step hooks = Buy hooks");
      assert.ok(!project.panels.some((p) => /^Peg \d+$|^Peg stop$/.test(p.name)), "no wooden pegs beside bought hooks");
      assert.ok(!plan.cutList.some((c) => /hook/i.test(c.name)), "hooks are bought, not cut");
      assert.ok(!plan.bom.some((b) => /mirror/i.test(b.name)), "no phantom mirror");
    });
  }
});

describe("Buy lists the adhesive the steps use", () => {
  for (const prompt of ["cardboard robot", "robot", "cardboard castle"]) {
    it(prompt, () => {
      const plan = buildPlan(generateFromPrompt(prompt));
      const steps = plan.instructions.map((s) => s.description).join(" ");
      assert.ok(/hot glue/i.test(steps), "steps use hot glue");
      assert.ok(plan.bom.some((b) => /hot glue sticks/i.test(b.name)), plan.bom.map((b) => b.name).join(", "));
      assert.ok(!plan.bom.some((b) => /craft glue|wood glue/i.test(b.name)), "no glue the steps leave unused");
    });
  }
  it("popsicle sticks keep wood glue in steps and Buy", () => {
    const plan = buildPlan(generateFromPrompt("popsicle stick house"));
    assert.ok(plan.bom.some((b) => /wood glue/i.test(b.name)));
    assert.ok(/wood glue/i.test(plan.instructions.map((s) => s.description).join(" ")));
  });
});
