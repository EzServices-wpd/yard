import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { headerTitle } from "./pdf.ts";

it("the linen closet header says back the typed outer size: 31 1/2 W x 16 D x 78 H (doors proud are a note, not the header)", () => {
  assert.equal(headerTitle(generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep")), 'Linen · 31 1/2" W × 16" D × 78" H');
});

it("a typed depth always wins in the header; an assumed one reads the model's finished depth", () => {
  for (const q of ["bookshelf 30 wide 60 tall 12 deep", "kitchen base cabinet 36 wide 34.5 tall 24 deep", "linen closet 24 wide 84 tall 18 deep"]) {
    const p = generateFromPrompt(q);
    assert.match(headerTitle(p), new RegExp(` ${q.match(/(\d+(?:\.\d+)?) deep/)![1].replace(".5", " 1/2")}" D `), q);
  }
});
