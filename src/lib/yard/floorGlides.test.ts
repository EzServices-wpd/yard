/**
 * Floor glides stay on furniture that stands on a finished floor, a deck, or a patio.
 * Hung, mounted, posted, and in-ground builds never get them, and neither does an object
 * with no furniture feet (a house, feeder, hive, sandbox, planter, bed, arch, goal, wheel, or swing).
 * On release, a plain birdhouse, a mounted one, and one on a pole still buy glides.
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
  { cls: "no-feet", prompts: ["birdhouse", "wren house", "martin house", "bat house", "bird feeder", "barn birdhouse", "birdhouse cedar", "beehive box", "sandbox", "garden planter box", "garden bed", "garden arch", "arbor", "obelisk", "soccer goal", "water wheel", "porch swing"] },
];

const DECK = ["adirondack chair", "adirondack footrest", "outdoor bench", "picnic table", "pine porch bench", "deck box", "garden bench", "teak outdoor side table", "lemonade stand", "firewood rack outdoor", "outdoor cabinet", "outdoor toy box", "outdoor plant stand", "farm stand"];

test("floor glides: hung, mounted, posted, and no-feet builds never buy or name them", () => {
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

test("floor glides: deck and patio furniture that stands on its feet keeps them", () => {
  for (const q of DECK) {
    const { p, plan, text } = planOf(q);
    assert.equal(takesGlides(p), true, q);
    assert.ok(plan.bom.some((b) => /outdoor furniture glides/i.test(b.name)), q);
    assert.match(text, /\bglides?\b/i, q);
  }
});

test("floor glides: an outdoor table names a glide only when Buy has one, and the tip has no trailing space", () => {
  for (const q of ["teak outdoor side table", "outdoor coffee table", "patio side table", "outdoor plant stand"]) {
    const { plan } = planOf(q);
    const level = plan.instructions.find((s) => s.title === "Level it");
    assert.ok(level, q);
    const tips = level.tips ?? "";
    assert.equal(tips, tips.trimEnd(), q);
    assert.match(tips, /A glide under each foot keeps the end grain off wet ground\.$/);
    assert.equal(plan.bom.some((b) => /outdoor furniture glides/i.test(b.name)), true, q);
    assert.doesNotMatch(tips, /felt pad/i);
  }
  // A hung, mounted, or posted table still starts from the felt-pad sentence. It comes off.
  // It is not rewritten into a glide sentence when Buy has no glides.
  for (const q of ["wall mounted outdoor coffee table", "hanging patio table", "outdoor side table on a post"]) {
    const { p, plan } = planOf(q);
    const level = plan.instructions.find((s) => s.title === "Level it");
    assert.ok(level, q);
    const tips = level.tips ?? "";
    assert.equal(takesGlides(p), false, q);
    assert.equal(plan.bom.some((b) => /outdoor furniture glides/i.test(b.name)), false, q);
    assert.equal(tips, "Guidance only — not stamped engineering.");
    assert.doesNotMatch(`${level.title} ${level.description} ${tips}`, /glide|felt pad/i);
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
