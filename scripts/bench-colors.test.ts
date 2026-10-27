// Bench inks and marks on Night shop B: equal to their src/styles.css tokens, and the measure box and opening ghost reach 3:1.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BENCH_INK, MARK_ALPHA, SHOP_GROUND, SHOP_LIGHT } from "../src/components/workspace/shop-light";
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
  assert.equal(BENCH_INK.stepGlow, token("fg"), "step glow vs --color-fg");
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

// The floor as rendered under the warm key (sampled from the 1440 linen bench): lighter than its --color-surface base.
const LIT_FLOOR = "#2f2c29";

test("the measure box and opening ghost reach 3:1 on the bench bg, floor and lit floor (non-text indicators)", () => {
  for (const ground of [SHOP_GROUND.bg, SHOP_GROUND.floor, LIT_FLOOR]) {
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
