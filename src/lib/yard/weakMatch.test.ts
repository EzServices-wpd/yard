import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain.ts";

it("a build that ignores a word of the typed object is a weak match; owned nouns stay put", () => {
  const miss = (q: string) => ignoredTypedWords(generateFromPrompt(q), q);
  for (const q of ["lap desk", "tabletop loom", "chicken tractor", "standing desk", "cold frame"]) assert.ok(miss(q).length, q);
  for (const q of ["bookshelf", "linen closet 31.5 wide 78 tall 16 deep", "bunk bed", "wine rack", "raised bed", "coat hooks", "golden gate bridge", "hall pantry", "tv stand", "warren truss bridge"]) assert.deepEqual(miss(q), [], q);
});

it("a compound noun never falls back to its last word's build: the rough shape is a labelled block", async () => {
  const { lookupAndBuild, roughBlock } = await import("./recipeBuild.ts");
  const q = "chicken tractor";
  const engine = generateFromPrompt(q);
  const out = await lookupAndBuild(q, async () => null, () => roughBlock(q, engine));
  assert.ok(out.rough);
  assert.equal(out.project.name, "Chicken tractor");
  assert.equal(out.project.panels.length, 1);
  assert.equal(out.project.instances.length, 0);
  assert.match(out.project.notes[0], /^Shown as a rough shape: the real chicken tractor parts/);
});
