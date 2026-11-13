/**
 * Floor glides belong only on floor-standing indoor furniture that rests on a finished floor.
 * Hung, mounted, posted and outdoor builds never get them. The class fails on release
 * (a birdhouse, a mounted house, a house on a pole, a planter on a post, a picnic table all buy glides).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { hungBuild, takesGlides } from "./outdoor";

const planOf = (q: string) => {
  const p = generateFromPrompt(q);
  const plan = buildPlan(p);
  const text = [...(p.notes ?? []), ...plan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`), ...plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`)].join("\n");
  return { p, plan, text };
};

const CLASSES: { cls: string; prompts: string[] }[] = [
  { cls: "hung", prompts: ["hanging birdhouse", "hanging bird feeder", "outdoor hanging shelf", "hanging planter", "birdhouse hanging from a chain"] },
  { cls: "mounted", prompts: ["wall mounted birdhouse", "mounted birdhouse", "post-mounted birdhouse", "wall mounted outdoor planter", "fence mounted birdhouse"] },
  { cls: "posted", prompts: ["birdhouse on a post", "birdhouse on a pole", "planter on a post", "outdoor planter on a post", "planter on posts"] },
  { cls: "outdoor", prompts: ["birdhouse", "wren house", "martin house", "bat house", "bird feeder", "barn birdhouse", "adirondack chair", "outdoor bench", "picnic table", "pine porch bench", "deck box", "garden bench"] },
];

test("floor glides: hung, mounted, posted and outdoor builds never buy or name them", () => {
  for (const { cls, prompts } of CLASSES) {
    for (const q of prompts) {
      const { p, plan, text } = planOf(q);
      if (cls === "hung") assert.ok(hungBuild(p), q);
      assert.equal(takesGlides(p), false, `${cls}: ${q}`);
      assert.equal(plan.bom.some((b) => /\bglides?\b/i.test(b.name)), false, q);
      assert.doesNotMatch(text, /\bglides?\b/i, q);
    }
  }
});

test("floor glides: indoor floor furniture keeps its felt pads and does not gain an outdoor glide line", () => {
  for (const q of ["coffee table", "oak coffee table", "end table", "round coffee table"]) {
    const { text, plan } = planOf(q);
    assert.match(text, /felt pad under each foot/i, q);
    assert.equal(plan.bom.some((b) => /outdoor furniture glides/i.test(b.name)), false, q);
  }
  for (const q of ["bookcase 36 wide 72 tall 12 deep", "dresser", "nightstand", "desk 60 wide 30 deep 29 tall", "linen closet 31.5 wide 78 tall 16 deep"]) {
    const { p, plan, text } = planOf(q);
    assert.equal(takesGlides(p), true, q);
    assert.equal(plan.bom.some((b) => /\bglides?\b/i.test(b.name)), false, q);
    assert.doesNotMatch(text, /\bglides?\b/i, q);
  }
  const linen = planOf("linen closet 31.5 wide 78 tall 16 deep");
  assert.equal(linen.plan.totals.estCostUsd.toFixed(2), "193.68");
  assert.equal(linen.plan.totals.pieces, 11);
  assert.equal(linen.plan.bom.length, 8);
  assert.equal(linen.plan.instructions.length, 9);
});
