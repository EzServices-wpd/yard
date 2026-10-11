import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { engineOwnsForm } from "./form.ts";

const firstStep = (prompt: string, re: RegExp) =>
  buildPlan(generateFromPrompt(prompt)).instructions.findIndex((s) => (s.partsUsed ?? []).some((n) => re.test(n)));

describe("each part goes on after the part that carries it", () => {
  it("firewood rack: base rails before the uprights screwed to them", () => {
    assert.ok(firstStep("firewood rack", /^Base rail/) < firstStep("firewood rack", /^Upright/));
  });
  it("baby gate: frame before the pickets on its face", () => {
    const pickets = firstStep("baby gate", /^Picket/);
    for (const f of [/^Hinge stile$/, /^Latch stile$/, /^Bottom rail$/, /^Top rail$/]) assert.ok(firstStep("baby gate", f) < pickets, String(f));
  });
});

describe("named builds stay the engine's form", () => {
  for (const q of ["bar stool", "firewood rack", "baby gate", "mirror frame 24 by 36", "sandbox cover 4 by 4"]) {
    it(q, () => assert.ok(engineOwnsForm(q, generateFromPrompt(q))));
  }
});

describe("scale and fit", () => {
  it("dollhouse bed is a miniature", () => {
    const o = generateFromPrompt("dollhouse bed").overall;
    assert.ok(Math.max(o.width, o.height, o.depth) <= 12, JSON.stringify(o));
  });
  it("32 inch tv stand carries a 32 inch TV", () => {
    const w = generateFromPrompt("32 inch tv stand").overall.width;
    assert.ok(w >= 32 && w >= 32 * 0.872 + 6, String(w));
  });
});

describe("lemonade stand is a stand", () => {
  const p = generateFromPrompt("lemonade stand");
  it("has a counter, sign board, awning and posts", () => {
    for (const re of [/^Counter$/, /^Sign board$/, /^Awning$/, /^Post /]) assert.ok(p.panels.some((x) => re.test(x.name)), String(re));
    assert.ok(p.overall.height > 60, JSON.stringify(p.overall));
  });
  it("engine owns it", () => assert.ok(engineOwnsForm("lemonade stand", p)));
  it("parts go on after their supports", () => {
    const f = (re: RegExp) => firstStep("lemonade stand", re);
    assert.ok(f(/^Post /) < f(/^Counter apron/));
    assert.ok(f(/^Counter apron/) < f(/^Counter$/));
    assert.ok(f(/^Top rail/) < f(/^Awning$/));
    assert.ok(f(/^Top rail/) < f(/^Sign board$/));
  });
});
