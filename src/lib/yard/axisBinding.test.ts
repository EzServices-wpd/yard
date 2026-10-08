/**
 * An axis word binds to its axis (overall is W × H × D): "A by B H high" is A wide, B deep, H tall; a planter's
 * "long" is its width and "wide" its depth; a typed axis is never overridden by a form default (arch span,
 * rocket width); every build shows a size, and an untyped size is marked assumed, never shown as typed.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { fmtUnitEnvelopeInches } from "./voiceHonesty";

const near = (v: number, want: number, tol = 0.6) => Math.abs(v - want) <= tol;
const CASES: [string, number, number, number][] = [
  ["folding table 48 by 24 36 inches high", 48, 36, 24],
  ["cedar planter 30 long 14 wide 12 tall", 30, 12, 14],
  ["PVC garden arch 4 feet wide", 48, 84, NaN],
  ["cardboard rocket 10 wide 28 tall", 10, 28, NaN],
  ["sawhorse 32 long", NaN, 30, 32],
];

describe("axis words bind to their axis", () => {
  for (const [prompt, w, h, d] of CASES) {
    it(prompt, () => {
      const o = generateFromPrompt(prompt).overall;
      if (!Number.isNaN(w)) assert.ok(near(o.width, w, 1.5), `width ${o.width} want ${w}`);
      if (!Number.isNaN(h)) assert.ok(near(o.height, h, 1), `height ${o.height} want ${h}`);
      if (!Number.isNaN(d)) assert.ok(near(o.depth, d, 1), `depth ${o.depth} want ${d}`);
    });
  }

  it("the sawhorse beam is the typed length", () => {
    const p = generateFromPrompt("sawhorse 32 long");
    assert.match(p.name, /^Sawhorse 32"/);
  });

  for (const prompt of ["shoe rack with cubbies", "entry bench with shoe storage", "bookshelf", "linen closet"]) {
    it(`${prompt} shows a size, marked assumed`, () => {
      const p = generateFromPrompt(prompt);
      const hud = fmtUnitEnvelopeInches(p.overall.width, p.overall.height, p.overall.depth, { prompt, name: p.name });
      assert.match(hud, /^\d[\d /]*" × \d[\d /]*" × \d[\d /]*" assumed$/, hud);
      assert.ok((p.notes ?? []).some((n) => /^Assumed /.test(n)), "Assumed notes");
    });
  }

  it("a typed triple still reads plain", () => {
    const p = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
    const hud = fmtUnitEnvelopeInches(p.overall.width, p.overall.height, p.overall.depth, { prompt: p.prompt, name: p.name });
    assert.doesNotMatch(hud, /assumed/);
  });
});
