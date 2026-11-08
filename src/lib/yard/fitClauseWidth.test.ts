import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { checkBuild } from "./invariants.ts";
import { headerTitle } from "./pdf.ts";
import { sizePhrases } from "./sizePhrases.ts";

/**
 * Class C2/F2 fit clause (I21): only the measure of a SPACE the build fills (gap, space, nook, alcove, opening, wall,
 * entry, "the N inches between …") sets its outer width, on every builder. Each prompt below failed I21 before the
 * fit rule (model 36/48/20 wide, the class default).
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
  ["bookshelf in a 24 inch nook", 24],
  ["pantry shelves in a 24 inch nook", 24],
  ["bookcase in a 30 inch alcove", 30],
  ["shelf for the 30 inches between the fridge and wall", 30],
  ["shoe rack for a 30\" space", 30],
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

/** A typed width or typed size always wins over the fit clause, and the typed axes keep their order. */
const TYPED: [string, number, number, number][] = [
  ["bookcase 28 x 12 x 72 to fit a 30 inch space", 28, 12, 72],
  ["bookcase 28\" x 12\" x 72\" for a 30\" space", 28, 12, 72],
  ["bookcase 28 by 12 by 72 to fit a 30 inch gap", 28, 12, 72],
  ["bookcase 30 by 12 by 72 for a 34 inch nook", 30, 12, 72],
  ["shoe rack 30x12x18 for a 28 inch gap", 30, 12, 18],
  ["nightstand 20 x 16 x 24 for a 22 inch space", 20, 16, 24],
  ["cabinet 24w x 16d x 30h to fit a 26 inch gap", 24, 16, 30],
  ["cabinet 24w 16d 30h to fit a 26 inch gap", 24, 16, 30],
];
const TYPED_W: [string, number][] = [
  ["bench 48 x 16 for a 5 foot wall", 48],
  ["desk 60x30 for a 6 foot wall", 60],
  ["pantry 24 x 16 x 84 for a 26 inch nook", 24],
  ["cabinet 30w to fit a 32 inch space", 30],
  ["bookcase 28 wide to fit a 30 inch space", 28],
  ["28 inch wide shoe rack to fit a 32 inch gap", 28],
];
describe("a typed width or size wins over the fit clause, axes in typed order", () => {
  for (const [q, w, d, h] of TYPED) {
    it(q, () => {
      const p = generateFromPrompt(q);
      assert.deepEqual([p.overall.width, p.overall.depth, p.overall.height], [w, d, h], q);
      assert.deepEqual(checkBuild(p, q).filter((x) => x.id === "I21"), []);
      // Same build as the same words without the fit measure: the measure adds nothing over a typed size.
      const alone = generateFromPrompt(q.replace(/\s(\d+)\s*(?:inch|")\s+(?=[a-z]+$)/, " "));
      assert.equal(buildPlan(p).totals.estCostUsd, buildPlan(alone).totals.estCostUsd);
    });
  }
  for (const [q, w] of TYPED_W) {
    it(q, () => {
      const p = generateFromPrompt(q);
      assert.equal(p.overall.width, w, q);
      assert.deepEqual(checkBuild(p, q).filter((x) => x.id === "I21"), []);
    });
  }
});

/**
 * Heights, people and objects are never widths: the build is the one the same words make without the measure across
 * and front to back (a ceiling may still set or cap the height). Each failed I21 on the fit rule before this fix
 * (84/60/22 wide, bunk and loft beds 84/96 wide, nightstand and step stool tripping I7).
 */
const NOT_SPACE: string[] = [
  "wardrobe for a 7 foot ceiling",
  "bookcase for an 8 foot ceiling",
  "bookshelf for a 9 foot ceiling",
  "bunk bed for a 7 foot ceiling",
  "bunk bed for an 8 foot ceiling",
  "loft bed for an 8 foot ceiling",
  "loft bed for a 7 foot ceiling",
  "cat tree for an 8 foot ceiling",
  "cat tree for a 6 foot ceiling",
  "step stool for a 5 foot kid",
  "step stool for a 4 foot child",
  "nightstand for a 6 foot person",
  "nightstand for a 5 foot kid",
  "crib for a 5 foot mom",
  "bookcase for a 6 foot man",
  "shelf for a 22 inch vase",
  "record shelf for a 12 inch record",
  "easel for a 24 inch canvas",
  "dresser for a 30 inch lamp",
  "desk for a 24 inch printer",
  "headboard for a 60 inch bed",
  "loft ladder for a 6 foot loft",
  "bookshelf for a 10 foot room",
  "desk for my 10 ft office",
];
describe("a height, person or object is never the width", () => {
  for (const q of NOT_SPACE) {
    it(q, () => {
      const sp = sizePhrases(q);
      assert.equal(sp.axes.width, undefined, `${q}: read as ${sp.axes.width}" wide`);
      const p = generateFromPrompt(q);
      assert.deepEqual(checkBuild(p, q).filter((x) => x.id === "I21" || x.id === "I7"), []);
      const ceiling = q.match(/(\d+) (?:foot|ft) ceiling/);
      if (ceiling) assert.ok(p.overall.height <= Number(ceiling[1]) * 12, `${q}: ${p.overall.height}" tall`);
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
