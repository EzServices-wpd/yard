/**
 * I42 · one spec per prompt, read by the PDF cover: a typed size is built or refused, never "assumed"; an assumed size
 * is the built unit, never the room a pocket unit stands in. Expected values are hand-worked from the prompts and the
 * canary plans, not recomputed the way the code does.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateFromPrompt } from "./promptMain";
import { typedAxesTalk } from "./pdf";
import { typedAssumedFailures } from "./typedNotAssumed";
import { labeledAxisValues } from "./typedAxesRead";

const cover = (q: string) => typedAxesTalk(generateFromPrompt(q)).subtitle;
const i42 = (q: string) => typedAssumedFailures(generateFromPrompt(q), q);

test("pocket vanity canary (nothing typed): the cover assumes the 38 x 102 unit, never the 48 7/8 x 104 x 35 1/2 room pocket", () => {
  for (const q of ["pocket vanity", "house: bathroom pocket vanity original trapezoid"]) {
    assert.equal(cover(q), '38" wide, 102" tall and 17 3/4" deep assumed, measure to lock · doors and drawer fronts stand proud', q);
    assert.deepEqual(i42(q), [], q);
  }
});

test("typed pocket vanity (the walk prompt types the 38 x 17 x 102 unit): nothing on the cover is assumed", () => {
  const walk = readFileSync(new URL("../../../scripts/walk-launch.ts", import.meta.url), "utf8").match(/prompt: `([\s\S]*?)`/)![1];
  assert.doesNotMatch(cover(walk), /assumed|you typed/);
  assert.deepEqual(i42(walk), []);
});

test("linen and desk canaries: fully typed, nothing assumed", () => {
  assert.equal(cover("linen closet 31.5 wide 78 tall 16 deep"), '31 1/2" wide x 78" tall x 16" deep · doors stand proud');
  for (const q of ["desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space", "desk 60x30x29 with a 24 inch knee"]) {
    assert.equal(cover(q), '60" wide x 29" tall x 30" deep · drawer fronts stand proud', q);
    assert.deepEqual(i42(q), [], q);
  }
});

test("one, two or three typed axes: the cover marks assumed only the axes not typed", () => {
  const rows: [string, RegExp][] = [
    ["bookcase 30 wide", /^30" wide · 84" tall and 12" deep assumed/],
    ["bookcase 30 wide 48 tall", /^30" wide x 48" tall · 12" deep assumed/],
    ["bookcase 30 wide 48 tall 11 deep", /^30" wide x 48" tall x 11" deep$/],
    // Feet with an axis word are typed: "5 ft tall" is a typed 60" height (was "size assumed").
    ["towel ladder 5 ft tall", /^60" tall · 20" wide and 3 1\/2" deep assumed/],
    // A bed reads long x wide: 44 wide is the bed's typed depth, only its height is assumed.
    ["bunk bed 82 long 44 wide", /^82" wide x 44" deep · 65" tall assumed/],
    ["cedar planter box 36 long 12 wide 12 tall", /^36" wide x 12" tall x 12" deep$/],
    ["cabinet 12 1/2 deep", /^12 1\/2" deep · 12" wide and 30" tall assumed/],
  ];
  for (const [q, want] of rows) {
    assert.match(cover(q), want, q);
    assert.deepEqual(i42(q), [], q);
  }
  // A typed size built at another size names both (the shoe rack's door is 48" wide; the build is not changed here).
  assert.match(cover("shoe rack by the door 36 inches wide"), /^48" wide \(you typed 36"\)/);
});

test("typed sizes read the shop way: fractions and feet-and-inches, never decimals", () => {
  assert.deepEqual(labeledAxisValues("bookcase 18 1/2 wide 30 tall 8 deep"), { width: 18.5, height: 30, depth: 8 });
  assert.deepEqual(labeledAxisValues("bench 18-1/2 wide"), { width: 18.5 });
  assert.deepEqual(labeledAxisValues(`bookcase 1' 6 1/2" wide`), { width: 18.5 });
  assert.deepEqual(labeledAxisValues("towel ladder 5 ft tall"), { height: 60 });
  // With a "long" typed, "wide" may be the depth: the form decides, so the word reader leaves width out.
  assert.deepEqual(labeledAxisValues("cedar planter box 36 long 12 wide 12 tall"), { height: 12 });
});

test("one spec, built at intake: noun, typed/assumed axes, counts, features, stock, species, refusal; the cover follows it", () => {
  const p = generateFromPrompt("oak bookcase 30 wide 48 tall with 3 shelves and doors");
  const s = p.spec!;
  assert.equal(s.noun.toLowerCase().includes("bookcase"), true, s.noun);
  assert.deepEqual([s.size.width.typed, s.size.height.typed, s.size.depth.typed], [true, true, false]);
  assert.deepEqual([s.size.width.assumed, s.size.height.assumed, s.size.depth.assumed], [false, false, true]);
  assert.equal(s.counts.shelves, 3);
  assert.ok(s.features.includes("doors") && s.features.includes("shelves"), s.features.join());
  assert.equal(s.species, "Oak");
  assert.equal(s.stockId, p.primaryMaterialId);
  assert.equal(s.refusal, null);
  // Flip the spec and the cover follows it: the cover never decides on its own.
  const flipped = { ...p, spec: { ...s, size: { ...s.size, width: { ...s.size.width, assumed: true }, depth: { ...s.size.depth, assumed: false } } } };
  assert.match(typedAxesTalk(flipped).subtitle, /^48" tall x 12" deep · 30" wide assumed/);
  // A bench edit (a size override) types every axis: nothing on the cover is assumed.
  const edited = generateFromPrompt("bookcase 30 wide", undefined, undefined, { sizeOverride: { width: 30, height: 60, depth: 10 } } as never);
  assert.doesNotMatch(typedAxesTalk(edited).subtitle, /assumed/);
});
