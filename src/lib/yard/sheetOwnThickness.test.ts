/**
 * Every part is cut from, nested on and bought as a sheet of its own thickness (Critic 10-19 #99 row 92; I28). A part
 * drawn at another thickness than its sheet (a 0.48" platform on the 3/4" sheet) moves to the sheet of its thickness or
 * is cut at its sheet's thickness; the Buy list buys one row per thickness the layout cuts at.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";
import { getCatalogItem } from "./catalog";
import { hollowParts } from "./hollowDrawers";
import type { Panel } from "./types";

const T = (p: Panel) => Math.min(p.size.width, p.size.height, p.size.depth);
const plies = (t: number, s: number) => Math.abs(t - s) < 0.03 || (t > s * 1.5 && Math.abs(t / s - Math.round(t / s)) < 0.05);

describe("parts on their own sheet (#99 split A)", () => {
  for (const q of ["laptop stand", "toy train track riser", "window box", "wall mounted mail organizer"]) {
    it(`${q}: every plywood part is a whole number of its sheet's plies (I28)`, () => {
      const p = generateFromPrompt(q);
      for (const x of p.panels) {
        const s = getCatalogItem(x.materialId ?? "")?.dims.thickness;
        if (!/^plywood-/.test(x.materialId ?? "") || !s || s <= 0.26 || x.yaw || x.polygon || x.type === "drawer") continue;
        assert.ok(plies(T(x), s), `${q}: ${x.name} ${T(x).toFixed(2)}" on ${x.materialId}`);
      }
      assert.deepEqual(checkBuild(p, q).filter((v) => v.id === "I28").map((v) => v.msg), []);
    });
  }

  it("a sheet the cut list cuts from is a sheet the Buy list buys", () => {
    for (const q of ["toy train track riser", "window box"]) {
      const plan = buildPlan(generateFromPrompt(q));
      for (const c of plan.cutList.filter((c) => /plywood/i.test(c.material ?? "") && !c.whole)) assert.ok(plan.bom.some((b) => b.name === c.material), `${q}: ${c.name} [${c.material}] not bought`);
    }
  });

  it("a drawer box on a 1/2\" sheet has 1/2\" sides and back; on the 3/4\" sheet, 3/4\"", () => {
    const env = (materialId: string): Panel => ({ id: "d", name: "Drawer 1", type: "drawer", materialId, position: { x: 0, y: 0, z: 0 }, size: { width: 20, height: 6, depth: 18 } }) as Panel;
    const half = hollowParts(env("plywood-1-2-4x8")).filter((p) => p.drawerPart === "side" || p.drawerPart === "back");
    assert.ok(half.every((p) => Math.abs(T(p) - 0.5) < 0.01), half.map((p) => T(p)).join());
    const full = hollowParts(env("plywood-3-4-4x8")).filter((p) => p.drawerPart === "side" || p.drawerPart === "back");
    assert.ok(full.every((p) => Math.abs(T(p) - 0.75) < 0.01));
  });
});
