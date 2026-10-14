import { test } from "node:test";
import assert from "node:assert/strict";
import { RECIPES } from "./recipes";
import { buildRecipe } from "./recipeBuild";
import { recipePrompt } from "./recipeIdeas";
import { buildPlan } from "./report";
import { generateFromPrompt } from "./promptMain";
import { isOutdoorPrompt } from "./outdoor";
import { buildClassFailures } from "./learnedGate";

// Every recipe, starters included (the learned-recipe gate only sees learned ones), and typed prompts.
test("every starter and learned recipe passes the build-class checks", () => {
  const bad: string[] = [];
  for (const r of RECIPES.recipes) {
    const prompt = recipePrompt(r);
    const { project } = buildRecipe(r, prompt);
    for (const f of buildClassFailures(project, buildPlan(project), !!r.outdoor || isOutdoorPrompt(prompt))) bad.push(`${r.key}: ${f}`);
  }
  assert.deepEqual(bad, []);
});

test("typed prompts pass the build-class checks", () => {
  const bad: string[] = [];
  for (const q of ["treasure chest", "murphy bed", "dowel tipi for kids", "mudroom locker 3 bays", "medicine cabinet", "deck stairs", "sandbox", "outdoor dog house", "garden bench", "adirondack chair", "compost bin", "linen closet"]) {
    const project = generateFromPrompt(q);
    for (const f of buildClassFailures(project, buildPlan(project), isOutdoorPrompt(q))) bad.push(`${q}: ${f}`);
  }
  assert.deepEqual(bad, []);
});

import { dedupeBuy, duplicateBuyLines } from "./report";
import { floatingWalls } from "./learnedGate";

test("Buy folds a generic hardware line into its specific one, and the check sees a duplicate", () => {
  const line = (name: string, quantity = 1) => ({ name, quantity, unit: "pcs", searchQuery: name });
  const bom = [line("Piano hinge"), line("Hinge", 2), line("Gate latch"), line("Latch"), line("Coat hooks", 6), line("Coat hooks", 6), line("Murphy bed lift mechanism"), line("Fold bracket", 2)];
  assert.ok(duplicateBuyLines(bom).length >= 4);
  assert.deepEqual(dedupeBuy(bom).map((b) => b.name), ["Piano hinge", "Gate latch", "Coat hooks", "Murphy bed lift mechanism"]);
  assert.deepEqual(duplicateBuyLines(dedupeBuy(bom)), []);
});

test("a wall with a gap under it and nothing beside it fails", () => {
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number) => ({ id: name, name, type: "side", materialId: "lumber-1x6-8", position: { x, y, z }, size: { width: w, height: h, depth: d } }) as any;
  assert.deepEqual(floatingWalls([box("Floor", 0, 0, 0, 20, 1, 20), box("Left wall", 0, 1, 0, 1, 10, 20)]), []);
  assert.equal(floatingWalls([box("Floor", 0, 0, 0, 20, 1, 20), box("Left wall", 0, 2, 0, 1, 10, 20)]).length, 1);
});
