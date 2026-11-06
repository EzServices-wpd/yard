/**
 * I29 (F12 one letter per piece, refiner pass A 10-17): a step that gives a part's size uses the letter of the cut
 * line with that size. A cubby still stacks center supports at two or three heights (F 13 3/4", G 13 × 11 3/4",
 * H 13 × 11 1/2"). The step lettered every one of them with the first line's letter, so a stranger following
 * "F Center support 1 — 13 × 11 3/4" picked up the 13 3/4" board. Those builds stay in that class, and none fails I29.
 * A wide shelf span used to leave two Shelf lines when divider stations missed an eighth. Equal clear bays merge
 * those into one cut line. Those fixtures expect that one length. The size after the name still picks the letter.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";
import { densifyPartsPlateTalk } from "./voiceHonesty";
import type { CutLine } from "./types";

/** Still two sizes on one name (center supports at more than one height). */
const TWO_SIZES = [
  "cubby shelf 40 wide 36 tall 12 deep", "cubby shelf 44 wide 36 tall 12 deep", "cubby shelf 48 wide 36 tall 12 deep",
  "cubby shelf 52 wide 36 tall 12 deep", "cubby shelf 56 wide 36 tall 14 deep", "cubby shelf 60 wide 48 tall 12 deep",
  "cubby shelf 42 wide 72 tall 12 deep",
];

/**
 * Equal clear bays collapse the two Shelf cut lines into one. The length is the cut list's 1/8" reading
 * of that shared bay. I29 stays clean: one line, one letter.
 */
const EQUAL_SHELF: [string, number][] = [
  ["bookcase 64 wide 90 tall 12 deep", 20.375],
  ["bookcase 72 wide 84 tall 12 deep", 23],
  ["bookcase 62 wide 72 tall 12 deep", 19.625],
  ["bookshelf 66 wide 60 tall 10 deep", 21],
  ["pantry shelves 68 wide 84 tall 16 deep", 21.625],
  ["garage shelves 70 wide 72 tall 18 deep", 22.375],
  ["office bookcase 76 wide 80 tall 13 deep", 24.375],
  ["built-in bookcase 80 wide 84 tall 12 deep", 25.625],
  ["closet shelves 64 wide 84 tall 14 deep", 20.375],
  ["laundry shelves 66 wide 60 tall 14 deep", 21],
  ["utility shelves 72 wide 60 tall 20 deep", 23],
  ["storage cabinet 64 wide 72 tall 16 deep", 20.375],
  ["pantry cabinet 68 wide 80 tall 18 deep", 21.625],
  ["bookcase 96 wide 84 tall 12 deep", 23.125],
];

describe("I29: a sized part in a step carries its own cut-list letter", () => {
  for (const q of TWO_SIZES) {
    it(q, () => {
      const p = generateFromPrompt(q);
      const plan = buildPlan(p);
      const names = plan.cutList.map((c) => c.name.toLowerCase());
      assert.ok(names.some((n, i) => names.indexOf(n) !== i), `${q}: no two cut lines share a name, so it is not in the class`);
      assert.deepEqual(checkBuild(p, q, plan).filter((x) => x.id === "I29").map((x) => x.msg), []);
    });
  }

  for (const [q, lengthIn] of EQUAL_SHELF) {
    it(`${q} has one equalized shelf length`, () => {
      const p = generateFromPrompt(q);
      const plan = buildPlan(p);
      const shelves = plan.cutList.filter((c) => /^shelf$/i.test(c.name));
      assert.equal(shelves.length, 1, q);
      assert.ok(Math.abs(shelves[0].lengthIn - lengthIn) < 1e-9, `${q}: ${shelves[0].lengthIn} != ${lengthIn}`);
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
