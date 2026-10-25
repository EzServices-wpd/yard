/**
 * I49 AI prompt reader rules (no wiring yet): the validator, the rewrite into fraction inches, and the seven canaries
 * byte-identical through the rewrite whether the reading is right or wrong. No network: fetch throws, no model.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { POCKET_DREAM } from "./pocket";
import { inchCandidates, quoteUnit, typedCount, validateSpec } from "./aiReader/validate";
import { chooseBuildPrompt, honoredBy, specToPrompt } from "./aiReader/rewrite";
import type { ReaderSpec } from "./aiReader/spec";

globalThis.fetch = (async () => { throw new Error("network is off in this test"); }) as typeof fetch;
const S = (axis: string, inches: number, quote: string, of = "overall", unit = "none", confidence = 1) => ({ axis, value: inches, unit, inches, of, quote, confidence, assumed: false });
const spec = (sizes: unknown[] = [], counts: unknown[] = []) => ({ sizes, counts }) as ReaderSpec;
const noIds = (k: string, v: unknown) => (k === "id" || k === "partIds" ? undefined : v);
/** Everything a person sees: header, size, pieces, total, cut list, Buy and steps. */
const plan = (q: string) => { const p = generateFromPrompt(q); const pl = buildPlan(p); return JSON.stringify({ name: p.name, overall: p.overall, refused: p.refused ?? null, pieces: pl.totals.pieces, usd: pl.totals.estCostUsd, cut: pl.cutList, bom: pl.bom, steps: pl.instructions.map((s) => s.title + s.description) }, noIds); };
const Q = "linen closet 30x18x72";

test("I49 validator: unquoted, invented, assumed and age entries are dropped; fractions, feet and metric are kept", () => {
  const q = "bookcase 90cm wide 6 ft tall 11 1/2 deep for a 5 year old";
  const { spec: s, dropped } = validateSpec(q, { sizes: [S("W", 35.43307, "90cm wide", "overall", "cm"), S("H", 72, "6 ft tall", "overall", "ft"), S("D", 11.5, "11 1/2 deep"), S("W", 30, "30 wide"), S("H", 5, "5 year old"), { ...S("D", 12, "deep"), assumed: true }, S("D", 14, "11 1/2 deep"), S("H", 11.5, "11 1/2 deep")], counts: [{ thing: "shelves", n: 4, quote: "bookcase", confidence: 1, assumed: false }] });
  assert.deepEqual(s.sizes.map((x) => [x.axis, +x.inches.toFixed(3)]), [["W", 35.433], ["H", 72], ["D", 11.5]]);
  assert.deepEqual([s.counts.length, dropped.length], [0, 6]);
});

test("I49 rewrite: only misreadable measurements change, in fractions; a size the reader read is built or the typed words build", () => {
  assert.equal(specToPrompt(Q, spec([S("W", 30, "30x18x72"), S("D", 18, "30x18x72"), S("H", 72, "30x18x72")])).prompt, Q, "a bare triple is never rewritten (row 457)");
  assert.equal(specToPrompt("bookcase 90cm wide", spec([S("W", 90 / 2.54, "90cm wide", "overall", "cm")])).prompt, "bookcase 35 7/16 wide");
  const plain = "bookcase 30 wide 12 deep 72 tall";
  assert.equal(specToPrompt(plain, spec([S("W", 30, "30 wide"), S("D", 12, "12 deep"), S("H", 72, "72 tall")])).prompt, plain);
  for (const [q, s] of [["shelf 6 foot", spec([S("W", 72, "6 foot", "overall", "ft", 0.5)])], ["desk with 24 inch knee space", spec([S("W", 24, "24 inch knee space", "part", "in")])], ["desk 60 inches wide 24 inch knee", spec([S("W", 60, "60 inches wide", "overall", "in"), S("W", 24, "24 inch knee", "overall", "in")])]] as const) assert.equal(specToPrompt(q, s).edits.length, 0, q);
  assert.equal(specToPrompt("two-step kitchen stool", spec([], [{ thing: "steps", n: 2, quote: "two-step", confidence: 1, assumed: false }])).prompt, "2 steps kitchen stool");
  const c = chooseBuildPrompt("bookcase 90cm wide", spec([S("W", 90 / 2.54, "90cm wide", "overall", "cm")]));
  assert.equal(generateFromPrompt(c.buildPrompt).overall.width, 35.4375, c.reason);
  const fake = (q: string) => ({ ...generateFromPrompt("bookcase"), kind: q.includes("wide") ? "table" : "closet" }) as ReturnType<typeof generateFromPrompt>;
  assert.match(chooseBuildPrompt("bookcase 90cm", spec([S("W", 90 / 2.54, "90cm", "overall", "cm")]), fake).reason, /changes the object/);
  const narrow = () => ({ ...generateFromPrompt("bookcase"), overall: { width: 20, height: 72, depth: 12 } }) as ReturnType<typeof generateFromPrompt>;
  assert.match(chooseBuildPrompt("bookcase 90cm", spec([S("W", 90 / 2.54, "90cm", "overall", "cm")]), narrow).reason, /every size/);
});

const C = (thing: string, n: number, quote: string) => ({ thing, n, quote, confidence: 1, assumed: false });
/** Critic's mocked replies (#157 rows 451–453, 458): the reader never overrides, erases, lowers or moves what was typed. */
test("I49 r2: a typed number is never overridden, erased, lowered or moved (rows 451, 452, 453, 458)", () => {
  const typed: [string, unknown][] = [
    [Q, { sizes: [S("W", 30 / 2.54, "30x18x72", "overall", "cm"), S("D", 18 / 2.54, "30x18x72", "overall", "cm"), S("H", 72 / 2.54, "30x18x72", "overall", "cm")], counts: [] }],
    [Q, { sizes: [S("W", 30 / 2.54, "30x18x72"), S("D", 18 / 2.54, "30x18x72"), S("H", 72 / 2.54, "30x18x72")], counts: [] }],
    ["linen closet 31.5 wide 78 tall 16 deep with two shelves", { sizes: [S("W", 31.5 / 2.54, "31.5 wide", "overall", "cm")], counts: [] }],
    ["linen closet 31.5 wide 78 tall 16 deep with two shelves", { sizes: [S("W", 31.5 / 2.54, "31.5 wide")], counts: [] }],
    ["bookcase 30x12x72", { sizes: [S("W", 30, "30x12x72"), S("D", 144, "30x12x72"), S("H", 72, "30x12x72")], counts: [] }],
    ["bookcase 30 wide 12 deep 72 tall shelf 6", { sizes: [S("W", 72, "6", "overall", "ft")], counts: [] }],
    [Q, { sizes: [S("W", 30, "30x18x72"), S("H", 72, "30x18x72")], counts: [] }],
    [Q, { sizes: [S("W", 30, "closet 30x18x72"), S("D", 18, "closet 30x18x72"), S("H", 72, "closet 30x18x72")], counts: [] }],
    ["nightstand with two drawers and 1 shelf", { sizes: [], counts: [C("drawers", 1, "two drawers and 1")] }],
    ["two-drawer nightstand with a shelf", { sizes: [], counts: [C("drawers", 1, "two-drawer nightstand with a")] }],
    ["3-drawer dresser 30 wide 18 deep 40 tall", { sizes: [], counts: [C("drawers", 30, "3-drawer dresser 30")] }],
    ["two-step kitchen stool", { sizes: [], counts: [C("drawers", 2, "two-step")] }],
    ["bookcase 30x12x72 with two shelves", { sizes: [], counts: [C("shelves", 1, "two shelves")] }],
    ["nightstand with 1 shelf and two drawers", { sizes: [], counts: [C("drawers", 2, "1 shelf and two drawers")] }],
    ["shoe rack by the door 36 inches", { sizes: [S("W", 36, "36 inches", "overall", "in")], counts: [] }],
    ["desk 61cm knee space", { sizes: [S("W", 61 / 2.54, "61cm", "part", "cm")], counts: [] }],
  ];
  for (const [q, raw] of typed) {
    const c = chooseBuildPrompt(q, validateSpec(q, raw).spec);
    assert.equal(c.buildPrompt, q, `${q}: ${c.reason} ${JSON.stringify(c.edits)}`);
  }
  assert.equal(validateSpec("bookcase 90cm wide", { sizes: [S("W", 90, "90cm wide", "overall", "none")] }).spec.sizes.length, 0, "the unit must be the one typed");
  for (const [q, s] of [["shoe rack 36 inches", S("W", 36, "36 inches", "overall", "in")], ["shelf 40", S("W", 40, "40")], ["bench 48 by 16", S("W", 48, "48 by 16")], ["shelf 2 ft by 3 ft", S("W", 24, "2 ft by 3 ft", "overall", "ft")]] as const) assert.equal(specToPrompt(q, spec([s])).edits.length, 0, `a bare or inch number, a pair or a triple is never rewritten: ${q}`);
  assert.equal(validateSpec(Q, { sizes: [S("W", 30 / 2.54, "30x18x72"), S("D", 18 * 12, "30x18x72")] }).spec.sizes.length, 0, "a bare number converts by no unit");
  assert.equal(validateSpec(Q, { sizes: [S("W", 30, "closet 30x18x72")] }).spec.sizes.length, 0, "a size quote holds no object noun");
  assert.equal(validateSpec("shelf 6 ft wide", { sizes: [S("W", 72, "6 ft wide", "overall", "ft")] }).spec.sizes.length, 1);
  assert.equal(validateSpec("shelf 6 ft wide", { sizes: [S("W", 72, "6 ft wide", "overall", "cm")] }).spec.sizes.length, 0, "the unit label must match the typed unit");
  assert.deepEqual([typedCount("two drawers", "drawers"), typedCount("3-drawer", "drawers"), typedCount("pair of doors", "doors"), typedCount("two-step", "drawers"), typedCount("a shelf", "shelves"), typedCount("two drawers and 1", "drawers"), typedCount("1 shelf and two drawers", "drawers")], [2, 3, 2, null, null, null, null]);
  assert.equal(chooseBuildPrompt("bookcase 6 ft tall", validateSpec("bookcase 6 ft tall", { sizes: [S("H", 72, "6 ft tall", "overall", "ft")] }).spec).buildPrompt, "bookcase 6 ft tall", "a size the parser already built keeps its words");
});

test("I49 r2: bad axis, unit or of values are dropped; a rewrite that turns a build into a refusal falls back", () => {
  for (const bad of [{ ...S("W", 90 / 2.54, "90cm", "overall", "cm"), axis: "Q" }, { ...S("W", 90 / 2.54, "90cm", "overall", "cm"), of: "sideways" }, { ...S("W", 90 / 2.54, "90cm", "overall", "cm"), unit: "furlong" }]) assert.equal(validateSpec("bookcase 90cm", { sizes: [bad] }).spec.sizes.length, 0, JSON.stringify(bad));
  const base = generateFromPrompt("bookcase");
  const refuses = (q: string) => (q === "bookcase 90cm" ? base : { ...base, refused: "too narrow" }) as ReturnType<typeof generateFromPrompt>;
  const c = chooseBuildPrompt("bookcase 90cm", spec([S("W", 90 / 2.54, "90cm", "overall", "cm")]), refuses);
  assert.deepEqual([c.used, c.buildPrompt], [false, "bookcase 90cm"], c.reason);
});

const CANARIES: [string, ReaderSpec, ReaderSpec][] = [
  ["linen closet 31.5 wide 78 tall 16 deep", spec([S("W", 31.5, "31.5 wide"), S("H", 78, "78 tall"), S("D", 16, "16 deep")]), spec([S("W", 31.5, "31.5 wide", "overall", "none", 0.99), S("H", 31.5, "31.5 wide")])],
  [POCKET_DREAM, spec(), spec()],
  ["Andersen 100 Series 36 by 48 double hung window, frame the rough opening", spec([S("W", 36, "36 by 48", "product"), S("H", 48, "36 by 48", "product")]), spec([S("W", 36, "36 by 48"), S("H", 48, "36 by 48")])],
  ["desk 60 inches wide by 30 deep by 29 high with drawers and 24 inch knee space", spec([S("W", 60, "60 inches wide", "overall", "in"), S("D", 30, "30 deep"), S("H", 29, "29 high"), S("W", 24, "24 inch knee space", "part", "in")]), spec([S("W", 60, "60 inches wide", "overall", "in"), S("W", 24, "24 inch knee space", "overall", "in")])],
  ["3 foot Eiffel Tower from popsicle sticks", spec([{ ...S("H", 36, "3 foot", "overall", "ft"), value: 3 }]), spec([S("H", 36, "3 foot", "overall", "in")])],
  ["cat tree", spec(), spec()],
  ["step stool", spec(), spec()],
];
for (const [q, right, wrong] of CANARIES) {
  test(`I49 canary byte-identical through the reader, read right or wrong: ${q.slice(0, 40)}`, () => {
    const want = plan(q);
    for (const s of [right, wrong]) {
      const c = chooseBuildPrompt(q, validateSpec(q, s).spec);
      assert.equal(plan(c.buildPrompt), want, `${c.reason} ${JSON.stringify(c.edits)}`);
    }
  });
}

/** Critic's r2 probes (#157 rows 465–468) plus the two holes found verifying fix-r3. */
test("I49 r3: multi-number metric, comma triples, axis-less sub-quotes and substring counts never move a typed number (rows 465–468)", () => {
  const typed: [string, unknown][] = [
    ["bookcase 1 m 20 cm wide with two shelves", { sizes: [S("W", 20 / 2.54, "1 m 20 cm wide", "overall", "cm")] }],
    ["bookcase 1 m 20 cm wide with two shelves", { sizes: [S("W", 20 / 2.54, "1 m 20 cm", "overall", "cm")] }],
    ["nightstand 90cm wide 40cm deep", { sizes: [S("W", 40 / 2.54, "90cm wide 40cm deep", "overall", "cm")] }],
    ["nightstand 90cm wide 40cm deep", { sizes: [S("W", 40 / 2.54, "90cm wide 40cm", "overall", "cm")] }],
    ["linen closet 80,45,180 cm", { sizes: [S("W", 80 / 2.54, "80,45,180 cm", "overall", "cm")] }],
    ["bookcase 6 ft tall 30 wide with two shelves", { sizes: [S("W", 72, "6 ft", "overall", "ft")] }],
    ["bookcase 6 ft tall 30 wide with two shelves", { sizes: [S("H", 72, "6 ft tall 30 wide", "overall", "ft")] }],
    ["linen closet 2 ft deep 30 wide 72 tall", { sizes: [S("H", 24, "2 ft", "overall", "ft")] }],
    ["bench 4 ft long", { sizes: [S("D", 48, "4 ft", "overall", "ft")] }],
    ["bookcase 4 ft 30 wide", { sizes: [S("W", 78, "4 ft 30", "overall", "ft")] }],
    ["bookcase 4 ft 30 wide", { sizes: [S("W", 78, "4 ft 30 wide", "overall", "ft")] }],
    ["bookcase with twenty-one shelves", { counts: [{ thing: "shelves", n: 1, quote: "one shelves", confidence: 1, assumed: false }] }],
    ["dresser with thirty-two drawers", { counts: [{ thing: "drawers", n: 2, quote: "two drawers", confidence: 1, assumed: false }] }],
    ["bookcase 12 ft wide", { sizes: [S("W", 24, "2 ft", "overall", "ft")] }],
  ];
  for (const [q, raw] of typed) {
    const c = chooseBuildPrompt(q, validateSpec(q, { sizes: [], counts: [], ...(raw as object) }).spec);
    assert.equal(c.buildPrompt, q, `${q}: ${c.reason} ${JSON.stringify(c.edits)}`);
  }
  assert.equal(specToPrompt("bookcase 1.8 m tall", spec([S("H", 180 / 2.54, "1.8 m", "overall", "m")])).prompt, "bookcase 70 7/8 tall", "the typed axis word stays, written once");
  assert.equal(specToPrompt("shelf with one shelves", spec([], [{ thing: "shelves", n: 1, quote: "one shelves", confidence: 1, assumed: false }])).prompt, "shelf with 1 shelf", "singular is shelf, not shelve");
  assert.equal(specToPrompt("bench 4 ft long", spec([S("W", 48, "4 ft", "overall", "ft")])).prompt, "bench 48 long", "long stays long when typed after the quote");
});

test("I49 r3: mm is mm, feet-inches only for feet, whole-feet tolerance is 3 inches (row 470)", () => {
  assert.deepEqual([quoteUnit("900 mm"), quoteUnit("90cm"), quoteUnit("1.8 m"), quoteUnit("6 ft")], ["mm", "cm", "m", "ft"]);
  assert.equal(validateSpec("bookcase 900 mm wide", { sizes: [S("W", 900 / 25.4, "900 mm wide", "overall", "mm")] }).spec.sizes.length, 1);
  assert.equal(validateSpec("bookcase 900 mm wide", { sizes: [S("W", 900 / 2.54, "900 mm wide", "overall", "mm")] }).spec.sizes.length, 0, "a mm quote never reads as cm");
  assert.ok(!inchCandidates("1 m 20 cm").some((c) => Math.abs(c - 32) < 1e-6) && inchCandidates("6 ft 2 in").includes(74), "feet-inches combine only for feet");
  const at = (h: number) => ({ ...generateFromPrompt("bookcase"), overall: { width: 30, height: h, depth: 12 } }) as ReturnType<typeof generateFromPrompt>;
  const foot3 = S("H", 36, "3 foot", "overall", "ft");
  assert.deepEqual([honoredBy(at(38), foot3), honoredBy(at(40), foot3), honoredBy(at(50), foot3)], [true, false, false], "whole feet are ±3 inches");
});
