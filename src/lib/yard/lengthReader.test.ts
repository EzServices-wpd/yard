/**
 * NR-1: the one length reader. Every expected value is a literal worked out by hand; the build checks measure the
 * built overall, never through the reader. Properties run on a fixed seed.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { readLength, readLengths, readNumber, readTuple, releaseReads } from "./lengthReader";
import { canonicalMeasures } from "./measureText";
import { normalizeUserPrompt } from "./voiceHonesty";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
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
  assert.equal(canonicalMeasures("cabinet 30 in wide"), "cabinet 30 in wide");
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
  // "36 inch plywood" is the house's height (the size reader took it), never a 36" sheet thickness.
  const house = generateFromPrompt("dollhouse 36 inch plywood");
  assert.equal(house.overall.height, 36);
  assert.ok(!(house.notes ?? []).some((n) => /36" plywood/i.test(n)), (house.notes ?? []).join(" | "));
  // An odd sheet is said as typed or in 16ths (release text, byte for byte).
  for (const [q, said] of [["dollhouse 15/32 plywood", "15/32"], ["dollhouse 12.1 inch plywood", "12 1/8"], ["dollhouse 0.1 plywood", "1/8"], ["dollhouse 0.3 plywood", "5/16"], ["dollhouse 15/32 ply", "15/32"], ['dollhouse 15/32" plywood', "15/32"], ["dollhouse 1 1/8 inch plywood", "1 1/8"]])
    assert.ok((generateFromPrompt(q).notes ?? []).some((n) => n.startsWith(`${said}" plywood isn't on the stock list`)), q);
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
});

// Critic #225 B2 (row 710), r3: an arch is release's reading throughout (releaseReads), so it keeps release's span rule. Feet on the span build the 84" walk-through portal; an
// inch span is the narrow arch it was on release (W x D x H from release 08c36c6f, never widened to 43 3/16").
it("arch: a typed span builds what it built on release (feet = walk-through portal, inches = as typed)", () => {
  const dims = (p: string) => { const o = generateFromPrompt(p).overall; return [o.width, o.depth, o.height]; };
  for (const [q, want] of [["PVC garden arch 30 wide", [31.2, 13.2, 24.6]], ["PVC garden arch 36 wide", [37.2, 13.2, 24.6]], ["PVC garden arch 2'6\" wide", [31.2, 13.2, 24.6]],
    ['PVC garden arch 30 1/2" wide', [31.7, 13.2, 24.6]], ["PVC garden arch 48 inches wide", [49.2, 13.2, 24.6]], ["PVC garden arch 4 feet wide", [49.2, 17.2, 84.6]],
    ["PVC garden arch 4.5 feet wide", [55.2, 17.2, 84.6]], ["garden arch 30 wide 24 tall", [31, 8, 24]]] as [string, number[]][])
    assert.deepEqual(dims(q), want, q);
  assert.equal(canonicalMeasures("PVC garden arch 4 feet wide"), "PVC garden arch 4 feet wide");
  assert.equal(canonicalMeasures("garden arch 3' wide"), "garden arch 3' wide"); // r3: an arch is release's text
});

// Critic #225 B1 (row 709): a number with a comma in it ("1,5 m", "1,200 mm", "72,5 cm") is never read, and no length
// starts inside it, so the build is release's (W x D x H and $ from release 08c36c6f, byte for byte).
it("comma numbers: never read, never split; the build is release's", () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 999 }), fc.integer({ min: 0, max: 999 }), fc.constantFrom("mm", "cm", "m", "in", "ft", "inches", '"', "'"), fc.constantFrom("", " "), (a, b, u, sp) => {
    const tok = `${a},${b}${sp}${u}`, q = `bookcase ${tok} wide`;
    return readLengths(q).every((l) => l.end <= 9 || l.start >= 9 + tok.length) && canonicalMeasures(q) === q;
  }), { seed: SEED, numRuns: 300 });
  for (const [q, w, d, h, usd] of [["bookcase 1,5 m tall", 36, 12, 84, 131.76], ["toy chest 0,9 m wide", 36, 16, 30, 115.27], ["dresser 1,5 m wide", 36, 18, 36, 218.16],
    ["desk 1,2 m wide", 48, 24, 29, 356.99], ["wardrobe 1,200 mm wide", 36, 24, 84, 270.82], ["bookcase 36 wide 1,829 mm tall", 36, 12, 84, 131.76],
    ["bookcase 1,000 mm wide", 36, 12, 84, 131.76], ["bookcase 72,5 cm wide", 72, 12, 84, 203.64], ["bookcase 1,8 m tall 30 wide", 30, 12, 30, 83.35],
    ["dollhouse 0,6 m tall", 25, 19, 22.5, 19.96], ["toy box 0,9 m wide", 36, 16, 30, 115.27]] as [string, number, number, number, number][]) {
    const p = generateFromPrompt(q);
    assert.deepEqual([p.refused ?? null, p.overall.width, p.overall.depth, p.overall.height, buildPlan(p).totals.estCostUsd], [null, w, d, h, usd], q);
  }
});

// NR-1 r3 (Ezra/Chief): commas, arches, hyphenated N-inch / N-foot, a foot mark before "long" and "width N ft" are
// release's (rows 712, 722, 724; NR-2/NR-3). Release's build of each of Critic's r2 off-card and comma/arch movers.
const RELEASE_BUILDS: [string, boolean, number, number, number, number | null][] = [
    ["PVC garden arch 3' wide", false, 19.2, 13.2, 36.6, 27.24],
    ["PVC garden arch 914mm wide", false, 61.6, 17.2, 84.6, 44.6],
    ["PVC garden arch 91.4 cm wide", false, 61.6, 17.2, 84.6, 44.6],
    ["PVC garden arch thirty-six inches wide", false, 61.6, 17.2, 84.6, 44.6],
    ["PVC garden arch 2 1/2 ft 3 inch wide", false, 2, 2.1, 2.1, 25.48],
    ["PVC garden arch 24 and a half inches wide", false, 61.6, 17.2, 84.6, 44.6],
    ["shelf unit 30 wide, 1 m tall", false, 30, 12, 18, 83.35],
    ["dollhouse 18-inch wide", false, 19, 19, 18.1, 19.96],
    ["dollhouse 20-1/2-inch wide", false, 25, 25, 24.5, 19.96],
    ["dollhouse 23-1/2-inch wide", false, 25, 25, 24.5, 19.96],
    ["dollhouse 30-inch wide", false, 31, 31, 29.9, 19.96],
    ["dollhouse 31-1/2-inch wide", false, 25, 25, 24.5, 19.96],
    ["dollhouse 36-inch wide", false, 37, 37, 35.8, 19.96],
    ["dollhouse 48-inch wide", false, 49, 49, 47.6, 19.96],
    ["dollhouse 6-1/8-inch wide", false, 25, 25, 24.5, 19.96],
    ["dollhouse 60-inch wide", false, 61, 61, 59.3, 19.96],
    ["dollhouse 72-inch wide", false, 73, 73, 71.1, 19.96],
    ["dollhouse 84-inch wide", false, 85, 85, 82.8, 19.96],
    ["dollhouse width 2 ft", false, 20.2, 10.6, 24.5, 19.96],
    ["garden arch 18-inch wide", false, 66.1, 19, 90, 42.93],
    ["garden arch 2-foot wide", false, 18.4, 8, 24.5, 42.93],
    ["garden arch 20-1/2-inch wide", false, 61.5, 17, 84.5, 42.93],
    ["garden arch 23-1/2-inch wide", false, 61.5, 17, 84.5, 42.93],
    ["garden arch 24-inch wide", false, 18.4, 8, 24.5, 42.93],
    ["garden arch 3-foot wide", false, 27.2, 8.3, 36.5, 42.93],
    ["garden arch 30-inch wide", false, 22.8, 8, 30.5, 42.93],
    ["garden arch 31-1/2-inch wide", false, 61.5, 17, 84.5, 42.93],
    ["garden arch 36-inch wide", false, 27.2, 8.3, 36.5, 42.93],
    ["garden arch 4-foot wide", false, 35.9, 10.7, 48.5, 42.93],
    ["garden arch 48-inch wide", false, 35.9, 10.7, 48.5, 42.93],
    ["garden arch 5-foot wide", false, 61.5, 17, 84.5, 42.93],
    ["garden arch 6-foot wide", false, 53.4, 15.5, 72.5, 42.93],
    ["garden arch 60-inch wide", false, 61.5, 17, 84.5, 42.93],
    ["garden arch 7-foot wide", false, 61.5, 17, 84.5, 42.93],
    ["garden arch 72-inch wide", false, 53.4, 15.5, 72.5, 42.93],
    ["garden arch 84-inch wide", false, 61.5, 17, 84.5, 42.93],
    ["popsicle stick bridge 2' long", false, 162.7, 25, 33.6, 34.94],
    ["popsicle stick bridge 2-foot long", false, 106.3, 16.6, 22.1, 19.96],
    ["popsicle stick bridge 24-inch long", false, 106.3, 16.6, 22.1, 19.96],
    ["popsicle stick bridge 4' long", false, 49, 8.1, 10.3, 19.96],
    ["popsicle stick bridge 5' long", false, 405.2, 61, 83.4, 64.9],
    ["popsicle stick bridge 6' long", false, 486, 73, 100, 79.88],
    ["popsicle stick bridge 7' long", false, 566.8, 85, 116.5, 94.86],
    ["skewer bridge 2' long", false, 162.7, 25, 33.6, 25.95],
    ["skewer bridge 2-foot long", false, 106.3, 16.6, 22.1, 18.96],
    ["skewer bridge 24-inch long", false, 106.3, 16.6, 22.1, 18.96],
    ["skewer bridge 4' long", false, 49, 8.1, 10.3, 11.97],
    ["skewer bridge 5' long", false, 405.2, 61, 83.4, 60.9],
    ["skewer bridge 6' long", false, 486, 73, 100, 67.89],
    ["skewer bridge 7' long", false, 566.8, 85, 116.5, 81.87],
    ["PVC garden arch 457 mm wide", false, 61.6, 17.2, 84.6, 44.6],
    ["PVC garden arch 2' wide", false, 19.2, 13.2, 12.6, 25.48],
    ["PVC garden arch 610 mm wide", false, 61.6, 17.2, 84.6, 44.6],
    ["PVC garden arch 762 mm wide", false, 61.6, 17.2, 84.6, 44.6],
    ["PVC garden arch 914 mm wide", false, 61.6, 17.2, 84.6, 44.6],
    ["PVC garden arch 1067 mm wide", false, 61.6, 17.2, 84.6, 44.6],
    ["PVC garden arch 4' wide", false, 25.2, 13.2, 48.6, 33],
    ["PVC garden arch 1219 mm wide", false, 61.6, 17.2, 84.6, 44.6],
    ["PVC garden arch 5' wide", false, 31.2, 13.2, 60.6, 33],
    ["PVC garden arch 1524 mm wide", false, 61.6, 17.2, 84.6, 44.6],
    ["PVC garden arch 6' wide", false, 37.2, 13.2, 72.6, 38.76],
    ["PVC garden arch 1829 mm wide", false, 61.6, 17.2, 84.6, 44.6],
    ["PVC garden arch 1.2 m wide 2 m tall", false, 43.2, 17.2, 84.6, 44.52],
    ["dollhouse 2,5 ft tall", false, 67.7, 51.7, 60, 19.96],
    ["dollhouse 4,5 feet tall", false, 67.7, 51.7, 60, 19.96],
    ["garden arch 2,5 ft wide", false, 61, 17, 84.5, 42.93],
    ["garden arch 4,5 feet wide", false, 61, 17, 84.5, 42.93],
    ["PVC garden arch 2,5 ft wide", false, 61.2, 17.2, 84.6, 44.6],
    ["PVC garden arch 36,5 inches wide", false, 5, 5, 5, 25.48],
    ["PVC garden arch 24,5\" wide", false, 5, 5, 5, 25.48],
    ["PVC garden arch 30,5 in wide", false, 5, 5, 5, 25.48],
    ["PVC garden arch 4,5 feet wide", false, 61.2, 17.2, 84.6, 44.6],
    ["castle from toothpicks 24,5\"", false, 5.7, 5.2, 4.8, 7.95],
    ["desk 1,500 mm wide 750 mm deep", false, 48, 24, 29, 356.99],
    ["cabinet 60,5 cm wide 90 cm tall", false, 90, 16, 84, 391.36],
    ["bookcase 914mm wide,1829mm tall,305mm deep", false, 36, 12, 84, 131.76],
    ["bookcase 914 mm wide, 1829 mm tall, 305 mm deep", false, 36, 12, 84, 131.76],
    ["bookcase 91.4 cm wide,182.9 cm tall", false, 91.4, 12, 84, 203.64],
    ["desk 1.5 m wide, 75 cm deep", false, 48, 24, 29, 356.99],
    ["toy chest 2.5 ft wide, 18 deep", false, 36, 18, 30, 115.27],
    ["dollhouse 2 ft wide, 30\" tall", false, 25, 25, 30, 19.96],
    ["bookcase 1,829 mm tall 914 mm wide", false, 36, 12, 84, 131.76],
    ["wardrobe 1,2 m wide 2 m tall", false, 2, 24, 84, 193.69],
];

it("release reads: commas, arches, N-inch / N-foot, N' long and width N ft build what release builds", () => {
  for (const [q, refused, w, d, h, usd] of RELEASE_BUILDS) {
    assert.ok(releaseReads(q), q);
    const p = generateFromPrompt(q);
    const o = [p.overall.width, p.overall.depth, p.overall.height].map((n) => Math.round(n * 1e4) / 1e4);
    assert.deepEqual([Boolean(p.refused), ...o, refused ? usd : buildPlan(p).totals.estCostUsd], [refused, w, d, h, usd], q);
  }
  // Release's own readings, in any number: a foot mark before "long" is the bare count, a hyphenated size before an
  // axis word is unread, "width N ft" is N, and an arch or a comma keeps the text as release left it.
  fc.assert(fc.property(fc.integer({ min: 2, max: 40 }), fc.constantFrom("skewer bridge", "popsicle stick bridge", "garden arch", "dollhouse"), (n, cls) => {
    const ok = typedAxisNumber(`${cls} ${n}' long`, "length") === n && typedAxisNumber(`${cls} ${n}-inch wide`, "width") === null
      && typedAxisNumber(`${cls} ${n}-foot wide`, "width") === null && typedAxisNumber(`${cls} width ${n} ft`, "width") === n
      && typedSizeIn(`${cls} ${n}-1/2-inch wide`).length === undefined && dollhouseTyped(`${cls} width ${n} ft`).height === n * 12
      && dollhouseTyped(`dollhouse ${n},5 ft`).height === 60;
    return ok && canonicalMeasures(`garden arch ${n} 1/2 ft wide`) === `garden arch ${n}.5 ft wide` && canonicalMeasures(`${cls} ${n}-1/2-inch wide`) === `${cls} ${n}-1/2-inch wide`
      && normalizeUserPrompt(`bookcase, ${n} 1/2 ft boards`) === `bookcase, ${n} 1/24 inch boards`;
  }), { seed: SEED, numRuns: 200 });
  // An arch word keeps release's plywood count too: the odd sheet is said, as on release.
  assert.ok(generateFromPrompt("dollhouse with arched door 36 tall 3 inch plywood").notes?.includes(`3" plywood isn't on the stock list, so this dollhouse is cut from 3/4" Plywood 4×8. Pick 1/2" or 3/4" plywood to switch it.`));
});

it("card 6 (r4): a castle typed in any spelling builds or refuses like its digit spelling; the refusal title never takes the size words (row 731)", () => {
  const core = (q: string) => {
    const p = generateFromPrompt(q);
    return { name: p.name, refused: p.refused ?? null, o: [p.overall.width, p.overall.depth, p.overall.height], usd: p.refused ? 0 : buildPlan(p).totals.estCostUsd };
  };
  // One prompt per card 6 shape (Critic r3 B2 probe/coff-offlist.json and r4/c6.json).
  for (const q of ["castle from toothpicks 29 1/2 inches", "toothpick castle 12 1/4 inch", "castle from toothpicks 1 1/4 feet", "toothpick castle 2-1/2 ft", "castle from toothpicks 12-1/2 inch", "toothpick castle 12 and a half inches", "toothpick castle thirty inches", "castle from toothpicks two and a half feet", 'castle made of toothpicks 29 1/2"', "castle out of toothpicks 2 ft 6 in"]) {
    assert.deepEqual(core(q), core(canonicalMeasures(q)), q);
  }
  // Card 6's example: release built a misread 2 5/16" castle for $7.95; the size is now read whole.
  const ex = core("castle from toothpicks 29 1/2 inches");
  assert.deepEqual([ex.refused, ex.usd], [null, 34.68]);
  assert.ok(near(ex.o[0], 33.3, 0.05) && near(ex.o[2], 29.3, 0.05), JSON.stringify(ex.o));
  // Row 731: "a Castle Thirty Inches in wooden toothpicks" was the title taking the spelled size; only the title changes.
  const t = core("toothpick castle thirty inches");
  assert.equal(t.name, "Castle");
  assert.equal(t.refused, "Yard builds up to 8,000 parts in one plan, and a Castle in wooden toothpicks at 30 inches needs more, so nothing is built. It builds up to 29 1/2 inches: type 29 1/2 inches or smaller.");
  assert.match(core("toothpick castle 30 and a half inches").refused ?? "", /^Yard builds up to 8,000 parts in one plan, and a Castle in wooden toothpicks at 30 1\/2 inches needs more/);
});
