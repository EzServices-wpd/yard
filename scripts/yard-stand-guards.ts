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
  const entry = litter.panels.find((x) => /Entry panel/.test(x.name));
  if (!entry || !(entry.polygon?.holes?.length) || (entry.polygon!.holes![0].r * 2) < 7) fail("litter cabinet has an entry panel with a cat hole", litter.panels.map((x) => x.name));
  if (!litter.panels.some((x) => x.type === "door")) fail("litter cabinet keeps a scoop door");
  if (!/litter/i.test(litter.name)) fail("litter cabinet title", litter.name);
  if (/^Cat\b/.test(litter.name) && litter.kind === "figure") fail("litter cabinet is not a cat figure", litter.name);

  const lego = generateFromPrompt("shelf for my Lego robot collection");
  if (isProductStand(lego) || lego.kind === "figure") fail("collection shelf is a display shelf", { name: lego.name, kind: lego.kind });
  if (!/Display shelf for a Lego robot collection/.test(lego.name)) fail("collection shelf title names what it holds", lego.name);
  const legoShelves = lego.panels.filter((x) => x.type === "shelf" || x.type === "bottom").map((x) => x.position.y + x.size.height).sort((a, b) => a - b);
  const legoTop = lego.panels.find((x) => x.type === "top");
  if (legoShelves.length < 2 || !legoTop) fail("collection shelf has tiers", lego.panels.map((x) => x.name));
  else {
    const ys = [...legoShelves, legoTop.position.y];
    for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < 10 - 0.01) fail("collection tier clears a robot (10 in+)", ys);
  }
  const step0 = buildPlan(lego).instructions.map((x) => `${x.title} ${x.description}`).join(" ");
  if (/Display [A-Z] shelf/.test(step0)) fail("cut-list letter stamped inside the title", step0.slice(0, 200));

  const horse = generateFromPrompt("horse-shaped coat rack from plywood");
  if (!horse.panels.some((x) => /Body profile/.test(x.name))) fail("horse-shaped coat rack is a horse silhouette", horse.panels.map((x) => x.name));
  if (!/Horse/.test(horse.name)) fail("horse coat rack title", horse.name);
  if (!buildPlan(horse).bom.some((b) => /hook/i.test(b.name))) fail("horse coat rack hooks on Buy");

  const bookend = generateFromPrompt("robot bookend out of 2x4 scraps");
  if (!/Robot/.test(bookend.name)) fail("robot bookend is a robot", bookend.name);
  if (!/bookend/i.test(bookend.name)) fail("robot bookend title carries the use", bookend.name);
  if (!(bookend.instances ?? []).some((i) => i.role === "bookend face") || !(bookend.instances ?? []).some((i) => i.role === "base")) fail("robot bookend has a flat face and a base", bookend.instances.map((i) => i.role));
  if (!bookend.notes.some((n) => /books? (?:to )?lean/i.test(n))) fail("robot bookend note says the books lean on the face");

  const bench = generateFromPrompt("2x4 workbench, 60 inches long");
  if (!/Workbench/i.test(bench.name) || Math.abs(bench.overall.width - 60) > 1.5 || isOwnedBoard(bench) || isProductStand(bench)) {
    fail("2x4 workbench 60 long", { name: bench.name, overall: bench.overall });
  }
}

// ---------------------------------------------------------------- 3. Shelf classes: usable clear, counts, notes
const clears = (p: YardProject) => {
  const floors = p.panels.filter((x) => /^(bottom|shelf)$/.test(x.type)).map((x) => x.position.y + x.size.height);
  const ceilings = p.panels.filter((x) => /^(shelf|top)$/.test(x.type)).map((x) => x.position.y);
  const fl = [...new Set(floors.map((y) => Math.round(y * 100) / 100))].sort((a, b) => a - b);
  const ce = [...new Set(ceilings.map((y) => Math.round(y * 100) / 100))].sort((a, b) => a - b);
  return fl.map((y) => (ce.find((c) => c > y + 0.01) ?? NaN) - y).filter((n) => Number.isFinite(n));
};
{
  const shoe = generateFromPrompt("shoe rack with 4 shelves");
  const c = clears(shoe);
  if (c.length !== 4) fail("shoe rack: 4 shelves means 4 usable tiers", c);
  if (c.some((x) => x < 6 - 0.01)) fail("shoe rack tiers clear 6 in+", c);
  if (shoe.notes.some((n) => /\d\.\d/.test(n.replace(/\d+\.\d+\s*(?:mm|ct)/g, "")) && /bays?/.test(n))) fail("shoe rack bay note uses decimals", shoe.notes);
  const cub = shoe.panels.filter((x) => /Cubby divider/.test(x.name));
  if (cub.length) {
    const inner = shoe.overall.width - 1.5;
    const bay = (inner - cub.length * 0.75) / (cub.length + 1);
    if (bay < 9 - 0.01) fail("shoe bays hold a pair (9 in+)", bay);
  }
  const short = generateFromPrompt("shoe rack 36 wide 18 tall with 4 shelves");
  if (Math.abs(short.overall.height - 18) > 0.1) fail("shoe rack typed height wins", short.overall);
  if (!short.notes.some((n) => /4 tiers were asked; 2 fit/.test(n))) fail("shoe rack says the shortfall", short.notes);

  const rec = generateFromPrompt("bookshelf for my record collection");
  const rc = clears(rec);
  if (!rc.length || rc.some((x) => x < 13 - 0.01)) fail("record shelf clears 13 in for LPs", rc);
  if (rec.overall.depth < 13 || rec.overall.depth > 16) fail("record shelf 13–16 deep", rec.overall);
  const spans = rec.panels.filter((x) => x.type === "shelf").map((x) => x.size.width);
  if (spans.some((w) => w > 18)) fail("record shelf spans stay short (sag)", spans);
  if (!rec.notes.some((n) => /sag/.test(n))) fail("record shelf sag note");

  const kids = generateFromPrompt("kids bookcase with 3 shelves");
  if (kids.overall.height < 36 || kids.overall.height > 48) fail("kids bookcase 36–48 tall", kids.overall);
  if (!kids.notes.some((n) => /anti-tip/i.test(n))) fail("kids bookcase anti-tip note");
  if (!buildPlan(kids).bom.some((b) => /anti-tip/i.test(b.name))) fail("kids bookcase anti-tip on Buy");

  const must = generateFromPrompt("bookshelf 30 wide 12 deep 60 tall with five shelves");
  const ms = must.panels.filter((x) => x.type === "shelf");
  if (ms.length !== 5 || must.overall.width !== 30 || must.overall.height !== 60 || must.overall.depth !== 12) fail("must-pass bookshelf 30x60x12 Shelf x5", { o: must.overall, n: ms.length });
  const adj = buildPlan(generateFromPrompt("bookcase with adjustable shelves"));
  if (!adj.bom.some((b) => /shelf pins/i.test(b.name))) fail("adjustable bookcase keeps shelf pins");
  const cooler = generateFromPrompt("shelf for an Igloo cooler");
  if (/closet/i.test(cooler.name) || !cooler.panels.some((x) => /^(Leg|Stand post)\b/.test(x.name))) fail("shelf for an Igloo cooler has legs, not a closet", { name: cooler.name, parts: cooler.panels.map((x) => x.name) });

  const fl = generateFromPrompt("three floating shelves, 24 inches wide");
  const flShelves = fl.panels.filter((x) => /^Shelf \d/.test(x.name));
  const cleats = fl.panels.filter((x) => /Wall cleat/.test(x.name));
  if (flShelves.length !== 3 || cleats.length !== 3) fail("three floating shelves: 3 separate shelves on 3 cleats", fl.panels.map((x) => x.name));
  const fc = clears(fl);
  if (fc.some((x) => x < 7 - 0.01)) fail("floating shelves clear 7 in+", fc);
  if (fl.notes.some((n) => /not floating boards/i.test(n))) fail("floating notes contradict geometry", fl.notes);
  const flBom = buildPlan(fl).bom.map((b) => b.name).join(" | ");
  if (!/screw/i.test(flBom)) fail("floating shelves Buy carries mounting screws", flBom);

  const tank = generateFromPrompt("20 gallon fish tank stand");
  const tdeck = tank.panels.find((x) => x.name === "Deck");
  if (!tdeck || tdeck.size.width < 24 || tdeck.size.depth < 12) fail("fish tank deck fits a 20 gal tank", tdeck?.size);
  if (!tank.panels.some((x) => /^Leg/.test(x.name) && x.materialId.includes("2x4"))) fail("fish tank stand stands on 2x4 legs", tank.panels.map((x) => `${x.name}:${x.materialId}`));
  if (!tank.notes.some((n) => /lb/.test(n))) fail("fish tank load note");
  for (const q of ["shelf for my microwave", "stand for my turntable", "riser for my toaster oven"]) {
    const p = generateFromPrompt(q);
    const h = (p.instances ?? []).find((i) => i.role === "held");
    if (!h) { fail("held object proxy present", q); continue; }
    const d = generateFromPrompt(q).overall;
    if (d.width < 10 || d.depth < 8) fail("held stand is not a 6x4x3 placeholder", { q, d });
  }
}

// ---------------------------------------------------------------- 4. Plain text: no template leaks
for (const q of ["plant stand with three tiers", "shoe rack with 4 shelves", "robot bookend out of 2x4 scraps", "raised dog bowl stand, 12 inches tall", "cat litter box cabinet"]) {
  const p = generateFromPrompt(q);
  const plan = buildPlan(p);
  const text = [...p.notes, ...plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`), ...plan.instructions.map((s) => `${s.title} ${s.description}`)].join(" \n ");
  if (/\b1 pieces\b|\b1 marked cuts\b|\b1 member members\b|\bmember members\b/.test(text)) fail("singular/plural template leak", { q, m: text.match(/.{30}\b1 (?:pieces|marked cuts|member members).{20}/)?.[0] });
  if (!p.panels.some((x) => /plywood/.test(x.materialId)) && /¼″ backs stay plywood|1\/4" backs stay plywood/.test(text)) fail("plywood back text on a build with no plywood", q);
}

// ---------------------------------------------------------------- 6. Ladder shelf: leaning rails, tapered shelves, 7" clear
for (const [q, wantN] of [["ladder shelf with 4 shelves", 4], ["leaning ladder shelf 24 wide 72 tall with five shelves", 5], ["ladder shelf 30 tall with 6 shelves", 4]] as const) {
  const p = generateFromPrompt(q);
  const rails = p.panels.filter((x) => /leaning rail$/i.test(x.name));
  if (rails.length !== 2 || rails.some((x) => !x.polygon || !x.yaw)) fail("ladder shelf has two leaning (shaped, turned) rails", { q, parts: p.panels.map((x) => x.name) });
  if (p.panels.filter((x) => /back post$/i.test(x.name)).length !== 2) fail("ladder shelf has two back posts at the wall", q);
  const sh = p.panels.filter((x) => x.type === "shelf").sort((a, b) => a.position.y - b.position.y);
  if (sh.length !== wantN) fail("ladder shelf count", { q, n: sh.length, wantN });
  for (let i = 1; i < sh.length; i++) {
    const clear = sh[i].position.y - (sh[i - 1].position.y + sh[i - 1].size.height);
    if (clear < 7 - 1e-6) fail("ladder shelf opening clears 7 inches", { q, i, clear });
    if (sh[i].size.depth >= sh[i - 1].size.depth) fail("ladder shelves get shallower as they climb", { q, d: sh.map((x) => x.size.depth) });
  }
  if (sh.length && sh[sh.length - 1].size.depth < 6) fail("ladder top shelf is at least 6 inches deep", { q, d: sh[sh.length - 1].size.depth });
  if (!p.notes.some((n) => /anti-tip/i.test(n))) fail("ladder shelf anti-tip note", q);
  if (/30 tall/.test(q) && !p.notes.some((n) => /6 shelves were asked; 4 fit/.test(n))) fail("ladder shelf shortfall note", p.notes);
  const plan = buildPlan(p);
  if (!plan.instructions.some((st) => /anchor/i.test(st.title))) fail("ladder shelf steps anchor it to the wall", plan.instructions.map((st) => st.title));
  if (plan.instructions.some((st) => /main box|back is already on/i.test(st.description))) fail("ladder shelf steps talk about a carcase it does not have", plan.instructions.map((st) => st.title));
}

// ---------------------------------------------------------------- 7. Typed fractions survive titles; a named stock builds; money is finite
for (const [q, titleRe] of [["flamingo from 1/4 inch dowels", /^Flamingo\b/i], ["bird from 1/4 inch dowels", /^Bird\b/i], ["giraffe from 3/4 inch plywood", /^Giraffe\b/i]] as const) {
  const p = generateFromPrompt(q);
  if (/\b\d+\/(?!\d)|\/\s/.test(p.name)) fail("title ate a typed fraction", { q, name: p.name });
  if (!titleRe.test(p.name)) fail("title names the subject", { q, name: p.name });
  if (p.instances.some((i) => /^piece-model-/.test(i.catalogId))) fail("a named build stock never routes to a product block", { q, name: p.name });
}
for (const q of ["dowel flamingo", "flamingo", "popsicle stick flamingo"]) {
  const p = generateFromPrompt(q);
  if (p.instances.some((i) => /^piece-model-/.test(i.catalogId))) fail("a subject with a figure block builds from stock, not a product block", { q, name: p.name });
}
for (const q of ["dasani bottle", "basketball", "garden gnome", "rubber duck", "camelbak water bottle"]) {
  const p = generateFromPrompt(q);
  if (!p.instances.some((i) => /^piece-model-/.test(i.catalogId))) fail("a bare product stays the product", { q, name: p.name, kind: p.kind });
}
for (const q of ["dowel flamingo", "flamingo from 1/4 inch dowels", "garden gnome", "dasani bottle", "ceramic frog", "shelf for my microwave", "ladder shelf with 4 shelves"]) {
  const plan = buildPlan(generateFromPrompt(q));
  const nums = [plan.totals.estCostUsd, ...plan.bom.flatMap((b) => [b.estimatedCost ?? 0, ...(b.offers ?? []).flatMap((o) => [o.packPrice, o.unitPrice, o.lineTotal])])];
  if (nums.some((n) => typeof n === "number" && !Number.isFinite(n))) fail("Buy money is finite (no $NaN)", q);
}

// ---------------------------------------------------------------- 5. Product notes: shop fractions, positive wording, no placeholder
for (const q of ["basketball", "poland spring water bottle", "watering can", "ceramic frog", "wrench", "propane tank", "football", "brick", "safety goggles", "yeti rambler 20"]) {
  const p = generateFromPrompt(q);
  for (const n of p.notes) {
    if (/\b\d+\.\d+\s*(?:″|"|in\b)/.test(n)) fail("product note uses decimal inches", { q, n });
    if (/not this\b|not a drawing|not a checked/i.test(n)) fail("product note uses negative 'not this' wording", { q, n });
    if (/6″ × 4″ × 3″|6" x 4" x 3"/.test(n)) fail("product note carries the 6x4x3 placeholder", { q, n });
  }
}

console.log(`stand guards: swept ${swept} weekend prompts`);
if (failed) {
  console.error(`FAIL stand guards: ${failed} failures`);
  process.exit(1);
}
console.log("PASS stand guards");
