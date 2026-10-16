/** C15 · C16 · C17 (whole class): Buy completeness, material for use, step and placement text, over every sweep prompt. */
import test from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";

const corpus = [...new Set<string>(Object.values(SWEEPS).flatMap((s) => s.prompts))];
const plan = (q: string) => { const p = generateFromPrompt(q); return { p, plan: buildPlan(p) }; };

for (const id of ["C15", "C16", "C17"] as const) {
  test(`${id}: no sweep build violates it (whole class)`, () => {
    for (const q of corpus) { const { p, plan: pl } = plan(q); assert.deepEqual(checkBuild(p, q, pl).filter((x) => x.id === id).map((x) => x.msg), [], q); }
  });
}

test("C15: every Buy row on every sweep build has a store link", () => {
  for (const q of corpus) for (const b of plan(q).plan.bom) assert.ok((b.offers ?? []).some((o) => o.href), `${q}: ${b.name}`);
});

test("C15: the feeder buys its acrylic; casters bring their #10 screws; hung builds buy screw eyes and chain, all checked listings", () => {
  const f = plan("bird feeder").plan.bom;
  assert.ok(f.some((b) => /acrylic/i.test(b.name) && b.estimatedCost! > 0));
  for (const re of [/screw eyes/i, /chain/i]) { const r = f.find((b) => re.test(b.name))!; assert.ok(r.offers![0].href.includes("homedepot.com/p/"), r.name); }
  const c = plan("rolling utility cart").plan.bom;
  assert.ok(c.some((b) => /^#10 × 3\/4" pan-head screws$/.test(b.name)));
  assert.equal(c.find((b) => /casters/i.test(b.name))!.estimatedCost, 30.28);
});

test("C15: a raised bed's courses are the 2×6 its note names, whatever size or post words are typed", () => {
  for (const q of ["raised garden bed", "raised garden bed with 4x4 posts", "raised garden bed 4x8 open bottom with 4x4 posts", "cedar raised garden bed 4x8"]) {
    assert.ok(plan(q).plan.bom.some((b) => /2×6/.test(b.name)), q);
    assert.ok(!plan(q).plan.bom.some((b) => /2×8/.test(b.name)), q);
  }
});

test("C16: feeders, birdhouses, hives and sandboxes are cedar, never pressure-treated; outdoor planters are exterior plywood", () => {
  for (const q of ["bird feeder", "hanging birdhouse", "beehive box", "sandbox with seat"]) {
    const bom = plan(q).plan.bom;
    assert.ok(!bom.some((b) => /pressure/i.test(b.name)), q);
  }
  assert.ok(plan("bird feeder").plan.bom.some((b) => b.name === "1×6 cedar (8 ft)"));
  assert.ok(plan("porch planter 16x16x30").plan.bom.some((b) => /BC exterior plywood/.test(b.name)));
});

test("C17: the jewelry box hangs its lid once; small builds are checked flat or hanging, never on the floor", () => {
  const j = plan("jewelry box").plan.instructions;
  assert.equal(j.filter((s) => /hinge/i.test(s.title)).length, 1);
  assert.ok(!j.some((s) => /floor/i.test(s.description)));
  assert.ok(plan("bird feeder").plan.instructions.some((s) => /^Hang it and check/.test(s.title)));
  assert.ok(plan("treasure chest").plan.instructions.some((s) => s.title === "Mount the 1 latch"));
});
