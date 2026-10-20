/**
 * Too small to build (Critic #103 F2, I38). 'bookcase 1/2 wide' built its Back, Top and Shelves at -1" wide. A size
 * that can't hold its parts is refused in #90's shared pattern ('<Thing> · nothing built', a note naming the
 * smallest size that builds, no parts, no cost); the named minimum itself builds with every part real; and I38
 * catches any part at or under zero.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { headerTitle } from "./pdf";
import { buildPlan } from "./report";
import { i38 } from "./invariants";
import { stockPillLabel, NOTHING_BUILT_STOCK } from "./stockPill";
import type { YardProject } from "./types";

const realParts = (p: YardProject) => {
  const plan = buildPlan(p);
  const bad = [
    ...p.panels.filter((q) => !(q.size.width > 0 && q.size.height > 0 && q.size.depth > 0)).map((q) => `${q.name} ${JSON.stringify(q.size)}`),
    ...plan.cutList.filter((c) => !(c.lengthIn > 0 && c.widthIn > 0 && c.thicknessIn > 0)).map((c) => `cut ${c.name}`),
  ];
  return bad;
};
const cost = (p: YardProject) => buildPlan(p).bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);

/** Prompt, exact header, the minimum the note must name. */
const REFUSED: [string, string, string][] = [
  ["bookcase 1/2 wide", "Bookcase · nothing built", `at least 2 1/2" wide`],
  ["bookcase 1 wide", "Bookcase · nothing built", `at least 2 1/2" wide`],
  ["cabinet 1/2 wide", "Cabinet · nothing built", `" wide`],
  ["shelf 1/4 wide", "Shelf unit · nothing built", `" wide`],
  ["bookcase 1 deep", "Bookcase · nothing built", `at least 2 1/2" deep`],
  ["bookcase 2 tall", "Bookcase · nothing built", `at least 2 1/2" tall`],
];

for (const [prompt, header, min] of REFUSED) {
  it(`'${prompt}' is refused, named, empty and free`, () => {
    const p = generateFromPrompt(prompt);
    assert.equal(headerTitle(p), header);
    assert.ok(p.refused && p.cardNote, "a refusal note");
    assert.match(p.cardNote!, /needs at least \d[\d /]*" (wide|deep|tall)/);
    assert.ok(p.cardNote!.includes(min), `${p.cardNote} names ${min}`);
    assert.match(p.cardNote!, /Nothing is built at/);
    assert.equal(p.panels.length, 0);
    assert.equal((p.instances ?? []).length, 0);
    assert.equal(cost(p), 0);
    assert.equal(stockPillLabel(p, buildPlan(p)).label, NOTHING_BUILT_STOCK);
  });
}

it("the named minimum builds, every part real, on every carcass axis", () => {
  for (const [ask, at] of [["wide", "bookcase 2 1/2 wide"], ["deep", "bookcase 2 1/2 deep"], ["tall", "bookcase 2 1/2 tall"]]) {
    const p = generateFromPrompt(at);
    assert.ok(!p.refused, `${at} (${ask}) builds: ${p.cardNote}`);
    assert.deepEqual(realParts(p), [], at);
  }
});

it("other builders: refused below, real at the named minimum", () => {
  // 'water wheel 1/2 wide' left this list at the merge with #90: stock thickness no longer scales, so its parts stay
  // real (I38 holds, checked below) but they overlap in a 1/2" model (I26). That is a fit class, not I38; logged for Critic.
  for (const prompt of ["table 1/2 tall", "stool 1 wide", "bench 1/2 deep", "abacus 1/2 tall", "kids tipi 1/2 wide"]) {
    const p = generateFromPrompt(prompt);
    assert.ok(p.refused, `${prompt} refused`);
    assert.equal(p.panels.length, 0, prompt);
    const m = /needs at least ([\d /]+)" (wide|deep|tall)/.exec(p.cardNote ?? "");
    assert.ok(m, `${prompt}: ${p.cardNote}`);
    const n = m![1].trim().split(" ").reduce((s, t) => { const [a, b] = t.split("/").map(Number); return s + (b ? a / b : a); }, 0);
    const at = prompt.replace(/[\d/]+(?= (wide|deep|tall))/, String(n));
    const q = generateFromPrompt(at);
    assert.ok(!q.refused, `${at} builds: ${q.cardNote}`);
    assert.deepEqual(realParts(q), [], at);
  }
});

it("water wheel 1/2 wide: every part stays real after #90 (I38)", () => {
  const p = generateFromPrompt("water wheel 1/2 wide");
  assert.deepEqual(realParts(p), []);
  assert.deepEqual(i38(p, buildPlan(p)), []);
});

it("normal sizes still build (no false refusal)", () => {
  for (const prompt of ["bookcase 30 wide", "cabinet 24 wide", "shelf 36 wide", "picture frame", "stool"]) {
    const p = generateFromPrompt(prompt);
    assert.ok(!p.refused && p.panels.length + (p.instances ?? []).length > 0, prompt);
    assert.deepEqual(realParts(p), [], prompt);
  }
});

it("I38 catches a part at zero or below, and a picture-frame backer keeps its 0.06\" chipboard", () => {
  const p = generateFromPrompt("bookcase 30 wide");
  assert.deepEqual(i38(p, buildPlan(p)), []);
  const bad = { ...p, panels: p.panels.map((q, k) => (k === 0 ? { ...q, size: { ...q.size, width: -1 } } : q)) };
  const v = i38(bad, buildPlan(bad));
  assert.ok(v.length && v.every((x) => x.id === "I38"), JSON.stringify(v));
  const f = generateFromPrompt("picture frame");
  const backer = f.panels.find((q) => q.name === "Backer");
  assert.ok(backer && backer.size.depth > 0, JSON.stringify(backer?.size));
  assert.deepEqual(i38(f, buildPlan(f)), []);
});
