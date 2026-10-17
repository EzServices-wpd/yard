/**
 * C10 whole-class test (price consistency): same inputs, same total on every path. Runs the C10 sweep corpus through
 * the invariant, the join picker's store path, the store's project swap, and the typed-size house-brief rule.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import "./pdf"; // before the window stub (jspdf reads the real global)

(globalThis as { window?: unknown }).window = { setTimeout, clearTimeout, location: { search: "" } };
const { generateFromPrompt } = await import("./promptMain");
const { buildPlan } = await import("./report");
const { checkBuild } = await import("./invariants");
const { useYard } = await import("./store");
const { parseBrief } = await import("./fitted");
const { typedSizeComplete } = await import("./formOwnership");
const { runYardPrompt } = await import("../../components/workspace/run-prompt");

describe("C10 price consistency", () => {
  for (const q of SWEEPS.c10.prompts) {
    it(`${q}: C10 holds`, () => {
      const p = generateFromPrompt(q);
      const bad = checkBuild(p, q, buildPlan(p)).filter((x) => x.id === "C10");
      assert.deepEqual(bad.map((x) => x.msg), [], q);
    });
  }

  it("linen: picking the default screw join in the store keeps $183.70", () => {
    const s = useYard.getState();
    s.generate("linen closet 31.5 wide 78 tall 16 deep", undefined, undefined, { fresh: true });
    assert.equal(s.makePlan().totals.estCostUsd, 183.7);
    s.setJoinMethod("screw");
    const now = useYard.getState().project;
    useYard.getState().commit({ ...now, shopJoin: "screw", joinMethod: "screw" });
    assert.equal(useYard.getState().makePlan().totals.estCostUsd, 183.7);
  });

  it("a new build swaps every total at once: the shown plan never outlives its build", () => {
    const s = useYard.getState();
    s.generate("linen closet 31.5 wide 78 tall 16 deep", undefined, undefined, { fresh: true });
    s.makePlan();
    const other = generateFromPrompt("bookcase 36 wide 72 tall 12 deep");
    useYard.getState().setProject(other);
    const st = useYard.getState();
    assert.equal(st.plan?.totals.estCostUsd, buildPlan(other).totals.estCostUsd);
    // A notes-only change keeps the same plan object.
    const plan = st.plan;
    useYard.getState().setProject({ ...st.project, notes: [...st.project.notes, "note"] });
    assert.equal(useYard.getState().plan, plan);
  });

  it("every size typed: the house brief is skipped; a missing size still asks", async () => {
    assert.equal(typedSizeComplete(parseBrief("linen closet 31.5 wide 78 tall 16 deep")), true);
    assert.equal(typedSizeComplete(parseBrief("bookcase 36 wide 72 tall")), false);
    assert.equal(typedSizeComplete(parseBrief("linen closet")), false);
    const calls: string[] = [];
    const ai = { briefHousePrompt: (async () => (calls.push("house"), { ok: false })) as never };
    await runYardPrompt("pantry cabinet 24 wide 84 tall 16 deep", { fresh: true, ai });
    await runYardPrompt("closet 72 wide 96 tall 24 deep", { fresh: true, ai });
    assert.deepEqual(calls, []);
  });
});
