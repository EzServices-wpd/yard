/**
 * A size bound to a place is the opening, whatever the noun is called.
 * A size bound to the build stays the build. No noun list.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { coverAxesTalk } from "./headerSize";
import { placeBinding } from "./sizePhrases";
import { looksLikeFitted } from "./fittedDetect";

const TIGHT = "Opening is tight — confirm the measure before you cut.";

function built(prompt: string) {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  return {
    project,
    overall: project.overall,
    tight: plan.feasibility.issues.some((i) => i.message === TIGHT),
    cover: coverAxesTalk(project).subtitle,
    notes: (project.notes ?? []).join("\n"),
    place: placeBinding(prompt, looksLikeFitted),
  };
}

test("a triple bound to a place is width × height × depth, including a noun never listed", () => {
  for (const [q, w, h, d] of [
    ["bookcase in my 24x30x10 niche", 24, 30, 10],
    ["24x30x10 niche", 24, 30, 10],
    ["in my 24x30x10 niche", 24, 30, 10],
    ["cabinet for a 24x30x10 cutout", 24, 30, 10],
    ["shelves in a 9x40x6 bay", 9, 40, 6],
    ["shelf in a 18x40x8 cranny", 18, 40, 8],
    ["box that fits a 24x30x10 slot", 24, 30, 10],
  ] as [string, number, number, number][]) {
    const b = built(q);
    assert.deepEqual([b.overall.width, b.overall.height, b.overall.depth], [w, h, d], q);
    assert.equal(b.place.host, true, q);
    assert.doesNotMatch(b.notes, /You typed 24" wide × 10" tall × 30" deep/);
  }
  // The build's own triple stays furniture order.
  const crate = built("crate 16x12x10");
  assert.equal(crate.place.host, false);
  assert.deepEqual([crate.overall.width, crate.overall.height, crate.overall.depth], [16, 10, 12]);
  assert.equal(crate.tight, false);
});

test("a novel place noun is a host, and a typed width under the minimum is kept", () => {
  const cranny = built("shelf in a 10 inch cranny");
  assert.equal(cranny.overall.width, 10);
  assert.equal(cranny.tight, true);
  assert.match(cranny.cover, /^10" wide/);
  assert.doesNotMatch(cranny.cover, /36" wide/);
  assert.doesNotMatch(cranny.notes, /Assumed 36" wide/);

  const fits = built("shelf that fits a 10 inch cranny");
  assert.equal(fits.overall.width, 10);
  assert.equal(fits.tight, true);

  const cut = built("box that fits a 14 inch cutout");
  assert.equal(cut.overall.width, 14);
  assert.doesNotMatch(cut.notes, /Assumed 24" wide/);

  const pocket = built("pocket space 8 wide");
  assert.equal(pocket.overall.width, 8);
  assert.equal(pocket.tight, true);
  assert.match(pocket.cover, /^8" wide/);
  assert.doesNotMatch(pocket.notes, /Assumed 8" deep/);
  assert.doesNotMatch(pocket.cover, /12" wide/);

  const roomy = built("pocket space 38 wide");
  assert.equal(roomy.overall.width, 38);
  assert.equal(roomy.tight, false);
});

test("an untyped depth is not called typed", () => {
  const bare = built("medicine cabinet");
  assert.doesNotMatch(bare.notes, /you typed/i);
  assert.match(bare.notes, /Assumed 4" deep/);
  assert.equal(bare.project.fitted?.typedAxes?.depth, false);
  assert.equal(bare.project.fitted?.typedAxes?.width, false);

  const deep = built("medicine cabinet 4 deep");
  assert.match(deep.notes, /Finished depth is the 4" you typed/);
  assert.equal(deep.project.fitted?.typedAxes?.depth, true);
  assert.equal(deep.project.fitted?.typedAxes?.width, false);
});

test("a place under a window is the opening, not a window unit, and a freestanding size is not a host", () => {
  const under = built("shelf in the opening under the window 24 wide 30 tall 8 deep");
  assert.equal(under.project.kind, "closet");
  assert.deepEqual([under.overall.width, under.overall.height, under.overall.depth], [24, 30, 8]);
  assert.doesNotMatch(under.cover, /you typed/);

  const book = built("bookcase 10 wide");
  assert.equal(book.tight, false);
  const deepBook = built("bookcase 30 wide 48 tall 6 deep");
  assert.equal(deepBook.tight, false);
  assert.equal(built("shelf for a 22 inch vase").overall.width, 36);
  assert.equal(built("birdhouse for a 6 inch hole").place.host, false);
});
