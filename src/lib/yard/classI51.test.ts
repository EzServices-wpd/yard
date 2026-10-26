/** I51: no sheet is opened for a trim strip (kick strip, toe kick, plinth) that fits a free gap of an earlier sheet. */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild, i51Gaps } from "./invariants";
import { flagCrossGrain, freeGapSpot, isTrimStrip, nestParts, type NestPart } from "./nesting";

const plan = (q: string) => buildPlan(generateFromPrompt(q));
const part = (id: string, name: string, width: number, height: number): NestPart => ({ id, name, label: id, width, height, material: "3/4\" plywood", allowRotate: height / width > 0.25 });
const turned = (q: string) => (plan(q).sheetNest?.sheets?.sheets ?? []).flatMap((s) => s.parts.filter((x) => x.crossGrain).map((x) => x.name));

test("I51: 24\" kitchen base cabinet nests on one sheet, only the kick strip turned into the offcut and noted, $98.83 (Ezra Oct 26)", () => {
  const q = "kitchen base cabinet 24 wide";
  const p = generateFromPrompt(q);
  const pl = buildPlan(p);
  assert.equal(pl.sheetNest?.sheets?.totalSheets, 1);
  assert.equal(pl.totals.estCostUsd.toFixed(2), "98.83");
  const parts = pl.sheetNest!.sheets!.sheets[0].parts;
  assert.deepEqual(parts.filter((x) => x.crossGrain).map((x) => x.name), ["Kick strip"], "packer-turned top and shelf are not flagged");
  assert.ok(parts.some((x) => x.rotated && !x.crossGrain), "the packer still turns square-ish panels without a flag");
  assert.deepEqual(pl.cutList.filter((c) => /across the grain/.test(c.notes ?? "")).map((c) => c.name), ["Kick strip"]);
  assert.deepEqual(checkBuild(p, q, pl).filter((x) => x.id === "I51"), []);
});

test("I51 corpus: a kick strip that fits a gap as cut is moved as cut, not turned (kitchen base 30, price unchanged)", () => {
  const q = "kitchen base cabinet 30 wide";
  const p = generateFromPrompt(q);
  const pl = buildPlan(p);
  assert.deepEqual(checkBuild(p, q, pl).filter((x) => x.id === "I51"), [], "a strip on Sheet 1 is never measured against a later sheet's gap");
  // Critic #175: no sheet is saved, so the grain-kept release layout stands (the strip stays on Sheet 2, as cut).
  const kick = pl.sheetNest!.sheets!.sheets.flatMap((s) => s.parts).find((x) => x.name === "Kick strip");
  assert.ok(kick, "kick strip placed");
  assert.deepEqual([kick!.width, kick!.height, kick!.rotated, !!kick!.crossGrain], [28.5, 3.5, false, false]);
  assert.equal(pl.cutList.some((c) => /across the grain/.test(c.notes ?? "")), false);
  assert.equal(pl.totals.estCostUsd.toFixed(2), "159.23");
  // 42" base: the strip fits an earlier gap both as cut and turned; it must go as cut (grain kept, no note).
  const wide = plan("kitchen base cabinet 42 wide");
  const k42 = wide.sheetNest!.sheets!.sheets.flatMap((s) => s.parts).find((x) => x.name === "Kick strip")!;
  assert.deepEqual([k42.rotated, !!k42.crossGrain], [false, false]);
  assert.equal(wide.totals.estCostUsd.toFixed(2), "170.98");
});

test("I51 scope: drawer backs, aprons, bottoms and shelves keep their grain; canaries do not move", () => {
  assert.deepEqual(turned("wardrobe 96 tall with drawers and 2 rods"), [], "drawer back is not a trim strip");
  assert.equal(plan("wardrobe 96 tall with drawers and 2 rods").totals.estCostUsd.toFixed(2), "463.31");
  for (const q of ["bench with a drawer", "wall cabinet 45 wide", "wall mounted wine rack", "filing cabinet 30x30x24 2 doors 2 drawers"]) assert.deepEqual(turned(q), [], q);
  for (const q of ["sink base cabinet 53 wide", "tv stand 48 wide", "bathroom vanity 36 wide"]) assert.ok(turned(q).every((n) => /kick strip|toe ?kick|plinth/i.test(n)), q);
  assert.equal(plan("linen closet 31.5 wide 78 tall 16 deep").totals.estCostUsd.toFixed(2), "193.68");
  assert.equal(plan("pocket vanity").totals.estCostUsd.toFixed(2), "636.23");
  for (const q of ["linen closet 31.5 wide 78 tall 16 deep", "pocket vanity", "bookcase 36 wide"]) {
    assert.deepEqual(turned(q), [], q);
    assert.equal(plan(q).cutList.some((c) => /across the grain/.test(c.notes ?? "")), false, q);
  }
});

test("isTrimStrip: named trim, short enough to turn across a sheet, grain-locked", () => {
  assert.ok(isTrimStrip({ name: "Kick strip", width: 22.5, height: 3.5 }));
  assert.ok(isTrimStrip({ name: "Toekick", width: 34.5, height: 4 }));
  assert.ok(isTrimStrip({ name: "Plinth", width: 3, height: 40 }));
  assert.ok(!isTrimStrip({ name: "Kick strip", width: 58, height: 3.5 }), "too long to turn on a 48\" sheet");
  assert.ok(!isTrimStrip({ name: "Kick strip", width: 12, height: 4 }), "not grain-locked");
  assert.ok(!isTrimStrip({ name: "Drawer back", width: 22.5, height: 3.5 }));
  assert.ok(!isTrimStrip({ name: "Kick support", width: 22.5, height: 3.5 }));
});

test("freeGapSpot: kerf to every part, none at the factory edge", () => {
  const sheet = { width: 96, height: 48, parts: [{ x: 0, y: 0, width: 91.75, height: 48 }] };
  assert.deepEqual(freeGapSpot(sheet, 3.5, 22.5), { x: 91.875, y: 0 });
  assert.deepEqual(freeGapSpot(sheet, 4.125, 48), { x: 91.875, y: 0 });
  assert.equal(freeGapSpot(sheet, 4.2, 10), null, "no room once the kerf is taken");
  assert.equal(freeGapSpot(sheet, 22.5, 3.5), null, "the unturned strip does not fit");
  const two = { width: 96, height: 48, parts: [{ x: 0, y: 0, width: 40, height: 48 }, { x: 50, y: 0, width: 46, height: 48 }] };
  assert.deepEqual(freeGapSpot(two, 9.75, 48), { x: 40.125, y: 0 }, "exactly a kerf each side");
  assert.equal(freeGapSpot(two, 9.8, 48), null);
  const high = { width: 96, height: 48, parts: [{ x: 0, y: 0, width: 96, height: 30 }, { x: 0, y: 40, width: 96, height: 8 }] };
  assert.deepEqual(freeGapSpot(high, 96, 9.75), { x: 0, y: 30.125 });
  assert.equal(freeGapSpot(high, 96, 9.8), null);
});

test("I51: a kick strip goes in a gap on any earlier sheet; a drawer back of the same size opens a sheet", () => {
  const r = nestParts([part("A", "Upright", 91.75, 48), part("G", "Kick strip", 22.5, 3.5)]);
  assert.equal(r.totalSheets, 1);
  const g = r.sheets[0].parts.find((x) => x.id === "G")!;
  assert.deepEqual([g.x, g.y, g.width, g.height, g.rotated, g.crossGrain], [91.875, 0, 3.5, 22.5, true, true]);
  const later = nestParts([part("A", "Side", 96, 48), part("B", "Upright", 91.75, 48), part("G", "Kick strip", 22.5, 3.5)]);
  assert.equal(later.totalSheets, 2, "a gap on any earlier sheet, not only the first");
  assert.ok(later.sheets[1].parts.some((x) => x.id === "G" && x.crossGrain));
  const back = nestParts([part("A", "Upright", 91.75, 48), part("G", "Drawer back", 22.5, 3.5)]);
  assert.equal(back.totalSheets, 2, "only trim strips are turned across the grain");
  assert.deepEqual(i51Gaps(r), []);
  assert.deepEqual(i51Gaps(back), [], "I51 does not ask a drawer back to turn");
});

test("I51 fires when a sheet is opened for a kick strip that fits an earlier sheet's gap (release shape), either turn", () => {
  const A = { id: "A", name: "Upright", label: "A", x: 0, y: 0, width: 91.75, height: 48, rotated: false, material: "m" };
  const G = { id: "G", name: "Kick strip", label: "G", x: 0, y: 0, width: 22.5, height: 3.5, rotated: false, material: "m" };
  const sheet = (index: number, parts: (typeof A)[], material = "m") => ({ index, width: 96, height: 48, material, parts, usedArea: 0, utilization: 0 });
  const bad = { sheets: [sheet(1, [A]), sheet(2, [G])], unplaced: [], totalSheets: 2, averageUtilization: 0 };
  assert.deepEqual(i51Gaps(bad), ["G Kick strip 22.5x3.5 opens Sheet 2 though it fits a free gap on Sheet 1"]);
  assert.deepEqual(i51Gaps({ ...bad, sheets: [sheet(1, [A], "n"), sheet(2, [G])] }), [], "another stock's offcut does not count");
  const p = generateFromPrompt("kitchen base cabinet 24 wide");
  const pl = buildPlan(p);
  assert.equal(checkBuild(p, "kitchen base cabinet 24 wide", { ...pl, sheetNest: { sheets: bad, backer: null } }).filter((x) => x.id === "I51").length, 1);
  assert.equal(checkBuild(p, "kitchen base cabinet 24 wide", { ...pl, sheetNest: { sheets: null, backer: bad } }).filter((x) => x.id === "I51").length, 1, "backer nest checked too");
});

test("I51 (Critic #175): a strip is turned only when that saves a sheet; on a tie the grain-kept layout is used", () => {
  for (const [q, usd] of [["sink base cabinet 51 wide", "428.38"], ["desk organizer", "356.99"], ["bathroom vanity 43 wide", "159.23"], ["kitchen island 48 long 22 deep 36 tall with slat shelf", "303.01"]] as const) {
    assert.deepEqual(turned(q), [], q);
    assert.equal(plan(q).totals.estCostUsd.toFixed(2), usd, q);
    assert.equal(plan(q).cutList.some((c) => /across the grain/.test(c.notes ?? "")), false, q);
  }
  const tie = nestParts([part("A", "Upright", 91.75, 48), part("B", "Side", 96, 30), part("G", "Kick strip", 22.5, 3.5), part("H", "Kick strip", 22.5, 3.5)]);
  assert.equal(tie.totalSheets, 2);
  assert.ok(tie.sheets.flatMap((s) => s.parts).every((x) => !x.crossGrain), "two sheets either way: no strip turned");
  assert.equal(nestParts([part("A", "Upright", 91.75, 48), part("G", "Kick strip", 22.5, 3.5)]).sheets[0].parts.find((x) => x.id === "G")?.crossGrain, true, "a saved sheet still turns the strip");
});

test("I51 (Critic #175): a row with only some pieces turned says how many", () => {
  const nest = { sheets: [{ index: 1, width: 96, height: 48, material: "m", usedArea: 0, utilization: 0, parts: [
    { id: "G-0", name: "Kick strip", label: "G", x: 0, y: 0, width: 3.5, height: 22.5, rotated: true, crossGrain: true, material: "m" },
    { id: "G-1", name: "Kick strip", label: "G", x: 10, y: 0, width: 22.5, height: 3.5, rotated: false, material: "m" }] }], unplaced: [], totalSheets: 1, averageUtilization: 0 };
  const [row] = flagCrossGrain([{ label: "G", name: "Kick strip", quantity: 2 } as never], nest as never);
  assert.equal((row as { notes?: string }).notes, "Cut 1 of 2 across the grain from a sheet offcut");
});

test("freeGapSpot (Critic #175): a kerf to the left as well (a part ending just short of the spot)", () => {
  const sheet = { width: 96, height: 48, parts: [{ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 20, width: 10.05, height: 10 }] };
  assert.deepEqual(freeGapSpot(sheet, 5, 48), { x: 10.175, y: 0 });
});

test("I51 (Critic #175): a saved sheet keeps the strip's grain when an earlier gap takes it as cut", () => {
  for (const [q, usd] of [["kitchen base cabinet 49 wide", "170.98"], ["bathroom vanity 76 wide", "159.23"], ["sink base cabinet 88 wide", "491.79"]] as const) {
    assert.equal(plan(q).totals.estCostUsd.toFixed(2), usd, q);
    assert.deepEqual(turned(q), [], q);
  }
});
