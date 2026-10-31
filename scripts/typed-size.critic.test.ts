// Critic's handback for #221 (their file, copied from /workspace/grade-pr221; only the import path changed).
// Critic probe for #221 (audit mode, not a fix). Run from the repo root: npx tsx --test <this file>
// The approved sentence says a crash report "never sends what you typed". These typed tokens survive scrubMessage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubMessage, scrubStack } from "../src/lib/err/report.ts";

const P = "walnut bookshelf 30 wide";
test("typed width does not survive (SWE 2's own live case: 'rejected for [x] [x] 30 [x]')", () => {
  assert.doesNotMatch(scrubMessage("rejected for " + P.toUpperCase(), [P]), /\b30\b/);
});
test("typed dims 12 x 9 x 30 do not survive", () => {
  assert.doesNotMatch(scrubMessage("bad dims 12 x 9 x 30", ["box 12 x 9 x 30"]), /\b(12|9|30)\b/);
});
test("plural of a typed word does not survive", () => {
  assert.doesNotMatch(scrubMessage("no room for bookshelves", [P]), /bookshel/i);
});
test("a typed word on an 'at ' line of a multi-line message does not reach the stack", () => {
  assert.doesNotMatch(scrubStack("Error: x\n    at walnut bookshelf 30 wide\n    at f (https://yard.wiki/a.js:1:2)"), /walnut/);
});
