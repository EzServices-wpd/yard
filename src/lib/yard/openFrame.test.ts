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
  assert.match(barePipe.notes ?? "", /15 7\/8"/);
  assert.equal(barePlan.bom.find((b) => /3-way corner/.test(b.name))!.quantity, 8);
  assert.equal(barePlan.bom.some((b) => /PVC tee/.test(b.name)), false);
  assert.equal(barePlan.bom.find((b) => b.catalogId === "pvc-cement")!.quantity, 1);

  const wide = generateFromPrompt("pvc soccer goal 6 ft wide 4 ft tall");
  assert.deepEqual([wide.overall.width, wide.overall.depth, wide.overall.height], [72, 24, 48]);
  assert.equal(headerSize(wide).depth, 24);
  assert.equal(openFrameStance(wide).tippy, false);
  assert.match((wide.notes ?? []).join("\n"), /Assumed 24" deep/);
  const widePlan = agrees(wide);
  const widePipe = widePlan.bom.find((b) => b.catalogId === "pvc-3-4-sch40")!;
  assert.equal(widePipe.quantity, 5);
  assert.match(widePipe.notes ?? "", /21 7\/8"/);
  assert.equal(widePlan.bom.find((b) => /3-way corner/.test(b.name))!.quantity, 8);
  assert.equal(widePlan.bom.some((b) => /PVC tee/.test(b.name)), false);
});

/** Clear distance between the base rails. A 16" log has to land on both. */
function logBay(project: YardProject): number {
  const rails = project.panels.filter((p) => /base rail/i.test(p.name)).sort((a, b) => a.position.z - b.position.z);
  const back = rails[0];
  const front = rails[rails.length - 1];
  return front.position.z - (back.position.z + back.size.depth);
}

it("a firewood rack keeps a bay a 16\" log can span, and a stable open frame is unchanged", () => {
  for (const [q, tall] of [["firewood rack", 48], ["firewood rack 60 tall", 60], ["firewood rack 72 tall", 72]] as const) {
    const rack = generateFromPrompt(q);
    const bay = logBay(rack);
    assert.ok(bay < 16 && bay > 8, `${q} bay ${bay}" drops a 16" log`);
    assert.equal(openFrameStance(rack).tippy, false, q);
    const uprights = rack.panels.filter((p) => /^Upright/.test(p.name));
    const face0 = Math.min(...uprights.map((p) => p.position.z));
    const face1 = Math.max(...uprights.map((p) => p.position.z + p.size.depth));
    for (const sleeper of rack.panels.filter((p) => /^Sleeper/.test(p.name))) {
      assert.ok(sleeper.position.z < face0 - 0.2, `${q} sleeper does not pass the back face`);
      assert.ok(sleeper.position.z + sleeper.size.depth > face1 + 0.2, `${q} sleeper does not pass the front face`);
    }
    assert.ok(Math.abs(rack.overall.height - tall) < 0.1, q);
    assert.match((rack.notes ?? []).join("\n"), /Stack 16" logs across the rails/);
  }
  const plan = agrees(generateFromPrompt("firewood rack"));
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
  // A W×D×H triple is a typed depth. 12" stays 12"; 18" on a 36" frame is half the height and stands.
  const triple = generateFromPrompt("soccer goal 48x12x36");
  assert.equal(triple.overall.depth, 12);
  assert.match((triple.notes ?? []).join("\n"), /Built 12" deep, as given/);
  const half = generateFromPrompt("soccer goal 48 wide 36 tall 18 deep");
  assert.equal(half.overall.depth, 18);
  assert.equal(openFrameStance(half).tippy, false);
  assert.equal((half.notes ?? []).some((n) => /will tip unless it is held/.test(n)), false);
  const halfWide = generateFromPrompt("pvc soccer goal 6 ft wide 4 ft tall 24 inches deep");
  assert.equal(halfWide.overall.depth, 24);
  assert.equal(halfWide.overall.height, 48);
  assert.equal(openFrameStance(halfWide).tippy, false);
  assert.equal((halfWide.notes ?? []).some((n) => /will tip unless it is held/.test(n)), false);
  const halfSquare = generateFromPrompt("soccer goal 48 wide 48 tall 24 deep");
  assert.equal(openFrameStance(halfSquare).tippy, false);

  const feet = generateFromPrompt("soccer goal 4 ft x 1 ft x 3 ft");
  assert.equal(feet.overall.depth, 12);
  assert.match((feet.notes ?? []).join("\n"), /Built 12" deep, as given/);
  assert.equal((feet.notes ?? []).some((n) => /Assumed \d/.test(n) && /deep/.test(n)), false);
  const tripleGoal = generateFromPrompt("pvc soccer goal 72x12x48");
  assert.equal((tripleGoal.notes ?? []).some((n) => /Assumed .* deep \(default size\)/.test(n)), false);

  const typedRack = generateFromPrompt("firewood rack 96 wide 48 tall 18 inches deep");
  assert.equal((typedRack.notes ?? []).some((n) => /as given/.test(n)), false);
  assert.match((typedRack.notes ?? []).join("\n"), /will tip unless it is held/);

  const narrow = generateFromPrompt("soccer goal 10 wide 36 tall");
  assert.equal(narrow.overall.width, 10);
  assert.match((narrow.notes ?? []).join("\n"), /will tip unless it is held/);
  assert.equal(openFrameStance(narrow).tippy, true);
});

it("the learned gate rejects a synthetic open frame that is still tippy", () => {
  assert.deepEqual(learnedRecipeFailures(goal), []);
  assert.deepEqual(learnedRecipeFailures(goal, "soccer goal"), []);
  assert.deepEqual(learnedRecipeFailures(goal, "pvc soccer goal 6 ft wide 4 ft tall"), []);
  const shallow = learnedRecipeFailures(goal, "soccer goal 48 wide 36 tall 8 deep");
  assert.ok(shallow.some((f) => /tips: free-standing open frame is 36" tall on a 8" base/.test(f)), shallow.join("; "));
  assert.equal(learnedRecipeFailures(goal, "soccer goal 48 wide 36 tall 18 deep").some((f) => /tips:/.test(f)), false);
  const synthetic = { ...goal, key: "box-frame", title: "Box Frame", learned: true } as Recipe;
  const fail = learnedRecipeFailures(synthetic, "box frame 40 wide 48 tall 6 deep");
  assert.ok(fail.some((f) => /tips: free-standing open frame is 48" tall on a 6" base/.test(f)), fail.join("; "));
});
