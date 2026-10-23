import assert from "node:assert/strict";
import test from "node:test";
import { indefiniteArticle, withArticle } from "./article";

test("a/an follows how a number is spoken: 8, 11, 18, 80 take 'an'; 1 and 7 take 'a'", () => {
  for (const [n, a] of [["8", "an"], ["11", "an"], ["18", "an"], ["80", "an"], ["1", "a"], ["7", "a"], ["800", "an"], ["8,000", "an"], ["11000", "an"], ["110", "a"], ["180", "a"], ["18000", "an"], ["100", "a"]] as const)
    assert.equal(indefiniteArticle(`${n}-rod abacus`), a, n);
  assert.equal(withArticle("8-rod abacus", true), "An 8-rod abacus");
  assert.equal(withArticle("11-rod abacus", true), "An 11-rod abacus");
  assert.equal(withArticle("7-rod abacus", true), "A 7-rod abacus");
});

test("a/an follows how a word is spoken", () => {
  for (const [w, a] of [["abacus", "an"], ["octagon", "an"], ["hour", "an"], ["unit", "a"], ["one-rod abacus", "a"], ["umbrella stand", "an"], ["hexagon", "a"], ["bench", "a"], ["European", "a"]] as const)
    assert.equal(indefiniteArticle(w), a, w);
});

test("the abacus refusal reads 'An 8-rod' and 'An 11-rod', 'A 7-rod' and 'A 1-rod'", async () => {
  globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
  const { generateFromPrompt } = await import("./promptMain");
  const said = (q: string) => String(generateFromPrompt(q).refused ?? "");
  assert.match(said("abacus 4 wide 8 rods"), /\. An 8-rod abacus needs/);
  assert.match(said("abacus 5 wide 11 rods"), /\. An 11-rod abacus needs/);
  assert.match(said("abacus 2 wide 7 rods"), /\. A 7-rod abacus needs/);
  assert.match(said("abacus 1 wide 1 rod"), /\. A 1-rod abacus needs/);
});
