import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { POCKET_DREAM } from "./pocket";

describe("inside counts change the plan", () => {
  it("a bookcase shelf count changes the cut list and steps", () => {
    const a = generateFromPrompt("bookcase 36 wide 60 tall 11 deep", "plywood-3-4-4x8");
    const spec = a.fitted!;
    const b = generateFromPrompt(a.prompt, "plywood-3-4-4x8", undefined, {
      fittedOverride: { ...spec, unit: { ...spec.unit, shelfCount: 3 } },
      honorUnit: true,
    });
    assert.equal(b.prompt, a.prompt);
    assert.equal(b.panels.filter((p) => p.type === "shelf").length, 3);
    const qty = (p: ReturnType<typeof generateFromPrompt>) =>
      buildPlan(p).cutList.map((c) => `${c.name}×${c.quantity}`).join("|") + buildPlan(p).instructions.map((s) => s.description).join("\n");
    assert.notEqual(qty(a), qty(b));
  });

  it("a pocket shelf count changes the shelves", () => {
    const a = generateFromPrompt(POCKET_DREAM);
    const pocket = a.pocket!;
    const b = generateFromPrompt(a.prompt, undefined, undefined, {
      pocketOverride: { ...pocket, unit: { ...pocket.unit, shelfRows: 2 } },
    });
    assert.equal(b.prompt, a.prompt);
    assert.equal(b.panels.filter((p) => p.type === "shelf").length, 4);
    const qty = (p: ReturnType<typeof generateFromPrompt>) => buildPlan(p).cutList.map((c) => `${c.name}×${c.quantity}`).join("|");
    assert.notEqual(qty(a), qty(b));
  });
});

import { applyInsideCount } from "./insideCount";

function planText(p: ReturnType<typeof generateFromPrompt>) {
  const plan = buildPlan(p);
  return (
    plan.cutList.map((c) => `${c.name}×${c.quantity}`).join("|") +
    "\n" +
    plan.instructions.map((s) => `${s.title} ${s.description}`).join("\n")
  );
}

describe("shelf-family counts drive the cut list", () => {
  it("bookshelf 36 wide: shelves 5 to 3 changes the cut list and the pin step", () => {
    const a = generateFromPrompt("bookshelf 36 wide");
    assert.equal(a.panels.filter((p) => p.type === "shelf").length, 5);
    const b = applyInsideCount(a, { shelves: 3 });
    assert.equal(b.panels.filter((p) => p.type === "shelf").length, 3);
    const text = planText(b);
    assert.notEqual(planText(a), text);
    assert.match(text, /Pin 3 adjustable shelves/);
    assert.doesNotMatch(text, /Pin 5 adjustable shelves/);
    assert.match(text, /Shelf×3/);
  });

  it("a shoe rack cubby count changes the dividers and the steps", () => {
    const a = generateFromPrompt("shoe rack 36 wide");
    const before = a.panels.filter((p) => p.type === "divider").length;
    const b = applyInsideCount(a, { cubbies: 4 });
    assert.equal(b.panels.filter((p) => p.type === "divider").length, 3);
    assert.notEqual(before, 3);
    assert.notEqual(planText(a), planText(b));
  });

  it("a drawer count changes the cut list and the steps", () => {
    const a = generateFromPrompt("drawer unit 24 wide");
    assert.equal(a.panels.filter((p) => p.type === "drawer").length, 3);
    const b = applyInsideCount(a, { drawers: 1 });
    assert.equal(b.panels.filter((p) => p.type === "drawer").length, 1);
    const text = planText(b);
    assert.notEqual(planText(a), text);
    assert.match(text, /Drawer front×1/);
    assert.doesNotMatch(text, /3 drawers/);
  });

  it("a shelf family with no fitted spec still changes the cut list", () => {
    const a = generateFromPrompt("bookshelf 36 wide");
    const bare = { ...a, fitted: undefined, recastFrom: undefined };
    const b = applyInsideCount(bare, { shelves: 2 });
    assert.equal(b.panels.filter((p) => p.type === "shelf").length, 2);
    assert.notEqual(planText(bare), planText(b));
    assert.match(planText(b), /Pin 2 adjustable shelves/);
  });
});
