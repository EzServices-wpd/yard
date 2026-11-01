import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { openJoints } from "./rederive.ts";
import { offline } from "../../../scripts/eval-lib.ts";

// Rows 705/706 (class): on a stock switch every part re-derives from its joints. Two parts that meet face to face in
// the ¾" build still meet (within 1/16") in the switched build: no rod 1/4" off its upright, no back or shelf 1/4" off
// a side, no drawer floating over its bottom, no box 1/4" narrower than typed. The ¾" build is the spec, part by part.
// [switched prompt, stock pick, ¾" prompt when the switch is typed]
const CASES: [string, string | undefined, string?][] = [
  ["wardrobe 78 wide with 2 drawers", "plywood-1-2-4x8"],
  ["closet 72 wide 96 tall with 5 rods", "plywood-1-2-4x8"],
  ["medicine cabinet", "plywood-1-2-4x8"],
  ["7 drawer dresser 48 wide 20 deep 37 tall", "plywood-1-2-4x8"],
  ["closet system with 15 shelves", "plywood-1-2-4x8"],
  ["spice rack", "plywood-1-2-4x8"],
  ["kitchen island butcher block 48x24", "plywood-1-2-4x8"],
  ["bench with a drawer", "plywood-1-2-4x8"],
  ["filing cabinet", "plywood-1-2-4x8"],
  ["bookcase with 1 shelf", "plywood-1-2-4x8"],
  ["nightstand", "plywood-1-2-4x8"],
  ["over-toilet shelf", "plywood-1-2-4x8"],
  ["storage cubby 3x3", "plywood-1-2-4x8"],
  ["pocket vanity 18 wide", "plywood-1-2-4x8"],
  ["fold down desk", "plywood-1-2-4x8"],
  ["coat bench", "plywood-1-2-4x8"],
  ["storage ottoman 36 square", "plywood-1-2-4x8"],
  ["dresser 36x40x18 4 drawers in 1/2 inch plywood", undefined, "dresser 36x40x18 4 drawers"],
];

it("rows 705/706: every joint of the 3/4 build still meets after a stock switch, W and H hold", () => {
  const open: string[] = [];
  for (const [q, stock, base] of CASES) offline(() => {
    const was = generateFromPrompt(base ?? q).panels;
    const now = (stock ? generateFromPrompt(q, stock) : generateFromPrompt(q)).panels;
    assert.equal(now.length, was.length, `${q}: same parts`);
    for (const j of openJoints(was, now)) open.push(`${q}: ${j.a} / ${j.b} ${j.axis} ${j.gap.toFixed(3)}`);
    // The typed width and height hold: the outer faces stay put (depth may lose the 1/4" a proud front thinned).
    for (const a of ["x", "y"] as const) {
      const span = (ps: typeof was) => Math.max(...ps.map((p) => p.position[a] + p.size[a === "x" ? "width" : "height"])) - Math.min(...ps.map((p) => p.position[a]));
      if (Math.abs(span(now) - span(was)) > 1 / 16) open.push(`${q}: ${a} span ${span(was)} -> ${span(now)}`);
    }
  });
  assert.deepEqual(open, []);
});
