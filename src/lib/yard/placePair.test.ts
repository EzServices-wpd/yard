import test from "node:test";
import assert from "node:assert/strict";
import { placeBinding } from "./sizePhrases";
import { looksLikeFitted } from "./fittedDetect";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

const NOUNS = ["desk", "nightstand", "dresser", "bookcase", "cabinet", "shelf unit", "console", "storage cabinet"];
const PLACES = ["spot", "space", "alcove", "nook", "gap"];
const PAIRS: [number, number][] = [[20, 16], [48, 24], [60, 22], [34, 13], [16, 20], [24, 48]];

test("a two-number place binds width and depth, never height", () => {
  for (const n of NOUNS) for (const pl of PLACES) for (const [a, b] of PAIRS) {
    const ax = placeBinding(`${n} for a ${a} by ${b} ${pl}`, looksLikeFitted).axes;
    assert.equal(ax.height, undefined, `${n} / ${pl} / ${a}x${b}: height ${ax.height}`);
    assert.deepEqual([ax.width, ax.depth], [a, b], `${n} / ${pl} / ${a}x${b}`);
  }
});

test("a pair place builds the height its labeled twin builds, and never calls a typed axis assumed", () => {
  for (const n of NOUNS) for (const [a, b] of PAIRS) {
    const p = generateFromPrompt(`${n} for a ${a} by ${b} space`);
    const twin = generateFromPrompt(`${n} ${a} wide ${b} deep`);
    assert.deepEqual(
      [p.overall.width, p.overall.height, p.overall.depth],
      [twin.overall.width, twin.overall.height, twin.overall.depth],
      `${n} ${a}x${b}: ${p.overall.width}x${p.overall.height}x${p.overall.depth} vs twin ${twin.overall.width}x${twin.overall.height}x${twin.overall.depth}`,
    );
    const notes = [...(p.notes ?? []), ...buildPlan(p).feasibility.issues.map((i) => i.message)].join(" ");
    for (const [axis, v] of [["wide", a], ["deep", b]] as const) {
      assert.doesNotMatch(notes, new RegExp(`Assumed ${v}" ${axis}`), `${n} ${a}x${b}: typed ${v} ${axis} called assumed`);
    }
    if (p.overall.height !== a && p.overall.height !== b) {
      assert.match(notes, /Assumed [^.]{0,80}\btall\b/, `${n} ${a}x${b}: untyped height not marked assumed`);
    }
  }
});

test("a triple place stays width × height × depth", () => {
  const ax = placeBinding("bookcase that fits in a 24x30x10 niche", looksLikeFitted).axes;
  assert.deepEqual([ax.width, ax.height, ax.depth], [24, 30, 10]);
});
