/**
 * PDF typed words (Critic release-1022 row 164, as a class; YARD-SPEC rule 1): the cover's "You asked for" quotes the
 * words the person typed (fractions and ft-in as typed), never the engine's normalized prompt ("2.125", "66\"").
 * Same rule as the prompt bar and the build info (typedPrompt ?? prompt). Built and refused builds both.
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { jsPDF } from "jspdf";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { buildPlanPdf } from "../src/lib/yard/pdf";

const pdfText = (doc: jsPDF) =>
  [...Buffer.from(doc.output("arraybuffer") as ArrayBuffer).toString("latin1").matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((m) => m[1].replace(/\\(.)/g, "$1"));

const PROMPTS = [
  "abacus 2 1/8 wide 9 rods", // refused
  "bookcase 1/2 wide", // refused
  "shelf 24 1/2 wide",
  "bookcase 5ft6in tall",
  "nightstand 22-1/2 wide",
  "linen closet 31.5 wide 78 tall 16 deep", // typed as decimals: stays as typed
];

for (const q of PROMPTS) {
  test(`${q}: the PDF's "You asked for" quotes the typed words`, () => {
    const p = generateFromPrompt(q);
    const flat = pdfText(buildPlanPdf(p, buildPlan(p))).join(" ");
    assert.ok(flat.includes(`You asked for: "${q}"`), `${q}: got ${flat.match(/You asked for: "[^"]*"/)?.[0] ?? "no 'You asked for' line"}`);
  });
}
