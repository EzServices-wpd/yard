import { test } from "node:test";
import assert from "node:assert/strict";
import { previewIdFor } from "../src/components/workspace/build-preview-match";

test("Building overlay: known types get their own preview", () => {
  const cases: [string, string][] = [
    ["chicken coop", "coop"],
    ["rabbit hutch 48 wide", "coop"],
    ["linen closet for a 31.5 inch alcove", "linen"],
    ["pantry cabinet 24 wide", "linen"],
    ["desk 60 x 30 x 29", "desk"],
    ["nightstand with a drawer", "desk"],
    ["dining table 60 x 36", "table"],
    ["coffee table", "table"],
    ["entry bench 48 wide", "bench"],
    ["bookcase 36 wide", "bookcase"],
    ["floating shelf", "bookcase"],
  ];
  for (const [q, id] of cases) assert.equal(previewIdFor(q), id, q);
});

test("Building overlay: uncertain prompts get the neutral frame", () => {
  for (const q of ["birdhouse", "bird house", "step ladder", "guitar case", "tv stand", "plant stand", "garden arch from pvc", "3-ft popsicle eiffel", "suitcase", "staircase", "tablet holder", "benchmark", "", "storage"]) {
    assert.equal(previewIdFor(q), null, q);
  }
});
