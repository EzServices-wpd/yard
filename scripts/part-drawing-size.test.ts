// Critic 2 (#226): the "alone" drawing's dimension labels must be exactly the cut-list row's own size
// (length, width, thickness) - no other number; a part whose drawn box cannot match the row draws no lines.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { inchFrac } from "../src/lib/yard/inchText";
import { CutRowDrawing } from "../src/components/workspace/part-drawing";

const pic = (html: string, k: string) => new RegExp(`data-yard-part-pic="${k}"[^>]*>(<svg[\\s\\S]*?</svg>)`).exec(html)?.[1] ?? "";
const labels = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)</g)].map((m) => m[1].replace(/&quot;/g, '"'));

for (const prompt of [
  "pocket vanity 48 wide", // F Counter: row 3/4" thick, drawing says 1 1/2"
  "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space", // A Desktop: 1 1/2"
  "closet 72 wide 96 tall 24 deep", // A Back · left: row 35 1/4" wide, drawing 70 1/2"
  "queen platform bed 60 by 80", // Sleep deck: row 30", drawing 60"
  "12x12 pergola", // beams: row 72", drawing 144"
  "round table 36 diameter", // aprons labelled "... dia"
  "water wheel", // rims: row 22 1/8", drawing 22 1/16"
]) {
  test(`alone drawing reads exactly the row's size (${prompt})`, () => {
    const project = generateFromPrompt(prompt);
    const plan = buildPlan(project);
    for (const row of plan.cutList.filter((c) => c.partIds?.length)) {
      const html = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, createElement(CutRowDrawing, { project, plan, row, active: true }))));
      // A round top may read "36\" dia" when the row is 36 x 36 (a disc); anything else must be a row number.
      const got = labels(pic(html, "alone")).flatMap((l) =>
        l.endsWith(" dia") && row.lengthIn === row.widthIn && l === `${inchFrac(row.lengthIn)}" dia` ? [`${inchFrac(row.lengthIn)}"`, `${inchFrac(row.widthIn)}"`] : [l]);
      if (!got.length) continue; // stick / instance builds draw no dims (by design)
      const size = [row.lengthIn, row.widthIn, row.thicknessIn ?? 0.75].map((v) => `${inchFrac(v)}"`);
      assert.deepEqual([...got].sort(), [...size].sort(), `${row.label} ${row.name}: row ${size.join(" x ")}, drawing ${got.join(", ")}`);
    }
  });
}
