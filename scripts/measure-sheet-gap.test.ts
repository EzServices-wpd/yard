// Critic 2 backlog: at 390 the phone Measure sheet (bottom half, outside the bench host) hid the bottom ~45% of
// the model, because the fit never saw it. While it is open on a phone, an inert card of the sheet's box sits in
// the bench host, the fit avoids it, and the whole model frames above the sheet. Closed and on desktop: release.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { benchModelBox, benchView, fitBench, projectCorners } from "../src/lib/yard/benchFrame";
import { sheetGapOpen, subscribeSheetGap, SHEET_GAP_QUERY } from "../src/components/workspace/measure-sheet-gap";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const gap = read("src/components/workspace/measure-sheet-gap.ts") + read("src/components/workspace/measure-sheet-card.tsx");
const shell = read("src/components/workspace/shell.tsx");
const canvas = read("src/components/workspace/canvas.tsx");

// 390 x 844 phone, measured on the release build: the bench canvas is 683 px tall (top 161), the dock card is
// 12..378 x 478.5..671 in canvas px, and the 50vh sheet starts 261 px into the canvas.
const viewport = { w: 390, h: 683 };
const dock = { left: 12, top: 478.5, right: 378, bottom: 671 };
const sheet = { left: 0, top: 261, right: 390, bottom: 683 };

for (const prompt of ["linen closet 31.5 wide 78 tall 16 deep", "pocket vanity 48 wide", "bookshelf 36 wide 72 tall 12 deep"]) {
  test(`fit at 390: the whole model clears the open Measure sheet (${prompt})`, () => {
    const project = generateFromPrompt(prompt);
    const box = benchModelBox(project);
    const view = benchView(project, box);
    const bottom = (overlays: typeof dock[]) => Math.max(...projectCorners(fitBench({ box, view, viewport, overlays }), viewport, box).map((c) => c.y));
    assert.ok(bottom([dock]) > sheet.top, "release (dock only): the model runs under the sheet");
    const b = bottom([dock, sheet]);
    assert.ok(b <= sheet.top, `with the sheet card the lowest corner (${b.toFixed(1)}) is above the sheet (${sheet.top})`);
    const top = Math.min(...projectCorners(fitBench({ box, view, viewport, overlays: [dock, sheet] }), viewport, box).map((c) => c.y));
    assert.ok(top >= 0, "and the top stays on the canvas");
  });
}

test("the card is the sheet's box, phone only, inert, and outside the Buy list and parts", () => {
  assert.match(shell, /side === "measure" \? "inset-x-0 bottom-0 top-auto h-\[50vh\]/, "the sheet is still the bottom 50vh");
  assert.match(gap, /data-bench-overlay="measure-sheet"/);
  assert.match(gap, /pointer-events-none absolute inset-x-0 bottom-0 h-\[50vh\] md:hidden/, "same box as the sheet; hidden at md and up");
  assert.match(gap, /aria-hidden/);
  assert.equal(SHEET_GAP_QUERY, "(max-width: 767.98px)", "below md, where the sheet is a bottom sheet");
  assert.doesNotMatch(gap, /useYard|lib\/yard/, "no store, plan or part state");
});

test("shell renders the card in the bench host only while Measure is open", () => {
  const host = shell.slice(shell.indexOf("<BenchHost"), shell.indexOf("<RevealStatus />"));
  assert.match(host, /<MeasureSheetGap show=\{side === "measure"\} \/>/);
});

// Critic 2 #208 advisory (D14): the dismiss tests render BenchHost alone, so nothing checked that the shell hands it
// the sheet's real state. WorkspaceApp itself (three.js canvas, router, stores) does not render in a test DOM, so this
// reads the one BenchHost element in shell.tsx and evaluates its props against every panel state.
test("shell wires BenchHost to the Measure sheet: open only while Measure is the side panel, closing clears it", () => {
  const tags = shell.match(/<BenchHost\b[^>]*>/g) ?? [];
  assert.equal(tags.length, 1, "one BenchHost in the shell");
  const open = /sheetOpen=\{([^}]+)\}/.exec(tags[0])?.[1];
  assert.ok(open, "BenchHost gets a sheetOpen expression");
  const sheetOpen = new Function("side", `return (${open});`) as (side: string | null) => unknown;
  assert.equal(sheetOpen("measure"), true, "Measure open: the sheet is open");
  for (const side of ["catalog", null]) assert.equal(sheetOpen(side), false, `side ${side}: not the sheet`);
  assert.match(tags[0], /onClose=\{closeSide\}/, "BenchHost closes through closeSide");
  assert.match(shell, /const closeSide = useCallback\(\(\) => setSide\(null\), \[\]\);/, "closeSide clears the side panel");
  const host = shell.slice(shell.indexOf(tags[0]), shell.indexOf("</BenchHost>"));
  assert.match(host, /<WorkspaceCanvas \/>/, "the bench canvas renders inside BenchHost, so its presses reach the handlers");
  assert.doesNotMatch(shell, /data-bench-host/, "no second bench host div beside it");
});

test("the fit key gains 'm' only while the phone sheet is open; closed it is release's", () => {
  assert.match(canvas, /useSyncExternalStore\(subscribeSheetGap, sheetGapOpen, \(\) => false\)/);
  assert.match(canvas, /\$\{sharing \? "h" : ""\}\$\{sheetGap \? "m" : ""\}\|\$\{viewNonce\}/);
  assert.equal(sheetGapOpen(), false, "closed by default (server and first paint)");
  let n = 0;
  const off = subscribeSheetGap(() => n++);
  off();
  assert.equal(n, 0);
});
