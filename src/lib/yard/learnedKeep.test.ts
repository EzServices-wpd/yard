/**
 * The keep rule, not a list of prompts: a learned build is saved and used only when the eval gate grades it
 * strictly higher than the deterministic build, and the honest checks do not mark it as a stand-in.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { findRecipe } from "./recipes.ts";
import { lookupAndBuild, roughBlock } from "./recipeBuild.ts";
import { demandsFor, engineMayShow, mayKeepLearned, solidBlockHits, standInHits } from "./learnedKeep.ts";
import type { YardProject } from "./types.ts";

const donor = () => generateFromPrompt("bookcase 36 wide");

describe("a learned recipe is kept only when the gate grades it strictly higher and it is not a stand-in", () => {
  it("a tie with the engine stays on the engine", async () => {
    const q = "bookcase 36 wide";
    const p = generateFromPrompt(q);
    assert.equal(standInHits(q, p, buildPlan(p)).length, 0);
    assert.equal(await mayKeepLearned(q, p), false);
  });

  it("a display-only stand-in grades worse than that bookcase and is not kept", async () => {
    const q = "bookcase 36 wide";
    const rough = roughBlock(q, donor());
    assert.ok(standInHits(q, rough, buildPlan(rough)).length > 0);
    assert.equal(await mayKeepLearned(q, rough), false);
  });

  for (const [name, patch] of [
    ["closed shell", { notes: ["a closed shell of the typed envelope"] }],
    ["unmatched body", { unmatched: true }],
    ["lattice", { notes: ["built from short sticks braced together"] }],
    ["stand-in flag", { standIn: true }],
    ["craft-stick", { primaryMaterialId: "popsicle" }],
  ] as const) {
    it(`a ${name} is not kept even when the grade would otherwise tie`, async () => {
      const q = ["towel", "rack for the bathroom"].join(" ");
      const p = { ...donor(), ...patch, notes: "notes" in patch ? [...patch.notes] : donor().notes } as YardProject;
      assert.ok(standInHits(q, p, buildPlan(p)).some((h) => h.cls === "H-standin" || h.cls === "H-craft"), name);
      assert.equal(await mayKeepLearned(q, p), false);
    });
  }

  it("a generic fallback box over another ask is not kept", async () => {
    const q = "boot tray";
    const p = generateFromPrompt(q);
    if (!standInHits(q, p, buildPlan(p)).some((h) => /fallback box/.test(h.msg))) return;
    assert.equal(await mayKeepLearned(q, p), false);
  });

  it("a lookup with no usable reply is not remembered and shows the labelled block, never the engine's guess", async () => {
    const q = "flurbleglarp";
    const engine = generateFromPrompt(q);
    const out = await lookupAndBuild(q, async () => null, () => roughBlock(q, engine));
    assert.equal(out.recipe, null);
    assert.equal(out.declined, true);
    assert.equal(out.rough, true);
    assert.equal(out.project.displayOnly, true);
    assert.equal(findRecipe(q), null);
  });

  it("a learned build the gate grades no better leaves the engine build only when that build is no stand-in", async () => {
    const q = "bookcase 36 wide";
    const tie = generateFromPrompt(q);
    const recipeOf = { key: "x", synonyms: [], version: 1, trust: "candidate" as const, title: "Bookcase", size: { width: 36, height: 72, depth: 12 }, defining: ["panel"], notes: [] as string[],
      parts: [{ role: "panel", name: "Left side", box: [0, 0, 0, 0.05, 1, 1] as [number, number, number, number, number, number], kind: "panel" as const }, { role: "panel", name: "Right side", box: [0.95, 0, 0, 0.05, 1, 1] as [number, number, number, number, number, number], kind: "panel" as const }, { role: "shelf", name: "Shelf", box: [0.05, 0.5, 0, 0.9, 0.02, 1] as [number, number, number, number, number, number], kind: "panel" as const, on: ["Left side", "Right side"] }] };
    const out = await lookupAndBuild(q, async () => recipeOf, () => roughBlock(q, tie));
    if (out.recipe) return; // kept: covered above
    assert.equal(out.declined, true);
    if (out.rough) assert.equal(await engineMayShow(q, tie), false);
    else assert.equal(out.project.name, tie.name);
  });

  it("a declined lookup keeps an engine build that is no stand-in and that the gate does not fail", async () => {
    const q = "bookcase 36 wide";
    const p = generateFromPrompt(q);
    assert.equal(await engineMayShow(q, p), true);
    const stand = roughBlock(q, p);
    assert.equal(await engineMayShow(q, stand), false);
  });

  it("a part glued up from more than six layers is a solid block, not kept", async () => {
    const q = "bookcase 36 wide";
    const p = generateFromPrompt(q);
    const plan = buildPlan(p);
    assert.equal(solidBlockHits(plan).length, 0);
    const thick = { ...plan, cutList: [...plan.cutList, { ...plan.cutList[0], note: "Glue up 21 layers face to face for each 15 3/4\" panel." }] };
    assert.equal(solidBlockHits(thick).length, 1);
    assert.equal(solidBlockHits({ ...plan, cutList: [...plan.cutList, { ...plan.cutList[0], note: "Glue up 2 layers face to face for each 1 1/2\" top." }] }).length, 0);
    assert.equal(await mayKeepLearned(q, p, thick), false);
  });

  it("a recipe the gate grades strictly higher, and that is not a stand-in, is remembered", async () => {
    const q = "mailbox post";
    const recipe = {
      key: "mailbox-post", synonyms: [], version: 1, trust: "candidate" as const, title: "Mailbox post", outdoor: true,
      size: { width: 36, height: 36, depth: 36 }, defining: ["post", "slat"], notes: [] as string[],
      parts: [
        { role: "post", name: "Post", box: [0, 0, 0, 0.1, 1, 0.1] as [number, number, number, number, number, number], kind: "member" as const, repeat: "between" as const },
        { role: "slat", name: "Back slat", box: [0, 0.1, 0, 1, 0.8, 0.05] as [number, number, number, number, number, number], kind: "panel" as const, repeat: "each" as const, on: ["Post"] },
      ],
    };
    const out = await lookupAndBuild(q, async () => recipe, () => roughBlock(q, donor()));
    assert.ok(out.recipe, (out.reasons ?? []).join(" | "));
    assert.equal(out.declined, undefined);
    assert.equal(findRecipe(q)?.key, "mailbox-post");
  });

  it("grades a stored spec with the eval gate's own grade", async () => {
    const { gradeOne, loadCorpus, loadEngine } = await import("../../../scripts/eval-gate-lib.ts");
    const { projectGrade, REPORT_ONLY_IDS } = await import("./gateGrade.ts");
    const q = "queen platform bed 60 by 80";
    const E = await loadEngine();
    const entry = loadCorpus().find((e) => e.prompt === q);
    assert.ok(entry);
    const p = generateFromPrompt(q);
    const plan = buildPlan(p);
    const row = gradeOne(E, entry);
    const mine = projectGrade({
      ignoredTypedWords: E.ignoredTypedWords,
      checkBuild: E.checkBuild,
      buildPlan: E.buildPlan,
      headerTitle: E.headerTitle,
      generateFromPrompt: E.generateFromPrompt,
      graded: (id) => !REPORT_ONLY_IDS.has(id),
      baseline: E.baseline,
      refusals: E.refusals,
      genericFormMark: E.genericFormMark,
      genericBoxOverAsk: E.genericBoxOverAsk,
    }, { prompt: q, demands: await demandsFor(q), demandsFrom: entry.demandsFrom }, p, plan, q);
    assert.equal(mine.grade, row.grade);
    assert.deepEqual(mine.classes, row.classes);
  });
});
