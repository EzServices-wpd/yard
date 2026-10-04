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
