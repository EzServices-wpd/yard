import assert from "node:assert/strict";
import { it } from "node:test";
import { RECIPES } from "./recipes.ts";
import { learnedRecipeFailures } from "./learnedGate.ts";
import type { Recipe } from "./recipes.ts";

/** The water wheel as the bot first learned it (posts on the floor, a box wheel): the failure fixture. */
const OLD_WW = {"key": "water-wheel", "synonyms": ["waterwheel"], "version": 1, "trust": "candidate", "title": "2x4 Water Wheel", "size": {"width": 18, "height": 30, "depth": 24}, "feet": false, "outdoor": true, "wall": false, "defining": ["wheel", "axle"], "parts": [{"role": "post", "name": "left-post", "box": [0, 0, 0.35, 0.08, 1, 0.3], "kind": "member", "on": []}, {"role": "post", "name": "right-post", "box": [0.92, 0, 0.35, 0.08, 1, 0.3], "kind": "member", "on": []}, {"role": "axle", "name": "main-axle", "box": [0.08, 0.45, 0.45, 0.84, 0.08, 0.1], "kind": "member", "on": ["left-post", "right-post"]}, {"role": "wheel", "name": "paddle-wheel", "box": [0.35, 0.05, 0.05, 0.3, 0.9, 0.9], "kind": "member", "on": ["main-axle"]}], "moving": [{"part": "paddle-wheel", "motion": "spin"}], "notes": ["Built from 2x4 lumber stock", "Open rim with radial paddles", "Axle rests in notches on posts"], "learned": true} as unknown as Recipe;

it("learned gate: the Critic-failed water wheel and abacus fail it; a learned recipe is flagged apart from seeds", () => {
  const get = (k: string) => RECIPES.recipes.find((r) => r.key === k)!;
  // Critic's regrade: a ring with no spokes floats, fallback steps and closet wording fail; both are held.
  const ww = learnedRecipeFailures(get("water-wheel")), ab = learnedRecipeFailures(get("abacus"));
  assert.ok(ww.some((f) => /wheel floats: nothing joins its rim/.test(f)));
  for (const f of [ww, ab]) assert.ok(f.some((x) => /fallback step/.test(x)) && f.some((x) => /"closet"/.test(x)));
  assert.ok(get("water-wheel").held && get("abacus").held);
  const box = { ...get("abacus"), parts: get("abacus").parts.map((p) => ({ ...p, shape: undefined, catalogId: p.role === "axle" ? undefined : p.catalogId, stock: undefined, kind: p.role === "bead" ? ("hardware" as const) : p.kind })) };
  assert.ok(learnedRecipeFailures(box).some((f) => /no catalogue item|drawn as a box/.test(f)));
  assert.ok(RECIPES.recipes.filter((r) => r.learned).every((r) => r.trust === "candidate"));
});

it("floor uprights on a narrow footprint get full-depth feet and pass the tip check", async () => {
  const { buildRecipe, footprint, validateRecipe } = await import("./recipeBuild.ts");
  const ww = OLD_WW;
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
  const ww = OLD_WW;
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

it("repeats fill the clear span between the side posts, and beads per rod are their own count", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const ab = RECIPES.recipes.find((r) => r.key === "abacus")!;
  const r2 = { ...ab, parts: ab.parts.map((p) => (p.role === "axle" ? { ...p, repeat: "each" as const, box: [0.4, 0.12, 0.4, 0.2, 0.76, 0.2] as typeof p.box } : p.role === "bead" ? { ...p, per: 5 } : p)) };
  const ps = buildRecipe(r2, "abacus").project.panels;
  const rods = ps.filter((p) => /^rod/.test(p.name)), beads = ps.filter((p) => /^bead/.test(p.name));
  assert.equal(rods.length, 9);
  assert.equal(beads.length, 45);
  assert.ok(rods.every((p) => p.position.x >= 1.6 - 1e-6 && p.position.x + p.size.width <= 14.4 + 1e-6));
});

it("a moving part's step follows the step for its pin", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  const ww = RECIPES.recipes.find((r) => r.key === "water-wheel")!;
  const t = buildPlan(buildRecipe(ww, "water wheel").project).instructions.map((s) => s.title);
  const axle = t.findIndex((x) => /axle/i.test(x));
  assert.ok(axle >= 0 && t.findIndex((x) => /wheel|hub/i.test(x)) > axle);
});

it("notes are checked against the geometry, and names and roles are normalized", async () => {
  const { parseRecipe } = await import("./recipes.ts");
  const ab = RECIPES.recipes.find((r) => r.key === "abacus")!;
  const f = learnedRecipeFailures({ ...ab, notes: [...ab.notes, "Uses 3 rods", "Backed with plywood"] });
  assert.ok(f.some((x) => /note says 3 rod, the model has 9/.test(x)));
  assert.ok(f.some((x) => /note names plywood/.test(x)));
  const rail = learnedRecipeFailures({ ...ab, parts: ab.parts.map((p) => ({ ...p, role: "rail" })), defining: ["rail"] });
  assert.ok(rail.some((x) => /every part has the role "rail"/.test(x)));
  const p = parseRecipe({ ...ab, defining: ["Rails"], parts: ab.parts.map((q) => ({ ...q, name: q.name.replace(/ /g, "-").toUpperCase(), role: `${q.role}s`, on: q.on?.map((n) => n.replace(/ /g, "_")) })) })!;
  assert.ok(p.parts.every((q) => /^[A-Z][a-z0-9 ]*$/.test(q.name) && q.role === q.role.toLowerCase() && !/s$/.test(q.role)));
  assert.deepEqual(p.parts.find((q) => q.role === "post")!.on, ["Bottom rail"]);
});

it("hardware with no real catalogue item blocks the merge (existing gate)", () => {
  const ab = RECIPES.recipes.find((r) => r.key === "abacus")!;
  const fake = { ...ab, parts: ab.parts.map((p) => (p.role === "axle" ? { ...p, catalogId: "brass-rod-made-up" } : p)) };
  assert.ok(learnedRecipeFailures(fake).some((x) => /no catalogue item \(brass-rod-made-up\)/.test(x)));
});
