import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";

describe("a stock switch swaps the skin, never the form", () => {
  const base = generateFromPrompt("cedar garbage bin enclosure");
  for (const to of ["plywood-3-4-4x8", "lumber-1x4-8"]) {
    it(`garbage bin enclosure switched to ${to}`, () => {
      const p = generateFromPrompt("cedar garbage bin enclosure", to);
      assert.deepEqual(p.overall, base.overall);
      assert.deepEqual(p.panels.map((x) => x.name), base.panels.map((x) => x.name));
      assert.ok(!p.panels.some((x) => x.materialId === "lumber-1x6-8"), "no 1x6 left");
      assert.ok(p.panels.some((x) => x.materialId === to));
      assert.ok(!/cedar/i.test(p.name), p.name);
    });
  }
});
