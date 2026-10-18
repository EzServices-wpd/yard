import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { thicknessFailures, stockThickness, partThickness } from "./stockThickness.ts";
import { hiddenOverlaps, rotorPlayFailures } from "./solids.ts";
import { rodArrayFailures, rodArrays, instanceRods, TOUCH } from "./rodArrays.ts";
import { corpus } from "../../../scripts/invariants-corpus.ts";
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

// Rod arrays fit their span (I30): any row of like round rods, and what rides on them, lies inside the parts that
// bound the row and clears its neighbours. Rod-array prompts beyond the corpus: racks, ladders, stands, frames.
const ROD_SWEEP = ["abacus 6 wide", "abacus 8 wide", "abacus 10 wide", "abacus 12 wide", "abacus", "abacus 24 wide", "cardboard abacus",
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

// Prices before the stock-thickness class (#85 head a46a10c). The one allowed rise: a build whose beads fit their span
// keeps the recipe's own bead dowel (I28) where the old build shrank it with the width; it then costs no more than
// the default abacus, which uses that same bead.
const ABACUS: [string, number, number][] = [["abacus 6 wide", 6, 27.6], ["abacus 8 wide", 8, 27.8], ["abacus 10 wide", 10, 30.96], ["abacus 12 wide", 12, 27], ["abacus", 16, 30]];

it("abacus at 6, 8, 10, 12 and default: no overlap, beads clear the posts and each other, stated width, price held", () =>
  offline(() => {
    for (const [q, w, was] of ABACUS) {
      const p = generateFromPrompt(q);
      assert.deepEqual(hiddenOverlaps(p), [], q);
      assert.deepEqual(rodArrayFailures(p), [], q);
      const xs = p.panels.flatMap((x) => [x.position.x, x.position.x + x.size.width]);
      assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - w) < 0.01 && Math.abs(p.overall.width - w) < 0.01, `${q}: ${Math.max(...xs) - Math.min(...xs)} wide`);
      const [arr] = rodArrays(p.panels);
      assert.ok(arr && arr.L != null && arr.R != null && arr.strung.every((s) => s.length), `${q}: beads strung between the posts`);
      const beads = arr.strung.flat(), posts = { L: arr.L!, R: arr.R! };
      assert.ok(Math.min(...beads.map((b) => b.position.x)) - posts.L >= TOUCH - 1e-6, `${q}: beads clear the left post`);
      assert.ok(posts.R - Math.max(...beads.map((b) => b.position.x + b.size.width)) >= TOUCH - 1e-6, `${q}: beads clear the right post`);
      // Every bead is a whole dowel with a running bore and a wall: 1/4" rod, 3/8" bore, at least 1/2" across.
      assert.ok(beads.every((b) => b.size.width >= 0.5 - 1e-6), `${q}: bead ${beads[0].size.width}`);
      const price = buildPlan(p).totals.estCostUsd;
      const own = generateFromPrompt("abacus"), ownBead = rodArrays(own.panels)[0].strung[0][0];
      const keepsOwnBead = beads.every((b) => b.materialId === ownBead.materialId && Math.abs(b.size.width - ownBead.size.width) < 1e-6);
      const cap = keepsOwnBead ? Math.max(was, buildPlan(own).totals.estCostUsd) : was;
      assert.ok(price <= cap + 0.005, `${q}: $${price} > $${cap}`);
    }
  }));
