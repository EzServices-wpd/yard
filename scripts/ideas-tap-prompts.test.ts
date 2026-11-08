/**
 * Every Ideas card's tap builds the thing the card names (Chief 10-26, from Yard Design's drawing probe): the soccer goal
 * and lighthouse cards built a generic "Storage unit", the Brooklyn bridge 7194 parts at 1731 in wide. Seam: liveFeed's
 * cards on the saved 10-25 snapshot (every section card and every All ideas row), each prompt through the engine, offline.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { curatedFeed } from "../src/lib/ideas/feed";
import { LOG_PROMPT, liveFeed, type PublicSnapshot } from "../src/lib/ideas/liveFeed";
import RECIPES from "../src/lib/ideas/recipes.json";
import LIVE from "./fixtures/ideas-snapshot-2026-10-25.json";
import type { IdeasSnapshot, SnapshotRow } from "../src/lib/yard/ideaLog";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { headerTitle } from "../src/lib/yard/pdf";
import { offline } from "./eval-gate-lib";

const PUB = LIVE as unknown as PublicSnapshot;
const rows = (rs: PublicSnapshot["rows"]): SnapshotRow[] => rs.map((r, i) => ({ key: `p${i}`, prompt: "", resultKey: `${r.recipe ? "recipe" : "builtin"}:${r.buildType}`, size: r.size, status: r.status, count: r.count, lastSeen: r.lastSeen }));
const snap: IdeasSnapshot = { ...PUB, rows: rows(PUB.rows), popular: rows(PUB.popular), recent: rows(PUB.recent) };
const feed = liveFeed(snap, curatedFeed(RECIPES), new Date(snap.at));
const cards = [...new Map([...feed.sections.flatMap((s) => s.cards), ...(feed.all ?? [])].map((c) => [c.slug, c])).values()];

/** Cards whose built name shares no word with the card title: the words the built name says instead. */
const SAYS: Record<string, string[]> = { slope: ["bookcase"], window: ["double hung"], "key-holder-wall-mounted": ["peg rail"] };
/** Title words that name the stock or the room, not the object. */
const NOT_OBJECT = new Set(["popsicle", "straw", "jumbo", "bamboo", "pvc", "the", "with", "for", "under", "and"]);
/** The engine's generic fallback names. */
const GENERIC = /^(?:storage unit|storage|unit|box|thing|planter box)\b/i;
/** A model or a room build, never a 20-foot one or one past this many parts. */
const MAX_IN = 240, MAX_PARTS = 2000;
/**
 * Cards no prompt builds yet (each needs an engine change; listed for SWE on 10-26). Each must still fail below, so an
 * engine fix that makes one build drops it from this list.
 */
const ENGINE_GAP: Record<string, string> = {
  toolbox: "every toolbox prompt is a stand-in box",
  "bike-rack": "a stand-in box (\"from 2x4\": a shelf unit titled Bike unit)",
  "white-house": "a stand-in box (\"from popsicle sticks\": the barn's house body)",
  "mailbox-post": "Storage unit (bare: a 37-in popsicle body; \"from 4x4\": a four-leg frame, no post)",
  sailboat: "Storage unit (bare: a 15-stick hull, no mast or sail)",
};

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length >= 3 && !NOT_OBJECT.has(w));
const stem = (w: string) => w.replace(/(?:es|s)$/, "");

/** Why a card's tap builds something other than the card, or null when it builds the card's object. */
function wrongBuild(c: { slug: string; title: string; examplePrompt: string }): string | null {
  return offline(() => {
    const p = generateFromPrompt(c.examplePrompt);
    const name = headerTitle(p).split(" · ")[0];
    const o = p.overall, parts = buildPlan(p).totals.pieces;
    if (p.refused) return `refused: ${p.refused}`;
    if (p.standIn) return `stand-in "${name}"`;
    if (p.unmatched) return `unmatched body "${name}"`;
    if (GENERIC.test(name) && !GENERIC.test(c.title)) return `generic "${name}"`;
    const built = new Set(words(name).map(stem));
    const want = SAYS[c.slug] ?? words(c.title);
    if (!want.some((w) => w.split(" ").every((x) => built.has(stem(x))))) return `"${name}" is not a ${c.title}`;
    if (Math.max(o.width, o.depth, o.height) > MAX_IN || parts > MAX_PARTS) return `${parts} parts at ${o.width}×${o.depth}×${o.height} in`;
    return null;
  });
}

test("every Ideas card's tap prompt builds the object the card names (no generic, stand-in, refusal or runaway size)", () => {
  assert.ok(cards.length >= 100, `${cards.length} cards`);
  const bad = cards.filter((c) => !(c.buildType in ENGINE_GAP)).map((c) => [c.slug, c.examplePrompt, wrongBuild(c)]).filter((r) => r[2]);
  assert.deepEqual(bad, []);
});

test("the engine-gap cards still build the wrong thing (drop one from ENGINE_GAP once the engine builds it)", () => {
  for (const t of Object.keys(ENGINE_GAP)) {
    const c = cards.find((x) => x.buildType === t);
    assert.ok(c, `${t} is no longer a card`);
    assert.ok(wrongBuild(c), `${t}: "${c.examplePrompt}" builds now`);
  }
});

test("LOG_PROMPT: each fix is used by its card, names no gap, and carries the engine's own W×D×H", () => {
  assert.ok(Object.keys(LOG_PROMPT).length > 0, "LOG_PROMPT is empty");
  for (const [t, { prompt, dims }] of Object.entries(LOG_PROMPT)) {
    const c = cards.find((x) => x.buildType === t);
    assert.equal(c?.examplePrompt, prompt, `${t}: card prompt`);
    assert.ok(!(t in ENGINE_GAP), t);
    const o = offline(() => generateFromPrompt(prompt).overall);
    assert.deepEqual(c!.dims, dims, `${t}: card dims`);
    assert.deepEqual(dims, { width: o.width, depth: o.depth, height: o.height }, `${t}: dims vs engine`);
  }
});

test("the guard catches the 10-26 class: generic, runaway and stand-in taps", () => {
  const card = (slug: string, title: string, examplePrompt: string) => ({ slug, title, examplePrompt });
  assert.match(wrongBuild(card("soccer-goal", "Soccer goal", "soccer goal 48 wide 36 tall 12 deep"))!, /generic "Storage unit/);
  assert.match(wrongBuild(card("lighthouse", "Lighthouse", "lighthouse 8 wide 12 tall 8 deep"))!, /generic "Storage unit/);
  // The 10-26 runaway (1731 5/8" wide) builds its typed 138 1/2" now (bridge cap); a typed tower height still runs past 240".
  assert.equal(wrongBuild(card("brooklyn-bridge", "Brooklyn bridge", "brooklyn bridge 138.5 wide 11.5 tall 6 deep")), null);
  assert.match(wrongBuild(card("brooklyn-bridge", "Brooklyn bridge", "brooklyn bridge 20 tall"))!, /^\d+ parts at 250\.9×/);
  assert.match(wrongBuild(card("firewood-unit", "Firewood unit", "firewood unit"))!, /unmatched body/);
  assert.match(wrongBuild(card("toolbox", "Toolbox", "toolbox 18 wide 18 tall 16 deep"))!, /stand-in/);
  assert.match(wrongBuild(card("bookcase", "Dresser", "bookcase 36 wide 72 tall 12 deep"))!, /is not a Dresser/);
});
