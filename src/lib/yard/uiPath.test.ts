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
  it("a hung lookup ends in the labelled block within the bound", async () => {
    await runYardPrompt("chicken tractor", { fresh: true, boundMs: 50, ai: stubs(() => new Promise((r) => setTimeout(() => r({ ok: false }), 300)), []) });
    assert.equal(useYard.getState().project.name, "Chicken tractor");
    assert.equal(useYard.getState().grokBusy, false);
  });
});
