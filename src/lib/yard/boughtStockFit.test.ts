/**
 * Sheet parts fit the board stock already being bought (and its offcut) before a new sheet is opened.
 * The prompts here are not the reported list: a patch that only rewrites those prompts fails them.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";

const sheetBuy = (q: string) => buildPlan(generateFromPrompt(q)).bom.filter((b) => /plywood|sheet/i.test(`${b.catalogId ?? ""} ${b.name}`));

test("a carry box cuts its bottom from the boards already bought", () => {
  for (const q of ["fishing caddy 14 long", "sewing tote 22 long", "beach tote 12 wide", "pine 1x10 caddy", "cedar 1x6 toolbox 15 long"]) {
    const p = generateFromPrompt(q);
    const plan = buildPlan(p);
    assert.equal(p.kind === "house" || !!p.standIn || !!p.unmatched, false, q);
    assert.ok(p.panels.some((panel) => /hand hold/i.test(panel.cutNote ?? "")), q);
    assert.equal(p.panels.find((panel) => panel.name === "Bottom")?.materialId, p.primaryMaterialId, q);
    assert.deepEqual(sheetBuy(q).map((b) => b.catalogId), [], q);
    const boards = plan.bom.find((b) => b.catalogId === p.primaryMaterialId);
    assert.ok(boards && boards.quantity > 0, `${q} boards ${boards?.quantity}`);
    const setBottom = plan.instructions.find((s) => /^Set the Bottom/.test(s.title));
    assert.ok(!setBottom || /Where: Top of B Bottom sits/.test(setBottom.description), `${q} bottom placement stays in its Set step`);
    assert.deepEqual(checkBuild(p, q, plan).filter((v) => v.id === "I13" || v.id === "I28").map((v) => v.msg), [], q);
  }
});

test("a part that does not fit the boards still buys its sheet", () => {
  const plan = buildPlan(generateFromPrompt("bookshelf"));
  assert.ok(plan.bom.some((b) => b.catalogId === "plywood-3-4-4x8"));
});

test("a checked cedar 1x6 price is not replaced by the scaled map", () => {
  const row = buildPlan(generateFromPrompt("sandbox cover 4 by 4")).bom.find((b) => b.catalogId === "lumber-1x6-8");
  assert.ok(row);
  assert.equal(row!.estimatedCost, 79.92);
});

test("a 2x4 frame does not rebuild a plywood top from studs", () => {
  const p = generateFromPrompt("workbench 6 foot with lower shelf");
  assert.match(p.panels.find((panel) => panel.name === "Work top")?.materialId ?? "", /^plywood-/);
});

test("a 1x8 board takes the checked listing, not a scaled guess", () => {
  const row = buildPlan(generateFromPrompt("toolbox")).bom.find((b) => b.catalogId === "lumber-1x8-8");
  assert.ok(row);
  assert.equal(Math.round((row!.estimatedCost ?? 0) * 100) / 100, Math.round(20.48 * row!.quantity * 100) / 100);
  assert.ok(row!.offers?.some((o) => o.packPrice === 20.48));
});
