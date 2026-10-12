import { describe, it } from "node:test";
import assert from "node:assert/strict";

(globalThis as { window?: unknown }).window = { setTimeout, clearTimeout, location: { search: "" } };
const { runYardPrompt } = await import("../../components/workspace/run-prompt");
const { useYard } = await import("./store");

// The real bar handler with the AI calls stubbed. Half-read compound nouns reach the learner, and a failed
// lookup shows a labelled block: never the closet brief, the opening fit or the last word's build.
function stubs(reply: () => Promise<{ ok: boolean; recipeJson?: string; error?: string }>, calls: string[]) {
  return {
    lookupRecipe: (() => (calls.push("lookup"), reply())) as never,
    hintSubject: (async () => (calls.push("hint"), { summary: "", subject: "" })) as never,
    interpretPrompt: (async () => (calls.push("interp"), { ok: false })) as never,
    briefHousePrompt: (async () => (calls.push("house"), { ok: false })) as never,
    proposeRecipeFn: (async () => ({ status: "quiet" })) as never,
  };
}

describe("uiPath: half-read compound nouns", () => {
  for (const noun of ["cold frame", "chicken tractor", "lap desk"]) {
    it(`${noun} reaches the learner, then a labelled block`, async () => {
      const calls: string[] = [];
      await runYardPrompt(noun, { fresh: true, ai: stubs(async () => ({ ok: false, error: "bad" }), calls) });
      const p = useYard.getState().project;
      assert.ok(calls.includes("lookup"), calls.join());
      assert.ok(!calls.includes("house"));
      assert.equal(p.panels.length, 1);
      assert.equal(p.name.toLowerCase(), noun);
      assert.ok(!p.fitted && p.kind !== "closet" && !/popsicle/.test(p.primaryMaterialId));
      assert.match(p.notes.join(" "), /rough shape/);
    });
  }
  // Batch nouns: a failed lookup is a full-size labelled block, never a popsicle stick cloud or craft scale.
  for (const noun of ["spinning wheel", "butter churn", "wheelbarrow", "sundial", "sawbuck", "knife block", "chicken tractor"]) {
    it(`${noun}: failed lookup is full size, never craft`, async () => {
      await runYardPrompt(noun, { fresh: true, ai: stubs(async () => ({ ok: false, error: "bad" }), []) });
      const p = useYard.getState().project;
      assert.ok(!/popsicle|craft|stick/.test(p.primaryMaterialId), p.primaryMaterialId);
      assert.ok(Math.max(p.overall.width, p.overall.height, p.overall.depth) >= 24, JSON.stringify(p.overall));
      assert.equal(p.name.toLowerCase(), noun);
    });
  }
  it("easel for kids is the kids' easel, not craft", async () => {
    await runYardPrompt("easel for kids", { fresh: true, ai: stubs(async () => ({ ok: false }), []) });
    const p = useYard.getState().project;
    assert.ok(!/popsicle/.test(p.primaryMaterialId) && p.overall.height >= 36, JSON.stringify(p.overall));
  });
  it("trestle table 6 feet is a 72in table, not a seat or a bridge", async () => {
    await runYardPrompt("trestle table 6 feet", { fresh: true, ai: stubs(async () => ({ ok: false }), []) });
    const p = useYard.getState().project;
    assert.equal(p.overall.width, 72);
    assert.ok(!/seat|bridge/i.test(p.name), p.name);
  });
  it("a hung lookup ends in the labelled block within the bound", async () => {
    await runYardPrompt("chicken tractor", { fresh: true, boundMs: 50, ai: stubs(() => new Promise((r) => setTimeout(() => r({ ok: false }), 300)), []) });
    assert.equal(useYard.getState().project.name, "Chicken tractor");
    assert.equal(useYard.getState().grokBusy, false);
  });
});
