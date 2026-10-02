/**
 * Stand / held-object / shelf-class guards (Oct 2 2026).
 * Universal rules: a known build class always wins over product-stand routing; held objects are sized
 * from a class-default table (never a tiny placeholder); spoken tiers / floating shelves / ladder
 * shelves build what was said; shelf openings clear a usable height; notes never contradict geometry.
 * Run: npx -y tsx scripts/yard-stand-guards.ts
 */
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { namedBuildClass } from "../src/lib/yard/heldObjects";
import type { YardProject } from "../src/lib/yard/types";

let failed = 0;
function fail(msg: string, extra?: unknown) {
  failed++;
  console.error("FAIL stand", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 400));
}

const isProductStand = (p: YardProject) =>
  p.panels.some((x) => /^(Stand post|Near rail|Far rail)\b/.test(x.name)) ||
  (p.instances ?? []).some((i) => /^piece-(model|held)-/.test(i.catalogId));
const isOwnedBoard = (p: YardProject) => p.panels.length === 0 && (p.instances ?? []).length === 1;

// ---------------------------------------------------------------- 1. Build class wins (Weekend sweep)
const WEEKEND_NOUNS = [
  "cat tree", "dachshund", "dog", "puppy", "cat", "horse", "pony", "donkey", "zebra", "deer", "cow", "pig", "sheep",
  "lion", "bear", "wolf", "fox", "giraffe", "elephant", "dinosaur", "unicorn", "dragon", "robot", "figure",
  "birdhouse", "catapult", "trebuchet", "picture frame", "lattice tower", "eiffel tower", "bridge", "garden arch",
  "trellis", "ladder", "step stool", "marble run", "easel",
];
const VARIANTS = (n: string) => [
  n,
  `${n} shelf`,
  `${n} for my kids room`,
  `${n} stand`,
  `${n}, 30 inches tall`,
  `plywood ${n}, 24 inches long`,
  `2x4 ${n}, 18 inches tall`,
  `${n} from 2x4 scraps`,
];
let swept = 0;
for (const noun of WEEKEND_NOUNS) {
  for (const prompt of VARIANTS(noun)) {
    swept++;
    // "<noun> shelf" may also be a house shelf (cat shelf = a climbing shelf); it must still never be a product stand.
    if (!namedBuildClass(prompt) && !/ shelf$/.test(prompt)) fail("build class not matched", prompt);
    const p = generateFromPrompt(prompt);
    if (isProductStand(p)) fail("weekend noun routed to a product stand", { prompt, name: p.name, parts: p.panels.map((x) => x.name) });
    if (isOwnedBoard(p)) fail("weekend noun routed to one owned board / product block", { prompt, name: p.name });
    if (/,\s*$|,\s*\d|\s{2}/.test(p.name)) fail("title is the raw prompt", { prompt, name: p.name });
  }
}
// Regressions named by the critic.
{
  const tree = generateFromPrompt("cat tree");
  if (tree.panels.length < 12 || !tree.panels.some((x) => /Platform/.test(x.name)) || !tree.panels.some((x) => /Sisal/.test(x.name))) {
    fail("cat tree is the plywood tree with decks and sisal", { name: tree.name, parts: tree.panels.map((x) => x.name) });
  }
  const tall = generateFromPrompt("cat tree, 5 feet tall");
  if (Math.abs(tall.overall.height - 60) > 1.5) fail("cat tree 5 feet tall", tall.overall);
  const dox = generateFromPrompt("plywood dachshund shelf, 30 inches long");
  if (!/Dachshund shelf/.test(dox.name) || !dox.panels.some((x) => /Body profile/.test(x.name)) || !dox.panels.some((x) => /Shelf top/.test(x.name))) {
    fail("plywood dachshund shelf", { name: dox.name, parts: dox.panels.map((x) => x.name) });
  }
  if (Math.abs(dox.overall.width - 30) > 1.5) fail("dachshund 30 long", dox.overall);
  const bot = generateFromPrompt("2x4 scrap robot, 18 inches tall");
  if (!/Robot/.test(bot.name) || (bot.instances ?? []).length < 6) fail("2x4 scrap robot is a robot figure", { name: bot.name, n: bot.instances.length });
}

// ---------------------------------------------------------------- 2. Collision twins (both ways)
{
  const bowl = generateFromPrompt("raised dog bowl stand, 12 inches tall");
  const held = (bowl.instances ?? []).filter((i) => i.role === "held");
  if (/dog\b/i.test(bowl.name) && !/bowl/i.test(bowl.name)) fail("dog bowl stand is not the dog", bowl.name);
  if (held.length !== 2) fail("dog bowl stand holds two bowls", held.length);
  const deck = bowl.panels.find((x) => x.name === "Deck");
  if (!deck || Math.abs(deck.position.y + deck.size.height - 12) > 0.1) fail("dog bowl stand deck at the typed 12 in", deck);
  if (!deck || deck.size.width < 16) fail("dog bowl deck fits two bowls", deck?.size);

  const litter = generateFromPrompt("cat litter box cabinet");
  if (litter.kind !== "closet" || !litter.panels.some((x) => x.type === "upright")) fail("litter box cabinet is a carcase", { kind: litter.kind, name: litter.name });
  // TWIN-NEXT: litter entry hole
  if (/^Cat\b/.test(litter.name) && litter.kind === "figure") fail("litter cabinet is not a cat figure", litter.name);

  const lego = generateFromPrompt("shelf for my Lego robot collection");
  if (isProductStand(lego) || lego.kind === "figure") fail("collection shelf is a display shelf", { name: lego.name, kind: lego.kind });
  // TWIN-NEXT: collection display title

  const horse = generateFromPrompt("horse-shaped coat rack from plywood");
  if (!horse.panels.some((x) => /Body profile/.test(x.name))) fail("horse-shaped coat rack is a horse silhouette", horse.panels.map((x) => x.name));
  if (!/Horse/.test(horse.name)) fail("horse coat rack title", horse.name);
  if (!buildPlan(horse).bom.some((b) => /hook/i.test(b.name))) fail("horse coat rack hooks on Buy");

  const bookend = generateFromPrompt("robot bookend out of 2x4 scraps");
  if (!/Robot/.test(bookend.name)) fail("robot bookend is a robot", bookend.name);
  // TWIN-NEXT: robot bookend use

  const bench = generateFromPrompt("2x4 workbench, 60 inches long");
  if (!/Workbench/i.test(bench.name) || Math.abs(bench.overall.width - 60) > 1.5 || isOwnedBoard(bench) || isProductStand(bench)) {
    fail("2x4 workbench 60 long", { name: bench.name, overall: bench.overall });
  }
}

console.log(`stand guards: swept ${swept} weekend prompts`);
if (failed) {
  console.error(`FAIL stand guards: ${failed} failures`);
  process.exit(1);
}
console.log("PASS stand guards");
