import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";

const stockOf = (q: string, re: RegExp) => generateFromPrompt(q).panels.filter((p) => re.test(p.name)).map((p) => p.materialId);

describe("a frame that carries a heavy load is 2× lumber; sheet only for real panels", () => {
  it("workbench: 2x4 legs and aprons under a plywood top", () => {
    assert.ok(stockOf("workbench", /apron/i).every((m) => m === "lumber-2x4-8"));
    assert.ok(stockOf("workbench", /top/i).every((m) => /^plywood-/.test(m)));
  });
  it("daybed apron and coop rail are 2x", () => {
    assert.ok(stockOf("daybed", /apron/i).every((m) => /^lumber-2x/.test(m)));
    assert.ok(stockOf("chicken coop", /bottom rail/i).every((m) => /^lumber-2x/.test(m)));
  });
  it("queen platform bed is 14 in low on a lumber frame", () => {
    const p = generateFromPrompt("queen platform bed");
    assert.equal(p.overall.height, 14);
    assert.ok(stockOf("queen platform bed", /rail|leg/i).every((m) => /^lumber-/.test(m)));
  });
  it("the envelope is the same on any stock", () => {
    const a = generateFromPrompt("workbench").overall;
    const b = generateFromPrompt("workbench", "plywood-3-4-4x8").overall;
    assert.deepEqual(a, b);
  });
});
