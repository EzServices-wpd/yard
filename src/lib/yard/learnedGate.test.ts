import assert from "node:assert/strict";
import { it } from "node:test";
import { RECIPES } from "./recipes.ts";
import { learnedRecipeFailures } from "./learnedGate.ts";

it("learned gate: the Critic-failed water wheel and abacus fail it; a learned recipe is flagged apart from seeds", () => {
  const get = (k: string) => RECIPES.recipes.find((r) => r.key === k)!;
  assert.ok(learnedRecipeFailures(get("water-wheel")).some((f) => /wider than one|footprint/.test(f)));
  assert.ok(learnedRecipeFailures(get("abacus")).some((f) => /no catalogue item/.test(f)));
  assert.ok(RECIPES.recipes.filter((r) => r.learned).every((r) => r.trust === "candidate"));
});

it("floor uprights on a narrow footprint get full-depth feet and pass the tip check", async () => {
  const { buildRecipe, footprint, validateRecipe } = await import("./recipeBuild.ts");
  const ww = RECIPES.recipes.find((r) => r.key === "water-wheel")!;
  const b = buildRecipe(ww, "water wheel");
  assert.equal(b.project.panels.filter((p) => /^Foot under /.test(p.name)).length, 2);
  const f = footprint(b.project.panels);
  assert.ok(f.z[1] - f.z[0] >= b.size.depth - 0.01);
  assert.ok(!validateRecipe(ww, b, "water wheel").some((x) => /tips|floats/.test(x)));
  b.project.panels.splice(0, b.project.panels.length, ...b.project.panels.filter((p) => !/^Foot under /.test(p.name)));
  assert.ok(validateRecipe(ww, b, "water wheel").some((x) => /tips|floats/.test(x)));
});

it("round shapes: a ring wheel on an x axle draws a zy outline with an open centre; a bead is bored; a box wheel fails the gate", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const ww = RECIPES.recipes.find((r) => r.key === "water-wheel")!;
  assert.ok(learnedRecipeFailures(ww).some((f) => /wheel drawn as a box/.test(f)));
  const round = { ...ww, parts: ww.parts.map((p) => (p.role === "wheel" ? { ...p, shape: "ring" as const } : p.role === "axle" ? { ...p, shape: "cylinder" as const } : p)) };
  const ps = buildRecipe(round, "water wheel").project.panels;
  const wheel = ps.find((p) => p.name === "paddle-wheel")!;
  assert.equal(wheel.polygon?.plane, "zy");
  assert.ok((wheel.polygon?.holes?.[0].r ?? 0) > 0 && Math.abs(wheel.size.height - wheel.size.depth) < 1e-9);
  assert.equal(ps.find((p) => p.name === "main-axle")!.polygon?.plane, "zy");
  assert.ok(!learnedRecipeFailures(round).some((f) => /drawn as a box/.test(f)));
  const ab = RECIPES.recipes.find((r) => r.key === "abacus")!;
  const beads = buildRecipe({ ...ab, parts: ab.parts.map((p) => (p.role === "bead" ? { ...p, shape: "bead" as const, bore: 0.25 } : p)) }, "abacus").project.panels.filter((p) => /^bead/.test(p.name));
  assert.ok(beads.length && beads.every((b) => b.polygon?.holes?.[0].r === 0.125 + 1 / 32 && b.turns));
});

it("moving parts are a clearance fit on their pin with no screws at the joint", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const { panelJoints } = await import("./modelJoints.ts");
  const ww = RECIPES.recipes.find((r) => r.key === "water-wheel")!;
  assert.ok(ww.moving?.length);
  const round = { ...ww, parts: ww.parts.map((p) => (p.role === "wheel" ? { ...p, shape: "ring" as const } : p)) };
  const ps = buildRecipe(round, "water wheel").project.panels;
  const turning = new Set(ps.filter((p) => p.turns).map((p) => p.id));
  assert.ok(turning.size);
  assert.ok(!panelJoints(ps).some((j) => turning.has(j.a) || turning.has(j.b)));
});
