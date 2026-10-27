/**
 * Bridge cap (Ideas audit row 66, Chief: a cap or an honest refusal). 'brooklyn bridge 138.5 wide 11.5 tall 6 deep' built a
 * 1731 5/8" bridge of 7194 sticks for one $14.98 pack. Three rules: a typed axis word binds its axis on a fixed-ratio landmark;
 * a pack line buys packs for every piece it uses ("13 packs of 100" is 1,300, not 13); over MAX_PARTS nothing is built and the
 * note names the largest typed size that builds. Expected numbers are hand-worked: 1211 sticks / 1000 = 2 packs × $14.98.
 */
import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { i36, i52 } from "./invariants.ts";
import { checkParts, MAX_PARTS, scaledSizes, TooManyParts } from "./partCeiling.ts";

const sticks = (q: string) => buildPlan(generateFromPrompt(q)).bom.find((b) => /popsicle|toothpick/.test(b.catalogId ?? ""))!;

it("a typed width on a suspension bridge is its length, never its tower height", () => {
  const p = generateFromPrompt("brooklyn bridge 138.5 wide 11.5 tall 6 deep");
  assert.ok(p.overall.width >= 138.5 && p.overall.width <= 141, `width ${p.overall.width}`);
  assert.ok(p.overall.height <= 12, `height ${p.overall.height}`);
  assert.ok(p.overall.depth >= 6 && p.overall.depth <= 7.5, `typed depth 6 kept, got ${p.overall.depth}`);
  assert.ok(p.instances.length < 1000, `${p.instances.length} sticks`);
  const g = generateFromPrompt("golden gate bridge 200 wide 15 tall from popsicle sticks");
  assert.ok(g.overall.width >= 200 && g.overall.width <= 203, `golden gate width ${g.overall.width}`);
});

it("a tall-only or bare size keeps its old reading: towers at the typed height, a bare length is the length", () => {
  assert.equal(generateFromPrompt("brooklyn bridge 20 tall from popsicle sticks").overall.height, 20);
  const p = generateFromPrompt("4 foot Brooklyn Bridge from popsicle sticks");
  assert.equal(p.overall.width, 49);
  assert.equal(p.instances.length, 379);
});

it("Buy follows the sticks: 1211 sticks are two 1000-packs, 5849 toothpicks are eight 800-packs", () => {
  const b = sticks("brooklyn bridge 20 tall from popsicle sticks");
  assert.equal(b.unit, "packs of 1000 (1211 sticks used)");
  assert.equal(b.quantity, 2);
  assert.equal(b.offers!.find((o) => o.best)!.packsNeeded, 2);
  assert.equal(buildPlan(generateFromPrompt("brooklyn bridge 20 tall from popsicle sticks")).totals.estCostUsd, 34.94);
  const t = sticks("2 foot castle from toothpicks");
  assert.equal(t.quantity, 8);
  assert.match(t.unit, /^packs of 800 \(5849 /);
  const one = sticks("3 foot Eiffel Tower from popsicle sticks");
  assert.equal(one.quantity, 1);
  assert.equal(one.unit, "pack of 1000 (784 sticks used)");
});

it("I52 flags a pack line that buys fewer pieces than it uses, on the line or its best listing", () => {
  const offer = { retailer: "amazon", label: "Amazon", title: "x", href: "x", packQty: 1000, packPrice: 14.98, unitPrice: 0.01, packsNeeded: 1, lineTotal: 14.98, best: true };
  const line = { name: "Sticks", quantity: 2, unit: "packs of 1000 (1211 sticks used)", searchQuery: "s", offers: [offer] };
  const plan = (b: object) => ({ bom: [b] }) as never;
  assert.deepEqual(i52(plan(line)).map((v) => v.msg), ["Sticks: best listing sells 1 × 1000 for 1211 used"]);
  assert.equal(i52(plan({ ...line, quantity: 1, offers: [{ ...offer, packsNeeded: 2 }] })).length, 1);
  assert.equal(i52(plan({ ...line, offers: [{ ...offer, packsNeeded: 2 }] })).length, 0);
  assert.equal(i52(plan({ ...line, unit: "packs of 1000 (2000 sticks used)", offers: [{ ...offer, packsNeeded: 2 }] })).length, 0);
});

it("the ceiling is 8,000 parts: 8,000 builds, 8,001 stops", () => {
  assert.equal(MAX_PARTS, 8000);
  assert.doesNotThrow(() => checkParts(8000));
  assert.throws(() => checkParts(8001), TooManyParts);
});

it("a 100 ft popsicle Eiffel Tower is refused fast and names 13 foot, the largest that builds", () => {
  const t0 = Date.now();
  const p = generateFromPrompt("100 foot Eiffel Tower from popsicle sticks");
  assert.ok(Date.now() - t0 < 30000, `${Date.now() - t0} ms`);
  assert.equal(p.instances.length + p.panels.length, 0);
  assert.equal(p.refused, "Yard builds up to 8,000 parts in one plan, and an Eiffel Tower in standard popsicle sticks at 100 foot needs more, so nothing is built. It builds up to 13 foot: type 13 foot or smaller.");
  assert.deepEqual(i36(p, "100 foot Eiffel Tower from popsicle sticks"), []);
  const ok = generateFromPrompt("13 foot Eiffel Tower from popsicle sticks");
  assert.ok(!ok.refused && ok.instances.length > 7000 && ok.instances.length <= MAX_PARTS, `${ok.instances.length}`);
  assert.ok(generateFromPrompt("14 foot Eiffel Tower from popsicle sticks").refused);
});

it("a runaway toothpick castle is refused, not a stack overflow, and is never cut short", () => {
  const p = generateFromPrompt("50 foot castle from toothpicks");
  assert.equal(p.instances.length, 0);
  assert.match(p.refused ?? "", /It builds up to 2 foot: type 2 foot or smaller\.$/);
  // The old renderer stop sold the first 8,000 sticks of a 30 ft tower as the whole tower.
  const e = generateFromPrompt("30 foot Eiffel Tower from popsicle sticks");
  assert.ok(e.refused && e.instances.length === 0);
});

it("scaledSizes scales typed sizes, rounds down in the unit typed, and leaves stock sizes alone", () => {
  assert.deepEqual(scaledSizes("brooklyn bridge 138.5 wide 11.5 tall", 0.5)?.words, ["69 1/4 wide", "5 3/4 tall"]);
  assert.deepEqual(scaledSizes("brooklyn bridge 138.5 wide", 0.3)?.words, ["41 1/2 wide"]);
  assert.equal(scaledSizes("100 foot eiffel tower", 0.13)?.prompt, "13 foot eiffel tower");
  assert.equal(scaledSizes("2x4 bench 48 x 18 x 16", 0.5)?.prompt, "2x4 bench 24 x 9 x 8");
  assert.equal(scaledSizes("castle from toothpicks", 0.5), null);
});
