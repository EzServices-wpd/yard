/**
 * Free-standing open frames stand on a base at least half their height.
 * A typed depth that is too shallow is kept, and the learned gate will not certify it.
 */
import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { headerSize } from "./headerSize.ts";
import { learnedRecipeFailures } from "./learnedGate.ts";
import { openFrameStance } from "./openFrame.ts";
import { RECIPES } from "./recipes.ts";
import type { Recipe } from "./recipes.ts";
import type { Panel, YardProject } from "./types.ts";

const goal = RECIPES.recipes.find((r) => r.key === "goal")!;

function longs(panels: Panel[]): number[] {
  return panels.map((p) => Math.max(p.size.width, p.size.height, p.size.depth)).sort((a, b) => a - b);
}

/** Every part is named in a step, and each part's long side is a cut length (glue-up layers may repeat it). */
function agrees(project: YardProject) {
  const plan = buildPlan(project);
  const cut = plan.cutList.map((c) => c.lengthIn);
  for (const n of longs(project.panels)) assert.ok(cut.some((c) => Math.abs(c - n) < 0.2), `no cut for ${n}"`);
  for (const part of project.panels) {
    assert.ok(plan.instructions.some((s) => (s.partsUsed ?? []).includes(part.name)), `${part.name} is in a step`);
  }
  return plan;
}

it("a soccer goal at the default size and at 6×4 stands, and Buy matches the model", () => {
  const bare = generateFromPrompt("soccer goal");
  assert.deepEqual([bare.overall.width, bare.overall.depth, bare.overall.height], [48, 18, 36]);
  assert.equal(headerSize(bare).depth, 18);
  assert.equal(openFrameStance(bare).tippy, false);
  assert.match((bare.notes ?? []).join("\n"), /Assumed 18" deep/);
  const barePlan = agrees(bare);
  const barePipe = barePlan.bom.find((b) => b.catalogId === "pvc-3-4-sch40")!;
  assert.equal(barePipe.quantity, 4);
  assert.match(barePipe.notes ?? "", /16"/);
  assert.equal(barePlan.bom.find((b) => /PVC tee/.test(b.name))!.quantity, 8);
  assert.equal(barePlan.bom.find((b) => b.catalogId === "pvc-cement")!.quantity, 1);

  const wide = generateFromPrompt("pvc soccer goal 6 ft wide 4 ft tall");
  assert.deepEqual([wide.overall.width, wide.overall.depth, wide.overall.height], [72, 24, 48]);
  assert.equal(headerSize(wide).depth, 24);
  assert.equal(openFrameStance(wide).tippy, false);
  assert.match((wide.notes ?? []).join("\n"), /Assumed 24" deep/);
  const widePlan = agrees(wide);
  const widePipe = widePlan.bom.find((b) => b.catalogId === "pvc-3-4-sch40")!;
  assert.equal(widePipe.quantity, 5);
  assert.match(widePipe.notes ?? "", /22"/);
  assert.equal(widePlan.bom.find((b) => /PVC tee/.test(b.name))!.quantity, 8);
});

it("a firewood rack that stood 18 1/2\" deep now stands, and a stable open frame is unchanged", () => {
  const rack = generateFromPrompt("firewood rack");
  assert.deepEqual([rack.overall.width, rack.overall.depth, rack.overall.height], [96, 24, 48]);
  assert.ok(rack.panels.filter((p) => /^Sleeper/.test(p.name)).every((p) => p.size.depth === 24));
  assert.equal(openFrameStance(rack).tippy, false);
  const plan = agrees(rack);
  assert.equal(plan.bom.find((b) => b.catalogId === "lumber-2x4-8")!.quantity, 6);

  // Compost tumbler frame: 38.6" tall on a 25.2" base, already past half the height. Same parts.
  const tumbler = generateFromPrompt("compost tumbler frame");
  assert.equal(tumbler.panels.length, 9);
  assert.ok(Math.abs(tumbler.overall.width - 44.78) < 0.02);
  assert.ok(Math.abs(tumbler.overall.depth - 25.2) < 0.02);
  assert.ok(Math.abs(tumbler.overall.height - 38.6) < 0.02);
  const rail = tumbler.panels.find((p) => p.name === "Left top rail")!;
  assert.ok(Math.abs(rail.size.depth - 25.2) < 0.05);
  assert.equal(openFrameStance(tumbler).tippy, false);
  assert.equal((tumbler.notes ?? []).some((n) => /will tip unless it is held/.test(n)), false);

  // Sawhorse: splayed legs, base already past half the height. Same envelope.
  const horse = generateFromPrompt("sawhorse");
  assert.equal(horse.panels.length, 8);
  assert.deepEqual([horse.overall.width, horse.overall.depth, horse.overall.height], [21, 36, 30]);
  assert.equal(openFrameStance(horse).tippy, false);
  assert.equal(openFrameStance(horse).hasDiagonal, true);
});

it("a typed depth that is too shallow is kept, and the note says the frame will tip", () => {
  const p = generateFromPrompt("soccer goal 48 wide 36 tall 8 deep");
  assert.equal(p.overall.depth, 8);
  assert.equal(p.overall.width, 48);
  assert.equal(p.overall.height, 36);
  assert.equal(openFrameStance(p).tippy, true);
  assert.match((p.notes ?? []).join("\n"), /Built 8" deep, as given/);
  assert.match((p.notes ?? []).join("\n"), /will tip unless it is held/);
  agrees(p);
});

it("the learned gate rejects a synthetic open frame that is still tippy", () => {
  assert.deepEqual(learnedRecipeFailures(goal), []);
  assert.deepEqual(learnedRecipeFailures(goal, "soccer goal"), []);
  assert.deepEqual(learnedRecipeFailures(goal, "pvc soccer goal 6 ft wide 4 ft tall"), []);
  const shallow = learnedRecipeFailures(goal, "soccer goal 48 wide 36 tall 8 deep");
  assert.ok(shallow.some((f) => /tips: free-standing open frame is 36" tall on a 8" base/.test(f)), shallow.join("; "));
  const synthetic = { ...goal, key: "box-frame", title: "Box Frame", learned: true } as Recipe;
  const fail = learnedRecipeFailures(synthetic, "box frame 40 wide 48 tall 6 deep");
  assert.ok(fail.some((f) => /tips: free-standing open frame is 48" tall on a 6" base/.test(f)), fail.join("; "));
});
