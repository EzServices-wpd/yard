/**
 * Critic row 292 (safety): freestanding casework over 30" tall or with drawers buys an anti-tip kit and straps it to a
 * wall stud in a step that carries the kit by id ({ id, qty }, qty = Buy's). Tall bookcases, wardrobes, linen and pantry towers and dressers had none.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ANTI_TIP_ROW, needsAntiTip } from "./antiTip";
import { i46 } from "./invariants";
import { ANTI_TIP_ID, fastenerId } from "./wallAnchorSteps";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;

const kitAndStrap = (q: string) => {
  const p = generateFromPrompt(q);
  const pl = buildPlan(p);
  const kits = pl.bom.filter((b) => /anti-tip/i.test(b.name));
  const straps = pl.instructions.filter((s) => (s.fastenersUsed ?? []).some((f) => f.id === ANTI_TIP_ID));
  return { p, pl, kits, straps };
};

test("row 292: tall freestanding casework and dressers buy one anti-tip kit and a step that straps it", () => {
  for (const q of ["freestanding 2x4 garage shelves 72 tall", "coat bench", "bookcase", "bookshelf", "tall bookcase 96 tall", "bookcase with doors 36 wide 72 tall", "wardrobe", "linen cabinet", "pantry cabinet", "dresser", "6 drawer dresser", "tall dresser with 5 drawers", "chest of drawers 30 wide 44 tall", "file cabinet"]) {
    const { p, pl, kits, straps } = kitAndStrap(q);
    assert.ok(needsAntiTip(p), `${q}: ${p.name} ${p.overall.height}" ${p.assumptions.installMode}`);
    assert.equal(kits.length, 1, `${q}: ${pl.bom.map((b) => b.name).join(" | ")}`);
    assert.equal(straps.length, 1, `${q}: ${pl.instructions.map((s) => s.title).join(" | ")}`);
    assert.match(straps[0].description, /stud/);
    assert.deepEqual(straps[0].fastenersUsed, [{ id: ANTI_TIP_ID, qty: kits[0].quantity }], `${q}: step qty = Buy qty`);
    assert.deepEqual(i46(p, pl).map((x) => x.msg), [], `${q}: I46 by id`);
    assert.deepEqual(pl.instructions.map((s) => s.step), pl.instructions.map((_, i) => i + 1));
  }
});

test("row 292: a nightstand with a drawer gets the kit too; short open shelves, beds, islands and wall-hung units are not", () => {
  assert.equal(kitAndStrap("nightstand").kits.length, 1);
  for (const q of ["bunk bed", "kitchen island", "floating shelf 36 wide", "medicine cabinet", "over-toilet shelf", "coffee table", "shoe bench", "rolling bar cart painted black"]) {
    const { kits, straps } = kitAndStrap(q);
    assert.deepEqual([kits.length, straps.length], [0, 0], q);
  }
});

test("row 292: a kit the notes already bought gets its strap step once, never a second kit", () => {
  for (const q of ["vinyl record shelf 36 wide", "simple bookshelf for my kids room"]) {
    const { pl, kits } = kitAndStrap(q);
    assert.equal(kits.length, 1, q);
    assert.equal(pl.instructions.filter((s) => /anti-tip/i.test(`${s.title} ${s.description}`)).length, 1, `${q}: ${pl.instructions.map((s) => s.title).join(" | ")}`);
  }
});

test("row 292: the kit's Buy line is the id the strap step carries, and I46 flags a qty that disagrees", () => {
  assert.equal(fastenerId(ANTI_TIP_ROW), ANTI_TIP_ID);
  const { p, pl } = kitAndStrap("bookcase");
  const off = { ...pl, bom: pl.bom.map((b) => (fastenerId(b) === ANTI_TIP_ID ? { ...b, quantity: 2 } : b)) };
  assert.ok(i46(p, off).some((x) => /Buy lists 2 Furniture anti-tip kit; the steps carry 1/.test(x.msg)));
});
