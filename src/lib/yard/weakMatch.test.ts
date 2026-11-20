import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain.ts";

it("a build that ignores a word of the typed object is a weak match; owned nouns stay put", () => {
  const miss = (q: string) => ignoredTypedWords(generateFromPrompt(q), q);
  for (const q of ["lap desk", "tabletop loom", "chicken tractor", "standing desk", "cold frame"]) assert.ok(miss(q).length, q);
  for (const q of ["bookshelf", "linen closet 31.5 wide 78 tall 16 deep", "bunk bed", "wine rack", "raised bed", "coat hooks", "golden gate bridge", "hall pantry", "tv stand", "warren truss bridge"]) assert.deepEqual(miss(q), [], q);
});

it("a failed learn keeps the deterministic build and does not install a rough stand-in", async () => {
  const { lookupAndBuild, roughBlock } = await import("./recipeBuild.ts");
  const q = "chicken tractor";
  const engine = generateFromPrompt(q);
  const out = await lookupAndBuild(q, async () => null, () => roughBlock(q, engine));
  assert.equal(out.recipe, null);
  assert.equal(out.declined, true);
  assert.equal(out.rough, false);
  assert.equal(out.project.name, engine.name);
  assert.equal(out.project.panels.length, engine.panels.length);
  assert.deepEqual(out.project.overall, engine.overall);
});

it("only a closet's Check card says closet", async () => {
  const { buildPlan } = await import("./report.ts");
  const msg = (q: string) => JSON.stringify(buildPlan(generateFromPrompt(q)).feasibility.issues);
  assert.doesNotMatch(msg("easel for kids"), /closet/i);
  assert.match(msg("linen closet 31.5 wide 78 tall 16 deep"), /— closet\./);
});
