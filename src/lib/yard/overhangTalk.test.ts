/** I37 zero class: a part set back from (or flush with) what holds it never "overhangs 0\"" in a step. */
import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;

it("no step says 'overhang 0\"' or '0\" past' (outdoor bench seat boards, picnic tables, bird feeders)", () => {
  const bad: string[] = [];
  for (const q of ["outdoor bench 44 1/2 long 16 deep 18 tall", "outdoor bench", "picnic table", "garden bench", "bird feeder", "outdoor storage bench"]) {
    for (const s of buildPlan(generateFromPrompt(q)).instructions) if (/(?<![\d/.])0(?:"|″) past|overhang(?:ing)? 0(?:"|″)/.test(s.description)) bad.push(`${q} step ${s.step}`);
  }
  assert.deepEqual(bad, []);
});

it("a real overhang is still said (picnic table seats, coffee table top)", () => {
  const said = (q: string) => buildPlan(generateFromPrompt(q)).instructions.map((s) => s.description).join(" ");
  assert.match(said("picnic table"), /overhang 11" front and back/);
  assert.match(said("coffee table"), /overhanging 2 1\/2" on all four sides/);
});
