import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { packLengths } from "./linearPack";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

describe("spare stock", () => {
  it("buys one more only when the longest sits alone and there are more than four cuts", () => {
    const alone = packLengths([20, 20, 20, 20, 20], 36, 0.125);
    assert.equal(alone.sticks, 6);
    assert.match(alone.spare ?? "", /less than the longest piece/);
    const shared = packLengths([72, 18, 18, 18, 18], 96, 0.125);
    assert.equal(shared.spare, undefined);
    assert.equal(shared.sticks, 2);
  });

  it("a 6 ft ladder still shares three studs", () => {
    const line = buildPlan(generateFromPrompt("6 foot ladder from 2x4")).bom.find((b) => b.catalogId === "lumber-2x4-8");
    assert.equal(line?.quantity, 3);
    assert.match(line?.notes ?? "", /from 3 whole studs/);
  });
});
