/**
 * PDF sheet names (Critic row 504, as a class): each structural sheet diagram is headed with the name of the Buy row
 * that buys that sheet (same stock and size key Buy counts by), so the PDF never says '1/2" Plywood 4x8' over a list
 * that buys '15/32" BC exterior plywood 4×8'. A sheet with no Buy row of its own stock keeps its own material.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { jsPDF } from "jspdf";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { buildPlanPdf } from "../src/lib/yard/pdf";
import { sheetBuyName } from "../src/lib/yard/nesting";
import { clean } from "../src/lib/yard/pdfKit";

const pdfText = (doc: jsPDF) =>
  [...Buffer.from(doc.output("arraybuffer") as ArrayBuffer).toString("latin1").matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((m) => m[1].replace(/\\(.)/g, "$1"));
const headers = (flat: string[]) => flat.filter((t) => /^Sheet \d+( of \d+)?  ·  /.test(t)).map((t) => t.split("  ·  ")[1]);

const CORPUS: string[] = JSON.parse(readFileSync(new URL("../evals/corpus/sheet-stocks.json", import.meta.url), "utf8")).prompts.map((p: { prompt: string }) => p.prompt);
const PROMPTS = [...CORPUS, "lemonade stand 108 wide", "outdoor bench", "linen closet 31.5 wide 78 tall 16 deep", "pocket vanity", "bookcase 36 wide"];

for (const q of PROMPTS) {
  test(`${q}: every structural sheet header names its own Buy row`, () => {
    const p = generateFromPrompt(q);
    const plan = buildPlan(p);
    const sheets = plan.sheetNest?.sheets?.sheets ?? [];
    assert.ok(sheets.length, `${q}: has a sheet layout`);
    const want = sheets.map((s) => clean(sheetBuyName(s, plan.bom) ?? s.material));
    const got = headers(pdfText(buildPlanPdf(p, plan))).slice(0, sheets.length);
    assert.deepEqual(got, want, q);
    const buyNames = new Set(plan.bom.map((b) => b.name));
    for (const [i, s] of sheets.entries()) if (sheetBuyName(s, plan.bom)) assert.ok(buyNames.has(sheetBuyName(s, plan.bom)!), `${q} sheet ${i + 1}`);
  });
}

test("lemonade stand: the PDF heads its sheets with the Buy list's exterior names, never the generic stock", () => {
  const p = generateFromPrompt("lemonade stand");
  const got = headers(pdfText(buildPlanPdf(p, buildPlan(p))));
  assert.deepEqual(got.slice(0, 3), ['15/32" BC exterior plywood 4×8', '15/32" BC exterior plywood 4×8', '23/32" BC exterior plywood 4×8'].map(clean));
});

test("a sheet whose stock and size has no Buy row keeps its own material (lemonade stand 108 wide: no 1/2\" 4×10)", () => {
  const plan = buildPlan(generateFromPrompt("lemonade stand 108 wide"));
  const tenHalf = (plan.sheetNest?.sheets?.sheets ?? []).filter((s) => s.width > 96 && /1\/2/.test(s.material));
  assert.ok(tenHalf.length, "108 wide lays 1/2\" parts on 4×10");
  for (const s of tenHalf) assert.equal(sheetBuyName(s, plan.bom), null);
});
