import test from "node:test";
import assert from "node:assert/strict";
import { honestChecks, realUseAsk } from "./eval-gate-honest.ts";
import { staleGate, staleScore } from "./eval-gate-stale.ts";

test("craft stock is wrong only for load-bearing, outdoor or person-sized asks that never asked for a model", () => {
  for (const q of ["toddler step stool", "cornhole boards set", "mailbox post", "bedroom armoire 40 wide with doors", "cold frame", "garden bridge 6 ft", "shelf 24 inches wide"]) assert.ok(realUseAsk(q), q);
  for (const q of ["3 foot Eiffel Tower from popsicle sticks", "popsicle stick bridge", "model galleon 30 inches long", "galleon 30 inches long", "toy airplane", "Golden Gate Bridge 36 inches long", "coaster set"]) assert.ok(!realUseAsk(q), q);
});

test("a stand-in, craft on a real build and an unpriced Buy line are each a hit", () => {
  const E = { genericFormMark: (p: any) => (p.notes?.includes("stand-in") ? "simple stand-in" : null), genericBoxOverAsk: () => false };
  const priced = { bom: [{ name: '3/4" Plywood 4×8', estimatedCost: 38.43 }] };
  assert.deepEqual(honestChecks(E, "pencil box", { name: "Pencil Box", notes: ["stand-in"] }, priced).map((h) => h.cls), ["H-standin"]);
  assert.deepEqual(honestChecks(E, "mailbox post", { name: "Mailbox", primaryMaterialId: "popsicle-standard" }, priced).map((h) => h.cls), ["H-craft"]);
  assert.deepEqual(honestChecks(E, "bookcase", { name: "Bookcase" }, { bom: [{ name: "1×6 Board (8 ft)", estimatedCost: null }] }).map((h) => h.cls), ["H-unpriced"]);
  assert.deepEqual(honestChecks(E, "bookcase", { name: "Bookcase", primaryMaterialId: "plywood-3-4-4x8" }, priced), []);
});

test("a stored scorecard that differs from today is stale", () => {
  const g = (grade: string, pass: number) => ({ totals: { prompts: 1, pass, partial: 0, fail: 1 - pass, points: 2 * pass }, prompts: [{ prompt: "a", grade, classes: [] }] });
  assert.deepEqual(staleGate(g("pass", 1), g("pass", 1)), []);
  assert.ok(staleGate(g("pass", 1), g("fail", 0)).length >= 2);
  assert.deepEqual(staleScore({ score: 10, max: 12, failing: ["x"] }, { score: 10, max: 12, failing: ["x"] }), []);
  assert.equal(staleScore({ score: 10, max: 12, failing: [] }, { score: 11, max: 12, failing: [] }).length, 1);
});
