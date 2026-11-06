/**
 * Grader rerun for digit counts of feet. Not a CI gate.
 *   npx tsx scripts/baselines/approvals/digit-feet/rerun.ts
 */
import { generateFromPrompt } from "../../../../src/lib/yard/promptMain";
import { buildPlan } from "../../../../src/lib/yard/report";

const PAIRS: [string, string][] = [
  ["coffee table with 4 feet", "coffee table with four feet"],
  ["side table with 3 feet", "side table with three feet"],
  ["table with 4 foot legs", "table with four foot legs"],
  ["bookcase with 2 foot shelves", "bookcase with two foot shelves"],
  ["bookcase with 5 one foot shelves", "bookcase with five one foot shelves"],
  ["bookcase 2 foot shelves", "bookcase two foot shelves"],
  ["table 4 foot legs", "table four foot legs"],
  ["coffee table with 4'", "coffee table with four feet"],
  ["coffee table with 4 ft", "coffee table with four ft"],
  ["desk 2 feet wide", "desk two feet wide"],
  ["bookcase 4 feet tall", "bookcase four feet tall"],
  ["table 6 feet long", "table six feet long"],
  ["coffee table 4 feet wide with an open shelf", "coffee table 48 wide with an open shelf"],
  ["nightstand 4 feet wide, with 1 shelf", "nightstand 48 wide, with 1 shelf"],
  ["desk 4 ft wide with an open shelf", "desk 48 wide with an open shelf"],
  ["bookcase from 2 1/2 ft boards", "bookcase from two and a half ft boards"],
];

const SIZES: [string, number, "width" | "height"][] = [
  ["desk 2 feet wide", 24, "width"],
  ["bookcase 4 feet tall", 48, "height"],
  ["table 6 feet long", 72, "width"],
  ["workbench 6 feet", 72, "width"],
  ["table 4 feet", 48, "width"],
  ["6 foot shelf", 72, "height"],
  ["2 foot shelf", 24, "height"],
  ["4 foot bookcase", 48, "height"],
  ["6 foot ladder from 2x4", 72, "height"],
];

function sig(q: string) {
  const p = generateFromPrompt(q);
  const pl = buildPlan(p);
  const usd = p.refused ? 0 : pl.totals.estCostUsd;
  return {
    line: `${p.name} ${p.overall.width}x${p.overall.depth}x${p.overall.height} ${(p.notes ?? []).some((n) => n.startsWith("Combined:")) ? "Combined" : "one"} $${usd}`,
    key: JSON.stringify({
      name: p.name,
      o: [p.overall.width, p.overall.depth, p.overall.height],
      combined: (p.notes ?? []).some((n) => n.startsWith("Combined:")),
      steps: pl.instructions.map((s) => s.title),
      bom: pl.bom.map((b) => [b.name, b.quantity]),
    }),
  };
}

let bad = 0;
for (const [q, twin] of PAIRS) {
  const a = sig(q);
  const b = sig(twin);
  const ok = a.key === b.key;
  if (!ok) bad++;
  console.log(`${ok ? "MATCH" : "DIFF "} ${a.line}  << ${q}`);
  if (!ok) console.log(`       ${b.line}  << ${twin}`);
}
for (const [q, inches, axis] of SIZES) {
  const p = generateFromPrompt(q);
  const got = axis === "width" ? p.overall.width : p.overall.height;
  const ok = got === inches;
  if (!ok) bad++;
  console.log(`${ok ? "SIZE " : "DIFF "} ${q} ${axis} ${got} (want ${inches})`);
}
if (bad) {
  console.error(`${bad} check(s) failed`);
  process.exit(1);
}
console.log(`${PAIRS.length} pairs match their spelled twins; ${SIZES.length} axis and storage sizes held`);
