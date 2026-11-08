import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { NOTHING_BUILT_STOCK, nothingBuilt, stockPillLabel } from "./stockPill";

globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;

test("a refusal offers no stock to choose: the pill says Nothing built and offers no 'Choose stock'", () => {
  for (const q of ["abacus 4 wide 8 rods", "abacus 1 wide 1 rod"]) {
    const p = generateFromPrompt(q);
    assert.ok(nothingBuilt(p), q);
    assert.deepEqual(stockPillLabel(p, buildPlan(p)), { label: NOTHING_BUILT_STOCK, wire: false, offersStock: false }, q);
  }
  const built = generateFromPrompt("bookcase 36 wide 72 tall");
  assert.ok(!nothingBuilt(built));
  assert.equal(stockPillLabel(built, buildPlan(built)).offersStock, true);
});
