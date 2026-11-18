import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain";
import { i46Ties } from "./invariants";
import { buildPlan } from "./report";
import { mustNotBeCraft } from "./jobFurniture";

const craft = (prompt: string) => buildPlan(generateFromPrompt(prompt)).bom.some((b) => /popsicle|craft stick|toothpick/i.test(b.name));

const REAL = [
  "small step for a toddler", "toddler learning tower", "kid's climbing triangle", "step ladder 3 steps", "cornhole boards set",
  "mailbox post", "a thing to raise my laptop", "guitar stand floor", "bedroom armoire 40 wide with doors", "sandbox with a lid",
  "cold frame", "chicken tractor", "garden arbor", "garden bridge 6 ft", "cat climbing post", "something to store my bikes",
];
const MODELS = ["Space Needle model", "pirate ship", "toy airplane", "catapult", "Golden Gate Bridge 36 inches long", "galleon 30 inches long", "eiffel tower", "3 foot Eiffel Tower from popsicle sticks", "popsicle stick bridge"];

test("load-bearing, outdoor, child or person-sized builds never come out in craft sticks", () => {
  for (const p of REAL) assert.equal(craft(p), false, p);
});

test("models and typed craft stock still build in craft sticks", () => {
  for (const p of MODELS) assert.equal(craft(p), true, p);
});

test("the rule: model words and typed craft win; use, place, child and person size make it real", () => {
  assert.equal(mustNotBeCraft("model step ladder"), false);
  assert.equal(mustNotBeCraft("step ladder from popsicle sticks"), false);
  assert.equal(mustNotBeCraft("backyard windmill"), true);
  assert.equal(mustNotBeCraft("windmill"), false);
  assert.equal(mustNotBeCraft("box 30 inches wide"), true);
  assert.equal(mustNotBeCraft("3 steps"), true);
  assert.equal(mustNotBeCraft("coaster set"), false);
});

test("a lifted build reads no word the craft build did not, and its fasteners are carried by id", () => {
  // The lift changes the stock, never which typed words the engine read (the learner still gets the half-read ask).
  const q = "armoire with doors 36 wide 24 deep 72 tall";
  assert.deepEqual(ignoredTypedWords(generateFromPrompt(q), q), ["armoire"]);
  for (const prompt of ["cold frame", "chicken tractor", "kids play kitchen", "mailbox post"]) {
    const p = generateFromPrompt(prompt);
    assert.ok(p.craftLifted, prompt);
    assert.deepEqual(i46Ties(buildPlan(p)).generalWordTied, [], prompt);
  }
});
