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
import { chooseBuildPrompt } from "./aiReader/rewrite";

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
