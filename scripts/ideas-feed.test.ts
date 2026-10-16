import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { SECTION_SHOW, buildTypeOf, byCount, curatedFeed, dedupe, searchCards, searchPool, type IdeaCard } from "../src/lib/ideas/feed";
import RECIPES from "../src/lib/ideas/recipes.json";

const feed = curatedFeed(RECIPES);
const cards = feed.sections.flatMap((s) => s.cards);

test("no build type (or slug) appears twice on the Ideas page", () => {
  const types = cards.map((c) => c.buildType);
  const slugs = cards.map((c) => c.slug);
  assert.equal(new Set(types).size, types.length, `duplicate build types: ${types.filter((t, i) => types.indexOf(t) !== i)}`);
  assert.equal(new Set(slugs).size, slugs.length);
});

test("dedupe folds a later card of the same build type (first section wins)", () => {
  const mk = (slug: string, prompt: string): IdeaCard => ({ slug, buildType: buildTypeOf(prompt), title: slug, count: 0, lastSeen: null, examplePrompt: prompt, recipeKey: null, dims: null, size: "", status: "checked", section: "x", drawing: null });
  const out = dedupe([
    { id: "a", title: "A", order: 0, total: 2, cards: [mk("linen", "linen closet 31.5 wide 78 tall 16 deep"), mk("desk", "desk 60 wide")] },
    { id: "b", title: "B", order: 1, total: 2, cards: [mk("linen2", "linen closet 30 wide 80 tall 16 deep"), mk("bench", "bench 48 long")] },
  ]);
  assert.deepEqual(out.map((s) => s.cards.map((c) => c.slug)), [["linen", "desk"], ["bench"]]);
  assert.equal(out[1].total, 1);
});

test("cards order by real build count, source order on ties", () => {
  const c = (slug: string, count: number) => ({ slug, count }) as IdeaCard;
  assert.deepEqual(byCount([c("a", 1), c("b", 9), c("c", 1), c("d", 0)]).map((x) => x.slug), ["b", "a", "c", "d"]);
});

test("every card has a baked drawing file, and counts stay hidden until SWE's filter is live", () => {
  assert.equal(feed.countsLive, false);
  for (const c of cards) {
    assert.ok(c.drawing, `${c.slug} has no drawing`);
    for (const f of [c.drawing.src]) assert.ok(fs.existsSync(path.join("public", f)), f);
  }
});

test("sections show at most 8 cards before Show all", () => {
  assert.ok(SECTION_SHOW >= 6 && SECTION_SHOW <= 8);
  assert.ok(feed.sections.every((s) => s.total === s.cards.length));
});

test("search: top match first; no match leaves the Build row as the only action", () => {
  const pool = searchPool(feed);
  assert.equal(searchCards(pool, "linen")[0]?.slug, "linen");
  assert.equal(searchCards(pool, "zzqx").length, 0);
  assert.ok(searchCards(pool, "ironing").length > 0, "near-variants still reachable by search");
});

test("test flags ride from Ideas onto the build URL (offline runs never call the AI)", async () => {
  const { pickTestFlags } = await import("../src/lib/ideas/testFlags");
  assert.deepEqual(pickTestFlags("?q=desk&offline=1&test=1&x=2"), { offline: 1, test: 1 });
  assert.deepEqual(pickTestFlags({ local: "1", offline: "0" }), { local: 1 });
  assert.deepEqual(pickTestFlags('?offline=%221%22'), { offline: 1 });
  assert.deepEqual(pickTestFlags(""), {});
});

test("no brand name as a card title; the hero has a baked live model", async () => {
  const { heroCard, HERO_FALLBACK } = await import("../src/lib/ideas/feed");
  assert.ok(!cards.some((c) => /andersen|pella|marvin|ikea|kreg/i.test(c.title)), "brand in a title");
  const hero = heroCard(feed);
  assert.equal(hero?.slug, HERO_FALLBACK);
  assert.ok(hero?.drawing?.model && fs.existsSync(path.join("public", hero.drawing.model)));
});
