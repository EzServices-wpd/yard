/**
 * All ideas (Chief 10-25, Direction A catalog PR 1): every listed build type once, drawn or not, searchable, from the
 * prompt-free snapshot. One listing rule (listRule) keeps held, generic and Unverified-only types off every section.
 * Seams: liveFeed's output on the saved 10-25 /api/ideas-snapshot, and the Ideas page's server markup.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IdeasPageView } from "../src/components/ideas/IdeasPageView";
import { ALL_SHOW, curatedFeed, searchCards, searchPool, type IdeasFeed } from "../src/lib/ideas/feed";
import { GENERIC_TYPES, feedViolations, gradedTypes, liveFeed, type PublicSnapshot } from "../src/lib/ideas/liveFeed";
import { isHeldType } from "../src/lib/ideas/held";
import RECIPES from "../src/lib/ideas/recipes.json";
import LIVE from "./fixtures/ideas-snapshot-2026-10-25.json";
import type { IdeasSnapshot, SnapshotRow } from "../src/lib/yard/ideaLog";

const PUB = LIVE as unknown as PublicSnapshot;
const rows = (rs: PublicSnapshot["rows"]): SnapshotRow[] => rs.map((r, i) => ({ key: `p${i}`, prompt: "", resultKey: `${r.recipe ? "recipe" : "builtin"}:${r.buildType}`, size: r.size, status: r.status, count: r.count, lastSeen: r.lastSeen }));
const snap: IdeasSnapshot = { ...PUB, rows: rows(PUB.rows), popular: rows(PUB.popular), recent: rows(PUB.recent) };
const base = curatedFeed(RECIPES);
const feed = liveFeed(snap, base, new Date(snap.at));
const all = feed.all ?? [];
const page = (f: IdeasFeed, incoming = "") => renderToStaticMarkup(createElement(IdeasPageView, { incoming, learned: [], onBuild: () => {}, feed: f })).replace(/&amp;/g, "&");

// Straight from the snapshot rows (not through the feed's grouping): types with a Trusted build, and Unverified-only types.
const trusted = new Set(PUB.rows.filter((r) => r.status === "Trusted").map((r) => r.buildType));
const unverifiedOnly = [...new Set(PUB.rows.map((r) => r.buildType))].filter((t) => !trusted.has(t));

test("All ideas lists every Trusted, unheld, non-generic build type exactly once, plus each curated idea nobody built", () => {
  const want = [...trusted].filter((t) => !isHeldType(t) && !GENERIC_TYPES.has(t));
  const types = all.map((c) => c.buildType);
  assert.deepEqual(types.filter((t, i) => types.indexOf(t) !== i), [], "one row per build type");
  for (const t of want) assert.ok(types.includes(t), `${t} is missing`);
  const curatedOnly = all.filter((c) => !trusted.has(c.buildType));
  for (const c of curatedOnly) assert.equal(c.count, 0, `${c.slug} has builds but no Trusted row`);
  assert.equal(all.length, want.length + curatedOnly.length);
  // 10-25: 85 logged types (44 with no drawing yet; the rocket is baked) and 15 curated ideas with no build: 100 rows vs 54 cards in the sections.
  assert.deepEqual([want.length, all.filter((c) => !c.drawing).length, curatedOnly.length], [85, 44, 15]);
  assert.deepEqual(feedViolations(feed, snap, gradedTypes(base)), []);
});

test("one rule: Unverified-only, held and generic types are in no section and not in All ideas", () => {
  assert.deepEqual(unverifiedOnly.sort(), ["bird-feeder", "colosseum", "compost-bin", "ferris-wheel", "glider", "jewelry-box", "outdoor-storage-bench", "pergola", "picnic-table", "taj-mahal", "utility-cart"]);
  const shown = [...feed.sections.flatMap((s) => s.cards), ...all];
  for (const c of shown) {
    assert.ok(!unverifiedOnly.includes(c.buildType), `${c.slug} (Unverified only) shows`);
    assert.ok(!isHeldType(c.buildType) && !isHeldType(c.recipeKey) && !GENERIC_TYPES.has(c.buildType), `${c.slug} held or generic`);
  }
  // The guard names one that slips in.
  const bad: IdeasFeed = { ...feed, all: [...all, { ...all[0], slug: "utility-cart", buildType: "utility-cart", title: "Utility cart" }] };
  assert.ok(feedViolations(bad, snap).some((v) => v.startsWith("utility-cart: utility-cart is not listed")));
});

test("ungraded types are marked new and stay out of Popular and the hero; undrawn ones keep the engine title and size", () => {
  const graded = gradedTypes(base);
  for (const c of all) if (!graded.has(c.buildType)) assert.equal(c.status, "new", c.slug);
  assert.ok(feed.sections.find((s) => s.id === "popular")!.cards.every((c) => c.status === "checked"));
  assert.ok(feed.hero && graded.has(feed.hero.slug));
  const goal = all.find((c) => c.buildType === "soccer-goal")!;
  assert.deepEqual([goal.title, goal.size, goal.drawing, goal.status, goal.examplePrompt], ["Soccer goal", "48 × 12 × 36 in", null, "new", "soccer goal 48 wide 36 tall 12 deep"]);
});

test("a type's size is its most-built size; a tie goes to the newest", () => {
  const r = (size: string, count: number, lastSeen: string): SnapshotRow => ({ key: size + lastSeen, prompt: "", resultKey: "builtin:sideboard", size, status: "Trusted", count, lastSeen });
  const at = (s: IdeasSnapshot["rows"]) => liveFeed({ ...snap, rows: [...snap.rows.filter((x) => x.resultKey !== "builtin:sideboard"), ...s] }, base, new Date(snap.at)).all!.find((c) => c.buildType === "sideboard")!.size;
  assert.equal(at([r("54×18×34", 2, "2026-10-20T00:00:00Z"), r("60×18×34", 2, "2026-10-24T00:00:00Z")]), "60 × 18 × 34 in");
  assert.equal(at([r("60×18×34", 2, "2026-10-20T00:00:00Z"), r("54×18×34", 2, "2026-10-24T00:00:00Z")]), "54 × 18 × 34 in");
  assert.equal(at([r("54×18×34", 3, "2026-10-20T00:00:00Z"), r("60×18×34", 2, "2026-10-24T00:00:00Z")]), "54 × 18 × 34 in");
});

test("privacy: no word a visitor typed reaches All ideas", () => {
  const typed = ["my nan's wobbly sideboard 61 wide", "rocket for my son 30 tall"];
  const raw: IdeasSnapshot = { ...snap, rows: [...snap.rows, { ...snap.rows[0], key: "t1", prompt: typed[0], resultKey: "builtin:sideboard", lastSeen: snap.at }, { ...snap.rows[0], key: "t2", prompt: typed[1], resultKey: "builtin:rocket", lastSeen: snap.at }] };
  const body = JSON.stringify(liveFeed(raw, base, new Date(snap.at)).all).toLowerCase();
  for (const t of typed) assert.ok(!body.includes(t) && !body.includes(t.split(" ").slice(1, 3).join(" ")), t);
});

test("the page: All ideas is a list of links, ALL_SHOW at first, a native Show more, no empty picture box", () => {
  const html = page(feed);
  const sec = html.slice(html.indexOf("data-ideas-all"));
  assert.match(sec, /<h2 id="ideas-all"[^>]*>All ideas<\/h2>/);
  const links = [...sec.matchAll(/<a href="([^"]+)"[^>]*data-idea-row="([^"]+)"/g)];
  assert.equal(links.length, ALL_SHOW);
  for (const [, href] of links) assert.match(href, /^\/workspace\?q=/);
  assert.ok(!/<img|data-idea-no-drawing/.test(sec), "rows carry no picture box");
  assert.match(sec, /data-idea-row="soccer-goal"[^>]*>.*?Soccer goal.*?New, not checked yet.*?48 × 12 × 36 in/);
  assert.match(sec, /<button type="button" aria-controls="ideas-all-list" data-ideas-all-more="true"[^>]*>Show 24 more<\/button>/);
  assert.match(sec, /24 of 100 shown/);
  // The fallback feed (store down) has no catalog to show.
  assert.ok(!page(base).includes("data-ideas-all"));
});

test("search reaches every listed type with the page's aliases; an undrawn hit is a row, not a blank card", () => {
  const pool = searchPool(feed);
  for (const [q, t] of [["soccer", "soccer-goal"], ["utility cabinet", "utility-cabinet"], ["bookshelf", "bookcase"], ["wardrobe", "wardrobe"]]) assert.equal(searchCards(pool, q)[0]?.buildType, t, q);
  assert.ok(!searchCards(pool, "utility").some((c) => c.buildType === "utility-cart"), "an Unverified-only type is not searchable");
  // One card per build type in search too: the corner shelf's near-variant "Too small for books" never rides along.
  for (const f of [feed, base]) {
    const types = searchPool(f).map((c) => c.buildType);
    assert.deepEqual(types.filter((t, i) => types.indexOf(t) !== i), [], "one search card per build type");
    assert.ok(!searchCards(searchPool(f), "bookshelf").some((c) => c.title === "Too small for books"));
  }
  const html = page(feed, "soccer goal");
  const res = html.slice(html.indexOf("data-ideas-results"));
  assert.match(res, /data-idea-row="soccer-goal"/);
  assert.ok(!res.includes("data-idea-no-drawing"));
  // A drawn log type (the baked rocket) is a card with its own drawing, not a row.
  const hit = page(feed, "rocket");
  const card = hit.slice(hit.indexOf("data-ideas-results"));
  assert.match(card, /data-idea="rocket"[^>]*>.*?<img src="\/ideas\/drawings\/rocket\.[0-9a-f]{8}\.svg"/);
  assert.ok(!card.includes('data-idea-row="rocket"'));
});
