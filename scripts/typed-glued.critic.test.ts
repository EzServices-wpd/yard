// Critic's round-2 handback for #221 (their file, copied from /workspace/grade-pr221/r2; only the import path changed).
// Critic probe for #221 round 2 (audit mode, not a fix). Run from the repo root: npx tsx --test typed-glued.critic.test.ts
// privacy.tsx:76 says a crash report "never sends what you typed"; the PR body says every typed word is cut "at any length".
// A typed word right after a digit run is not cut (cutTyped's lookbehind also refuses digits), and the server's
// digit pass then turns the digits into "#", leaving the typed word. Seen live at 390 px: "no room for #wide",
// "GET /s/%#bookshelf #", "bad #walnut ok" reached the fake Sentry listener (prompt "walnut bookshelf 30 wide").
import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubMessage } from "../src/lib/err/report.ts";

const P = "walnut bookshelf 30 wide";
const srv = (m: string, typed: string[]) => scrubMessage(scrubMessage(m, typed), []); // browser then server
test("typed word glued after a typed number does not survive", () => {
  assert.doesNotMatch(srv("no room for 30wide", [P]), /wide/i);
});
test("typed word after a percent-encoded space does not survive", () => {
  assert.doesNotMatch(srv("GET /s/%20bookshelf 404", [P]), /bookshel/i);
});
test("typed word after any digit run does not survive", () => {
  assert.doesNotMatch(srv("bad 12walnut ok", [P]), /walnut/i);
});
test("a short typed word in NFD form does not survive", () => {
  assert.doesNotMatch(srv("été".normalize("NFD") + " broke", ["été bench"]).normalize("NFC"), /été/);
});
