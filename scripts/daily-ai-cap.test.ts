import assert from "node:assert/strict";
import { it } from "node:test";
import { underDailyCap } from "../src/lib/ai/dailyCap.server.ts";

it("a visitor gets the cap's worth of AI calls a day, then none; others are unaffected", async () => {
  process.env.YARD_DAILY_AI_CAP = "3";
  for (let i = 0; i < 3; i++) assert.equal(await underDailyCap("ai", "1.2.3.4"), true);
  assert.equal(await underDailyCap("ai", "1.2.3.4"), false);
  assert.equal(await underDailyCap("ai", "5.6.7.8"), true);
  delete process.env.YARD_DAILY_AI_CAP;
});
