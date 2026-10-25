// Sizes on / and /ideas (Batch C1, the size rule): always "W × D × H in" (or "40 dia × 30 in"), formatted
// from the engine's solved dims (the drawing's own labels, else the model's box), never from a typed string.
import test from "node:test";
import assert from "node:assert/strict";
import { curatedFeed, drawingForType, searchPool } from "../src/lib/ideas/feed";
import { SIZE_PATTERN, drawingSize, formatSize, inch, inchWords, drawnDims } from "../src/lib/ideas/size";
import { liveFeed } from "../src/lib/ideas/liveFeed";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { showcaseFor } from "../src/lib/yard/homeShowcase";
import { DREAMS } from "../src/lib/yard/promptDreams";
import DRAWINGS from "../src/lib/ideas/drawings.json";
import RECIPES from "../src/lib/ideas/recipes.json";
import fs from "node:fs";

const feed = curatedFeed(RECIPES);
const cards = feed.sections.flatMap((s) => s.cards);
type Box = { width: number; height: number; depth: number };
// A card whose drawing is a quarter-turned view (gen-idea-drawings' VIEW `turn: true`, the water wheel) is labelled
// with its width and depth trading places on paper; the card says them back in the model's W × D × H, so it is the
// header's size (one-size.test), still exactly the drawing's labels.
const TURNED = new Set([...fs.readFileSync("scripts/gen-idea-drawings.ts", "utf8").matchAll(/"([\w-]+)": \{ turn: true\b/g)].map((x) => x[1]));

test("formatSize: W × D × H in with shop fractions; round tops print dia; aria spells it out", () => {
  assert.deepEqual(formatSize({ width: 31.5, height: 78, depth: 16 }), { text: "31 1/2 × 16 × 78 in", aria: "31 and a half inches wide, 16 deep, 78 tall" });
  assert.equal(formatSize({ width: 38, height: 102, depth: 17.75 }).text, "38 × 17 3/4 × 102 in");
  assert.deepEqual(formatSize({ width: 40, depth: 40, height: 30, round: true }), { text: "40 dia × 30 in", aria: "40 inches across, 30 tall" });
  assert.deepEqual(formatSize(null), { text: "", aria: "" });
  assert.equal(inch(7.5), "7 1/2");
  assert.equal(inch(0.375), "3/8");
  assert.equal(inchWords(0.25), "a quarter");
  assert.equal(inch(6.3125), "6 5/16");
  assert.equal(inch(3.4375), "3 7/16");
  assert.equal(inch(0.0625), "1/16");
  assert.equal(inch(11.97), "12");
  assert.equal(inchWords(14.1875), "14 and three sixteenths");
});

test("SIZE_PATTERN accepts only the one format", () => {
  for (const ok of ["31 1/2 × 16 × 78 in", "42 × 3 1/2 × 96 in", "40 dia × 30 in", "6 × 6 × 60 in", "60 × 3/4 × 48 in"]) assert.ok(SIZE_PATTERN.test(ok), ok);
  for (const bad of ["31 1/2 × 78 × 16", "38 × 102 × 17 · trapezoid fit", "3 ft", "36″ × 12″ × 72″", "31.5 × 16 × 78 in", "40 dia × 30", "0 3/4 × 1 × 2 in x"]) assert.ok(!SIZE_PATTERN.test(bad), bad);
});

test("every Ideas card (and every search card with a drawing) prints the pattern, from its drawing's engine dims", () => {
  for (const c of [...cards, ...searchPool(feed)]) {
    if (!c.drawing) { assert.equal(c.size, "", `${c.slug}: no drawing, so no size`); continue; }
    assert.ok(c.drawing.dims, `${c.slug}: drawing has no dims`);
    assert.match(c.size, SIZE_PATTERN, c.slug);
    assert.equal(c.size, formatSize(c.drawing.dims).text, `${c.slug}: size must come from the engine dims`);
    assert.ok(c.sizeAria && !/\d\/\d/.test(c.sizeAria), `${c.slug}: aria "${c.sizeAria}"`);
  }
});

test("manifest dims are exactly the drawing's own labels (else the engine's box), with the round flag for dia labels", () => {
  const m = DRAWINGS as Record<string, { v: string; dims: Box & { round?: boolean } }>;
  for (const c of cards) {
    const svg = fs.readFileSync(`public/ideas/drawings/${c.slug}.${m[c.slug].v}.svg`, "utf8");
    const drawn = drawnDims(svg);
    const labels = drawn && TURNED.has(c.slug) ? { ...drawn, width: drawn.depth, depth: drawn.width } : drawn;
    const want = labels ?? generateFromPrompt(c.examplePrompt).overall;
    const d = m[c.slug].dims;
    const sorted = (x: Box) => [x.width, x.height, x.depth].sort((a, b) => a - b);
    // Exact (row 57): labelled drawings print 1/16ths, so the manifest keeps them to 1e-4, not 2 decimals.
    if (labels) for (const k of ["width", "depth", "height"] as const) assert.ok(Math.abs(d[k] - labels[k]) < 1e-9, `${c.slug}: ${k} ${d[k]} vs drawn ${labels[k]}`);
    else sorted(want).forEach((v, i) => assert.ok(Math.abs(v - sorted(d)[i]) <= 5e-5, `${c.slug}: dims ${JSON.stringify(d)} vs engine ${JSON.stringify(want)}`));
    assert.equal(!!d.round, !!labels?.round, `${c.slug}: round flag`);
  }
  assert.equal(cards.find((c) => c.slug === "round")?.size, "40 dia × 30 in");
});

test("a card with a labelled drawing prints exactly the drawing's labels (no 1/16″ rounding)", () => {
  const m = DRAWINGS as Record<string, { v: string }>;
  let labelled = 0;
  for (const c of [...cards, ...searchPool(feed)]) {
    if (!c.drawing || !m[c.slug]) continue;
    const svg = fs.readFileSync(`public/ideas/drawings/${c.slug}.${m[c.slug].v}.svg`, "utf8");
    const d = drawnDims(svg);
    if (!d) continue;
    labelled++;
    const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((x) => x[1].replace(/&quot;/g, '"')).filter((t) => /\d[^"]*"/.test(t)).map((t) => t.match(/(\d+(?: \d+\/\d+)?|\d+\/\d+)\s*"/)![1]);
    const [w, dp, h] = TURNED.has(c.slug) ? [texts[1], texts[0], texts[2]] : [texts[0], texts[1], texts[2]];
    const want = d.round ? `${texts[0]} dia × ${texts[1]} in` : `${w} × ${dp} × ${h} in`;
    assert.equal(c.size, want, `${c.slug}: card "${c.size}" vs drawing "${want}"`);
  }
  assert.ok(labelled >= 7, `only ${labelled} labelled drawings checked`);
  // The seven row-57 cards that printed 1/16″ off their drawings.
  const by = Object.fromEntries([...cards, ...searchPool(feed)].map((c) => [c.slug, c.size]));
  assert.equal(by["birdhouse"], "6 7/8 × 7 1/2 × 11 13/16 in");
  assert.equal(by["recipe-wall-mounted-mail-organizer"], "12 × 3 3/4 × 14 3/16 in");
  assert.deepEqual([...TURNED], ["recipe-water-wheel"]);
  assert.equal(by["recipe-water-wheel"], "18 × 23 7/16 × 30 1/4 in");
  assert.equal(by["recipe-laptop-stand"], "11 3/8 × 8 7/8 × 6 5/16 in");
  assert.equal(by["recipe-jewelry-box"], "10 × 5 1/2 × 3 7/16 in");
  assert.equal(by["recipe-bird-feeder"], "10 × 7 11/16 × 10 5/8 in");
  assert.equal(by["recipe-outdoor-storage-bench"], "48 × 20 × 19 3/16 in");
});

test("window card: framing title, size of the drawn framing, the unit it is for as a note", () => {
  const w = cards.find((c) => c.slug === "window")!;
  assert.equal(w.title, "Frame a window opening");
  assert.equal(w.size, "42 × 3 1/2 × 96 in");
  assert.equal(w.stock, "for a 36 × 48 double-hung");
});

test("live feed cards: drawing dims when there is a drawing, else the engine's logged W×D×H", () => {
  const at = new Date().toISOString();
  const row = (prompt: string, resultKey: string, size: string) => ({ key: prompt, prompt, size, resultKey, status: "Trusted" as const, count: 3, lastSeen: at });
  const live = liveFeed({ live: true, at, rows: [row("a garden gnome house", "builtin:gnome-house", "10.5×8×12.25"), row("a big linen closet", "builtin:linen", "30×16×80")], recent: [] } as never, feed, undefined, undefined,
    // I-draw shows only drawn cards: the gnome house gets a drawing with no baked dims, so its size is the logged W×D×H.
    (t) => (t === "gnome-house" ? { src: "/ideas/drawings/gnome-house.0a.svg", w: 480, h: 360, parts: 1, v: "0a" } : drawingForType(t)));
  const all = live.sections.flatMap((s) => s.cards);
  assert.equal(all.find((c) => c.slug === "gnome-house")?.size, "10 1/2 × 8 × 12 1/4 in");
  for (const c of all) if (c.size) assert.match(c.size, SIZE_PATTERN, c.slug);
});

test("home sample cards: sizes from the engine drawing, in the pattern", () => {
  const prompts = {
    pocket: DREAMS.find((d) => d.id === "pocket")!.prompt,
    linen: "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep",
    desk: "desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space",
  };
  const got = Object.fromEntries(Object.entries(prompts).map(([k, p]) => { const s = showcaseFor(p); return [k, drawingSize(s.svg, s.overall).text]; }));
  for (const v of Object.values(got)) assert.match(v, SIZE_PATTERN);
  assert.equal(got.linen, "31 1/2 × 16 × 78 in");
  // One size source (#93 round 2): the drawing labels the header's typed 17 deep (its line spans the body; the 3/4
  // fronts stand proud of it), the same as the linen's 16. Before, it labelled the proud 17 3/4.
  assert.equal(got.pocket, "38 × 17 × 102 in");
  const home = fs.readFileSync("src/routes/index.tsx", "utf8");
  assert.ok(!/size:\s*"\d/.test(home), "home pieces must not type a size");
});
