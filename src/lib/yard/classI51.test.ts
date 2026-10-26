/** I51: no sheet is opened for a part that fits a free gap of an earlier sheet (kick strip alone on Sheet 2 of a 24" base). */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild, i51Gaps } from "./invariants";
import { freeGapSpot, nestParts, type NestPart } from "./nesting";

const plan = (q: string) => buildPlan(generateFromPrompt(q));
const part = (id: string, width: number, height: number, allowRotate = height / width > 0.25): NestPart => ({ id, name: id, label: id, width, height, material: "3/4\" plywood", allowRotate });

test("I51: 24\" kitchen base cabinet nests on one sheet, kick strip turned into the offcut and flagged, $98.83 (Ezra Oct 26)", () => {
  const q = "kitchen base cabinet 24 wide";
  const p = generateFromPrompt(q);
  const pl = buildPlan(p);
  assert.equal(pl.sheetNest?.sheets?.totalSheets, 1);
  assert.equal(pl.totals.estCostUsd.toFixed(2), "98.83");
  const kick = pl.sheetNest!.sheets!.sheets[0].parts.find((x) => /kick/i.test(x.name));
  assert.ok(kick?.crossGrain && kick.rotated, "kick strip turned across the grain");
  assert.match(pl.cutList.find((c) => /kick/i.test(c.name))?.notes ?? "", /across the grain/);
  assert.deepEqual(checkBuild(p, q, pl).filter((x) => x.id === "I51"), []);
});

test("I51 scope: linen $193.68 and pocket vanity $636.23 do not move, and only turned strips get the grain note", () => {
  assert.equal(plan("linen closet 31.5 wide 78 tall 16 deep").totals.estCostUsd.toFixed(2), "193.68");
  assert.equal(plan("pocket vanity").totals.estCostUsd.toFixed(2), "636.23");
  for (const q of ["linen closet 31.5 wide 78 tall 16 deep", "pocket vanity", "bookcase 36 wide"]) {
    const pl = plan(q);
    assert.equal(pl.sheetNest?.sheets?.sheets.some((s) => s.parts.some((x) => x.crossGrain)), false, q);
    assert.equal(pl.cutList.some((c) => /across the grain/.test(c.notes ?? "")), false, q);
  }
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

test("I51: a grain-locked strip goes in an earlier gap, turned only when it must be", () => {
  const big = [part("A", 91.75, 48)];
  const r = nestParts([...big, part("G", 22.5, 3.5)]);
  assert.equal(r.totalSheets, 1);
  const g = r.sheets[0].parts.find((x) => x.id === "G")!;
  assert.deepEqual([g.x, g.y, g.width, g.height, g.rotated, g.crossGrain], [91.875, 0, 3.5, 22.5, true, true]);
  const fits = nestParts([part("A", 96, 40), part("G", 22.5, 3.5), part("B", 96, 40)]);
  for (const s of fits.sheets) for (const x of s.parts) assert.ok(!x.crossGrain, `${x.id} needs no turn`);
  const later = nestParts([part("A", 96, 48), part("B", 91.75, 48), part("G", 22.5, 3.5)]);
  assert.equal(later.totalSheets, 2, "a gap on any earlier sheet, not only the first");
  assert.ok(later.sheets[1].parts.some((x) => x.id === "G" && x.crossGrain));
  assert.deepEqual(i51Gaps(r), []);
  assert.deepEqual(i51Gaps(fits), []);
});

test("I51 fires when a sheet is opened for a part that fits an earlier sheet's gap (release shape), either turn", () => {
  const A = { id: "A", name: "Upright", label: "A", x: 0, y: 0, width: 91.75, height: 48, rotated: false, material: "m" };
  const G = { id: "G", name: "Kick strip", label: "G", x: 0, y: 0, width: 22.5, height: 3.5, rotated: false, material: "m" };
  const sheet = (index: number, parts: (typeof A)[], material = "m", width = 96) => ({ index, width, height: 48, material, parts, usedArea: 0, utilization: 0 });
  const bad = { sheets: [sheet(1, [A]), sheet(2, [G])], unplaced: [], totalSheets: 2, averageUtilization: 0 };
  assert.deepEqual(i51Gaps(bad), ["G Kick strip 22.5x3.5 opens Sheet 2 though it fits a free gap on Sheet 1"]);
  const other = { ...bad, sheets: [sheet(1, [A], "n"), sheet(2, [G])] };
  assert.deepEqual(i51Gaps(other), [], "another stock's offcut does not count");
  const p = generateFromPrompt("kitchen base cabinet 24 wide");
  const pl = buildPlan(p);
  const hits = checkBuild(p, "kitchen base cabinet 24 wide", { ...pl, sheetNest: { sheets: bad, backer: null } }).filter((x) => x.id === "I51");
  assert.equal(hits.length, 1);
  const backer = checkBuild(p, "kitchen base cabinet 24 wide", { ...pl, sheetNest: { sheets: null, backer: bad } }).filter((x) => x.id === "I51");
  assert.equal(backer.length, 1, "backer nest checked too");
});
