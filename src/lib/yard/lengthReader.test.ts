/**
 * NR-1: the one length reader. Every expected value is a literal worked out by hand; the build checks measure the
 * built overall, never through the reader. Properties run on a fixed seed.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { readLength, readLengths, readNumber, readTuple } from "./lengthReader";
import { canonicalMeasures } from "./measureText";
import { normalizeUserPrompt } from "./voiceHonesty";
import { generateFromPrompt } from "./promptMain";
import { typedAxisNumber } from "./typedAxis";
import { typedSizeIn } from "./formTemplates";
import { dollhouseTyped } from "./dollhouse";

const SEED = 20261030;
const near = (a: number | undefined, b: number, tol = 1 / 32) => a != null && Math.abs(a - b) <= tol;

it("reads every spelling of one size (literals)", () => {
  const ORACLE: [string, number][] = [
    ["6mm", 6 / 25.4], ["19mm", 19 / 25.4], ["1829mm", 72.0079], ["1.5 cm", 0.5906], ["2 m", 78.7402],
    ["quarter inch", 0.25], ["half inch", 0.5], ["a half inch", 0.5], ["three quarter inch", 0.75], ["one inch", 1], ["1-inch", 1],
    ["seventy-two inches", 72], ["thirty six inches", 36], ["24 and a half inches", 24.5], ["two and a half feet", 30],
    ["2 1/2 ft 3 inch", 33], ["2 ft 6 in", 30], ["2'6\"", 30], ["5ft6in", 66], ["2.5 ft", 30], ["24½\"", 24.5], ["24-1/2 in", 24.5],
    ["a 2 inch thick top", 2], ["castle 20 1/2\"", 20.5], ["36-inch", 36],
  ];
  const bad = ORACLE.filter(([t, want]) => !near(readLength(t)?.inches, want, 0.001)).map(([t, want]) => `${t}: ${readLength(t)?.inches} != ${want}`);
  assert.deepEqual(bad, []);
  assert.equal(readNumber("8 1/4"), 8.25);
  // Never inside another number, never a spelled count without a unit word, inches join feet only under 12.
  assert.deepEqual([readLengths("w/4 in"), readLengths(".5 in"), readLengths("two shelves"), readLengths("one in each")].map((x) => x.length), [0, 0, 0, 0]);
  assert.deepEqual(readLengths("6 ft 12 in").map((l) => l.inches), [72, 12]);
  assert.equal(readLength("bench 30", 0, { bareUnit: "ft" })?.inches, 360);
  assert.equal(readTuple("just 36 wide"), null);
  assert.ok(Number.isNaN(readNumber("1/0")));
});

it("row 658: a length never starts after a slash or a dot ('2 1/2 ft 3 in' is one 33\", never '2 1/27')", () => {
  assert.deepEqual(readLengths("shelf 2 1/2 ft 3 inch wide").map((l) => l.inches), [33]);
  assert.equal(canonicalMeasures("bookcase 2 1/2 ft 3 inch wide"), 'bookcase 33" wide');
  fc.assert(fc.property(fc.integer({ min: 1, max: 9 }), fc.constantFrom(2, 4, 8, 16), fc.nat(15), fc.nat(11), (a, c, b0, i) => {
    const b = (b0 % (c - 1)) + 1;
    const ls = readLengths(`x ${a} ${b}/${c} ft ${i} in y`);
    return ls.length === 1 && near(ls[0].inches, (a + b / c) * 12 + i);
  }), { seed: SEED, numRuns: 200 });
});

it("round trip: any size on the 1/16 grid reads back the same in every shop spelling", () => {
  const frac = (n: number) => { const s = Math.round(n * 16), w = Math.floor(s / 16), r = s % 16; let d = 16, k = r; while (k % 2 === 0 && k) { k /= 2; d /= 2; } return r ? `${w ? `${w} ` : ""}${k}/${d}` : `${w}`; };
  fc.assert(fc.property(fc.integer({ min: 16, max: 16 * 120 }), (s) => {
    const n = s / 16, ft = Math.floor(n / 12), inch = n - ft * 12;
    const forms = [`${frac(n)}"`, `${frac(n).replace(" ", "-")} in`, `${n} inches`, `${(n * 25.4).toFixed(1)}mm`];
    if (ft && inch) forms.push(`${ft} ft ${frac(inch)} in`, `${ft}'${frac(inch)}"`);
    return forms.every((f) => near(readLength(`box ${f} tall`)?.inches, n, /mm/.test(f) ? 0.5 / 25.4 + 1e-9 : 1e-9));
  }), { seed: SEED, numRuns: 300 });
});

it("canonicalMeasures is idempotent and leaves stock names alone", () => {
  for (const p of ["bookcase 2 1/2 ft 3 inch wide", "castle 20 1/2\"", "toy box 2.5 ft wide 1.5 ft deep", "bookcase 1829mm tall", "bookcase seventy-two inches tall"])
    assert.equal(canonicalMeasures(canonicalMeasures(p)), canonicalMeasures(p), p);
  for (const p of ["shelf from 1/2 plywood", "3/4 x 4 x 8 sheet", "box with 1 1/2 inch screws", "bench from 2x4", "dollhouse 6mm plywood", "6 ft 2 x 4 frame", "2x4 bench 4 ft long", "a 1 1/2 inch thick top"])
    assert.equal(canonicalMeasures(p), p, p);
  // A spelled number with a unit is its digits (row 608): the stock reader then reads the sheet it names.
  assert.equal(canonicalMeasures("dollhouse quarter inch plywood"), "dollhouse 1/4 inch plywood");
  assert.equal(canonicalMeasures("bridge from skewers 1829mm long"), 'bridge from skewers 72" long');
  assert.equal(canonicalMeasures("shelf with one in each corner"), "shelf with one in each corner");
  assert.equal(canonicalMeasures("dollhouse 2 ft 6 in"), 'dollhouse 30"');
  assert.doesNotMatch(normalizeUserPrompt("bookcase from 2 1/2 ft boards"), /1\/24/);
});

it("tuples read in typed order, x or by", () => {
  assert.deepEqual(readTuple("bookcase 24 by 36 by 12")?.places.map((l) => l.inches), [24, 36, 12]);
  assert.deepEqual(readTuple('bookcase 36" x 12" x 72"')?.places.map((l) => l.inches), [36, 12, 72]);
  assert.deepEqual(readTuple("toy box 2.5 ft x 1.5 ft")?.places.map((l) => l.inches), [30, 18]);
});

it("callers moved onto the reader: bridge span, craft bare size, dollhouse bare height", () => {
  assert.equal(typedAxisNumber("bridge 24 1/2 wide", "width"), 24.5);
  assert.equal(typedAxisNumber("bridge 18 1/2 inches long", "length"), 18.5);
  assert.equal(typedAxisNumber("shelf 2 1/2 ft wide", "width"), 30);
  assert.equal(typedAxisNumber("bridge 18 long", "length"), 18);
  assert.equal(typedAxisNumber("bridge width 24 1/2", "width"), 24.5);
  assert.equal(typedAxisNumber("shelf 0 wide", "width"), null);
  assert.deepEqual(typedSizeIn("castle 600mm"), {});
  assert.deepEqual(typedSizeIn('castle from toothpicks 20 1/2"'), { length: 20.5 });
  assert.deepEqual(typedSizeIn("castle from toothpicks 20 1/2 in"), { length: 20.5 });
  assert.deepEqual(typedSizeIn('pyramid 12" tall from 1/4" dowels'), { height: 12 });
  assert.equal(dollhouseTyped("dollhouse 30 1/2 inch").height, 30.5);
  assert.equal(dollhouseTyped("dollhouse 4 ft").height, 48);
  assert.equal(dollhouseTyped("dollhouse 1/2 inch plywood").height, undefined);
  assert.equal(dollhouseTyped("dollhouse quarter inch plywood").height, undefined);
  assert.equal(dollhouseTyped('dollhouse 36x24"').height, undefined);
});

/** Same size, any spelling → the same build (Chief's side quest, rows 674-676, 658). */
it("every spelling of one size builds the same thing", () => {
  const dims = (p: string) => { const o = generateFromPrompt(p).overall; return `${o.width}x${o.height}x${o.depth}`; };
  const GROUPS: string[][] = [
    ["bookcase 36 wide 72 tall 12 deep", "bookcase 36 wide 6 ft tall 12 deep", "bookcase 36 wide 1829mm tall 12 deep", "bookcase 36 wide seventy-two inches tall 12 deep",
      "bookcase 914mm wide 1829mm tall 305mm deep", "bookcase thirty-six inches wide seventy-two inches tall twelve inches deep", "bookcase 3' wide 6' tall 12\" deep"],
    ["toy box 30 wide 18 deep 20 tall", "toy box 2 1/2 ft wide 1 1/2 ft deep 20 inch tall", "toy box 2.5 ft wide 1.5 ft deep 20 in tall", "toy box 2'6\" wide 1'6\" deep 1'8\" tall"],
    ["shelf 33 wide", "shelf 2 1/2 ft 3 inch wide", "shelf 2'9\" wide"],
  ];
  const bad: string[] = [];
  for (const g of GROUPS) { const want = dims(g[0]); for (const p of g.slice(1)) if (dims(p) !== want) bad.push(`${p}: ${dims(p)} != ${want}`); }
  assert.deepEqual(bad, []);
  assert.equal(generateFromPrompt("bookcase 36 wide seventy-two inches tall 12 deep").overall.height, 72); // not the 84" default
  // An arch span typed in inches keeps the walk-through height, as feet do; a typed height still wins.
  assert.equal(dims("PVC garden arch 48 inches wide"), dims("PVC garden arch 4 feet wide"));
  assert.equal(generateFromPrompt("garden arch 30 wide 24 tall").overall.height, 24);
});
