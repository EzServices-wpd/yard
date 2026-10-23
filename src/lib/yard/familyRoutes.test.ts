/**
 * I48 (sweep): a known family's ask goes to the engine first. A head noun the family table classifies ("cabinet",
 * "bookcase", "cart") plus feature words, counted or not ("with shelves", "with 3 shelves"), routes exactly as the
 * featureless ask does, and never to the learner while the model carries the features. Live 10-20: "utility cabinet
 * 28 wide 72 tall 16 deep with shelves" said "couldn't learn" while the engine built it (4 visitors).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain.ts";
import { engineKeepsPrompt, familyHeadNoun, routesToLearner } from "./formOwnership.ts";

/** The live bar's learner decision (run-prompt.ts): the engine keeps it, or the learner gate sends it on. */
function toLearner(q: string): boolean {
  const p = generateFromPrompt(q);
  const half = ignoredTypedWords(p, q).length > 0;
  return !engineKeepsPrompt(q, p, half) && routesToLearner(q, p, half);
}

const NOUNS = ["cabinet", "utility cabinet", "garage cabinet", "tool cabinet", "storage cabinet", "bookcase", "bookshelf", "dresser", "nightstand", "wardrobe", "pantry", "linen closet", "closet", "vanity", "desk", "sideboard", "credenza", "buffet", "hutch", "media console", "tv stand", "kitchen island", "workbench", "bench", "entry bench", "shoe rack", "wine rack", "shelf", "wall shelf", "shelving unit", "toy box", "chest", "console table", "end table", "coffee table", "table", "cart", "crate"];
const FEATURES = [" with shelves", " with 3 shelves", " with drawers", " with 2 drawers", " with doors", " with 2 doors", " with shelves and doors"];
const SIZES = ["", " 28 wide 72 tall 16 deep"];

describe("I48: a known family with feature words, counted or not, goes to the engine", () => {
  it("the live miss builds on the engine, counted and uncounted", () => {
    for (const q of ["utility cabinet 28 wide 72 tall 16 deep with shelves", "utility cabinet 28 wide 72 tall 16 deep with 3 shelves", "tool cabinet with drawers"]) assert.equal(toLearner(q), false, q);
  });

  it("sweep: no family ask reaches the learner because of a feature word", () => {
    const bad: string[] = [];
    let n = 0;
    for (const noun of NOUNS) for (const size of SIZES) {
      const plain = noun + size;
      assert.ok(familyHeadNoun(plain), `${plain}: the family table names its head noun`);
      // A family whose own featureless build goes to the learner (bare "cart" builds a table) is out of this rule.
      if (toLearner(plain)) continue;
      for (const f of FEATURES) { n++; if (toLearner(plain + f)) bad.push(plain + f); }
    }
    assert.ok(n >= 100, `only ${n} prompts swept`);
    assert.deepEqual(bad, []);
  });

  it("a word that changes the object still learns (a lap desk is not a desk)", () => {
    assert.equal(toLearner("lap desk"), true);
  });
});
