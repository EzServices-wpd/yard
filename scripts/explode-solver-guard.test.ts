/**
 * Row 105 (Critic #98): the 6-drawer dresser and the jewelry box froze the tab. The ID buffer holds OTHER_ID (a
 * drawer bottom's outer faces) which the solver read as meshes[o − 1] (undefined.part), the generator threw, and
 * the driver's `while (!j.done) j.it.next()` spun forever. Class rules: an ID-buffer value only names a part when it
 * is in range; no solver error, slow solve or runaway generator can hang the page (it falls back to the plain
 * explode, and logs).
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SOLVE_MAX_STEPS, driveSolve, partIdAt, plainExplode } from "../src/components/workspace/explode-solver";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import type { ExplodeSolved } from "../src/components/workspace/explode-state";

const meshes = [{ part: { id: "a" } }, { part: { id: "b" } }];

test("an ID-buffer value names a part only when it is in range (0, OTHER_ID and junk name none)", () => {
  assert.equal(partIdAt(meshes, 1), "a");
  assert.equal(partIdAt(meshes, 2), "b");
  for (const o of [0, 3, 0xfffffe, -1, 1.5, NaN]) assert.equal(partIdAt(meshes, o), undefined, String(o));
});

const fake = (key: string) => ({ key } as unknown as ExplodeSolved);

test("a solver that throws ends with the plain explode and reports the error (never spins)", () => {
  function* boom(): Generator<number, ExplodeSolved, void> { yield 0; throw new TypeError("Cannot read properties of undefined (reading 'part')"); }
  const job = { it: boom(), steps: 0, done: null as ExplodeSolved | null };
  const errs: unknown[] = [];
  const r = driveSolve(job, () => fake("plain"), { onError: (e) => errs.push(e) });
  assert.equal(r?.key, "plain");
  assert.equal(job.done?.key, "plain");
  assert.equal(errs.length, 1);
  // A finished job stays finished: no further next() on a dead generator.
  assert.equal(driveSolve(job, () => fake("again"))?.key, "plain");
});

test("a runaway solver is capped by steps, and a slow one by the deadline", () => {
  function* forever(): Generator<number, ExplodeSolved, void> { for (let i = 0; ; i++) yield i; }
  const a = { it: forever(), steps: 0, done: null as ExplodeSolved | null };
  assert.equal(driveSolve(a, () => fake("capped"))?.key, "capped");
  assert.ok(a.steps <= SOLVE_MAX_STEPS);
  let t = 0;
  const b = { it: forever(), steps: 0, done: null as ExplodeSolved | null };
  assert.equal(driveSolve(b, () => fake("late"), { deadlineMs: 100, now: () => (t += 60) })?.key, "late");
  // Idle slices: one step per call returns null until the end.
  const c = { it: forever(), steps: 0, done: null as ExplodeSolved | null };
  assert.equal(driveSolve(c, () => fake("x"), { budget: 1 }), null);
  assert.equal(c.steps, 1);
});

test("the plain explode exists for the builds that froze (6-drawer dresser, jewelry box)", () => {
  for (const q of ["6 drawer dresser", "jewelry box with drawers"]) {
    const p = generateFromPrompt(q);
    const s = plainExplode(p.panels, q);
    assert.ok(s.poses.size > 0, q);
    assert.ok(Number.isFinite(s.box.maxX - s.box.minX), q);
  }
});

test("the driver never loops on a generator itself: every solve goes through driveSolve", () => {
  const src = fs.readFileSync("src/components/workspace/explode-driver.tsx", "utf8");
  assert.doesNotMatch(src, /while\s*\(/, "no unbounded while in the driver");
  assert.doesNotMatch(src, /\.it\.next\(\)/, "no raw next() outside driveSolve");
  assert.match(src, /driveSolve\(/);
  const solver = fs.readFileSync("src/components/workspace/explode-solver.ts", "utf8");
  const outside = solver.replace(/export function partIdAt[\s\S]*?\n\}/, "");
  assert.doesNotMatch(outside, /meshes\[(?:o|occ|f\.i) - 1\]/, "ID-buffer values go through partIdAt");
});
