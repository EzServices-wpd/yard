import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { buildPlan } from "../src/lib/yard/report.ts";
import { packLengths, kerfFor } from "../src/lib/yard/linearPack.ts";
import { getCatalogItem } from "../src/lib/yard/catalog.ts";
import { binderBom, classifyJoint, countSlipFittings, slipInstancesFromPanels } from "../src/lib/yard/joints.ts";
import { fixedProfile, visualPrimitive } from "../src/lib/yard/geometry.ts";
import { learnedRecipeFailures } from "../src/lib/yard/learnedGate.ts";
import { RECIPES } from "../src/lib/yard/recipes.ts";
import type { BuildPlan, Panel } from "../src/lib/yard/types.ts";

const WOOD_OUTDOOR = /cedar|pressure-treated|exterior screws/i;

function planOf(prompt: string) {
  const project = generateFromPrompt(prompt);
  return { project, plan: buildPlan(project) };
}

/** Sticks the cut lengths nest into, the same packer Buy uses. */
function packedSticks(plan: BuildPlan, catalogId: string): number {
  const item = getCatalogItem(catalogId);
  assert.ok(item);
  const cuts = plan.cutList.filter((c) => c.id.split("|")[0] === catalogId && !c.whole);
  const lengths = cuts.flatMap((c) => Array.from({ length: c.quantity }, () => Math.max(c.lengthIn, c.widthIn, c.thicknessIn)));
  return packLengths(lengths, item.dims.length ?? 120, kerfFor(item, false)).sticks;
}

function assertPvcGoalBuy(prompt: string) {
  const { project, plan } = planOf(prompt);
  assert.equal(project.kind, "custom");
  assert.match(project.name, /PVC Soccer Goal/);
  assert.equal(project.primaryMaterialId, "pvc-3-4-sch40");
  const pipe = plan.bom.find((b) => b.catalogId === "pvc-3-4-sch40");
  assert.ok(pipe, "pipe is on Buy");
  assert.notEqual(pipe.unit, "sheet");
  assert.notEqual(pipe.unit, "sheets");
  assert.equal(pipe.unit, "ea");
  const sticks = packedSticks(plan, "pvc-3-4-sch40");
  assert.equal(pipe.quantity, sticks, "Buy counts whole sticks from the cut lengths");
  assert.ok(sticks > 1, "a goal's pipe does not fit in one stick");
  assert.match(pipe.notes ?? "", /from \d+ whole pipes/);
  const fittings = plan.bom.filter((b) => /PVC (?:tee|cross|90° elbow|45° elbow|3-way corner)/.test(b.name));
  const fittingQty = fittings.reduce((s, b) => s + b.quantity, 0);
  const pieces = plan.cutList.reduce((s, c) => s + c.quantity, 0);
  assert.ok(fittingQty > 0, "joints buy fittings");
  assert.ok(fittingQty < pieces, "one fitting per joint, not one per cut");
  const steps = plan.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
  assert.match(steps, /solvent cement/);
  assert.match(steps, /Stand the posts in the slip fittings/);
  assert.match(steps, /Every pipe meets a fitting/);
  assert.ok(plan.bom.some((b) => b.catalogId === "pvc-cement"), "steps call for cement, so Buy lists it");
  const pipes = project.panels.filter((p) => p.materialId === "pvc-3-4-sch40");
  for (const part of pipes) {
    const step = plan.instructions.find((s) => (s.partsUsed ?? []).includes(part.name) && /solvent cement/.test(s.description));
    assert.ok(step, `${part.name} is cemented in a step`);
  }
  const bottoms = plan.instructions.filter((s) => /bottom rail/i.test(`${s.title} ${(s.partsUsed ?? []).join(" ")}`));
  assert.ok(bottoms.length >= 1, "bottom rails have a step");
  assert.ok(bottoms.every((s) => /solvent cement/.test(s.description)), "bottom corners are cemented");
  assert.doesNotMatch((project.notes ?? []).join("\n"), WOOD_OUTDOOR);
  assert.doesNotMatch(steps, WOOD_OUTDOOR);
  const dia = getCatalogItem("pvc-3-4-sch40")!.dims.diameter!;
  for (const part of pipes) {
    const cross = [part.size.width, part.size.height, part.size.depth].sort((a, b) => a - b).slice(0, 2);
    assert.equal(cross[0], dia, `${part.name} section`);
    assert.equal(cross[1], dia, `${part.name} section`);
  }
  const corners = plan.bom.find((b) => /3-way corner/.test(b.name));
  assert.ok(corners, "corners are on Buy");
  assert.equal(corners.quantity, 8);
  assert.match(corners.notes ?? "", /Side-outlet elbow/);
  assert.equal(plan.bom.some((b) => /PVC tee/.test(b.name)), false);
  assert.equal(fittingQty, 8);
  const bill = countSlipFittings(slipInstancesFromPanels(project.panels, "pvc-3-4-sch40"), dia / 2);
  assert.equal(bill.corners, 8);
  assert.equal(bill.tees, 0);
  assert.match(steps, /8 3\/4" PVC 3-way corners, the same fittings on the Buy list/);
  assert.match(steps, /1 1\/16 × 1 1\/16/);
  assert.doesNotMatch(steps, /1 3\/8|1 1\/2/);
  for (const cut of plan.cutList.filter((c) => c.id.startsWith("pvc-3-4-sch40"))) {
    assert.equal(cut.widthIn, dia, cut.name);
    assert.equal(cut.thicknessIn, dia, cut.name);
  }
  return { project, plan, fittingQty };
}

test("pvc soccer goal buys pipe by the stick, one fitting per corner, and cement", () => {
  const { plan, fittingQty } = assertPvcGoalBuy("pvc soccer goal 6 ft wide 4 ft tall");
  // 69 7/8" rails share a 10 ft stick with a 48" post; the 10" rails share one more. Not the old frame's 6 pipes.
  assert.equal(plan.bom.find((b) => b.catalogId === "pvc-3-4-sch40")!.quantity, 5);
  assert.equal(fittingQty, 8);
});

test("bare soccer goal stays the PVC recipe and buys the same way", () => {
  const { project, plan, fittingQty } = assertPvcGoalBuy("soccer goal");
  assert.ok(!project.unmatched);
  assert.equal(plan.bom.some((b) => /popsicle/i.test(b.name)), false);
  assert.equal(plan.bom.find((b) => b.catalogId === "pvc-3-4-sch40")!.quantity, 4);
  assert.equal(fittingQty, 8);
});

test("two pipe members meeting at a right angle buy one elbow", () => {
  const item = getCatalogItem("pvc-3-4-sch40");
  assert.ok(item);
  const panels: Panel[] = [
    { id: "a", type: "rail", name: "Post", materialId: item.id, position: { x: 0, y: 0, z: 0 }, size: { width: 1, height: 24, depth: 1 } },
    { id: "b", type: "rail", name: "Rail", materialId: item.id, position: { x: 1, y: 23, z: 0 }, size: { width: 24, height: 1, depth: 1 } },
  ];
  const lines = binderBom(item, slipInstancesFromPanels(panels, item.id));
  const elbow = lines.find((b) => /90° elbow/.test(b.name));
  assert.ok(elbow);
  assert.equal(elbow.quantity, 1);
  assert.equal(lines.some((b) => /PVC tee/.test(b.name)), false);
});

test("a plywood recipe still buys sheets", () => {
  const { plan } = planOf("mudroom locker");
  const ply = plan.bom.find((b) => b.catalogId === "plywood-3-4-4x8");
  assert.ok(ply);
  assert.match(ply.unit, /^sheets?$/);
  assert.match(ply.notes ?? "", /sheet/i);
  assert.ok((ply.quantity ?? 0) > 1);
});

test("a stick recipe keeps its pack buy and is not bought again as sticks", () => {
  const { plan } = planOf("ferris wheel");
  const rows = plan.bom.filter((b) => /popsicle/i.test(b.name));
  assert.ok(rows.some((b) => /pack of 100\b/.test(b.unit)));
  assert.equal(rows.filter((b) => /pack of 1000/.test(b.unit)).length, 0);
});

test("a wood outdoor recipe keeps the cedar outdoor note", () => {
  const { project, plan } = planOf("compost bin");
  assert.match((project.notes ?? []).join("\n"), /Outdoors: cedar or pressure-treated stock and exterior screws/);
  assert.ok(plan.bom.some((b) => /pressure-treated/.test(b.name)));
});

test("a typed pipe word on a lumber recipe keeps the outdoor wood note and pressure-treated Buy", () => {
  for (const q of ["pvc compost bin", "compost bin from pvc pipe"]) {
    const { project, plan } = planOf(q);
    assert.equal(project.primaryMaterialId, "lumber-1x6-8", q);
    assert.match((project.notes ?? []).join("\n"), /Outdoors: cedar or pressure-treated stock and exterior screws/, q);
    assert.ok(plan.bom.some((b) => /1×6 pressure-treated/.test(b.name)), q);
    assert.ok(plan.bom.some((b) => /4×4 pressure-treated/.test(b.name)), q);
  }
});

test("learned recipe gate accepts slip fittings bought for pipe on the cut list", () => {
  const goal = RECIPES.recipes.find((r) => r.key === "goal");
  assert.ok(goal);
  assert.deepEqual(learnedRecipeFailures(goal), []);
  assert.deepEqual(learnedRecipeFailures(goal, "soccer goal"), []);
  assert.deepEqual(learnedRecipeFailures(goal, "pvc soccer goal 6 ft wide 4 ft tall"), []);
});

test("soccer goal fittings hold across short and wide sizes", () => {
  const dia = getCatalogItem("pvc-3-4-sch40")!.dims.diameter!;
  const fittingQty = (plan: BuildPlan) =>
    plan.bom.filter((b) => /PVC (?:tee|cross|90° elbow|45° elbow|3-way corner)/.test(b.name)).reduce((s, b) => s + b.quantity, 0);
  const widths = [2, 4, 6, 12, 20, 24];
  const heights = [1, 2, 3, 4, 8];
  for (const w of widths) {
    for (const h of heights) {
      const q = `pvc soccer goal ${w} ft wide ${h} ft tall`;
      const { project, plan } = planOf(q);
      const n = fittingQty(plan);
      assert.equal(n, 8, `${q} merges or drops corners`);
      assert.equal(plan.bom.find((b) => /3-way corner/.test(b.name))?.quantity, 8, q);
      assert.equal(plan.bom.some((b) => /PVC tee/.test(b.name)), false, q);
      const post = project.panels.find((p) => p.name === "Left front post");
      assert.ok(post, q);
      assert.equal(post.size.height, h * 12, `${q} post length`);
      const rail = project.panels.find((p) => p.name === "Front crossbar");
      const right = project.panels.find((p) => p.name === "Right front post");
      assert.ok(rail && right, q);
      assert.ok(Math.abs(rail.position.x - (post.position.x + post.size.width)) < 0.02, `${q} rail meets the left post`);
      assert.ok(Math.abs(rail.position.x + rail.size.width - right.position.x) < 0.02, `${q} rail meets the right post`);
      for (const part of project.panels.filter((p) => p.materialId === "pvc-3-4-sch40")) {
        const cross = [part.size.width, part.size.height, part.size.depth].sort((a, b) => a - b).slice(0, 2);
        assert.equal(cross[0], dia, `${q} ${part.name}`);
        assert.equal(cross[1], dia, `${q} ${part.name}`);
      }
      assert.ok(plan.bom.some((b) => b.catalogId === "pvc-cement"), q);
      assert.equal(plan.bom.some((b) => /glue/i.test(b.name)) && n === 0, false, q);
    }
  }
  const short = planOf("pvc soccer goal 4 ft wide 2 ft tall");
  assert.ok(fittingQty(short.plan) > 0);
  assert.ok(short.plan.bom.some((b) => b.catalogId === "pvc-cement"));
  assert.equal(short.plan.bom.every((b) => /glue/i.test(b.name) || b.catalogId === "pvc-3-4-sch40") && !short.plan.bom.some((b) => b.catalogId === "pvc-cement"), false);
  const wide = planOf("pvc soccer goal 24 ft wide 8 ft tall");
  assert.equal(fittingQty(wide.plan), 8);
  assert.equal(wide.plan.bom.find((b) => /3-way corner/.test(b.name))?.quantity, 8);
  assert.equal(wide.plan.bom.some((b) => /PVC tee/.test(b.name)), false);
});

test("fitting type follows joint valence", () => {
  const at = { x: 0, y: 1, z: 0 };
  const v = (x: number, y: number, z: number) => ({ x, y, z });
  assert.equal(classifyJoint({ p: at, r: 0.5, dirs: [v(1, 0, 0), v(0, 1, 0)] }), "elbow90");
  assert.equal(classifyJoint({ p: at, r: 0.5, dirs: [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0)] }), "tee");
  assert.equal(classifyJoint({ p: at, r: 0.5, dirs: [v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)] }), "corner3");
  // About 10° off square is a tee, not a 3-way corner.
  assert.equal(classifyJoint({ p: at, r: 0.5, dirs: [v(1, 0, 0), v(0, 1, 0), v(-0.17, 0, 0.985)] }), "tee");
  assert.equal(classifyJoint({ p: at, r: 0.5, dirs: [v(1, 0, 0), v(-1, 0, 0), v(0, 0, 1), v(0, 0, -1)] }), "cross");

  const item = getCatalogItem("pvc-3-4-sch40");
  assert.ok(item);
  const corner: Panel[] = [
    { id: "post", type: "rail", name: "Post", materialId: item.id, position: { x: 0, y: 0, z: 0 }, size: { width: 1.05, height: 24, depth: 1.05 } },
    { id: "railx", type: "rail", name: "Rail X", materialId: item.id, position: { x: 1.05, y: 22.95, z: 0 }, size: { width: 24, height: 1.05, depth: 1.05 } },
    { id: "railz", type: "rail", name: "Rail Z", materialId: item.id, position: { x: 0, y: 22.95, z: 1.05 }, size: { width: 1.05, height: 1.05, depth: 24 } },
  ];
  const cornerLines = binderBom(item, slipInstancesFromPanels(corner, item.id));
  assert.equal(cornerLines.find((b) => /3-way corner/.test(b.name))?.quantity, 1);
  assert.equal(cornerLines.some((b) => /PVC tee/.test(b.name)), false);

  const tee: Panel[] = [
    { id: "left", type: "rail", name: "Left run", materialId: item.id, position: { x: 0, y: 11.5, z: 0 }, size: { width: 12, height: 1.05, depth: 1.05 } },
    { id: "right", type: "rail", name: "Right run", materialId: item.id, position: { x: 12, y: 11.5, z: 0 }, size: { width: 12, height: 1.05, depth: 1.05 } },
    { id: "branch", type: "rail", name: "Branch", materialId: item.id, position: { x: 11.475, y: 12.55, z: 0 }, size: { width: 1.05, height: 12, depth: 1.05 } },
  ];
  const teeLines = binderBom(item, slipInstancesFromPanels(tee, item.id));
  assert.equal(teeLines.find((b) => /PVC tee/.test(b.name))?.quantity, 1);
  assert.equal(teeLines.some((b) => /3-way corner/.test(b.name)), false);
});

test("a straw bridge and a PVC birdhouse keep the catalog section while the span changes", () => {
  const straw = getCatalogItem("straw-plastic");
  assert.ok(straw);
  assert.deepEqual(fixedProfile(straw), [straw.dims.diameter, straw.dims.diameter]);
  const short = generateFromPrompt("4 foot bridge from plastic drinking straws");
  const tall = generateFromPrompt("8 foot bridge from plastic drinking straws");
  const straws = (p: typeof short) => p.instances.filter((i) => i.catalogId === straw.id).length;
  assert.ok(straws(tall) > straws(short));
  for (const project of [short, tall]) {
    for (const inst of project.instances) if (inst.catalogId === straw.id) assert.equal(inst.section, undefined);
    const drawn = visualPrimitive(straw, 48, 120);
    assert.equal(drawn.width, straw.dims.diameter);
    assert.equal(drawn.height, straw.dims.diameter);
  }
  const pipe = getCatalogItem("pvc-3-4-sch40")!;
  const small = generateFromPrompt("birdhouse from 3/4 PVC pipe");
  const big = generateFromPrompt("birdhouse from 3/4 PVC pipe 24 wide 18 tall");
  const longest = (p: typeof small) => Math.max(...p.instances.map((i) => i.cutLength ?? 0));
  assert.ok(longest(big) > longest(small));
  for (const project of [small, big]) {
    for (const inst of project.instances) if (inst.catalogId === pipe.id) assert.equal(inst.section, undefined);
    const drawn = visualPrimitive(pipe, longest(project), 48);
    assert.equal(drawn.width, pipe.dims.diameter);
    assert.equal(drawn.height, pipe.dims.diameter);
  }
});

test("a garden arch keeps its tee and elbow buy", () => {
  const { plan } = planOf("6 foot garden arch from 3/4 inch PVC pipe");
  assert.equal(plan.bom.find((b) => /PVC tee/.test(b.name))?.quantity, 4);
  assert.equal(plan.bom.find((b) => /90° elbow/.test(b.name))?.quantity, 2);
  assert.equal(plan.bom.find((b) => /45° elbow/.test(b.name))?.quantity, 2);
  assert.equal(plan.bom.some((b) => /3-way corner/.test(b.name)), false);
  const item = getCatalogItem("pvc-3-4-sch40")!;
  for (const feet of [4, 6, 8]) {
    const project = generateFromPrompt(`${feet} foot garden arch from 3/4 inch PVC pipe`);
    for (const inst of project.instances) assert.equal(inst.section, undefined);
    assert.equal(visualPrimitive(item, 72, 96).width, item.dims.diameter);
  }
});
