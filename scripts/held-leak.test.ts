// Yard Critic 2 (#436): a held recipe built under its synonym or its name must not list on Ideas.
// Passes on release ce6079c6, fails on a2c6952b. Run: npx tsx --test scripts/held-leak.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { curatedFeed, searchPool, searchCards } from "../src/lib/ideas/feed";
import { liveFeed } from "../src/lib/ideas/liveFeed";
import { recordFromPrompt } from "../src/lib/yard/ideaLog.server";
import RECIPES from "../src/lib/ideas/recipes.json";

const at = "2026-11-24T19:00:00.000Z";
const row = (resultKey: string, status: "Trusted" | "Unverified", i: number) =>
  ({ key: `k${i}`, prompt: "", resultKey, size: "10×10×10", status, count: 9, lastSeen: at, source: "web" });

test("the held glider (Critic FLAGGED) never lists on Ideas, whatever the visitor typed", async () => {
  const rows = [];
  for (const [i, p] of ["glider", "balsa glider", "glider plane"].entries()) {
    const rec = (await recordFromPrompt(p))!;
    assert.ok(rec.resultKey.startsWith("recipe:"), `${p} builds the glider recipe (${rec.resultKey})`);
    rows.push(row(rec.resultKey, rec.status as "Unverified", i));
  }
  const feed = liveFeed({ at, live: true, rows, popular: [], recent: [] } as never, curatedFeed(RECIPES as never), new Date(at));
  const listed = [...feed.sections.flatMap((s) => s.cards), ...(feed.all ?? [])].map((c) => c.buildType);
  assert.deepEqual(listed.filter((t) => /glider/.test(t)), [], "a held recipe row is on Ideas");
  assert.deepEqual(searchCards(searchPool(feed), "glider").map((c) => c.slug), [], "search finds the held glider");
});

test("synonyms of held recipes that build a 1-part stand-in do not list either (miter saw bench, chop saw station)", async () => {
  const rows = [];
  for (const [i, p] of ["miter saw bench", "chop saw station"].entries()) { const rec = (await recordFromPrompt(p))!; rows.push(row(rec.resultKey, rec.status as "Trusted", i)); }
  const feed = liveFeed({ at, live: true, rows, popular: [], recent: [] } as never, curatedFeed(RECIPES as never), new Date(at));
  assert.deepEqual((feed.all ?? []).filter((c) => c.buildType === "miter-saw-bench" || c.buildType === "chop-saw-station").map((c) => c.title), []);
});
