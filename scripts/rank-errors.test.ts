import { test } from "node:test";
import assert from "node:assert/strict";
import { isProbe, reportPaths } from "./rank-errors.ts";

test("reports: a dated copy plus latest, never one overwritten file", () => {
  const p = reportPaths("/x", new Date("2026-10-15T23:00:00Z"));
  assert.equal(p.dated, "/x/yard-errors-ranked-2026-10-15.md");
  // 9:30 PM ET on Oct 15 is already Oct 16 in UTC: the stamp is New York's day.
  assert.equal(reportPaths("/x", new Date("2026-10-16T01:30:00Z")).dated, "/x/yard-errors-ranked-2026-10-15.md");
  // Winter (EST): 08:17 UTC is 03:17 in New York, same day.
  assert.equal(reportPaths("/x", new Date("2026-12-01T08:17:00Z")).dated, "/x/yard-errors-ranked-2026-12-01.md");
  assert.equal(p.latest, "/x/yard-errors-ranked-latest.md");
  assert.notEqual(reportPaths("/x", new Date("2026-10-16T08:00:00Z")).dated, p.dated);
});

test("critic probe rows are dropped from the Ideas input, real ideas kept", () => {
  assert.ok(isProbe({ prompt: "critic probe: linen closet 31.5" }));
  assert.ok(isProbe({ prompt: "bookshelf", source: "Critic-Probe" }));
  assert.ok(isProbe({ prompt: "bookshelf", tags: ["critic_probe"] }));
  assert.ok(!isProbe({ prompt: "bookshelf 36 wide" }));
  assert.ok(!isProbe({ prompt: "critic's favourite bench" }));
});
