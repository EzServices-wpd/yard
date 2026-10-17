import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { thicknessFailures, stockThickness, partThickness } from "./stockThickness.ts";
import { hiddenOverlaps, rotorPlayFailures } from "./solids.ts";
import { offline } from "../../../scripts/eval-lib.ts";

// Class: stock thickness never scales. A resized build stretches lengths and widths; every part stays as thick as
// its sheet or board (or whole layers of it, with a glue-up that says so). Default-size authored thicknesses are
// ratcheted in invariants-baseline.json (I28).
const SWEEP = [
  "water wheel 14 wide", "water wheel 24 wide", "water wheel 36 wide", "water wheel", "waterwheel 14 wide 24 tall",
  "water wheel 30 wide 40 tall 30 deep", "water wheel 20 tall", "water wheel 48 tall", "water wheel 36 deep", "garden water wheel 24 wide",
  "compost tumbler frame 60 wide", "compost tumbler frame 36 wide", "compost tumbler frame 30 tall", "ferris wheel 30 wide", "ferris wheel 12 wide",
  "abacus 24 wide", "abacus 8 wide", "water wheel 16 wide", "water wheel 42 wide", "compost tumbler frame 72 wide 48 tall",
];

it("stock thickness sweep: 20 prompts incl. resized wheels, every part is whole layers of its stock", () =>
  offline(() => {
    const bad = SWEEP.flatMap((q) => {
      const p = generateFromPrompt(q);
      return thicknessFailures(p, buildPlan(p)).map((m) => `${q}: ${m}`);
    });
    assert.deepEqual(bad, []);
  }));

it("resized wheels keep 3/4 plywood rims, spokes and hubs, stay clear and held", () =>
  offline(() => {
    for (const q of ["water wheel 14 wide", "water wheel 24 wide", "water wheel 36 wide"]) {
      const p = generateFromPrompt(q);
      for (const part of p.panels.filter((x) => /^(?:Rim|Spoke|hub|Collar)\b/.test(x.name))) {
        const T = stockThickness(part.materialId)!;
        assert.ok(Math.abs(partThickness(part) / T - Math.round(partThickness(part) / T)) * T < 1 / 32, `${q}: ${part.name} ${partThickness(part)}`);
      }
      assert.deepEqual(hiddenOverlaps(p), [], q);
      assert.deepEqual(rotorPlayFailures(p), [], q);
    }
  }));

it("lamination text reads off the real layers: count × stock thickness", () =>
  offline(() => {
    const p = generateFromPrompt("water wheel");
    for (const r of p.panels.filter((x) => /^Rim \d$/.test(x.name))) r.size = { ...r.size, width: 1.5 };
    const plan = buildPlan(p);
    const rim = plan.cutList.find((c) => c.name.toLowerCase() === "rim")!;
    assert.match(rim.notes ?? "", /Glue up 2 layers face to face for each 1 1\/2" rim/);
    assert.match(plan.instructions.find((s) => s.title === "Glue up the thick parts")!.description, /Rim: 2 layers/);
    assert.deepEqual(thicknessFailures(p, plan).filter((m) => /^Rim/.test(m)), []);
    // A part that is not whole layers is caught, whatever the text says.
    const q = generateFromPrompt("water wheel");
    for (const r of q.panels.filter((x) => /^Rim \d$/.test(x.name))) r.size = { ...r.size, width: 1.06 };
    const qp = buildPlan(q);
    assert.ok(thicknessFailures(q, qp).some((m) => /^Rim 1 is 1\.06" thick, not a whole number/.test(m)));
    // The note never pairs "2 layers" with the model's 1 1/16": 2 layers of 3/4" make 1 1/2".
    assert.match(qp.cutList.find((c) => c.name.toLowerCase() === "rim")!.notes ?? "", /Glue up 2 layers face to face for each 1 1\/2" rim/);
  }));
