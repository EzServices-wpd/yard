// Bench inks and marks on Night shop B: equal to their src/styles.css tokens, and the measure box and opening ghost reach 3:1.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BENCH_INK, MARK_ALPHA, SHOP_GROUND, SHOP_LIGHT, SHOP_LIT_FLOOR, STEP_GLOW } from "../src/components/workspace/shop-light";
import { STAGE } from "../src/components/workspace/stage-palette";

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const css = read("src/styles.css");
const theme = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")));
const token = (name: string) => theme.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, "i"))?.[1]?.toLowerCase();
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c: number[]) => {
  const [r, g, b] = c.map((v) => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** WCAG contrast of a line drawn at `alpha` over `ground` (sRGB blend, as the bench canvas composites). */
const lineContrast = (fg: string, alpha: number, ground: string) => {
  const g = rgb(ground), mix = rgb(fg).map((v, i) => v * alpha + g[i] * (1 - alpha));
  const [hi, lo] = [lum(mix), lum(g)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
};

test("bench inks and the hemisphere ground equal their Night shop tokens", () => {
  assert.equal(BENCH_INK.ink, token("fg"), "ink vs --color-fg");
  assert.equal(BENCH_INK.stepGlow, token("warn"), "step glow vs --color-warn (warm tan, a wood-tone lift)");
  assert.equal(BENCH_INK.stepEdge, token("mark"), "step edge vs --color-mark");
  assert.equal(SHOP_LIGHT.hemi.ground, SHOP_GROUND.bg, "hemi ground is the bench ground");
  assert.equal(SHOP_GROUND.bg, token("bg"));
});

test("no warm leftovers: the bench files draw from BENCH_INK, not the old hex literals", () => {
  for (const f of ["canvas.tsx", "scale-ghost.tsx", "stick-cloud.tsx", "shop-light.ts"]) {
    const src = read(`src/components/workspace/${f}`);
    for (const old of ["#14110d", "#d7cbb6", "#e0782f", "#ff8a3d"]) assert.ok(!src.includes(old), `${f} still has ${old}`);
  }
  assert.doesNotMatch(read("src/components/workspace/canvas.tsx"), /color="#000000"/);
});

test("the measure box and opening ghost reach 3:1 on the bench bg, floor and lit floor (non-text indicators)", () => {
  for (const ground of [SHOP_GROUND.bg, SHOP_GROUND.floor, SHOP_LIT_FLOOR]) {
    assert.ok(lineContrast(STAGE.mark, MARK_ALPHA.measure, ground) >= 3, `measure box on ${ground}`);
    assert.ok(lineContrast(STAGE.ghost, MARK_ALPHA.ghostMain, ground) >= 3, `ghost main on ${ground}`);
    assert.ok(lineContrast(STAGE.ghost, MARK_ALPHA.ghostFine, ground) >= 3, `ghost fine on ${ground}`);
  }
  // Before this PR: 0.38 and 0.18 measured 2.26:1 and 1.30:1.
  assert.ok(lineContrast(STAGE.mark, 0.38, SHOP_GROUND.bg) < 2.3 && lineContrast(STAGE.ghost, 0.18, SHOP_GROUND.bg) < 1.35);
  const canvas = read("src/components/workspace/canvas.tsx");
  assert.match(canvas, /opacity=\{MARK_ALPHA\.measure\}/);
  assert.match(canvas, /color=\{HULL\} alpha=\{\[MARK_ALPHA\.ghostMain, MARK_ALPHA\.ghostFine\]\}/);
});

const hsl = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => v / 255), hi = Math.max(r, g, b), lo = Math.min(r, g, b), l = (hi + lo) / 2;
  return { s: hi === lo ? 0 : (hi - lo) / (1 - Math.abs(2 * l - 1)), hue: hi === lo ? 0 : hi === r ? (60 * ((g - b) / (hi - lo)) + 360) % 360 : 0 };
};
// Wood under the shop key renders around hue 37-40 deg (linen #bb9d67, cat tree #c9a76a, PR #188 pixel measurement).
const SAT_TOLERANCE = 0.03;
/** [scene, lit-face mean with glow off, with the shipped lift] (1440 step view, same camera, glowpix measurement). */
const MEASURED_LIT: [string, string, string][] = [
  ["linen step 3", "#bb9d67", "#c2a671"],
  ["cat tree step 1", "#c9a76a", "#ceaf74"],
];
// Before this PR's fix, the neutral --color-fg lift at 0.22 measured #ccbca2 / #d6c4a6: 0.08 / 0.10 saturation lost.

test("the step lift keeps real wood tone: low intensity, a warm wood-hue emissive, never white", () => {
  assert.ok(STEP_GLOW.step > 0 && STEP_GLOW.step <= 0.1, `step glow ${STEP_GLOW.step} must stay at or below 0.1`);
  const glow = hsl(BENCH_INK.stepGlow);
  assert.ok(glow.hue >= 30 && glow.hue <= 45, `step glow hue ${glow.hue.toFixed(0)} sits in the wood range`);
  assert.ok(glow.s >= 0.3, `step glow saturation ${glow.s.toFixed(2)}: a neutral emissive greys the wood`);
  // Measured lit-face means (1440 step view, same camera, glow off vs the shipped lift): saturation within SAT_TOLERANCE.
  for (const [name, real, lit] of MEASURED_LIT) {
    assert.ok(Math.abs(hsl(lit).s - hsl(real).s) <= SAT_TOLERANCE, `${name}: lit ${lit} vs real ${real}`);
  }
  assert.ok(hsl("#bb9d67").s - hsl("#ccbca2").s > SAT_TOLERANCE, "the old 0.22 neutral wash would fail this check");
  const cloud = read("src/components/workspace/stick-cloud.tsx");
  assert.match(cloud, /inStep \? STEP_GLOW\.step : selected \? STEP_GLOW\.selected : 0/);
});
