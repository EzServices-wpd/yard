/**
 * A seated pipe frame rests on y = 0 on the outside of its lowest pipe.
 * Buy, cut lists, and steps stay the release text; only the placement moves.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { drawnExtent } from "./pdfDraw.ts";
import { isSeatedPipeFrame } from "./pipeRackFrame.ts";

type Row = { prompt: string; material?: string };
type Baseline = {
  rows: { prompt: string; material: string | null; buy: string; cuts: string; steps: string }[];
};

const prompts = JSON.parse(readFileSync(new URL("../../../evals/pvcRackMovers.prompts.json", import.meta.url), "utf8")) as {
  prompts: Row[];
};
const baseline = JSON.parse(readFileSync(new URL("../../../plan-baselines/pvcRackPlan.baseline.json", import.meta.url), "utf8")) as Baseline;

function planText(project: ReturnType<typeof generateFromPrompt>) {
  const plan = buildPlan(project);
  return {
    buy: plan.bom.map((b) => `${b.quantity}×${b.name}=${Math.round((b.estimatedCost ?? 0) * 100) / 100}`).join("; "),
    cuts: plan.cutList.map((c) => `${c.quantity}|${c.lengthIn}|${c.widthIn}|${c.thicknessIn}|${c.name}|${c.notes ?? ""}|${c.material}`).join(";"),
    steps: plan.instructions.map((s) => `${s.title}||${s.description ?? ""}||${s.tips ?? ""}`).join("\n"),
  };
}

test("every seated pipe frame rests on y = 0, and Buy, cuts, and steps match the release", { timeout: 300_000 }, () => {
  assert.equal(baseline.rows.length, prompts.prompts.length);
  let seated = 0;
  for (let i = 0; i < prompts.prompts.length; i++) {
    const row = prompts.prompts[i];
    const prior = baseline.rows[i];
    assert.equal(prior.prompt, row.prompt);
    assert.equal(prior.material, row.material ?? null);
    const project = row.material ? generateFromPrompt(row.prompt, row.material) : generateFromPrompt(row.prompt);
    const got = planText(project);
    assert.equal(got.buy, prior.buy, row.prompt);
    assert.equal(got.cuts, prior.cuts, row.prompt);
    assert.equal(got.steps, prior.steps, row.prompt);
    if (!isSeatedPipeFrame(project)) continue;
    seated++;
    const ext = drawnExtent(project);
    assert.ok(ext, row.prompt);
    assert.ok(Math.abs(ext.min.y) <= 0.01, `${row.prompt} outer min ${ext!.min.y}`);
  }
  assert.ok(seated >= 40, `only ${seated} seated frames`);
});
