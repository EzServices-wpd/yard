/**
 * Ideas quick wins (Growth's Ideas review, Chief's Direction A PR 1): cards are links, search finds what visitors type,
 * one canonical per page, and the nav landmarks are labelled. Tested at the page's own markup and the route heads' sources.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IdeasPageView } from "../src/components/ideas/IdeasPageView";
import { curatedFeed, searchCards, searchPool } from "../src/lib/ideas/feed";
import RECIPES from "../src/lib/ideas/recipes.json";

const feed = curatedFeed(RECIPES);
const pool = searchPool(feed);
const page = (incoming: string, flags = {}) =>
  renderToStaticMarkup(createElement(IdeasPageView, { incoming, learned: [], onBuild: () => {}, feed, flags } as never)).replace(/&amp;/g, "&");
const titles = (q: string) => searchCards(pool, q).map((c) => c.title);

test("every idea card is a real link to its own build URL, test flags included", () => {
  for (const [q, flags, tail] of [["", {}, ""], ["", { offline: 1, test: 1 }, "&offline=1&test=1"], ["shelf", { local: 1 }, "&local=1"]] as const) {
    const html = page(q, flags);
    const cards = [...html.matchAll(/<(\w+)\b([^>]*)\sdata-idea="([^"]+)"/g)];
    assert.ok(cards.length >= 8, `${q || "page"}: ${cards.length} cards`);
    for (const [, tag, attrs, slug] of cards) {
      assert.equal(tag, "a", `${slug} is a <${tag}>, not a link`);
      const href = attrs.match(/href="([^"]+)"/)?.[1] ?? "";
      const card = pool.find((c) => c.slug === slug)!;
      assert.equal(href, `/workspace?${new URLSearchParams({ q: card.examplePrompt })}${tail}`, slug);
    }
    // 12a: the featured row replaced the hero; its cards are links like every other (checked above), Eiffel first.
    if (!q) assert.match(html, /data-ideas-featured[^>]*>.*?<a href="\/workspace\?q=[^"]+"[^>]*data-idea="eiffel"/, "the featured row leads with a link");
  }
});

test("search finds what visitors type: bookshelf, kid, toy chest, beginner, cheap", () => {
  assert.equal(titles("bookshelf")[0], "Bookcase", "the placeholder's own first word finds Bookcase first");
  assert.equal(titles("bookshelves")[0], "Bookcase");
  for (const q of ["kid", "kids"]) {
    const t = titles(q);
    assert.ok(t.includes("Bunk bed") && t.some((x) => /popsicle/i.test(x)), `${q}: ${t}`);
  }
  // No card is a toy chest; the free plan page is, so search links it (and "kid" reaches it through "toys").
  for (const q of ["toy chest", "kid"]) assert.match(page(q), /<a href="\/plans\/toy-chest"/, q);
  assert.doesNotMatch(page("bookcase"), /href="\/plans\/bookcase"/, "a plan whose build a card already is stays out");
  for (const q of ["beginner", "cheap"]) {
    const hits = searchCards(pool, q);
    assert.ok(hits.length >= 5, `${q}: ${hits.length}`);
    for (const c of hits) {
      const d = c.drawing!.dims!;
      assert.ok(c.drawing!.parts <= 12 && Math.max(d.width, d.height, d.depth) <= 24, `${q} → ${c.title} (${c.drawing!.parts} parts)`);
    }
  }
  assert.equal(titles("zzqx").length, 0);
  assert.equal(titles("linen")[0], "Linen closet", "plain words still rank as before");
});

test("the alias table stays small, needed and pointed at real words", async () => {
  const { SEARCH_ALIASES } = await import("../src/lib/ideas/feed");
  const { PLANS } = await import("../src/lib/yard/plans");
  assert.ok(Object.keys(SEARCH_ALIASES).length <= 8);
  const words = (s: string) => s.toLowerCase().split(/[^a-z]+/);
  const said = new Set([...pool.flatMap((c) => words(`${c.title} ${c.examplePrompt} ${c.stock ?? ""} ${c.blurb ?? ""}`)), ...PLANS.flatMap((p) => words(`${p.name} ${p.blurb}`))]);
  for (const [k, to] of Object.entries(SEARCH_ALIASES)) {
    assert.ok(!pool.some((c) => words(c.title).includes(k)), `${k}: a card title already says it, drop the alias`);
    for (const w of to) assert.ok(w === "smallbuild" || said.has(w) || said.has(`${w}s`), `${k} → ${w}: no card or plan says "${w}"`);
  }
});

const SRC = (f: string) => fs.readFileSync(f, "utf8");
const routes = (dir = "src/routes"): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "api" ? [] : routes(path.join(dir, e.name))) : e.name.endsWith(".tsx") ? [path.join(dir, e.name)] : []));

test("one canonical per page: the root sets none, each page route sets its own once, absolute and equal to og:url", async () => {
  const root = SRC("src/routes/__root.tsx");
  assert.doesNotMatch(root, /rel: "canonical"/, "the root's canonical was every page's second one");
  assert.doesNotMatch(root, /"og:url"/, "the root's og:url said / on every page");
  for (const f of routes()) {
    const n = (SRC(f).match(/rel: "canonical"|canonical\(/g) ?? []).length;
    assert.ok(n <= 2, `${f}: ${n} canonical sources`);
  }
  for (const f of ["src/routes/index.tsx", "src/routes/ideas.tsx", "src/routes/workspace.tsx"]) assert.match(SRC(f), /canonical\(/, f);
  const { canonical, workbenchPath, SITE } = await import("../src/lib/canonical");
  const c = canonical("/ideas");
  assert.equal(SITE, "https://yard.wiki");
  assert.deepEqual([c.meta[0].content, c.links[0].href], ["https://yard.wiki/ideas", "https://yard.wiki/ideas"]);
  // A card's link is the canonical of the page it opens; a shared build's canonical is its share link, byte for byte.
  const { buildHref } = await import("../src/lib/ideas/feed");
  for (const q of ["bookcase 36 wide 72 tall 12 deep", "3 foot Eiffel Tower from popsicle sticks", `shelf 12" & more`]) assert.equal(workbenchPath({ q }), buildHref(q));
  const { shareUrl } = await import("../src/lib/yard/shareBuild");
  const payload = { prompt: "bookcase 36 wide 72 tall 12 deep", measure: {}, stockId: "plywood-3-4" } as never;
  const y = shareUrl(payload).split("?y=")[1];
  assert.equal(SITE + workbenchPath({ y, q: "ignored" }), shareUrl(payload));
  assert.equal(workbenchPath({}), "/workspace");
});

test("every nav landmark has a label, and the labels on one page differ", () => {
  const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith(".tsx") ? [path.join(dir, e.name)] : []));
  for (const f of files("src")) for (const m of SRC(f).matchAll(/<nav\b[^>]*>/g)) assert.match(m[0], /aria-label="[^"]+"/, `${f}: ${m[0]}`);
  const label = (f: string) => [...SRC(f).matchAll(/<nav\b[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);
  // Ideas, plans, about, privacy, terms: SiteChrome's header and footer. Home: its own header, Free plans, SiteFooter.
  for (const set of [label("src/components/site/chrome.tsx"), [...label("src/routes/index.tsx"), "Footer"]]) assert.equal(new Set(set).size, set.length, String(set));
});

test("the empty line says 'No saved idea yet.' only when search found nothing at all, not above a plan link", () => {
  const plan = page("toy chest");
  assert.match(plan, /href="\/plans\/toy-chest"/);
  assert.doesNotMatch(plan, /No saved idea yet/);
  assert.match(page("zzqx"), /No saved idea yet\./);
  // The count line names the hits the page shows (#162: one card per build type, so "Too small for books" no longer
  // rides along with the corner shelf; the number comes from the same pool, not a constant).
  const n = searchCards(pool, "bookshelf").length;
  assert.ok(n >= 2, `bookshelf: ${n} hits, the plural line needs 2+`);
  assert.match(page("bookshelf"), new RegExp(`>${n} ideas\\. Enter opens the first\\.<`));
});

test("a typed build (?q=) and a ?y= share link (the sharer's prompt) are noindex,follow; the bare workbench stays indexable", async () => {
  const { workbenchRobots } = await import("../src/lib/canonical");
  assert.deepEqual(workbenchRobots({ q: "bookcase 36 wide" }), [{ name: "robots", content: "noindex,follow" }]);
  for (const s of [{ y: "eyJwcm9tcHQiOiJ4In0" }, { y: "eyJwcm9tcHQiOiJ4In0", q: "x" }, { y: "eyJwcm9tcHQiOiJ4In0", q: "  " }])
    assert.deepEqual(workbenchRobots(s), [{ name: "robots", content: "noindex,follow" }], JSON.stringify(s));
  for (const s of [{}, { q: "  " }, { y: "" }, { y: " " }, { y: " ", q: "  " }]) assert.deepEqual(workbenchRobots(s), [], JSON.stringify(s));
  assert.match(SRC("src/routes/workspace.tsx"), /workbenchRobots\(/, "the route head (server HTML) carries it");
});
