import { it } from "node:test";
import assert from "node:assert/strict";
import RECIPES from "./recipes.json" with { type: "json" };
import { buildRecipe } from "./recipeBuild.ts";
import { definingFailures } from "./learnedGate.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import type { Recipe } from "./recipes.ts";

const recipe = (k: string) => (RECIPES as unknown as { recipes: Recipe[] }).recipes.find((r) => r.key === k)!;
const build = (q: string) => { const p = generateFromPrompt(q); return { p, plan: buildPlan(p) }; };

// Each build carries what defines it: the chest's lid, hinges and stay; the Murphy bed's lift; notched stringers;
// tilted ramps; a compost bin's slats with air gaps. The gate fails the same build without them.
it("defining parts and hardware are modelled and bought", () => {
  const chest = build("treasure chest");
  assert.ok(chest.p.panels.some((p) => /^Lid\b/.test(p.name)), "chest has a lid");
  assert.ok(chest.plan.bom.some((b) => /hinge/i.test(b.name)) && chest.plan.bom.some((b) => /\bstay\b/i.test(b.name)), "hinges and a stay");
  const murphy = build("murphy bed");
  assert.ok(murphy.plan.bom.some((b) => /lift mechanism/i.test(b.name)));
  assert.ok(!murphy.plan.bom.some((b) => /dowel/i.test(b.name)), "the fold bracket is bought, not a cut dowel");
  const stairs = build("deck stairs");
  for (const s of stairs.p.panels.filter((p) => /stringer/i.test(p.name))) assert.ok(s.polygon && s.polygon.pts.length >= 8, `${s.name} notched`);
  const run = build("marble run");
  for (const r of run.p.panels.filter((p) => /^Ramp \d+$/.test(p.name))) assert.ok(r.polygon, `${r.name} tilts`);
  const bin = build("compost bin");
  const slats = bin.p.panels.filter((p) => /slats/i.test(p.name));
  assert.ok(slats.length > 2 && slats.every((p) => Math.min(p.size.height, p.size.width) <= 5.5), "slats are boards");
  const back = slats.filter((p) => /^Back/.test(p.name)).sort((a, b) => a.position.y - b.position.y);
  assert.ok(back[1].position.y - (back[0].position.y + back[0].size.height) >= 0.5, "air gap between slats");
  for (const k of ["treasure-chest", "murphy-bed", "deck-stairs", "marble-run", "compost-bin"]) {
    const r = recipe(k);
    const b = buildRecipe(r, k.replace(/-/g, " "));
    assert.deepEqual(definingFailures(r, b.project, buildPlan(b.project)), [], k);
  }
});

it("the gate fails a build missing what defines it", () => {
  const r = recipe("deck-stairs");
  const b = buildRecipe(r, "deck stairs");
  const flat = { ...b.project, panels: b.project.panels.map((p) => ({ ...p, polygon: undefined })) };
  assert.ok(definingFailures(r, flat, buildPlan(b.project)).some((f) => /not notched/.test(f)));
  const m = recipe("murphy-bed");
  assert.ok(definingFailures(m, buildRecipe(m, "murphy bed").project, { bom: [] }).some((f) => /lift mechanism/.test(f)));
  const c = recipe("treasure-chest");
  assert.ok(definingFailures(c, buildRecipe(c, "treasure chest").project, { bom: [{ name: "Hinge" }] }).some((f) => /lid stay/.test(f)));
  const bin = recipe("compost-bin");
  const solid = { ...bin, notes: bin.notes };
  const p = buildRecipe(bin, "compost bin").project;
  const merged = { ...p, panels: [...p.panels, { ...p.panels.find((q) => /slats/.test(q.name))!, name: "Back slats", size: { width: 36, height: 30, depth: 0.75 } }] };
  assert.ok(definingFailures(solid, merged, { bom: [] }).some((f) => /air gaps/.test(f)));
});
