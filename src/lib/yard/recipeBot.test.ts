import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addCandidate, admit, proposeRecipe } from "../ai/recipeBot.ts";
import { RECIPES } from "./recipes.ts";

describe("recipe bot", () => {
  const r = { ...RECIPES.recipes[0], key: "zorb-ramp", title: "Zorb ramp", trust: "trusted" as const, version: 4 };
  it("adds a new key as a version-1 candidate, never a duplicate", () => {
    const text = JSON.stringify(RECIPES);
    const next = JSON.parse(addCandidate(text, r)!);
    assert.deepEqual([next.recipes.at(-1).key, next.recipes.at(-1).trust, next.recipes.at(-1).version], ["zorb-ramp", "candidate", 1]);
    assert.equal(addCandidate(text, RECIPES.recipes[0]), null);
  });
  it("de-duplicates by key and rate-limits per hour", () => {
    assert.equal(admit("k-0", 1e13), true);
    assert.equal(admit("k-0", 1e13), false);
    let n = 1;
    while (admit(`k-${n}`, 1e13)) n++;
    assert.equal(n, 10);
    assert.equal(admit("k-new", 1e13 + 3_600_001), true);
  });
  it("skips quietly with no token", async () => {
    delete process.env.YARD_RECIPE_BOT_TOKEN;
    assert.deepEqual(await proposeRecipe(r), { ok: true, status: "skipped: no token" });
  });
});
