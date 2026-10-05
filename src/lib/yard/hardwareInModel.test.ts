import assert from "node:assert/strict";
import fs from "node:fs";
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
      const hooks = project.panels.filter((p) => /^Coat hook \d+$/.test(p.name));
      const drawn = hooks.length;
      const buy = Number(plan.bom.find((b) => /coat hooks/i.test(b.name))?.notes?.match(/^(\d+) hooks/)?.[1] ?? NaN);
      const step = plan.instructions.find((s) => /^Screw \d+ (?:coat )?hooks/.test(s.title));
      assert.ok(step, plan.instructions.map((s) => s.title).join(" | "));
      assert.equal(drawn, buy, "model hooks = Buy hooks");
      assert.equal(Number(step!.title.match(/\d+/)?.[0]), buy, "step hooks = Buy hooks");
      assert.ok(!project.panels.some((p) => /^Peg \d+$|^Peg stop$/.test(p.name)), "no wooden pegs beside bought hooks");
      assert.ok(!plan.cutList.some((c) => /hook/i.test(c.name)), "hooks are bought, not cut");
      assert.ok(!plan.bom.some((b) => /mirror/i.test(b.name)), "no phantom mirror");
      const rail = project.panels.find((p) => /peg rail/i.test(p.name));
      if (rail) {
        const railFront = rail.position.z + rail.size.depth;
        for (const h of hooks) {
          assert.ok(h.size.depth >= 1.5, `${h.name} depth ${h.size.depth}`);
          assert.ok(h.position.z + h.size.depth > railFront + 0.5, `${h.name} must stick out past the rail`);
        }
      }
    });
  }
  it("coat rack 36 wide five hooks draws five visible hooks", () => {
    const project = generateFromPrompt("coat rack 36 wide five hooks");
    const hooks = project.panels.filter((p) => /^Coat hook \d+$/.test(p.name));
    assert.equal(hooks.length, 5);
    assert.ok(hooks.every((h) => h.materialId === "coat-hooks"));
  });
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

describe("Client path draws bought coat hooks as steel glyphs", () => {
  it("stick-cloud routes Coat hook panels through CoatHook", () => {
    const src = fs.readFileSync(new URL("../../components/workspace/stick-cloud.tsx", import.meta.url), "utf8");
    const hw = fs.readFileSync(new URL("../../components/workspace/panelHardware.tsx", import.meta.url), "utf8");
    assert.match(src, /isBoughtHardwareName/);
    assert.match(src, /<CoatHook\b/);
    assert.match(hw, /export function CoatHook/);
    assert.match(hw, /frustumCulled=\{false\}/);
  });
});
