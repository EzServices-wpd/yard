// Critic's round-4 handback for #221 (their file, copied from /workspace/grade-pr221/r4; only the import path changed).
// Critic probe for #221 round 4 (audit mode, NOT a block; finding N1). Run from the repo root: npx tsx --test cap-straddle.critic.test.ts
// scrubMessage (report.ts:31) cuts the raw input at 500 chars BEFORE it decides tokens, so a non-list word straddling char 500 is
// judged by its prefix; when that prefix is a list word it shows ("stepladder" -> "step", "information" -> "in").
// report.ts:29 says "The cut comes first, so a cut can't show part of a word". Only list words can ever appear.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubMessage } from "../src/lib/err/report.ts";
const srv = (m: string) => scrubMessage(scrubMessage(m));
test("a word cut at the 500-char input cap does not show as its list-word prefix", () => {
  assert.equal(srv("x".repeat(495) + " stepladder"), "[x] [x]");
  assert.equal(srv("x".repeat(497) + " information"), "[x] [x]");
});
