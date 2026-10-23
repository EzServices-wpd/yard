/**
 * I42 · one spec per prompt, read by the PDF cover: a typed size is built or refused, never "assumed"; an assumed size
 * is the built unit, never the room a pocket unit stands in. Expected values are hand-worked from the prompts and the
 * canary plans, not recomputed the way the code does.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateFromPrompt } from "./promptMain";
import { coverAxesTalk as typedAxesTalk } from "./headerSize";
import { typedAssumedFailures } from "./typedNotAssumed";
import { labeledAxisValues } from "./typedAxesRead";

const cover = (q: string) => typedAxesTalk(generateFromPrompt(q)).subtitle;
const i42 = (q: string) => typedAssumedFailures(generateFromPrompt(q), q);

test("pocket vanity canary (nothing typed): the cover assumes the 38 x 102 x 17 unit, never the 48 7/8 x 104 x 35 1/2 room pocket", () => {
  for (const q of ["pocket vanity", "house: bathroom pocket vanity original trapezoid"]) {
    // One depth on the page: the title's and tag's 17", the proud fronts said once, in the note (Critic #109 B1).
    assert.equal(cover(q), '38" wide, 102" tall and 17" deep assumed, measure to lock · doors and drawer fronts stand proud', q);
    assert.deepEqual(i42(q), [], q);
  }
});

test("typed pocket vanity (the walk prompt types the 38 x 17 x 102 unit): nothing on the cover is assumed", () => {
  const walk = readFileSync(new URL("../../../scripts/walk-launch.ts", import.meta.url), "utf8").match(/prompt: `([\s\S]*?)`/)![1];
  assert.doesNotMatch(cover(walk), /assumed|you typed/);
  assert.deepEqual(i42(walk), []);
});

test("linen and desk canaries: fully typed, nothing assumed", () => {
  assert.equal(cover("linen closet 31.5 wide 78 tall 16 deep"), '31 1/2" wide x 78" tall x 16" deep · doors stand proud');
  for (const q of ["desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space", "desk 60x30x29 with a 24 inch knee"]) {
    assert.equal(cover(q), '60" wide x 29" tall x 30" deep · drawer fronts stand proud', q);
    assert.deepEqual(i42(q), [], q);
  }
});

test("one, two or three typed axes: the cover marks assumed only the axes not typed", () => {
  const rows: [string, RegExp][] = [
    ["bookcase 30 wide", /^30" wide · 84" tall and 12" deep assumed/],
    ["bookcase 30 wide 48 tall", /^30" wide x 48" tall · 12" deep assumed/],
    ["bookcase 30 wide 48 tall 11 deep", /^30" wide x 48" tall x 11" deep$/],
    // Feet with an axis word are typed: "5 ft tall" is a typed 60" height (was "size assumed").
    ["towel ladder 5 ft tall", /^60" tall · 20" wide and 3 1\/2" deep assumed/],
    // A bed reads long x wide: 44 wide is the bed's typed depth, only its height is assumed.
    ["bunk bed 82 long 44 wide", /^82" wide x 44" deep · 65" tall assumed/],
    ["cedar planter box 36 long 12 wide 12 tall", /^36" wide x 12" tall x 12" deep$/],
    ["cabinet 12 1/2 deep", /^12 1\/2" deep · 12" wide and 30" tall assumed/],
  ];
  for (const [q, want] of rows) {
    assert.match(cover(q), want, q);
    assert.deepEqual(i42(q), [], q);
  }
  // A typed size built at another size names both (the shoe rack's door is 48" wide; the build is not changed here).
  assert.match(cover("shoe rack by the door 36 inches wide"), /^48" wide \(you typed 36"\)/);
});

test("typed sizes read the shop way: fractions and feet-and-inches, never decimals", () => {
  assert.deepEqual(labeledAxisValues("bookcase 18 1/2 wide 30 tall 8 deep"), { width: 18.5, height: 30, depth: 8 });
  assert.deepEqual(labeledAxisValues("bench 18-1/2 wide"), { width: 18.5 });
  assert.deepEqual(labeledAxisValues(`bookcase 1' 6 1/2" wide`), { width: 18.5 });
  assert.deepEqual(labeledAxisValues("towel ladder 5 ft tall"), { height: 60 });
  // With a "long" typed, "wide" may be the depth: the form decides, so the word reader leaves width out.
  assert.deepEqual(labeledAxisValues("cedar planter box 36 long 12 wide 12 tall"), { height: 12 });
});

test("one spec, built at intake: noun, typed/assumed axes, counts, features, stock, species, refusal; the cover follows it", () => {
  const p = generateFromPrompt("oak bookcase 30 wide 48 tall with 3 shelves and doors");
  const s = p.spec!;
  assert.equal(s.noun.toLowerCase().includes("bookcase"), true, s.noun);
  assert.deepEqual([s.size.width.typed, s.size.height.typed, s.size.depth.typed], [true, true, false]);
  assert.deepEqual([s.size.width.assumed, s.size.height.assumed, s.size.depth.assumed], [false, false, true]);
  assert.equal(s.counts.shelves, 3);
  assert.ok(s.features.includes("doors") && s.features.includes("shelves"), s.features.join());
  assert.equal(s.species, "Oak");
  assert.equal(s.stockId, p.primaryMaterialId);
  assert.equal(s.refusal, null);
  // Flip the spec and the cover follows it: the cover never decides on its own.
  const flipped = { ...p, spec: { ...s, size: { ...s.size, width: { ...s.size.width, assumed: true }, depth: { ...s.size.depth, assumed: false } } } };
  assert.match(typedAxesTalk(flipped).subtitle, /^48" tall x 12 3\/4" deep · 30" wide assumed/);
  // A bench edit (a size override) types every axis: nothing on the cover is assumed.
  const edited = generateFromPrompt("bookcase 30 wide", undefined, undefined, { sizeOverride: { width: 30, height: 60, depth: 10 } } as never);
  assert.doesNotMatch(typedAxesTalk(edited).subtitle, /assumed/);
});

test("an edit in place rebuilds the spec from the spec before it: the edited axis is the person's own value, never 'you typed' the old one", async () => {
  const { withEditedSpec } = await import("./spec");
  const { headerTitle } = await import("./pdf");
  // The store's Measure path for a fitted carcass: fittedOverride + honorUnit, then the bench's spec, edited.
  const edit = (q: string, width: number) => {
    const p = generateFromPrompt(q);
    const f = p.fitted!;
    return withEditedSpec(p, generateFromPrompt(q, p.primaryMaterialId, undefined, { fittedOverride: { ...f, unit: { ...f.unit, width }, opening: { ...f.opening, width } }, honorUnit: true } as never));
  };
  const linen = edit("linen closet 31.5 wide 78 tall 16 deep", 36);
  assert.equal(typedAxesTalk(linen).subtitle, '36" wide x 78" tall x 16" deep · doors stand proud');
  const ns = edit("nightstand", 24);
  assert.deepEqual([ns.spec!.size.width.edited, ns.spec!.size.depth.assumed, ns.spec!.size.height.assumed], [true, true, true]);
  // The cover's depth is its title's (fronts in the note once), and nothing says "you typed".
  const depth = headerTitle(ns, { features: false }).match(/× ([\d /]+)" D/)![1];
  assert.match(typedAxesTalk(ns).subtitle, new RegExp(`^24" wide · .*${depth}" deep assumed`));
  assert.doesNotMatch(typedAxesTalk(ns).subtitle, /you typed/);
  assert.deepEqual(typedAssumedFailures(ns, "nightstand"), []);
  // B1 on an edited build: the fronts are never folded into a depth the edit left alone or the one it set (the store's
  // pocket and fitted Measure paths). Pocket vanity to 36 W stays 17" deep; a desk set to 28 deep reads 28, not 28 3/4.
  const { fitPocketAsk } = await import("./pocket");
  const pv = generateFromPrompt("pocket vanity");
  const fit = fitPocketAsk(pv.pocket!, { width: 36, height: pv.pocket!.unit.height, depth: pv.pocket!.unit.depth, ceiling: pv.pocket!.walls.height });
  const pv36 = withEditedSpec(pv, generateFromPrompt("pocket vanity", pv.primaryMaterialId, undefined, { pocketOverride: fit.spec } as never));
  assert.equal(headerTitle(pv36, { features: false }), 'Bathroom pocket vanity · 36" W × 17" D × 102" H (D, H assumed)');
  assert.equal(typedAxesTalk(pv36).subtitle.replace(/^36" wide · /, ""), '102" tall and 17" deep assumed, measure to lock · doors and drawer fronts stand proud');
  const desk = generateFromPrompt("desk 60 wide");
  const f = desk.fitted!;
  const d28 = withEditedSpec(desk, generateFromPrompt("desk 60 wide", desk.primaryMaterialId, undefined, { fittedOverride: { ...f, opening: { ...f.opening, depth: 28 }, unit: { ...f.unit, depth: 28 } }, honorUnit: true } as never));
  assert.equal(headerTitle(d28, { features: false }), 'Desk · 60" W × 28" D × 29" H (H assumed)');
  assert.match(typedAxesTalk(d28).subtitle, /^60" wide x 28" deep · 29" tall assumed/);
  assert.deepEqual([typedAssumedFailures(pv36, "pocket vanity"), typedAssumedFailures(d28, "desk 60 wide")], [[], []]);
});
