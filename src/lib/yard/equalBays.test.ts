/**
 * A long shelf span that the span pass divides (closets, cabinets, bookcases) gets equal
 * clear bays. On a run of 3 or more, every clear width matches within 1/64", and the bays
 * plus the dividers between them fill the opening between the sides.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fc from "fast-check";
import { generateFromPrompt } from "./promptMain";
import { equalBayProblems, equalBayRuns } from "./equalBayRuns";
import { shelfSpanViolations } from "./shelfSpan";

const SEED = 20261106;

const NAMED = [
  "closet 72 wide",
  "cabinet 42 wide 30 tall 15 deep with 3 doors in 1/2 inch plywood",
  ...[42, 48, 60, 64, 72, 90, 96, 120].map((w) => `closet ${w} wide`),
  ...[60, 72, 84, 96].map((w) => `bookcase ${w} wide 72 tall 12 deep`),
  ...[48, 60, 72].map((w) => `bookcase ${w} wide 48 tall 12 deep in 1/2 inch plywood`),
  "closet 72 wide 96 tall 24 deep",
  "office bookcase with doors 42 wide",
  "wardrobe 96 wide",
  "bookcase 96 wide from MDF",
  "bookshelf from 1x10",
];

function widthsOf(prompt: string) {
  const project = generateFromPrompt(prompt);
  return equalBayRuns(project.panels, 3).map((run) => run.shelves.map((s) => s.size.width));
}

describe("equal clear bays", () => {
  it("splits closet 72 and the half-inch cabinet into equal bays that fill the run", () => {
    const closet = widthsOf("closet 72 wide");
    assert.ok(closet.length >= 1);
    for (const run of closet) {
      assert.equal(run.length, 3);
      for (const w of run) assert.ok(Math.abs(w - 23) < 1e-6, String(w));
    }
    const cabinet = generateFromPrompt("cabinet 42 wide 30 tall 15 deep with 3 doors in 1/2 inch plywood");
    const runs = equalBayRuns(cabinet.panels, 3);
    assert.ok(runs.length >= 1);
    for (const run of runs) {
      assert.equal(run.shelves.length, 3);
      for (const shelf of run.shelves) assert.ok(Math.abs(shelf.size.width - 13.25) < 1e-6, String(shelf.size.width));
    }
    assert.deepEqual(equalBayProblems(cabinet.panels), []);
    assert.deepEqual(shelfSpanViolations(cabinet), []);
    assert.deepEqual(shelfSpanViolations(generateFromPrompt("closet 72 wide")), []);
  });

  it("keeps every auto-divided run of 3+ bays equal, and the pieces fill between the sides", () => {
    for (const prompt of NAMED) {
      const project = generateFromPrompt(prompt);
      assert.deepEqual(equalBayProblems(project.panels), [], prompt);
    }
    const bookcase = widthsOf("bookcase 96 wide 72 tall 12 deep");
    assert.ok(bookcase.some((run) => run.length === 4));
    for (const run of bookcase) {
      const spread = Math.max(...run) - Math.min(...run);
      assert.ok(spread <= 1 / 64, spread);
    }
  });

  it("holds the same invariant across hosts, widths, and 1/2 inch plywood", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("closet", "cabinet", "bookcase", "wardrobe", "pantry"),
        fc.integer({ min: 40, max: 120 }),
        fc.constantFrom(undefined, "plywood-1-2-4x8" as const),
        (host, width, stock) => {
          const prompt = `${host} ${width} wide`;
          const project = generateFromPrompt(prompt, stock);
          const bad = equalBayProblems(project.panels);
          assert.deepEqual(bad, [], prompt);
          return true;
        },
      ),
      { seed: SEED, numRuns: 36 },
    );
  });
});
