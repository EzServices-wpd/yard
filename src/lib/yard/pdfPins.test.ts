// A part letter's leader lands on paint of that part that is still showing (Critic on #82: the exploded water wheel's
// D, E and G pointed at an axle, a post and a paddle hidden behind other parts).
import test from "node:test";
import assert from "node:assert/strict";
import { paintOf, visiblePin } from "./pdfDraw";

const sq = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const at = (m: Record<string, { x: number; y: number }>) => new Map(Object.entries(m));

test("a part whose centre shows keeps its centre (no churn)", () => {
  const painted = [paintOf("a", [sq(0, 0, 40, 40)]), paintOf("b", [sq(100, 0, 140, 40)])];
  assert.deepEqual(visiblePin(painted, ["a"], at({ a: { x: 20, y: 20 } })), { x: 20, y: 20 });
});

test("a part covered at its centre is pinned where it still shows", () => {
  // b (painted later) covers a's left 30; a shows only from x 30 to 40.
  const painted = [paintOf("a", [sq(0, 0, 40, 40)]), paintOf("b", [sq(-5, -5, 30, 45)])];
  const p = visiblePin(painted, ["a"], at({ a: { x: 20, y: 20 } }));
  assert.ok(p.x > 30 && p.x < 40 && p.y > 0 && p.y < 40, JSON.stringify(p));
});

test("a later part's hole lets the earlier part show through (a rim's open centre)", () => {
  const ring = paintOf("rim", [sq(-50, -50, 50, 50), sq(-20, -20, 20, 20)]);
  const painted = [paintOf("hub", [sq(-10, -10, 10, 10)]), ring];
  assert.deepEqual(visiblePin(painted, ["hub"], at({ hub: { x: 0, y: 0 } })), { x: 0, y: 0 });
  const solid = paintOf("disc", [sq(-50, -50, 50, 50)]);
  // Behind a solid disc the hub shows nowhere, so its old centre stays (nothing better to point at).
  assert.deepEqual(visiblePin([painted[0], solid], ["hub"], at({ hub: { x: 0, y: 0 } })), { x: 0, y: 0 });
});

test("of parts sharing a letter, the pin goes to one that shows when the first is hidden", () => {
  const painted = [paintOf("g1", [sq(0, 0, 20, 20)]), paintOf("cover", [sq(-5, -5, 25, 25)]), paintOf("g2", [sq(60, 0, 80, 20)])];
  const p = visiblePin(painted, ["g1", "g2"], at({ g1: { x: 10, y: 10 }, g2: { x: 70, y: 10 } }));
  assert.ok(p.x > 60 && p.x < 80, JSON.stringify(p));
});

test("a stroked stick counts as paint along its width", () => {
  const painted = [paintOf("a", [sq(0, 0, 40, 40)]), paintOf("rod", [], { a: { x: 20, y: -10 }, b: { x: 20, y: 50 }, r: 4 })];
  const p = visiblePin(painted, ["a"], at({ a: { x: 20, y: 20 } }));
  assert.ok(Math.abs(p.x - 20) > 4 + 2.5 - 1e-9, JSON.stringify(p));
});
