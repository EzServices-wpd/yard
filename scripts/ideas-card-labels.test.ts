// Ideas cards at 390 (Chief, 10-28): every baked drawing's dimension labels render 12px or more at any card size from
// 200px up, stay inside the drawing, keep AA contrast, and the longest size any drawn card prints fits one line.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import DRAWINGS from "../src/lib/ideas/drawings.json";
import { formatSize } from "../src/lib/ideas/size";
import { DRAW_H, DRAW_W, LABEL_BANDS, MAX_UNITS, cardLabels, labelBox, labelUnits } from "../src/lib/ideas/drawingLabels";

const m = DRAWINGS as Record<string, { v: string; bytes: number; dims: { width: number; height: number; depth: number; round?: true } }>;
const svgs = Object.entries(m).map(([slug, e]) => [slug, fs.readFileSync(`public/ideas/drawings/${slug}.${e.v}.svg`, "utf8")] as const);
const labels = (svg: string) => [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*fill="rgb\((\d+),(\d+),(\d+)\)"[^>]*>([^<]*)<\/text>/g)];

test("every labelled drawing carries the card label sheet, and its file name is still its hash", () => {
  let n = 0;
  for (const [slug, svg] of svgs) {
    assert.equal(cardLabels(svg), svg, `${slug}: labels not sized for cards (run cardLabels)`);
    assert.equal(crypto.createHash("sha1").update(svg).digest("hex").slice(0, 8), m[slug].v, `${slug}: v is not the file's hash`);
    assert.equal(svg.length, m[slug].bytes, `${slug}: bytes`);
    if (svg.includes("<text")) n++, assert.match(svg, /text\{font-size:var\(--l\)/, `${slug}: label size rule`);
  }
  assert.ok(n >= 50, `only ${n} labelled drawings`);
});

test("a label renders 12px or more at every drawn width from 200px, and the sheet says the same bands", () => {
  for (let w = 200; w <= 1200; w += 1) assert.ok((labelUnits(w) * w) / DRAW_W >= 12 - 1e-9, `${w}px: ${labelUnits(w)} units is ${((labelUnits(w) * w) / DRAW_W).toFixed(1)}px`);
  for (const [slug, svg] of svgs.filter(([, s]) => s.includes("<text"))) {
    const bands = [...svg.matchAll(/@media\(max-width:(\d+)px\)\{svg\{--l:(\d+)px\}\}/g)].map((x) => [Number(x[1]), Number(x[2])]);
    assert.deepEqual(bands, LABEL_BANDS.map(([a, b]) => [a, b]), `${slug}: label bands`);
  }
});

test("labels stay inside the drawing at the largest card size, never overlap each other, and keep AA contrast", () => {
  const lum = (c: number[]) => { const l = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
  for (const [slug, svg] of svgs) {
    const bg = svg.match(/<rect x="0" y="0" width="480" height="360"[^>]*fill="rgb\((\d+),(\d+),(\d+)\)"/);
    const boxes = labels(svg).map((x) => {
      const b = labelBox(Number(x[1]), Number(x[2]), x[6], MAX_UNITS);
      assert.ok(b[0] >= 0 && b[1] >= 0 && b[2] <= DRAW_W && b[3] <= DRAW_H, `${slug}: "${x[6]}" leaves the drawing at ${MAX_UNITS} units`);
      if (bg) {
        const [a, c] = [lum([+x[3], +x[4], +x[5]]), lum([+bg[1], +bg[2], +bg[3]])];
        assert.ok((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05) >= 4.5, `${slug}: "${x[6]}" contrast`);
      }
      return [b, x[6]] as const;
    });
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const [p, q] = [boxes[i][0], boxes[j][0]];
      assert.ok(p[2] <= q[0] || q[2] <= p[0] || p[3] <= q[1] || q[3] <= p[1], `${slug}: "${boxes[i][1]}" overlaps "${boxes[j][1]}" at ${MAX_UNITS} units`);
    }
  }
});

test("the longest size a drawn card prints is 31 characters (what the narrowest card fits on one line; ideas-card-fit.py)", () => {
  const longest = Math.max(...Object.values(m).map((e) => formatSize(e.dims).text.length));
  assert.ok(longest <= 31, `a drawn card prints a ${longest}-character size: re-check the card widths at 390 with scripts/e2e/ideas-card-fit.py`);
});
