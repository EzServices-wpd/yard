import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

const step = (prompt: string, title: RegExp) => buildPlan(generateFromPrompt(prompt)).instructions.find((s) => title.test(s.title))?.description ?? "";

test("each subject keeps its own setback and spacing lines", () => {
  const rails = step("twin bunk bed", /side and end rails/);
  assert.match(rails, /F right side rails sit[^.]*\.[^]*?That is 41 1\/2" apart[^]*?Outside face set in 1 1\/2" from the outside of each H upright\.[^]*?N head rails/);
  const ledgers = step("twin bunk bed", /sleep platforms/);
  assert.match(ledgers, /E right ledgers sit[^]*?Outside face set in 3" from the outside of each H upright\./);
  const aprons = step("sewing table 5 foot", /aprons to the legs/);
  assert.equal((aprons.match(/Outside face set in 3\/4" from the outside of each C leg\./g) ?? []).length, 2);
});

test("a line is still said once within one subject", () => {
  for (const p of ["twin bunk bed", "sewing table 5 foot", "wine rack 12 bottles", "media console for a 75 inch TV"]) {
    for (const s of buildPlan(generateFromPrompt(p)).instructions) {
      const where = (s.description.split("Where: ")[1] ?? "").split(/\s(?=Drive \d)/)[0];
      const blocks = where.split(/(?<=[.!?])\s+(?=[^.]*\b(?:sit|sits|stand|stands)\b)/);
      for (const b of blocks) {
        const lines = b.split(/(?<=[.!?])\s+/);
        assert.equal(new Set(lines).size, lines.length, `${p}: ${s.title} repeats inside one subject`);
      }
    }
  }
});
