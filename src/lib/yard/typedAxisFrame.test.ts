/**
 * A typed axis sizes the members (a splay stays inside the spread,
 * a guard stops at the posts, a typed depth is the stand). Header, step 1 and the drawing labels
 * then read that one outside. A sentence with no typed axis is not.
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
  it("a wheel's spokes and steps are not in this change: the unsized wheel keeps its size and one Axle step", () => {
    const s = surfaces("ferris wheel");
    assert.equal(s.header, 'Ferris wheel · 18" W × 8" D × 18 3/4" H (size assumed)');
    const steps = buildPlan(s.p).instructions;
    assert.equal(steps.length, 15);
    assert.equal(steps.filter((x) => x.title === "Set the Axle").length, 0);
  });

  it("header, step 1 and the drawing labels are one size", () => {
    for (const q of [
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
