import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { hiddenOverlaps, rotorPlayFailures } from "./solids.ts";
import { checkBuild } from "./invariants.ts";
import { offline } from "../../../scripts/eval-lib.ts";

// Class: rotors and wheels sit on real joints and are held on the axle.
// I26: no two solid parts share space unless a joint step cuts for it. I27: every turning part has a held place
// along its pin (collars or carriers within 1/4"). Ferris wheel and toy airplane are known (invariants-baseline.json).
const CLASS = ["water wheel", "compost tumbler frame"];
const SWEEP = [
  "water wheel", "waterwheel", "garden water wheel", "small water wheel", "water wheel 24 wide", "water wheel 30 wide",
  "water wheel 36 tall", "water wheel 48 tall", "water wheel 20 tall", "water wheel 24 deep", "water wheel 36 deep",
  "water wheel 24 wide 36 tall", "water wheel 30 wide 40 tall 30 deep", "decorative water wheel", "water wheel for a pond",
  "waterwheel 40 tall", "water wheel 14 wide", "water wheel 60 tall", "compost tumbler frame", "compost tumbler frame 60 wide",
];

for (const q of CLASS)
  it(`rotor class: ${q} has no hidden overlap and every turning part is held on its axle`, () =>
    offline(() => {
      const p = generateFromPrompt(q);
      assert.deepEqual(hiddenOverlaps(p), []);
      assert.deepEqual(rotorPlayFailures(p), []);
      assert.ok(!checkBuild(p, q).some((v) => v.id === "I26" || v.id === "I27"));
    }));

it("rotor class sweep: 20 prompts, no I26 or I27", () =>
  offline(() => {
    const bad = SWEEP.flatMap((q) => {
      const p = generateFromPrompt(q);
      return [...hiddenOverlaps(p), ...rotorPlayFailures(p)].map((m) => `${q}: ${m}`);
    });
    assert.deepEqual(bad, []);
  }));
