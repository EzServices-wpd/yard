/**
 * Property suite (fast-check, fixed seed) for the typed-word law: every number typed is the dimension built
 * (to 1/16"), on every axis and inside W×D×H strings, in every way woodworkers write sizes; and a typed count is
 * built exactly or refused out loud. Generators also mix in stock and species ("from 1/2 plywood", "in walnut").
 *
 * Expected-fail properties live in evals/props-allow.json with a reason (e.g. the fraction parser, I35, is being
 * fixed in a parallel PR): they report but do not fail. A property that fails and is not listed fails the suite.
 * Shrunk counterexamples: PROPS_WRITE_REGRESSIONS=1 writes evals/corpus/props-regressions.json (the gate then grades them).
 * PROPS_OUT=<file> writes the per-property results the eval-gate workflow diffs. YARD_ROOT=<checkout> grades another engine.
 *
 *   npx tsx --test scripts/props.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import fc from "fast-check";
import { HEAD_ROOT, loadEngine, offline, stable } from "./eval-gate-lib.ts";

export const SEED = 20261019;
const RUNS = Number(process.env.PROPS_RUNS ?? 40);
const E = await loadEngine(process.env.YARD_ROOT ?? HEAD_ROOT);
const allowed: { name: string; reason: string }[] = JSON.parse(readFileSync(join(HEAD_ROOT, "evals/props-allow.json"), "utf8")).expectedFail;
const cache = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any
const build = (q: string) => {
  if (!cache.has(q)) cache.set(q, offline(() => { try { return E.generateFromPrompt(q); } catch (e) { return { error: String(e) }; } }));
  return cache.get(q);
};

// ---------------------------------------------------------------- generators
type Noun = { noun: string; W: [number, number]; H: [number, number]; D: [number, number] };
/** Forms whose typed W/H/D the engine honors at whole inches (same families as invariants-corpus seeded sizes). */
const NOUNS: Noun[] = [
  { noun: "bookcase", W: [18, 48], H: [30, 84], D: [8, 16] },
  { noun: "nightstand", W: [14, 24], H: [22, 30], D: [14, 20] },
  { noun: "wall cabinet", W: [16, 36], H: [20, 36], D: [8, 14] },
  { noun: "coffee table", W: [30, 60], H: [16, 20], D: [18, 30] },
  { noun: "desk", W: [36, 72], H: [28, 31], D: [20, 32] },
];
const STOCK = ["", " from 3/4 plywood", " from 1/2 plywood", " in walnut", " from oak", " from pine", " from maple", " from cherry"];
const FRACS: [number, number][] = [[1, 2], [1, 4], [3, 4], [1, 8], [3, 8], [5, 8], [7, 8]];
const UNI: Record<string, string> = { "1/2": "½", "1/4": "¼", "3/4": "¾", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞" };
type Fmt = "integer" | "decimal" | "mixed" | "unicode" | "hyphen" | "feet-inches";
/** A typed length as a person writes it, and its true value in inches. */
function render(whole: number, frac: [number, number] | null, fmt: Fmt, unit: string, ftStyle: number): { text: string; value: number } {
  const f = frac ? frac[0] / frac[1] : 0;
  const v = whole + f;
  const fs = frac ? `${frac[0]}/${frac[1]}` : "";
  switch (fmt) {
    case "integer": return { text: `${whole}${unit}`, value: whole };
    case "decimal": return { text: `${v}${unit}`, value: v };
    case "mixed": return { text: `${whole} ${fs}${unit}`, value: v };
    case "unicode": return { text: `${whole}${UNI[fs]}${unit}`, value: v };
    case "hyphen": return { text: `${whole}-${fs}${unit}`, value: v };
    case "feet-inches": {
      const ft = Math.floor(whole / 12), inch = whole - 12 * ft;
      const inchText = `${inch}${frac ? ` ${fs}` : ""}`;
      return { text: ftStyle === 0 ? `${ft}' ${inchText}"` : ftStyle === 1 ? `${ft} ft ${inchText} in` : `${ft}'${inchText}"`, value: v };
    }
  }
}
const AX = ["W", "H", "D"] as const;
const WORD = { W: "wide", H: "tall", D: "deep" } as const;
/** One prompt with one axis (or all three in a W×D×H string) written in `fmt`; the others as whole inches. */
const sizedPrompt = (fmt: Fmt, triple: boolean) =>
  fc.record({
    n: fc.constantFrom(...NOUNS), axis: fc.constantFrom(...AX), t: fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true })),
    frac: fc.constantFrom(...FRACS), unit: fc.constantFrom("", "\"", " in", " inches"), ftStyle: fc.integer({ min: 0, max: 2 }), stock: fc.constantFrom(...STOCK), spaced: fc.boolean(),
  }).map(({ n, axis, t, frac, unit, ftStyle, stock, spaced }) => {
    const whole = (ax: (typeof AX)[number], i: number) => Math.min(n[ax][1] - 1, Math.floor(n[ax][0] + t[i] * (n[ax][1] - n[ax][0])));
    const useFrac = fmt !== "integer";
    const typed: Record<string, number> = {};
    const txt: Record<string, string> = {};
    AX.forEach((ax, i) => {
      const w = whole(ax, i);
      const mine = triple || ax === axis;
      const fm: Fmt = mine ? (fmt === "feet-inches" && w < 12 ? "integer" : fmt) : "integer";
      const r = render(w, mine && useFrac && fm !== "integer" ? frac : null, fm, triple ? "" : mine && fm !== "feet-inches" ? unit : "", ftStyle);
      typed[ax] = r.value; txt[ax] = r.text;
    });
    const x = spaced ? " x " : "x";
    const prompt = triple ? `${n.noun} ${txt.W}${x}${txt.D}${x}${txt.H}${stock}` : `${n.noun} ${txt.W} wide ${txt.H} tall ${txt.D} deep${stock}`;
    return { prompt, typed };
  });
function dimsHonored({ prompt, typed }: { prompt: string; typed: Record<string, number> }) {
  const p = build(prompt);
  if (p.error) return false;
  const o = p.overall;
  const got: Record<string, number> = { W: o.width, H: o.height, D: o.depth };
  return AX.every((ax) => Math.abs(got[ax] - typed[ax]) <= 1 / 16 + 1e-9);
}
type CountCase = { prompt: string; thing: string; n: number };
const COUNT_RE: Record<string, RegExp> = { drawers: /\bdrawer front\b/i, shelves: /^(?:adjustable |fixed |bottom |top |lower |middle )?shel(f|ves)\b(?!\s*pin)/i, steps: /^(?:top )?tread\b/i, rods: /\brod\b/i };
function countHonored({ prompt, thing, n }: CountCase) {
  const p = build(prompt);
  if (p.error) return false;
  if (typeof p.refused === "string" && p.refused) return true; // refused out loud is honest
  const hit = p.panels.filter((x: { name: string; position?: { y: number } }) => COUNT_RE[thing].test(x.name));
  // A typed shelf count is a count of shelf levels. A divider cuts a level into bay pieces.
  const built = thing === "shelves" ? new Set(hit.map((x: { position?: { y: number } }) => Math.round((x.position?.y ?? 0) * 4) / 4)).size : hit.length;
  return built === n;
}
const stockArb = fc.constantFrom(...STOCK);
const countPrompt = (gen: fc.Arbitrary<CountCase>) => gen;

// ---------------------------------------------------------------- properties
type Prop = { name: string; arb: fc.Arbitrary<{ prompt: string }>; check: (x: any) => boolean }; // eslint-disable-line @typescript-eslint/no-explicit-any
const PROPS: Prop[] = [
  { name: "size: whole inches on every axis (control)", arb: sizedPrompt("integer", false), check: dimsHonored },
  { name: "size: decimals (24.5)", arb: sizedPrompt("decimal", false), check: dimsHonored },
  { name: "size: mixed fractions (24 1/2)", arb: sizedPrompt("mixed", false), check: dimsHonored },
  { name: "size: unicode fractions (24½)", arb: sizedPrompt("unicode", false), check: dimsHonored },
  { name: "size: hyphen fractions (24-1/2)", arb: sizedPrompt("hyphen", false), check: dimsHonored },
  { name: "size: feet-inches (2' 6\", 2 ft 6 in)", arb: sizedPrompt("feet-inches", false), check: dimsHonored },
  { name: "size: W×D×H strings, whole inches", arb: sizedPrompt("integer", true), check: dimsHonored },
  { name: "size: W×D×H strings with fractions", arb: sizedPrompt("mixed", true), check: dimsHonored },
  { name: "count: drawers built or refused", arb: countPrompt(fc.record({ noun: fc.constantFrom("dresser", "nightstand", "dresser 36 wide"), n: fc.integer({ min: 1, max: 6 }), stock: stockArb }).map(({ noun, n, stock }) => ({ prompt: `${noun} with ${n} ${n === 1 ? "drawer" : "drawers"}${stock}`, thing: "drawers", n }))), check: countHonored },
  { name: "count: shelves built or refused", arb: countPrompt(fc.record({ noun: fc.constantFrom("bookcase", "bookcase 30 wide 60 tall 12 deep", "wall cabinet"), n: fc.integer({ min: 1, max: 8 }), stock: stockArb }).map(({ noun, n, stock }) => ({ prompt: `${noun} with ${n} ${n === 1 ? "shelf" : "shelves"}${stock}`, thing: "shelves", n }))), check: countHonored },
  { name: "count: steps built or refused", arb: countPrompt(fc.record({ n: fc.integer({ min: 1, max: 3 }), stock: fc.constantFrom("", " from pine", " from plywood", " from oak") }).map(({ n, stock }) => ({ prompt: `step stool with ${n} ${n === 1 ? "step" : "steps"}${stock}`, thing: "steps", n }))), check: countHonored },
  { name: "count: abacus rods built or refused", arb: countPrompt(fc.record({ w: fc.integer({ min: 4, max: 16 }), n: fc.integer({ min: 3, max: 15 }) }).map(({ w, n }) => ({ prompt: `abacus ${w} wide ${n} rods`, thing: "rods", n }))), check: countHonored },
];

type Row = { name: string; status: "pass" | "fail" | "expected-fail" | "stale-expected-fail"; runs: number; counterexample?: string; reason?: string };
const rows: Row[] = [];
for (const P of PROPS) {
  test(P.name, () => {
    // An interrupted run (slow box) counts as a failure, never as a silent pass on fewer cases.
    const r = fc.check(fc.property(P.arb, (x) => P.check(x)), { seed: SEED, numRuns: RUNS, interruptAfterTimeLimit: 120_000, markInterruptAsFailure: true });
    const allow = allowed.find((a) => a.name === P.name && a.reason?.trim());
    const ce = r.failed && r.counterexample ? (r.counterexample[0] as { prompt: string }).prompt : undefined;
    const status: Row["status"] = r.failed ? (allow ? "expected-fail" : "fail") : allow ? "stale-expected-fail" : "pass";
    rows.push({ name: P.name, status, runs: r.numRuns, ...(ce ? { counterexample: ce } : {}), ...(allow ? { reason: allow.reason } : {}) });
    if (status === "expected-fail") console.log(`# expected-fail: ${P.name} — e.g. "${ce}" (${allow!.reason})`);
    if (status === "stale-expected-fail") console.log(`# STALE expected-fail: ${P.name} now passes — remove it from evals/props-allow.json`);
    if (status === "fail") assert.fail(r.interrupted ? `${P.name}: interrupted after ${r.numRuns}/${RUNS} runs (time limit)` : `${P.name}: counterexample "${ce}" (seed ${SEED}; shrunk after ${r.numShrinks} steps)`);
  });
}
test.after(() => {
  const out = { seed: SEED, runs: RUNS, properties: rows };
  if (process.env.PROPS_OUT) writeFileSync(process.env.PROPS_OUT, stable(out));
  if (process.env.PROPS_WRITE_REGRESSIONS === "1") {
    const prompts = rows.filter((r) => r.counterexample).map((r) => ({ id: `prop:${r.name}`, prompt: r.counterexample!, note: `shrunk counterexample, fast-check seed ${SEED}${r.reason ? `; ${r.reason}` : ""}` }));
    writeFileSync(join(HEAD_ROOT, "evals/corpus/props-regressions.json"), stable({ source: "props-regressions", note: "Shrunk failing cases from scripts/props.test.ts (PROPS_WRITE_REGRESSIONS=1). Graded by the eval gate like any other corpus prompt.", prompts }));
  }
});
