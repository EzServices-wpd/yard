import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPlan } from "./report";
import { generateFromPrompt } from "./promptMain";
import {
  bayClearTalk,
  changeLine,
  clearanceTalk,
  commitInch,
  factsFromProject,
  fitsASpace,
  measureTabs,
  measureWarnings,
  pieceFromOpening,
  sheetCountOf,
  stampCount,
} from "./measureTabs";

describe("measure tabs", () => {
  it("every class opens with Your piece and Stock and joints", () => {
    const classes = [
      { kind: "weekend" },
      { kind: "closet" },
      { pocket: true },
      { fitted: true, program: "bookcase" },
      { fitted: true, program: "table" },
      { corner: true },
    ];
    for (const facts of classes) {
      const ids = measureTabs(facts).map((t) => t.id);
      assert.ok(ids.includes("piece"), `piece missing on ${JSON.stringify(facts)}`);
      assert.ok(ids.includes("stock"), `stock missing on ${JSON.stringify(facts)}`);
    }
  });

  it("a freestanding shelf or bench does not open Your space", () => {
    assert.equal(fitsASpace({ fitted: true, program: "bookcase" }), false);
    assert.equal(fitsASpace({ fitted: true, program: "bench" }), false);
    assert.ok(!measureTabs({ fitted: true, program: "bookcase" }).some((t) => t.id === "space"));
    assert.equal(fitsASpace({ fitted: true, program: "closet", openingKind: "alcove" }), true);
    assert.equal(fitsASpace({ pocket: true }), true);
    assert.equal(fitsASpace({ kind: "opening" }), true);
    assert.equal(fitsASpace({ corner: true }), true);
    assert.equal(fitsASpace({ oddKind: "sloped" }), true);
    assert.equal(fitsASpace({ installMode: "alcove" }), true);
    assert.equal(fitsASpace({ kind: "weekend" }), false);
    assert.ok(measureTabs({ fitted: true, program: "vanity", openingKind: "alcove" }).some((t) => t.id === "space"));
    assert.ok(!measureTabs({ kind: "weekend" }).some((t) => t.id === "space"));
  });

  it("inside appears only when the model has shelves, drawers, cubbies, doors or tiers", () => {
    assert.ok(measureTabs({ shelves: 3 }).some((t) => t.id === "inside"));
    assert.ok(measureTabs({ doors: true }).some((t) => t.id === "inside"));
    assert.ok(measureTabs({ cubbies: 4 }).some((t) => t.id === "inside"));
    assert.ok(!measureTabs({ shelves: 0, cubbies: 0 }).some((t) => t.id === "inside"));
  });

  it("accepts 3/4, 3-3/4, 3 3/4 and 36.5 and shows sixteenths", () => {
    assert.equal(commitInch("3/4").text, "3/4");
    assert.equal(commitInch("3-3/4").text, "3 3/4");
    assert.equal(commitInch("3 3/4").text, "3 3/4");
    assert.equal(commitInch("36.5").text, "36 1/2");
    assert.equal(commitInch("31 1/").ready, false);
  });

  it("clearance and warnings stay positive and suggest a fix", () => {
    assert.match(clearanceTalk(32, 31.5, 0.125).line, /to spare/);
    const tight = measureWarnings({ openingW: 31, pieceW: 31.25, clearance: 0.125 });
    assert.equal(tight[0]?.id, "tight");
    assert.match(tight[0]?.text ?? "", /narrower/);
    assert.equal(tight[0]?.fix, "Shrink to fit");
    const span = measureWarnings({ shelfSpan: 48, hasDivider: false });
    assert.match(span[0]?.text ?? "", /middle support/);
  });

  it("shrink to fit is the opening minus clearance a side", () => {
    assert.equal(pieceFromOpening(31, 0.125), 30.75);
    const tight = measureWarnings({ openingW: 31, pieceW: 31, clearance: 0.125 });
    assert.equal(tight[0]?.id, "tight");
    const fitted = measureWarnings({ openingW: 31, pieceW: pieceFromOpening(31, 0.125), clearance: 0.125 });
    assert.equal(fitted.length, 0);
  });

  it("change line names shelves and sheets", () => {
    assert.equal(changeLine({ shelves: 2, sheets: 1, steps: 4 }, { shelves: 4, sheets: 2, steps: 5 }), "2 shelves added, Buy +1 sheet");
  });

  it("bay talk uses the clear opening", () => {
    assert.match(bayClearTalk(14.875, 8, true), /14 7\/8/);
    assert.match(bayClearTalk(14.875, 8, true), /size-12 shoe/);
    assert.doesNotMatch(bayClearTalk(14.875, 8), /shoe/);
  });

  it("changing a size updates Buy and steps", () => {
    const narrow = generateFromPrompt("bookcase 24 wide 48 tall 11 deep", "plywood-3-4-4x8");
    const wide = generateFromPrompt("bookcase 60 wide 48 tall 11 deep", "plywood-3-4-4x8");
    const a = buildPlan(narrow);
    const b = buildPlan(wide);
    const sheets = (p: ReturnType<typeof buildPlan>) => sheetCountOf(p.sheetNest);
    const buy = (p: ReturnType<typeof buildPlan>) => p.bom.map((l) => `${l.name}:${l.quantity}`).join("|");
    const steps = (p: ReturnType<typeof buildPlan>) => p.instructions.map((s) => s.description).join("\n");
    assert.notEqual(buy(a) + sheets(a), buy(b) + sheets(b), "Buy did not move when the bookcase got wider");
    assert.notEqual(steps(a), steps(b), "steps did not move when the bookcase got wider");
    assert.ok(factsFromProject(wide).shelves != null);
  });

  it("stampCount keeps the noun", () => {
    assert.equal(stampCount("pine bookcase 36 wide", "shelves", 5), "pine bookcase 36 wide with 5 shelves");
    assert.equal(stampCount("bookcase with 3 shelves", "shelves", 5), "bookcase with 5 shelves");
  });
});
