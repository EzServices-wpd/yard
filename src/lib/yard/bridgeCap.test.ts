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
import { finishGraph } from "./connect.ts";
import { getCatalogItem } from "./catalog.ts";

const sticks = (q: string) => buildPlan(generateFromPrompt(q)).bom.find((b) => /popsicle|toothpick/.test(b.catalogId ?? ""))!;

it("a typed width on a suspension bridge is its length, never its tower height", () => {
  const p = generateFromPrompt("brooklyn bridge 138.5 wide 11.5 tall 6 deep");
  assert.ok(p.overall.width >= 138.5 && p.overall.width <= 141, `width ${p.overall.width}`);
  assert.ok(p.overall.height <= 12, `height ${p.overall.height}`);
  assert.ok(p.overall.depth >= 6 && p.overall.depth <= 7.5, `typed depth 6 kept, got ${p.overall.depth}`);
  assert.ok(p.instances.length < 1000, `${p.instances.length} sticks`);
  // 200" long with 15" towers is not a Golden Gate (its towers are 23 1/8"): that pair is refused below, naming both.
  const g = generateFromPrompt("golden gate bridge 200 wide from popsicle sticks");
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

it("I52 flags a pack line that buys fewer or more packs than its pieces need, on the line or its best listing", () => {
  const offer = { retailer: "amazon", label: "Amazon", title: "x", href: "x", packQty: 1000, packPrice: 14.98, unitPrice: 0.01, packsNeeded: 1, lineTotal: 14.98, best: true };
  const line = { name: "Sticks", quantity: 2, unit: "packs of 1000 (1211 sticks used)", searchQuery: "s", offers: [offer] };
  const plan = (b: object) => ({ bom: [b] }) as never;
  assert.deepEqual(i52(plan(line)).map((v) => v.msg), ["Sticks: best listing sells 1 × 1000 for 1211 used"]);
  assert.equal(i52(plan({ ...line, quantity: 1, offers: [{ ...offer, packsNeeded: 2 }] })).length, 1);
  assert.equal(i52(plan({ ...line, offers: [{ ...offer, packsNeeded: 2 }] })).length, 0);
  assert.equal(i52(plan({ ...line, unit: "packs of 1000 (2000 sticks used)", offers: [{ ...offer, packsNeeded: 2 }] })).length, 0);
  // Over-buy is flagged too: 3 packs of 1000 for 1,211 used, or a best listing of 3 × 1000.
  assert.deepEqual(i52(plan({ ...line, quantity: 3, offers: [{ ...offer, packsNeeded: 2 }] })).map((v) => v.msg), ["Sticks: 3 packs of 1000 (1211 sticks used) buys more packs than 1211 need"]);
  assert.deepEqual(i52(plan({ ...line, offers: [{ ...offer, packsNeeded: 3 }] })).map((v) => v.msg), ["Sticks: best listing sells 3 × 1000, more packs than 1211 need"]);
  // A sheet line counts the parts cut from it: 48 pieces nest on one sheet of a 5-pack.
  assert.equal(i52(plan({ name: "Cardboard", quantity: 1, unit: "pack of 5 (48 pieces used)", catalogId: "cardboard-corrugated-sheet", searchQuery: "c" })).length, 0);
});

it("the ceiling is 8,000 parts: 8,000 builds, 8,001 stops", () => {
  assert.equal(MAX_PARTS, 8000);
  assert.doesNotThrow(() => checkParts(8000));
  assert.throws(() => checkParts(8001), TooManyParts);
});

it("a stick graph already far over the ceiling stops before the weld and prune passes", () => {
  const stick = getCatalogItem("popsicle-standard")!;
  const graph = (feet: number) => ({ id: "g", name: "g", envelope: { width: 1, height: feet * 12, depth: 1 }, materialId: stick.id, assumptions: [], notes: [], structureClass: "generic" as const,
    nodes: [{ id: "a", position: { x: 0, y: 0, z: 0 } }, { id: "b", position: { x: 0, y: feet * 12, z: 0 } }], edges: [{ id: "e", from: "a", to: "b", join: "glue" as const }] });
  // 6,000 ft of 4 1/2" sticks is 16,000 sticks: still over 8,000 if a third of the graph were pruned away.
  assert.throws(() => finishGraph(graph(6000) as never, stick, "tower"), TooManyParts);
  assert.doesNotThrow(() => finishGraph(graph(10) as never, stick, "tower"));
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
  assert.equal(scaledSizes("100 foot eiffel tower", 0.139)?.prompt, "13 foot eiffel tower");
  assert.equal(scaledSizes("2x4 bench 48 x 18 x 16", 0.5)?.prompt, "2x4 bench 24 x 9 x 8");
  assert.equal(scaledSizes("castle from toothpicks", 0.5), null);
});

it("a ceiling refusal always names a size that builds: 1,000 ft asks, and bench or follow-on sizes", () => {
  for (const q of ["1000 foot Eiffel Tower from popsicle sticks", "1000 foot castle from toothpicks", "500 foot castle from toothpicks"]) {
    const p = generateFromPrompt(q);
    assert.ok(p.refused && /It builds up to \d+ (?:foot|ft): type/.test(p.refused), `${q}: ${p.refused}`);
    assert.deepEqual(i36(p, q), []);
    const fit = p.refused!.match(/type (\d+) (foot|ft) or smaller/)!;
    const ok = generateFromPrompt(q.replace(/^\d+ (?:foot|ft)/, `${fit[1]} ${fit[2]}`));
    assert.ok(!ok.refused, `${fit[1]} ${fit[2]} builds`);
  }
  // "make it taller" after a 13 ft tower sends a size: the refusal names that size scaled down, never the typed 13 foot.
  const a = generateFromPrompt("13 foot Eiffel Tower from popsicle sticks");
  const ov = { ...a.overall, height: a.overall.height * 1.18 };
  const p = generateFromPrompt("13 foot Eiffel Tower from popsicle sticks. Then: make it taller", a.primaryMaterialId, undefined, { sizeOverride: ov });
  assert.ok(p.refused && !/at 13 foot/.test(p.refused) && /It builds up to [\d /]+" wide, [\d /]+" deep, [\d /]+" tall: type/.test(p.refused), p.refused);
  assert.deepEqual(i36(p, "x"), []);
  const m = p.refused!.match(/It builds up to ([\d /]+)" wide, ([\d /]+)" deep, ([\d /]+)" tall/)!;
  const num = (s: string) => s.trim().split(" ").reduce((t, x) => t + (x.includes("/") ? Number(x.split("/")[0]) / Number(x.split("/")[1]) : Number(x)), 0);
  const b = generateFromPrompt("13 foot Eiffel Tower from popsicle sticks. Then: make it taller", a.primaryMaterialId, undefined, { sizeOverride: { width: num(m[1]), depth: num(m[2]), height: num(m[3]) } });
  assert.ok(!b.refused, "the named bench size builds");
  // The default landmark stock is named, not the empty project's wire frame.
  assert.doesNotMatch(generateFromPrompt("eiffel tower 30 foot").refused!, /wire frame/);
});

it("I36 is not satisfied by the ceiling's own 'Yard builds up to 8,000 parts' words", () => {
  const p = { refused: "Yard builds up to 8,000 parts in one plan, and a Castle in wooden toothpicks at 1000 foot needs more, so nothing is built. Type a smaller size to build it.", panels: [] } as never;
  assert.equal(i36(p, "1000 foot castle from toothpicks").length, 1);
});

it("a typed length and a typed height that disagree on a fixed-ratio bridge are refused, naming both, never one dropped", () => {
  for (const q of ["brooklyn bridge 48 wide 30 tall", "brooklyn bridge 100 long 10 tall", "brooklyn bridge 10 feet wide 2 feet tall", "golden gate bridge 200 wide 15 tall from popsicle sticks", "tower bridge 48 wide 30 tall", "suspension bridge 120 wide 10 tall from popsicle sticks"]) {
    const p = generateFromPrompt(q);
    assert.ok(p.refused && p.instances.length === 0, `${q} refused`);
    assert.match(p.refused!, /can't be both [\d /]+" long and [\d /]+" tall.*Type [\d /]+" wide for .* or [\d /]+" tall for a/);
    assert.deepEqual(i36(p, q), []);
  }
  // Agreeing sizes (within 10%) build at the typed length, as the PR has it.
  const ok = generateFromPrompt("brooklyn bridge 138.5 wide 11.5 tall 6 deep");
  assert.ok(!ok.refused && ok.instances.length === 801);
  const ok2 = generateFromPrompt("brooklyn bridge 100 long 8 tall");
  assert.ok(!ok2.refused && ok2.overall.width >= 99 && ok2.overall.width <= 101);
});

it("Buy buys listing packs for the pieces used, not for catalog packs rounded up", () => {
  // 1570 toothpicks: two 800-packs hold them (7 catalog packs of 250 = 1,750 would round to three).
  const t = sticks("toothpick tower");
  assert.match(t.unit, /\(1570 /);
  assert.equal(t.quantity, 2);
  const e = sticks("eiffel tower from toothpicks 3 ft");
  const used = Number(e.unit.match(/\((\d+) /)![1]);
  assert.equal(e.quantity, Math.ceil(used / 800));
  // A sheet line's "(48 pieces used)" counts parts cut from the sheets: one 5-pack of sheets holds them, not ten.
  const board = buildPlan(generateFromPrompt("cardboard castle")).bom.find((b) => /\(48 pieces used\)/.test(b.unit))!;
  assert.deepEqual(board.offers!.map((o) => o.packsNeeded), board.offers!.map(() => 1));
});
