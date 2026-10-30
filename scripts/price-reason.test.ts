import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { priceReason, shortName } from "../src/components/workspace/price-reason";

test("linen alcove: the line names the added structural screws and the exact delta", () => {
  const p = generateFromPrompt("linen closet for a 31.5 inch alcove");
  const plan = buildPlan(p);
  const r = priceReason(p, plan);
  assert.ok(r, "a reason");
  // The plain twin stands free and buys the anti-tip kit (row 292); the alcove unit is screwed to the studs instead.
  assert.equal(r.delta, 8.99);
  assert.equal(r.base, 193.68);
  assert.match(r.text, /^\+\$8\.99 vs the plain build: adds structural screws \(\+\$18\.97\) and 1 more$/);
  assert.doesNotMatch(r.text, /https?:|www\./);
});

test("the plain build itself, and builds that match their plain twin, get no line", () => {
  for (const q of ["linen closet 31.5 wide 78 tall 16 deep", "bookshelf 36x12x72", "big ben"]) {
    const p = generateFromPrompt(q);
    assert.equal(priceReason(p, buildPlan(p)), null, q);
  }
});

test("shortName drops brand caps and sizes", () => {
  assert.equal(shortName("GRK RSS #9 x 3-1/8 structural screws"), "structural screws");
});
