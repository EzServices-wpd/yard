/**
 * I49 r5 property sweep: a quote inside generated contexts (joiners, units, axis words, letters, synonyms, punctuation,
 * other numbers). Every reading the model could give (each axis, the quote's own unit) must leave the build exactly
 * the parser's, unless the context is a legit one: a lone metric/feet size with its own axis word, or no cue at all.
 * No network, no model.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { validateSpec } from "./aiReader/validate";
import { chooseBuildPrompt, specToPrompt } from "./aiReader/rewrite";

globalThis.fetch = (async () => { throw new Error("network is off in this test"); }) as typeof fetch;
const QUOTES: [string, string, number][] = [["2 m", "m", 200 / 2.54], ["80 cm", "cm", 80 / 2.54], ["1.2 m", "m", 120 / 2.54], ["600 mm", "mm", 600 / 25.4], ["6 ft", "ft", 72]];
const PREFIXES = ["", "height ", "width: ", "depth of ", "W ", "H ", "D ", "w=", "1 m ", "60 ", "60 to ", "60 and ", "60 or ", "60-", "60 - ", "60—", "60–", "between 60 and ", "2 times ", "2 x ", "2 by ", "30 wide ", "30 wide, ", "1,", "-", "~", "about ", "(", "plus ", "60/", "60 + ", "60 cm by ", "1 meter ", "1 metre and "];
const SUFFIXES = ["", " wide", " tall", " deep", " long", " high", " (tall)", ") tall", " H", " W", " D", ", 30 W", " x 60 cm", " by 75 cm", " & 40 cm", " 20 cm", " and 20 cm wide", " front to back", " diameter", " across", " thick", " side to side", "-80 cm", " or 90 cm", " tall 30 wide", " wide 30 wide", " / 90 cm", "; 40 cm wide", " in height", " of height", ". tall", " + 20 cm"];
const AXIS_OF: Record<string, string> = { " wide": "W", " tall": "H", " deep": "D", " long": "L", " high": "H" };
const AXES = ["W", "D", "H", "L"];
const plan = (q: string) => { const p = generateFromPrompt(q); const pl = buildPlan(p); return JSON.stringify({ name: p.name, overall: p.overall, refused: p.refused ?? null, pieces: pl.totals.pieces, usd: pl.totals.estCostUsd }); };
const S = (axis: string, inches: number, quote: string, unit: string) => ({ axis, value: inches, unit, inches, of: "overall", quote, confidence: 1, assumed: false });

/** Legit: no prefix, and either no suffix (a lone size, any reading is the model's guess) or its own axis word read on that axis. */
const fits = (suf: string, axis: string) => AXIS_OF[suf] === axis || (suf === " long" && axis === "W");
/** A separate typed width before the quote ("30 wide 2 m tall") is also legit: one typed size per axis, read on a non-W axis. */
const OWN_AXIS_PRE = new Set(["30 wide ", "30 wide, "]);
const legit = (pre: string, suf: string, axis: string) =>
  (pre === "" || (OWN_AXIS_PRE.has(pre) && axis !== "W")) && (suf === "" || fits(suf, axis) || (suf === " tall 30 wide" && axis === "H"));

const memo = new Map<string, ReturnType<typeof generateFromPrompt>>();
const gen = (q: string) => { let p = memo.get(q); if (!p) memo.set(q, (p = generateFromPrompt(q))); return p; };

export function sweep(opts: { allowList?: boolean } = {}) {
  const holes: string[] = []; let tried = 0, edited = 0;
  const base = new Map<string, string>();
  for (const [qt, unit, inches] of QUOTES) for (const pre of PREFIXES) for (const suf of SUFFIXES) {
    const prompt = `bookcase ${pre}${qt}${suf} with two shelves`;
    const quotes = [qt, ...(AXIS_OF[suf] ? [`${qt}${suf}`] : [])];
    for (const quote of quotes) for (const axis of AXES) {
      tried++;
      const spec = validateSpec(prompt, { sizes: [S(axis, inches, quote, unit)], counts: [] }, opts).spec;
      if (!spec.sizes.length && !spec.counts.length) continue; // nothing kept: chooseBuildPrompt can only keep the prompt
      const built = chooseBuildPrompt(prompt, spec, gen).buildPrompt;
      if (built === prompt) continue;
      edited++;
      if (legit(pre, suf, axis)) continue;
      if (!base.has(prompt)) base.set(prompt, plan(prompt));
      if (plan(built) !== base.get(prompt)) holes.push(`${prompt} | ${axis} "${quote}" -> ${built}`);
    }
  }
  return { tried, edited, holes };
}

test("I49 r5 sweep: no generated context lets a reading move a typed number (only legit contexts rewrite)", () => {
  const { tried, edited, holes } = sweep();
  if (holes.length) console.log(holes.join("\n"));
  assert.ok(tried > 5000, `tried ${tried}`);
  assert.deepEqual(holes.slice(0, 20), [], `${holes.length} holes of ${edited} edits in ${tried} readings`);
});

/** I49 r6 count-joiner sweep (row 505): a count word right after a number, unit, x/by/to/or/times/plus or a symbol. */
const CPRE = ["", "30 wide ", "6 ft ", "6' ", "5 feet ", "4 foot ", "90 cm ", "1 m ", "72\" ", "2 x ", "2x ", "3 × ", "3 * ", "2 by ", "36 by ", "two to ", "two or ", "2 times ", "30 plus ", "30 & ", "30 – ", "30 + "];
const COBJ: [string, string, string][] = [["bookcase", "shelves", "shelves"], ["dresser", "drawers", "drawers"], ["cabinet", "doors", "doors"]];
const CWORD: [string, number][] = [["two", 2], ["three", 3], ["four", 4]];
const C = (thing: string, n: number, quote: string) => ({ thing, n, quote, confidence: 1, assumed: false });
const box = (q: string) => { const p = gen(q); return JSON.stringify(p.pocket?.unit ?? p.overall ?? null); };
export function countSweep() {
  const holes: string[] = [], valOnly: string[] = [], guardOnly: string[] = []; let tried = 0;
  for (const pre of CPRE) for (const [obj, thing, noun] of COBJ) for (const [w, n] of CWORD) for (const read of [n, n - 1, n + 1]) {
    const prompt = `${obj} ${pre}${w} ${noun}`, raw = { sizes: [], counts: [C(thing, read, `${w} ${noun}`)] };
    tried++;
    const legit = pre === "" || pre === "30 wide ";
    // Both layers: anything but a legit context builds exactly the parser's build.
    const both = chooseBuildPrompt(prompt, validateSpec(prompt, raw).spec, gen).buildPrompt;
    if (!legit && both !== prompt && plan(both) !== plan(prompt)) holes.push(`${prompt} | ${read} -> ${both}`);
    // Each layer alone never moves the box.
    const v = validateSpec(prompt, raw).spec, vOnly = specToPrompt(prompt, v).prompt;
    if (vOnly !== prompt && box(vOnly) !== box(prompt)) valOnly.push(`${prompt} | ${read} -> ${vOnly}`);
    const gOnly = chooseBuildPrompt(prompt, raw as never, gen).buildPrompt;
    if (gOnly !== prompt && box(gOnly) !== box(prompt)) guardOnly.push(`${prompt} | ${read} -> ${gOnly}`);
  }
  return { tried, holes, valOnly, guardOnly };
}

test("I49 r6 count-joiner sweep: a count after a number, unit or joiner never moves the box (each layer alone) and builds the parser's build", () => {
  const { tried, holes, valOnly, guardOnly } = countSweep();
  assert.ok(tried >= 500, `tried ${tried}`);
  assert.deepEqual(holes.slice(0, 10), [], `${holes.length} holes`);
  assert.deepEqual(valOnly.slice(0, 10), [], `validator alone: ${valOnly.length}`);
  assert.deepEqual(guardOnly.slice(0, 10), [], `guard alone: ${guardOnly.length}`);
});

/** I49 r7 article/quantifier count sweep (row 529): an article or quantifier between a joiner and the count word ("2 x a pair of
 * drawers", "3 × the two shelves"), quantifier counts ("a couple of", "one", "both"), more objects, and refused builds (" 1 deep"). */
const APRE = ["", "30 wide ", "6 ft ", "1 m ", "72\" ", "2 x ", "3 × ", "36 by ", "two to ", "30 + "];
const AOBJ: [string, string, string, string][] = [["bookcase", "shelves", "shelves", "shelf"], ["dresser", "drawers", "drawers", "drawer"], ["nightstand", "drawers", "drawers", "drawer"], ["wardrobe", "rods", "rods", "rod"]];
const AFORMS = (noun: string, one: string): [string, string[], number][] => [
  ...["a ", "an ", "the ", "both ", "each ", "one "].map((art): [string, string[], number] => [`${art}two ${noun}`, [`two ${noun}`, `${art}two ${noun}`], 2]),
  [`a pair of ${noun}`, [`pair of ${noun}`, `a pair of ${noun}`], 2], [`a couple of ${noun}`, [`couple of ${noun}`, `a couple of ${noun}`], 2],
  [`one ${one}`, [`one ${one}`], 1], [`both ${noun}`, [`both ${noun}`], 2],
];
const pmemo = new Map<string, string>();
const planM = (q: string) => { let s = pmemo.get(q); if (s === undefined) pmemo.set(q, (s = plan(q))); return s; };
/** Box and refused-or-built state: what the same-box guard holds still. */
const state = (q: string) => { const p = gen(q); return JSON.stringify([p.pocket?.unit ?? p.overall ?? null, !!p.refused]); };
export function articleSweep() {
  const holes: string[] = [], valOnly: string[] = [], guardOnly: string[] = []; let tried = 0;
  for (const tail of ["", " 1 deep"]) for (const pre of APRE) for (const [obj, thing, noun, one] of AOBJ) for (const [typed, quotes, n] of AFORMS(noun, one))
    for (const quote of quotes) for (const read of [n, n - 1, n + 1].filter((x) => x > 0)) {
      const prompt = `${obj} ${pre}${typed}${tail}`, raw = { sizes: [], counts: [C(thing, read, quote)] };
      tried++;
      const legit = pre === "" || pre === "30 wide ";
      const both = chooseBuildPrompt(prompt, validateSpec(prompt, raw).spec, gen).buildPrompt;
      if (!legit && both !== prompt && planM(both) !== planM(prompt)) holes.push(`${prompt} | ${quote}=${read} -> ${both}`);
      // The guard alone never moves the box or flips refused/built; the validator alone never does outside a legit context.
      const vOnly = specToPrompt(prompt, validateSpec(prompt, raw).spec).prompt;
      if (!legit && vOnly !== prompt && state(vOnly) !== state(prompt)) valOnly.push(`${prompt} | ${quote}=${read} -> ${vOnly}`);
      const gOnly = chooseBuildPrompt(prompt, raw as never, gen).buildPrompt;
      if (gOnly !== prompt && state(gOnly) !== state(prompt)) guardOnly.push(`${prompt} | ${quote}=${read} -> ${gOnly}`);
    }
  return { tried, holes, valOnly, guardOnly };
}

test("I49 r7 article/quantifier count sweep: 'a pair of', 'the two', 'both' after a joiner, on built and refused builds, never moves the box or flips refused (row 529)", () => {
  const { tried, holes, valOnly, guardOnly } = articleSweep();
  assert.ok(tried >= 2000, `tried ${tried}`);
  assert.deepEqual(holes.slice(0, 10), [], `${holes.length} holes`);
  assert.deepEqual(valOnly.slice(0, 10), [], `validator alone: ${valOnly.length}`);
  assert.deepEqual(guardOnly.slice(0, 10), [], `guard alone: ${guardOnly.length}`);
});
