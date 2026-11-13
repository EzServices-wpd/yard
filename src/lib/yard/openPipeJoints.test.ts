/**
 * Open PVC frames buy a fitting only when every meeting is square or straight.
 * On a split, Step 1, the cut step, and the Buy pipe note name the segments, and
 * the note's stick count is the Buy count. The plumb sentence still names the
 * original legs. A mutant that leaves the whole-member cuts in place, or that
 * sells a slanted joint as a tee-priced cross, fails these checks.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { catalogMeeting } from "./openPipeJoints.ts";
import { inchFrac } from "./inchText.ts";
import type { Vec3 } from "./types.ts";

function textOf(prompt: string, material?: string) {
  const project = material ? generateFromPrompt(prompt, material) : generateFromPrompt(prompt);
  const plan = buildPlan(project);
  const text = plan.instructions.map((s) => `${s.title}\n${s.description ?? ""}`).join("\n");
  return { project, plan, text };
}

test("a PVC ladder keeps the release legs and buys one tee per meeting", () => {
  const { plan, text } = textOf("pvc ladder 20x60");
  assert.match(text, /The 2 legs stand plumb, 60" tall/);
  assert.match(text, /Cut and mark the two rails — 2 legs/);
  assert.match(text, /17 marked cuts \(5 × 18", 12 × 10"\)/);
  assert.match(text, /12 B Leg 10 ×/);
  assert.match(text, /5 A Rung 18 ×/);
  assert.doesNotMatch(text, /The 12 legs|The 14 legs|stand plumb, 10" tall|2 × 60"|2 A Leg 60/);
  assert.equal(text.match(/The fittings are 10 3\/4" PVC tees, the same fittings on the Buy list\./g)?.length, 1);
  const tees = plan.bom.find((b) => /PVC tee$/.test(b.name));
  assert.equal(tees?.quantity, 10);
  assert.equal(tees?.catalogId, "pvc-tee");
  assert.equal(Math.round(((tees?.estimatedCost ?? 0) / (tees?.quantity ?? 1)) * 100) / 100, 1.18);
  const pipe = plan.bom.find((b) => b.catalogId === "pvc-3-4-sch40");
  const sticks = pipe?.notes?.match(/from (\d+) whole pipes?/);
  assert.equal(Number(sticks?.[1]), pipe?.quantity);
  assert.match(pipe?.notes ?? "", /Cut to: 18", 10"/);
  const legs = plan.cutList.find((c) => c.name === "Leg");
  assert.equal(legs?.quantity, 12);
  assert.equal(legs?.lengthIn, 10);
  assert.equal(Math.round(plan.totals.estCostUsd * 100) / 100, 30.8);
});

test("telling the ladder steps about the cut segments fails", () => {
  const { text } = textOf("pvc ladder 20x60");
  const release = /The 2 legs stand plumb, 60" tall/;
  const segmented = /The 12 legs stand plumb, 10" tall/;
  assert.match(text, release);
  assert.equal(segmented.test(text), false);
});

test("a slanted joint is not a catalog fitting, and those builds stay on the release Buy", () => {
  const straight: Vec3 = { x: 1, y: 0, z: 0 };
  const square: Vec3 = { x: 0, y: 1, z: 0 };
  const slant: Vec3 = { x: -0.5, y: Math.sin((120 * Math.PI) / 180), z: 0 };
  assert.equal(catalogMeeting([straight, square]), "elbow90");
  assert.equal(catalogMeeting([straight, slant]), null);
  const axis: Vec3 = { x: 1, y: 0, z: 0 };
  const back: Vec3 = { x: -1, y: 0, z: 0 };
  const up: Vec3 = { x: 0, y: 1, z: 0 };
  const down: Vec3 = { x: 0, y: -1, z: 0 };
  const post: Vec3 = { x: 0, y: 0, z: 1 };
  const skew: Vec3 = { x: 0.5, y: Math.sin((60 * Math.PI) / 180), z: 0 };
  const skewBack: Vec3 = { x: -0.5, y: -Math.sin((60 * Math.PI) / 180), z: 0 };
  assert.equal(catalogMeeting([axis, back, up, down, post]), "cross5");
  assert.equal(catalogMeeting([axis, back, skew, skewBack, post]), null);
  const plant = textOf("pvc plant stand");
  assert.match(plant.text, /The 4 legs stand plumb, 24" tall/);
  assert.doesNotMatch(plant.text, /10 13\/16/);
  assert.equal(plant.plan.bom.some((b) => /cross/i.test(b.name)), false);
  assert.equal(Math.round(plant.plan.totals.estCostUsd * 100) / 100, 49.04);
  const cage = textOf("pvc tomato cage");
  assert.equal(cage.plan.bom.some((b) => /cross/i.test(b.name)), false);
  assert.doesNotMatch(cage.text, /The fittings are/);
  assert.equal(Math.round(cage.plan.totals.estCostUsd * 100) / 100, 54.26);
  const stool = textOf("pvc step stool");
  assert.match(stool.text, /The 4 legs stand plumb, 36" tall/);
  assert.doesNotMatch(stool.text, /The fittings are/);
  assert.equal(Math.round(stool.plan.totals.estCostUsd * 100) / 100, 48.75);
  const obelisk = textOf("pvc obelisk");
  assert.doesNotMatch(obelisk.text, /The fittings are/);
  assert.equal(Math.round(obelisk.plan.totals.estCostUsd * 100) / 100, 33.41);
  const garden = textOf("garden obelisk from pvc");
  assert.doesNotMatch(garden.text, /The fittings are/);
  assert.equal(Math.round(garden.plan.totals.estCostUsd * 100) / 100, 41.96);
  const easel = textOf("pvc easel");
  assert.doesNotMatch(easel.text, /The fittings are/);
  assert.equal(Math.round(easel.plan.totals.estCostUsd * 100) / 100, 19.12);
});

test("a square frame names the corners it already buys, and racks and canaries stay put", () => {
  const frame = textOf("pvc frame 24x36");
  assert.match(frame.text, /The 4 legs stand plumb, 36" tall/);
  assert.match(frame.text, /The fittings are 8 3\/4" PVC 3-way corners, the same fittings on the Buy list\./);
  assert.equal(Math.round(frame.plan.totals.estCostUsd * 100) / 100, 49.51);
  const trellis = textOf("pvc trellis");
  assert.match(trellis.text, /The 2 legs stand plumb, 72" tall/);
  assert.match(trellis.text, /The 3 rails stand plumb, 72" tall/);
  assert.doesNotMatch(trellis.text, /The 24 legs|The 36 rails stand plumb, 6" tall|× 72"|× 24"/);
  const trellisPipe = trellis.plan.bom.find((b) => b.catalogId === "pvc-3-4-sch40");
  const trellisSticks = trellisPipe?.notes?.match(/from (\d+) whole pipes?/);
  assert.equal(Number(trellisSticks?.[1]), trellisPipe?.quantity);
  assert.match(trellisPipe?.notes ?? "", /Cut to: 6"/);
  const stool60 = textOf("20x60 pvc step stool");
  const stoolPipe = stool60.plan.bom.find((b) => b.catalogId === "pvc-3-4-sch40");
  const stoolSticks = stoolPipe?.notes?.match(/from (\d+) whole pipes?/);
  assert.equal(Number(stoolSticks?.[1]), stoolPipe?.quantity);
  const cut = stool60.plan.instructions.find((s) => /^Cut the\b/.test(s.title));
  for (const line of stool60.plan.cutList) {
    assert.ok((cut?.description ?? "").includes(`${line.quantity} ${line.label} ${line.name} ${inchFrac(line.lengthIn)} ×`));
  }
  assert.equal(stoolPipe?.quantity, 4);
  assert.match(stoolPipe?.notes ?? "", /Cut to: 60 1\/4", 60", 33", 27", 18", 6"/);
  assert.doesNotMatch(stool60.text, /60 5\/16/);
  assert.match(stool60.text, /12 marked cuts \(2 × 60 1\/4", 2 × 60", 2 × 33", 2 × 27", 3 × 18", 1 × 6"\)/);
  assert.equal(Math.round(stool60.plan.totals.estCostUsd * 100) / 100, 53.63);
  const cross = trellis.plan.bom.find((b) => /PVC cross$/.test(b.name));
  assert.equal(cross?.catalogId, "pvc-cross");
  assert.notEqual(Math.round(((cross?.estimatedCost ?? 0) / (cross?.quantity ?? 1)) * 100) / 100, 1.18);
  const shoe = textOf("pvc shoe rack");
  assert.equal(Math.round(shoe.plan.totals.estCostUsd * 100) / 100, 124.96);
  assert.equal(shoe.text.includes("The fittings are"), false);
  const linen = textOf("linen closet 31.5 wide 78 tall 16 deep");
  assert.equal(Math.round(linen.plan.totals.estCostUsd * 100) / 100, 193.68);
  assert.equal(linen.project.instances.length + linen.project.panels.length, 11);
  assert.equal(linen.plan.bom.length, 8);
  assert.equal(linen.plan.instructions.length, 9);
});
