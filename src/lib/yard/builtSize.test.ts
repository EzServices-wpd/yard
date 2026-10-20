/**
 * No surface shows a size for something not built (SWE 2 on #103 r2): the Measure chip and panel, the header, the PDF,
 * the plan text, a saved idea and the notes. The refusal sentence names the sizes it is about; the faint outline is
 * the size typed, labeled so (refusedOutline.ts). Both kinds of refusal: a size too small to use (#103) and a count
 * that doesn't fit (#90). Plus a source guard: every unit-line formatter call goes through builtSize.ts.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateFromPrompt } from "./promptMain";
import { buildPlan, planToMarkdown } from "./report";
import { buildPlanPdf, headerFeatures, headerTitle } from "./pdf";
import { stockPillLabel, NOTHING_BUILT_STOCK } from "./stockPill";
import { candidateFromPrint } from "./ideaKeep";
import { envelopeText, nothingBuilt, shownSize } from "./builtSize";
import { refusedOutline } from "./refusedOutline";

const REFUSED = ["bookcase 2 wide", "table 1/2 wide", "jewelry box 1/2 tall", "bookcase 12 tall 5 shelves", "linen closet 2 wide", "abacus 2 1/8 wide 9 rods"];
const SIZE = /\d+(?:\s+\d+\/\d+)?"|\d+\/\d+"|\b\d+(?:\.\d+)?\s*(?:in|inch|inches)\b|["″]\s*[WHD]\b/;
const flat = (t: string) => t.replace(/\\\(|\\\)/g, (m) => m[1]).replace(/\s+/g, " ");
/** A surface's text with the refusal sentence taken out (the one place sizes are named, about the refusal itself). */
const without = (t: string, refused: string) => flat(t).split(flat(refused)).join(" ");

for (const prompt of REFUSED) {
  it(`${prompt}: refused, and no surface shows a size`, () => {
    const p = generateFromPrompt(prompt);
    assert.ok(p.refused && nothingBuilt(p), prompt);
    const plan = buildPlan(p);
    assert.equal(shownSize(p), null);
    assert.equal(envelopeText(p), null, "Measure chip, export header, plan drawer");
    assert.doesNotMatch(headerTitle(p), /\d/, "header");
    assert.deepEqual(headerFeatures(p), [], "header features");
    assert.equal(stockPillLabel(p, plan).label, NOTHING_BUILT_STOCK, "stock pill");
    assert.deepEqual(p.notes, [p.refused], "notes are the refusal alone");
    assert.equal(p.cardNote, p.refused);
    assert.doesNotMatch(candidateFromPrint(p, plan).size ?? "", SIZE, "saved idea");
    const pdf = [...buildPlanPdf(p, plan).output().matchAll(/\((.*?)\) Tj/g)].map((m) => m[1]).join(" ");
    assert.doesNotMatch(without(pdf, p.refused!), SIZE, `PDF: ${flat(pdf)}`);
    assert.doesNotMatch(without(planToMarkdown(p, plan), p.refused!), SIZE, "plan text");
    // The one exception: the faint outline of the size typed.
    assert.ok(refusedOutline(p), "outline of the size typed");
  });
}

it("a build still shows its size everywhere", () => {
  const p = generateFromPrompt("bookcase");
  assert.ok(!nothingBuilt(p));
  assert.match(envelopeText(p) ?? "", /36/);
  assert.equal(refusedOutline(p), null);
});

it("source guard: every unit line goes through builtSize.ts, and Measure checks nothingBuilt", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const x = join(d, f); if (statSync(x).isDirectory()) walk(x); else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(x); } };
  walk(root);
  // The formatter's own definitions, its re-export, and the iso drawing (sized from its parts' box: no parts, no box).
  const ALLOW = /(?:builtSize|voiceHonesty|pdfFormat|iso)\.ts$/;
  const calls = files.filter((f) => !ALLOW.test(f) && /\bfmtUnitEnvelope(?:Inches)?\(/.test(readFileSync(f, "utf8")));
  assert.deepEqual(calls.map((f) => f.slice(root.length)), []);
  for (const f of ["components/workspace/measure-panel.tsx", "components/workspace/measure-overlay.tsx", "components/workspace/shell.tsx"]) {
    assert.match(readFileSync(join(root, f), "utf8"), /nothingBuilt\(/, f);
  }
});
