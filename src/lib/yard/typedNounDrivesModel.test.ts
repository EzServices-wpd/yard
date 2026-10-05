import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

const text = (plan: ReturnType<typeof buildPlan>) =>
  [...plan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`), ...plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`), ...plan.cutList.map((c) => c.name)].join("\n");

describe("The typed noun and feature drive the model", () => {
  it("bathroom vanity with a pocket for the trash can: the pocket is sized for a trash can and says so", () => {
    const project = generateFromPrompt("bathroom vanity with a pocket for the trash can");
    const plan = buildPlan(project);
    const all = text(plan);
    assert.ok(/trash can/i.test(all), "plan names the trash can");
    assert.ok(!(project.overall.width === 38 && project.overall.depth === 17), "not the stock 38 wide pocket vanity");
    assert.ok(project.overall.width < 60, `width ${project.overall.width}`);
  });

  it("dog bed from a pallet: a low bed-sized box of pallet boards with a floor", () => {
    const project = generateFromPrompt("dog bed from a pallet");
    const plan = buildPlan(project);
    assert.ok(project.overall.height <= 12, `height ${project.overall.height}`);
    assert.ok(project.overall.width >= 24 && project.overall.width <= 48, `width ${project.overall.width}`);
    assert.ok(plan.cutList.some((c) => /floor board/i.test(c.name)), "floor boards on the cut list");
    assert.ok(plan.cutList.every((c) => /pallet/i.test(c.material)), "pallet stock");
    assert.ok(!/legs and aprons|\bring\b|\bbrace\b/i.test(text(plan)), "no generic legs/rings/braces lattice");
  });

  it("cardboard robot: boxes of cardboard panels, glued with hot glue, no wood glue talk", () => {
    const project = generateFromPrompt("cardboard robot");
    const plan = buildPlan(project);
    const all = text(plan);
    assert.ok(project.panels.length >= 12, `panels ${project.panels.length}`);
    assert.ok(/hot glue/i.test(all));
    assert.ok(!/wood glue|overnight|legs and aprons/i.test(all), "cardboard-appropriate text");
  });
});
