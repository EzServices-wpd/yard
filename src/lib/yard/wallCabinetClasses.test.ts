import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt, shadowsBuiltIn } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { buildInfo } from "./buildInfo.ts";
import { hingeDrift } from "./learnedGate.ts";
import { addCandidate } from "../ai/recipeBot.ts";
import { RECIPES } from "./recipes.ts";
import { shopWordsChipTalk, glossaryForPlan } from "./voiceHonesty.ts";
import { SHOP_GLOSSARY } from "./pdfGlossary.ts";
import type { Recipe } from "./recipes.ts";

const build = (q: string) => { const p = generateFromPrompt(q); return { p, plan: buildPlan(p), text: buildPlan(p).instructions.map((s) => `${s.title}: ${s.description}`).join("\n") }; };
const mcRecipe = { key: "medicine-cabinet", synonyms: [], version: 1, trust: "candidate", learned: true, title: "Medicine Cabinet", size: { width: 18, height: 24, depth: 5 }, defining: ["door"], notes: [],
  parts: [{ role: "side", name: "Left side", box: [0, 0, 0, 0.05, 1, 1], kind: "panel" }, { role: "side", name: "Right side", box: [0.95, 0, 0, 0.05, 1, 1], kind: "panel" }, { role: "door", name: "Door", box: [0, 0, 0.9, 1, 1, 0.1], kind: "panel", on: ["Left side"] }] } as unknown as Recipe;

// Shadowed keys: the engine builds "medicine cabinet" itself, so no candidate is proposed, none sits in the store,
// and the banner names the built-in shape.
it("a learned recipe for a built-in noun is never proposed, never merged, and the banner says Built-in shape", () => {
  assert.ok(shadowsBuiltIn(mcRecipe));
  assert.equal(addCandidate(JSON.stringify({ recipes: [] }), mcRecipe), null);
  for (const r of RECIPES.recipes) assert.ok(!shadowsBuiltIn(r), `${r.key} is shadowed by a built-in shape`);
  assert.equal(buildInfo(generateFromPrompt("medicine cabinet")).source, "Built-in shape");
  assert.ok(!shadowsBuiltIn({ ...mcRecipe, key: "router-table" }));
});

// One hinge choice: the steps hang the hinge Buy sells.
it("steps and Buy name the same hinge on door builds", () => {
  for (const q of ["medicine cabinet", "kitchen base cabinet 30 wide", "linen closet 31.5 wide 78 tall 16 deep", "pantry cabinet", "treasure chest", "wall cabinet 24 wide 30 tall 12 deep"]) {
    assert.deepEqual(hingeDrift(build(q).plan), [], q);
  }
  assert.ok(hingeDrift({ bom: [{ name: "Soft-close concealed cabinet hinges" }], instructions: [{ title: "Hang the door", description: "Two butt hinges." }] } as never).length);
});

// Template words only for parts the build has: no "Kick strip" on a wall cabinet, no "B left uprights" for a pair.
it("glossary and part names come from the build's own parts", () => {
  const { p, text } = build("medicine cabinet");
  const parts = p.panels.map((q) => `${q.name} ${q.type}`).join(" ");
  assert.ok(!/kick strip/i.test(shopWordsChipTalk(`${p.prompt} ${p.name}`, parts)));
  assert.ok(!glossaryForPlan(`${p.prompt} ${p.name}`, SHOP_GLOSSARY, parts).some((e) => /kick/i.test(e.term)));
  assert.ok(!/\b(?:both|each) [A-Z]{1,2} (?:left|right) \w+s\b/.test(text), text.match(/\b(?:both|each) [A-Z]{1,2} (?:left|right) \w+s\b/)?.[0]);
  assert.ok(/kick strip/i.test(shopWordsChipTalk("kitchen base cabinet", "Kick strip kick")));
});
