/** Spec 007 L1 · live path: no prompt the engine can build reaches the learner (I23), and modifier-only hits still learn. */
import test from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain";
import { checkBuild } from "./invariants";
import { routesToLearner, typedHeadNoun } from "./formOwnership";

test("L1/I23: every engine-owned form or purpose stays on the engine (whole class)", () => {
  for (const q of new Set<string>([...SWEEPS.l1.prompts, ...SWEEPS.c1.prompts])) {
    const p = generateFromPrompt(q);
    assert.deepEqual(checkBuild(p, q).filter((x) => x.id === "I23").map((x) => x.msg), [], q);
    assert.equal(routesToLearner(q, p, ignoredTypedWords(p, q).length > 0), false, q);
  }
});

test("L1: a hit that only read a modifier, or a half-read prompt, still goes to the learner", () => {
  for (const q of ["wall clock", "lap desk", "cold frame", "chicken tractor", "spinning wheel", "flurbleglarp"]) {
    const p = generateFromPrompt(q);
    assert.equal(routesToLearner(q, p, ignoredTypedWords(p, q).length > 0), true, q);
  }
});

test("L1: typed head noun is the last content word", () => {
  assert.equal(typedHeadNoun("galleon 30 inches long"), "galleon");
  assert.equal(typedHeadNoun("wall clock"), "clock");
  assert.equal(typedHeadNoun("Golden Gate Bridge 36 inches long"), "bridge");
});
