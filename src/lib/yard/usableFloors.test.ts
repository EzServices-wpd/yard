/**
 * Usable floors (Critic #103 r2 rows 141/142, P1). Every family refuses a too-small size on every axis, and the
 * minimum each refusal names builds: not refused, I1 and I26 no worse than the same ask at its default size, no part at
 * or under zero (I38), and every bay and drawer a hand's room. Plus the floor table's sources, the refusal noun (row
 * 148), the named-object article, the default shelf count that shrinks, and #90's count rule left as it was.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { checkBuild, i35 } from "./invariants";
import { buildPlan } from "./report";
import { headerTitle } from "./pdf";
import { USABLE_FLOORS, unusable, cleanness, HAND_ROLLED_IN } from "./usableFloors";
import { nonPositiveParts, withoutSizes } from "./tooSmall";
import { refusedOutline, outlineEdges } from "./refusedOutline";
import type { YardProject } from "./types";

/** Critic's tiny-size families (regrade-pr103/r2 probes/tiny.json). */
const FAMILIES = ["bookcase", "shelf", "cabinet", "dresser", "nightstand", "desk", "toy box", "box", "planter box", "shoe rack", "linen closet", "table", "end table", "coffee table", "bench", "stool", "workbench", "water wheel", "abacus", "kids tipi", "wine rack", "jewelry box", "birdhouse", "picture frame"];
const WORD = { width: "wide", depth: "deep", height: "tall" } as const;
const shop = (t: string) => t.trim().split(/\s+/).reduce((n, w) => n + (w.includes("/") ? Number(w.split("/")[0]) / Number(w.split("/")[1]) : Number(w)), 0);
const ids = (p: YardProject, prompt: string, id: string) => checkBuild(p, prompt, buildPlan(p)).filter((v) => v.id === id);

for (const noun of FAMILIES) {
  it(`${noun}: refused at 1/2" on every axis, and every named minimum builds clean`, () => {
    const ref = generateFromPrompt(noun);
    const base = { i1: ids(ref, noun, "I1").length, i26: ids(ref, noun, "I26").length };
    for (const [axis, word] of Object.entries(WORD) as [keyof typeof WORD, string][]) {
      const tiny = `${noun} 1/2 ${word}`;
      const p = generateFromPrompt(tiny);
      // abacus width is #90's counted row: refused there with the width its rods need, the same shape of note.
      assert.ok(p.refused, `${tiny} must refuse; built ${headerTitle(p)}`);
      assert.equal(p.panels.length, 0, tiny);
      const m = /needs (?:at least )?([\d /]+)" (wide|deep|tall)/.exec(p.refused!);
      assert.ok(m && m[2] === word, `${tiny}: names a ${word} minimum: ${p.refused}`);
      assert.deepEqual(i35(p, tiny), [], `${tiny}: I35 on the refusal`);
      const at = `${noun} ${m![1].trim()} ${word}`;
      const q = generateFromPrompt(at);
      assert.ok(!q.refused && q.panels.length > 0, `${at} (named by "${p.refused}") builds: ${q.refused}`);
      assert.deepEqual(ids(q, at, "I38").map((v) => v.msg), [], `${at}: I38`);
      assert.ok(ids(q, at, "I1").length <= base.i1, `${at}: I1 ${JSON.stringify(ids(q, at, "I1").map((v) => v.msg))}`);
      assert.ok(ids(q, at, "I26").length <= base.i26, `${at}: I26 ${JSON.stringify(ids(q, at, "I26").map((v) => v.msg))}`);
      assert.equal(unusable(q, () => cleanness(ref), (x) => !nonPositiveParts(x, true).length), null, `${at} is usable`);
      assert.ok(shop(m![1]) * 16 === Math.round(shop(m![1]) * 16), `${at}: a 1/16" size`);
    }
  });
}

it("the floor table: every family, every axis, a number and a source", () => {
  for (const f of Object.values(USABLE_FLOORS)) {
    for (const a of ["width", "depth", "height"] as const) {
      assert.ok(f[a].inches > 0 && f[a].why.length > 8 && f[a].source.length > 12, `${f.family} ${a}`);
      assert.ok(!/\d\.\d/.test(f[a].why), `${f.family} ${a}: fractions, never decimals, in what the person reads`);
    }
  }
});

it("Critic's examples name usable sizes, not geometric floors", () => {
  const want: [string, RegExp][] = [
    ["bookcase 2 1/2 wide", /^A bookcase needs at least 5 1\/4" wide: a 3 3\/4" opening a hand reaches into/],
    ["table 13/16 tall", /^A table needs at least 12" tall/],
    ["table 1/2 wide", /^A table needs at least 12" wide/],
    ["end table 1/2 deep", /^An end table needs at least 12" deep/],
    ["bench 3 1/16 wide", /^A bench needs at least 8 1\/4" wide/],
    ["stool 3 1/16 wide", /^A stool needs at least 8 1\/4" wide/],
    ["workbench 3 1/16 wide", /^A workbench needs at least 21 5\/8" wide/],
    ["bench 7 1/16 deep", /^A bench needs at least 8 7\/8" deep/],
    ["water wheel 1 1/2 tall", /^A water wheel needs at least \d/],
    ["abacus 5/8 tall", /^An abacus needs at least \d/],
    ["wine rack 13/16 deep", /^A wine rack needs at least 4 15\/16" deep for its parts to fit inside it/],
  ];
  for (const [prompt, re] of want) {
    const p = generateFromPrompt(prompt);
    assert.match(p.refused ?? "", re, prompt);
    assert.equal(p.panels.length, 0, prompt);
  }
});

it("row 142: the tiny water wheel and jewelry boxes refuse (their parts ran into each other)", () => {
  for (const prompt of ["water wheel 1/2 wide", "water wheel 1 wide", "jewelry box 1/2 wide", "jewelry box 1 wide", "jewelry box 2 wide", "jewelry box 1/2 deep", "jewelry box 1/2 tall"]) {
    const p = generateFromPrompt(prompt);
    assert.ok(p.refused, `${prompt}: ${headerTitle(p)}`);
    assert.match(p.refused!, /needs at least [\d /]+" (wide|deep|tall)/);
  }
});

it("row 148: the refusal names the object, with a/an by sound", () => {
  assert.match(generateFromPrompt("linen closet 2 wide").refused ?? "", /^A linen closet needs at least/);
  assert.equal(headerTitle(generateFromPrompt("linen closet 2 wide")), "Linen closet · nothing built");
  assert.match(generateFromPrompt("end table 1/2 tall").refused ?? "", /^An end table needs/);
  assert.match(generateFromPrompt("utility cabinet 2 wide").refused ?? "", /^A utility cabinet needs/);
  assert.match(generateFromPrompt("bookcase 12 tall 5 shelves").refused ?? "", /^A bookcase needs/);
});

it("a default shelf count shrinks to keep a hand's room per bay, and says so; a typed count is refused", () => {
  const p = generateFromPrompt("bookcase 12 tall");
  assert.ok(!p.refused);
  const shelves = p.panels.filter((q) => q.type === "shelf");
  assert.equal(shelves.length, 1);
  assert.match(p.cardNote ?? "", /^Only 1 shelf fits in 12" tall with a hand's room \(3 3\/4"\) over each; 5 shelves need 28 1\/2"\.$/);
  const typed = generateFromPrompt("bookcase 12 tall 5 shelves");
  assert.match(typed.refused ?? "", /needs at least 28 1\/2" tall for a hand's room \(3 3\/4"\) in every shelf bay\. Nothing is built at 12"\./);
  // An untyped height keeps the default count, and a normal one is untouched.
  assert.equal(generateFromPrompt("bookcase").panels.filter((q) => q.type === "shelf").length, 5);
  assert.equal(generateFromPrompt("shelf").panels.filter((q) => q.type === "shelf").length, 3);
  assert.ok(HAND_ROLLED_IN === 3.75);
});

it("#90's count rule is unchanged: a typed count that doesn't fit is refused with its width, a default one shrinks", () => {
  const p = generateFromPrompt("abacus 2 1/8 wide 9 rods");
  assert.ok(p.refused && /6 9\/16"/.test(p.refused), p.refused);
  const q = generateFromPrompt("abacus 2 1/8 wide");
  assert.ok(!q.refused && /^Only 1 rod fits in 2 1\/8" wide/.test(q.cardNote ?? ""), q.cardNote);
});

it("row 149: I35 catches a misread that lands under a minimum", () => {
  const p = generateFromPrompt("shelf 2 wide");
  assert.ok(p.refused);
  assert.deepEqual(i35(p, "shelf 2 wide"), []);
  const v = i35(p, "shelf 24 1/2 wide").map((x) => x.msg);
  assert.ok(v.includes(`typed 24 1/2" width, the refusal says nothing is built at 2"`), JSON.stringify(v));
  assert.ok(v.includes(`refused, but shows 2" width for the 24 1/2" typed`), JSON.stringify(v));
});

it("row 147: every refusal draws one outline of the typed size, a normal build none", () => {
  for (const prompt of ["bookcase 1/2 wide", "abacus 2 1/8 wide 9 rods", "end table 1/2 tall"]) {
    const p = generateFromPrompt(prompt);
    const box = refusedOutline(p);
    assert.ok(box, prompt);
    assert.deepEqual(box, { width: p.overall.width, height: p.overall.height, depth: p.overall.depth });
    assert.equal(outlineEdges(box!).length, 6, "two rings and four posts");
  }
  assert.equal(refusedOutline(generateFromPrompt("bookcase")), null);
});

it("the default-size reference strips every typed size", () => {
  assert.equal(withoutSizes("bookcase 1/2 wide"), "bookcase");
  assert.equal(withoutSizes("table 6 x 30 x 30 with a shelf"), "table with a shelf");
  assert.equal(withoutSizes("bench 7 1/16 deep 18 tall"), "bench");
});
