// Every Ideas card's subtitle size describes the model its drawing shows (PR 3 #2).
import test from "node:test";
import assert from "node:assert/strict";
import { curatedFeed } from "../src/lib/ideas/feed";
import { sizeMatches, sizeNumbers, displaySize } from "../src/lib/ideas/size";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import DRAWINGS from "../src/lib/ideas/drawings.json";
import fs from "node:fs";
import { drawnDims } from "../src/lib/ideas/size";

const cards = curatedFeed().sections.flatMap((s) => s.cards);

test("size parser: fractions, feet, feature segments", () => {
  assert.deepEqual(sizeNumbers("31 1/2 × 78 × 16"), [31.5, 78, 16]);
  assert.deepEqual(sizeNumbers("3 ft"), [36]);
  assert.deepEqual(sizeNumbers("60 × 30 × 29 · 24″ knee"), [60, 30, 29]);
  assert.equal(sizeNumbers("craft figure"), null);
  assert.equal(displaySize("36 × 48", { width: 46, height: 98, depth: 7.5 }), "46 × 98 × 7 1/2");
});

test("every card has a size and a drawing whose dims it matches", () => {
  for (const c of cards) {
    assert.ok(c.drawing?.dims, `${c.slug}: drawing has no dims`);
    assert.ok(sizeMatches(c.size, c.drawing!.dims!), `${c.slug}: "${c.size}" vs ${JSON.stringify(c.drawing!.dims)}`);
  }
});

test("manifest dims are the drawing's own labels (else the engine's box), so the subtitle matches what is drawn", () => {
  const m = DRAWINGS as Record<string, { v: string; dims: { width: number; height: number; depth: number } }>;
  for (const c of cards) {
    const svg = fs.readFileSync(`public/ideas/drawings/${c.slug}.${m[c.slug].v}.svg`, "utf8");
    const labels = drawnDims(svg);
    const want = labels ?? generateFromPrompt(c.examplePrompt).overall;
    const d = m[c.slug].dims;
    const sorted = (x: { width: number; height: number; depth: number }) => [x.width, x.height, x.depth].sort((a, b) => a - b);
    sorted(want).forEach((v, i) => assert.ok(Math.abs(v - sorted(d)[i]) < 0.02, `${c.slug}: dims ${JSON.stringify(d)} vs drawn ${JSON.stringify(want)}`));
  }
});

test("window card: framing title, size of the drawn framing, the unit it is for", () => {
  const w = cards.find((c) => c.slug === "window")!;
  assert.equal(w.title, "Frame a window opening");
  assert.equal(w.size, "42 × 96 × 3 1/2");
  assert.equal(w.stock, "for a 36 × 48 double-hung");
});
