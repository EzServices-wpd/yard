/**
 * Grader rerun for class F shelf sizes. Not a CI gate.
 *   npx tsx scripts/baselines/approvals/class-f-shelf/rerun.ts
 */
import { generateFromPrompt } from "../../../../src/lib/yard/promptMain";
import { buildPlan } from "../../../../src/lib/yard/report";

const PAIRS: [string, string][] = [
  ["media console 3 ft wide with 1 shelf", "media console 36 wide with 1 shelf"],
  ["nightstand 2 1/2 ft wide with 1 shelf", "nightstand 30 wide with 1 shelf"],
  ["coffee table 4 ft wide with an open shelf", "coffee table 48 wide with an open shelf"],
  ["desk 4 ft wide with an open shelf", "desk 48 wide with an open shelf"],
  ["tv console 3 ft wide with 1 shelf", "tv console 36 wide with 1 shelf"],
  ["nightstand thirty inches wide, with 1 shelf", "nightstand 30 wide, with 1 shelf"],
  ["coffee table 762 mm wide, with 1 shelf", "coffee table 30 wide, with 1 shelf"],
  ["nightstand four feet wide, with 1 shelf", "nightstand 48 wide, with 1 shelf"],
  ["bookcase six feet tall, with 1 shelf", "bookcase 72 tall, with 1 shelf"],
  ["bookcase 1829 mm tall, with an open shelf", "bookcase 72 tall, with an open shelf"],
  ["desk with 1 shelf, thirty inches wide", "desk with 1 shelf, 30 wide"],
  ["desk with an open shelf 4 ft wide", "desk with an open shelf 48 wide"],
  ["desk 4 ft wide, with an open shelf", "desk 48 wide, with an open shelf"],
  ["vanity with an open shelf 2 1/2 ft wide", "vanity with an open shelf 30 wide"],
  ["console table five feet wide, with an open shelf", "console table 60 wide, with an open shelf"],
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
      panels: p.panels.length,
      steps: pl.instructions.map((s) => s.title),
      cuts: pl.cutList.map((c) => [c.name, c.quantity, c.lengthIn, c.widthIn, c.thicknessIn]),
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
if (bad) {
  console.error(`${bad} pair(s) differ`);
  process.exit(1);
}
console.log(`${PAIRS.length} pairs match their digit twins`);
