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
    assert.ok(boards && (boards.estimatedCost ?? 0) > 0, `${q} board price ${boards?.estimatedCost}`);
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
