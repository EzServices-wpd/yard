import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { thicknessFailures, stockThickness, partThickness } from "./stockThickness.ts";
import { hiddenOverlaps, rotorPlayFailures } from "./solids.ts";
import { rodArrayFailures, rodArrays, instanceRods, TOUCH } from "./rodArrays.ts";
import { corpus } from "../../../scripts/invariants-corpus.ts";
import { offline } from "../../../scripts/eval-lib.ts";
import { getCatalogItem } from "./catalog.ts";

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

// Rod arrays fit their span (I30): any row of like round rods, and what rides on them, lies inside the parts that
// bound the row and clears its neighbours. Rod-array prompts beyond the corpus: racks, ladders, stands, frames.
const ROD_SWEEP = ["abacus 4 wide", "abacus 8 wide 12 rods", "abacus 6 wide", "abacus 8 wide", "abacus 10 wide", "abacus 12 wide", "abacus", "abacus 24 wide", "cardboard abacus",
  "dowel drying rack 12 wide", "dowel drying rack 6 wide", "pvc drying rack", "1/4 inch dowel ladder", "1/4 inch dowel ladder 3 wide", "dowel ladder 4 wide", "pvc ladder",
  "dowel shoe rack", "dowel shoe rack 6 wide", "pvc shoe rack", "dowel coat rack", "dowel wine rack", "dowel magazine rack", "dowel plant stand",
  "picture frame from bamboo skewers", "spool rack", "thread spool holder", "towel rack 10 wide", "blanket ladder 8 wide"];

it("rod arrays fit their span on every rod-array build in the corpus and the rod sweep", () =>
  offline(() => {
    let arrays = 0;
    const bad = [...new Set([...corpus(), ...ROD_SWEEP])].flatMap((q) => {
      const p = generateFromPrompt(q);
      if (rodArrays([...p.panels, ...instanceRods(p.instances)]).length) arrays++;
      return rodArrayFailures(p).map((m) => `${q}: ${m}`);
    });
    assert.deepEqual(bad, []);
    assert.ok(arrays >= 20, `only ${arrays} rod-array builds swept`);
  }));

// Base (release/2026-10-21, before this class): total and what its bead dowel cost. The frame (everything but the
// rider stock) may never cost more than the base frame: a post is never upsized. The rider stock may differ only
// for a stated reason: it is the recipe's own 3/4" bead where that fits, or the floor bead (the thinnest whole dowel
// that takes a 3/8" running bore on the 1/4" rod, 1/2") where the base used a 3/16"-3/8" bead that could not.
const ABACUS: { q: string; w: number; asked: number; base: number; baseBead: number }[] = [
  { q: "abacus 3 wide", w: 3, asked: 9, base: 25.6, baseBead: 0.6 },
  { q: "abacus 4 wide", w: 4, asked: 9, base: 25.8, baseBead: 0.8 },
  { q: "abacus 6 wide", w: 6, asked: 9, base: 27.6, baseBead: 1.6 },
  { q: "abacus 8 wide", w: 8, asked: 9, base: 27.8, baseBead: 1.8 },
  // A typed 12 rods never drops (I36): 8" refuses, the 8 1/4" its refusal names builds all 12.
  { q: "abacus 8 1/4 wide 12 rods", w: 8.25, asked: 12, base: 28.8, baseBead: 1.6 },
  { q: "abacus 10 wide", w: 10, asked: 9, base: 30.96, baseBead: 4.96 },
  { q: "abacus 12 wide", w: 12, asked: 9, base: 27, baseBead: 5 },
  { q: "abacus", w: 16, asked: 9, base: 30, baseBead: 8 },
];

it("abacus at 3, 4, 6, 8, 8 1/4 with 12 rods, 10, 12 and default: riders on every rod, no overlap, stated width, the card says when the count drops, frame never dearer", () =>
  offline(() => {
    for (const { q, w, asked, base, baseBead } of ABACUS) {
      const p = generateFromPrompt(q);
      assert.deepEqual(hiddenOverlaps(p), [], q);
      assert.deepEqual(rodArrayFailures(p), [], q);
      const xs = p.panels.flatMap((x) => [x.position.x, x.position.x + x.size.width]);
      assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - w) < 0.01 && Math.abs(p.overall.width - w) < 0.01, `${q}: ${Math.max(...xs) - Math.min(...xs)} wide`);
      const [arr] = rodArrays(p.panels);
      assert.ok(arr && arr.L != null && arr.R != null, `${q}: the row is found between its posts`);
      const loads = arr.strung.map((x) => x.length);
      assert.ok(Math.min(...loads) > 0 && Math.min(...loads) === Math.max(...loads), `${q}: riders per rod ${loads}`);
      const beads = arr.strung.flat();
      assert.ok(Math.min(...beads.map((b) => b.position.x)) - arr.L! >= TOUCH - 1e-6 && arr.R! - Math.max(...beads.map((b) => b.position.x + b.size.width)) >= TOUCH - 1e-6, `${q}: beads clear the posts`);
      assert.ok(beads.every((b) => b.size.width >= 0.5 - 1e-6), `${q}: bead ${beads[0].size.width}`);
      const rods = arr.rods.length;
      if (rods < asked) assert.ok(new RegExp(`^Only ${rods} rods fit in `).test(p.cardNote ?? ""), `${q}: no card note for ${rods} of ${asked} rods`);
      else assert.equal(rods, asked, q);
      const plan = buildPlan(p);
      const beadLine = plan.bom.find((b) => b.catalogId === beads[0].materialId || b.name === getCatalogItem(beads[0].materialId)?.name);
      const beadCost = beadLine?.estimatedCost ?? 0;
      assert.ok(plan.totals.estCostUsd - beadCost <= base - baseBead + 0.005, `${q}: frame $${(plan.totals.estCostUsd - beadCost).toFixed(2)} > base frame $${(base - baseBead).toFixed(2)}`);
      assert.ok(["dowel-3-4-36", "dowel-1-2-36"].includes(beads[0].materialId), `${q}: bead stock ${beads[0].materialId}`);
    }
  }));

// A row its bounds can't hold never grows the build (I30): when the posts can't bound the row as set (they met
// over it, or reach past its middle), the row is still fitted between them: an untyped count drops rods and the
// card says so, or, when not even one fits, nothing is built and the refusal names the width that takes one (I36).
// Swept at every narrow width over the rod-array builds: racks, ladders, stands, frames.
const NARROW = ["abacus", "dowel drying rack", "dowel ladder", "1/4 inch dowel ladder", "dowel shoe rack", "towel rack", "blanket ladder", "spool rack", "dowel wine rack", "pvc drying rack"];
it("narrow rod arrays: never wider than typed, every row fits its bounds, fewer rods say so", () =>
  offline(() => {
    const bad: string[] = [];
    for (const n of NARROW) for (const w of [2, 2.5, 3, 3.5, 4, 5, 6]) {
      const q = `${n} ${w} wide`;
      const p = generateFromPrompt(q);
      const xs = p.panels.flatMap((x) => [x.position.x, x.position.x + x.size.width]);
      if (xs.length && Math.max(...xs) - Math.min(...xs) > p.overall.width + 1 / 32) bad.push(`${q}: ${(Math.max(...xs) - Math.min(...xs)).toFixed(2)} wide under ${p.overall.width}`);
      bad.push(...rodArrayFailures(p).map((m) => `${q}: ${m}`), ...hiddenOverlaps(p).slice(0, 1).map((m) => `${q}: overlap ${JSON.stringify(m).slice(0, 80)}`));
    }
    assert.deepEqual(bad, []);
    // Not even one rod fits: nothing is built, and the refusal names the width that takes one.
    const p = generateFromPrompt("abacus 2 wide");
    assert.equal(p.panels.length, 0);
    assert.equal(p.refused, `An abacus needs at least 2 1/16" wide for 1 rod (each needs 9/16" for 1/2" beads). A full 9-rod abacus needs 6 9/16". Nothing is built at 2".`);
    const one = generateFromPrompt("abacus 2 1/16 wide");
    assert.equal(one.panels.filter((x) => /^rod \d+$/.test(x.name)).length, 1);
    assert.equal(one.cardNote, `Only 1 rod fits in 2 1/16" wide (each needs 9/16" for 1/2" beads). A full 9-rod abacus needs 6 9/16".`);
  }));
