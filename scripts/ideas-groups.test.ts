/**
 * Ideas 12a (Ezra via Chief, 10-26): the page explores builds by kind. Seams: groups.ts on the saved 10-25 snapshot's
 * catalog and the fallback feed, and the Ideas page's server markup. Expected numbers come from the snapshot rows and
 * Chief's picks, not from groupCards.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IdeasPageView } from "../src/components/ideas/IdeasPageView";
import { ALL_SHOW, SECTION_SHOW, curatedFeed, drawingForType, type IdeasFeed } from "../src/lib/ideas/feed";
import { FEATURED, GROUPS, groupCards, groupOf, groupView, stockOf, withStock } from "../src/lib/ideas/groups";
import { liveFeed, type PublicSnapshot } from "../src/lib/ideas/liveFeed";
import RECIPES from "../src/lib/ideas/recipes.json";
import LIVE from "./fixtures/ideas-snapshot-2026-10-25.json";
import type { IdeasSnapshot, SnapshotRow } from "../src/lib/yard/ideaLog";

const PUB = LIVE as unknown as PublicSnapshot;
const rows = (rs: PublicSnapshot["rows"]): SnapshotRow[] => rs.map((r, i) => ({ key: `p${i}`, prompt: "", resultKey: `${r.recipe ? "recipe" : "builtin"}:${r.buildType}`, size: r.size, status: r.status, count: r.count, lastSeen: r.lastSeen }));
const snap: IdeasSnapshot = { ...PUB, rows: rows(PUB.rows), popular: rows(PUB.popular), recent: rows(PUB.recent) };
const base = curatedFeed(RECIPES);
const feed = liveFeed(snap, base, new Date(snap.at));
const all = feed.all ?? [];
const page = (f: IdeasFeed) => renderToStaticMarkup(createElement(IdeasPageView, { incoming: "", learned: [], onBuild: () => {}, feed: f })).replace(/&amp;/g, "&");
const unmapped = (types: string[]) => types.filter((t) => !groupOf(t));

test("every listed build type is in exactly one group; a type no group names fails here", () => {
  const named = GROUPS.flatMap((g) => g.types.split(" "));
  assert.deepEqual(named.filter((t, i) => named.indexOf(t) !== i), [], "a type in two groups");
  assert.deepEqual(unmapped(all.map((c) => c.buildType)), [], "live catalog");
  assert.deepEqual(unmapped(base.sections.flatMap((s) => s.cards.map((c) => c.buildType))), [], "fallback feed");
  assert.deepEqual(unmapped(["zz-new-type"]), ["zz-new-type"]);
  // Chief's placements (10-26): cat tree and shelf are furniture, the arch's base molding is a weekend project.
  assert.deepEqual(["cat-tree", "shelf", "garden-arch-base-molding", "eiffel-tower", "abacus"].map(groupOf), ["furniture", "furniture", "weekend", "landmarks", "toys"]);
  // Every catalog card shows once across the groups (cards plus See all rows): 100 types on 10-25.
  const seen = groupCards(all).flatMap((g) => { const v = groupView(g.cards, true, Infinity); return [...v.top, ...v.rows].map((c) => c.buildType); });
  assert.deepEqual([seen.length, new Set(seen).size], [all.length, all.length]);
  assert.equal(all.length, 100);
});

test("a type no group names is never hidden: it lands in More builds as a row, its New mark kept", () => {
  const stray = { ...all.find((c) => c.buildType === "soccer-goal")!, slug: "zz-new-type", buildType: "zz-new-type", title: "Zz stool" };
  const html = page({ ...feed, all: [...all, stray] });
  const more = html.slice(html.indexOf('data-ideas-group="more"'));
  assert.match(more, /<h2 id="ideas-more"[^>]*>More builds<\/h2>/);
  assert.match(more, /data-idea-row="zz-new-type"[^>]*>.*?Zz stool.*?New, not checked yet/);
});

test("featured: Chief's five, checked and drawn, first drawing eager and every other lazy; no flat All ideas list", () => {
  const html = page(feed);
  assert.match(html, /<h1[^>]*>Pick a build\. See how it goes together\.<\/h1>/);
  const sec = html.slice(html.indexOf("data-ideas-featured"), html.indexOf("data-ideas-group="));
  assert.deepEqual([...sec.matchAll(/data-idea="([^"]+)"/g)].map((m) => m[1]), ["eiffel", "pocket", "bridge", "recipe-abacus", "bunk"]);
  assert.equal(FEATURED.length, 5);
  // Two <img> per drawing (pencil and wood): only the first featured card's pair loads eagerly.
  assert.equal((html.match(/loading="eager"/g) ?? []).length, 2);
  assert.ok((html.match(/loading="lazy"/g) ?? []).length > 40);
  assert.ok(!/id="ideas-all"|>All ideas</.test(html), "the flat list is gone");
  assert.ok(!/data-ideas-hero|\/ideas\/models\//.test(html), "no 3D model file on the page");
  assert.ok(!/\$\s?\d|price/i.test(html.replace(/<[^>]+>/g, " ")), "no price on Ideas");
  // Critic 2 (#186, 10-27): the baked drawing.parts disagreed with the card's own build on 11 of 56 cards (bookcase 10 vs
  // 16), so cards print no part count. Follow-up: re-bake drawings.json and test parts == the engine's pieces per card.
  assert.doesNotMatch(html.replace(/<[^>]+>/g, " "), /\d+ parts\b/);
  assert.doesNotMatch(html, /data-parts=/);
});

test("groups: a heading each, in order, content-visibility, See all says the group's whole count and controls its rows", () => {
  const html = page(feed);
  const want: [string, string][] = [["furniture", "Furniture"], ["landmarks", "Landmarks and models"], ["weekend", "Weekend projects"], ["toys", "Toys and games"], ["crafts", "Crafts"]];
  assert.deepEqual([...html.matchAll(/data-ideas-group="([^"]+)" aria-labelledby="ideas-\1"><div[^>]*><h2 id="ideas-\1"[^>]*>([^<]+)<\/h2>/g)].map((m) => [m[1], m[2]]), want);
  assert.equal((html.match(/content-visibility:auto/g) ?? []).length, want.length);
  for (const [id, title] of want) {
    const n = all.filter((c) => groupOf(c.buildType) === id).length;
    const btn = html.match(new RegExp(`<button[^>]*aria-controls="ideas-${id}-all"[^>]*>(.*?)</button>`));
    assert.ok(btn, `${id}: See all`);
    assert.match(btn[0], /aria-expanded="false"/);
    assert.equal(btn[1].replace(/<[^>]+>/g, ""), `See all ${n} ${title}`);
  }
  // Closed, no group prints rows (every group here has a drawn card); the furniture chip is a toggle button.
  assert.ok(!html.includes("data-idea-row="));
  assert.match(html, /<button type="button" aria-pressed="false" data-ideas-sub="Fitted to a hole"/);
});

test("See all opens in place: SECTION_SHOW drawn cards, then the rest as rows ALL_SHOW at a time", () => {
  const furniture = groupCards(all).find((g) => g.id === "furniture")!.cards;
  const drawn = furniture.filter((c) => c.drawing).length;
  // 58 furniture types on 10-25; how many are drawn follows the manifest (cat tree drawn 10-27), at least SECTION_SHOW.
  assert.deepEqual([furniture.length, drawn], [58, furniture.filter((c) => drawingForType(c.buildType)).length]);
  assert.ok(drawn >= SECTION_SHOW);
  const shut = groupView(furniture, false, ALL_SHOW);
  assert.deepEqual([shut.top.length, shut.rows.length, shut.button, shut.label], [SECTION_SHOW, 0, true, "See all 58"]);
  assert.ok(shut.top.every((c) => c.drawing), "cards are drawn; undrawn types wait in the rows");
  const open = groupView(furniture, true, ALL_SHOW);
  assert.deepEqual([open.rows.length, open.left, open.shown], [ALL_SHOW, 58 - SECTION_SHOW - ALL_SHOW, SECTION_SHOW + ALL_SHOW]);
  const more = groupView(furniture, true, 3 * ALL_SHOW);
  assert.deepEqual([more.rows.length, more.left, more.shown], [58 - SECTION_SHOW, 0, 58]);
  // Toys: 11 types. Yard Design keeps drawing more (rocket, viking ship on 10-26/27), so the cards are exactly the toys the
  // drawings manifest has (drawingForType, read here, not the page) and the rest are rows; abacus and catapult always draw.
  const toyCards = groupCards(all).find((g) => g.id === "toys")!.cards;
  const drawnToys = toyCards.filter((c) => drawingForType(c.buildType)).map((c) => c.buildType).sort();
  const toys = groupView(toyCards, true, ALL_SHOW);
  assert.ok(drawnToys.includes("abacus") && drawnToys.includes("catapult"));
  assert.deepEqual([toys.top.map((c) => c.buildType).sort(), toys.rows.length], [drawnToys, 11 - drawnToys.length]);
  assert.ok(toys.rows.some((c) => c.buildType === "soccer-goal" && c.status === "new"));
});

test("stock chips: only stocks the feed names, and a chip keeps only its cards", () => {
  const html = page(feed);
  const chips = [...html.matchAll(/aria-pressed="(true|false)" data-ideas-stock="([^"]+)"/g)].map((m) => [m[2], m[1]]);
  assert.deepEqual(chips[0], ["all", "true"]);
  assert.deepEqual(new Set(chips.slice(1).map((c) => c[0])), new Set(["1×6", "2×4", "Popsicle sticks", "¾″ PVC", "Jumbo craft sticks", "Bamboo skewers", "Drinking straws", "2× lumber"]));
  assert.ok(chips.slice(1).every((c) => c[1] === "false"));
  // The window card's note is what it is for, not a stock.
  assert.equal(stockOf({ stock: "for a 36 × 48 double-hung" }), null);
  assert.deepEqual(withStock(all, "Popsicle sticks").map((c) => c.buildType), ["eiffel-tower", "catapult", "dog"]);
  assert.deepEqual(withStock(all, "Drinking straws").map((c) => c.buildType), ["bridge"]);
  assert.equal(withStock(all, null).length, all.length);
});
