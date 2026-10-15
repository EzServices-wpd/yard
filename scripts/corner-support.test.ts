import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { stampSpanOffer, withSupports, spanFindings } from "../src/lib/yard/spanCheck.ts";
import { panelSupports } from "../src/lib/yard/supportGraph.ts";
import { panelWorldCorners } from "../src/lib/yard/geometry.ts";
import { buildPlan } from "../src/lib/yard/report.ts";

// Class: Add support builds real structure for the form, every added part is held, and the span check re-runs.
for (const q of ["60 inch wide by 84 inch tall corner bookshelf", "corner bookshelf 48 along each wall 72 tall"]) {
  test(`${q}: triangle shelves get a nosing on edge and wall cleats; warning clears; plan lists them`, () => {
    const before = stampSpanOffer(generateFromPrompt(q));
    if (!before.supportOffer?.needed) return;
    const after = withSupports(before);
    assert.equal(spanFindings(after).length, 0, "span check clears after Add support");
    assert.equal(after.supportOffer?.needed, false);
    const added = after.panels.slice(before.panels.length);
    assert.ok(added.some((p) => /^Support nosing/.test(p.name)) && added.some((p) => /^Support cleat/.test(p.name)));
    const sup = panelSupports(after.panels);
    for (const p of added) {
      const s = sup.get(p.id);
      assert.ok(s && (s.how === "floor" || s.on.length > 0), `${p.name} is held by a wall panel or the floor`);
      if (!/nosing/.test(p.name)) continue;
      // Inside its shelf's triangle: no stick dangling past the front edge or into the walls.
      const shelf = after.panels.find((x) => p.name.endsWith(x.name) && x.outline === "right-triangle")!;
      for (const c of panelWorldCorners(p)) {
        const u = (c.x - shelf.position.x) / shelf.size.width, v = (c.z - shelf.position.z) / shelf.size.depth;
        assert.ok(u >= -0.01 && v >= -0.01 && u + v <= 1.001, `${p.name} stays under its shelf`);
      }
    }
    const plan = buildPlan(after);
    assert.ok(plan.bom.some((b) => /1×3/.test(b.name)) && plan.bom.some((b) => /1×2/.test(b.name)), "Buy has the new boards");
    assert.ok(plan.instructions.some((s) => s.partsUsed?.some((n) => /^Support nosing/.test(n))), "a step installs the nosings");
  });
}

test("a wide straight bookcase already carries its shelves on floor-to-top dividers", () => {
  const p = stampSpanOffer(generateFromPrompt("bookcase 60 wide 84 tall 12 deep"));
  assert.ok(!p.supportOffer?.needed);
  assert.ok(p.panels.some((x) => x.type === "divider"));
});
