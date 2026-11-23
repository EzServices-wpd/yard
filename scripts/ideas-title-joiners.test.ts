/**
 * Ideas titles come from the build page's header name, not a result key with its numbers stripped
 * ("step-stool-with-2-steps" used to title "Step stool with"). A title never ends on a joining word.
 * A renamed slug keeps the old one as an alias so a drawing or lookup under it still resolves.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { curatedFeed, drawingFor, endsOnJoiner, resolveIdeaSlug, titleFromHeader, titleHasMeasure, type IdeaCard } from "../src/lib/ideas/feed";
import { TEST_CUTOFF, feedViolations, liveFeed, publicRows, type PublicSnapshot } from "../src/lib/ideas/liveFeed";
import RECIPES from "../src/lib/ideas/recipes.json";
import LIVE23 from "./fixtures/ideas-snapshot-2026-10-23.json";
import LIVE25 from "./fixtures/ideas-snapshot-2026-10-25.json";
import type { IdeasSnapshot, SnapshotRow } from "../src/lib/yard/ideaLog";

const JOIN = ["with", "and", "of", "for", "to", "in", "on", "a", "an", "the", "from", "by", "into", "at", "or"];

function snapOf(pub: PublicSnapshot): IdeasSnapshot {
  const rows = (rs: PublicSnapshot["rows"]): SnapshotRow[] => rs.map((r, i) => ({
    key: `p${i}`, prompt: "", resultKey: `${r.recipe ? "recipe" : "builtin"}:${r.buildType}`, size: r.size, status: r.status, count: r.count, lastSeen: r.lastSeen,
  }));
  return { ...pub, rows: rows(pub.rows), popular: rows(pub.popular), recent: rows(pub.recent) };
}

function cardsOf(feed: { sections: { cards: IdeaCard[] }[]; all?: IdeaCard[] }): IdeaCard[] {
  return [...new Map([...feed.sections.flatMap((s) => s.cards), ...(feed.all ?? [])].map((c) => [c.buildType, c])).values()];
}

function dangling(cards: Pick<IdeaCard, "slug" | "title">[]): string[] {
  return cards.filter((c) => endsOnJoiner(c.title)).map((c) => `${c.slug}: ${c.title}`);
}

const base = curatedFeed(RECIPES);
const feeds = [LIVE23, LIVE25].map((pub) => {
  const snap = snapOf(pub as unknown as PublicSnapshot);
  return { snap, feed: liveFeed(snap, base, new Date(snap.at)) };
});

test("no Ideas title ends on a joining word, on the curated feed or either saved snapshot", () => {
  assert.deepEqual(dangling(cardsOf(base)), []);
  for (const { snap, feed } of feeds) {
    assert.deepEqual(dangling(cardsOf(feed)), [], feed.at);
    assert.deepEqual(dangling(publicRows(snap.rows)), []);
    assert.deepEqual(feedViolations(feed, snap).filter((v) => /joining word/.test(v)), []);
  }
  for (const word of JOIN) assert.equal(endsOnJoiner(`Step stool ${word}`), true, word);
  assert.equal(endsOnJoiner("Step stool, 2 steps"), false);
  assert.equal(endsOnJoiner("Coat rack with bench"), false);
});

test("no Ideas title carries a size or measurement; a count is not one", () => {
  const measured = (cards: Pick<IdeaCard, "slug" | "title">[]) => cards.filter((c) => titleHasMeasure(c.title)).map((c) => `${c.slug}: ${c.title}`);
  assert.deepEqual(measured(cardsOf(base)), []);
  for (const { snap, feed } of feeds) {
    assert.deepEqual(measured(cardsOf(feed)), [], feed.at);
    assert.deepEqual(measured(publicRows(snap.rows)), []);
    assert.deepEqual(feedViolations(feed, snap).filter((v) => /carries a size/.test(v)), []);
  }
  assert.equal(titleFromHeader("Step stool with 2 steps"), "Step stool, 2 steps");
  assert.equal(titleFromHeader("Picnic table 5' 3\" x 29\" tall"), "Picnic table");
  assert.equal(titleFromHeader("Swing set 1' beam x 1' tall"), "Swing set");
  assert.equal(titleFromHeader("Cardboard robot 18\" tall"), "Cardboard robot");
  assert.equal(titleFromHeader("L-shaped corner desk 60\" x 48\" · 30\" tall"), "L-shaped corner desk");
  assert.equal(titleFromHeader("Platform bed 39\" long x 82\" wide x 75\" tall"), "Platform bed");
  assert.equal(titleFromHeader("PVC Soccer Goal"), "PVC Soccer Goal");
  assert.equal(titleFromHeader("2×4 ladder"), "Ladder");
  assert.equal(titleHasMeasure("Step stool, 2 steps"), false);
  assert.equal(titleHasMeasure("Round 3-leg table"), false);
  assert.equal(titleHasMeasure("2×4 ladder"), true);
  assert.equal(titleHasMeasure("Picnic table 5' 3\" x 29\" tall"), true);
});

const plainTitle = (k: string) => k.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
/** Log-only cards on the 10-25 snapshot whose header name is not the stripped type key. Slug stays when it still slugifies the same. */
const MOVED: [string, string, string][] = [
  ["bike-rack", "bike-rack", "Bike Rack"],
  ["brooklyn-bridge", "brooklyn-bridge", "Brooklyn Bridge"],
  ["covered-bridge", "covered-bridge", "Covered Bridge"],
  ["empire-state-building", "empire-state-building", "Empire State Building"],
  ["firewood-unit", "firewood-rack", "Firewood rack"],
  ["garden-arch-base-molding", "garden-arch-base-molding", "Garden Arch Base Molding"],
  ["key-holder-wall-mounted", "peg-rail", "Peg rail"],
  ["l-shaped-corner-desk", "l-shaped-corner-desk", "L-shaped corner desk"],
  ["shelf", "shelf-unit", "Shelf unit"],
  ["soccer-goal", "pvc-soccer-goal", "PVC Soccer Goal"],
  ["space-needle", "space-needle", "Space Needle"],
  ["white-house", "white-house", "White House"],
];

test("log-only titles that are not the stripped type key use the header name, and the old slug still resolves", () => {
  const authored = new Set(base.sections.flatMap((s) => s.cards.map((c) => c.buildType)));
  const feed = feeds[1].feed;
  const moved = cardsOf(feed)
    .filter((c) => !authored.has(c.buildType) && (c.title !== plainTitle(c.buildType) || c.slug !== c.buildType))
    .map((c) => [c.buildType, c.slug, c.title] as [string, string, string])
    .sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(moved, MOVED);
  for (const [type, slug] of MOVED) {
    assert.equal(resolveIdeaSlug(type), slug, type);
    assert.equal(drawingFor(type)?.src ?? null, drawingFor(slug)?.src ?? null, type);
    if (slug !== type) assert.deepEqual(cardsOf(feed).find((c) => c.buildType === type)?.aliases, [type]);
  }
  // A generic stand-in header does not rename the card (a sailboat is not a Storage unit).
  const sail = cardsOf(feed).find((c) => c.buildType === "sailboat");
  assert.equal(sail?.title, "Sailboat");
  assert.equal(sail?.slug, "sailboat");
  // Authored titles and their slugs stay. Linen is not "Linen".
  const linen = cardsOf(feed).find((c) => c.buildType === "linen");
  assert.equal(linen?.title, "Linen closet");
  assert.equal(linen?.slug, "linen");
  assert.equal(linen?.aliases, undefined);
});

test("a step-stool result key stripped down to 'with' titles the header name, and the old slug resolves", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  const lastSeen = new Date(Date.parse(TEST_CUTOFF) + 3_600_000).toISOString();
  const prompt = "my nan's step stool with the wobbly leg";
  const snap: IdeasSnapshot = {
    at: now.toISOString(), live: true, popular: [], recent: [],
    rows: [{ key: "k", prompt, size: "16×22×18", resultKey: "builtin:step-stool-with-2-steps", status: "Trusted", count: 4, lastSeen }],
  };
  const feed = liveFeed(snap, base, now);
  const card = cardsOf(feed).find((c) => c.buildType === "step-stool-with");
  assert.ok(card, "step stool card");
  assert.equal(card.title, "Step stool, 2 steps");
  assert.equal(card.slug, "step-stool-2-steps");
  assert.deepEqual(card.aliases, ["step-stool-with"]);
  assert.equal(card.examplePrompt, "step stool with 16 wide 18 tall 22 deep");
  assert.equal(resolveIdeaSlug("step-stool-with"), "step-stool-2-steps");
  assert.equal(publicRows(snap.rows).find((r) => r.buildType === "step-stool-with")?.title, "Step stool, 2 steps");
  assert.equal(titleHasMeasure(card.title), false);
  const body = JSON.stringify({ feed, rows: publicRows(snap.rows) }).toLowerCase();
  assert.equal(body.includes(prompt), false);
  assert.equal(endsOnJoiner(card.title), false);
});
