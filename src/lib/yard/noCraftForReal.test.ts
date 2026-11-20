import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain";
import { i46Ties } from "./invariants";
import { buildPlan } from "./report";
import { mustNotBeCraft } from "./jobFurniture";

const craft = (prompt: string) => buildPlan(generateFromPrompt(prompt)).bom.some((b) => /popsicle|craft stick|toothpick/i.test(b.name));

/** A lift that lands on a stand-in keeps release's craft build. A 20 by 16 picture frame is a lift that comes out a real build. */
const STAND_IN = [
  "small step for a toddler", "toddler learning tower", "kid's climbing triangle", "step ladder 3 steps", "cornhole boards set",
  "mailbox post", "a thing to raise my laptop", "guitar stand floor", "bedroom armoire 40 wide with doors", "sandbox with a lid",
  "cold frame", "garden arbor", "garden bridge 6 ft", "cat climbing post", "something to store my bikes",
  // Scale-model builders (vehicle, castle) are never re-stocked: a toy in boards is not the real build.
  "chicken tractor", "backyard fort", "kids fort", "kids fort 4 by 6 ft", "paper fort for kids", "fire engine for kids", "race car for kids", "castle for kids",
];
const MODELS = ["Space Needle model", "pirate ship", "toy airplane", "catapult", "Golden Gate Bridge 36 inches long", "galleon 30 inches long", "eiffel tower", "3 foot Eiffel Tower from popsicle sticks", "popsicle stick bridge"];

test("a craft-stick lift is kept only when the lifted build is not a stand-in", () => {
  assert.equal(craft("20 by 16 picture frame"), false);
  for (const p of STAND_IN) assert.equal(craft(p), true, p);
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
  const p = generateFromPrompt("20 by 16 picture frame");
  assert.ok(p.craftLifted, "20 by 16 picture frame");
  assert.deepEqual(i46Ties(buildPlan(p)).generalWordTied, []);
});
