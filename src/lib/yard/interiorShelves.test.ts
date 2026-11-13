/**
 * Error class 806: a storage, cabinet or shelving carcase whose interior is above the
 * clear-shelf limit builds the shelves that family already builds. The oracle is the
 * published family counts and the measured opening, not tallInteriorShelfCount.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { CLOSET_SHELF_CLEAR_IN } from "./shelfClear.ts";
import type { Panel, YardProject } from "./types.ts";

const PLY_SPAN_IN = 30;

function panel(p: YardProject, type: string): Panel {
  const found = p.panels.find((x) => x.type === type);
  assert.ok(found, `${p.prompt}: no ${type}`);
  return found;
}

/** Clear height between the top of the bottom and the underside of the top. */
function interiorIn(p: YardProject): number {
  const top = panel(p, "top");
  const bottom = panel(p, "bottom");
  return top.position.y - (bottom.position.y + bottom.size.height);
}

function shelfLevels(p: YardProject): number[] {
  return [...new Set(p.panels.filter((x) => x.type === "shelf").map((s) => s.position.y))].sort((a, b) => a - b);
}

describe("storage, cabinet and shelving interiors", () => {
  it("a storage unit above the clear-shelf limit builds the bookcase family's five shelves", () => {
    const p = generateFromPrompt("storage unit");
    const opening = interiorIn(p);
    assert.ok(opening > CLOSET_SHELF_CLEAR_IN, `interior ${opening}`);
    assert.equal(p.fitted?.program, "storage");
    assert.equal(p.fitted?.family, "floor-carcase");
    const levels = shelfLevels(p);
    assert.deepEqual(levels.length, 5);
    const bottom = panel(p, "bottom");
    const top = panel(p, "top");
    const thick = p.panels.find((x) => x.type === "shelf")!.size.height;
    let prev = bottom.position.y + bottom.size.height;
    for (const y of levels) {
      assert.ok(y >= prev - 1e-6, `shelf at ${y} overlaps the face at ${prev}`);
      assert.ok(y + thick <= top.position.y + 1e-6, `shelf at ${y} crosses the top`);
      prev = y + thick;
    }
    // 36" plywood spans past the 30" shop limit, so the existing span rule splits each shelf.
    const shelves = p.panels.filter((x) => x.type === "shelf");
    assert.ok(shelves.every((s) => s.size.width <= PLY_SPAN_IN + 1e-6), shelves.map((s) => s.size.width).join(","));
    assert.ok(p.panels.some((x) => x.name === "Center divider"));
    const plan = buildPlan(p);
    assert.equal(p.panels.length, 16);
    assert.equal(plan.bom.length, 5);
    assert.equal(plan.totals.estCostUsd, 121.78);
    assert.equal(plan.instructions.length, 8);
    assert.ok(plan.instructions.some((s) => s.title.startsWith("Pin 5 shelves")));
    assert.ok(plan.instructions.some((s) => s.title === "Set the center divider"));
  });

  it("garage storage is the same open storage carcase, not a one-off title", () => {
    const p = generateFromPrompt("garage storage");
    assert.ok(interiorIn(p) > CLOSET_SHELF_CLEAR_IN);
    assert.equal(shelfLevels(p).length, 5);
    assert.equal(p.panels.filter((x) => x.type === "shelf").length, 10);
  });

  it("an open cabinet above the limit builds the cabinet family's two shelves", () => {
    const open = generateFromPrompt("open cabinet");
    const cabinet = generateFromPrompt("cabinet");
    assert.ok(interiorIn(open) > CLOSET_SHELF_CLEAR_IN);
    assert.equal(shelfLevels(open).length, 2);
    assert.equal(shelfLevels(cabinet).length, 2);
    assert.equal(open.panels.filter((x) => x.type === "door").length, 2);
    const plan = buildPlan(open);
    assert.equal(open.panels.length, 12);
    assert.equal(plan.bom.length, 7);
    assert.equal(plan.totals.estCostUsd, 165.72);
    assert.ok(plan.instructions.some((s) => s.title.startsWith("Pin 2 shelves")));
  });

  it("a storage unit whose interior is not above the clear-shelf limit stays an empty box", () => {
    const p = generateFromPrompt("storage unit 8 tall");
    assert.ok(interiorIn(p) <= CLOSET_SHELF_CLEAR_IN, `interior ${interiorIn(p)}`);
    assert.equal(shelfLevels(p).length, 0);
    assert.deepEqual(p.panels.map((x) => x.name), ["Left upright", "Right upright", "Back", "Top", "Bottom"]);
    const plan = buildPlan(p);
    assert.equal(plan.bom.length, 4);
    assert.equal(plan.totals.estCostUsd, 76.86);
  });

  it("a typed shelf count still wins, and forms that are not this carcase stay put", () => {
    assert.equal(shelfLevels(generateFromPrompt("storage unit with 4 shelves")).length, 4);
    assert.equal(shelfLevels(generateFromPrompt("shelving")).length, 3);
    assert.equal(shelfLevels(generateFromPrompt("bookcase")).length, 5);
    assert.equal(shelfLevels(generateFromPrompt("planter box")).length, 0);
    assert.equal(shelfLevels(generateFromPrompt("under-stairs storage")).length, 0);
    assert.equal(generateFromPrompt("under-stairs storage").panels.length, 5);
    const linen = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
    const plan = buildPlan(linen);
    assert.equal(linen.panels.length, 11);
    assert.equal(plan.bom.length, 8);
    assert.equal(plan.instructions.length, 9);
    assert.equal(plan.totals.estCostUsd, 193.68);
  });
});
