/**
 * I34 (L1 family before learner, live walk 10-21 row 76): a prompt the existing family matching resolves builds that
 * family before the learner gets a turn. Seam: the real bar handler (runYardPrompt) with the AI calls stubbed, as in
 * engineBuildWins.test.ts, plus the build's cut list and Buy list. Live, both prompts below showed the grey
 * "Yard couldn't learn" block with no price.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
// Static imports load before the window stub below (the PDF module reads the real globals).
import { buildPlan } from "./report";
import { generateFromPrompt } from "./promptMain";
import { i34 } from "./invariants";

(globalThis as { window?: unknown }).window = { setTimeout, clearTimeout, location: { search: "" } };
const { runYardPrompt } = await import("../../components/workspace/run-prompt");
const { useYard } = await import("./store");

function stubs(calls: string[]) {
  return {
    lookupRecipe: (async () => (calls.push("lookup"), { ok: false, error: "bad" })) as never,
    hintSubject: (async () => (calls.push("hint"), { summary: "", subject: "" })) as never,
    interpretPrompt: (async () => (calls.push("interp"), { ok: false })) as never,
    briefHousePrompt: (async () => (calls.push("house"), { ok: false })) as never,
    proposeRecipeFn: (async () => ({ status: "quiet" })) as never,
  };
}
async function shows(q: string) {
  const calls: string[] = [];
  await runYardPrompt(q, { fresh: true, ai: stubs(calls) });
  return { calls, p: useYard.getState().project };
}

/** The storage family (cabinet) with a word ahead of the head noun that names what it stores. */
const STORAGE = ["tool cabinet with drawers", "tool cabinet", "paint cabinet with doors", "craft cabinet with drawers"];
/** The stand family for an object Yard knows, with or without the place it goes. */
const STAND = ["plant stand for a bay window", "plant stand", "pot stand", "plant stand for the porch"];

describe("I34: known families build before the learner", () => {
  it("tool cabinet with drawers: the cabinet family with drawers, priced, no learner", async () => {
    const { calls, p } = await shows("tool cabinet with drawers");
    assert.ok(!calls.includes("lookup"), calls.join());
    assert.ok(!p.displayOnly && !p.standIn, p.name);
    assert.match(p.name, /^Tool cabinet\b/);
    const plan = buildPlan(p);
    assert.ok(plan.cutList.some((c) => /^drawer front$/i.test(c.name)), plan.cutList.map((c) => c.name).join(", "));
    assert.ok(plan.bom.some((b) => /drawer slides/i.test(b.name)));
    assert.ok(plan.totals.estCostUsd > 0);
  });

  it("plant stand for a bay window: a stand sized for a potted plant, in lumber, no learner", async () => {
    const { calls, p } = await shows("plant stand for a bay window");
    assert.ok(!calls.includes("lookup"), calls.join());
    assert.ok(!p.displayOnly && !p.standIn, p.name);
    assert.match(p.name, /stand/i);
    assert.match(p.primaryMaterialId, /^lumber-/);
    const plan = buildPlan(p);
    assert.ok(plan.cutList.length > 0 && plan.totals.estCostUsd > 0);
  });

  for (const q of [...STORAGE, ...STAND]) {
    it(`${q}: the family builds, never the learner or a stand-in (I34)`, async () => {
      const { calls, p } = await shows(q);
      assert.ok(!calls.includes("lookup"), `${q}: the learner ran over ${p.name}`);
      assert.ok(!p.displayOnly && !p.standIn, `${q}: ${p.name}`);
      assert.deepEqual(i34(generateFromPrompt(q), q).map((x) => x.msg), []);
    });
  }

  it("a typed craft stock keeps the stick model of the stand family", () => {
    const p = generateFromPrompt("popsicle stick plant stand");
    assert.match(p.primaryMaterialId, /popsicle/);
  });

  it("a spoken tier count still builds the tiered plant stand", () => {
    assert.match(generateFromPrompt("tiered plant stand").name, /tier plant stand/i);
    assert.match(generateFromPrompt("3 tier plant stand for a bay window").name, /^3-tier plant stand/);
  });
});
