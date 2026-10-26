/** The three.js stage colours are the page's @theme tokens (Night shop), so the bench never drifts from the chrome. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { STAGE } from "../src/components/workspace/stage-palette";

const css = fs.readFileSync(path.join(import.meta.dirname, "../src/styles.css"), "utf8");
const theme = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")));
const token = (name: string) => theme.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, "i"))?.[1]?.toLowerCase();

test("every stage colour equals its @theme token", () => {
  const want = { bg: "bg", floor: "surface", grid: "border", ghost: "faint", mark: "mark" } as const;
  for (const [k, t] of Object.entries(want)) assert.equal(STAGE[k as keyof typeof STAGE], token(t), `STAGE.${k} vs --color-${t}`);
});

test("canvas.tsx draws the stage from STAGE, not hex literals", () => {
  const src = fs.readFileSync(path.join(import.meta.dirname, "../src/components/workspace/canvas.tsx"), "utf8");
  for (const old of ["#1a1612", "#231d17", "#2a241e", "#8a8478", "#c4b49a"]) assert.ok(!src.includes(old), `canvas.tsx still has ${old}`);
});
