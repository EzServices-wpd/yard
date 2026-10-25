import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { curatedFeed, drawingFor, drawingForType, type DrawingRef, type IdeasFeed } from "../src/lib/ideas/feed";
import { MIN_TITLE_LETTERS, SECTION_MAX, TEST_CUTOFF, TEST_PROMPTS, dimsOf, feedViolations, gradedTypes, groupRows, isJunkTitle, isTestRow, liveFeed, logCardPrompt, publicSnapshot, typeKey, type PublicRow, type PublicSnapshot } from "../src/lib/ideas/liveFeed";
import { ideaTypes } from "./gen-idea-types";
import { CANARIES } from "./weekend-canaries";
import RECIPES from "../src/lib/ideas/recipes.json";
import TYPES from "../src/lib/ideas/types.json";
import TWINS from "../src/lib/ideas/typeTwins.json";
import LIVE_SNAP from "./fixtures/ideas-snapshot-2026-10-23.json";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import type { IdeasSnapshot, SnapshotRow } from "../src/lib/yard/ideaLog";

const NOW = new Date("2026-10-18T12:00:00Z");
/** Tests about filtering, titles and grading (not drawings) give every log type a baked-looking drawing. */
const drawAny = (t: string): DrawingRef => ({ src: `/ideas/drawings/${t}.0a.svg`, w: 480, h: 360, parts: 1, v: "0a" });
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
  const recent = liveFeed(SNAP, curatedFeed(RECIPES), NOW, TEST_CUTOFF, drawAny).sections.find((s) => s.id === "recent")!;
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

// Privacy page: the Ideas library never keeps the words people typed. The home strip and the Ideas feed show and rebuild
// from the engine's result (build type + logged W×D×H), never a visitor's prompt, typos and all.
test("no typed prompt reaches the Ideas feed, the hero or the home 'Making now' strip", async () => {
  const { makingNow } = await import("../src/lib/ideas/liveFeed");
  const typed = [
    row("cardboard mailbox 8 wide 18 tall", "builtin:mailbox", 22, after(9), "Trusted", "8×8×18"),
    row("pine 1x6 toolbx 18 lnog", "builtin:pine-toolbo", 4, after(10), "Trusted", "18×16×18"),
    row("I need to fit a 3 foot shelf for my enterance hallway", "builtin:shelf", 1, after(11), "Trusted", "3.625×3.625×24"),
  ];
  const snap: IdeasSnapshot = { ...SNAP, rows: [...SNAP.rows, ...typed] };
  const base = curatedFeed(RECIPES);
  const f = liveFeed(snap, base, NOW);
  const strip = makingNow(f);
  assert.ok(strip.length > 0, "the strip has rows on a live feed");
  const json = JSON.stringify({ f, strip }).toLowerCase();
  for (const r of typed) assert.ok(!json.includes(r.prompt.toLowerCase()), `typed prompt leaked: "${r.prompt}"`);
  // Any example prompt that is not Yard's own (a curated or recipe card's) is never a logged prompt.
  const ours = new Set(base.sections.flatMap((s) => s.cards.map((c) => c.examplePrompt)));
  const logged = new Set(snap.rows.map((r) => r.prompt));
  for (const c of f.sections.flatMap((s) => s.cards)) if (!ours.has(c.examplePrompt)) assert.ok(!logged.has(c.examplePrompt), `${c.slug}: "${c.examplePrompt}"`);
  if (f.hero && !ours.has(f.hero.examplePrompt)) assert.ok(!logged.has(f.hero.examplePrompt), f.hero.examplePrompt);
  // Each strip row is a counted feed card: its display title and engine size, newest build first.
  const cards = f.sections.flatMap((s) => s.cards);
  for (const it of strip) {
    const c = cards.find((x) => x.slug === it.slug)!;
    assert.ok(c && c.count > 0 && c.lastSeen, it.slug);
    assert.deepEqual([it.title, it.size, it.q], [c.title, c.size, c.examplePrompt]);
  }
  assert.deepEqual(strip.map((it) => cards.find((x) => x.slug === it.slug)!.lastSeen), [...strip.map((it) => cards.find((x) => x.slug === it.slug)!.lastSeen)].sort().reverse());
  assert.deepEqual(makingNow(curatedFeed(RECIPES)), [], "no strip on the fallback feed");
  // The strip renders only these items: it never reads the raw snapshot or a row's prompt.
  const src = fs.readFileSync("src/components/ideas/MakingNow.tsx", "utf8");
  assert.doesNotMatch(src, /ideas-snapshot|loadSnapshot|\.prompt\b/);
});

test("'test tube rack' stays in the feed: test traffic is the logged test=1 / x-yard-test flag, never a word in the prompt", () => {
  const real = [row("test tube rack", "builtin:test-tube-rack", 11, after(7)), row("canary yellow birdhouse", "builtin:birdhouse", 2, after(8)), row("testing station workbench", "builtin:workbench", 1, after(9))];
  const flagged = { ...row("test tube rack for 12 tubes", "builtin:test-tube-rack", 40, after(7)), source: "test" as const };
  for (const r of real) assert.ok(!isTestRow(r), r.prompt);
  assert.ok(isTestRow(flagged));
  assert.ok(!isTestRow({ ...real[0], source: "live" }));
  const snap: IdeasSnapshot = { ...SNAP, rows: [...SNAP.rows, ...real, flagged] };
  const f = liveFeed(snap, curatedFeed(RECIPES), NOW, TEST_CUTOFF, drawAny);
  const cards = f.sections.flatMap((s) => s.cards);
  const ttr = cards.find((c) => c.buildType === "test-tube-rack");
  assert.ok(ttr, "test tube rack is in the Ideas feed");
  assert.equal(ttr!.count, 11, "only the real row is counted; the test=1 row is not");
  assert.equal(ttr!.examplePrompt, "test tube rack 36 wide 72 tall 12 deep", "built from the engine type and logged size, not the typed words");
  assert.deepEqual(feedViolations(f, snap), []);
  // The invariant still catches a counted card whose example is a logged test row.
  const bad: IdeasFeed = JSON.parse(JSON.stringify(f));
  bad.sections.flatMap((s) => s.cards).find((c) => c.buildType === "test-tube-rack")!.examplePrompt = "test tube rack for 12 tubes";
  assert.match(feedViolations(bad, snap).join("\n"), /test prompt "test tube rack for 12 tubes"/);
});

test("quick win (e): cut-off box keys read as boxes, generic fallbacks never become cards, no blank cards", () => {
  assert.equal(typeKey("builtin:toolbo"), "toolbox");
  assert.equal(typeKey("recipe:planter-bo"), "planter-box");
  assert.equal(typeKey("recipe:gumbo"), "gumbo");
  const snap: IdeasSnapshot = { ...SNAP, rows: [...SNAP.rows, row("storage", "builtin:storage-unit", 50, after(3)), row("pine toolbox", "builtin:toolbo", 4, after(3))] };
  const f = liveFeed(snap, curatedFeed(RECIPES), NOW, TEST_CUTOFF, drawAny);
  const all = f.sections.flatMap((s) => s.cards);
  assert.ok(!all.some((c) => c.buildType === "storage-unit"), "no Storage unit card");
  assert.ok(all.some((c) => c.title === "Toolbox"), "Toolbox, not Toolbo");
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
  const gradedBusy = busy.map((r) => ({ ...proto, slug: typeKey(r.resultKey), buildType: typeKey(r.resultKey), title: `${r.prompt[0].toUpperCase()}${r.prompt.slice(1)}`, examplePrompt: r.prompt, drawing: drawAny(typeKey(r.resultKey)), status: "checked" as const }));
  const base: IdeasFeed = { ...cur, sections: [...cur.sections, { id: "graded-racks", title: "Racks", order: cur.sections.length, total: gradedBusy.length, cards: gradedBusy }] };
  const feed = liveFeed(snap, base, NOW, TEST_CUTOFF, drawAny);
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
  const feed = liveFeed(snap, curatedFeed(), NOW, TEST_CUTOFF, drawAny);
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
  const f = liveFeed(snap, base, NOW, TEST_CUTOFF, drawAny);
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
  const unv = liveFeed({ ...snap, rows: snap.rows.map((r) => (r.resultKey === "builtin:shoe-rack" ? { ...r, status: "Unverified" as const } : r)) }, base, NOW, TEST_CUTOFF, drawAny);
  assert.ok(!unv.sections.find((s) => s.id === "popular")!.cards.some((c) => c.buildType === "shoe-rack"));
  // The guard names an ungraded card on Popular or a counted checked card nobody graded.
  const bad: IdeasFeed = JSON.parse(JSON.stringify(f));
  const bp = bad.sections.find((s) => s.id === "popular")!;
  bp.cards.push({ ...bp.cards[0], slug: "dollhouse", buildType: "dollhouse", title: "Dollhouse", examplePrompt: "cardboard dollhouse 12 wide 16 tall", count: 0 });
  assert.ok(feedViolations(bad, undefined, graded).some((v) => /dollhouse: not graded by Critic, in popular/.test(v)));
});

// I-draw (Chief 10-23, /workspace/ideas-review/REPORT.md): 25 of 82 live cards painted no image, a grey title stand-in.
// The fixture is the 10-23 live snapshot as /api/ideas-snapshot now serves it (publicSnapshot): no typed prompt, so the
// feed's rows get an empty prompt and the engine key back from the build type. liveFeed never reads the prompt for a card.
const PUB = LIVE_SNAP as unknown as PublicSnapshot;
const snapRows = (rs: PublicRow[]): SnapshotRow[] => rs.map((r, i) => ({ key: `p${i}`, prompt: "", resultKey: `${r.recipe ? "recipe" : "builtin"}:${r.buildType}`, size: r.size, status: r.status, count: r.count, lastSeen: r.lastSeen }));
const live: IdeasSnapshot = { ...PUB, rows: snapRows(PUB.rows), popular: snapRows(PUB.popular), recent: snapRows(PUB.recent) };

test("privacy: /api/ideas-snapshot and its saved fixture carry engine build types, titles, sizes and counts, never typed words", () => {
  const typed = ["my nan's 3 legged bird table", "shoe rack 30 wide"];
  const raw: IdeasSnapshot = { ...SNAP, rows: [...SNAP.rows, row(typed[0], "builtin:bird-feeder", 3, after(5)), row(typed[1], "builtin:shoe-rack", 2, after(6))] };
  const pub = publicSnapshot({ ...raw, popular: raw.rows, recent: raw.rows });
  const KEYS = ["buildType", "count", "lastSeen", "recipe", "size", "status", "title"];
  for (const snap of [pub, PUB]) {
    for (const r of [...snap.rows, ...snap.popular, ...snap.recent]) assert.deepEqual(Object.keys(r).sort(), KEYS, JSON.stringify(r));
    const body = JSON.stringify(snap).toLowerCase();
    // Every typed prompt with a size in it (titles never carry digits) and the two above.
    for (const t of [...typed, ...raw.rows.map((r) => r.prompt.toLowerCase()).filter((p) => /\d/.test(p))]) assert.ok(!body.includes(t), `"${t}" served`);
  }
  assert.ok(pub.rows.some((r) => r.buildType === "bird-feeder" && r.title === "Bird feeder"));
  // Rows the feed skips (test traffic, failed and unknown nouns) are not served either: same rule, isTestRow.
  assert.equal(pub.rows.length, raw.rows.filter((r) => !isTestRow(r)).length);
  // The build type is a fixed point of typeKey, so the fixture's rows group exactly as the store's did.
  for (const r of PUB.rows) assert.equal(typeKey(`builtin:${r.buildType}`), r.buildType);
  assert.match(fs.readFileSync("src/routes/api/ideas-snapshot.ts", "utf8"), /Response\.json\(publicSnapshot\(snap\),/);
});
const liveBase = curatedFeed(RECIPES);
const liveF = liveFeed(live, liveBase, new Date(live.at));

test("I-draw on the saved live snapshot (main 48460cc, 10-23): every card the feed shows paints its own baked drawing", () => {
  const cards = liveF.sections.flatMap((s) => s.cards.map((c) => ({ s: s.id, c })));
  assert.ok(cards.length > 40, `only ${cards.length} cards`);
  for (const { s, c } of cards) {
    assert.ok(c.drawing, `${c.slug} in ${s} has no drawing`);
    assert.ok(fs.existsSync(path.join("public", c.drawing!.src)), `${c.slug}: ${c.drawing!.src} is not baked`);
  }
  assert.deepEqual(feedViolations(liveF, live, gradedTypes(liveBase)), []);
  // The live blanks are gone: no undrawn log type takes a slot (they were soccer goal, rocket, dollhouse, cat tree…).
  for (const t of ["soccer-goal", "rocket", "dollhouse", "cat-tree", "toolbox", "pine-toolbox", "cedar-birdhouse", "pantry-cabinet", "corner-shelf"]) assert.ok(!cards.some(({ c }) => c.buildType === t), t);
  // Row 168: "Corner shelf" shows once (the log's corner-shelf rows count on the drawn Corner shelf card), and no two cards share a title.
  const titles = cards.map(({ c }) => c.title.toLowerCase());
  assert.equal(titles.filter((t) => t === "corner shelf").length, 1);
  assert.deepEqual(titles.filter((t, i) => titles.indexOf(t) !== i), []);
  const corner = cards.find(({ c }) => c.slug === "corner")!.c;
  assert.equal(corner.count, groupRows(live.rows).find((g) => g.type === "corner-bookshelf")!.count);
});

test("I-draw guard: feedViolations names a shown card with no drawing, by section", () => {
  const bad: IdeasFeed = JSON.parse(JSON.stringify(liveF));
  const r = bad.sections.find((s) => s.id === "recent")!;
  r.cards[0] = { ...r.cards[0], drawing: null };
  assert.ok(feedViolations(bad).includes(`${r.cards[0].slug}: no drawing in recent`), feedViolations(bad).join("\n"));
  // And liveFeed itself never shows one: with no drawings at all, only curated (baked) cards are left.
  const none = liveFeed(live, liveBase, new Date(live.at), TEST_CUTOFF, () => null);
  for (const s of none.sections) for (const c of s.cards) assert.ok(c.drawing && liveBase.sections.some((b) => b.cards.some((x) => x.slug === c.slug)), `${c.slug} in ${s.id}`);
  assert.deepEqual(feedViolations(none), []);
});

const pieces = (prompt: string) => [...new Set((generateFromPrompt(prompt) as { panels: { name: string }[] }).panels.map((p) => p.name.replace(/\s*\d+$|\s*\([^)]*\)$/g, "")))].sort();

test("one log type per drawn build: a leading lumber species is the stock (pine toolbox = toolbox), and each drawn twin builds the same pieces", () => {
  assert.equal(typeKey("builtin:pine-toolbo"), "toolbox");
  assert.equal(typeKey("builtin:cedar-birdhouse"), "birdhouse");
  assert.equal(typeKey("builtin:walnut-spice-rack"), "spice-rack");
  assert.equal(typeKey("recipe:cedar-planter-bo"), "planter-box");
  assert.equal(typeKey("builtin:cedar"), "cedar");
  // A species-keyed build and the plain build of each type build the same pieces (Yard's prompts; the fixture keeps no typed ones).
  for (const [w, bare] of [["pine 1x6 toolbox 22 long", "1x6 toolbox 22 long"], ["cedar 1x6 birdhouse 8 wide 10 tall", "1x6 birdhouse 8 wide 10 tall"]]) assert.deepEqual(pieces(w), pieces(bare), w);
  assert.deepEqual(pieces("walnut nightstand"), pieces("nightstand"));
  // A type keys straight to the drawing baked for a card of that engine type (types.json), curated or not.
  assert.equal(drawingForType("jar-rack")?.src.split("/").pop()?.split(".")[0], "jarshelf");
  assert.equal(drawingForType("soccer-goal"), null);
  // typeTwins.json: data next to drawings.json. Each key is an undrawn log type, each target a drawn type, same pieces.
  for (const [from, to] of Object.entries(TWINS as Record<string, string>)) {
    assert.equal(typeKey(`builtin:${from}`), to, from);
    assert.equal(drawingFor(from), null, `${from} has its own drawing`);
    assert.ok(drawingForType(to), `${to} is not drawn`);
    const card = liveBase.sections.flatMap((s) => s.cards).find((c) => c.buildType === to) ?? null;
    const prompt = card?.examplePrompt ?? Object.entries(TYPES as Record<string, string>).find(([, t]) => t === to)![0];
    // The twin key's own words at the twin card's logged size (the snapshot keeps no typed prompt to replay).
    const size = PUB.rows.filter((r) => r.buildType === to).sort((a, b) => b.count - a.count)[0]?.size;
    const twin = logCardPrompt(from, dimsOf(size ?? ""));
    assert.deepEqual(pieces(twin), pieces(prompt), `${from} ("${twin}") → ${to} ("${prompt}")`);
  }
  // Not a twin: a spice cabinet has a door and no jar lips, so it is not the Spice rack.
  assert.notDeepEqual(pieces("spice cabinet"), pieces("spice rack 18 wide 24 high 4 deep"));
});
