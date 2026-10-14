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
  const spokeless = { ...OLD_WW, parts: OLD_WW.parts.map((p) => (p.role === "wheel" ? { ...p, shape: "ring" as const } : p)) };
  assert.ok(learnedRecipeFailures(spokeless).some((f) => /floats: nothing joins its rim/.test(f)));
  assert.ok(!get("water-wheel").held && !get("abacus").held); // Critic: abacus TRUSTED (8db4a41), water wheel TRUSTED (2fe1234)
  const box = { ...get("abacus"), parts: get("abacus").parts.map((p) => ({ ...p, shape: undefined, catalogId: p.role === "axle" ? undefined : p.catalogId, stock: undefined, kind: p.role === "bead" ? ("hardware" as const) : p.kind })) };
  assert.ok(learnedRecipeFailures(box).some((f) => /no catalogue item|drawn as a box/.test(f)));
  // A learned recipe stays a candidate until Critic grades it TRUSTED (scripts/apply-ledger.ts); a trusted one is never held.
  assert.ok(RECIPES.recipes.filter((r) => r.learned).every((r) => r.trust === "candidate" || (r.trust === "trusted" && !r.held)));
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
  // Parts that turn together (rim, spokes, paddles) fasten to each other; nothing fastens across the moving joint.
  const pin = new Set(ps.filter((p) => /^dowel-/.test(p.materialId)).map((p) => p.id));
  assert.ok(!panelJoints(ps).some((j) => turning.has(j.a) !== turning.has(j.b) || pin.has(j.a) || pin.has(j.b)));
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

it("a spinning rim gets spokes to the hub and paddles, centred on the axle, and the posts are drilled", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const ps = buildRecipe(RECIPES.recipes.find((r) => r.key === "water-wheel")!, "water wheel").project.panels;
  const axle = ps.find((p) => /^axle/.test(p.name))!, rim = ps.find((p) => p.name === "Wheel" || p.name === "wheel")!;
  const c = (p: typeof axle, a: "y" | "z", k: "height" | "depth") => p.position[a] + p.size[k] / 2;
  assert.ok(Math.abs(c(rim, "y", "height") - c(axle, "y", "height")) < 0.01 && Math.abs(c(rim, "z", "depth") - c(axle, "z", "depth")) < 0.01);
  assert.equal(ps.filter((p) => /^Spoke/.test(p.name)).length, 2);
  assert.equal(ps.filter((p) => /^Paddle/.test(p.name)).length, 4);
  assert.ok(ps.filter((p) => /post/.test(p.name)).every((p) => /hole for each axle/.test(p.cutNote ?? "")));
});

it("recipe builds: their model-made steps are real steps, and no closet or opening wording", () => {
  for (const k of ["water-wheel", "abacus"]) {
    const f = learnedRecipeFailures(RECIPES.recipes.find((r) => r.key === k)!);
    assert.ok(!f.some((x) => /fallback|fitted wording/.test(x)), `${k}: ${f.join("; ")}`);
  }
});

it("bores run along their rod, rods are round dowels seated in drilled holes, with a drilling step", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  const b = buildRecipe(RECIPES.recipes.find((r) => r.key === "abacus")!, "abacus");
  const ps = b.project.panels;
  const rod = ps.find((p) => p.name === "rod 1")!, bead = ps.find((p) => p.name === "bead 1")!;
  assert.equal(rod.polygon?.plane, "xz");
  assert.equal(bead.polygon?.plane, "xz");
  const rail = ps.find((p) => p.name === "bottom rail")!;
  assert.ok(rod.position.y < rail.position.y + rail.size.height - 0.5);
  assert.match(rail.cutNote ?? "", /Drill a .* hole for each rod/);
  const t = buildPlan(b.project).instructions;
  const drill = t.findIndex((s) => s.title === "Drill the holes");
  assert.ok(drill > 0 && drill < t.findIndex((s) => /rod/.test(s.title)));
  assert.ok(!/Drive \d+/.test(t[drill].description));
});

it("short dowel parts are bought as shared stock, not one dowel each", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  const bom = buildPlan(buildRecipe(RECIPES.recipes.find((r) => r.key === "abacus")!, "abacus").project).bom;
  assert.equal(bom.find((b) => /^1" Hardwood Dowel/.test(b.name))!.quantity, 2);
  assert.equal(bom.find((b) => /^1\/4" Hardwood Dowel/.test(b.name))!.quantity, 3);
  assert.ok(bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0) < 60);
});

it("identical numbered parts share one cut-list line and letter", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  const cut = buildPlan(buildRecipe(RECIPES.recipes.find((r) => r.key === "abacus")!, "abacus").project).cutList;
  assert.equal(cut.find((c) => c.name.toLowerCase() === "rod")?.quantity, 9);
  assert.equal(cut.find((c) => c.name.toLowerCase() === "bead")?.quantity, 45);
});

it("hardware comes only from parts that exist: dowels are never counted as back edges", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  const ab = RECIPES.recipes.find((r) => r.key === "abacus")!;
  const still = { ...ab, moving: [] };
  const bom = buildPlan(buildRecipe(still, "abacus").project).bom;
  assert.ok(!bom.some((b) => /back edge/.test(b.notes ?? "")));
});

it("a sheet part thicker than its sheet is a glue-up of plies with its own step", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  const plan = buildPlan(buildRecipe(RECIPES.recipes.find((r) => r.key === "water-wheel")!, "water wheel").project);
  const hub = plan.cutList.find((c) => c.name.toLowerCase() === "hub")!;
  assert.equal(hub.thicknessIn, 0.75);
  assert.equal(hub.quantity, 5);
  assert.ok(plan.instructions.some((s) => s.title === "Glue up the thick parts" && /hub: 5 layers/.test(s.description)));
});

it("hinged parts touch what they hinge to, and a lid over walls of two heights slopes", async () => {
  const frame = (lidY: number, lidH: number) => ({
    key: "test-cold-frame", synonyms: [], version: 1, trust: "candidate", title: "Cold frame", learned: true,
    size: { width: 48, height: 18, depth: 36 }, defining: ["wall", "lid"],
    parts: [
      { role: "wall", name: "Back wall", box: [0, 0, 0.95, 1, 1, 0.05], kind: "panel" },
      { role: "wall", name: "Front wall", box: [0, 0, 0, 1, 0.6, 0.05], kind: "panel" },
      { role: "wall", name: "Left wall", box: [0, 0, 0.05, 0.03, 0.6, 0.9], kind: "panel", on: [] },
      { role: "wall", name: "Right wall", box: [0.97, 0, 0.05, 0.03, 0.6, 0.9], kind: "panel" },
      { role: "lid", name: "Lid", box: [0, lidY, 0, 1, lidH, 1], kind: "panel", on: ["Back wall"] },
    ],
    moving: [{ part: "Lid", motion: "hinge" }], notes: [],
  }) as unknown as Recipe;
  const flat = learnedRecipeFailures(frame(0.6, 0.04));
  // The builder seats a hinged lid on the tallest wall and slopes it over walls of two heights.
  assert.ok(!flat.some((f) => /Lid lies flat over walls of two heights/.test(f)), flat.join("; "));
  const floating = learnedRecipeFailures({ ...frame(0.6, 0.04), parts: frame(0.6, 0.04).parts.map((p) => (p.name === "Lid" ? { ...p, box: [0, 0.2, 0.3, 0.5, 0.04, 0.3] as typeof p.box } : p)) });
  assert.ok(floating.some((f) => /Lid is hinged but does not touch/.test(f)));
  const sloped = learnedRecipeFailures(frame(0.6, 0.4));
  assert.ok(!sloped.some((f) => /Lid (?:lies flat|is hinged)/.test(f)));
  // Critic 8db4a41: seating the lid on the tallest wall must not push it out of the overall height.
  const { buildRecipe, validateRecipe } = await import("./recipeBuild.ts");
  for (const r of [frame(0.6, 0.04), frame(0.6, 0.4)]) assert.deepEqual(validateRecipe(r, buildRecipe(r, "cold frame"), "cold frame"), []);
});

it("a panel wider than its board stock is cut from the sheet", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const r = { key: "t-cf", synonyms: [], version: 1, trust: "candidate", title: "Cold frame", learned: true, stock: "lumber-2x4-8",
    size: { width: 48, height: 20, depth: 36 }, defining: ["wall"], notes: [],
    parts: [{ role: "wall", name: "Back wall", box: [0, 0, 0.95, 1, 1, 0.05], kind: "panel" }, { role: "wall", name: "Front wall", box: [0, 0, 0, 1, 0.5, 0.05], kind: "panel" }] } as unknown as Recipe;
  const b = buildRecipe(r, "cold frame");
  assert.ok(b.project.panels.every((p) => !/2x4|2×4/.test(p.materialId)), b.project.panels.map((p) => p.materialId).join());
});

it("a rotor between two supports goes on the axle before the axle is glued into the second support", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  const r = RECIPES.recipes.find((x) => x.key === "water-wheel")!;
  const st = buildPlan(buildRecipe(r, "water wheel").project).instructions.map((s) => `${s.title} ${s.description}`);
  const at = (re: RegExp) => st.findIndex((s) => re.test(s));
  assert.ok(at(/Slide the F hub onto/) > at(/Pass the E axle 1 through the right post and glue it there/));
  assert.ok(at(/Slide the left post onto the free end/) > at(/Fasten the 4 paddles/));
});

it("layers that form one modelled thickness get a glue-up step: a 1 1/2in ply top, a 3 5/8in post from 2x4", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  const r = { key: "t-trestle", synonyms: [], version: 1, trust: "candidate", learned: true, title: "Trestle table", size: { width: 72, height: 30, depth: 36 }, defining: ["top"], notes: [],
    parts: [{ role: "foot", name: "Left foot", box: [0.05, 0, 0.1, 0.05, 0.05, 0.8], kind: "member" }, { role: "leg", name: "Left post", box: [0.05, 0.05, 0.45, 0.05, 0.85, 0.1], kind: "member", on: ["Left foot"] },
      { role: "foot", name: "Right foot", box: [0.9, 0, 0.1, 0.05, 0.05, 0.8], kind: "member" }, { role: "leg", name: "Right post", box: [0.9, 0.05, 0.45, 0.05, 0.85, 0.1], kind: "member", on: ["Right foot"] },
      { role: "stretcher", name: "Stretcher", box: [0.1, 0.4, 0.47, 0.8, 0.1, 0.06], kind: "member", on: ["Left post", "Right post"] },
      { role: "top", name: "Tabletop", box: [0, 0.95, 0, 1, 0.05, 1], kind: "panel", on: ["Left post", "Right post"] }] } as unknown as Recipe;
  const plan = buildPlan(buildRecipe(r, "trestle table").project);
  const glue = plan.instructions.find((s) => s.title === "Glue up the thick parts")?.description ?? "";
  assert.match(glue, /Left post: 2 layers of 2×8/); // a trestle leg is a wide upright, not one 2x4
  assert.match(glue, /Tabletop: 2 layers/);
  assert.equal(plan.cutList.find((c) => c.name === "Post")?.thicknessIn, 1.5);
  assert.equal(plan.cutList.find((c) => c.name === "Post")?.widthIn, 7.25);
});

it("a food-contact board is hardwood, glued, oiled food-safe: no screws, floor or feet", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  const r = { key: "t-board", synonyms: [], version: 1, trust: "candidate", learned: true, title: "Cutting board", size: { width: 18, height: 1.5, depth: 12 }, defining: ["board"], notes: [], count: { word: "strips", default: 4 },
    parts: [{ role: "board", name: "Board strip", box: [0, 0, 0, 0.25, 1, 1], kind: "member", repeat: "each" }, { role: "foot", name: "Foot", box: [0.05, 0, 0.05, 0.1, 0.2, 0.1], kind: "member" }] } as unknown as Recipe;
  const plan = buildPlan(buildRecipe(r, "cutting board").project);
  const text = JSON.stringify([plan.instructions, plan.bom]);
  assert.doesNotMatch(text.replace(/No screws or nails/g, ""), /screw|\bfloor\b|\bfeet\b|\bfoot\b/i);
  assert.match(text, /Maple/);
  assert.match(text, /food-safe/i);
});

it("a tall single pedestal gets a foot spreading both ways, and a gnomon is a triangle", async () => {
  const { buildRecipe, validateRecipe } = await import("./recipeBuild.ts");
  const r = { key: "t-sundial", synonyms: [], version: 1, trust: "candidate", learned: true, title: "Sundial", size: { width: 16, height: 40, depth: 16 }, defining: ["pedestal"], notes: [],
    parts: [{ role: "foot", name: "Foot", box: [0.32, 0, 0, 0.36, 0.04, 1], kind: "member" }, { role: "pedestal", name: "Pedestal", box: [0.4, 0.04, 0.4, 0.2, 0.9, 0.2], kind: "member", on: ["Foot"] },
      { role: "dial", name: "Dial", box: [0, 0.94, 0, 1, 0.03, 1], kind: "panel", on: ["Pedestal"] }, { role: "gnomon", name: "Gnomon", box: [0.48, 0.97, 0.2, 0.03, 0.03, 0.5], kind: "member", on: ["Dial"] }] } as unknown as Recipe;
  const b = buildRecipe(r, "sundial");
  const floor = b.project.panels.filter((p) => p.position.y < 0.05);
  const span = (a: "x" | "z", s: "width" | "depth") => Math.max(...floor.map((p) => p.position[a] + p.size[s])) - Math.min(...floor.map((p) => p.position[a]));
  assert.ok(span("x", "width") >= 12 && span("z", "depth") >= 12, `${span("x", "width")} x ${span("z", "depth")}`);
  assert.equal(b.project.panels.find((p) => p.name === "Gnomon")?.polygon?.pts.length, 3);
  assert.ok(!validateRecipe(r, b, "sundial").some((f) => /tips/.test(f)));
});

it("a hinged lid rests on every wall, is hung on its hinges (never screwed), and hinges are bought, not cut", async () => {
  const { buildRecipe, validateRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  const r = { key: "t-lap", synonyms: [], version: 1, trust: "candidate", learned: true, title: "Lap desk", size: { width: 18, height: 5, depth: 12 }, defining: ["lid"], notes: [],
    parts: [{ role: "bottom", name: "Bottom", box: [0.03, 0, 0.03, 0.94, 0.12, 0.94], kind: "panel" },
      { role: "rail", name: "Front rail", box: [0.03, 0.12, 0.03, 0.94, 0.28, 0.08], kind: "member", on: ["Bottom"] },
      { role: "rail", name: "Back rail", box: [0.03, 0.12, 0.89, 0.94, 0.48, 0.08], kind: "member", on: ["Bottom"] },
      { role: "rail", name: "Left rail", box: [0.03, 0.12, 0.03, 0.08, 0.4, 0.94], kind: "member", on: ["Bottom"] },
      { role: "rail", name: "Right rail", box: [0.89, 0.12, 0.03, 0.08, 0.4, 0.94], kind: "member", on: ["Bottom"] },
      { role: "lid", name: "Writing lid", box: [0.03, 0.6, 0.03, 0.94, 0.12, 0.94], kind: "panel", on: ["Back rail"] },
      { role: "hinge", name: "Left hinge", box: [0.18, 0.42, 0.86, 0.12, 0.08, 0.1], kind: "hardware", on: ["Back rail", "Writing lid"] },
      { role: "hinge", name: "Right hinge", box: [0.7, 0.42, 0.86, 0.12, 0.08, 0.1], kind: "hardware", on: ["Back rail", "Writing lid"] }],
    moving: [{ part: "Writing lid", motion: "hinge" }] } as unknown as Recipe;
  const b = buildRecipe(r, "lap desk");
  assert.deepEqual(validateRecipe(r, b, "lap desk"), []);
  const lid = b.project.panels.find((p) => p.name === "Writing lid")!, front = b.project.panels.find((p) => p.name === "Front rail")!;
  assert.ok(Math.abs(lid.position.y - (front.position.y + front.size.height)) < 0.05, "lid rests on the front rail");
  const plan = buildPlan(b.project);
  assert.ok(!plan.cutList.some((c) => /hinge/i.test(c.name)));
  assert.ok(plan.bom.some((x) => /hinge/i.test(x.name)));
  const lidStep = plan.instructions.find((s) => (s.partsUsed ?? []).includes("Writing lid"))!;
  assert.match(lidStep.description, /takes no screws/);
  assert.ok(!plan.instructions.some((s) => /Glue up the thick parts/.test(s.title) && /Writing lid/.test(s.description)));
});

it("geometry is real: a recentred wheel stands on the floor, the box is the build, and a cold frame's lid is glazed", async () => {
  const { buildRecipe, validateRecipe } = await import("./recipeBuild.ts");
  const wb = { key: "t-wb", synonyms: [], version: 1, trust: "candidate", learned: true, title: "Wheelbarrow", size: { width: 24, height: 26, depth: 56 }, defining: ["wheel"], notes: [],
    parts: [{ role: "wheel", name: "Wheel", box: [0.33, 0, 0, 0.34, 0.62, 0.29], kind: "member", shape: "disc" },
      { role: "axle", name: "Axle", box: [0.2, 0.25, 0.12, 0.6, 0.06, 0.04], kind: "hardware", shape: "cylinder", on: ["Left handle", "Right handle"] },
      { role: "handle", name: "Left handle", box: [0.15, 0.2, 0.1, 0.08, 0.08, 0.9], kind: "member", on: ["Left leg"] }, { role: "handle", name: "Right handle", box: [0.77, 0.2, 0.1, 0.08, 0.08, 0.9], kind: "member", on: ["Right leg"] },
      { role: "leg", name: "Left leg", box: [0.15, 0, 0.6, 0.08, 0.28, 0.06], kind: "member" }, { role: "leg", name: "Right leg", box: [0.77, 0, 0.6, 0.08, 0.28, 0.06], kind: "member" },
      { role: "tray", name: "Tray floor", box: [0.1, 0.28, 0.2, 0.8, 0.04, 0.5], kind: "panel", on: ["Left handle", "Right handle"] }],
    moving: [{ part: "Wheel", motion: "spin" }] } as unknown as Recipe;
  const b = buildRecipe(wb, "wheelbarrow");
  assert.ok(Math.min(...b.project.panels.map((p) => p.position.y)) >= -0.001);
  assert.deepEqual(validateRecipe(wb, b, "wheelbarrow"), []);
  const cf = { key: "t-cf2", synonyms: [], version: 1, trust: "candidate", learned: true, title: "Cold frame", size: { width: 48, height: 18, depth: 36 }, defining: ["wall", "lid"], notes: [],
    parts: [{ role: "wall", name: "Back wall", box: [0, 0, 0.95, 1, 1, 0.05], kind: "panel" }, { role: "wall", name: "Front wall", box: [0, 0, 0, 1, 0.6, 0.05], kind: "panel" },
      { role: "wall", name: "Left wall", box: [0, 0, 0.05, 0.03, 1, 0.9], kind: "panel" }, { role: "wall", name: "Right wall", box: [0.97, 0, 0.05, 0.03, 1, 0.9], kind: "panel" },
      { role: "lid", name: "Lid", box: [0, 0.6, 0, 1, 0.04, 1], kind: "panel", on: ["Back wall"] }], moving: [{ part: "Lid", motion: "hinge" }] } as unknown as Recipe;
  const c = buildRecipe(cf, "cold frame");
  assert.equal(c.project.panels.find((p) => p.name === "Lid")?.materialId, "acrylic-sheet");
  assert.ok(c.project.panels.find((p) => p.name === "Left wall")?.polygon, "side walls clamp under the slope");
  assert.deepEqual(validateRecipe(cf, c, "cold frame"), []);
});

it("a hollow vessel is a staved shell with its inner parts in the cavity, never a solid glue-up", async () => {
  const { buildRecipe, validateRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  const r = { key: "t-churn", synonyms: [], version: 1, trust: "candidate", learned: true, title: "Butter churn", size: { width: 12, height: 36, depth: 12 }, defining: ["body", "dasher"], notes: [],
    parts: [{ role: "body", name: "Barrel", box: [0, 0, 0, 1, 0.8, 1], kind: "member", shape: "cylinder" }, { role: "lid", name: "Lid", box: [0, 0.8, 0, 1, 0.04, 1], kind: "panel", on: ["Barrel"] },
      { role: "dasher", name: "Dasher staff", box: [0.45, 0.1, 0.45, 0.1, 0.9, 0.1], kind: "member", shape: "cylinder", on: ["Lid"] }] } as unknown as Recipe;
  const b = buildRecipe(r, "butter churn");
  assert.deepEqual(validateRecipe(r, b, "butter churn"), []);
  assert.ok(b.project.panels.filter((p) => /stave/.test(p.name)).length >= 4);
  assert.ok(!buildPlan(b.project).instructions.some((s) => /Glue up the thick parts/.test(s.title) && /Barrel/.test(s.description)));
});

import { buildRecipe as bR, validateRecipe as vR } from "./recipeBuild.ts";
it("overlapping leg pairs become half-lapped X boards", () => {
    const SB: any = {key:"sawbuck",synonyms:[],version:1,trust:"candidate",learned:true,title:"Sawbuck",size:{width:36,height:30,depth:22},defining:["leg","rail"],notes:[],parts:[
{role:"leg",name:"Left leg A",box:[0.04,0,0,0.1,1,0.65],kind:"member"},{role:"leg",name:"Left leg B",box:[0.04,0,0.35,0.1,1,0.65],kind:"member"},
{role:"leg",name:"Right leg A",box:[0.86,0,0,0.1,1,0.65],kind:"member"},{role:"leg",name:"Right leg B",box:[0.86,0,0.35,0.1,1,0.65],kind:"member"},
{role:"rail",name:"Top rail A",box:[0.04,0.62,0.19,0.92,0.08,0.07],kind:"member",on:["Left leg A","Right leg A"]},
{role:"rail",name:"Top rail B",box:[0.04,0.62,0.74,0.92,0.08,0.07],kind:"member",on:["Left leg B","Right leg B"]}]};
    const b: any = bR(SB, "sawbuck");
    assert.deepEqual(vR(SB, b, "sawbuck"), []);
    const a = b.project.panels.find((p: any) => p.name === "Left leg A");
    assert.ok(a.polygon);
    assert.deepEqual(a.joints[0], { with: "Left leg B", kind: "lap" });
});

it("Critic's 10-13 classes are gate checks: holes no part has, numbered slugs, hardware and thin parts screwed", async () => {
  const { learnedRecipeFailures } = await import("./learnedGate.ts");
  const f = (k: string) => learnedRecipeFailures(RECIPES.recipes.find((r) => r.key === k)!).join("\n");
  // The saved board now drills its 120-hole peg tracks, so the hole check passes on it.
  assert.doesNotMatch(f("cribbage-board"), /holes/);
  // Engine side: Peg1…Peg4 are 4 Pegs cut from a 1/4" dowel, glued into drilled holes, with no screws bought.
  const { buildRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  const plan = buildPlan(buildRecipe(RECIPES.recipes.find((r) => r.key === "cribbage-board")!, "cribbage board").project);
  assert.equal(plan.cutList.find((c) => /^peg$/i.test(c.name))?.quantity, 4);
  assert.match(plan.cutList.find((c) => /^peg$/i.test(c.name))!.material, /1\/4" Hardwood Dowel/);
  assert.ok(!plan.bom.some((b) => /screw/i.test(b.name)));
  // Engine side: its 0.45" sides are glued at build time, so the gate's screw check finds nothing.
  assert.doesNotMatch(f("knife-block-maple"), /takes a screw/);
  for (const k of ["water-wheel", "abacus"]) assert.equal(f(k), "", k);
});

it("a divider repeated between the sides stands on edge even when the recipe lays it flat", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const kb = RECIPES.recipes.find((r) => r.key === "knife-block-maple")!;
  const flat = { ...kb, parts: kb.parts.map((p) => (p.repeat === "between" ? { ...p, box: [0.05, 0.9, 0.05, 0.9, 0.04, 0.88] as typeof p.box } : p)) };
  for (const d of buildRecipe(flat, "knife block").project.panels.filter((p) => /divider/i.test(p.name))) assert.ok(d.size.width < d.size.height && d.size.width < d.size.depth, JSON.stringify(d.size));
});

it("pegs don't raise the header height; thin board parts are glued and bought with the board, never an orphan backer", async () => {
  const { buildRecipe } = await import("./recipeBuild.ts");
  const { buildPlan } = await import("./report.ts");
  assert.equal(buildRecipe(RECIPES.recipes.find((r) => r.key === "cribbage-board")!, "cribbage board").project.overall.height, 0.75);
  const plan = buildPlan(buildRecipe(RECIPES.recipes.find((r) => r.key === "knife-block-maple")!, "knife block").project);
  const ids = new Set(plan.cutList.map((c) => c.id.split("|")[0]));
  for (const b of plan.bom.filter((x) => /-1-4-|lumber/.test(x.catalogId ?? ""))) assert.ok(ids.has(b.catalogId!), b.name);
  assert.ok(plan.instructions.some((s) => /Glue the (?:[A-Z] )?Slot divider/.test(s.description)));
});

it("a hole array is drilled in the model: a cribbage board shows its 120 peg holes and the gate counts them", async () => {
  const { buildRecipe, validateRecipe } = await import("./recipeBuild.ts");
  const r = { key: "t-crib", synonyms: [], version: 1, trust: "candidate", learned: true, title: "Cribbage board", size: { width: 15, height: 0.75, depth: 4 }, defining: ["deck"],
    notes: ["Two tracks of 60 holes per track"],
    parts: [{ role: "deck", name: "Board", box: [0, 0, 0, 1, 1, 1], kind: "panel", holes: { count: 120, dia: 0.125, rows: 4 } }] } as unknown as Recipe;
  const b = buildRecipe(r, "cribbage board");
  const board = b.project.panels.find((p) => p.name === "Board")!;
  assert.equal(board.polygon?.holes?.length, 120);
  assert.ok(board.polygon!.holes!.every((h) => h.x > 0 && h.x < board.size.width && h.y > 0 && h.y < board.size.depth));
  assert.ok(!validateRecipe(r, b, "cribbage board").some((f) => /holes/.test(f)));
  assert.ok(!learnedRecipeFailures(r).some((f) => /holes/.test(f)));
  const bare = { ...r, parts: [{ ...r.parts[0], holes: undefined }] } as unknown as Recipe;
  assert.ok(learnedRecipeFailures(bare).some((f) => /names 60 holes the model does not drill/.test(f)));
});
