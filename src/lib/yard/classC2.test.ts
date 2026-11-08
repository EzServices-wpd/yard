/** Spec 006 C2 · size phrases: I21 over the whole class (every phrase × the forms it sizes) plus the parser itself. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { checkBuild } from "./invariants";
import { sizePhrases } from "./sizePhrases";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";

const HEIGHT = ["about knee high", "waist high", "chest high", "counter height", "bar height"];
const HFORMS = ["bench", "table", "cabinet", "workbench", "console", "stool"];
const WIDTH = ["as wide as a twin bed", "as wide as a full bed", "as wide as a queen bed", "as wide as a king bed"];
const WFORMS = ["bench", "headboard", "shelf", "console"];
const corpus = [
  ...SWEEPS.c2.prompts,
  ...HEIGHT.flatMap((h) => HFORMS.map((f) => `${h} ${f}`)),
  ...WIDTH.flatMap((w) => WFORMS.map((f) => `${w} ${f}`)),
  ...[3, 4, 5, 6, 7].flatMap((n) => ["shelf", "bookshelf", "bookcase", "cabinet"].map((f) => `${n} foot ${f}`)),
  ...[43, 50, 55, 65, 75].map((n) => `stand for a ${n} inch TV`),
];

test("C2/I21: every phrase-derived axis holds within 1/2\" across the class", () => {
  const bad: string[] = [];
  for (const q of corpus) {
    assert.ok(Object.keys(sizePhrases(q).axes).length > 0, `no axis parsed: ${q}`);
    const v = checkBuild(generateFromPrompt(q), q).filter((x) => x.id === "I21");
    if (v.length) bad.push(`${q}: ${v.map((x) => x.msg).join("; ")}`);
  }
  assert.deepEqual(bad, []);
});

test("C2: phrases are stripped before the noun match, typed axes win, plain prompts are untouched", () => {
  assert.equal(sizePhrases("about knee high bench").prompt, "bench 18 tall");
  assert.equal(sizePhrases("stand for a 65 inch TV").prompt, "TV stand 61 wide");
  assert.deepEqual(sizePhrases("knee high bench 20 tall").axes, {});
  for (const q of ["bench 48 wide", "2x4x8 bench", "linen closet 31.5 wide 78 tall 16 deep", "6 foot garden arch from 3/4 inch PVC pipe", "3 foot Eiffel Tower from popsicle sticks"])
    assert.equal(sizePhrases(q).prompt, q);
});
