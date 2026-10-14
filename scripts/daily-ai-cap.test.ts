import assert from "node:assert/strict";
import { it } from "node:test";
import { underDailyCap } from "../src/lib/ai/dailyCap.server.ts";

it("a visitor gets the cap's worth of AI calls a day, then none; others are unaffected", () => {
  for (let i = 0; i < 3; i++) assert.equal(underDailyCap("1.2.3.4", 3), true);
  assert.equal(underDailyCap("1.2.3.4", 3), false);
  assert.equal(underDailyCap("5.6.7.8", 3), true);
});
