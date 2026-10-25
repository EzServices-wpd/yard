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
