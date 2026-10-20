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
import { generateFromPrompt, ignoredTypedWords } from "./promptMain";
import { i34, i40 } from "./invariants";
import { headerTitle } from "./pdf";

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

  // Critic 10-19 (#101 rows 98–100): a family claims a prompt only on its own noun, and every typed size, count and
  // modifier is used or refused with a note. Expected sizes: the stand's own rule (deck = what it holds + 1/2" a side,
  // 3" between pots), a 14" pot's 14" footprint, and the opening order a 72" cabinet is typed in (W × H × D).
  it("plant stand 14 wide: the deck is 14\" wide, and the header marks only D and H assumed", () => {
    const p = generateFromPrompt("plant stand 14 wide");
    assert.equal(p.overall.width, 14);
    assert.match(headerTitle(p), /14" W .*\(D, H assumed\)/);
    assert.deepEqual(i40(p, "plant stand 14 wide").map((x) => x.msg), []);
  });
  it("plant stand 18 wide 30 tall: both typed axes are the stand's", () => {
    const p = generateFromPrompt("plant stand 18 wide 30 tall");
    assert.equal(p.overall.width, 18);
    assert.equal(p.overall.height, 30);
    assert.match(headerTitle(p), /\(D assumed\)/);
  });
  it('plant stand for a 14" pot: a stand for a 14" pot (15" deck), never the 10" default', () => {
    const p = generateFromPrompt('plant stand for a 14" pot');
    assert.match(p.name, /14″ potted plant/);
    assert.equal(p.overall.width, 15);
    assert.equal(p.overall.depth, 15);
    assert.ok(!p.instances.some((i) => /10/.test(i.catalogId)), p.instances.map((i) => i.catalogId).join());
    assert.deepEqual(i40(p, 'plant stand for a 14" pot').map((x) => x.msg), []);
  });
  for (const q of ["plant stand with 3 pots", "plant stand for 3 pots"]) {
    it(`${q}: three pots on one deck (3 × 10" + 2 × 3" + 1", 37" wide)`, () => {
      const p = generateFromPrompt(q);
      assert.equal(p.instances.filter((i) => i.role === "held").length, 3);
      assert.equal(p.overall.width, 37);
      assert.match(p.name, /three 10″ potted plants/);
      assert.deepEqual(i40(p, q).map((x) => x.msg), []);
    });
  }
  it("rolling plant stand: the stand rolls (casters), and says so", () => {
    const p = generateFromPrompt("rolling plant stand");
    const plan = buildPlan(p);
    assert.ok(plan.bom.some((b) => /caster/i.test(b.name)), plan.bom.map((b) => b.name).join(", "));
    assert.deepEqual(i40(p, "rolling plant stand").map((x) => x.msg), []);
  });
  it("plant stand in 1/2 plywood: the stand, its deck and shelf cut from 1/2\" plywood; never a closed cube", () => {
    const p = generateFromPrompt("plant stand in 1/2 plywood");
    assert.match(p.name, /stand for a 10″ potted plant/i);
    const plan = buildPlan(p);
    const deck = plan.cutList.find((c) => /^(?:deck|top)$/i.test(c.name));
    assert.ok(deck, plan.cutList.map((c) => c.name).join(", "));
    assert.equal(deck!.thicknessIn, 0.5);
    // The cut row's stock label following its thickness is #99's class (I33/I37, buy follows cut), not repeated here.
    assert.ok(plan.bom.some((b) => b.catalogId === "plywood-1-2-4x8"));
    assert.ok((p.notes ?? []).some((n) => /1\/2" Plywood 4×8.*legs and aprons/i.test(n)), (p.notes ?? []).join(" | "));
  });
  for (const q of ["kiln shelf", "folding shelf"]) {
    it(`${q}: the shelf family does not claim it on the modifier; the learner gets it`, async () => {
      const { calls } = await shows(q);
      assert.ok(calls.includes("lookup"), `${q}: ${calls.join()}`);
    });
  }
  it("utility cabinet 30x72x16: a 72\" tall cabinet, 16\" deep, and the header says so", () => {
    const q = "utility cabinet 30x72x16 with 4 shelves and 2 doors";
    const p = generateFromPrompt(q);
    assert.equal(p.overall.width, 30);
    assert.equal(p.overall.height, 72);
    assert.match(headerTitle(p), /^Utility cabinet · 30" W × 16" D × 72" H\b/);
    assert.ok((p.notes ?? []).some((n) => /Read 30x72x16 as width × height × depth/.test(n)));
    assert.deepEqual(i40(p, q).map((x) => x.msg), []);
  });
  it("bunk bed 82 long 44 wide: the typed 44\" lands on D, so the header marks only H assumed", () => {
    const q = "bunk bed 82 long 44 wide";
    const p = generateFromPrompt(q);
    assert.match(headerTitle(p), /82" W × 44" D × 65" H \(H assumed\)/);
    assert.deepEqual(i40(p, q).map((x) => x.msg), []);
  });
  it("bunk bed 40 wide: the typed 40\" is D, so W (the 82\" long side nobody typed) and H are the assumed axes", () => {
    assert.match(headerTitle(generateFromPrompt("bunk bed 40 wide")), /82" W × 40" D × 65" H \(W, H assumed\)/);
  });
  // A style modifier never blocks a known head noun: "farm table" is the table family (a farm / farmhouse table is a
  // long plank dining table), built, priced, never the learner.
  for (const q of ["farm table", "farm table 92 5/8 long"]) {
    it(`${q}: the table family builds, no learner, nothing ignored`, async () => {
      const { calls, p } = await shows(q);
      assert.ok(!calls.includes("lookup"), `${q}: the learner ran over ${p.name}`);
      assert.ok(!p.displayOnly && !p.standIn, p.name);
      assert.match(p.name, /table/i);
      assert.deepEqual(ignoredTypedWords(generateFromPrompt(q), q), []);
      assert.ok(buildPlan(p).totals.estCostUsd > 0);
    });
  }
  // The 92 5/8" length itself reads only once #103 (I35, mixed fractions) lands; it is not in this base, so it is not
  // asserted here.
  it("bookcase 30x12x72 keeps its W × D × H read", () => {
    const p = generateFromPrompt("bookcase 30x12x72");
    assert.equal(p.overall.height, 72);
  });
});
