/** Tests for the grade kit's probe record, Buy audit and stock-switch check (scripts/probe-record.ts). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as catalog from "../src/lib/yard/catalog.ts";
import { loadEngine, offline } from "./eval-gate-lib.ts";
import { audit, flagClass, hash, probe, switchCheck } from "./probe-record.ts";

const LINEN = "linen closet 31.5 wide 78 tall 16 deep";

test("a real build gives the same record and hash twice, with every field Critic's dumps hash", async () => {
  const E = await loadEngine();
  const a = probe(E, catalog, offline, LINEN), b = probe(E, catalog, offline, LINEN);
  assert.equal(a.rec.err, undefined);
  assert.equal(hash(a.rec), hash(b.rec));
  assert.deepEqual(Object.keys(a.rec), ["title", "refused", "notes", "overall", "prim", "panels", "bom", "steps", "cut", "totals", "nest", "backer", "unplaced", "inv"]);
  assert.deepEqual(a.a.filter((f) => !f.startsWith("UNAUDITABLE")), [], "the linen canary audits clean");
  const sw = probe(E, catalog, offline, LINEN, "plywood-1-2-4x8");
  assert.equal(sw.rec.err, undefined);
  assert.ok(Array.isArray(switchCheck(catalog, a.rec, sw.rec, "plywood-1-2-4x8")));
});

test("an engine that throws gives { err } and no audit", () => {
  const E: any = { generateFromPrompt: () => { throw new Error("boom"); } };
  assert.deepEqual(probe(E, catalog, offline, "x"), { rec: { err: "boom" }, a: [] });
});

// ---- synthetic audit (fake catalog: a 96" board 3.5" wide, a 12" stick sold in packs, a sheet)
const cat = { getCatalogItem: (id: string) => ({
  board: { formFactor: "board", dims: { length: 96, width: 3.5, height: 1.5 } },
  stick: { formFactor: "stick", dims: { length: 12, width: 0.2, thickness: 0.2 } },
  ply: { formFactor: "sheet", dims: { length: 96, width: 48, thickness: 0.5 } },
  ply34: { formFactor: "sheet", dims: { length: 96, width: 48, thickness: 0.75 } },
} as any)[id] };
const plan = (bom: any[], cutList: any[], extra: any = {}) => ({ bom, cutList, totals: { pieces: cutList.reduce((s, c) => s + c.quantity, 0), estCostUsd: bom.reduce((s, b) => s + b.estimatedCost, 0) }, ...extra });
const board = (q: number) => ({ name: "2x4", quantity: q, unit: "boards", catalogId: "board", estimatedCost: 4 * q });
const cut = (id: string, quantity: number, lengthIn: number, widthIn = 3.5) => ({ id: `${id}|Leg|${lengthIn}`, name: "Leg", quantity, lengthIn, widthIn });

test("lumber coverage: under-buy flags, one extra board or 10% is allowed, more over-buy flags", () => {
  const cuts = [cut("board", 4, 47.9)]; // two 47.9" pieces + kerf per 96" board: needs 2
  assert.deepEqual(audit(cat, plan([board(2)], cuts)), []);
  assert.deepEqual(audit(cat, plan([board(3)], cuts)), [], "one extra board is allowed");
  assert.match(audit(cat, plan([board(1)], cuts)).join(), /^stock under 2x4: buys 1 < needs 2/);
  assert.match(audit(cat, plan([board(4)], cuts)).join(), /^stock over 2x4: buys 4 for 2 \(allowed \+1\)/);
  assert.match(audit(cat, plan([board(9)], [cut("board", 1, 48, 24)])).join(), /stock over 2x4: buys 9 for 7/, "a 24\" wide glue-up is 7 strips of 48\", one per board with kerf");
  assert.match(audit(cat, plan([board(3)], [cut("board", 1, 100)])).join(), /1 pieces longer than 96"/);
});

test("stick packs: the pack line must cover the pieces used; packs allow one extra pack", () => {
  const line = (q: number, used: number) => ({ name: "Stick", quantity: q, unit: `pack of 50 (${used} sticks used)`, catalogId: "stick", estimatedCost: 3 * q });
  const whole = (n: number) => [{ id: "stick", name: "Stick", quantity: n, lengthIn: 12, widthIn: 0.2, whole: true }];
  assert.deepEqual(audit(cat, plan([line(2, 80)], whole(80))), []);
  assert.deepEqual(audit(cat, plan([line(1, 80)], whole(80))).sort(), ["pack Stick: 1x50 != ceil(80/50)", "stock under Stick: buys 50 < needs 80 (used)"]);
  assert.deepEqual(audit(cat, plan([line(4, 80)], whole(80))).sort(), ["pack Stick: 4x50 != ceil(80/50)", "stock over Stick: buys 200 for 80 (allowed +50)"]);
});

test("without \"(N used)\", first-fit adds a 1/8\" kerf per cut", () => {
  assert.match(audit(cat, plan([board(2)], [cut("board", 4, 48)])).join(), /^stock under 2x4: buys 2 < needs 4 \(first-fit\)/, "two 48\" cuts don't fit a 96\" board with kerf");
  assert.deepEqual(audit(cat, plan([board(4)], [cut("board", 4, 48)])), []);
});

test("the engine's \"(N used)\" is the need; only cut pieces that can't fit in N flag", () => {
  const line = (q: number, used: number) => ({ name: "Giant", quantity: q, unit: `pack of 25 (${used} sticks used)`, catalogId: "stick", estimatedCost: 5 * q });
  const pieces = [{ id: "stick|Rib|6", name: "Rib", quantity: 200, lengthIn: 6, widthIn: 0.2 }]; // first-fit packs these into 100 sticks
  assert.deepEqual(audit(cat, plan([line(6, 130)], pieces)), [], "130 used is the need: 6 packs of 25 is one extra pack, not an over-buy");
  assert.deepEqual(audit(cat, plan([line(4, 90)], pieces)), ["stock used Giant: cut pieces need 100 > 90 used"]);
});

test("sheets vs nest, pieces vs cut list, total vs Buy sum, and unauditable pack lines", () => {
  const ply = { name: "1/2 ply", quantity: 2, unit: "sheets", catalogId: "ply", estimatedCost: 80 };
  const screws = { name: "screws", quantity: 1, unit: "box (50 ct)", catalogId: "screws", estimatedCost: 9 };
  const p = plan([ply, screws], [cut("ply", 3, 30, 20)], { sheetNest: { sheets: { sheets: [{}, {}] } } });
  assert.deepEqual(audit(cat, p), ["UNAUDITABLE screws (box (50 ct))"]);
  assert.deepEqual(audit(cat, { ...p, sheetNest: { sheets: { sheets: [{}] } }, totals: { pieces: 4, estCostUsd: 90 } }),
    ["sheet lines 2 != nest sheets 1", "pieces 4 != cut list 3", "total $90 != Buy sum $89", "UNAUDITABLE screws (box (50 ct))"]);
});

// ---- synthetic switch check (row 672): default build on 3/4" (prim ply34), switched to 1/2" (dt 0.25, tolerance 0.51)
const panel = (name: string, w: number, h: number, d: number) => ["shelf", name, "ply34", null, { width: w, height: h, depth: d }, 0];
const rec = (panels: any[], cut: any[] = [{ n: "Shelf", th: 0.5 }], bom: any[] = [{ id: "ply" }]) => ({ prim: "ply34", refused: null, panels, cut, bom });

test("switch check: inside growth on one axis up to 2x the thickness change passes (the row 672 false positive)", () => {
  const base = rec([panel("Shelf", 15.5, 0.75, 18.875)]);
  assert.deepEqual(switchCheck(cat, base, rec([panel("Shelf", 15.5, 0.5, 19.125)]), "ply"), []);
  assert.deepEqual(switchCheck(cat, base, rec([panel("Shelf", 15.5, 0.5, 19.385)]), "ply"), [], "0.51 is the edge");
  assert.match(switchCheck(cat, base, rec([panel("Shelf", 15.5, 0.5, 19.5)]), "ply").join(), /^size Shelf/, "more than 2x the change flags");
  assert.match(switchCheck(cat, base, rec([panel("Shelf", 15.75, 0.5, 19.125)]), "ply").join(), /^size Shelf/, "two axes moving flags");
});

test("switch check: the three real classes are reported, and a switch that errors is one flag", () => {
  const base = rec([panel("Shelf", 15.5, 0.75, 18.875)]);
  assert.deepEqual(switchCheck(cat, base, rec([panel("Shelf", 15.5, 0.5, 18.875), panel("Shelf 2", 15.5, 0.5, 18.875)]), "ply"), ["panels 1 -> 2"]);
  assert.deepEqual(switchCheck(cat, base, rec([panel("Shelf", 15.5, 0.5, 18.875)], [{ n: "Shelf", th: 0.5 }, { n: "Top", th: 0.5 }]), "ply"), ["cut lines 1 -> 2"]);
  assert.deepEqual(switchCheck(cat, base, rec([panel("Shelf", 15.5, 0.5, 18.875)], [{ n: "Arcade", th: 0.625 }]), "ply"), ["cut part thickness 0.625 not on Buy (Arcade)"]);
  assert.deepEqual(switchCheck(cat, base, { err: "boom" }, "ply"), ["switch build errors"]);
  assert.deepEqual(switchCheck(cat, { err: "x" }, { err: "y" }, "ply"), []);
});

test("flag classes drop numbers and keep names", () => {
  assert.equal(flagClass("stock over 2x4: buys 9 for 7 (allowed +1)"), "stock over NxN: buys N for N (allowed +N)");
  assert.equal(flagClass("cut part thickness 0.625 not on Buy (Arcade)"), "cut part thickness N not on Buy (Arcade)");
});
