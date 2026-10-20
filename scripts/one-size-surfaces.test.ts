/**
 * One size source, every surface (Critic #93 rows 108/109). For a set of cabinet builds, every place the build's size
 * prints reads the header's own W × D × H: the header, the bench readout, the PDF cover title and every running head,
 * the cover drawing's dimension lines, the Check it drawing and the plan overview. The cover subline is words
 * ("wide · tall · deep"), pinned by the honesty guards. Before, the 34″ vanity's height line said 44″ (its mirror), the filing cabinet's typed 30 deep and the
 * linen's 16 deep said the proud-front 30 3/4 and 16 3/4 on the drawings, and the bench readout and PDF title were
 * W × H × D. Step 1's footprint keeps the finished depth (Chief: the linen baseline locks it); since row 132 its headline
 * names the build without the name's bare W × H × D triple, and its "Unit … wide × … deep × … high" line is W × D × H.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { jsPDF } from "jspdf";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { buildPlanPdf, headerAxes, headerTitle } from "../src/lib/yard/pdf";
import { headerSize, typedAxesTalk } from "../src/lib/yard/headerSize";
import { lineSpans, drawnExtent, renderProject } from "../src/lib/yard/pdfDraw";
import { planOverviewSvg } from "../src/lib/yard/planStepPicture";
import { SvgDoc } from "../src/lib/yard/svgDoc";
import { drawnDims } from "../src/lib/ideas/size";
import { inchFrac } from "../src/lib/yard/inchText";
import { MeasureReadout } from "../src/components/workspace/measure-readout";

const BUILDS: Record<string, string> = {
  vanity: "vanity with drawers",
  "vanity 30": "30 inch vanity",
  filing: "filing cabinet 30x30x24 2 doors 2 drawers",
  linen: "linen closet 31.5 wide 78 tall 16 deep",
  dresser: "3 drawer dresser",
  nightstand: "nightstand with 2 drawers",
  island: "kitchen island",
  wine: "wine cabinet",
};
const AX = ["width", "depth", "height"] as const;
const said = (d: { width: number; depth: number; height: number }) => AX.map((a) => inchFrac(d[a])).join(" × ");
/** Every string jsPDF painted with Tj, in order (the PDF's own text, no extractor needed). */
const pdfText = (doc: jsPDF) =>
  [...Buffer.from(doc.output("arraybuffer") as ArrayBuffer).toString("latin1").matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((m) => m[1].replace(/\\(.)/g, "$1"));

const rows = Object.entries(BUILDS).map(([key, prompt]) => {
  const p = generateFromPrompt(prompt);
  return { key, prompt, p, plan: buildPlan(p), size: headerSize(p), axes: headerAxes(p) };
});

test("the set's own pins: vanity 34 tall, filing 30 deep, linen 16 deep (typed or header size, never proud/accessory)", () => {
  const by = (k: string) => rows.find((r) => r.key === k)!;
  assert.equal(inchFrac(by("vanity").size.height), "34");
  assert.equal(inchFrac(by("vanity 30").size.height), "34");
  assert.equal(inchFrac(by("filing").size.depth), "30");
  assert.equal(inchFrac(by("linen").size.depth), "16");
  // These builds do draw past the header (mirror above, proud fronts), so the drawings had a second number to show.
  for (const k of ["vanity", "filing", "linen"]) {
    const e = drawnExtent(by(k).p)!;
    const over = by(k).size.height < e.max.y - e.min.y - 0.1 || by(k).size.depth < e.max.z - e.min.z - 0.1;
    assert.ok(over, `${k}: the drawn extent is the header's (no proud or accessory part to test)`);
  }
});

test("header, bench readout and the header's axes are one string (W × D × H)", () => {
  for (const r of rows) {
    assert.ok(headerTitle(r.p).includes(r.axes), `${r.key}: header ${headerTitle(r.p)} vs axes ${r.axes}`);
    const nums = [...r.axes.matchAll(/(\d+(?: \d+\/\d+)?|\d+\/\d+)" ([WDH])\b/g)].map((m) => `${m[2]}${m[1]}`).join(" ");
    assert.equal(nums, `W${inchFrac(r.size.width)} D${inchFrac(r.size.depth)} H${inchFrac(r.size.height)}`, r.key);
  }
  // The bench readout as rendered (row 134: the rendered text, not a source regex): it opens with the header's axes,
  // in look, build and walk mode, so no second formatter in W × H × D can stand in for it.
  for (const r of rows) for (const workMode of ["look", "build", "walk"]) {
    const text = renderToStaticMarkup(createElement(MeasureReadout, { project: r.p, wire: false, workMode })).replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    assert.ok(text.startsWith(r.axes), `${r.key} ${workMode}: bench readout ${JSON.stringify(text)} vs header axes ${r.axes}`);
  }
});

test("cover drawing, Check it drawing and the plan overview label the header's W × D × H", () => {
  for (const r of rows) {
    // The PDF cover and Check it pages both call renderProject with dims and the typed-axes marks: the same call here.
    const doc = new SvgDoc(612, 400);
    renderProject(doc as unknown as jsPDF, r.p, { x: 20, y: 20, w: 560, h: 360 }, { tones: new Map(r.p.panels.map((q) => [q.id, "built" as const])), dims: true, assumedAxes: typedAxesTalk(r.p).assumed, pad: 30 });
    const cover = drawnDims(doc.toSvg());
    assert.ok(cover, `${r.key}: no three dimension labels on the cover drawing`);
    assert.equal(said(cover!), said(r.size), `${r.key}: cover drawing ${said(cover!)} vs header ${said(r.size)}`);
    const ov = drawnDims(planOverviewSvg(r.p, 480, 360).svg);
    assert.equal(said(ov!), said(r.size), `${r.key}: plan overview ${said(ov!)} vs header ${said(r.size)}`);
  }
});

test("each dimension line is as long as the number it prints (the body, inside proud fronts and under a mirror)", () => {
  for (const r of rows) {
    const e = drawnExtent(r.p)!;
    const span = lineSpans(r.p, e);
    const bb = e;
    assert.ok(Math.abs(span.lineH(bb) - r.size.height) < 1 / 16 + 1e-9 || r.size.height > bb.max.y - bb.min.y, `${r.key}: height line ${span.lineH(bb)} vs ${r.size.height}`);
    assert.ok(Math.abs(span.lineD(bb) - r.size.depth) < 1 / 16 + 1e-9 || r.size.depth > bb.max.z - bb.min.z, `${r.key}: depth line ${span.lineD(bb)} vs ${r.size.depth}`);
    assert.ok(Math.abs(span.lineW(bb) - r.size.width) < 1 / 16 + 1e-9 || r.size.width > bb.max.x - bb.min.x, `${r.key}: width line ${span.lineW(bb)} vs ${r.size.width}`);
  }
});

test("PDF: the cover title, every running head and the Check it labels say the header's size", () => {
  for (const r of rows) {
    const t = pdfText(buildPlanPdf(r.p, r.plan));
    const flat = t.join(" ").replace(/\s+/g, " ");
    const want = r.axes.replace(/×/g, "x");
    assert.ok(flat.includes(want), `${r.key}: PDF title lacks "${want}"`);
    const heads = t.filter((s) => s.includes(" W ") && s.includes(" D ") && s === s.toUpperCase());
    assert.ok(heads.length >= 3, `${r.key}: only ${heads.length} running heads`);
    for (const h of heads) assert.ok(h.includes(r.axes.toUpperCase()) || h.includes(want.toUpperCase()), `${r.key}: running head ${h}`);
    // No W × H × D triple of the header's numbers anywhere (the old title order).
    const whd = `${inchFrac(r.size.width)}" x ${inchFrac(r.size.height)}" x ${inchFrac(r.size.depth)}"`;
    const step1 = flat.indexOf("Confirm the footprint");
    const outside = step1 < 0 ? flat : flat.slice(0, step1) + flat.slice(flat.indexOf(".", flat.indexOf("Unit ", step1)) + 1);
    if (r.size.height !== r.size.depth) assert.ok(!outside.slice(0, 600).includes(whd), `${r.key}: W × H × D "${whd}" on the cover`);
  }
});

test("step 1 says the size once, labelled W × D × H, never the name's bare W × H × D triple (row 132)", () => {
  // The typed-size prompts carry their triple in the name ("Linen 31 1/2" × 78" × 16""), so they are the ones that bite.
  const typed = [...rows, ...["bookcase 36 x 72 x 12", "dresser 40 wide 34 tall 18 deep"].map((prompt) => { const p = generateFromPrompt(prompt); return { key: prompt, prompt, p, plan: buildPlan(p), size: headerSize(p), axes: headerAxes(p) }; })];
  let named = 0;
  for (const r of typed) {
    const s1 = r.plan.instructions.find((s) => /^Confirm the/.test(s.title));
    if (!s1) continue;
    if (/\d["″]\s*[×x]\s*\d/.test(r.p.name)) named++;
    assert.ok(!/\d["″]?\s*[×x]\s*[\d\s/]+["″]?\s*[×x]\s*\d/.test(s1.description), `${r.key}: step 1 has an unlabelled triple: ${s1.description.slice(0, 120)}`);
    const unit = s1.description.match(/Unit ([\d\s/]+)" wide × ([\d\s/]+)" deep × ([\d\s/]+)" high/);
    if (unit) assert.equal(inchFrac(r.size.width), unit[1].trim(), `${r.key}: step 1 width`);
  }
  assert.ok(named >= 2, `only ${named} builds carry a size in their name: the test has nothing to bite on`);
});
