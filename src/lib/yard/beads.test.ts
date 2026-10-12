import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

// Beads thread onto their rod; repeated parts are one step and one saw line.
it("abacus: beads thread onto the rod, one step and one saw line per family", () => {
  const steps = buildPlan(generateFromPrompt("abacus")).instructions;
  const all = steps.map((s) => s.description).join(" ");
  assert.ok(!/through the (?:[A-Z] )?bead/i.test(all));
  assert.match(all, /Thread each (?:[A-Z] )?bead onto its (?:[A-Z] )?rod/);
  assert.equal(steps.filter((s) => (s.partsUsed ?? []).some((n) => /^bead/i.test(n))).length, 1);
  assert.equal(steps.filter((s) => (s.partsUsed ?? []).some((n) => /^rod/i.test(n))).length, 1);
  const saw = steps.find((s) => /^Cut /.test(s.title))!.description;
  assert.match(saw, /9 rods /);
  assert.match(saw, /45 beads /);
});
