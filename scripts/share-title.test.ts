/**
 * Row 578: a typed or shared build's tab, og and twitter title is the engine's header (the name and size the bench
 * shows), never the typed words ("big ben" was titled 'Big ben · Yard'). No engine title, no build title.
 * Seam: the /workspace route head (canonical.workbenchHead) on the token the route sends to the engine (workbenchToken).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

(globalThis as { window?: unknown }).window = { setTimeout, clearTimeout, atob, btoa, location: { search: "" } };
const { cardFacts } = await import("../src/lib/og/card");
const { engineTitleWithin } = await import("../src/lib/og/budget.server");
const { workbenchHead, workbenchToken } = await import("../src/lib/canonical");
const { curatedFeed } = await import("../src/lib/ideas/feed");
const { CANARIES } = await import("./weekend-canaries");
const { POCKET_DREAM } = await import("../src/lib/yard/pocket");
const RECIPES = (await import("../src/lib/ideas/recipes.json", { with: { type: "json" } })).default;
const { offline } = await import("./eval-gate-lib");

const NO_BUILD = "Workspace · Yard";
const PRIVATE = "toolbox for my wife jane";
const FREEZE = ["linen closet 31.5 wide 78 tall 16 deep", POCKET_DREAM, "bathroom pocket vanity", "andersen 36x48 double hung window", "desk 60 x 30 x 29 with 24 inch knee", "3 foot Eiffel Tower from popsicle sticks"];
const IDEAS = curatedFeed(RECIPES).sections.flatMap((s) => s.cards.map((c) => c.examplePrompt)).filter(Boolean);
const PROMPTS = [...new Set([...FREEZE, ...CANARIES, ...IDEAS, PRIVATE])];
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{3,}/g) ?? []);

/** The head for one URL, and the engine's own header for it (null: the engine names no build for these words). */
function headFor(search: { q?: string; y?: string }) {
  const f = offline(() => cardFacts(workbenchToken(search)));
  return { engine: f ? `${f.name} · ${f.size}` : null, ...workbenchHead(f && { name: f.name, size: f.size }) };
}

test("every family's title is the engine's header or no build title, never a typed word the header doesn't say", () => {
  let built = 0;
  for (const q of PROMPTS) {
    for (const search of [{ q }, { y: workbenchToken({ q }) }]) {
      const h = headFor(search);
      if (h.engine) built++;
      assert.equal(h.title, h.engine ? `${h.engine} · Yard` : NO_BUILD, `${q}: title`);
      const allowed = words(`${h.engine ?? ""} yard 3d model cut list buy and step by plan type build get workspace on the`);
      for (const w of words(q)) if (!allowed.has(w)) for (const s of [h.title, h.desc]) assert.ok(!words(s).has(w), `${q}: "${w}" typed, not in the engine header, in "${s}"`);
    }
  }
  // A test that always says "no build" would pass the loop above: most families get their engine title.
  assert.ok(built >= PROMPTS.length * 1.5, `${built / 2} of ${PROMPTS.length} prompts titled by the engine`);
});

test("big ben is titled Big Ben with the engine's size; the linen canary is its header; typed private words never", () => {
  const ben = headFor({ q: "big ben" });
  assert.match(ben.title, /^Big Ben · [\d /]+" W × [\d /]+" D × [\d /]+" H.* · Yard$/);
  assert.notEqual(ben.title, "Big ben · Yard");
  assert.equal(headFor({ q: "linen closet 31.5 wide 78 tall 16 deep" }).title, 'Linen · 31 1/2" W × 16" D × 78" H · Yard');
  assert.equal(headFor({ q: PRIVATE }).title, NO_BUILD);
  assert.deepEqual(workbenchHead(null), { title: NO_BUILD, desc: "Type a build and get a 3D model, cut list, Buy list and plan." });
});

test("the server's title (engine worker, inside its budget) is the same header", async () => {
  assert.deepEqual(await engineTitleWithin(workbenchToken({ q: "big ben" }), 30000), (({ name, size }) => ({ name, size }))(offline(() => cardFacts(workbenchToken({ q: "big ben" })))!));
  assert.equal(await engineTitleWithin(workbenchToken({ q: PRIVATE }), 30000), null);
  assert.equal(await engineTitleWithin(""), null);
});

test("the route head reads only the engine's title: no prompt decoded, no typed noun cut", () => {
  const route = readFileSync(new URL("../src/routes/workspace.tsx", import.meta.url), "utf8");
  const head = route.slice(route.indexOf("head:"), route.indexOf("component:"));
  assert.match(head, /workbenchHead\(loaderData\?\.title \?\? null\)/);
  assert.doesNotMatch(route, /sharedPrompt|buildTitle|\.prompt\b|atob\(/);
  assert.match(route, /ssr: "data-only"/);
  assert.match(route, /engineTitleFn\(\{ data: token \}\)/);
});
