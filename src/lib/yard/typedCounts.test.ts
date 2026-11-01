import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain";
import { i41 } from "./invariants";
import { builtCount, typedCounts, typedFeatures } from "./typedFeatures";

globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;

test("class F: a typed count is read as a count, 'no X' as zero, never a size", () => {
  assert.deepEqual(typedCounts("nightstand 20 wide 24 tall with 3 shelves"), { shelves: 3 });
  assert.deepEqual(typedCounts("6 drawer dresser with two doors"), { doors: 2, drawers: 6 });
  assert.deepEqual(typedCounts("closet with no rods"), { rods: 0 });
  assert.deepEqual(typedCounts("bookcase without shelves"), { shelves: 0 });
  assert.deepEqual(typedCounts("closet with 2 rails"), { rods: 2 });
  assert.deepEqual(typedCounts("bookcase 36 wide shelves"), {});
  assert.deepEqual(typedCounts("closet with two 1 1/4 rods"), { rods: 2 });
  assert.deepEqual(typedCounts("bed with 2 side rails"), {});
  assert.deepEqual(typedCounts("a holder for 6 fishing rods"), {});
  assert.deepEqual(typedCounts("6 drawer dresser no drawer slides"), { drawers: 6 });
  assert.deepEqual(typedCounts("dresser with no drawer slides"), {});
  assert.deepEqual(typedFeatures("wardrobe 80 tall with double hang"), ["double hang"]);
  assert.deepEqual(typedFeatures("pantry cabinet with pull out shelves"), ["shelves", "pull-outs"]);
});

test("class F: every typed feature word or count is built or named in a note (I41), never dropped", () => {
  const bad: string[] = [];
  for (const q of [
    "wardrobe 48 wide 80 tall 24 deep with double hang",
    "pantry cabinet 24 wide 7 ft tall 24 deep with pull out shelves",
    "nightstand 22 1/2 wide 28 tall 17 deep with an open shelf",
    "media console 38 wide 34 tall 18 deep with 1 shelf",
    "closet with no rods",
    "closet without rods",
    "closet with 2 rails",
    "bookcase with 0 shelves",
    "nightstand 20 wide 24 tall with 3 shelves",
  ]) {
    const p = generateFromPrompt(q);
    const vs = i41(p, q);
    if (vs.length) bad.push(`${q}: ${vs.map((v) => v.msg).join("; ")}`);
    if ((p.notes ?? []).some((n) => n.startsWith("Combined:"))) bad.push(`${q}: a typed part became a second product`);
  }
  assert.deepEqual(bad, []);
});

test("class F: I41 fires on each dropped feature or count once its note is taken away", () => {
  const quiet: string[] = [];
  for (const q of ["wardrobe 48 wide 80 tall 24 deep with double hang", "pantry cabinet 24 wide 7 ft tall 24 deep with pull out shelves", "closet with no rods", "closet with 2 rails", "bookcase with 0 shelves", "nightstand 20 wide 24 tall with 3 shelves"]) {
    const p = generateFromPrompt(q);
    const asked = (p.notes ?? []).filter((n) => /^You asked for/.test(n));
    if (asked.length !== 1) quiet.push(`${q}: ${asked.length} 'You asked for' notes`);
    if (!i41({ ...p, notes: (p.notes ?? []).filter((n) => !asked.includes(n)) }, q).length) quiet.push(`${q}: I41 silent without the note`);
  }
  assert.deepEqual(quiet, []);
});

test("class F controls: a count the build honours adds no note; a bare 'a shelf' on a frame is still its own product", () => {
  for (const q of ["dresser 60 wide 32 tall 20 deep with 9 drawers", "closet 5' wide 80 tall with 3 rods", "bookcase 48 wide with 3 shelves", "kitchen cart with 2 doors on casters", "dollhouse 2 doors 1 inch plywood"]) {
    const p = generateFromPrompt(q);
    if (p.kind !== "opening") assert.deepEqual(i41(p, q), [], q);
    assert.ok(!(p.notes ?? []).some((n) => /^You asked for/.test(n)), q);
  }
  // Shelves count by level, not by piece: 3 shelves across 3 bays are 3, not 9.
  assert.equal(builtCount(generateFromPrompt("bookcase 72 wide with 3 shelves"), "shelves"), 3);
  assert.ok((generateFromPrompt("picture frame with a shelf").notes ?? []).some((n) => n.startsWith("Combined:")));
});
