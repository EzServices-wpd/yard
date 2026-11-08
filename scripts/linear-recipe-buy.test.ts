import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { buildPlan } from "../src/lib/yard/report.ts";
import { packLengths, kerfFor } from "../src/lib/yard/linearPack.ts";
import { getCatalogItem } from "../src/lib/yard/catalog.ts";
import { binderBom, slipInstancesFromPanels } from "../src/lib/yard/joints.ts";
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
  const fittings = plan.bom.filter((b) => /PVC (?:tee|cross|90° elbow|45° elbow)/.test(b.name));
  const fittingQty = fittings.reduce((s, b) => s + b.quantity, 0);
  const pieces = plan.cutList.reduce((s, c) => s + c.quantity, 0);
  assert.ok(fittingQty > 0, "joints buy fittings");
  assert.ok(fittingQty < pieces, "one fitting per joint, not one per cut");
  const steps = plan.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
  assert.match(steps, /solvent cement/);
  assert.ok(plan.bom.some((b) => b.catalogId === "pvc-cement"), "steps call for cement, so Buy lists it");
  assert.doesNotMatch((project.notes ?? []).join("\n"), WOOD_OUTDOOR);
  assert.doesNotMatch(steps, WOOD_OUTDOOR);
  return { project, plan, fittingQty };
}

test("pvc soccer goal buys pipe by the stick, one fitting per corner, and cement", () => {
  const { plan, fittingQty } = assertPvcGoalBuy("pvc soccer goal 6 ft wide 4 ft tall");
  // 69" rails share a 10 ft stick with a 48" post; the 10" rails share one more. Not the old frame's 6 pipes.
  assert.equal(plan.bom.find((b) => b.catalogId === "pvc-3-4-sch40")!.quantity, 5);
  const tees = plan.bom.find((b) => /PVC tee/.test(b.name));
  assert.ok(tees);
  // Eight corners: each post meets two rails, one tee per corner.
  assert.equal(tees.quantity, 8);
  assert.equal(fittingQty, 8);
  assert.equal(plan.bom.some((b) => /elbow/.test(b.name)), false);
});

test("bare soccer goal stays the PVC recipe and buys the same way", () => {
  const { project, plan, fittingQty } = assertPvcGoalBuy("soccer goal");
  assert.ok(!project.unmatched);
  assert.equal(plan.bom.some((b) => /popsicle/i.test(b.name)), false);
  assert.equal(plan.bom.find((b) => b.catalogId === "pvc-3-4-sch40")!.quantity, 4);
  assert.equal(plan.bom.find((b) => /PVC tee/.test(b.name))!.quantity, 8);
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
  const { project } = planOf("compost bin");
  assert.match((project.notes ?? []).join("\n"), /Outdoors: cedar or pressure-treated stock and exterior screws/);
});
