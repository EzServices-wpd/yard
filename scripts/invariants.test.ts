import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { headerTitle } from "../src/lib/yard/pdf.ts";
import { buildPlan } from "../src/lib/yard/report.ts";
import { violations, evalScore } from "./eval-lib.ts";
import { corpus, EVAL_PROMPTS, seededSizes } from "./invariants-corpus.ts";

// Critic's invariants I1–I14 (critic-kb/invariants.md) over every built-in idea, learned recipe, eval prompt and
// seeded random sizes. I5 (true shapes, paint depth) runs in step-depth / step-dense / strut tests.
const base: Record<string, { class: string; msg: string }> = JSON.parse(readFileSync(new URL("../evals/invariants-baseline.json", import.meta.url), "utf8")).known;

test("seeded sizes are the same on every run", () => assert.deepEqual(seededSizes(), seededSizes()));

test("invariant ratchet: no new violation, no stale baseline entry", () => {
  const now = violations(corpus());
  const fresh = [...now.keys()].filter((k) => !(k in base)).map((k) => `NEW ${k}: ${now.get(k)}`);
  const stale = Object.keys(base).filter((k) => !now.has(k)).map((k) => `STALE ${k} (fixed: delete it from evals/invariants-baseline.json to close ${base[k].class})`);
  assert.deepEqual([...fresh, ...stale], []);
});

test("I2 linen canary: header, size, 11 pieces, price = Buy", () => {
  const p = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  assert.equal(headerTitle(p), 'Linen · 31 1/2" W × 16" D × 78" H');
  assert.deepEqual([p.overall.width, p.overall.height], [31.5, 78]);
  const plan = buildPlan(p);
  assert.equal(plan.totals.pieces, 11);
  const buy = Math.round(plan.bom.reduce((t, b) => t + (b.estimatedCost ?? 0), 0) * 100) / 100;
  assert.ok(Math.abs(buy - plan.totals.estCostUsd) < 0.02);
});

test("I10 input caps: 9999 wide and a 3,000-character prompt build fast and say so", () => {
  for (const q of ["bookshelf 9999 wide", `bookshelf ${"very ".repeat(600)}tall`]) {
    const t = Date.now();
    const p = generateFromPrompt(q);
    assert.ok(Date.now() - t < 10000, `${q.slice(0, 30)} took ${Date.now() - t} ms`);
    assert.ok(p.overall.width <= 1200);
  }
});

test("eval score never drops below evals/score.json", () => {
  const tracked = JSON.parse(readFileSync(new URL("../evals/score.json", import.meta.url), "utf8"));
  const now = evalScore(EVAL_PROMPTS);
  assert.equal(now.max, tracked.max, "eval set changed: re-record with scripts/eval-score.ts --write");
  assert.ok(now.score >= tracked.score, `eval score ${now.score} < tracked ${tracked.score}: ${now.failing.filter((k) => !tracked.failing.includes(k)).join("; ")}`);
});
