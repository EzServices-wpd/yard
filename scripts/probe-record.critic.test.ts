/** Critic-proposed failing tests for PR #215 survivors (AUDIT mode: tests, not a fix). Pass on db6cd927; fail on mutants h,h2,h3,i,j,k,r,t. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { audit, hash, record, switchCheck } from "./probe-record.ts";

const E: any = { checkBuild: () => [], headerTitle: () => "T" };
const P = { panels: [], notes: [], overall: { width: 1, height: 1, depth: 1 } };
const PL = (bom: any) => ({ bom: [bom], instructions: [], cutList: [], totals: { pieces: 0, estCostUsd: 2 }, sheetNest: null });
const line = { name: "Stick", quantity: 2, catalogId: "stick", unit: "pack of 50", estimatedCost: 2, notes: "", offers: [{ href: "https://x/a", packPrice: 1, best: true }] };

test("hash is the full 16-hex sha1 of JSON (Critic dumps compare on this exact value)", () => {
  const o = { a: 1, b: [2, "x"] };
  assert.equal(hash(o), createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 16));
  assert.match(hash(o), /^[0-9a-f]{16}$/);
});

test("every Buy field the dumps hash moves the record hash (quantity, cost, unit, offers href/price/best)", () => {
  const h0 = hash(record(E, "q", P, PL(line)));
  for (const b of [{ ...line, quantity: 3 }, { ...line, estimatedCost: 9 }, { ...line, unit: "pack of 25" },
    { ...line, offers: [{ ...line.offers[0], href: "https://x/b" }] }, { ...line, offers: [{ ...line.offers[0], packPrice: 5 }] },
    { ...line, offers: [{ ...line.offers[0], best: false }] }])
    assert.notEqual(hash(record(E, "q", P, PL(b))), h0, JSON.stringify(b));
});

const cat = { getCatalogItem: (id: string) => ({ stick: { formFactor: "stick", dims: { length: 12, width: 0.2, thickness: 0.2 } }, ply: { formFactor: "sheet", dims: { thickness: 0.5 } }, ply34: { formFactor: "sheet", dims: { thickness: 0.75 } } } as any)[id] };
const plan = (bom: any[], cutList: any[]) => ({ bom, cutList, totals: { pieces: cutList.reduce((s, c) => s + c.quantity, 0), estCostUsd: bom.reduce((s, b) => s + b.estimatedCost, 0) } });

test("best offer must cover the used count without an extra pack", () => {
  const l = (packsNeeded: number) => ({ name: "Stick", quantity: 2, unit: "pack of 50 (80 sticks used)", catalogId: "stick", estimatedCost: 6, offers: [{ best: true, packQty: 50, packsNeeded }] });
  const w = [{ id: "stick", name: "Stick", quantity: 80, lengthIn: 12, widthIn: 0.2, whole: true }];
  assert.deepEqual(audit(cat, plan([l(2)], w)), []);
  assert.deepEqual(audit(cat, plan([l(1)], w)), ["pack Stick: best under"]);
  assert.deepEqual(audit(cat, plan([l(3)], w)), ["pack Stick: best over"]);
});

test("whole sticks count toward the fit: 80 whole sticks can't be '40 used'", () => {
  const l = { name: "Stick", quantity: 1, unit: "pack of 50 (40 sticks used)", catalogId: "stick", estimatedCost: 3 };
  assert.deepEqual(audit(cat, plan([l], [{ id: "stick", name: "Stick", quantity: 80, lengthIn: 12, widthIn: 0.2, whole: true }])), ["stock used Stick: cut pieces need 80 > 40 used"]);
});

const panel = (name: string) => ["shelf", name, "ply34", null, { width: 15.5, height: 0.75, depth: 18.875 }, 0];
const rec = (o: any = {}) => ({ prim: "ply34", refused: null, panels: [panel("Shelf")], cut: [{ n: "Shelf", th: 0.5 }], bom: [{ id: "ply" }], ...o });
test("switch check: a refusal flip and a renamed part both flag", () => {
  assert.deepEqual(switchCheck(cat, rec(), rec({ refused: { reason: "x" } }), "ply"), ["refusal differs from default build"]);
  assert.deepEqual(switchCheck(cat, rec(), rec({ panels: [panel("Top")] }), "ply"), ["panel 0 Shelf -> Top"]);
});
