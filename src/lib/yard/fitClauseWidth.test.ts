import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { checkBuild } from "./invariants.ts";
import { headerTitle } from "./pdf.ts";
import { sizePhrases } from "./sizePhrases.ts";

/**
 * Class C2/F2 fit clause: a measure that names the space a build has to fit into is the build's outer width,
 * on every builder. Each prompt below failed I21 on main 4d98267 (model 36/48/20 wide, the class default).
 */
const FIT: [string, number][] = [
  ["broom closet cabinet to fit a 22 inch gap 80 tall 14 deep", 22],
  ["pantry shelves for a 24 inch nook", 24],
  ["bookcase to fit a 30 inch space", 30],
  ["shoe cabinet for a 28 inch gap", 28],
  ["desk to fit a 50 inch wall", 50],
  ["bookshelf for a 40 inch wall", 40],
  ["nightstand for a 18 inch space", 18],
  ["wardrobe that fits in a 30 inch space", 30],
  ["linen cabinet to fit a 20 inch gap", 20],
  ["kitchen island to fit a 5 foot space", 60],
  ["dresser to fit a 40 inch wall", 40],
  ["shoe rack for a 26 inch entry", 26],
  ["coat rack to fit a 30 inch wall", 30],
  ["toy chest for a 30 inch nook", 30],
  ["headboard for a 60 inch bed", 60],
  ["workbench to fit a 6 foot wall", 72],
  ["cabinet that fits into a 26 inch gap", 26],
];

describe("a fit-clause measure is the build's outer width on every builder", () => {
  for (const [q, w] of FIT) {
    it(q, () => {
      const p = generateFromPrompt(q);
      assert.ok(Math.abs(p.overall.width - w) <= 0.5, `${q}: model ${p.overall.width}" wide, asked to fit ${w}"`);
      assert.deepEqual(checkBuild(p, q).filter((v) => v.id === "I21"), []);
      assert.doesNotMatch(headerTitle(p), /W assumed|size assumed/);
      // The fit clause builds the same object as typing the width: same model, cut list and Buy total.
      const twin = generateFromPrompt(sizePhrases(q).prompt);
      assert.equal(p.name, twin.name);
      assert.deepEqual(p.overall, twin.overall);
      const a = buildPlan(p);
      const b = buildPlan(twin);
      assert.equal(a.totals.estCostUsd, b.totals.estCostUsd);
      assert.equal(a.cutList.reduce((n, c) => n + c.quantity, 0), b.cutList.reduce((n, c) => n + c.quantity, 0));
    });
  }
});

describe("fit-clause edges", () => {
  it("a typed width wins over the fit clause", () => {
    assert.equal(generateFromPrompt("bookcase 28 wide to fit a 30 inch space").overall.width, 28);
  });
  it("feet read as feet", () => {
    assert.deepEqual(sizePhrases("bench to fit a 4 foot wall").axes, { width: 48 });
  });
  it("a screen keeps its diagonal rule", () => {
    assert.deepEqual(sizePhrases("tv stand for a 55 inch tv").axes, { width: 52 });
    assert.deepEqual(sizePhrases("desk for a 27 inch monitor").axes, {});
  });
  it("the noun stays in the prompt so the build still routes", () => {
    assert.equal(sizePhrases("pantry shelves for a 24 inch nook").prompt, "pantry shelves for a nook 24 wide");
  });
  it("a measure under 12\" is a part size, never the build width", () => {
    assert.deepEqual(sizePhrases("birdhouse for a 6 inch hole").axes, {});
  });
});
