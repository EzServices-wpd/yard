import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { meetingPairs, MEETING_GAP } from "./pairedLeaves.ts";

describe("A pair of doors meets with 1/8\" total (1/16\" each side)", () => {
  for (const prompt of ["pocket vanity", "linen closet 31.5 wide 78 tall 16 deep", "kitchen base cabinet 36 wide"]) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      const pairs = meetingPairs(project).filter(([a]) => a.type === "door" || /door/i.test(a.name));
      assert.ok(pairs.length >= 1, "has a meeting pair of doors");
      for (const [a, b, gap] of pairs) {
        assert.ok(Math.abs(gap - MEETING_GAP) < 1 / 64, `${a.name} | ${b.name} gap ${gap}`);
        // Leaf widths are on the 1/8" grid, so the cut list is the model.
        for (const p of [a, b]) assert.ok(Math.abs(p.size.width * 8 - Math.round(p.size.width * 8)) < 1e-6, `${p.name} ${p.size.width}`);
      }
      const hinges = buildPlan(project).bom.find((l) => /hinge/i.test(l.name));
      if (hinges) assert.ok(hinges.quantity >= 1);
    });
  }
  it("linen carcase stays 31 1/2 × 78 × 16", () => {
    const p = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
    assert.deepEqual([p.overall.width, p.overall.height, p.overall.depth], [31.5, 78, 16]);
  });
});
