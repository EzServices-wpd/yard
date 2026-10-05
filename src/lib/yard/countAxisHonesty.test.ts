import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { spokenShelfCount, spokenTierCount, typedDoorCount } from "./fittedShared";

const maxTop = (p: ReturnType<typeof generateFromPrompt>) => Math.max(...p.panels.map((x) => x.position.y + x.size.height));

describe("feature counts bind to their own noun", () => {
  it("2 doors and 6 shelves is 6 shelves and 2 doors", () => {
    for (const t of ["pantry cabinet with 2 doors and 6 shelves", "two doors and six shelves"]) {
      assert.equal(spokenShelfCount(t), 6, t);
      assert.equal(typedDoorCount(t), 2, t);
    }
    assert.equal(spokenShelfCount("10 inch deep 4 shelves"), 4, "a size number never becomes the count");
    assert.equal(spokenTierCount("2 doors 3 tiers"), 3);
    const p = generateFromPrompt("pantry cabinet with 2 doors and 6 shelves");
    assert.equal(p.panels.filter((x) => /^Shelf \d+$/.test(x.name)).length, 6);
    assert.equal(p.panels.filter((x) => /door$/i.test(x.name)).length, 2);
  });
});

describe("size axes bind by keyword first, defaults say Assumed", () => {
  it("diameter is both width and depth; letter H is height", () => {
    const p = generateFromPrompt("round side table dia 18 x 24 h");
    assert.deepEqual(p.overall, { width: 18, height: 24, depth: 18 });
  });

  it("shoe cubby: keywords and a bare furniture triple (W×D×H) build the typed height", () => {
    for (const t of ["shoe cubby 40 wide 18 deep 14 tall", "shoe cubby 40x18x14"]) {
      const p = generateFromPrompt(t);
      assert.deepEqual(p.overall, { width: 40, height: 14, depth: 18 }, t);
      assert.ok(maxTop(p) <= 14 + 1e-6, `${t}: geometry is as tall as the HUD`);
    }
  });

  it("an unknown noun with no size never claims a typed size", () => {
    const p = generateFromPrompt("flurbnik");
    const notes = p.notes ?? [];
    assert.ok(!notes.some((n) => /\btyped\b/i.test(n)), notes.join(" | "));
    for (const w of ["wide", "tall", "deep"]) assert.ok(notes.some((n) => new RegExp(`^Assumed .*\\b${w}\\b`).test(n)), w);
  });

  it("untyped axes get Assumed notes; a partly typed build notes only the default axis", () => {
    const pantry = generateFromPrompt("pantry with 2 doors and 6 shelves").notes ?? [];
    for (const w of ["wide", "tall", "deep"]) assert.ok(pantry.some((n) => new RegExp(`^Assumed .*\\b${w}\\b`).test(n)), w);
    const round = generateFromPrompt("round table 36 dia").notes ?? [];
    assert.ok(round.some((n) => /^Assumed 30" tall/.test(n)));
    assert.ok(!round.some((n) => /^Assumed .*\b(?:wide|deep)\b/.test(n)));
  });

  it("linen closet stays exact with no Assumed notes", () => {
    const p = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
    assert.deepEqual(p.overall, { width: 31.5, height: 78, depth: 16 });
    assert.ok(!(p.notes ?? []).some((n) => /^Assumed/.test(n)));
  });
});
