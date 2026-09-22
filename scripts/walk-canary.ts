/**
 * Bot first command. Two freeze canaries — if either is red, stop.
 * Do not invent a FAIL class. Do not open fitted.ts.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/walk-canary.ts
 */
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { POCKET_DREAM } from "../src/lib/yard/pocket";

function near(a: number, b: number, eps = 0.15) {
  return Math.abs(a - b) <= eps;
}

let failed = 0;

function fail(id: string, msg: string) {
  failed += 1;
  console.log(`FAIL ${id}  ${msg}`);
}

function ok(id: string, msg: string) {
  console.log(`ok   ${id}  ${msg}`);
}

{
  const p = generateFromPrompt("linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep");
  const unit = p.fitted?.unit;
  const errs: string[] = [];
  if (p.kind !== "closet") errs.push(`kind ${p.kind} ≠ closet`);
  if (!/Linen/i.test(p.name)) errs.push(`name "${p.name}" missing Linen`);
  if (!unit) errs.push("no fitted unit");
  else {
    if (!near(unit.width, 31.5)) errs.push(`unit W ${unit.width} ≠ 31.5`);
    if (!near(unit.height, 78)) errs.push(`unit H ${unit.height} ≠ 78`);
    if (!near(unit.depth, 16)) errs.push(`unit D ${unit.depth} ≠ 16`);
  }
  if (!near(p.overall.width, 31.5)) errs.push(`overall W ${p.overall.width} ≠ 31.5`);
  if (!near(p.overall.height, 78)) errs.push(`overall H ${p.overall.height} ≠ 78`);
  if (!near(p.overall.depth, 16)) errs.push(`overall D ${p.overall.depth} ≠ 16`);
  if (p.kind === "house") errs.push("densified as House");
  if (!p.panels.length) errs.push("no panels");
  const linenBack = p.panels.find((x) => x.type === "back");
  if (!linenBack) errs.push("no back panel");
  else {
    if (Math.abs(Math.min(linenBack.size.width, linenBack.size.height, linenBack.size.depth) - 0.25) > 0.02) {
      errs.push(`back thickness ${JSON.stringify(linenBack.size)} ≠ 0.25`);
    }
    if (linenBack.materialId !== "plywood-1-4-4x8") {
      errs.push(`back materialId ${linenBack.materialId} ≠ plywood-1-4-4x8`);
    }
  }
  if (errs.length) fail("linen", errs.join("; "));
  else ok("linen", `${p.name}  ${p.overall.width}×${p.overall.height}×${p.overall.depth}  ${p.panels.length} panels`);
}

{
  const p = generateFromPrompt(POCKET_DREAM);
  const plan = buildPlan(p);
  const u = p.pocket?.unit;
  const errs: string[] = [];
  if (p.kind === "house") errs.push(`kind house (${p.name}) — chair space stole seating`);
  if (p.kind !== "closet") errs.push(`kind ${p.kind} ≠ closet`);
  if (!p.pocket) errs.push("project.pocket missing");
  if (!/vanity/i.test(p.name)) errs.push(`name "${p.name}" missing vanity`);
  if (/^House$/i.test(p.name)) errs.push("named House");
  if (!u) errs.push("no pocket unit");
  else {
    if (!near(u.width, 38)) errs.push(`unit W ${u.width} ≠ 38`);
    if ((u.height ?? 0) < 90) errs.push(`unit H ${u.height} lost 102 mixed-use`);
    if (!near(u.depth, 17, 0.5)) errs.push(`unit D ${u.depth} ≠ 17`);
  }
  if (!p.panels.length) errs.push("no panels");
  if (!plan.cutList.length) errs.push("empty cut list");
  const pocketBack = p.panels.find((x) => x.type === "back");
  if (pocketBack && pocketBack.materialId !== "plywood-1-4-4x8") {
    errs.push(`back materialId ${pocketBack.materialId} ≠ plywood-1-4-4x8`);
  }
  const backCut = plan.cutList.find((c) => /back/i.test(c.name) && (c.thicknessIn ?? 1) < 0.5);
  if (backCut && /3\/4|0\.75/.test(backCut.material ?? "")) {
    errs.push(`back cut material still 3/4: ${backCut.material}`);
  }
  if (errs.length) fail("pocket", errs.join("; "));
  else
    ok(
      "pocket",
      `${p.name}  ${u?.width}×${u?.height}×${u?.depth}  ${p.panels.length} panels  ${plan.cutList.length} cuts`,
    );
}

if (failed) {
  console.log(`\n${failed} canary red — fix this, then stop. Do not invent a FAIL class.`);
  process.exit(1);
}
console.log("\ncanary green — linen 31.5×78×16 and original pocket are honest.");
process.exit(0);
