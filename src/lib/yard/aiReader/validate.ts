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
/** A quote that is only part of a typed measurement ("20 cm" of "1 m 20 cm", "8 m" of "1,8 m", "2 m" of "2 m x 60 cm", "4 ft" of "4 ft 30 wide"). */
const UNIT_WORD = String.raw`(?:cm|mm|m|in|inch(?:es)?|ft|feet|foot|yards?|"|'|(?:centi|milli)?met(?:er|re)s?)`;
// A number (and its unit) just before the quote, alone or joined by a separator or a joining word ("1 metre 20 cm",
// "60 and 80 cm", "60—80 cm", "80 cm & 40 cm", "2 times 80 cm"), or a separator alone.
const PART_BEFORE = new RegExp(String.raw`(?:\d\s*${UNIT_WORD}?\s*(?:[,×*~–—&;\/+-]|\b(?:x|by|to|and|or|plus|times)\b)?|[,×*~–—-]|\b(?:x|by|to))\s*$`);
const PART_AFTER = /^\s*(?:\d|[,×*~–-]|(?:x|by|to)\b|x(?=\d))/;
const partOfMeasurement = (prompt: string, q: string) => {
  const P = norm(prompt), i = quoteAt(prompt, q), rest = P.slice(i + norm(q).length);
  const axisEnds = /\b(?:wide|width|deep|depth|tall|high|height|long|length)$/.test(norm(q)) || AXIS_AFTER.test(rest); // "90cm wide 6 ft tall": a new size follows
  // A signed number ("-2 m tall") is not a size: drop it rather than lose the sign (row 482).
  return /^[-−–~+]/.test(norm(q)) || PART_BEFORE.test(P.slice(0, i)) || (!axisEnds && PART_AFTER.test(rest));
};
/** Every axis word or letter typed for an axis ("30 wide", "width 30", "W 30"), outside this quote and its own axis word. */
const AXIS_WORDS: Record<string, RegExp> = { W: /\b(?:wide|width)\b|\bw\s*[:=]?\s*\d|\d\s*w\b/g, D: /\b(?:deep|depth)\b|\bd\s*[:=]?\s*\d|\d\s*d\b/g, H: /\b(?:tall|high|height)\b|\bh\s*[:=]?\s*\d|\d\s*h\b/g, L: /\b(?:long|length)\b|\bl\s*[:=]?\s*\d|\d\s*l\b/g };
const axisNamedElsewhere = (prompt: string, s: ReaderSize) => {
  const P = norm(prompt), i = quoteAt(prompt, s.quote), end = i + norm(s.quote).length;
  const after = P.slice(end).match(AXIS_AFTER)?.[0].length ?? 0;
  const rest = P.slice(0, i) + " # " + P.slice(end + after);
  return (rest.match(AXIS_WORDS[s.axis] ?? /$^/g) ?? []).length > 0;
};
/** An axis-less quote ("2 m") with an axis typed right beside it in other words: before it ("height 2 m", "W: 2 m"), or after
 * it past punctuation or as a letter or a synonym ("6 ft. tall", "2 m (tall)", "2 m H", "60 cm front to back", "1 m diameter"). */
const CUE = String.raw`(?:\b(?:wide|width|deep|depth|tall|high|height|long|length|across|diameter|thick(?:ness)?|front to back|side to side)\b|\b[whdl]\b)`;
const CUE_BEFORE = new RegExp(String.raw`${CUE}\s*(?:[:=]|\b(?:of|is|at)\b)?\s*$`);
const CUE_AFTER = new RegExp(String.raw`^\s*[.,;:()\[\]–—-]*\s*(?:(?:inches|inch|in|"|ft|feet|foot)\b\.?\s*)?[.,;:()\[\]–—-]*\s*${CUE}`);
const axisCueBeside = (prompt: string, s: ReaderSize) => {
  if (NAMED.some(([re]) => re.test(s.quote)) || typedAxisAfter(prompt, s.quote)) return false;
  const P = norm(prompt), i = quoteAt(prompt, s.quote);
  return CUE_BEFORE.test(P.slice(0, i)) || CUE_AFTER.test(P.slice(i + norm(s.quote).length));
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

/**
 * The allow-list (r5): a metric or feet quote is used only when its measurement run is plain labelled sizes. A run is
 * the stretch of numbers, units, axis words, punctuation and measurement words ("x", "and", "to", "W", "across"...)
 * around the quote. It must split into segments `NUM [UNIT] [NUM in] AXIS`, with nothing else in it. The quote must
 * be one whole segment, and an axis-less quote must be the whole run. Its axis must not be typed anywhere else. Any
 * other phrasing (joiners, ranges, letters, parentheses, synonyms) is the parser's to read: no rewrite.
 */
const TOK = /\d+(?:\.\d+)?|[a-z]+|[^\sa-z\d]/g;
const UNIT_TOKEN = /^(?:cm|mm|m|centimet(?:er|re)s?|millimet(?:er|re)s?|met(?:er|re)s?|ft|feet|foot|in|inch(?:es)?|"|'|″|′)$/;
const AXIS_TOKEN: Record<string, string[]> = { wide: ["W"], width: ["W"], deep: ["D"], depth: ["D"], tall: ["H"], high: ["H"], height: ["H"], long: ["W", "L"], length: ["W", "L"] };
const LETTER_AXIS: Record<string, string> = { w: "W", d: "D", h: "H", l: "L" };
const RUN_WORD = /^(?:x|by|to|and|or|plus|times|between|of|at|is|from|about|approx|around|w|h|d|l|across|diameter|thick|thickness|front|back|side|wall|floor|ceiling)$/;
type Tok = { t: string; at: number; end: number; k: "num" | "unit" | "axis" | "run" | "word" };
const tokens = (p: string): Tok[] => [...p.matchAll(TOK)].map((m) => {
  const t = m[0];
  const k = /^\d/.test(t) ? "num" : UNIT_TOKEN.test(t) ? "unit" : t in AXIS_TOKEN ? "axis" : /^[a-z]/.test(t) && !RUN_WORD.test(t) ? "word" : "run";
  return { t, at: m.index!, end: m.index! + t.length, k };
});
export const soleSize = (prompt: string, s: ReaderSize): boolean => {
  const P = norm(prompt), i = quoteAt(prompt, s.quote);
  if (i < 0) return false;
  const T = tokens(P), end = i + norm(s.quote).length;
  const qi = T.findIndex((x) => x.at === i), qe = T.findIndex((x) => x.end === end);
  if (qi < 0 || qe < qi) return false;
  let a = qi, b = qe;
  while (a > 0 && T[a - 1].k !== "word") a--;
  while (b < T.length - 1 && T[b + 1].k !== "word") b++;
  // Split the run into segments NUM [UNIT] [NUM in] [AXIS]; an axis word closes a segment.
  const segs: [number, number][] = [];
  // A number with its fraction: "11", "11 1/2", "1/2".
  const num = (j: number) => {
    if (j > b || T[j].k !== "num") return -1;
    if (j + 3 <= b && T[j + 1].k === "num" && T[j + 2].t === "/" && T[j + 3].k === "num") return j + 4;
    if (j + 2 <= b && T[j + 1].t === "/" && T[j + 2].k === "num") return j + 3;
    return j + 1;
  };
  for (let j = a; j <= b; ) {
    let k = num(j);
    if (k < 0) return false;
    if (k <= b && T[k].k === "unit") k++;
    const inch = num(k);
    if (inch > 0 && inch <= b && /^(?:ft|feet|foot|')$/.test(T[k - 1].t) && parseFloat(T[k].t) < 12 && /^(?:in|inch(?:es)?|"|″)$/.test(T[inch].t)) k = inch + 1;
    if (k <= b && T[k].k === "axis") k++;
    else if (k <= b) return false; // a second number, a joiner or punctuation before this size is closed
    segs.push([j, k - 1]);
    j = k;
  }
  const seg = segs.find(([x]) => x === qi);
  if (!seg || qe < (T[seg[1]].k === "axis" ? seg[1] - 1 : seg[1]) || qe > seg[1]) return false;
  if (T[seg[1]].k !== "axis" && segs.length !== 1) return false;
  // The quote's axis is typed nowhere else: not as a word, nor as a letter with its number ("W 30", "w=30", "30w").
  const own = T[seg[1]].k === "axis" ? seg[1] : -1;
  const letter = (j: number) => LETTER_AXIS[T[j].t] === s.axis && (T[j - 1]?.k === "num" || T[j + 1]?.k === "num" || (/^[:=]$/.test(T[j + 1]?.t ?? "") && T[j + 2]?.k === "num"));
  return !T.some((x, j) => (j !== own && x.k === "axis" && AXIS_TOKEN[x.t].includes(s.axis)) || letter(j));
};
const ALLOW_UNITS = new Set(["cm", "mm", "m", "ft"]);

export function validateSpec(prompt: string, raw: unknown, opts: { allowList?: boolean } = {}): { spec: ReaderSpec; dropped: string[] } {
  const dropped: string[] = [];
  const spec: ReaderSpec = { sizes: [], counts: [] };
  const r = (raw && typeof raw === "object" ? raw : {}) as { sizes?: unknown; counts?: unknown };
  for (const s of (Array.isArray(r.sizes) ? r.sizes : []) as ReaderSize[]) {
    const where = `size "${s?.quote}"`;
    if (s?.assumed !== false || !quoted(prompt, s.quote)) { dropped.push(`${where}: assumed or not in the request`); continue; }
    if (!AXES.includes(s.axis) || !UNITS.includes(s.unit) || !OF.includes(s.of) || AGE.test(s.quote) || !axisFits(s) || !nextAxisFits(prompt, s) || partOfMeasurement(prompt, s.quote) || axisNamedElsewhere(prompt, s) || axisCueBeside(prompt, s)) { dropped.push(`${where}: bad axis/unit/of, an age, or another axis's word`); continue; }
    if (!sizeOnlyQuote(s.quote) || !UNIT_OK[quoteUnit(s.quote)].includes(s.unit)) { dropped.push(`${where}: holds a non-size word, or its unit is not the one typed`); continue; }
    if (opts.allowList !== false && ALLOW_UNITS.has(quoteUnit(s.quote)) && !soleSize(prompt, s)) { dropped.push(`${where}: not one plain labelled size (the allow-list)`); continue; }
    const inches = Number(s.inches);
    if (!(inches > 0) || !inchCandidates(s.quote).some((c) => Math.abs(c - inches) <= 1 / 32)) { dropped.push(`${where}: ${s.inches}" is not a number in its quote`); continue; }
    spec.sizes.push({ axis: s.axis, value: Number(s.value), unit: s.unit, inches, of: s.of, quote: s.quote, confidence: clamp01(s.confidence), assumed: false });
  }
  for (const c of (Array.isArray(r.counts) ? r.counts : []) as ReaderCount[]) {
    const where = `count "${c?.quote}"`;
    if (c?.assumed !== false || !quoted(prompt, c.quote) || !COUNT_THINGS.includes(c.thing) || !Number.isInteger(c.n)) { dropped.push(`${where}: unquoted, assumed or malformed`); continue; }
    const prev = norm(prompt).slice(0, quoteAt(prompt, c.quote)).trim().split(/[\s-]+/).pop() ?? "";
    if (new RegExp(String.raw`^(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen|and|\d+(?:\.\d+)?|${Object.keys(WORDS).join("|")})$`).test(prev)) { dropped.push(`${where}: part of a larger typed number`); continue; }
    const noun = NOUN[c.thing];
    // The noun typed twice ("six small drawers, the top two drawers", "drawers x6 ... two drawers", "a dozen drawers ... two drawers"): which number counts is the parser's call.
    if (noun && (norm(prompt).match(new RegExp(`\\b${noun}\\b`, "g")) ?? []).length > 1) { dropped.push(`${where}: that thing is typed more than once`); continue; }
    if (typedCount(c.quote, c.thing) !== c.n) { dropped.push(`${where}: ${c.n} ${c.thing} is not typed next to its noun`); continue; }
    spec.counts.push({ thing: c.thing, n: c.n, quote: c.quote, confidence: clamp01(c.confidence), assumed: false });
  }
  return { spec, dropped };
}
