import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";

const o = (q: string) => generateFromPrompt(q).overall;

test("a lone size with no axis is the class's lead axis (its largest default)", () => {
  assert.equal(o('wall mounted spice rack 18 inches').width, 18);
  assert.equal(o("dining banquette 72 inches").width, 72);
  assert.equal(o("window seat 60 inches").width, 60);
  assert.equal(o('coat rack 40 inches').width, 40);
  assert.equal(o("outdoor deck box 5 ft").width, 60);
  assert.equal(o("bathroom towel ladder 4 ft").height, 48);
  assert.equal(o("painting easel 6 ft").height, 72);
  const ottoman = o("storage ottoman 36 square");
  assert.deepEqual([ottoman.width, ottoman.depth], [36, 36]);
});

test("a pair is the plan on a footprint, never a height; a front reads width x height", () => {
  for (const q of ["platform bed twin 39 by 75", "queen platform bed 60 by 80"]) assert.equal(o(q).height, 14, q);
  const coop = o("chicken coop 4 by 6");
  assert.deepEqual([coop.width, coop.depth].sort((a, b) => a - b), [48, 72]);
  assert.deepEqual([o("outdoor compost bin 3x3").width, o("outdoor compost bin 3x3").depth], [36, 36]);
  const doghouse = o("doghouse 3 by 4");
  assert.deepEqual([doghouse.width, doghouse.depth].sort((a, b) => a - b), [36, 48]);
  // Fronts and pairs a reader already placed stay as built.
  assert.deepEqual(o("closet system 80x120"), { width: 80, height: 120, depth: 24 });
  assert.equal(o("bookcase 36 by 72").height, 72);
  assert.equal(o("pergola 12x16").depth, 192);
});

test("counts, grids, a place preposition and the size of what a build holds never bind an axis: they build as on release", () => {
  assert.deepEqual(o("media console for a 75 inch TV"), { width: 69, height: 22, depth: 16 });
  assert.deepEqual(o("shelf for a 12 inch record"), { width: 36, height: 29, depth: 14 });
  assert.ok(o("12 washer stack").width < 1, "a bare 12 is a count of washers");
  // "in the corner" is a preposition. The reader takes that "in" as inches; the shelf stays the class height.
  assert.equal(o("corner shelf 6 by 6 in the corner of a room").height, 60);
});
