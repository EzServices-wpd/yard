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
      // Once the recipe bot saves this noun there is no lookup to fail: the saved build is tested elsewhere.
      if ((await import("./recipes")).findRecipe(noun)) return;
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
  it("bunk bed twin over twin 75 long is the bunk builder, not a lookup block", async () => {
    const calls: string[] = [];
    await runYardPrompt("bunk bed twin over twin 75 long", { fresh: true, ai: stubs(async () => ({ ok: false }), calls) });
    const p = useYard.getState().project;
    assert.ok(!calls.includes("lookup") && /^Bunk bed/.test(p.name) && p.panels.length > 10, `${p.name} ${calls}`);
  });
  it("a tabletop loom is tabletop scale, never a storage cabinet", async () => {
    await runYardPrompt("tabletop loom", { fresh: true, ai: stubs(async () => ({ ok: false }), []) });
    const p = useYard.getState().project;
    assert.ok(p.overall.width <= 24 && p.overall.height <= 18 && !/storage/i.test(p.name), `${p.name} ${JSON.stringify(p.overall)}`);
  });
  it("a typed twin mattress length is the mattress: 82 outside along W, with the fit note", async () => {
    await runYardPrompt("bunk bed twin over twin 75 long", { fresh: true, ai: stubs(async () => ({ ok: false }), []) });
    const p = useYard.getState().project;
    assert.equal(p.overall.width, 82);
    assert.ok(!/\b75"/.test(p.name) && p.notes.some((n) => /Fits a 75" twin mattress, 82" outside/.test(n)), p.name);
  });
  it("a cutting board is cutting-board scale, never a table on legs", async () => {
    await runYardPrompt("cutting board", { fresh: true, ai: stubs(async () => ({ ok: false }), []) });
    const p = useYard.getState().project;
    assert.ok(p.overall.width <= 30 && p.overall.height <= 3 && p.overall.depth <= 24 && !/Leg/.test(p.panels.map((x) => x.name).join()), JSON.stringify(p.overall));
  });
  it("a bare easel is the full-size standing easel, not popsicle", async () => {
    await runYardPrompt("easel", { fresh: true, ai: stubs(async () => ({ ok: false }), []) });
    const p = useYard.getState().project;
    assert.ok(!/popsicle/.test(p.primaryMaterialId) && p.overall.height >= 36, JSON.stringify(p.overall));
  });
  it("trestle table 6 feet is a 72in table, not a seat or a bridge", async () => {
    await runYardPrompt("trestle table 6 feet", { fresh: true, ai: stubs(async () => ({ ok: false }), []) });
    const p = useYard.getState().project;
    assert.equal(p.overall.width, 72);
    assert.equal(p.overall.depth, 36);
    assert.ok(!/seat|bridge/i.test(p.name), p.name);
  });
  it("a hung lookup ends in the labelled block within the bound", async () => {
    await runYardPrompt("chicken tractor", { fresh: true, boundMs: 50, ai: stubs(() => new Promise((r) => setTimeout(() => r({ ok: false }), 300)), []) });
    assert.equal(useYard.getState().project.name, "Chicken tractor");
    assert.equal(useYard.getState().grokBusy, false);
  });
});

it("bed axes: 'long' is the mattress axis (W), 'wide' runs across it (D); the header prints the built size and a mattress note", async () => {
  const { generateFromPrompt } = await import("./promptMain.ts");
  const bed = (q: string) => generateFromPrompt(q);
  const a = bed("bunk bed 90 long");
  assert.deepEqual([a.overall.width, a.overall.depth, a.overall.height], [90, 44, 65]);
  assert.match(a.name, /90" long × 44" wide × 65" tall/);
  const b = bed("bunk bed 40 wide");
  assert.deepEqual([b.overall.width, b.overall.depth], [82, 40]);
  assert.match(b.name, /82" long × 40" wide/);
  assert.ok((b.notes ?? []).some((n) => /No standard mattress fits|[Tt]oo narrow/.test(n)));
  assert.ok((bed("bunk bed").notes ?? []).some((n) => /Fits a 75" twin/.test(n)));
});

describe("uiPath: every entry point shows the display-only block, never the engine's guess", () => {
  const grok = ["knife block", "cold frame", "spinning wheel", "butter churn", "chicken tractor", "wheelbarrow", "sundial", "sawbuck", "sandbox with lid", "wooden ruler", "rolling pin", "wall clock", "rain gauge post", "flurbleglarp"];
  for (const noun of grok) {
    it(`${noun}: while learning and after a failed lookup the bench is display-only`, async () => {
      let seen: unknown = null;
      const pending = () => new Promise<{ ok: boolean; error: string }>((res) => { seen = useYard.getState().project; res({ ok: false, error: "bad" }); });
      await runYardPrompt(noun, { fresh: true, ai: stubs(pending, []) });
      const p = useYard.getState().project;
      if (seen) assert.ok((seen as { displayOnly?: boolean }).displayOnly, `${noun} showed the engine guess while learning`);
      assert.ok(p.displayOnly || /recipe/.test(p.id), `${noun}: ${p.name} ${p.primaryMaterialId}`);
      assert.ok(!/popsicle|stick/.test(p.primaryMaterialId), p.primaryMaterialId);
    });
  }
  it("a lookup that never answers ends on the block (the ?q= and share paths call the same runYardPrompt)", async () => {
    await runYardPrompt("flurbleglarp", { fresh: true, boundMs: 20, ai: stubs(() => new Promise(() => {}), []) });
    assert.ok(useYard.getState().project.displayOnly);
  });
});

describe("uiPath: starter recipes never fall through", () => {
  it("every starter's own noun builds on the bar (its recipe or the engine's own family): no lookup, no grey block (toy airplane)", async () => {
    const { RECIPES } = await import("./recipes");
    const { recipePrompt } = await import("./recipeIdeas");
    // Each starter's card prompt (modifiers included), plus Critic's bare "toy airplane".
    for (const noun of [...RECIPES.recipes.filter((x) => !x.learned).map(recipePrompt), "toy airplane"]) {
      const calls: string[] = [];
      await runYardPrompt(noun, { fresh: true, ai: stubs(async () => ({ ok: false, error: "bad" }), calls) });
      const p = useYard.getState().project;
      assert.ok(!calls.includes("lookup"), `${noun} asked the learner`);
      assert.ok(p.panels.length + p.instances.length > 1 && !p.unmatched && !p.displayOnly, `${noun} fell through to ${p.name}`);
    }
  });
});

describe("uiPath: the Building overlay always clears", () => {
  it("a hint or interpret reply that never comes still lets the run finish and the bench reveal (easel)", async () => {
    const never = new Promise<never>(() => {});
    const ai = { ...stubs(async () => ({ ok: false, error: "bad" }), []), hintSubject: (() => never) as never, interpretPrompt: (() => never) as never };
    const t0 = Date.now();
    await runYardPrompt("easel", { fresh: true, ai, boundMs: 300 } as never);
    assert.ok(Date.now() - t0 < 5000, "run finished");
    assert.equal(useYard.getState().grokBusy, false);
    assert.ok(useYard.getState().project.panels.length > 1);
    await new Promise((r) => setTimeout(r, 4200));
    assert.equal(useYard.getState().building, false);
  });
});
