/**
 * Error class 806: a plain storage, cabinet, or shelving carcase whose opening can hold a
 * shelf gets that family's count, capped so every gap stays at least 7". The numbers below
 * are measured on the panels. They fail if the fit cap, the stand-in guard, or the stock
 * guard is removed.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { CLOSET_SHELF_CLEAR_IN } from "./shelfClear.ts";
import { genericFallbackBox } from "./genericBox.ts";
import type { Panel, YardProject } from "./types.ts";

function face(p: YardProject, type: string): Panel | undefined {
  return p.panels.find((x) => x.type === type);
}

/** Clear gaps from the top of the bottom, across each shelf, up to the underside of the top. */
function clearGaps(p: YardProject): number[] {
  const shelves = [...new Set(p.panels.filter((x) => x.type === "shelf").map((s) => s.position.y))].sort((a, b) => a - b);
  const top = face(p, "top");
  const bottom = face(p, "bottom");
  const thick = p.panels.find((x) => x.type === "shelf")?.size.height ?? 0;
  if (!top || !bottom || !shelves.length) return [];
  let prev = bottom.position.y + bottom.size.height;
  const gaps: number[] = [];
  for (const y of shelves) {
    gaps.push(y - prev);
    prev = y + thick;
  }
  gaps.push(top.position.y - prev);
  return gaps;
}

function levels(p: YardProject): number {
  return new Set(p.panels.filter((x) => x.type === "shelf").map((s) => s.position.y)).size;
}

function price(p: YardProject): number {
  return buildPlan(p).totals.estCostUsd;
}

describe("storage, cabinet and shelving interiors", () => {
  it("a 30 inch storage unit gets two shelves at least 7 inches apart", () => {
    const p = generateFromPrompt("storage unit");
    assert.equal(levels(p), 2);
    const gaps = clearGaps(p);
    assert.ok(gaps.length >= 3, gaps.join(","));
    assert.ok(gaps.every((g) => g + 1e-6 >= CLOSET_SHELF_CLEAR_IN), gaps.join(","));
    assert.equal(price(p), 83.35);
    assert.equal(p.panels.length, 10);
    const plan = buildPlan(p);
    assert.ok(plan.instructions.some((s) => s.title.startsWith("Pin 2 shelves")));
    assert.match((p.notes ?? []).join("\n"), /2 shelves \(4 adjustable pieces\)/);
    assert.doesNotMatch((p.notes ?? []).join("\n"), /5 adjustable shelf/);
  });

  it("a 10 inch storage unit is too short for a shelf", () => {
    for (const q of ["storage unit 10 inches tall", "storage unit 10 tall"]) {
      const p = generateFromPrompt(q);
      assert.equal(levels(p), 0, q);
      assert.equal(p.panels.length, 5, q);
      assert.equal(price(p), 76.86, q);
      assert.doesNotMatch((p.notes ?? []).join("\n"), /adjustable shelf/, q);
    }
  });

  it("an open cabinet and garage storage use the same 7 inch gap", () => {
    for (const q of ["open cabinet", "garage storage", "storage unit with doors"]) {
      const p = generateFromPrompt(q);
      assert.equal(levels(p), 2, q);
      assert.ok(clearGaps(p).every((g) => g + 1e-6 >= CLOSET_SHELF_CLEAR_IN), `${q} ${clearGaps(p).join(",")}`);
      assert.ok(p.panels.length < 18, q);
    }
  });

  it("purpose storage and the rack stand-in stay empty", () => {
    const rows: [string, number][] = [
      ["bike storage", 76.86],
      ["storage for bikes", 76.86],
      ["kayak storage", 76.86],
      ["firewood storage", 76.86],
      ["storage bed from wood", 76.86],
      ["wine storage", 95.83],
      [`${"bike"} rack`, 86.84],
      [`${"kayak"} rack`, 86.84],
    ];
    for (const [q, usd] of rows) {
      const p = generateFromPrompt(q);
      assert.equal(levels(p), 0, q);
      assert.equal(price(p), usd, q);
      assert.doesNotMatch((p.notes ?? []).join("\n"), /adjustable shelf/, q);
    }
  });

  it("frame stock and stock thicker than 1 1/2 inch grow no shelf rails", () => {
    const pvc = generateFromPrompt("pvc storage unit");
    assert.equal(pvc.panels.filter((x) => x.type === "shelf").length, 0);
    assert.equal(price(pvc), 42.04);
    const rod = generateFromPrompt("storage for board games", "closet-rod");
    assert.equal(rod.panels.filter((x) => x.type === "shelf").length, 0);
    assert.equal(price(rod), 142.94);
    const post = generateFromPrompt("storage unit", "lumber-4x4-8");
    assert.equal(levels(post), 0);
    const notes = (post.notes ?? []).join("\n");
    assert.match(notes, /Solid main box/);
    assert.doesNotMatch(notes, /adjustable shelf/);
  });

  it("a drawer carcase keeps its slides on the uprights", () => {
    const p = generateFromPrompt("storage unit with 1 drawer");
    const plan = buildPlan(p);
    const hang = plan.instructions.find((s) => /slides/i.test(s.title));
    assert.ok(hang, "drawer hang step");
    assert.match(hang!.description ?? "", /uprights/);
    assert.doesNotMatch(hang!.description ?? "", /dividers/);
    assert.equal(p.panels.some((x) => /^Center divider\b/.test(x.name)), false);
  });

  it("quarter-inch stock grows no pin shelves", () => {
    const p = generateFromPrompt("storage unit", "plywood-1-4-4x8");
    const plan = buildPlan(p);
    assert.equal(plan.instructions.some((s) => s.title.startsWith("Pin ")), false);
    assert.equal(plan.bom.some((b) => /shelf pin/i.test(b.name)), false);
  });

  it("a 3 inch cubby is still the wrong-size empty box", () => {
    const p = generateFromPrompt("storage cubby 3x3");
    assert.equal(levels(p), 0);
    assert.equal(genericFallbackBox(p), true);
    assert.match((p.notes ?? []).join("\n"), /Solid main box/);
    assert.doesNotMatch((p.notes ?? []).join("\n"), /adjustable shelf/);
    assert.equal(price(p), 62.43);
  });

  it("linen, bookcase, and shelving keep the shelves they already had", () => {
    const linen = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
    const plan = buildPlan(linen);
    assert.equal(linen.panels.length, 11);
    assert.equal(plan.bom.length, 8);
    assert.equal(plan.instructions.length, 9);
    assert.equal(plan.totals.estCostUsd, 193.68);
    assert.ok(clearGaps(linen).every((g) => g + 1e-6 >= CLOSET_SHELF_CLEAR_IN));
    assert.equal(levels(generateFromPrompt("shelving")), 3);
    assert.equal(levels(generateFromPrompt("bookcase")), 5);
  });
});
