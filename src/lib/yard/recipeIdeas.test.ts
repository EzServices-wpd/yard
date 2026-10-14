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
  const ww = RECIPES.recipes.find((r) => r.key === "water-wheel")!;
  ww.held = "Critic FAIL (test)";
  try {
    for (const d of [...recipeIdeas(), ...popularIdeas({ "water-wheel": 99 })]) assert.notEqual(d.id, "recipe-water-wheel");
  } finally {
    delete ww.held;
  }
});

it("a flagged learned recipe lands held, stays off Ideas and Popular, and is never promoted", async () => {
  const { addCandidate } = await import("../ai/recipeBot.ts");
  const bad = { key: "t-flagged", synonyms: [], version: 1, trust: "candidate", title: "Box", learned: true, size: { width: 20, height: 10, depth: 12 }, defining: ["wall"], notes: [],
    parts: [{ role: "wall", name: "Back wall", box: [0, 0, 0.9, 1, 1, 0.1], kind: "panel" }, { role: "wall", name: "Front wall", box: [0, 0, 0, 1, 1, 0.1], kind: "panel" },
      { role: "lid", name: "Lid", box: [0, 0.2, 0.3, 0.5, 0.04, 0.3], kind: "panel", on: ["Back wall"] }], moving: [{ part: "Lid", motion: "hinge" }] } as unknown as (typeof RECIPES.recipes)[number];
  const text = addCandidate(JSON.stringify({ recipes: [] }), bad)!;
  const added = JSON.parse(text).recipes[0];
  assert.ok(added.held && added.trust === "candidate");
  assert.ok(!recipeIdeas([added]).length);
});

it("New (Unverified) lists learned recipes that pass the gate, held ones never, and Popular doesn't repeat them", async () => {
  const { newIdeas, popularIdeas } = await import("./recipeIdeas.ts");
  const { RECIPES } = await import("./recipes.ts");
  const fresh = newIdeas().map((d) => d.id.slice(7));
  for (const k of fresh) { const r = RECIPES.recipes.find((x) => x.key === k)!; assert.ok(r.trust !== "trusted" && !r.held, k); }
  assert.ok(!fresh.includes("cribbage-board") && !fresh.includes("water-wheel"));
  const pop = new Set(popularIdeas().map((d) => d.id.slice(7)));
  assert.ok(fresh.every((k) => !pop.has(k)));
});

it("Popular shows only TRUSTED recipes; New (Unverified) only untrusted, unheld learned ones; Critic's FLAGGED five are on neither", async () => {
  const { newIdeas, popularIdeas } = await import("./recipeIdeas.ts");
  const by = new Map(RECIPES.recipes.map((r) => [r.key, r]));
  const pop = popularIdeas().map((d) => d.id.slice(7)), fresh = newIdeas().map((d) => d.id.slice(7));
  assert.ok(pop.length > 0);
  for (const k of pop) assert.equal(by.get(k)!.trust, "trusted", k);
  for (const k of fresh) assert.ok(by.get(k)!.trust !== "trusted" && !by.get(k)!.held, k);
  for (const k of ["raised-dog-feeder-stand", "compost-tumbler-frame", "knife-block", "adirondack-footrest", "miter-saw-station"]) {
    assert.ok(by.get(k)!.held, k);
    assert.ok(!pop.includes(k) && !fresh.includes(k), k);
  }
  for (const k of ["wall-mounted-mail-organizer", "rain-barrel-stand"]) assert.ok(pop.includes(k), k);
});

it("the rain barrel stand's opening between the posts clears a 23 in barrel", async () => {
  const { generateFromPrompt } = await import("./promptMain.ts");
  const p = generateFromPrompt("rain barrel stand");
  const posts = p.panels.filter((q) => /post/i.test(q.name));
  const inner = Math.max(...posts.map((q) => q.position.x)) - Math.min(...posts.map((q) => q.position.x + q.size.width));
  assert.ok(inner >= 23, String(inner));
});

it("ungraded, unheld seed recipes show under New (Unverified), and every card size is a fraction, never a decimal", async () => {
  const { newIdeas, popularIdeas } = await import("./recipeIdeas.ts");
  const fresh = newIdeas().map((d) => d.id.slice(7));
  for (const r of RECIPES.recipes.filter((x) => !x.learned && x.trust !== "trusted" && !x.held)) if (newIdeas().length < 51) assert.ok(fresh.includes(r.key) || !recipeIdeas().some((d) => d.id === `recipe-${r.key}`), r.key);
  // Critic graded the starters (regrade-2d3f8d4): FLAGGED ones are held and off New; under-stairs shelf is TRUSTED on Popular.
  assert.ok(!fresh.includes("ferris-wheel") && !fresh.includes("glider"));
  assert.ok(popularIdeas().some((d) => d.id === "recipe-under-stairs-shelf"));
  const seed = { ...RECIPES.recipes.find((r) => r.key === "glider")!, held: undefined, trust: "candidate" as const };
  assert.ok(newIdeas([seed]).some((d) => d.id === "recipe-glider"), "an ungraded, unheld seed shows under New");
  for (const d of [...newIdeas(), ...popularIdeas()]) assert.doesNotMatch(d.size, /\d\.\d/, d.size);
});
