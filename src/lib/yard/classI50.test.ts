/** I50: each plywood Buy row buys the sheet layout's count for its own stock and size (a stand's 1/2" skirt and 3/4" top). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";

const STANDS: string[] = JSON.parse(readFileSync(new URL("../../../evals/corpus/sheet-stocks.json", import.meta.url), "utf8")).prompts.map((p: { prompt: string }) => p.prompt);
const hits = (q: string, ids: string[]) => {
  const p = generateFromPrompt(q);
  return checkBuild(p, q, buildPlan(p)).filter((x) => ids.includes(x.id)).map((x) => `${x.id} ${x.msg}`);
};

test("I50: every two-stock stand buys each stock's own sheets, all exterior", () => {
  for (const q of [...STANDS, "market stand", "snack stand 60 wide 80 tall 30 deep"]) assert.deepEqual(hits(q, ["I50", "C16"]), [], q);
});

test("I50: lemonade stand buys 15/32\" exterior x2 and 23/32\" exterior x1, $235.48", () => {
  const plan = buildPlan(generateFromPrompt("lemonade stand"));
  const sheets = plan.bom.filter((b) => /^plywood-/.test(b.catalogId ?? "")).map((b) => `${b.name} x${b.quantity}`);
  assert.deepEqual(sheets, ['15/32" BC exterior plywood 4×8 x2', '23/32" BC exterior plywood 4×8 x1']);
  assert.equal(plan.totals.estCostUsd, 235.48);
});

test("I50: single-stock builds stay clean", () => {
  for (const q of ["bookcase 36 wide", "linen closet 31.5 wide 78 tall 16 deep", "wardrobe 48 wide 84 tall"]) assert.deepEqual(hits(q, ["I50"]), [], q);
});

test("I50 fires on a Buy that does not match the layout per stock (release shape, missing row, off by one, under-buy)", () => {
  const q = "lemonade stand";
  const p = generateFromPrompt(q);
  const plan = buildPlan(p);
  const half = plan.bom.find((b) => b.catalogId === "plywood-1-2-4x8")!;
  const three = plan.bom.find((b) => b.catalogId === "plywood-3-4-4x8")!;
  assert.ok(half && three, "stand buys a 1/2\" and a 3/4\" row");
  const i50 = (bom: typeof plan.bom) => checkBuild(p, q, { ...plan, bom }).filter((x) => x.id === "I50").map((x) => x.msg);
  const others = plan.bom.filter((b) => b !== half && b !== three);
  // Release: the 1/2" row took all 3 layout sheets.
  assert.deepEqual(i50([{ ...half, quantity: 3 }, three, ...others]), ["Buy lists 3 plywood-1-2-4x8 sheet(s); the sheet layout draws 2"]);
  // A stock the layout draws with no Buy row (an under-buy).
  assert.deepEqual(i50([half, ...others]), ["Buy lists 0 plywood-3-4-4x8 sheet(s); the sheet layout draws 1"]);
  // One sheet short.
  assert.deepEqual(i50([{ ...half, quantity: 1 }, three, ...others]), ["Buy lists 1 plywood-1-2-4x8 sheet(s); the sheet layout draws 2"]);
  // The right count bought in the wrong thickness.
  assert.deepEqual(i50([{ ...half, catalogId: "plywood-3-4-4x8" }, three, ...others]).sort(), ["Buy lists 0 plywood-1-2-4x8 sheet(s); the sheet layout draws 2", "Buy lists 3 plywood-3-4-4x8 sheet(s); the sheet layout draws 1"]);
  assert.deepEqual(i50(plan.bom), []);
});

test("I50 fix stays inside the approved selling-stand scope", () => {
  const rows = (q: string, mat?: string) => {
    const plan = buildPlan(mat ? generateFromPrompt(q, mat) : generateFromPrompt(q));
    return { sheets: plan.bom.filter((b) => /^plywood-/.test(b.catalogId ?? "")).map((b) => `${b.name} x${b.quantity}`), usd: plan.totals.estCostUsd, notes: plan.bom.map((b) => b.notes ?? "") };
  };
  // A two-stock layout outside the stand family keeps release's Buy (its own price change is not approved).
  assert.deepEqual(rows("bench 130 wide", "plywood-1-2-4x8"), { ...rows("bench 130 wide", "plywood-1-2-4x8"), sheets: ['1/2" Plywood 4×8 x3', '3/4" Plywood 4×10 x1'], usd: 230.84 });
  // A stand whose 1/2" parts need a 4×10 (no 1/2" 4×10 in the catalog) keeps release's Buy, never a merged 3/4" row.
  const wide = rows("lemonade stand 108 wide");
  assert.deepEqual(wide.sheets, ['15/32" BC exterior plywood 4×8 x3', '3/4" Plywood 4×10 x3']);
  assert.equal(wide.usd, 480.78);
  assert.ok(wide.notes.every((n) => (n.match(/From nest/g) ?? []).length <= 1), "one layout note per Buy row");
});
