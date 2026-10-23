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
import { buildPlanPdf, headerFeatures, headerTitle, refusedSubline } from "./pdf";
import { stockPillLabel, NOTHING_BUILT_STOCK } from "./stockPill";
import { candidateFromPrint } from "./ideaKeep";
import { envelopeText, nothingBuilt, shownSize } from "./builtSize";
import { refusedOutline } from "./refusedOutline";

const REFUSED = ["bookcase 2 wide", "table 1/2 wide", "jewelry box 1/2 tall", "bookcase 12 tall 5 shelves", "linen closet 2 wide", "abacus 2 1/8 wide 9 rods"];
const SIZE = /\d+(?:\s+\d+\/\d+)?"|\d+\/\d+"|\b\d+(?:\.\d+)?\s*(?:in|inch|inches)\b|["″]\s*[WHD]\b/;
const flat = (t: string) => t.replace(/\\\(|\\\)/g, (m) => m[1]).replace(/\s+/g, " ");
/**
 * A surface's text with the refusal sentence taken out (the one place sizes are named, about the refusal itself), and
 * the PDF cover subline read from it (#130: "Nothing built · needs at least <min>", the refusal's own minimum).
 */
const without = (t: string, refused: string) => flat(t).split(flat(refused)).join(" ").split(refusedSubline(refused)).join(" ");

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
    // Nothing built, so no note about the build rides along: a refusal's notes are empty (#107, tooSmall) or the refusal alone (#90's count rule).
    assert.ok((p.notes ?? []).every((n) => n === p.refused), `notes are only the refusal: ${JSON.stringify(p.notes)}`);
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

it("source guard: every surface that prints a unit line checks nothingBuilt (or reads envelopeText), Measure too", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const x = join(d, f); if (statSync(x).isDirectory()) walk(x); else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(x); } };
  walk(root);
  // Definitions and re-exports; drawings and steps sized from their parts (a refusal has none); recipe cards built
  // by buildRecipe at the recipe's own size (no typed size, so never refused).
  const ALLOW = /(?:builtSize|voiceHonesty|pdfFormat|headerSize|iso|pdfDraw|steps|recipeIdeas)\.ts$/;
  const SIZES = /\b(?:fmtUnitEnvelope(?:Inches)?|headerSize|headerAxes)\(/;
  const unguarded = files.filter((f) => !ALLOW.test(f)).filter((f) => { const t = readFileSync(f, "utf8"); return SIZES.test(t) && !/\b(?:nothingBuilt|envelopeText)\(/.test(t); });
  assert.deepEqual(unguarded.map((f) => f.slice(root.length)), []);
  for (const f of ["components/workspace/measure-panel.tsx", "components/workspace/measure-overlay.tsx", "components/workspace/shell.tsx"]) {
    assert.match(readFileSync(join(root, f), "utf8"), /nothingBuilt\(/, f);
  }
});

it("the Ideas log never records a refused size: no size, never Trusted", async () => {
  const { recordFromPrompt } = await import("./ideaLog.server");
  for (const q of ["bookcase 2 wide", "table 1/2 wide"]) {
    const r = await recordFromPrompt(q);
    assert.equal(r?.size, "", q);
    assert.equal(r?.status, "Failed", q);
  }
  assert.match((await recordFromPrompt("bookcase"))?.size ?? "", /^36×12×84$/);
});
