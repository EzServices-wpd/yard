import assert from "node:assert/strict";
import test from "node:test";

test("the daily image cap stops the 4th render for one visitor, before any spend (memory fallback off Vercel)", async () => {
  const { underDailyCap } = await import("../src/lib/ai/dailyCap.server.ts");
  const ip = `test-${Math.random()}`;
  const got = [];
  for (let i = 0; i < 4; i++) got.push(await underDailyCap("image", ip));
  assert.deepEqual(got, [true, true, true, false]);
  assert.ok(await underDailyCap("image", `${ip}-other`), "another visitor still has renders");
});
