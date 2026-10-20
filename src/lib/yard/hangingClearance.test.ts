import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { headerTitle } from "./pdf.ts";
import { buildPlan } from "./report.ts";
import { checkBuild } from "./invariants.ts";
import { hangingClearanceIssues, HANGER_CLEAR_IN, HANGER_MIN_DEPTH_IN, sideHangFits, hangerInterior, isPullOutRod } from "./hangingClearance.ts";

const rodsOf = (prompt: string) => generateFromPrompt(prompt).panels.filter((p) => /hanging rod|clothes rod/i.test(p.name));
const longAxis = (p: { size: { width: number; height: number; depth: number } }) =>
  p.size.width >= p.size.height && p.size.width >= p.size.depth ? "width" : p.size.depth >= p.size.height ? "depth" : "height";

it("a clothes rod is side to side in hanger depth, or an explicit pull-out, or refused", () => {
  const prompts = [
    "wardrobe", "wardrobe 36 wide", "wardrobe 76 tall", "wardrobe 22 deep", "wardrobe 24 deep", "wardrobe 26 deep",
    "wardrobe 8 deep", "wardrobe 15 3/4 deep", "wardrobe 12 deep", "wardrobe 19 deep", "wardrobe 20 deep",
    "wardrobe with drawers", "wardrobe with a rod", "wardrobe for a 7 ft ceiling",
    "wardrobe 4 feet wide, 6 feet tall, 2 feet deep with a hanging rod",
    "Closet system - 102in tall 80in wide", "closet system 80 wide 102 tall double hang",
    "linen closet 31.5 wide 78 tall 16 deep", "pantry cabinet",
  ];
  for (const q of prompts) {
    const p = generateFromPrompt(q);
    assert.deepEqual(hangingClearanceIssues(p), [], q);
    assert.ok(!checkBuild(p, q).some((v) => v.id === "I39"), q);
  }
});

it("an untyped wardrobe hangs side to side in a 24\" box, on a real closet rod", () => {
  for (const q of ["wardrobe", "wardrobe 36 wide", "wardrobe 76 tall"]) {
    const p = generateFromPrompt(q);
    assert.equal(p.overall.depth, 24, q);
    assert.ok(sideHangFits(hangerInterior(p)), q);
    assert.match(headerTitle(p), /24 3\/4" D/, q);
    const rod = rodsOf(q)[0];
    assert.equal(longAxis(rod), "width", q);
    assert.ok(rod.position.y + rod.size.height / 2 >= 64 && rod.position.y + rod.size.height / 2 <= 70, q);
    assert.equal(rod.materialId, "closet-rod");
    assert.ok(buildPlan(p).bom.some((b) => /closet rod/i.test(b.name)), q);
    assert.equal(p.panels.filter((x) => /divider/i.test(x.name)).length, 0, q);
  }
});

it("a typed 22 or 24 stays, and a typed depth under 12\" is refused with the minimum", () => {
  assert.equal(generateFromPrompt("wardrobe 22 deep").overall.depth, 22);
  assert.equal(generateFromPrompt("wardrobe 24 deep").overall.depth, 24);
  assert.equal(longAxis(rodsOf("wardrobe 22 deep")[0]), "width");
  const refused = generateFromPrompt("wardrobe 8 deep");
  assert.equal(refused.panels.length, 0);
  assert.match(refused.refused ?? "", new RegExp(`${HANGER_MIN_DEPTH_IN}`));
  assert.match(refused.refused ?? "", new RegExp(`${HANGER_CLEAR_IN}`));
  assert.match(refused.refused ?? "", /8/);
});

it("a typed depth too shallow for hangers uses a front-to-back pull-out, not a side rod", () => {
  for (const q of ["wardrobe 15 3/4 deep", "wardrobe 12 deep", "wardrobe 16 deep"]) {
    const p = generateFromPrompt(q);
    const rods = p.panels.filter((x) => /rod/i.test(x.name));
    assert.ok(rods.length >= 1 && rods.every(isPullOutRod), q);
    assert.ok(rods.every((r) => longAxis(r) === "depth"), q);
    assert.match(p.notes.join(" "), /pull-out rod runs front to back/i, q);
    assert.ok(buildPlan(p).bom.some((b) => /closet rod/i.test(b.name)), q);
  }
  assert.equal(longAxis(rodsOf("wardrobe 20 deep")[0]), "width");
});

it("a wide closet splits the rod with real dividers, and double hang sits near 42 and 84", () => {
  const closet = generateFromPrompt("Closet system - 102in tall 80in wide");
  assert.equal(closet.overall.depth, 24);
  assert.equal(closet.overall.width, 80);
  assert.equal(closet.overall.height, 102);
  const rods = closet.panels.filter((x) => /hanging rod/i.test(x.name));
  assert.equal(rods.length, 3);
  assert.ok(rods.every((r) => longAxis(r) === "width" && r.size.width <= 42));
  assert.ok(closet.panels.filter((x) => /bay divider/i.test(x.name)).length >= 2);
  const doubled = generateFromPrompt("closet system 80 wide 102 tall double hang");
  const ys = [...new Set(doubled.panels.filter((x) => /hanging rod/i.test(x.name)).map((r) => Math.round(r.position.y)))].sort((a, b) => a - b);
  assert.deepEqual(ys, [42, 84]);
  const wide = generateFromPrompt("wardrobe 48 wide");
  assert.ok(wide.panels.some((x) => /bay divider/i.test(x.name)));
  assert.ok(wide.panels.filter((x) => /hanging rod/i.test(x.name)).every((r) => r.size.width <= 42));
});

it("drawers keep the rod under the drawer bank", () => {
  const rod = rodsOf("wardrobe with drawers")[0];
  assert.ok(rod && longAxis(rod) === "width" && rod.position.y < 64);
});

it("the linen closet canary is unchanged, and a pantry does not grow a rod", () => {
  const linen = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  assert.equal(headerTitle(linen), 'Linen · 31 1/2" W × 16" D × 78" H');
  assert.deepEqual([linen.overall.width, linen.overall.depth, linen.overall.height], [31.5, 16, 78]);
  const plan = buildPlan(linen);
  assert.equal(plan.totals.pieces, 11);
  assert.equal(plan.totals.estCostUsd.toFixed(2), "183.70");
  assert.equal(linen.panels.filter((x) => /rod/i.test(x.name)).length, 0);
  const pantry = generateFromPrompt("pantry cabinet");
  assert.equal(pantry.overall.depth, 16);
  assert.equal(pantry.panels.filter((x) => /rod/i.test(x.name)).length, 0);
});

it("every carcass probe with a hanging rod clears the hanger rule", () => {
  const file = [
    "uploads/probes.jsonl",
    "/home/ubuntu/.cursor/projects/workspace/uploads/probes_538d.jsonl",
  ].find((f) => existsSync(f));
  const prompts = file
    ? readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l).prompt as string)
    : ["wardrobe", "bookcase", "cabinet", "pantry cabinet", "linen closet", "dresser"];
  const bad: string[] = [];
  for (const q of prompts) {
    const p = generateFromPrompt(q);
    const issues = hangingClearanceIssues(p);
    if (issues.length) bad.push(`${q}: ${issues.join("; ")}`);
  }
  assert.deepEqual(bad, []);
});
