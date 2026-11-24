/**
 * A typed axis sizes the members (a spoke ends at the rim it joins, a splay stays inside the spread,
 * a guard stops at the posts, a typed depth is the stand). Header, step 1 and the drawing labels
 * then read that one outside. A synonym ("12 inches across") is the same class. A sentence with no
 * typed axis is not.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { headerTitle } from "./pdf.ts";
import { buildPlan } from "./report.ts";
import { headerBox } from "./headerSize.ts";
import { drawnExtent, lineSpans } from "./pdfDraw.ts";
import { inchFrac } from "./inchText.ts";

const surfaces = (q: string) => {
  const p = generateFromPrompt(q);
  const plan = buildPlan(p);
  const e = drawnExtent(p)!;
  const span = lineSpans(p, e);
  const step = plan.instructions[0]?.description ?? "";
  const unit = step.match(/Unit ([\d\s/]+)" wide × ([\d\s/]+)" deep × ([\d\s/]+)" high/);
  return { p, header: headerTitle(p, { features: false }), box: headerBox(p), span, unit, step };
};

describe("a typed axis sizes the frame, and every surface says that size", () => {
  it("popsicle ferris wheel 12 wide: spokes end on the rim, and the wheel is 12 wide", () => {
    const s = surfaces("popsicle stick ferris wheel 12 wide");
    assert.equal(s.header, 'Ferris wheel · 12" W × 8" D × 18 1/16" H (D, H assumed)');
    const spokes = s.p.panels.filter((p) => /spoke/i.test(p.name));
    const rims = s.p.panels.filter((p) => /rim/i.test(p.name));
    assert.ok(spokes.length >= 4 && rims.length >= 1);
    const rim = Math.max(...rims.map((p) => Math.max(p.size.width, p.size.height)));
    for (const sp of spokes) {
      const len = sp.blank?.lengthIn ?? Math.max(sp.size.width, sp.size.height);
      assert.ok(len <= rim + 1 / 16, `${sp.name} is ${len}" on a ${rim}" rim`);
    }
    assert.ok(s.box.width <= 12 + 1 / 16, `wheel is ${s.box.width}" wide`);
  });

  it("a synonym is the same class: 12 inches across", () => {
    assert.equal(
      surfaces("ferris wheel 12 inches across").header,
      surfaces("popsicle stick ferris wheel 12 wide").header,
    );
  });

  it("a near-miss with no typed axis keeps the wheel it built", () => {
    const s = surfaces("ferris wheel");
    assert.equal(s.header, 'Ferris wheel · 18" W × 8" D × 18 1/2" H (size assumed)');
    assert.ok(s.box.width > 12, "the unsized wheel is not forced to 12");
  });

  it("header, step 1 and the drawing labels are one size", () => {
    for (const q of [
      "popsicle stick ferris wheel 12 wide",
      "ferris wheel 12 inches across",
      "swing set 12 wide 12 tall 8 deep",
      "porch swing 60 wide 24 deep",
      "marble run from 3/4 inch dowel",
      "sawbuck from 3/4 inch dowel",
      "water wheel from 3/4 inch dowel",
    ]) {
      const s = surfaces(q);
      assert.ok(s.unit, `${q}: step 1 has no Unit line: ${s.step.slice(0, 120)}`);
      assert.equal(s.unit![1].trim(), inchFrac(s.box.width), `${q} width`);
      assert.equal(s.unit![2].trim(), inchFrac(s.box.depth), `${q} depth`);
      assert.equal(s.unit![3].trim(), inchFrac(s.box.height), `${q} height`);
      assert.ok(Math.abs(s.span.width - s.box.width) < 1 / 16, `${q} label W`);
      assert.ok(Math.abs(s.span.depth - s.box.depth) < 1 / 16, `${q} label D`);
      assert.ok(Math.abs(s.span.height - s.box.height) < 1 / 16, `${q} label H`);
    }
  });
});
