/**
 * I29 (F12 one letter per piece, refiner pass A 10-17): a step that gives a part's size uses the letter of the cut
 * line with that size. Wide carcases cut center supports at two or three heights, so several cut lines share one
 * name (F 13 3/4", G 13 × 11 3/4", H 13 × 11 1/2"). The step lettered every support with the first line's letter,
 * so a stranger following "F Center support 1 — 13 × 11 3/4" picked up the 13 3/4" board. Before the fix every build
 * below failed I29; after it none does.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";
import { densifyPartsPlateTalk } from "./voiceHonesty";
import type { CutLine } from "./types";

const SWEEP = [
  "built-in bookcase 48 wide 84 tall 12 deep", "bookcase 40 wide 72 tall 12 deep", "bookshelf 44 wide 60 tall 10 deep",
  "bookcase 60 wide 84 tall 12 deep", "pantry shelves 42 wide 84 tall 16 deep", "garage shelves 48 wide 72 tall 18 deep",
  "cubby shelf 48 wide 36 tall 12 deep", "storage cabinet 40 wide 72 tall 16 deep", "laundry shelves 46 wide 60 tall 14 deep",
  "office bookcase 52 wide 80 tall 13 deep", "bookcase 39.5 wide 63.5 tall 12.5 deep", "bookcase 45.5 wide 88 tall 10.5 deep",
  "bookshelf 50 wide 48 tall 12 deep", "bookcase 56 wide 72 tall 14 deep", "pantry cabinet 44 wide 80 tall 18 deep",
  "closet shelves 48 wide 84 tall 14 deep", "book shelf 42 wide 30 tall 11 deep", "bookcase 64 wide 90 tall 12 deep",
  "utility shelves 40 wide 60 tall 20 deep", "bookcase 72 wide 84 tall 12 deep",
];

describe("I29: a sized part in a step carries its own cut-list letter", () => {
  for (const q of SWEEP) {
    it(q, () => {
      const p = generateFromPrompt(q);
      const plan = buildPlan(p);
      const names = plan.cutList.map((c) => c.name.toLowerCase());
      assert.ok(names.some((n, i) => names.indexOf(n) !== i), `${q}: no two cut lines share a name, so it is not in the class`);
      assert.deepEqual(checkBuild(p, q, plan).filter((x) => x.id === "I29").map((x) => x.msg), []);
    });
  }

  it("the size after the name picks between same-named cut lines", () => {
    const line = (label: string, lengthIn: number, widthIn: number): CutLine =>
      ({ id: label, name: "Center support", quantity: 1, lengthIn, widthIn, thicknessIn: 0.75, label }) as CutLine;
    const cut = [line("F", 13.75, 11.5), line("G", 13, 11.75), line("H", 13, 11.5)];
    const said = densifyPartsPlateTalk('Center support 1 — 13 × 11 3/4 × 3/4"; Center support 2 — 13 × 11 1/2 × 3/4"; Center support 6 — 13 3/4 × 11 1/2 × 3/4".', cut);
    assert.match(said, /^G Center support 1 — 13 × 11 3\/4/);
    assert.match(said, /H Center support 2 — 13 × 11 1\/2/);
    assert.match(said, /F Center support 6 — 13 3\/4 × 11 1\/2/);
  });
});
