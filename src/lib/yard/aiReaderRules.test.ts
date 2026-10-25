/**
 * I49 AI prompt reader rules (no wiring yet): the validator, the rewrite into fraction inches, and the seven canaries
 * byte-identical through the rewrite whether the reading is right or wrong. No network: fetch throws, no model.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { POCKET_DREAM } from "./pocket";
import { validateSpec } from "./aiReader/validate";
import { chooseBuildPrompt, specToPrompt } from "./aiReader/rewrite";
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
  assert.equal(specToPrompt(Q, spec([S("W", 30, "30x18x72"), S("D", 18, "30x18x72"), S("H", 72, "30x18x72")])).prompt, "linen closet 30 wide 18 deep 72 tall");
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
