/**
 * Walk the 10 launch builds. Fail = size lie or a plan a stranger cannot cut from.
 * Run: npx tsx --tsconfig tsconfig.json scripts/walk-launch.ts
 */
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";

const BUILDS: { id: string; prompt: string; expect?: { w?: number; h?: number; d?: number; kind?: string; nameIncludes?: string } }[] = [
  { id: "1-pocket", prompt: `I have a pocket space in my bathroom with these exact dimensions:
Back wall: 38.5 inches wide. Left side depth: 26 inches. Right side depth: 33.5 inches. All walls: 102 inches high. Open to the front.
The side walls are angled (almost trapezoidal): at 20 inches perpendicular from the back wall, the opening is 46 inches wide. Left of centerline at 20": 25 inches. Right of centerline at 20": 21 inches. Left wall angle ≈ 16.05°. Right wall angle ≈ 5.00°.
I want mixed-use towel and linen storage as well as a vanity space.
A centered rectangular unit 38 inches wide × 17 inches deep × 102 inches high. Front face parallel to the back wall, centered on the back-wall centerline. At 17" depth: about 5.1" clearance on the left and 1.7" on the right.
Centered vanity with open knee space (≈22 inches clear) under a counter at 34 inches high. Drawers on either side of the knee space. Upper cabinetry from 54 inches to the ceiling (102"). Large doors with adjustable shelving for towels and linens. Mirror and storage beside the chair space. Structurally centered and anchored into studs.`, expect: { kind: "closet", nameIncludes: "vanity" } },
  { id: "2-linen", prompt: "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep", expect: { w: 31.5, h: 78, d: 16, kind: "closet", nameIncludes: "Closet" } },
  { id: "3-window", prompt: "Andersen 100 Series 36 by 48 double hung window, frame the rough opening", expect: { kind: "opening" } },
  { id: "4-desk", prompt: "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space", expect: { w: 60, h: 29, d: 30, kind: "closet", nameIncludes: "Desk" } },
  { id: "5-pantry", prompt: "hall pantry 24 wide by 84 tall by 14 deep, 5 shelves, 3/4 inch plywood", expect: { w: 24, h: 84, d: 14, nameIncludes: "Pantry" } },
  { id: "6-bench", prompt: "mudroom bench 48 wide by 18 deep by 18 high with 3 cubbies", expect: { w: 48, h: 18, d: 18, nameIncludes: "Bench" } },
  { id: "7-bookcase", prompt: "kids bookcase 30 wide by 11 deep by 48 high, 4 shelves", expect: { w: 30, h: 48, d: 11, nameIncludes: "Bookcase" } },
  { id: "8-media", prompt: "media console 60 wide by 16 deep by 24 high, two doors, open center", expect: { w: 60, h: 24, d: 16, nameIncludes: "Media" } },
  { id: "9-eiffel", prompt: "3 foot Eiffel Tower from popsicle sticks", expect: { kind: "eiffel" } },
  { id: "10-arch", prompt: "6 foot garden arch from 3/4 inch PVC pipe", expect: { kind: "arch" } },
];

function near(a: number, b: number, eps = 0.15) {
  return Math.abs(a - b) <= eps;
}

let failed = 0;
for (const b of BUILDS) {
  const project = generateFromPrompt(b.prompt);
  const plan = buildPlan(project);
  const unit = project.fitted?.unit;
  const errs: string[] = [];
  if (b.expect?.kind && project.kind !== b.expect.kind) errs.push(`kind ${project.kind} ≠ ${b.expect.kind}`);
  if (b.expect?.nameIncludes && !project.name.toLowerCase().includes(b.expect.nameIncludes.toLowerCase())) {
    errs.push(`name "${project.name}" missing "${b.expect.nameIncludes}"`);
  }
  if (unit && b.expect?.w != null && !near(unit.width, b.expect.w)) errs.push(`W ${unit.width} ≠ ${b.expect.w}`);
  if (unit && b.expect?.h != null && !near(unit.height, b.expect.h)) errs.push(`H ${unit.height} ≠ ${b.expect.h}`);
  if (unit && b.expect?.d != null && !near(unit.depth, b.expect.d)) errs.push(`D ${unit.depth} ≠ ${b.expect.d}`);
  if (unit && b.expect?.w != null && !near(project.overall.width, b.expect.w)) {
    errs.push(`overall.W ${project.overall.width} ≠ ${b.expect.w} (HUD lie)`);
  }
  if (plan.instructions.length < 4) errs.push(`only ${plan.instructions.length} steps`);
  const generic = plan.instructions.filter((s) => /assemble the carcase|square and label|cut the sheet/i.test(s.title));
  if (generic.length) errs.push(`generic titles: ${generic.map((s) => s.title).join(", ")}`);
  const cutNums = plan.instructions.some((s) => /\d+(?:\.\d+)?"/.test(s.description) || /\d+×/.test(s.description) || /\d+ ×/.test(s.description));
  if (!cutNums) errs.push("no dimensions in any step");
  if (!plan.cutList.length) errs.push("empty cut list");
  if (!plan.bom.length) errs.push("empty BOM");

  const flag = errs.length ? "FAIL" : "ok  ";
  if (errs.length) failed += 1;
  const pieces = project.panels.length || project.instances.length;
  console.log(
    `${flag} ${b.id.padEnd(12)} ${project.name.padEnd(28)} ${pieces.toString().padStart(4)} pcs  ${plan.instructions.length} steps  ~$${Math.round(plan.totals.estCostUsd)}  ${plan.feasibility.summary}`,
  );
  for (const e of errs) console.log(`     - ${e}`);
  if (!errs.length) {
    console.log(`     steps: ${plan.instructions.map((s) => s.title).join(" → ")}`);
  }
}

console.log(failed ? `\n${failed} failed` : "\n10/10 green");
process.exit(failed ? 1 : 0);
