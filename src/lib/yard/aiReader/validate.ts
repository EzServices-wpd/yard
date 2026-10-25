/**
 * The reader's reply is untrusted: every entry must quote the person's words verbatim, every size must be a conversion
 * of a number in its own quote, and every count must have its number in the quote. Anything else is dropped, so the
 * regex path decides it exactly as today.
 */
import { AXES, COUNT_THINGS, OF, UNITS, type ReaderCount, type ReaderSize, type ReaderSpec } from "./spec";

export const norm = (s: string) => s.toLowerCase().replace(/[“”″]/g, '"').replace(/[‘’′]/g, "'").replace(/\s+/g, " ").trim();
const quoted = (prompt: string, q: unknown) => typeof q === "string" && q.trim().length > 0 && norm(prompt).includes(norm(q));
const WORDS: Record<string, number> = { one: 1, a: 1, single: 1, two: 2, pair: 2, dual: 2, double: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const clamp01 = (x: unknown) => (typeof x === "number" && x >= 0 && x <= 1 ? x : 0);
const AGE = /\b(?:year|yr|month)s?\b|\bold\b/i;
const NAMED: [RegExp, string[]][] = [[/\b(?:wide|width)\b/i, ["W"]], [/\b(?:deep|depth)\b/i, ["D"]], [/\b(?:tall|high|height)\b/i, ["H"]], [/\b(?:long|length)\b/i, ["W", "D", "L"]]];
/** A quote that names one axis in words ("31.5 wide") is a size on that axis only. */
const axisFits = (s: ReaderSize) => { const named = NAMED.filter(([re]) => re.test(s.quote)); return named.length !== 1 || named[0][1].includes(s.axis); };

/** Every number the quote could mean, in inches: plain, mixed fraction, feet-inches, and each unit conversion. */
export function inchCandidates(quote: string): number[] {
  const q = norm(quote).replace(/½/g, " 1/2").replace(/¼/g, " 1/4").replace(/¾/g, " 3/4");
  const nums: number[] = [];
  for (const m of q.matchAll(/(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\/(\d+))?|(\d+)\/(\d+)/g)) nums.push(m[4] ? +m[4] / +m[5] : +m[1] + (m[2] ? +m[2] / +m[3] : 0));
  const out = new Set<number>();
  for (const n of nums) for (const f of [1, 12, 1 / 2.54, 1 / 25.4]) out.add(n * f);
  for (let i = 0; i + 1 < nums.length; i++) out.add(nums[i] * 12 + nums[i + 1]);
  if (nums.length >= 3) out.add(nums[0] * 12 + nums[1] + nums[2]);
  return [...out];
}

export function validateSpec(prompt: string, raw: unknown): { spec: ReaderSpec; dropped: string[] } {
  const dropped: string[] = [];
  const spec: ReaderSpec = { sizes: [], counts: [] };
  const r = (raw && typeof raw === "object" ? raw : {}) as { sizes?: unknown; counts?: unknown };
  for (const s of (Array.isArray(r.sizes) ? r.sizes : []) as ReaderSize[]) {
    const where = `size "${s?.quote}"`;
    if (s?.assumed !== false || !quoted(prompt, s.quote)) { dropped.push(`${where}: assumed or not in the request`); continue; }
    if (!AXES.includes(s.axis) || !UNITS.includes(s.unit) || !OF.includes(s.of) || AGE.test(s.quote) || !axisFits(s)) { dropped.push(`${where}: bad axis/unit/of, an age, or another axis's word`); continue; }
    const inches = Number(s.inches);
    if (!(inches > 0) || !inchCandidates(s.quote).some((c) => Math.abs(c - inches) <= 1 / 32)) { dropped.push(`${where}: ${s.inches}" is not a number in its quote`); continue; }
    spec.sizes.push({ axis: s.axis, value: Number(s.value), unit: s.unit, inches, of: s.of, quote: s.quote, confidence: clamp01(s.confidence), assumed: false });
  }
  for (const c of (Array.isArray(r.counts) ? r.counts : []) as ReaderCount[]) {
    const where = `count "${c?.quote}"`;
    if (c?.assumed !== false || !quoted(prompt, c.quote) || !COUNT_THINGS.includes(c.thing) || !Number.isInteger(c.n)) { dropped.push(`${where}: unquoted, assumed or malformed`); continue; }
    const q = norm(c.quote);
    const said = [...q.matchAll(/\d+/g)].map((m) => +m[0]).concat(Object.entries(WORDS).filter(([w]) => new RegExp(`\\b${w}\\b`).test(q)).map(([, n]) => n));
    if (!said.includes(c.n)) { dropped.push(`${where}: ${c.n} is not typed in its quote`); continue; }
    spec.counts.push({ thing: c.thing, n: c.n, quote: c.quote, confidence: clamp01(c.confidence), assumed: false });
  }
  return { spec, dropped };
}
