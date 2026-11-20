/**
 * A placement fact is said once for the subject it locates.
 * A later copy is dropped only when that same subject already said it.
 * A different subject keeps its own copy. The words of a fact are never rewritten.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { keepSubjectFacts } from "./placement.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { POCKET_DREAM } from "./pocket.ts";

const step = (prompt: string, title: RegExp) =>
  buildPlan(generateFromPrompt(prompt)).instructions.find((s) => title.test(s.title))?.description ?? "";

test("a later copy is dropped only for the subject that already said it", () => {
  const line = `Outside face set in 1 1/2" from the outside of each H upright.`;
  const flush = `Front edge flush with the front of both C uprights and both F dividers.`;
  const first = keepSubjectFacts(new Set(), [line, `That is 41 1/2" apart, measured top to top.`]);
  const later = keepSubjectFacts(first.said, [line, flush]);
  assert.deepEqual(later.kept, [flush]);
  const otherSubject = keepSubjectFacts(new Set(), [line]);
  assert.deepEqual(otherSubject.kept, [line]);
  assert.equal(later.kept[0], flush);
});

test("the bunk, the sewing table, and the casters each keep a second subject's line", () => {
  const rails = step("twin bunk bed", /side and end rails/);
  assert.equal((rails.match(/That is 41 1\/2" apart, measured top to top\./g) ?? []).length, 4);
  assert.equal((rails.match(/Outside face set in 1 1\/2" from the outside of each H upright\./g) ?? []).length, 2);
  assert.equal((rails.match(/Outside face set in 2" from the outside of both H uprights\./g) ?? []).length, 2);
  const ledgers = step("twin bunk bed", /sleep platforms/);
  assert.match(ledgers, /E right ledgers sit/);
  assert.match(ledgers, /Outside face set in 3" from the outside of each H upright\./);
  const aprons = step("sewing table 5 foot", /aprons to the legs/);
  assert.equal((aprons.match(/Outside face set in 3\/4" from the outside of each C leg\./g) ?? []).length, 2);
  const casters = step("narrow media console with flip down doors on casters 72 wide", /casters/);
  assert.equal((casters.match(/Front face stands 3\/4" proud of the front of G\./g) ?? []).length, 2);
});

test("the desk keeps both F dividers, and the vanity top keeps what it rests on", () => {
  const desk = step("desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space", /Stand the main box/);
  assert.match(desk, /flush with the bottom ends of both C uprights and both F dividers\./);
  assert.match(desk, /Front edge flush with the front of both C uprights and both F dividers\./);
  const vanity = step(POCKET_DREAM, /Attach G Top/);
  assert.match(vanity, /Its underside rests on the top of D, 101 1\/4" up from the floor\./);
});
