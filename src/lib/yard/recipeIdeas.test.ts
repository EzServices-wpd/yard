import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findRecipe, RECIPES } from "./recipes.ts";
import { isoFaces, recipeIdeas } from "./recipeIdeas.ts";

describe("ideas from recipes", () => {
  const ideas = recipeIdeas();
  it("every passing recipe has a card", () => assert.equal(ideas.length, RECIPES.recipes.filter((r) => !r.held).length));
  it("each card's prompt builds its own recipe and draws a thumbnail", () => {
    for (const i of ideas) {
      assert.equal(`recipe-${findRecipe(i.prompt)?.key}`, i.id, i.prompt);
      assert.ok(isoFaces(i.panels, i.box).length >= 9, i.id);
    }
  });
  it("no links or photos on a card", () => {
    for (const i of ideas) assert.doesNotMatch(JSON.stringify({ ...i, panels: [] }), /https?:|amazon|\.jpe?g|\.png/i);
  });
});

it("Popular recently ranks by prompt count, one card per noun, capped", async () => {
  const { popularIdeas, POPULAR_CAP } = await import("./recipeIdeas.ts");
  const all = popularIdeas({});
  assert.ok(all.length > 0 && all.length <= POPULAR_CAP);
  const last = all[all.length - 1].id.slice(7);
  assert.equal(popularIdeas({ [last]: 5 })[0].id.slice(7), last);
  assert.equal(new Set(all.map((d) => d.id.slice(7).split("-").slice(-1)[0])).size, all.length);
});

it("a held recipe (Critic fail) stays off Ideas and Popular recently", async () => {
  const { recipeIdeas, popularIdeas } = await import("./recipeIdeas.ts");
  const { RECIPES } = await import("./recipes.ts");
  const held = RECIPES.recipes.filter((r) => r.held).map((r) => `recipe-${r.key}`);
  assert.ok(held.includes("recipe-water-wheel") && held.includes("recipe-abacus"));
  for (const d of [...recipeIdeas(), ...popularIdeas({ "water-wheel": 99, abacus: 99 })]) assert.ok(!held.includes(d.id));
});
