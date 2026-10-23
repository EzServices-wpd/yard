/**
 * Row 295 (YARD-SPEC rule 4, switching stock changes thickness only): a restock on the bench sets no axis. Every axis
 * keeps the typed/assumed mark the 3/4" build had, and the size line follows the thinner stock only (the proud fronts
 * are 1/2" now, so an assumed depth that counts them is 1/4" less). Driven through the real store, the way the stock
 * chip calls it. Expected values are hand-worked from the 3/4" builds, not recomputed the way the code does.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { headerTitle } from "./pdf";
import { coverAxesTalk } from "./headerSize";
import { typedAssumedFailures } from "./typedNotAssumed";
import type { YardProject } from "./types";

(globalThis as { window?: unknown }).window = { setTimeout, clearTimeout, location: { search: "" } };
const { useYard } = await import("./store");

const HALF = "plywood-1-2-4x8";
const marks = (p: YardProject) => (["width", "height", "depth"] as const).map((a) => `${a}:${p.spec!.size[a].typed ? "typed" : "untyped"}/${p.spec!.size[a].assumed ? "assumed" : "-"}${p.spec!.size[a].edited ? "/edited" : ""}`);
function restock(q: string) {
  useYard.getState().generate(q);
  const before = useYard.getState().project;
  useYard.getState().generate(before.prompt || q, HALF, undefined, { restock: true, keepView: true });
  const after = useYard.getState().project;
  assert.equal(after.primaryMaterialId, HALF, q);
  // The record: no axis is edited by a restock, and each keeps the mark it had at 3/4".
  assert.deepEqual(marks(after), marks(before), q);
  return { before, after, title: headerTitle(after, { features: false }), cover: coverAxesTalk(after).subtitle, i42: typedAssumedFailures(after, q) };
}
// Row 298 (pre-existing, its own PR): the 1/2" stamp thins a side in place, so the drawn width is 1/4" under the
// typed width on every 1/2" carcass, fresh or restocked. I42 reports it honestly; nothing here hides it.
const row298 = (m: string) => /^PDF cover says \d+" wide, its drawing tag \d+ 3\/4"$/.test(m);

test("row 295 desk 60 wide: depth stays assumed and counts the 1/2\" proud fronts (24 1/2, was 24 3/4 at 3/4\")", () => {
  const r = restock("desk 60 wide");
  assert.equal(r.title, 'Desk · 60" W × 24 1/2" D × 29" H (D, H assumed)');
  assert.equal(r.cover, '60" wide · 29" tall and 24 1/2" deep assumed, measure to lock · drawer fronts stand proud');
  assert.deepEqual(r.i42, []);
});

test("row 295 bathroom vanity 36 wide: depth stays assumed at 21 1/2 (fronts proud), never a typed 21", () => {
  const r = restock("bathroom vanity 36 wide");
  assert.equal(r.title, 'Vanity 36" wide · 36" W × 21 1/2" D × 34" H (D, H assumed)');
  // #113 builds the vanity as a sink base with doors, so its proud fronts are doors (same note at 3/4").
  assert.equal(r.cover, '36" wide · 34" tall and 21 1/2" deep assumed, measure to lock · doors stand proud');
  assert.match(coverAxesTalk(r.before).subtitle, / · doors stand proud$/);
  // #113's sink base thins its sides in place too: the only I42 left is the row-298 geometry (cover 36, tag 35 3/4).
  assert.deepEqual(r.i42.filter((m) => !row298(m)), []);
  assert.deepEqual(r.i42, ['PDF cover says 36" wide, its drawing tag 35 3/4"']);
});

test("row 295 nightstand 20 wide 24 tall: depth stays assumed at 16 1/2, never a typed 16; typed W and H stay typed", () => {
  const r = restock("nightstand 20 wide 24 tall");
  assert.equal(r.title, 'Nightstand · 20" W × 16 1/2" D × 24" H (D assumed)');
  assert.equal(r.cover, '20" wide x 24" tall · 16 1/2" deep assumed, measure to lock · drawer fronts stand proud');
  // The spec now marks no width as edited, so the only I42 left is the row-298 geometry (cover 20, tag 19 3/4).
  assert.deepEqual(r.i42.filter((m) => !row298(m)), []);
  assert.deepEqual(r.i42, ['PDF cover says 20" wide, its drawing tag 19 3/4"']);
});

test("row 295 bookcase 36 wide 72 tall 12 deep: all three stay typed, nothing edited, the cover is the 3/4\" build's", () => {
  const r = restock("bookcase 36 wide 72 tall 12 deep");
  assert.equal(r.title, 'Bookcase · 36" W × 12" D × 72" H');
  assert.equal(r.cover, '36" wide x 72" tall x 12" deep');
  assert.deepEqual(r.i42.filter((m) => !row298(m)), []);
  assert.deepEqual(r.i42, ['PDF cover says 36" wide, its drawing tag 35 3/4"']);
});

test("row 295 family sweep: an untyped carcass restocked keeps every axis assumed on the header too (dresser, wardrobe, linen)", () => {
  // These rebuild from the bench's unit, whose notes no longer say what was assumed: the header reads the spec.
  for (const [q, want] of [
    ["dresser", 'Dresser · 35 3/4" W × 18 1/2" D × 36" H (size assumed)'],
    ["wardrobe", 'Wardrobe · 35 15/16" W × 16 1/2" D × 84" H (size assumed)'],
  ] as const) {
    const r = restock(q);
    assert.equal(r.title, want, q);
    assert.match(r.cover, / deep assumed, measure to lock · (?:drawer fronts|doors) stand proud$/, q);
  }
  assert.match(restock("linen closet").title, /× 16 1\/2" D × 78" H \(size assumed\)$/);
});
