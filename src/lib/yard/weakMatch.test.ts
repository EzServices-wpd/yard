import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain.ts";

it("a build that ignores a word of the typed object is a weak match; owned nouns stay put", () => {
  const miss = (q: string) => ignoredTypedWords(generateFromPrompt(q), q);
  for (const q of ["lap desk", "tabletop loom", "chicken tractor", "standing desk", "cold frame"]) assert.ok(miss(q).length, q);
  for (const q of ["bookshelf", "linen closet 31.5 wide 78 tall 16 deep", "bunk bed", "wine rack", "raised bed", "coat hooks", "golden gate bridge", "hall pantry", "tv stand", "warren truss bridge"]) assert.deepEqual(miss(q), [], q);
});
