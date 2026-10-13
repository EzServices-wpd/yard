import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRecipe, lookupAndBuild, needsRecipeLookup, timedLookup, validateRecipe } from "./recipeBuild.ts";
import type { Recipe } from "./recipes.ts";
import type { YardProject } from "./types.ts";

const bin: Recipe = {
  key: "compost-bin", synonyms: [], version: 1, trust: "candidate", title: "Compost bin", outdoor: true,
  size: { width: 36, height: 36, depth: 36 }, count: { word: "bays", default: 1 }, defining: ["post", "slat"],
  parts: [
    { role: "post", name: "Post", box: [0, 0, 0, 0.1, 1, 0.1], kind: "member", repeat: "between" },
    { role: "slat", name: "Back slat", box: [0, 0.1, 0, 1, 0.8, 0.05], kind: "panel", repeat: "each", on: ["Post"] },
  ],
  notes: [],
};
const rough = (): YardProject => ({ id: "x", name: "Thing", prompt: "", kind: "custom", overall: { width: 1, height: 1, depth: 1 }, instances: [], panels: [], primaryMaterialId: "x", notes: [], assumptions: { load: "light", units: "inches", installMode: "freestanding", wallType: "wood_stud" } });

describe("recipe build and validate", () => {
  it("a typed count builds that many bays sharing posts", () => {
    const b = buildRecipe(bin, "compost bin 3 bays");
    assert.equal(b.count, 3);
    assert.equal(b.project.panels.filter((p) => p.name.startsWith("Post ")).length, 4);
    assert.deepEqual(validateRecipe(bin, b, "compost bin 3 bays"), []);
  });
  it("a typed size is exact", () => assert.equal(buildRecipe(bin, "compost bin 60 wide").project.overall.width, 60));
  it("a floating part fails the load path", () => {
    const bad = { ...bin, parts: [...bin.parts, { role: "lid", name: "Lid", box: [0, 1.2, 0, 1, 0.05, 1], kind: "panel", on: ["Post"] } as const] };
    assert.ok(validateRecipe(bad, buildRecipe(bad, "compost bin"), "compost bin").some((f) => /Lid/.test(f)));
  });
  it("one box filling the envelope is a closed shell", () => {
    const cube = { ...bin, count: undefined, defining: undefined, parts: [{ role: "body", name: "Body", box: [0, 0, 0, 1, 1, 1], kind: "panel" } as const] };
    assert.ok(validateRecipe(cube, buildRecipe(cube, "x"), "x").some((f) => /closed shell/.test(f)));
  });
  it("retries once with the failures, then passes", async () => {
    const seen: (string[] | undefined)[] = [];
    const out = await lookupAndBuild("compost bin", async (_p, fb) => (seen.push(fb), fb ? bin : { ...bin, parts: [] }), rough);
    assert.equal(out.calls, 2);
    assert.ok(seen[1]?.length);
    assert.equal(out.rough, false);
  });
  it("two failures ship a labelled rough shape, never a relabelled template", async () => {
    const out = await lookupAndBuild("thing", async () => null, rough);
    assert.equal(out.rough, true);
    assert.match(out.project.notes[0], /Shown as a rough shape/);
    assert.equal(out.calls, 2);
  });
  it("an unavailable AI keeps the engine build, unlabelled, after one call", async () => {
    const out = await lookupAndBuild("thing", timedLookup(async () => ({ ok: false, error: "AI is not available in this environment" })), rough);
    assert.deepEqual([out.rough, out.unavailable, out.calls, out.project.notes.length], [false, true, 1, 0]);
  });
  it("a timeout counts as a failure: two tries, then the rough label", async () => {
    const out = await lookupAndBuild("thing", timedLookup(() => new Promise(() => {}), 5, 5), rough);
    assert.equal(out.rough, true);
    assert.deepEqual(out.reasons, ["call 1: timeout", "call 2: timeout"]);
  });
  it("the retry gets the rest of the bound, not a fixed slice: a slow fix-the-checks retry still lands", async () => {
    let n = 0;
    const slow = timedLookup(() => new Promise((res) => setTimeout(() => res({ ok: true, recipeJson: n++ ? JSON.stringify(bin) : "null" }), n ? 60 : 10)), 50, 100);
    const out = await lookupAndBuild("cedar compost bin", slow, rough);
    assert.ok(out.recipe, JSON.stringify(out.reasons));
  });
  it("a flat object (cutting board) may be one slab", () => {
    const board = { key: "cutting-board", synonyms: [], version: 1, trust: "candidate", title: "Cutting board", size: { width: 18, height: 1.5, depth: 12 }, defining: ["board"], notes: [],
      parts: [{ role: "board", name: "Board", box: [0, 0, 0, 1, 1, 1], kind: "panel" }] } as unknown as Recipe;
    assert.deepEqual(validateRecipe(board, buildRecipe(board, "cutting board"), "cutting board"), []);
  });
  it("a round body (butter churn barrel) is a defining part, not the closed-shell box", () => {
    const churn = { key: "butter-churn", synonyms: [], version: 1, trust: "candidate", title: "Butter churn", size: { width: 12, height: 36, depth: 12 }, defining: ["body", "dasher"], notes: [],
      parts: [{ role: "body", name: "Body", box: [0, 0, 0, 1, 0.8, 1], kind: "member", shape: "cylinder" }, { role: "lid", name: "Lid", box: [0, 0.8, 0, 1, 0.04, 1], kind: "panel", on: ["Body"] },
        { role: "dasher", name: "Dasher", box: [0.45, 0.1, 0.45, 0.1, 0.9, 0.1], kind: "member", shape: "cylinder", on: ["Lid"] }] } as unknown as Recipe;
    assert.deepEqual(validateRecipe(churn, buildRecipe(churn, "butter churn"), "butter churn"), []);
  });
  it("asks only when nothing owns the noun", () => {
    assert.equal(needsRecipeLookup({ ...rough(), unmatched: true }, "zorb ramp", false), true);
    assert.equal(needsRecipeLookup({ ...rough(), unmatched: true }, "zorb ramp", true), false);
    assert.equal(needsRecipeLookup({ ...rough(), name: "Bookcase" }, "bookcase 36 wide", false), false);
    assert.equal(needsRecipeLookup({ ...rough(), unmatched: true }, "cedar compost bin", false), false);
  });
});
