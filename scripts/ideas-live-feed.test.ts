import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { curatedFeed, type IdeasFeed } from "../src/lib/ideas/feed";
import { SECTION_MAX, TEST_CUTOFF, TEST_PROMPTS, feedViolations, groupRows, isTestRow, liveFeed, typeKey } from "../src/lib/ideas/liveFeed";
import { ideaTypes } from "./gen-idea-types";
import { CANARIES } from "./weekend-canaries";
import RECIPES from "../src/lib/ideas/recipes.json";
import TYPES from "../src/lib/ideas/types.json";
import type { IdeasSnapshot, SnapshotRow } from "../src/lib/yard/ideaLog";

const NOW = new Date("2026-10-18T12:00:00Z");
const after = (h: number) => new Date(Date.parse(TEST_CUTOFF) + h * 3_600_000).toISOString();
let n = 0;
const row = (prompt: string, resultKey: string, count: number, lastSeen: string | null, status: SnapshotRow["status"] = "Trusted", size = "36×12×72"): SnapshotRow =>
  ({ key: `k${n++}`, prompt, size, resultKey, status, count, lastSeen });

// Today's log, as REVIEW.md found it: linen 3×, bookshelf 3×, canaries, a chained Critic prompt, a placeholder.
const SNAP: IdeasSnapshot = {
  at: NOW.toISOString(), live: true, popular: [], recent: [],
  rows: [
    row("linen closet 31.5 wide 78 tall 16 deep", "builtin:linen", 96, after(1)),
    row("linen closet 30 wide 80 tall", "builtin:linen", 62, after(2), "Trusted", "30×16×80"),
    row("linen closet", "builtin:linen", 18, "2026-10-15T10:00:00Z"),
    row("bookshelf 36x12x72", "builtin:bookcase", 154, after(1)),
    row("bookshelf 30 wide", "builtin:bookcase", 9, after(3), "Trusted", "30×12×72"),
    row("tall bookcase", "builtin:bookcase", 4, after(4)),
    row("water wheel", "recipe:water-wheel", 40, after(1)),
    row("big ben", "builtin:big-ben", 30, after(1)),
    row("birdhouse. Then: 3/8 dowel", "builtin:birdhouse", 3, after(5)),
    row("hanging birdhouse", "unknown:hanging-birdhouse", 5, after(5), "Unverified"),
    row("critic probe shelf", "builtin:shelf", 7, after(1)),
    row("birdhouse", "builtin:birdhouse", 6, after(6)),
    row("workbench 72 wide", "builtin:workbench-72", 5, after(2)),
    row("cat tree", "recipe:cat-tree", 3, after(20), "Unverified", "24×24×60"),
  ],
};

test("the canary list here is the release canary list", () => {
  for (const c of CANARIES) assert.ok(TEST_PROMPTS.has(c), c);
});

test("test traffic is skipped: canaries, linen/Critic prompts, chained Then:, probes, placeholders, rows not seen since #56", () => {
  const groups = groupRows(SNAP.rows);
  const prompts = groups.flatMap((g) => g.rows.map((r) => r.prompt));
  for (const p of ["linen closet 31.5 wide 78 tall 16 deep", "bookshelf 36x12x72", "water wheel", "big ben", "birdhouse. Then: 3/8 dowel", "hanging birdhouse", "critic probe shelf", "linen closet"]) assert.ok(!prompts.includes(p), p);
  assert.ok(isTestRow({ prompt: "desk", resultKey: "builtin:desk", lastSeen: null }));
  assert.ok(!isTestRow({ prompt: "desk", resultKey: "builtin:desk", lastSeen: after(1) }));
  assert.equal(groups.find((g) => g.type === "bookcase")!.count, 13);
  assert.equal(groups.find((g) => g.type === "linen")!.count, 62);
});

test("build types fold variants: bookshelf is a bookcase, sizes drop off the key", () => {
  assert.equal(typeKey("builtin:bookshelf"), "bookcase");
  assert.equal(typeKey("builtin:workbench-72"), "workbench");
  assert.equal(typeKey("recipe:raised-bed"), "raised-garden-bed");
});

const feed = liveFeed(SNAP, curatedFeed(RECIPES), NOW);

test("Popular groups by build type with a curated title; linen and bookshelf appear once each", () => {
  const pop = feed.sections.find((s) => s.id === "popular")!;
  assert.equal(pop.title, "Popular");
  assert.deepEqual(pop.cards.map((c) => c.title).slice(0, 2), ["Linen closet", "Bookcase"].map((t) => pop.cards.find((c) => c.title.toLowerCase().startsWith(t.toLowerCase()))?.title));
  const all = feed.sections.flatMap((s) => s.cards);
  assert.equal(all.filter((c) => c.buildType === "linen").length, 1);
  assert.equal(all.filter((c) => c.buildType === "bookcase").length, 1);
  assert.equal(pop.cards[0].slug, "linen");
  assert.equal(pop.cards[1].slug, "bookcase");
  assert.equal(pop.cards[0].count, 62);
});

test("Popular recently is the live log of the last 7 days; new types are 'new' with their own size", () => {
  const recent = feed.sections.find((s) => s.id === "recent")!;
  const cat = recent.cards.find((c) => c.slug === "cat-tree")!;
  assert.equal(cat.status, "new");
  assert.deepEqual(cat.dims, { width: 24, depth: 24, height: 60 });
  assert.equal(cat.title, "Cat tree");
  assert.equal(cat.recipeKey, "cat-tree");
});

test("curated cards exist for Bookcase, Birdhouse, Workbench and Raised garden bed, each with a baked drawing", () => {
  const base = curatedFeed(RECIPES).sections.flatMap((s) => s.cards);
  for (const slug of ["bookcase", "birdhouse", "workbench", "raisedbed"]) {
    const c = base.find((x) => x.slug === slug);
    assert.ok(c, slug);
    assert.ok(c!.drawing && fs.existsSync(path.join("public", c!.drawing.src)), slug);
  }
});

test("hero: the most-built checked idea in 7 days with ≤150 parts; null on the fallback", () => {
  assert.equal(feed.hero?.slug, "linen");
  assert.equal(curatedFeed(RECIPES).hero, null);
  const off = liveFeed({ ...SNAP, live: false }, curatedFeed(RECIPES), NOW);
  assert.equal(off.live, false);
  assert.equal(off.hero, null);
  const empty = liveFeed({ ...SNAP, rows: SNAP.rows.slice(6, 11) }, curatedFeed(RECIPES), NOW);
  assert.equal(empty.live, false, "only test rows → fallback");
});

test("the invariant: live and fallback feeds pass; every shape field present; it catches each failure", () => {
  assert.deepEqual(feedViolations(feed), []);
  assert.deepEqual(feedViolations(curatedFeed(RECIPES)), []);
  for (const k of ["at", "live", "hero", "sections"]) assert.ok(k in feed, k);
  for (const s of feed.sections) {
    for (const k of ["id", "title", "order", "total", "cards"]) assert.ok(k in s, k);
    assert.ok(s.cards.length <= SECTION_MAX);
    for (const c of s.cards) for (const k of ["slug", "buildType", "title", "count", "lastSeen", "examplePrompt", "recipeKey", "dims", "status", "drawing"]) assert.ok(k in c, `${c.slug}.${k}`);
  }
  const bad: IdeasFeed = JSON.parse(JSON.stringify(feed));
  const c0 = bad.sections[0].cards[0];
  bad.sections[1].cards.push({ ...c0 }, { ...c0, slug: "x2", examplePrompt: "birdhouse. Then: 3/8 dowel" }, { ...c0, slug: "x3", buildType: "x3", examplePrompt: "big ben", title: "raw lowercase" });
  (bad.sections[1].cards[0] as Record<string, unknown>).storeHref = "https://example.com";
  const v = feedViolations(bad).join("\n");
  for (const m of ["slug linen", "build type linen", "Then:", "test prompt", "display title", "store field", "not sorted"]) assert.match(v, new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), m);
});

test("types.json is current with the engine (re-run scripts/gen-idea-types.ts)", () => {
  assert.deepEqual(TYPES, ideaTypes());
});
