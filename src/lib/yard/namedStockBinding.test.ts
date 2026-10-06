import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

const build = (prompt: string) => {
  const p = generateFromPrompt(prompt);
  return { p, plan: buildPlan(p), notes: (p.notes ?? []).join(" ") };
};

describe("named stock binds: the typed stock is built and bought, or a note says why not", () => {
  it("step stool 2 steps pine 1x10: treads are Pine 1×10 on the cut list and Buy, the rest is said", () => {
    const { p, plan, notes } = build("step stool 2 steps pine 1x10");
    assert.equal(p.primaryMaterialId, "lumber-1x10-8");
    assert.match(p.name, /Pine/);
    const treads = plan.cutList.filter((c) => /top|tread/i.test(c.name));
    assert.ok(treads.length && treads.every((c) => c.material === "Pine 1×10"), JSON.stringify(treads));
    assert.ok(plan.bom.some((b) => b.name === "Pine 1×10" && b.quantity > 0 && b.catalogId === "lumber-1x10-8"));
    // Every cut line is bought: rails and laminated legs ride on the Pine 1×4 line.
    assert.ok(plan.bom.some((b) => b.name === "Pine 1×4" && b.quantity > 0));
    assert.match(notes, /Not 1×10: posts and rails stay Pine 1×4/);
  });

  it("picnic table 6 ft from 2x6: board parts are drawn at the 2×6's real 1 1/2\", legs are said as 2×2", () => {
    const { p, plan, notes } = build("picnic table 6 ft from 2x6");
    const boards = p.panels.filter((x) => x.materialId === "lumber-2x6-8");
    assert.ok(boards.length >= 3);
    for (const b of boards) assert.ok(Math.abs(Math.min(b.size.width, b.size.height, b.size.depth) - 1.5) < 0.01, b.name);
    assert.doesNotMatch(notes, /plane|rip to ¾/i);
    assert.match(notes, /Not 2×6: leg[^.]*stay 2×2/);
    assert.ok(plan.bom.some((b) => b.catalogId === "lumber-2x6-8" && b.quantity > 0));
    assert.deepEqual(p.overall, { width: 72, height: 29, depth: 64 });
  });

  it("adirondack chair cedar 1x6: Cedar in the title, notes and Buy (search and price)", () => {
    const { p, plan, notes } = build("adirondack chair cedar 1x6");
    assert.equal(p.primaryMaterialId, "lumber-1x6-8");
    assert.match(p.name, /^Cedar /);
    assert.match(notes, /Cedar 1×6/);
    assert.doesNotMatch(notes, /1×6 Board \(8 ft\)/);
    const line = plan.bom.find((b) => b.catalogId === "lumber-1x6-8");
    assert.ok(line);
    assert.equal(line!.name, "Cedar 1×6");
    assert.match(line!.searchQuery ?? "", /^Cedar 1x6/);
    // The seed library has no 1×6 price: unpriced, never a fake number.
    assert.ok(line!.estimatedCost == null || line!.estimatedCost === 0);
  });

  it("coat rack 66 tall oak dowel: Oak survives; the dowel swap is said, never silent", () => {
    const { p, plan, notes } = build("coat rack 66 tall oak dowel");
    assert.match(p.name, /Oak/);
    assert.ok(plan.bom.some((b) => /^Oak /.test(b.name)));
    assert.match(notes, /Not Oak dowel: back board and hat shelf are Oak 1×4 — those are flat parts and a dowel is round/);
  });

  it("a species on typed 2× stock carries to the cut list and Buy", () => {
    const { plan } = build("picnic table 6 ft cedar 2x6");
    assert.ok(plan.cutList.filter((c) => c.id.startsWith("lumber-2x6-8|")).every((c) => c.material === "Cedar 2×6"));
    const line = plan.bom.find((b) => b.catalogId === "lumber-2x6-8");
    assert.equal(line?.name, "Cedar 2×6");
    assert.match(line?.searchQuery ?? "", /^Cedar 2x6/);
  });

  it("a wide named board packs at its real face (1×10 is not counted as 3½\" strips)", () => {
    const { plan } = build("bookshelf from pine 1x10");
    const line = plan.bom.find((b) => b.catalogId === "lumber-1x10-8");
    assert.ok(line && line.quantity > 0 && line.quantity < 16, String(line?.quantity));
    assert.ok(!plan.bom.some((b) => /3\/4" Plywood/i.test(b.name)));
  });

  it("controls keep their stock and sizes", () => {
    const linen = build("linen closet 31.5 wide 78 tall 16 deep");
    assert.deepEqual(linen.p.overall, { width: 31.5, height: 78, depth: 16 });
    assert.doesNotMatch(linen.notes, /\bNot (?:¾|3\/4)/);
    const alcove = build("alcove bookcase on 3/4 ply");
    assert.equal(alcove.p.primaryMaterialId, "plywood-3-4-4x8");
    const pop = build("popsicle dining table");
    assert.equal(pop.p.primaryMaterialId, "popsicle-standard");
    for (const b of [linen, alcove, pop]) assert.doesNotMatch(b.notes, /— those are flat parts|this form draws those parts/);
  });
});
