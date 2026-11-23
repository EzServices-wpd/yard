/**
 * The header's size is the built outside. A typed or catalog box that the parts stand past
 * (a swing set's splayed legs, a bed's guards, a porch swing's depth) does not stay in the header.
 * The words stay (beam, long, wide, tall, W, D, H). Steps keep the name the builder stamped.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { headerTitle } from "./pdf.ts";
import { buildPlan } from "./report.ts";

const header = (q: string) => headerTitle(generateFromPrompt(q), { features: false });

describe("header axes come from the built outside", () => {
  it("a sized swing set says the outside beam, spread and height", () => {
    const q = "swing set 12 wide 12 tall 8 deep";
    assert.equal(header(q), 'Swing set 0\' 9" beam x 1\' 1" tall · 28 1/8" W × 8 11/16" D × 13 1/4" H');
    // The step still quotes the builder's name. The header is the only line that moved.
    assert.match(buildPlan(generateFromPrompt(q)).instructions[0].description, /1' beam × 1' tall/);
  });

  it("a synonym prompt is the same class", () => {
    assert.equal(header("a-frame swing 12 wide 12 tall 8 deep"), header("swing set 12 wide 12 tall 8 deep"));
  });

  it("a near-miss unsized swing set keeps the beam it built", () => {
    assert.equal(header("swing set"), 'Swing set 10\' beam x 7\' 8" tall · 69" W × 120" D × 92" H (size assumed)');
  });

  it("a platform bed whose guards stand past the typed height says the outside", () => {
    const q = "platform bed 82 wide 75 tall 39 deep";
    assert.equal(header(q), 'Platform bed 82" long x 39" wide x 84 1/2" tall · 82" W × 39" D × 84 1/2" H');
    assert.match(buildPlan(generateFromPrompt(q)).instructions[0].description, /39" long × 82" wide × 75" tall/);
  });

  it("a near-miss twin platform bed keeps 82 long × 39 wide × 14 tall", () => {
    assert.equal(header("platform bed twin 39 by 75"), 'Platform bed 82" long x 39" wide x 14" tall · 82" W × 39" D × 14" H (H assumed)');
  });
});

describe("the same outside rule on other prompts", () => {
  const cases: [string, string][] = [
    // outdoor
    ["kids swing set 10 wide 14 tall 9 deep", 'Swing set 0\' 9" beam x 1\' 2" tall · 15 5/16" W × 9 3/16" D × 14" H'],
    ["porch swing 60 wide 24 deep", 'Porch swing frame · 60" W × 36" D × 78" H (H assumed)'],
    ["sawhorse", 'Sawhorse · 21" W × 36" D × 30" H (size assumed)'],
    ["garden gate", 'Garden gate · 36" W × 2 1/4" D × 48" H (size assumed)'],
    // beds
    ["queen platform bed 90 wide 80 tall 60 deep", 'Platform bed 90" long x 87" wide x 89 1/2" tall · 90" W × 87" D × 89 1/2" H'],
    ["queen platform bed", 'Platform bed 87" long x 67" wide x 14" tall · 87" W × 67" D × 14" H (H assumed)'],
    ["bunk bed", 'Bunk bed 82" long x 44" wide x 65" tall · 82" W × 44" D × 65" H (H assumed)'],
    // toys, PVC, stick frames — the outside already was the header
    ["PVC soccer goal", 'PVC Soccer Goal · 48" W × 18" D × 36" H (size assumed)'],
    ["toy airplane", 'Toy Airplane · 11 13/16" W × 8" D × 8" H (size assumed)'],
    ["popsicle stick bridge 24 long", 'Bridge · 24" W × 8" D × 8" H (D, H assumed)'],
    ["cardboard robot 18 tall", 'Cardboard robot 18" tall · 11 1/4" W × 4 15/16" D × 18" H (W, D assumed)'],
    ["3 foot Eiffel Tower from popsicle sticks", 'Eiffel Tower · 15 3/16" W × 15 3/16" D × 37 3/8" H'],
  ];
  for (const [q, expect] of cases) it(q, () => assert.equal(header(q), expect));
});
