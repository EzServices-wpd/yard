/**
 * A step's screw count is the joins that step closes. It is not a running total and not the whole build.
 * The sentences are the ones the per-step pass already writes.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { stepScrewCount } from "./stepJointScrews.ts";
import { screwsClosedByStep } from "./fastenedAt.ts";

const CASES = [
  "dresser 54.375 wide 36 tall 18.75 deep",
  "dresser 54.375x36x18.75",
  "hall tree",
  "rolling bar cart",
  "plywood toolbox 20x10x8",
  "bookcase 36 wide 72 tall 12 deep",
  "nightstand",
  "chest of drawers",
  "wardrobe",
  "workbench",
  "kitchen cart",
  "toy box",
  "media console",
  "cabinet 24 wide 30 tall 12 deep",
  "toolbox 20 wide 10 tall 8 deep",
  "entry bench",
  "pantry cabinet",
  "shoe bench",
];

function buyScrews(plan: ReturnType<typeof buildPlan>): number {
  const line = plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""));
  return Number(line?.notes?.match(/(\d+) screws from the model's joints/)?.[1] ?? NaN);
}

function stated(desc: string): number {
  if (/counted in another step/.test(desc)) return 0;
  const drive = desc.match(/(?:In all, this step drives|Drive) (\d+) × #8 /);
  if (drive) return Number(drive[1]);
  let n = 0;
  for (const m of desc.matchAll(/with (\d+) × #8 /g)) n += Number(m[1]);
  return n;
}

describe("each step counts only the joins it closes", () => {
  for (const prompt of CASES) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      const buy = buyScrews(plan);
      const text = plan.instructions.map((s) => s.description ?? "").join("\n");
      assert.doesNotMatch(text, /counted in another step/, prompt);
      if (!Number.isFinite(buy) || buy <= 0) return;
      assert.equal(stepScrewCount(plan), buy, prompt);
      const closed = screwsClosedByStep(project, plan);
      let run = 0;
      plan.instructions.forEach((s, i) => {
        const desc = s.description ?? "";
        const n = stated(desc);
        run += n;
        const drive = desc.match(/(?:In all, this step drives|Drive) (\d+) × #8 /);
        const withN = [...desc.matchAll(/with (\d+) × #8 /g)].reduce((a, m) => a + Number(m[1]), 0);
        if (drive) {
          const said = Number(drive[1]);
          if (withN > 0) assert.ok(said >= withN, `${prompt} step ${s.step} drives ${said} below its with-count ${withN}`);
          if (said === buy && run !== buy) assert.fail(`${prompt} step ${s.title} states the whole-build total ${said}`);
        }
        if (closed && closed.some((c) => c > 0) && closed[i] !== n) {
          assert.equal(n, closed[i], `${prompt} step ${i + 1} ${s.title} says ${n}, closes ${closed[i]}`);
        }
      });
      assert.equal(run, buy, prompt);
      if (project.panels.length === 0) {
        const note = plan.bom.find((b) => /screws from the model's joints: /.test(b.notes ?? ""))?.notes ?? "";
        if (note) assert.equal(plan.instructions.filter((s) => (s.description ?? "").includes(note)).length, 0, `${prompt} still pastes the whole Buy note into a step`);
      }
    });
  }
});
