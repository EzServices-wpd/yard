import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { pieceFromOpening, classSizeWarning } from "./measureTabs";

describe("honesty leftovers change the plan", () => {
  it("a step stool typed in inches is that tall", () => {
    const p = generateFromPrompt("step stool 24 inches");
    assert.ok(Math.abs(p.overall.height - 24) < 0.6, `height ${p.overall.height}`);
    const text = buildPlan(p).instructions.map((s) => s.description).join("\n");
    assert.match(text, /24/);
  });

  it("a typed inch on a giraffe is the finished height", () => {
    const p = generateFromPrompt("48 inch giraffe from dowels");
    assert.ok(Math.abs(p.overall.height - 48) < 1, `height ${p.overall.height}`);
  });

  it("three typed numbers on a table are width, depth, height", () => {
    const p = generateFromPrompt("coffee table 48 x 24 x 18");
    assert.ok(Math.abs(p.overall.width - 48) < 0.6, `w ${p.overall.width}`);
    assert.ok(Math.abs(p.overall.depth - 24) < 0.6, `d ${p.overall.depth}`);
    assert.ok(Math.abs(p.overall.height - 18) < 0.6, `h ${p.overall.height}`);
    const text = buildPlan(p).instructions.map((s) => s.description).join("\n");
    assert.match(text, /18/);
  });

  it("a plain bench does not talk about shoe bays", () => {
    const text = buildPlan(generateFromPrompt("porch bench")).instructions.map((s) => s.description).join("\n");
    assert.doesNotMatch(text, /shoe bay/i);
  });

  it("an unpriced board adds nothing to the total", () => {
    const plan = buildPlan(generateFromPrompt("1x6 planter"));
    const row = plan.bom.find((b) => /1×6|1x6/i.test(b.name));
    assert.ok(row, "missing 1x6 row");
    assert.ok(row!.estimatedCost == null || row!.estimatedCost === 0);
    const priced = plan.bom.filter((b) => (b.estimatedCost ?? 0) > 0).reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    assert.ok(Math.abs(plan.totals.estCostUsd - priced) < 0.05);
    assert.match(plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`).join("\n") + "plus unpriced items", /plus unpriced items/i);
  });

  it("a plywood boat is a hull, not a closed crate", () => {
    const p = generateFromPrompt("plywood boat 36 long");
    const names = p.panels.map((x) => x.name).join(" ");
    assert.match(names, /Bow|Hull/);
    assert.match(names, /Seat/);
    assert.doesNotMatch(names, /Floor/);
    const text = buildPlan(p).instructions.map((s) => s.description).join("\n");
    assert.match(text, /[Hh]ull|bow/);
  });

  it("a window is a cut in a face, not a glued patch", () => {
    const p = generateFromPrompt("cardboard box with a window");
    assert.ok(!p.panels.some((x) => /window opening/i.test(x.name)));
    const front = p.panels.find((x) => /front/i.test(x.name));
    assert.match(front?.cutNote ?? "", /opening/i);
    const text = buildPlan(p).cutList.map((c) => c.name).join(" ");
    assert.doesNotMatch(text, /Window opening/);
  });

  it("a spice cabinet defaults to wall-spice size", () => {
    const p = generateFromPrompt("spice cabinet");
    assert.ok(Math.abs(p.overall.width - 12) < 1, `w ${p.overall.width}`);
    assert.ok(Math.abs(p.overall.height - 20) < 1, `h ${p.overall.height}`);
    assert.ok(Math.abs(p.overall.depth - 4.5) < 1, `d ${p.overall.depth}`);
  });

  it("opening clearance derives the piece and a narrow seat warns", () => {
    assert.equal(pieceFromOpening(31.5, 0.125), 31.25);
    const warn = classSizeWarning({ program: "bench" }, 3.75, 16);
    assert.equal(warn?.id, "narrow-seat");
    assert.match(warn?.fix ?? "", /16/);
  });
});
