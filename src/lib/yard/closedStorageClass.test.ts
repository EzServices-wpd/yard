import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { checkBuild } from "./invariants.ts";
import { routesToLearner, engineKeepsPrompt } from "./formOwnership.ts";
import { closedCarcaseReadsAsk, doorOverDrawer, modelInteriorCounts, typedInteriorCounts } from "./closedStorage.ts";
import { genericBoxOverAsk } from "./genericBox.ts";

/**
 * Class rule (refiner :20, 10-17): a closed storage ask with a typed size and interior counts is the engine's own
 * sheet carcase, at the typed size with the typed counts, and never the learner placeholder. Every prompt in CLASS
 * either went to the learner on release a690e3a (a use word ahead of the carcase noun read as an ignored word, and the
 * size and count words read as missing from the title) or already built; each must build now.
 */
const CLASS: [string, { width: number; height: number; depth: number }][] = [
  ["utility cabinet 30 wide 72 tall 16 deep with 4 shelves and 2 doors", { width: 30, height: 72, depth: 16 }],
  ["tool cabinet 24 wide 36 tall 12 deep with 2 doors and 3 shelves", { width: 24, height: 36, depth: 12 }],
  ["craft cabinet 30 wide 60 tall 16 deep with 3 shelves and 2 doors", { width: 30, height: 60, depth: 16 }],
  ["supply cabinet 30 wide 66 tall 15 deep with 4 shelves and 2 doors", { width: 30, height: 66, depth: 15 }],
  ["shoe cabinet 32 wide 40 tall 14 deep with 3 shelves and 2 doors", { width: 32, height: 40, depth: 14 }],
  ["paint cabinet 30 wide 48 tall 12 deep with 3 shelves and 2 doors", { width: 30, height: 48, depth: 12 }],
  ["wine cabinet 24 wide 36 tall 16 deep with 2 shelves and 2 doors", { width: 24, height: 36, depth: 16 }],
  ["plywood utility cabinet 30 wide 72 tall 16 deep with 4 shelves and 2 doors", { width: 30, height: 72, depth: 16 }],
  ["garage cabinet 36 wide 72 tall 18 deep with 3 shelves and 2 doors", { width: 36, height: 72, depth: 18 }],
  ["pantry cabinet 24 wide 84 tall 16 deep with 5 shelves and 2 doors", { width: 24, height: 84, depth: 16 }],
  ["storage cabinet 30 wide 72 tall 16 deep with 4 shelves and 2 doors", { width: 30, height: 72, depth: 16 }],
  ["broom cabinet 18 wide 80 tall 14 deep with 1 door and 2 shelves", { width: 18, height: 80, depth: 14 }],
  ["office cabinet 30 wide 42 tall 16 deep with 2 shelves and 2 doors", { width: 30, height: 42, depth: 16 }],
  ["wardrobe 40 wide 72 tall 22 deep with 2 doors and 1 shelf", { width: 40, height: 72, depth: 22 }],
];

const learner = (q: string) => {
  const p = generateFromPrompt(q);
  const half = ignoredTypedWords(p, q).length > 0;
  return { p, learn: !engineKeepsPrompt(q, p, half) && routesToLearner(q, p, half) };
};

describe("a closed storage ask is the engine's own sheet carcase at the typed size and counts", () => {
  for (const [q, size] of CLASS) {
    it(q, () => {
      const { p, learn } = learner(q);
      assert.equal(learn, false, `${q}: sent to the learner`);
      assert.ok(!p.displayOnly && p.panels.length > 5, `${q}: placeholder`);
      for (const a of ["width", "height", "depth"] as const) assert.ok(Math.abs(p.overall[a] - size[a]) <= 0.5, `${q}: ${a} ${p.overall[a]}`);
      const have = modelInteriorCounts(p);
      for (const [f, n] of Object.entries(typedInteriorCounts(q))) assert.equal(have[f as keyof typeof have], n, `${q}: ${f}`);
      assert.deepEqual(checkBuild(p, q).filter((v) => v.id === "I23" || v.id === "I21"), []);
      // One model drives the plan: every door and shelf is a cut-list row and a step names it.
      const plan = buildPlan(p);
      const cut = plan.cutList.reduce((s, c) => s + (/\bdoor\b/i.test(c.name) ? c.quantity : 0), 0);
      assert.equal(cut, have.door, `${q}: cut list doors`);
      assert.ok(plan.bom.length > 0 && plan.instructions.some((s) => /\bdoor/i.test(`${s.title} ${s.description}`)), `${q}: no door step`);
    });
  }
});

describe("the rule keeps the class boundaries", () => {
  it("casters survive on a rolling closed carcase", () => {
    for (const q of ["rolling utility cabinet 30 wide 36 tall 16 deep with 2 shelves and 2 doors", "utility cabinet 30 wide 36 tall 16 deep with 2 shelves and 2 doors on casters"]) {
      const { p, learn } = learner(q);
      assert.equal(learn, false, q);
      assert.equal(p.panels.filter((x) => /^Caster \d+$/.test(x.name)).length, 4, q);
    }
  });
  it("a door over drawer fronts is not an honest build of the ask, so the rule does not keep it", () => {
    const q = "tool cabinet 24 wide 36 tall 12 deep with 2 doors and 3 drawers";
    const p = generateFromPrompt(q);
    assert.equal(doorOverDrawer(p), true);
    assert.equal(closedCarcaseReadsAsk(q, p, () => ignoredTypedWords(p, q)), false);
  });
  it("a missed typed count is not kept", () => {
    const q = "cleaning cabinet 24 wide 72 tall 16 deep with 4 shelves and 1 door";
    const p = generateFromPrompt(q);
    assert.equal(closedCarcaseReadsAsk(q, p, () => ignoredTypedWords(p, q)), false);
  });
  it("a named non-storage object titled as another form is not kept", () => {
    const q = "guitar case 40 wide 48 tall 14 deep with 2 shelves";
    const p = generateFromPrompt(q);
    assert.equal(closedCarcaseReadsAsk(q, p, () => ignoredTypedWords(p, q)), false);
  });
  it("the generic fallback box keeps its own rule (no interior, no counts)", () => {
    for (const q of ["cedar boot tray", "rolling under-stairs storage", "outdoor wall planter box"]) {
      const p = generateFromPrompt(q);
      assert.equal(closedCarcaseReadsAsk(q, p), false, q);
      const half = ignoredTypedWords(p, q).length > 0;
      if (genericBoxOverAsk(q, p)) assert.equal(routesToLearner(q, p, half), true, q);
    }
  });
});
