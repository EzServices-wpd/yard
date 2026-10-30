// Ideas cards at 390 (Chief, 10-28): every baked drawing's dimension labels render 12px or more at any card size from
// 200px up, stay inside the drawing, keep AA contrast, and the longest size any drawn card prints fits one line.
// Follow-up (Chief, 10-30): at every label size, a label sits beside its own dimension line, clear of it and the model.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import DRAWINGS from "../src/lib/ideas/drawings.json";
import { formatSize } from "../src/lib/ideas/size";
import { ASCENT, CHIP_MAX, DESCENT, DRAW_H, DRAW_W, HALO, LABEL_BANDS, LABEL_SIZES, WHITE_BOX, cardLabels, labelEm, labelUnits } from "../src/lib/ideas/drawingLabels";

const m = DRAWINGS as Record<string, { v: string; bytes: number; dims: { width: number; height: number; depth: number; round?: true } }>;
const svgs = Object.entries(m).map(([slug, e]) => [slug, fs.readFileSync(`public/ideas/drawings/${slug}.${e.v}.svg`, "utf8")] as const);
const labels = (svg: string) => [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="(\w+)"[^>]*fill="rgb\((\d+),(\d+),(\d+)\)"[^>]*>([^<]*)<\/text>/g)];

// Geometry read straight from the SVG (no placement code): a label's box as drawn, its dimension (the three <line>s
// before its white box: the line, then its ticks) and the model's parts (every <path>, curves by their control points).
type P = [number, number];
const num = (a: string, k: string) => Number(a.match(new RegExp(`\\b${k}="(-?[\\d.]+)`))?.[1] ?? 0);
function drawnBox(tag: string, text: string, fs: number, halo = HALO): P[] {
  const [x, y, dx, dy] = [num(tag, "x"), num(tag, "y"), num(tag, "dx"), num(tag, "dy")];
  const r = (Number(tag.match(/rotate\((-?[\d.]+)/)?.[1] ?? 0) * Math.PI) / 180, w = labelEm(text) / 2 + halo;
  const shift = { start: 1, end: -1 }[tag.match(/text-anchor="(\w+)"/)![1]] ?? 0;
  return ([[-w, -ASCENT - halo], [w, -ASCENT - halo], [w, DESCENT + halo], [-w, DESCENT + halo]] as P[]).map(([u, v]) => {
    const [a, b] = [(dx + u + (shift * labelEm(text)) / 2) * fs, (dy + v) * fs];
    return [x + a * Math.cos(r) - b * Math.sin(r), y + a * Math.sin(r) + b * Math.cos(r)];
  });
}
const side = (o: P, a: P, b: P) => Math.sign((a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]));
const meet = (a: number, b: number, c: number, d: number) => Math.max(Math.min(a, b), Math.min(c, d)) <= Math.min(Math.max(a, b), Math.max(c, d));
const crosses = (a: P, b: P, c: P, d: P) =>
  meet(a[0], b[0], c[0], d[0]) && meet(a[1], b[1], c[1], d[1]) && side(a, b, c) * side(a, b, d) <= 0 && side(c, d, a) * side(c, d, b) <= 0;
const within = (p: P, q: P[]) => q.every((_, i) => side(q[i], q[(i + 1) % q.length], p) >= 0) || q.every((_, i) => side(q[i], q[(i + 1) % q.length], p) <= 0);
const ring = (q: P[]) => q.map((p, i) => [p, q[(i + 1) % q.length]] as const);
/** Does a (convex) label box touch a segment, or overlap a part outline? */
const hitsSeg = (box: P[], a: P, b: P) => within(a, box) || ring(box).some(([c, d]) => crosses(a, b, c, d));
const hitsPart = (box: P[], q: P[]) => q.some((p) => within(p, box)) || ring(q).some(([a, b]) => hitsSeg(box, a, b)) || within(box[0], q);
function geometry(svg: string) {
  const parts = [...svg.matchAll(/<path d="([^"]*)"/g)].flatMap((m) => m[1].split(/(?=M)/).map((d) => { const n = (d.replace(/A\s*[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[01]\s+[01]/g, "L").match(/-?[\d.]+/g) ?? []).map(Number); return n.flatMap((v, i) => (i % 2 ? [] : [[v, n[i + 1]] as P])); }));
  const dims = [...svg.matchAll(/((?:<line [^>]*\/>){3})<rect [^>]*fill="rgb\(255,255,255\)"[^>]*\/>(<text [^>]*>)([^<]*)<\/text>/g)].map((m) => ({
    lines: [...m[1].matchAll(/<line ([^>]*)\/>/g)].map((l) => [[num(l[1], "x1"), num(l[1], "y1")], [num(l[1], "x2"), num(l[1], "y2")]] as [P, P]),
    tag: m[2], text: m[3].replace(/&quot;/g, '"'),
  }));
  return { parts: parts.filter((q) => q.length > 1), dims };
}

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

test("labels stay inside the drawing at every size, never overlap each other, and keep AA contrast", () => {
  const lum = (c: number[]) => { const l = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
  for (const [slug, svg] of svgs) {
    const bg = svg.match(/<rect x="0" y="0" width="480" height="360"[^>]*fill="rgb\((\d+),(\d+),(\d+)\)"/);
    for (const x of labels(svg)) if (bg) {
      const [a, c] = [lum([+x[4], +x[5], +x[6]]), lum([+bg[1], +bg[2], +bg[3]])];
      assert.ok((Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05) >= 4.5, `${slug}: "${x[7]}" contrast`);
    }
    const { dims } = geometry(svg);
    for (const fs of LABEL_SIZES) {
      const boxes = dims.map((d) => [drawnBox(d.tag, d.text, fs), d.text] as const);
      for (const d of dims) assert.ok(drawnBox(d.tag, d.text, fs, 0).every(([x, y]) => x >= 0 && y >= 0 && x <= DRAW_W && y <= DRAW_H), `${slug}: "${d.text}" leaves the drawing at ${fs} units`);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        assert.ok(!hitsPart(boxes[i][0], boxes[j][0]), `${slug}: "${boxes[i][1]}" overlaps "${boxes[j][1]}" at ${fs} units`);
      }
    }
  }
});

test("each label is anchored on its own dimension line; the sheet hides the white boxes on cards and the labels on home chips", () => {
  const box = /<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="[\d.]+" fill="rgb\(255,255,255\)"[^>]*\/>(<text[^>]*>[^<]*<\/text>)?/g;
  let n = 0;
  for (const [slug, svg] of svgs.filter(([, s]) => s.includes("<text"))) {
    assert.ok(svg.includes(`@media(min-width:${CHIP_MAX + 1}px){${WHITE_BOX}{display:none}}@media(max-width:${CHIP_MAX}px){text{display:none}}`), `${slug}: box/chip rules`);
    for (const r of svg.matchAll(box)) assert.ok(r[3], `${slug}: a white box with no label after it (the sheet would hide a drawn part)`);
    assert.equal([...svg.matchAll(box)].length, labels(svg).length, `${slug}: every label has one white box`);
    for (const d of geometry(svg).dims) {
      const [[a, b]] = d.lines, p: P = [num(d.tag, "x"), num(d.tag, "y")];
      const along = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
      const off = Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
      assert.ok(along >= -1e-6 && along <= 1 + 1e-6 && off < 0.05, `${slug}: "${d.text}" is not anchored on its own dimension line`);
      n++;
    }
  }
  assert.ok(n >= 160, `only ${n} labels with a dimension line`);
});

test("at 223, 350 and 530px (and every label size) no label crosses its own dimension line or ticks, or the model", () => {
  const sizes = [...new Set([223, 350, 530].map(labelUnits).concat(LABEL_SIZES))];
  assert.deepEqual([223, 350, 530].map(labelUnits), [29, 18, 12]);
  let n = 0;
  for (const [slug, svg] of svgs.filter(([, s]) => s.includes("<text"))) {
    const { parts, dims } = geometry(svg);
    assert.equal(dims.length, labels(svg).length, `${slug}: a label without its dimension line`);
    for (const d of dims) for (const fs of sizes) {
      const b = drawnBox(d.tag, d.text, fs);
      for (const [p, q] of d.lines) assert.ok(!hitsSeg(b, p, q), `${slug}: "${d.text}" crosses its own dimension line at ${fs} units`);
      const part = parts.findIndex((q) => hitsPart(b, q));
      assert.equal(part, -1, `${slug}: "${d.text}" sits on the model (${JSON.stringify(parts[part])}) at ${fs} units`);
      n++;
    }
  }
  assert.ok(n >= 169 * sizes.length, `only ${n} label sizes checked`);
});

test("the longest size a drawn card prints is 31 characters (what the narrowest card fits on one line; ideas-card-fit.py)", () => {
  const longest = Math.max(...Object.values(m).map((e) => formatSize(e.dims).text.length));
  assert.ok(longest <= 31, `a drawn card prints a ${longest}-character size: re-check the card widths at 390 with scripts/e2e/ideas-card-fit.py`);
});
