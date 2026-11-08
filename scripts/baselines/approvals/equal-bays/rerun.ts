/**
 * Grader rerun for equal clear bays. Not a CI gate.
 *   npx tsx scripts/baselines/approvals/equal-bays/rerun.ts
 *
 * A shelf run the span pass divides into 3 or more clear bays has equal openings
 * (within 1/64") and those bays plus the dividers between them fill the run between the sides.
 */
import { generateFromPrompt } from "../../../../src/lib/yard/promptMain";
import { inchFrac } from "../../../../src/lib/yard/inchText";
import { equalBayProblems, equalBayRuns } from "../../../../src/lib/yard/equalBayRuns";

const PROMPTS = [
  "closet 72 wide",
  "cabinet 42 wide 30 tall 15 deep with 3 doors in 1/2 inch plywood",
  ...[42, 48, 60, 64, 72, 90, 96, 120].map((w) => `closet ${w} wide`),
  ...[60, 72, 84, 96].map((w) => `bookcase ${w} wide 72 tall 12 deep`),
  ...[48, 60, 72].map((w) => `bookcase ${w} wide 48 tall 12 deep in 1/2 inch plywood`),
  "closet 72 wide 96 tall 24 deep",
  "office bookcase with doors 42 wide",
  "wardrobe 96 wide",
  "bookcase 96 wide from MDF",
  "bookshelf from 1x10",
];

let bad = 0;
let runs = 0;
for (const q of PROMPTS) {
  const project = generateFromPrompt(q);
  const problems = equalBayProblems(project.panels);
  const shown = equalBayRuns(project.panels, 3).map((run) => run.shelves.map((s) => inchFrac(s.size.width)).join(" | "));
  if (problems.length) bad++;
  else runs += shown.length;
  console.log(`${problems.length ? "DIFF " : "EQUAL"} ${q}${shown.length ? `  [${shown.join(" ; ")}]` : ""}`);
  for (const problem of problems) console.log(`       ${problem}`);
}
if (bad) {
  console.error(`${bad} prompt(s) failed`);
  process.exit(1);
}
console.log(`${PROMPTS.length} prompts; ${runs} auto-divided runs of 3+ bays are equal and fill the run`);
