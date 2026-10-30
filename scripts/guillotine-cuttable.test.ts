/** Every plywood sheet layout Yard draws can be cut with straight edge-to-edge saw cuts (guillotine), kerf included. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { guillotineCuttable, type Rect } from "./guillotine-cuttable";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { planSheetNest, nestParts, BLADE_KERF } from "../src/lib/yard/nesting";

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

test("checker: grid and strip layouts cut; a pinwheel does not; kerf gaps are enforced", () => {
  const S = { width: 96, height: 48 };
  assert.equal(guillotineCuttable([], S).ok, true);
  assert.equal(guillotineCuttable([r(0, 0, 96, 48)], S).ok, true);
  assert.equal(guillotineCuttable([r(0, 0, 40, 20), r(40, 0, 40, 20), r(0, 20, 30, 28), r(30, 20, 50, 28)], S).ok, true);
  // Pinwheel: four pieces around a centre square, no through-line in either direction.
  const pin = [r(0, 0, 60, 20), r(60, 0, 36, 30), r(36, 30, 60, 18), r(0, 20, 36, 28), r(36, 20, 24, 10)];
  const res = guillotineCuttable(pin, S);
  assert.equal(res.ok, false);
  assert.equal(!res.ok && res.reason, "no-through-cut");
  // Touching pieces cut geometrically but not with a 1/8" blade between them.
  const touch = [r(0, 0, 48, 48), r(48, 0, 48, 48)];
  assert.equal(guillotineCuttable(touch, S, 0).ok, true);
  assert.equal(guillotineCuttable(touch, S, 0.125).ok, false);
  assert.equal(guillotineCuttable([r(0, 0, 47.875, 48), r(48, 0, 48, 48)], S, 0.125).ok, true);
  // Each sanity branch is pinned by its reason; with it disabled these fall through to "no-through-cut".
  const edge = guillotineCuttable([r(0, 0, 50, 48), r(48, 0, 48, 48)], S);
  assert.equal(!edge.ok && edge.reason, "overlap", "edge overlap is reported");
  const inner = guillotineCuttable([r(0, 0, 40, 40), r(10, 10, 10, 10)], S);
  assert.equal(!inner.ok && inner.reason, "overlap", "a piece inside another is reported");
  const off = guillotineCuttable([r(90, 0, 10, 10)], S);
  assert.equal(!off.ok && off.reason, "off-sheet");
});

test("nestParts: a part 1/16\" wider than the one under it still leaves a full kerf before its neighbour", () => {
  // B is 1/16" wider than A, and C is taller than A, so the only cut that frees C is the vertical one past B.
  const p = (id: string, width: number, height: number) => ({ id, name: id, label: id, width, height, material: "ply", allowRotate: false });
  const nest = nestParts([p("A", 40, 20), p("B", 40.0625, 10), p("C", 20, 40)]);
  assert.equal(nest.totalSheets, 1);
  assert.equal(nest.unplaced.length, 0);
  for (const s of nest.sheets) assert.equal(guillotineCuttable(s.parts, s, BLADE_KERF).ok, true);
});

const P = JSON.parse(readFileSync("evals/prompts.json", "utf8"));
const PROMPTS: string[] = [...new Set([
  "linen closet 31.5 wide 78 tall 16 deep", "pocket vanity", "big ben", "brooklyn bridge", "eiffel tower", "submarine", "trebuchet", "water wheel",
  // The 13 builds whose layouts had two pieces touching with no saw gap before the kerf fix (guillotine audit, 2026-10-24).
  "bathroom cabinet 24 wide 32 tall 18 deep with 1 drawer and 2 doors", "bookcase with drawers", "broom closet cabinet to fit a 22 inch gap 80 tall 14 deep",
  "dresser 36 wide 34 tall 18 deep with 4 drawers", "dresser 54x20x30", "firewood rack outdoor", "kitchen wall cabinet", "record storage shelf 30 wide",
  "under-stairs shelf", "wall cabinet", "wardrobe 96 wide", "wardrobe with 3 shelves", "wardrobe with 4 shelves",
  ...(P.prompts ?? P).map((x: string | { prompt: string }) => (typeof x === "string" ? x : x.prompt)),
])];

test("every sheet the plan shows (structural and backer) is guillotine-cuttable with the engine's kerf", () => {
  const bad: string[] = [];
  let sheets = 0;
  for (const q of PROMPTS) {
    const plan = buildPlan(generateFromPrompt(q));
    const nest = plan.sheetNest ?? planSheetNest(plan.cutList);
    for (const [kind, n] of [["sheets", nest.sheets], ["backer", nest.backer]] as const)
      for (const s of n?.sheets ?? []) {
        sheets++;
        const res = guillotineCuttable(s.parts, s, BLADE_KERF);
        if (!res.ok) bad.push(`${q} · ${kind} sheet ${s.index}: ${res.reason} ${res.pieces.map((p) => `${p.label ?? p.name}@${p.x},${p.y} ${p.width}x${p.height}`).join("; ")}`);
      }
  }
  assert.ok(sheets > 0, "the corpus nests at least one sheet");
  assert.deepEqual(bad, []);
});
