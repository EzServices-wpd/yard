/**
 * Row 105 (Critic #98): the 6-drawer dresser and the jewelry box froze the tab. The ID buffer holds OTHER_ID (a
 * drawer bottom's outer faces) which the solver read as meshes[o − 1] (undefined.part), the generator threw, and
 * the driver's `while (!j.done) j.it.next()` spun forever. Class rules: an ID-buffer value only names a part when it
 * is in range; every solve is a step-budget job (capped, sliced, generator always closed: step-budget.test.ts), so
 * no solver error, slow solve or runaway generator can hang the page or leak its ID-pass meshes.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SOLVE_FINISH_MS, SOLVE_MAX_STEPS, SOLVE_ROUNDS, SOLVE_SLICE_MS, SPREAD_MAX, partIdAt, plainExplode } from "../src/components/workspace/explode-solver";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { TILT_MAX, TILT_STEP, growIfClear, layoutFor, posesFor, tweenCollides } from "../src/components/workspace/explode-layout";

const meshes = [{ part: { id: "a" } }, { part: { id: "b" } }];

test("an ID-buffer value names a part only when it is in range (0, OTHER_ID and junk name none)", () => {
  assert.equal(partIdAt(meshes, 1), "a");
  assert.equal(partIdAt(meshes, 2), "b");
  for (const o of [0, 3, 0xfffffe, -1, 1.5, NaN]) assert.equal(partIdAt(meshes, o), undefined, String(o));
});

test("the solver reads the ID buffer only through partIdAt, and is driven only as a step-budget job", () => {
  const solver = fs.readFileSync("src/components/workspace/explode-solver.ts", "utf8");
  const outside = solver.replace(/export function partIdAt[\s\S]*?\n\}/, "");
  assert.doesNotMatch(outside, /meshes\[(?:o|occ|f\.i) - 1\]/, "ID-buffer values go through partIdAt");
  assert.match(solver, /export function solveJob\(inp: SolveInput\): StepJob<ExplodeSolved>/);
  assert.doesNotMatch(solver, /\.next\(\)|while\s*\(\s*!/, "no hand-driven generator in the solver");
  // The generator frees its off-screen meshes in a finally (step-budget's closeJob makes it run on every exit).
  assert.match(solver, /\} finally \{\s*for \(const \{ mesh, material \} of meshes\)/);
});

test("the caps are finite and small: rounds + 2 steps, a 1.5 s wall deadline after a tap, ~12 ms slices", () => {
  assert.equal(SOLVE_MAX_STEPS, SOLVE_ROUNDS + 2);
  assert.ok(Number.isFinite(SOLVE_MAX_STEPS) && SOLVE_MAX_STEPS <= 50);
  assert.equal(SOLVE_FINISH_MS, 1500);
  assert.ok(SOLVE_SLICE_MS > 0 && SOLVE_SLICE_MS <= 16, "a slice fits in a frame");
});

test("the plain explode exists for the builds that froze (6-drawer dresser, jewelry box)", () => {
  for (const q of ["6 drawer dresser", "jewelry box with drawers"]) {
    const p = generateFromPrompt(q);
    const s = plainExplode(p.panels, q);
    assert.ok(s.poses.size > 0, q);
    assert.ok(Number.isFinite(s.box.maxX - s.box.minX), q);
  }
});

/**
 * Critic #98 row 107: a drawer column whose open top faced away showed side-on troughs (the vanity's left column).
 * The solver tips every hollow drawer's open top toward the camera (one value), spreads banks up to SPREAD_MAX and
 * turns a thin strip's broad face to it. Pinned at the caps: still nothing passes through anything, at any frame.
 */
for (const q of ["3 drawer dresser", "6 drawer dresser", "nightstand with 2 drawers", '60" desk with drawers', "filing cabinet 2 drawers", "pocket vanity", "jewelry box with drawers"]) {
  test(`${q}: tipping drawers, spreading banks and turning kicks as far as the solver can never makes units pass through each other`, () => {
    const L = layoutFor(generateFromPrompt(q).panels);
    for (const m of L.movers.values()) if (m.key.startsWith("kick:")) m.face = 1;
    for (let i = 0; i < 12; i++) { const w = L.tilt.ang; growIfClear(L, () => { L.tilt.ang = Math.min(TILT_MAX, w + TILT_STEP); }, () => { L.tilt.ang = w; }); }
    const bank = [...L.movers.values()].find((m) => m.bank)?.bank;
    for (let i = 0; bank && i < 25; i++) { const w = bank.spread; if (w >= SPREAD_MAX) break; growIfClear(L, () => { bank.spread = w + 0.1; }, () => { bank.spread = w; }); }
    assert.equal(tweenCollides(L, posesFor(L), 60), false);
    if (q === "pocket vanity" || q === "3 drawer dresser") assert.ok(L.tilt.ang > 0, `${q}: drawers can tip`);
  });
}

test("the driver never steps a solve by hand: idle slices and the tap both go through step-budget, and old solves are closed", () => {
  const src = fs.readFileSync("src/components/workspace/explode-driver.tsx", "utf8");
  assert.doesNotMatch(src, /while\s*\(/, "no unbounded while in the driver");
  assert.doesNotMatch(src, /\.next\(\)/, "no raw next() in the driver");
  assert.match(src, /runSlice\(j, fallback, \{ maxSteps: SOLVE_MAX_STEPS, sliceMs: SOLVE_SLICE_MS \}/, "idle: one capped slice per callback");
  assert.match(src, /runJob\(j, fallback, \{ maxSteps: SOLVE_MAX_STEPS, deadlineMs: SOLVE_FINISH_MS, sliceMs: SOLVE_SLICE_MS \}/, "tap: sliced, 1.5 s wall deadline");
  assert.match(src, /return cancel;/, "toggling off (or a new build) cancels the tap's solve");
  // A new build or size, and unmounting, close the old solve (its finally frees the ID-pass meshes).
  assert.ok((src.match(/closeJob\(/g) ?? []).length >= 3);
});
