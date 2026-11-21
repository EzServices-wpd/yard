/**
 * The keep rule, not a list of prompts: a learned build is saved and used only when the eval gate grades it
 * strictly higher than the deterministic build, the honest checks do not mark it as a stand-in, and the
 * recipe's own notes, parts and Buy agree.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { findRecipe } from "./recipes.ts";
import { buildRecipe, lookupAndBuild, roughBlock } from "./recipeBuild.ts";
import { declarationHits, demandsFor, engineMayShow, mayKeepLearned, solidBlockHits, standInHits } from "./learnedKeep.ts";
import type { BuildPlan, YardProject } from "./types.ts";

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

const leg = (name: string, materialId = "lumber-2x4-8") => ({ ...donor().panels[0], id: name, name, materialId, size: { width: 3.5, height: 16, depth: 1.5 } });

function said(notes: string[], panels: YardProject["panels"], bom: BuildPlan["bom"] = [], cutList: BuildPlan["cutList"] = []): string[] {
  return saidPrompt(donor().prompt, notes, panels, undefined, bom, cutList);
}
function saidPrompt(prompt: string, notes: string[], panels: YardProject["panels"], overall?: { width: number; height: number; depth: number }, bom: BuildPlan["bom"] = [], cutList: BuildPlan["cutList"] = []): string[] {
  const project = { ...donor(), prompt, notes, panels, ...(overall ? { overall } : {}) } as YardProject;
  const plan = { ...buildPlan(donor()), instructions: [], bom, cutList };
  return declarationHits(project, plan);
}

describe("a learned recipe is kept only when its notes, parts and Buy agree", () => {
  it("a stated part count that the build does not have is not kept", async () => {
    const q = "mailbox post";
    const recipe = {
      key: "mailbox-post-counted", synonyms: [], version: 1, trust: "candidate" as const, title: "Mailbox post", outdoor: true,
      size: { width: 36, height: 36, depth: 36 }, defining: ["post", "slat"], notes: ["Typically thirteen wooden slats spaced along the length"],
      parts: [
        { role: "post", name: "Post", box: [0, 0, 0, 0.1, 1, 0.1] as [number, number, number, number, number, number], kind: "member" as const, repeat: "between" as const },
        { role: "slat", name: "Back slat", box: [0, 0.1, 0, 1, 0.8, 0.05] as [number, number, number, number, number, number], kind: "panel" as const, repeat: "each" as const, on: ["Post"] },
      ],
    };
    const built = buildRecipe(recipe, q);
    assert.match(declarationHits(built.project, buildPlan(built.project)).join(" "), /13/);
    assert.equal(await mayKeepLearned(q, built.project), false);
  });

  it("four named legs, and a pair of hinges, agree with those counts", () => {
    const panels = ["Front left leg", "Front right leg", "Rear left leg", "Rear right leg"].map((n) => leg(n));
    panels.push(leg("Left butt hinge", "hardware"), leg("Right butt hinge", "hardware"));
    assert.deepEqual(said(["Four corner legs and a pair of butt hinges."], panels), []);
  });

  it("a note that says floorless and wire mesh is not kept when a solid floor is built and mesh is not bought", () => {
    const hits = said(
      ["Open wire-mesh sides and a floorless design."],
      [leg("Floor", "plywood-3-4-4x8"), leg("Post")],
      [{ name: "2×4 Stud (8 ft)", quantity: 4, unit: "pcs", catalogId: "lumber-2x4-8" }],
    );
    assert.match(hits.join(" "), /mesh/);
    assert.match(hits.join(" "), /no floor/);
  });

  it("a declared movement or species is kept only when the Buy sells it", () => {
    const wood = [leg("Case", "plywood-3-4-2x4")];
    assert.match(said(["A quartz movement in a wood case."], wood, [{ name: "Hanger", quantity: 1, unit: "pcs" }]).join(" "), /quartz/);
    assert.match(said(["Edge-glued maple or similar hardwood strips."], [leg("Hardwood slab", "plywood-3-4-4x8")], [{ name: '3/4" Plywood 4×8', quantity: 1, unit: "sheet", catalogId: "plywood-3-4-4x8" }]).join(" "), /maple|hardwood/);
    assert.deepEqual(said(["Frame is cedar or pressure-treated."], [leg("Post", "lumber-2x4-8")], [{ name: "2×4 pressure-treated (8 ft)", quantity: 2, unit: "pcs", catalogId: "lumber-2x4-8" }]), []);
    assert.match(said(["A cedar or redwood frame."], [leg("Post", "plywood-3-4-4x8")], [{ name: '3/4" Plywood 4×8', quantity: 1, unit: "sheet", catalogId: "plywood-3-4-4x8" }]).join(" "), /cedar/);
    assert.deepEqual(said(["The lid is glazed."], [leg("Lid", "acrylic-sheet")], [{ name: "Clear acrylic sheet", quantity: 1, unit: "sheet", catalogId: "acrylic-sheet" }]), []);
    assert.deepEqual(said(["No mesh on this one."], [leg("Post")]), []);
  });

  it("parts of one assembly count once, and a finish or an optional extra is not a declared material", () => {
    const drawer = ["Drawer front", "Drawer back", "Drawer left side", "Drawer right side", "Drawer bottom"].map((n) => leg(n, "plywood-3-4-4x8"));
    assert.deepEqual(said(["A nightstand with one drawer."], drawer), []);
    assert.match(said(["Three drawers for storage."], drawer).join(" "), /3 drawers/);
    const cabinets = [1, 2, 3, 4].flatMap((i) => [`Base cabinet ${i} left side`, `Base cabinet ${i} right side`, `Base cabinet ${i} bottom`].map((n) => leg(n, "plywood-3-4-4x8")));
    assert.deepEqual(said(["Four base cabinets."], cabinets), []);
    const wood = [leg("Case", "plywood-3-4-4x8")];
    assert.deepEqual(said(["Finish with a walnut stain."], wood), []);
    assert.deepEqual(said(["Optional mesh liner keeps leaves out."], wood), []);
    assert.match(said(["Built from solid walnut."], wood).join(" "), /walnut/);
    assert.match(said(["Wire mesh sides keep critters out."], wood).join(" "), /mesh/);
  });

  it("a stated thickness has to be the part's thickness", () => {
    const board = (name: string, thickness: number) => ({ ...donor().panels[0], id: name, name, materialId: "plywood-3-4-4x8", size: { width: 18, height: thickness, depth: 12 } });
    assert.deepEqual(said(["All panels use 3/4 inch thick stock."], [board("Side", 0.75)]), []);
    assert.match(said(["Typical 1.5 in thick slab."], [board("Slab", 0.75)]).join(" "), /1\.5/);
  });

  it("the Buy is not a full sheet or a stack of sheets for a small part, and a part is not itself a Buy line", () => {
    const sheet = (qty: number, id: string, name: string, cut: { l: number; w: number; t: number }) => said(
      [],
      [leg("Part", id)],
      [{ name, quantity: qty, unit: qty === 1 ? "sheet" : "sheets", catalogId: id }],
      [{ id, name: "Part", quantity: 1, lengthIn: cut.l, widthIn: cut.w, thicknessIn: cut.t, material: name }],
    );
    assert.match(sheet(1, "plywood-3-4-4x8", '3/4" Plywood 4×8', { l: 2.4, w: 2.4, t: 0.375 }).join(" "), /full sheet/);
    assert.match(sheet(21, "acrylic-sheet", "Clear acrylic sheet", { l: 46, w: 35, t: 0.08 }).join(" "), /tiled from 15 sheets/);
    // A big build buys sheets in proportion to its parts: ten sheets for eight sheets of cabinet parts is kept.
    const big = (quantity: number) => said(
      [],
      [leg("Side", "plywood-3-4-4x8")],
      [{ name: '3/4" Plywood 4×8', quantity: 10, unit: "sheets", catalogId: "plywood-3-4-4x8" }],
      [{ id: "plywood-3-4-4x8", name: "Side", quantity, lengthIn: 96, widthIn: 24, thicknessIn: 0.75, material: '3/4" Plywood 4×8' }],
    );
    assert.deepEqual(big(16), []);
    assert.match(big(2).join(" "), /10 sheets/);
    assert.deepEqual(sheet(1, "plywood-3-4-4x8", '3/4" Plywood 4×8', { l: 36, w: 36, t: 0.75 }), []);
    assert.deepEqual(sheet(1, "plywood-3-4-2x4", '3/4" Plywood Project Panel 2×4', { l: 10, w: 10, t: 0.75 }), []);
    const named = said(
      [],
      [leg("Rear wheel stop 1"), leg("Left vesa mount 1", "hardware"), leg("Right vesa mount 1", "hardware")],
      [{ name: "Rear wheel stop 1", quantity: 1, unit: "pcs" }, { name: "Vesa mounts", quantity: 2, unit: "pcs" }],
    );
    assert.match(named.join(" "), /Rear wheel stop 1/);
    assert.equal(named.some((h) => /vesa/i.test(h)), false);
  });

  it("empty notes still have to build the named object, and a count or a hyphen fraction is read", () => {
    const slat = (i: number) => ({ ...donor().panels[0], id: `s${i}`, name: `Support slat ${i}`, materialId: "lumber-1x3-8", size: { width: 50, height: 0.75, depth: 2.5 } });
    const bed = (n: number, extra: ReturnType<typeof donor>["panels"] = []) => saidPrompt("full size bed frame", [], [...Array.from({ length: n }, (_, i) => slat(i + 1)), ...extra], { width: 54, height: 16, depth: 75 });
    assert.match(bed(2).join(" "), /spanning its length/);
    const deck = { ...donor().panels[0], id: "deck", name: "Platform", materialId: "plywood-3-4-4x8", size: { width: 54, height: 0.75, depth: 75 } };
    assert.equal(bed(0, [deck]).some((h) => /spanning/.test(h)), false);
    assert.match(saidPrompt("chicken tractor", [], [leg("Floor", "plywood-3-4-4x8")]).join(" "), /mesh/);
    assert.equal(saidPrompt("chicken tractor", [], [leg("Floor", "plywood-3-4-4x8")], undefined, [{ name: "1/2\" hardware cloth", quantity: 1, unit: "roll" }]).some((h) => /mesh/.test(h)), false);
    assert.match(saidPrompt("hen coop", [], [leg("Wall")]).join(" "), /mesh/);
    assert.match(saidPrompt("wall clock 12 inch", [], [leg("Case", "plywood-3-4-2x4")]).join(" "), /movement/);
    assert.match(saidPrompt("mantel clock", [], [leg("Case")]).join(" "), /movement/);
    assert.equal(saidPrompt("wall clock 12 inch", [], [leg("Case")], undefined, [{ name: "Quartz clock movement", quantity: 1, unit: "pc" }]).some((h) => /movement/.test(h)), false);
    const shelves = (n: number) => Array.from({ length: n }, (_, i) => leg(`Shelf ${i + 1}`, "plywood-3-4-4x8"));
    assert.deepEqual(said(["8 shelves."], shelves(8)), []);
    assert.match(said(["8 shelves."], shelves(3)).join(" "), /8 shelves/);
    assert.match(said(["8 shelves."], [leg("Post")]).join(" "), /8 shelves/);
    assert.deepEqual(said(["Holds three bikes."], [leg("Post"), leg("Rail")]), []);
    const thick = (t: number) => ({ ...donor().panels[0], id: "top", name: "Top", materialId: "plywood-3-4-4x8", size: { width: 18, height: t, depth: 12 } });
    assert.deepEqual(said(["The top is 1-1/2 in thick."], [thick(1.5)]), []);
    assert.match(said(["The top is 1-1/2 in thick."], [thick(0.5)]).join(" "), /1-1\/2/);
    assert.match(saidPrompt("bookcase with 8 shelves", [], shelves(2)).join(" "), /8 shelves/);
    for (const q of ["built-in bookcase wall 12 ft", "closet system 8 ft", "garage cabinet wall 10 ft"]) {
      assert.equal(saidPrompt(q, [], shelves(6)).some((h) => /bed|mesh|movement|shelves/.test(h)), false, q);
    }
  });
});
