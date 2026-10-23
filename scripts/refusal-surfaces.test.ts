/**
 * Refusal surfaces (Critic #93 merge recheck, VERDICT-merge.md item 4): a refused build's PDF never states a size it
 * didn't build. The cover subline says nothing was built and the smallest size the refusal names; no drawing labels
 * a 0" dimension. (Before: '2 1/8" wide · 10" tall and 3 1/2" deep assumed, measure to lock', and 0" dimension lines.)
 * The tab title is checked as rendered in scripts/e2e/refusal-surfaces.py.
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { jsPDF } from "jspdf";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { buildPlanPdf, refusedSubline } from "../src/lib/yard/pdf";

const pdfText = (doc: jsPDF) =>
  [...Buffer.from(doc.output("arraybuffer") as ArrayBuffer).toString("latin1").matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((m) => m[1].replace(/\\(.)/g, "$1"));

// Expected minimums from the refusal rules themselves (9 rods × 9/16" + ends; two 3/4" panels + a 3 3/4" opening a hand
// reaches into, usableFloors.ts).
const CASES: [string, string][] = [
  ["abacus 2 1/8 wide 9 rods", 'Nothing built · needs at least 6 9/16" wide'],
  ["bookcase 1/2 wide", 'Nothing built · needs at least 5 1/4" wide'],
];

for (const [prompt, want] of CASES) {
  test(`${prompt}: the refused PDF says nothing was built and the minimum, never an assumed size or 0"`, () => {
    const p = generateFromPrompt(prompt);
    assert.ok(p.refused && !p.panels.length, `${prompt} is not refused`);
    const t = pdfText(buildPlanPdf(p, buildPlan(p)));
    assert.ok(t.includes(want), `${prompt}: cover subline missing ${want}; got ${t.slice(0, 8).join(" | ")}`);
    const flat = t.join(" ");
    assert.doesNotMatch(flat, /assumed|measure to lock/i, `${prompt}: an assumed size on a refusal`);
    assert.ok(!t.some((s) => /^0"$/.test(s.trim())), `${prompt}: a 0" dimension label`);
  });
}

test("refusedSubline: the minimum when the refusal names one, else just 'Nothing built'", () => {
  assert.equal(refusedSubline('A 9-rod abacus needs 6 9/16" wide. Nothing is built.'), 'Nothing built · needs at least 6 9/16" wide');
  assert.equal(refusedSubline("Nothing fits here."), "Nothing built");
});
