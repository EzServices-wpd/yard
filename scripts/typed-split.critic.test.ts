// Critic's round-3 handback for #221 (their file, copied from /workspace/grade-pr221/r3; only the import path changed).
// Critic probe for #221 round 3 (audit mode, not a fix). Run from the repo root: npx tsx --test typed-split.critic.test.ts
// privacy.tsx:76 says a crash report "never sends what you typed". cutTyped (report.ts:24) splits what was typed only on
// non-letter/non-digit characters, so a typed run that glues letters to digits ("bookshelf30", "30wide", "幅30cmの本棚")
// becomes ONE token, and a 4+ char token is cut only by its own (n-1)-char prefix. A message carrying a part of that run
// (the word the engine itself split out) is not cut. Seen live at 390 px on c385d56d: typed "walnut bookshelf30 wide"
// (the engine read it as 30" W), thrown "no room for bookshelf", and the fake Sentry listener got "no room for bookshelf".
// Mirror of round 2 (typed separately, glued in the message), now typed glued, separate in the message.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubMessage } from "../src/lib/err/report.ts";

const srv = (m: string, typed: string[]) => scrubMessage(scrubMessage(m, typed), []); // browser then server
test("a word typed glued to a number (bookshelf30) does not survive on its own", () => {
  assert.doesNotMatch(srv("no room for bookshelf", ["walnut bookshelf30 wide"]), /bookshel/i);
});
test("a word typed after a number (30wide) does not survive on its own", () => {
  assert.doesNotMatch(srv("unknown unit wide", ["walnut bookshelf 30wide"]), /wide/i);
});
test("a word inside a typed run with no spaces (CJK) does not survive", () => {
  assert.doesNotMatch(srv("本棚 not found", ["幅30cmの本棚"]), /本棚/);
});
test("a typed word upper-cased by String#toUpperCase does not survive (ß -> SS, ı -> I)", () => {
  assert.doesNotMatch(srv("rejected " + "kitaplık".toUpperCase(), ["kitaplık 30"]), /KITAPLIK/i);
  assert.doesNotMatch(srv("rejected " + "fußbank".toUpperCase(), ["fußbank"]), /FUSSBANK/i);
});
