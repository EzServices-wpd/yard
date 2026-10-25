/**
 * The reader's reply is untrusted: every entry must quote the person's words verbatim. A size quote holds only numbers,
 * units, separators and axis words (never the object's noun), and its inches must be a number in the quote converted
 * once by the unit the quote itself names (cm, mm, m or feet; a bare or inch number is taken as typed, never converted).
 * A count quote is exactly "<number> <noun of that thing>" ("two drawers", "3-drawer"). Anything else is dropped, so
 * the regex path decides it exactly as today.
 */
import { AXES, COUNT_THINGS, OF, UNITS, type ReaderCount, type ReaderSize, type ReaderSpec } from "./spec";

export const norm = (s: string) => s.toLowerCase().replace(/[“”″]/g, '"').replace(/[‘’′]/g, "'").replace(/\s+/g, " ").trim();
/** Where the quote stands in the prompt as whole words (not inside "twenty-one" or "12 ft"), or -1. */
export function quoteAt(prompt: string, q: string): number {
  const P = norm(prompt), Q = norm(q);
  if (!Q) return -1;
  for (let i = P.indexOf(Q); i >= 0; i = P.indexOf(Q, i + 1)) {
    const before = P[i - 1] ?? " ", after = P[i + Q.length] ?? " ";
    if (!/[a-z0-9.\/-]/.test(before) && !/[a-z0-9.\/]/.test(after)) return i;
  }
  return -1;
}
const quoted = (prompt: string, q: unknown) => typeof q === "string" && q.trim().length > 0 && quoteAt(prompt, q) >= 0;
/** The axis word typed right after the quote ("6 ft" + " tall"), if any: a size quoted without it keeps that axis. */
const AXIS_AFTER = /^\s*(?:inches|inch|in|"|ft|feet|foot)?\s*(wide|width|deep|depth|tall|high|height|long|length)\b/;
/** The axis word typed right after the quote, or null. */
export const typedAxisAfter = (prompt: string, quote: string): string | null => {
  const i = quoteAt(prompt, quote);
  return i < 0 ? null : (norm(prompt).slice(i + norm(quote).length).match(AXIS_AFTER)?.[1] ?? null);
};
const nextAxisFits = (prompt: string, s: ReaderSize) => {
  const w = typedAxisAfter(prompt, s.quote);
  return !w || NAMED.find(([re]) => re.test(w))![1].includes(s.axis);
};
const WORDS: Record<string, number> = { one: 1, single: 1, two: 2, pair: 2, dual: 2, double: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const clamp01 = (x: unknown) => (typeof x === "number" && x >= 0 && x <= 1 ? x : 0);
const AGE = /\b(?:year|yr|month)s?\b|\bold\b/i;
const NAMED: [RegExp, string[]][] = [[/\b(?:wide|width)\b/i, ["W"]], [/\b(?:deep|depth)\b/i, ["D"]], [/\b(?:tall|high|height)\b/i, ["H"]], [/\b(?:long|length)\b/i, ["W", "L"]]];
/** A quote that names one axis in words ("31.5 wide") is a size on that axis only. */
const axisFits = (s: ReaderSize) => { const named = NAMED.filter(([re]) => re.test(s.quote)); return named.length !== 1 || named[0][1].includes(s.axis); };

const NUM = /(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\/(\d+))?|(\d+)\/(\d+)/g;
const fracs = (q: string) => norm(q).replace(/½/g, " 1/2").replace(/¼/g, " 1/4").replace(/¾/g, " 3/4");
/** The unit the quote's own words name; a bare number or in/inch/" is inches. */
export function quoteUnit(quote: string): "cm" | "mm" | "m" | "ft" | "in" {
  const q = norm(quote);
  if (/\d\s*(?:cm|centimet(?:er|re)s?)\b/.test(q)) return "cm";
  if (/\d\s*(?:mm|millimet(?:er|re)s?)\b/.test(q)) return "mm";
  if (/\d\s*(?:m|met(?:er|re)s?)\b/.test(q)) return "m";
  if (/\b(?:ft|feet|foot)\b|['′]/.test(q)) return "ft";
  return "in";
}
const UNIT_OK: Record<ReturnType<typeof quoteUnit>, string[]> = { cm: ["cm"], mm: ["mm"], m: ["m"], ft: ["ft", "ft-in"], in: ["in", "none"] };
const FACTOR = { cm: 1 / 2.54, mm: 1 / 25.4, m: 100 / 2.54, ft: 12, in: 1 };
/** Numbers, units, separators and axis words only: a quote that holds another word (the object's noun) sizes nothing. */
const SIZE_TOKENS = /\b(?:cm|mm|m|centimet(?:er|re)s?|millimet(?:er|re)s?|met(?:er|re)s?|in|inch(?:es)?|ft|feet|foot|x|by|wide|width|deep|depth|tall|high|height|long|length|w|d|h|l)\b|[×*"″'′,\-]/g;
export const sizeOnlyQuote = (quote: string) => fracs(quote).replace(NUM, " ").replace(SIZE_TOKENS, " ").trim() === "";

/** Every number the quote could mean, in inches, converted once by the quote's own unit (feet: also feet-inches). */
export function inchCandidates(quote: string): number[] {
  const nums: number[] = [];
  for (const m of fracs(quote).matchAll(NUM)) nums.push(m[4] ? +m[4] / +m[5] : +m[1] + (m[2] ? +m[2] / +m[3] : 0));
  const unit = quoteUnit(quote);
  const out = new Set(nums.map((n) => n * FACTOR[unit]));
  if (unit === "ft") for (let i = 0; i + 1 < nums.length; i++) out.add(nums[i] * 12 + nums[i + 1]);
  return [...out];
}

const NOUN: Partial<Record<(typeof COUNT_THINGS)[number], string>> = { drawers: "drawers?", doors: "doors?", shelves: "shel(?:f|ves)", rods: "rods?", steps: "steps?", bins: "bins?", legs: "legs?", seats: "seats?", tiers: "tiers?", bays: "bays?", cubbies: "cubb(?:y|ies)", hooks: "hooks?", pieces: "pieces?" };
/** The count typed right next to its own noun: "two drawers", "3-drawer", "pair of doors". Anything else → null. */
export function typedCount(quote: string, thing: (typeof COUNT_THINGS)[number]): number | null {
  const noun = NOUN[thing];
  const m = noun ? norm(quote).match(new RegExp(`^(\\d+|${Object.keys(WORDS).join("|")})(?:\\s+of)?[\\s-]+${noun}$`)) : null;
  return m ? (/\d/.test(m[1]) ? +m[1] : WORDS[m[1]]) : null;
}

export function validateSpec(prompt: string, raw: unknown): { spec: ReaderSpec; dropped: string[] } {
  const dropped: string[] = [];
  const spec: ReaderSpec = { sizes: [], counts: [] };
  const r = (raw && typeof raw === "object" ? raw : {}) as { sizes?: unknown; counts?: unknown };
  for (const s of (Array.isArray(r.sizes) ? r.sizes : []) as ReaderSize[]) {
    const where = `size "${s?.quote}"`;
    if (s?.assumed !== false || !quoted(prompt, s.quote)) { dropped.push(`${where}: assumed or not in the request`); continue; }
    if (!AXES.includes(s.axis) || !UNITS.includes(s.unit) || !OF.includes(s.of) || AGE.test(s.quote) || !axisFits(s) || !nextAxisFits(prompt, s)) { dropped.push(`${where}: bad axis/unit/of, an age, or another axis's word`); continue; }
    if (!sizeOnlyQuote(s.quote) || !UNIT_OK[quoteUnit(s.quote)].includes(s.unit)) { dropped.push(`${where}: holds a non-size word, or its unit is not the one typed`); continue; }
    const inches = Number(s.inches);
    if (!(inches > 0) || !inchCandidates(s.quote).some((c) => Math.abs(c - inches) <= 1 / 32)) { dropped.push(`${where}: ${s.inches}" is not a number in its quote`); continue; }
    spec.sizes.push({ axis: s.axis, value: Number(s.value), unit: s.unit, inches, of: s.of, quote: s.quote, confidence: clamp01(s.confidence), assumed: false });
  }
  for (const c of (Array.isArray(r.counts) ? r.counts : []) as ReaderCount[]) {
    const where = `count "${c?.quote}"`;
    if (c?.assumed !== false || !quoted(prompt, c.quote) || !COUNT_THINGS.includes(c.thing) || !Number.isInteger(c.n)) { dropped.push(`${where}: unquoted, assumed or malformed`); continue; }
    const prev = norm(prompt).slice(0, quoteAt(prompt, c.quote)).trim().split(/[\s-]+/).pop() ?? "";
    if (/^(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen|and|\d+(?:\.\d+)?)$/.test(prev)) { dropped.push(`${where}: part of a larger typed number`); continue; }
    if (typedCount(c.quote, c.thing) !== c.n) { dropped.push(`${where}: ${c.n} ${c.thing} is not typed next to its noun`); continue; }
    spec.counts.push({ thing: c.thing, n: c.n, quote: c.quote, confidence: clamp01(c.confidence), assumed: false });
  }
  return { spec, dropped };
}
