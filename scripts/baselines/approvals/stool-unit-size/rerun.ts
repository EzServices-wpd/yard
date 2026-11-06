/**
 * Grader rerun for a stool (and the chair on the same reader) keeping a unit-marked size. Not a CI gate.
 *   npx tsx scripts/baselines/approvals/stool-unit-size/rerun.ts
 */
import { generateFromPrompt } from "../../../../src/lib/yard/promptMain";
import { buildPlan } from "../../../../src/lib/yard/report";

const PAIRS: [string, string][] = [
  ['stool 24" wide with two drawers', "stool 24 wide with two drawers"],
  ["stool 24 inches wide with two drawers", "stool 24 wide with two drawers"],
  ["stool 24 inch wide with two drawers", "stool 24 wide with two drawers"],
  ["stool 24 in wide with two drawers", "stool 24 wide with two drawers"],
  ['stool 18" deep with three shelves', "stool 18 deep with three shelves"],
  ["stool 18 inches deep with three shelves", "stool 18 deep with three shelves"],
  ['stool 24" wide', "stool 24 wide"],
  ["stool 24 inches wide", "stool 24 wide"],
  ['stool 18" deep', "stool 18 deep"],
  ['stool 24" wide 18" deep with two drawers', "stool 24 wide 18 deep with two drawers"],
  ['stool with two drawers 24" wide', "stool with two drawers 24 wide"],
  ['a 24" wide stool with two drawers', "a 24 wide stool with two drawers"],
  ['stool 24 1/2" wide with two drawers', "stool 24 1/2 wide with two drawers"],
  ["stool twenty-four inches wide with two drawers", "stool 24 wide with two drawers"],
  ["stool 2 feet wide with two drawers", "stool 24 wide with two drawers"],
  ["stool 2 ft wide with two drawers", "stool 24 wide with two drawers"],
  ['chair 20" wide with a drawer', "chair 20 wide with a drawer"],
  ['kitchen chair from 1x4 22" wide', "kitchen chair from 1x4 22 wide"],
  ["chair 22 inches deep with a shelf", "chair 22 deep with a shelf"],
  ['bar stool 20" wide with two drawers', "bar stool 20 wide with two drawers"],
  ['counter stool 18" deep with three shelves', "counter stool 18 deep with three shelves"],
  ["stool with 4 feet", "stool"],
  ["stool with four feet", "stool"],
  ['stool 30" tall with two drawers', "stool 30 tall with two drawers"],
  ["stool 2 feet tall", "stool 24 tall"],
  ['bench 48" wide with two drawers', "bench 48 wide with two drawers"],
  ['desk 60" wide', "desk 60 wide"],
  ["desk 2 feet wide", "desk 24 wide"],
];

const SIZES: [string, number, number, number][] = [
  ['stool 24" wide with two drawers', 24, 16, 18],
  ['stool 18" deep with three shelves', 18, 18, 18],
  ["stool, 24\" wide with two drawers", 18, 16, 18],
  ["stool 24-inch wide with two drawers", 18, 16, 18],
  ["stool wide 24", 18, 16, 18],
  ["step stool 24 inches", 16, 33, 24],
  ["step stool 16 wide", 16, 22, 18],
  ['step stool 24" wide', 24, 22, 18],
  ["6 foot shelf", 36, 12, 72],
  ["coffee table with 4 feet", 40, 40, 18],
];

function grade(q: string) {
  const p = generateFromPrompt(q);
  const pl = buildPlan(p);
  return {
    line: `${p.name} ${p.overall.width}x${p.overall.depth}x${p.overall.height}`,
    key: JSON.stringify({
      name: p.name,
      o: [p.overall.width, p.overall.depth, p.overall.height],
      steps: pl.instructions.map((s) => s.title),
      bom: pl.bom.map((b) => [b.name, b.quantity]),
    }),
  };
}

let bad = 0;
for (const [q, twin] of PAIRS) {
  const a = grade(q);
  const b = grade(twin);
  const ok = a.key === b.key;
  if (!ok) bad++;
  console.log(`${ok ? "MATCH" : "DIFF "} ${a.line}  << ${q}`);
  if (!ok) console.log(`       ${b.line}  << ${twin}`);
}
for (const [q, w, d, h] of SIZES) {
  const p = generateFromPrompt(q);
  const ok = p.overall.width === w && p.overall.depth === d && p.overall.height === h;
  if (!ok) bad++;
  console.log(`${ok ? "SIZE " : "DIFF "} ${q} ${p.overall.width}x${p.overall.depth}x${p.overall.height} (want ${w}x${d}x${h})`);
}
if (bad) {
  console.error(`${bad} check(s) failed`);
  process.exit(1);
}
console.log(`${PAIRS.length} pairs match; ${SIZES.length} sizes held`);
