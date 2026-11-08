/** The three.js stage colours are the page's @theme tokens (Night shop), so the bench never drifts from the chrome. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { STAGE } from "../src/components/workspace/stage-palette";
import { SHOP_GROUND } from "../src/components/workspace/shop-light";

const css = fs.readFileSync(path.join(import.meta.dirname, "../src/styles.css"), "utf8");
const theme = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")));
const token = (name: string) => theme.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, "i"))?.[1]?.toLowerCase();

test("every stage colour equals its @theme token", () => {
  assert.equal(STAGE.ghost, token("faint"), "STAGE.ghost vs --color-faint");
  assert.equal(STAGE.mark, token("mark"), "STAGE.mark vs --color-mark");
  // Yard Design's stage ground (read only): bg, floor and grid lines on the same tokens.
  assert.equal(SHOP_GROUND.bg, token("bg"), "SHOP_GROUND.bg vs --color-bg");
  assert.equal(SHOP_GROUND.floor, token("surface"), "SHOP_GROUND.floor vs --color-surface");
  assert.equal(SHOP_GROUND.gridSection, token("border"), "SHOP_GROUND.gridSection vs --color-border");
});

test("canvas.tsx draws the stage from STAGE / SHOP_GROUND, not hex literals", () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, "../src/components/workspace/canvas.tsx"), "utf8");
  for (const old of ["#1a1612", "#231d17", "#2a241e", "#8a8478", "#c4b49a"]) assert.ok(!src.includes(old), `canvas.tsx still has ${old}`);
});
