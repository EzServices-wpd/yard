import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { curatedFeed, type IdeasFeed } from "../src/lib/ideas/feed";
import { MIN_TITLE_LETTERS, SECTION_MAX, TEST_CUTOFF, TEST_PROMPTS, feedViolations, gradedTypes, groupRows, isJunkTitle, isTestRow, liveFeed, typeKey } from "../src/lib/ideas/liveFeed";
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
    // Critic's probes run with ?test=1 / x-yard-test, so the log stamps them "test": dropped by that flag, not the words.
    { ...row("critic probe shelf", "builtin:shelf", 7, after(1)), source: "test" },
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
  assert.deepEqual(feedViolations(feed, SNAP), []);
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

test("home 'Making now' drops chained 'Then:' prompts (same isChained as the feed)", async () => {
  const { isChained } = await import("../src/lib/ideas/liveFeed");
  assert.ok(isChained("birdhouse. Then: 3/8 dowel"));
  const fs = await import("fs");
  assert.match(fs.readFileSync("src/components/ideas/MakingNow.tsx", "utf8"), /!isChained\(r\.prompt\)/);
});

test("'test tube rack' stays in the feed: test traffic is the logged test=1 / x-yard-test flag, never a word in the prompt", () => {
  const real = [row("test tube rack", "builtin:test-tube-rack", 11, after(7)), row("canary yellow birdhouse", "builtin:birdhouse", 2, after(8)), row("testing station workbench", "builtin:workbench", 1, after(9))];
  const flagged = { ...row("test tube rack for 12 tubes", "builtin:test-tube-rack", 40, after(7)), source: "test" as const };
  for (const r of real) assert.ok(!isTestRow(r), r.prompt);
  assert.ok(isTestRow(flagged));
  assert.ok(!isTestRow({ ...real[0], source: "live" }));
  const snap: IdeasSnapshot = { ...SNAP, rows: [...SNAP.rows, ...real, flagged] };
  const f = liveFeed(snap, curatedFeed(RECIPES), NOW);
  const cards = f.sections.flatMap((s) => s.cards);
  const ttr = cards.find((c) => c.buildType === "test-tube-rack");
  assert.ok(ttr, "test tube rack is in the Ideas feed");
  assert.equal(ttr!.count, 11, "only the real row is counted; the test=1 row is not");
  assert.equal(ttr!.examplePrompt, "test tube rack");
  assert.deepEqual(feedViolations(f, snap), []);
  // The invariant still catches a counted card whose example is a logged test row.
  const bad: IdeasFeed = JSON.parse(JSON.stringify(f));
  bad.sections.flatMap((s) => s.cards).find((c) => c.buildType === "test-tube-rack")!.examplePrompt = "test tube rack for 12 tubes";
  assert.match(feedViolations(bad, snap).join("\n"), /test prompt "test tube rack for 12 tubes"/);
});

test("quick win (e): cut-off box keys read as boxes, generic fallbacks never become cards, no blank cards", () => {
  assert.equal(typeKey("builtin:pine-toolbo"), "pine-toolbox");
  assert.equal(typeKey("recipe:planter-bo"), "planter-box");
  assert.equal(typeKey("recipe:gumbo"), "gumbo");
  const snap: IdeasSnapshot = { ...SNAP, rows: [...SNAP.rows, row("storage", "builtin:storage-unit", 50, after(3)), row("pine toolbox", "builtin:pine-toolbo", 4, after(3))] };
  const f = liveFeed(snap, curatedFeed(RECIPES), NOW);
  const all = f.sections.flatMap((s) => s.cards);
  assert.ok(!all.some((c) => c.buildType === "storage-unit"), "no Storage unit card");
  assert.ok(all.some((c) => c.title === "Pine toolbox"), "Pine toolbox, not Pine toolbo");
  assert.deepEqual(feedViolations(f), []);
  const src = fs.readFileSync("src/components/ideas/IdeaDrawing.tsx", "utf8");
  assert.match(src, /data-idea-no-drawing/);
});

test("held recipes never render on Ideas: HELD_TYPES is recipes.json's held set, and the feed drops them everywhere", async () => {
  const { HELD_TYPES, isHeldType } = await import("../src/lib/ideas/held");
  const ALL = (await import("../src/lib/yard/recipes.json")).default as unknown as { recipes: { key: string; synonyms?: string[]; held?: string }[] };
  const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const want = new Set(ALL.recipes.filter((r) => r.held).flatMap((r) => [r.key, ...(r.synonyms ?? [])].map(slug)));
  assert.deepEqual([...HELD_TYPES].sort(), [...want].sort(), "src/lib/ideas/held.ts is stale");
  assert.ok(isHeldType("ferris-wheel") && isHeldType("colosseum"));
  const snap: IdeasSnapshot = { ...SNAP, rows: [...SNAP.rows, row("ferris wheel", "recipe:ferris-wheel", 80, after(3), "Trusted"), row("colosseum", "recipe:colosseum", 60, after(4), "Unverified")] };
  const f = liveFeed(snap, curatedFeed(RECIPES), NOW);
  for (const s of f.sections) for (const c of s.cards) assert.ok(!isHeldType(c.buildType) && !isHeldType(c.recipeKey), `${c.slug} in ${s.id}`);
  assert.deepEqual(feedViolations(f), []);
});

test("only rendered cards are used: a Trusted build past Popular's SECTION_MAX still shows in a later section (row 111)", () => {
  // SECTION_MAX + 6 busy Trusted types fill Popular; the mail organizer and under-stairs shelves are Trusted but low-count.
  const word = (i: number) => String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + (i % 26)) + "x";
  const busy = Array.from({ length: SECTION_MAX + 6 }, (_, i) => row(`${word(i)} rack`, `builtin:${word(i)}-rack`, 500 - i, after(1)));
  const snap: IdeasSnapshot = {
    ...SNAP,
    rows: [...busy, row("mail organizer", "builtin:mail-organizer", 2, after(30)), row("under stairs shelves", "builtin:under-stairs", 2, after(31))],
  };
  // Since row 169 Popular takes only types Critic graded, so the busy racks are graded here (checked cards in the base).
  const cur = curatedFeed();
  const proto = cur.sections[0].cards[0];
  const gradedBusy = busy.map((r) => ({ ...proto, slug: typeKey(r.resultKey), buildType: typeKey(r.resultKey), title: `${r.prompt[0].toUpperCase()}${r.prompt.slice(1)}`, examplePrompt: r.prompt, drawing: null, status: "checked" as const }));
  const base: IdeasFeed = { ...cur, sections: [...cur.sections, { id: "graded-racks", title: "Racks", order: cur.sections.length, total: gradedBusy.length, cards: gradedBusy }] };
  const feed = liveFeed(snap, base, NOW);
  assert.deepEqual(feedViolations(feed, undefined, gradedTypes(base)), []);
  const pop = feed.sections.find((s) => s.id === "popular")!;
  assert.equal(pop.cards.length, SECTION_MAX);
  const where = (t: string) => feed.sections.find((s) => s.cards.some((c) => c.buildType === t))?.id ?? null;
  assert.equal(where("mail-organizer"), "recent", "mail organizer is in no section");
  assert.equal(where("under-stairs"), "recent", "under-stairs shelves are in no section");
  // Every Trusted type shows exactly once somewhere (busy types past both caps would stay hidden).
  for (const s of feed.sections) for (const c of s.cards) assert.equal(feed.sections.filter((x) => x.cards.some((y) => y.buildType === c.buildType)).length, 1);
});

test("junk titles never render: the shared card-quality rule drops digit-only or stub titles in every section (row 111)", () => {
  // The live junk "3" card was "3/4 PVC soccer goal" + "3/4 PVC trellis": the stock size was read as the build type.
  assert.equal(typeKey("builtin:3-4-soccer-goal"), "soccer-goal");
  assert.equal(typeKey("builtin:3-4-trellis"), "trellis");
  assert.equal(typeKey("builtin:3-8-hardwood-dowel"), "hardwood-dowel");
  assert.equal(typeKey("builtin:2x4-ladder"), "2x4-ladder");
  for (const t of ["3", "3/4", "12", "X", "Tv", " 3 4 ", ""]) assert.ok(isJunkTitle(t), `"${t}" is junk`);
  for (const t of ["Bed", "Soccer goal", "2×4 ladder", "8 flat washer"]) assert.ok(!isJunkTitle(t), `"${t}" is a title`);
  assert.equal(MIN_TITLE_LETTERS, 3);
  // Rows that still fold to a stub type ("3-4" → "3", "x" → "X") are dropped, even when Trusted and the busiest.
  const snap: IdeasSnapshot = {
    ...SNAP,
    rows: [
      ...SNAP.rows,
      row("3/4", "builtin:3-4", 900, after(7)),
      row("x", "builtin:x", 800, after(7)),
      row("3/4 PVC soccer goal 48 wide 36 tall", "builtin:3-4-soccer-goal", 3, after(8), "Trusted", "48×12×36"),
    ],
  };
  const feed = liveFeed(snap, curatedFeed(), NOW);
  assert.deepEqual(feedViolations(feed), []);
  const cards = feed.sections.flatMap((s) => s.cards);
  assert.deepEqual(cards.filter((c) => isJunkTitle(c.title)).map((c) => c.title), []);
  assert.ok(cards.some((c) => c.buildType === "soccer-goal" && c.title === "Soccer goal"), "the soccer goal shows under its own name");
  // And the invariant names one if it ever gets through.
  const bad: IdeasFeed = { ...feed, sections: [{ ...feed.sections[0], cards: [{ ...feed.sections[0].cards[0], title: "3" }, ...feed.sections[0].cards.slice(1)] }] };
  assert.ok(feedViolations(bad).some((v) => /junk title "3"/.test(v)));
});

test("Popular lists only Trusted builds Critic graded (row 169): an engine-Trusted type nobody graded is never checked, on Popular or the hero", () => {
  // Live 10-20: the cardboard dollhouse builds a sealed box and "shoe rack by the door" a prehung door, both logged
  // Trusted (a built-in shape is Trusted by default). Both were on Popular; neither type is a graded (checked) card.
  const snap: IdeasSnapshot = {
    ...SNAP,
    rows: [
      ...SNAP.rows,
      row("cardboard dollhouse 12 wide 16 tall", "builtin:dollhouse", 400, after(40), "Trusted", "12×16×16"),
      row("shoe rack by the door 36 inches wide", "builtin:shoe-prehung-interior-36-80-door", 300, after(41), "Trusted", "48×8×98"),
      row("shoe rack with cubbies", "builtin:shoe-rack", 2, after(42)),
    ],
  };
  const base = curatedFeed(RECIPES);
  const graded = gradedTypes(base);
  assert.ok(!graded.has("dollhouse") && !graded.has("shoe-prehung-interior") && graded.has("shoe-rack") && graded.has("linen"));
  const f = liveFeed(snap, base, NOW);
  assert.deepEqual(feedViolations(f, undefined, graded), []);
  const pop = f.sections.find((s) => s.id === "popular")!;
  const popTypes = pop.cards.map((c) => c.buildType);
  for (const t of ["dollhouse", "shoe-prehung-interior"]) assert.ok(!popTypes.includes(t), `${t} on Popular`);
  assert.ok(popTypes.includes("shoe-rack") && popTypes.includes("linen"), "graded Trusted types stay on Popular");
  for (const c of pop.cards) assert.ok(graded.has(c.buildType), `${c.slug} on Popular is not graded`);
  // They still show as what they are: new builds in Popular recently, never checked; never the hero.
  const all = f.sections.flatMap((s) => s.cards);
  assert.equal(all.find((c) => c.buildType === "dollhouse")?.status, "new");
  assert.ok(f.hero && graded.has(f.sections.flatMap((s) => s.cards).find((c) => c.slug === f.hero!.slug)!.buildType));
  // A graded type whose builds are all Unverified in the log is not Popular either (Trusted AND graded).
  const unv = liveFeed({ ...snap, rows: snap.rows.map((r) => (r.resultKey === "builtin:shoe-rack" ? { ...r, status: "Unverified" as const } : r)) }, base, NOW);
  assert.ok(!unv.sections.find((s) => s.id === "popular")!.cards.some((c) => c.buildType === "shoe-rack"));
  // The guard names an ungraded card on Popular or a counted checked card nobody graded.
  const bad: IdeasFeed = JSON.parse(JSON.stringify(f));
  const bp = bad.sections.find((s) => s.id === "popular")!;
  bp.cards.push({ ...bp.cards[0], slug: "dollhouse", buildType: "dollhouse", title: "Dollhouse", examplePrompt: "cardboard dollhouse 12 wide 16 tall", count: 0 });
  assert.ok(feedViolations(bad, undefined, graded).some((v) => /dollhouse: not graded by Critic, in popular/.test(v)));
});
