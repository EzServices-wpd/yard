// Measure box corner fix: the top loop must close through all four corners (it skipped the front-left one and
// drew a diagonal back across the top). Overlay lines only, never a part.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { measureBoxStrokes, type Pt } from "../src/components/workspace/measure-box";

const key = (p: Pt) => p.join(",");
const corners = (w: number, h: number, d: number, y: number) =>
  [[-w / 2, y, -d / 2], [w / 2, y, -d / 2], [w / 2, y, d / 2], [-w / 2, y, d / 2]].map((p) => key(p as Pt)).sort();
const axisAligned = (a: Pt, b: Pt) => a.filter((v, i) => v !== b[i]).length === 1;

function assertRing(loop: Pt[], w: number, h: number, d: number, y: number, name: string) {
  assert.equal(loop.length, 5, `${name}: 4 edges`);
  assert.equal(key(loop[0]), key(loop[4]), `${name}: closed`);
  assert.deepEqual([...new Set(loop.slice(0, 4).map(key))].sort(), corners(w, h, d, y), `${name}: visits all four corners once`);
  for (let i = 0; i < 4; i++) {
    assert.ok(loop[i].every((v, j) => (j === 1 ? v === y : true)), `${name}: flat at y=${y}`);
    assert.ok(axisAligned(loop[i], loop[i + 1]), `${name}: edge ${i} is axis-aligned, not a diagonal or a zero-length stroke`);
  }
}

for (const [w, h, d] of [[31.5, 78, 16], [36, 72, 12], [1, 1, 1]] as const) {
  test(`top and bottom loops are closed rectangles of axis-aligned edges (${w}×${h}×${d})`, () => {
    const [bottom, top, ...uprights] = measureBoxStrokes(w, h, d);
    assertRing(bottom, w, h, d, 0, "bottom");
    assertRing(top, w, h, d, h, "top");
    assert.equal(uprights.length, 4);
    for (const [a, b] of uprights) {
      assert.ok(axisAligned(a, b) && a[1] === 0 && b[1] === h, "upright runs straight up");
    }
    assert.deepEqual(uprights.map(([a]) => key(a)).sort(), corners(w, h, d, 0), "one upright per corner");
  });
}

test("the bench draws the measure box through the helper (no inline copy of the loops)", () => {
  const src = fs.readFileSync(new URL("../src/components/workspace/canvas.tsx", import.meta.url), "utf8");
  assert.match(src, /measureBoxStrokes\(width, height, depth\)/);
  assert.doesNotMatch(src, /\[-hx, height, -hz\], \[-hx, height, -hz\]/);
});
