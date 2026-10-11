import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";

it("a raised bed with no typed height stands whole courses of its boards, with an Assumed note", () => {
  const p = generateFromPrompt("cedar 2x6 raised garden bed 4x8");
  assert.deepEqual([p.overall.width, p.overall.height, p.overall.depth], [48, 16.5, 96]);
  assert.ok(p.notes.some((n) => /^Assumed 16 1\/2" tall/.test(n)));
  assert.ok(p.notes.some((n) => /3 whole courses/.test(n)));
});
it("a typed bed height is kept", () => {
  assert.equal(generateFromPrompt("cedar 2x6 raised garden bed 4x8 12 inches tall").overall.height, 12);
});
