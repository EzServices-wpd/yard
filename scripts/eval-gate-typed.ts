/**
 * Typed-word truth for the eval gate: what the person typed, read with no help from the engine's own parser.
 * Sizes (mixed, unicode and hyphen fractions, decimals, feet-inches, W×D×H strings), counts, features,
 * materials, finish and budget. The honor check compares these to the finished build, so this file must
 * never import the engine: an engine parser bug (e.g. "24 1/2" read as 2) has to show up as a miss.
 * Rules ported from /workspace/grok-intake-ab (engine.ts honor + validate; analyze.py grading).
 */
export type Axis = "W" | "D" | "H" | "L" | "DIAM" | "unknown";
export type Size = { axis: Axis; value_in: number; quote: string };
export type Count = { thing: string; n: number; quote: string };
export type Said = { value: string; quote: string };
export type Demands = {
  head_noun: Said | null;
  sizes: Size[];
  counts: Count[];
  features: Said[];
  budget: { max_usd: number | null; quote: string } | null;
  material: Said[];
  finish: Said[];
};

const lc = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const UNI: Record<string, number> = { "½": 1 / 2, "¼": 1 / 4, "¾": 3 / 4, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8, "⅓": 1 / 3, "⅔": 2 / 3, "⅙": 1 / 6, "⅚": 5 / 6 };
const FR = "[½¼¾⅛⅜⅝⅞⅓⅔⅙⅚]";
/** One inch-number: 24, 24.5, 24 1/2, 24-1/2, 24½, 1/2, ½. */
const NUM = `(?:\\d+(?:\\.\\d+)?(?:(?:\\s+|-)\\d+\\/\\d+(?![\\d/])|\\s?${FR})?|\\d+\\/\\d+|${FR})`;
const IN_U = `(?:"|”|″|''|in\\b\\.?|inch(?:es)?\\b)`;
const FT_U = `(?:'|’|′|ft\\b\\.?|feet\\b|foot\\b)`;
const UNIT = `(?:${IN_U}|${FT_U}|cm\\b|mm\\b)`;
/** A length: feet with optional inches (2' 6", 2 ft 6 in, 2' 1/2"), or a number with an optional unit. */
const LEN = `(?:${NUM}\\s*${FT_U}(?:\\s*-?\\s*${NUM}\\s*${IN_U})?|${NUM}(?:\\s*${UNIT})?)`;

/** Inches from one number token (no unit). */
export function numberIn(tok: string): number {
  const t = tok.trim();
  let m = t.match(/^(\d+(?:\.\d+)?)(?:\s+|-)(\d+)\/(\d+)$/);
  if (m) return +m[1] + +m[2] / +m[3];
  m = t.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s?(${FR})$`));
  if (m) return +m[1] + UNI[m[2]];
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return +m[1] / +m[2];
  if (t in UNI) return UNI[t];
  return Number(t);
}
/** Inches from a length quote: "2' 6\"" = 30, "2 ft 6 in" = 30, "24 1/2\"" = 24.5, "3 ft" = 36, "61 cm" = 24.0. */
export function lengthIn(q: string): number {
  const s = q.trim();
  const ft = s.match(new RegExp(`^(${NUM})\\s*${FT_U}(?:\\s*-?\\s*(${NUM})\\s*${IN_U})?$`));
  if (ft) return numberIn(ft[1]) * 12 + (ft[2] ? numberIn(ft[2]) : 0);
  const m = s.match(new RegExp(`^(${NUM})\\s*(${UNIT})?$`));
  if (!m) return NaN;
  const v = numberIn(m[1]);
  const u = (m[2] ?? "").toLowerCase();
  if (/^(?:'|’|′|ft|feet|foot)/.test(u)) return v * 12;
  if (u === "cm") return v / 2.54;
  if (u === "mm") return v / 25.4;
  return v;
}
const hasUnit = (q: string) => new RegExp(`${UNIT}\\s*$|${FT_U}`).test(q);

const AXIS_WORD: [RegExp, Axis][] = [
  [/^(?:wide|width|w)$/, "W"], [/^(?:long|length|l)$/, "L"], [/^(?:tall|high|height|h)$/, "H"], [/^(?:deep|depth|d)$/, "D"], [/^(?:across|diameter|dia|round)$/, "DIAM"],
];
const axisOf = (w: string): Axis => AXIS_WORD.find(([re]) => re.test(w.toLowerCase()))?.[1] ?? "unknown";
/** Numbers that size something else (the gap, the TV, the knee space, the stock), not the build. */
const FIT_BEFORE = /\b(?:for|fits?|fitting|under(?:neath)?|between|into|in|beside|next to|over|holds?|holding|than|from|of|with|out of|behind|around)\s+(?:a|an|the|my|our|two|2)?\s*$/i;
const FIT_AFTER = /^\s*(?:gap|nook|alcove|window|ceiling|screen|tv|television|record|opening|space|knee|seat|mattress|monitor|bottles?|jars?|wall|door(?:way)?|dowels?|plywood|ply|pipe|pvc|boards?|stock|sticks?|planks?|lumber|square|tile|pot|planter|cat|dog|year|yr|month|kid|child|hen|chicken)/i;
const FEET_NOUN = /\b(?:bed|coop|pergola|compost|garden|deck|shed|patio|rug|run|pen|greenhouse|gazebo|playhouse|fence)\b/;
const BED_SIZE = /\b(?:platform|twin|queen|king|bunk|full|crib|daybed|loft)\b/;
const LUMBER = /^(?:1|2|4|6)x(?:2|3|4|6|8|10|12)s?$/i;

/** Every typed size in a prompt, with its axis when one was typed. Order of a W×D×H string is width, depth, height. */
export function typedSizes(prompt: string): Size[] {
  const out: Size[] = [];
  const used: [number, number][] = [];
  const free = (a: number, b: number) => !used.some(([x, y]) => a < y && b > x);
  const take = (a: number, b: number) => used.push([a, b]);
  const p = prompt;
  // 1) W×D×H / W×D strings.
  const triple = new RegExp(`(${LEN})\\s*(?:x|×|\\*|by)\\s*(${LEN})(?:\\s*(?:x|×|\\*|by)\\s*(${LEN}))?(?![\\w/])`, "gi");
  for (const m of p.matchAll(triple)) {
    const a = m.index!, b = a + m[0].length;
    if (!free(a, b) || /\d/.test(p[a - 1] ?? "") || /[\w/]/.test(p[a - 1] ?? "")) continue;
    const parts = [m[1], m[2], m[3]].filter(Boolean) as string[];
    if (parts.length === 2 && LUMBER.test(m[0].replace(/\s+/g, ""))) {
      const lumberish = /\b(?:from|of|out of|made|using|with)\s*(?:\w+\s){0,2}$/i.test(p.slice(0, a)) || /^s\b/.test(p.slice(b)) || !FEET_NOUN.test(lc(p));
      if (lumberish) { take(a, b); continue; }
    }
    take(a, b);
    if (parts.length === 3) {
      parts.forEach((q, i) => out.push({ axis: (["W", "D", "H"] as Axis[])[i], value_in: lengthIn(q), quote: m[0].trim() }));
    } else {
      const ft = parts.every((q) => !hasUnit(q) && lengthIn(q) <= 20) && FEET_NOUN.test(lc(p)) && !BED_SIZE.test(lc(p));
      for (const q of parts) out.push({ axis: "unknown", value_in: lengthIn(q) * (ft ? 12 : 1), quote: m[0].trim() });
    }
  }
  // 2) "width 24" / "height: 30".
  for (const m of p.matchAll(new RegExp(`\\b(width|length|height|depth)\\s*(?:of|:|=|is)?\\s*(${LEN})`, "gi"))) {
    const a = m.index!, b = a + m[0].length;
    if (!free(a, b)) continue;
    take(a, b);
    out.push({ axis: axisOf(m[1] === "width" ? "wide" : m[1] === "length" ? "long" : m[1] === "height" ? "tall" : "deep"), value_in: lengthIn(m[2]), quote: m[0].trim() });
  }
  // 3) "24 1/2 wide", "2' 6\" tall", "30-in deep", "8 ft long", "12 in diameter".
  for (const m of p.matchAll(new RegExp(`(?<![\\w/.])(${LEN})\\s*-?\\s*(?:in\\s+)?(wide|width|long|length|tall|high|height|deep|depth|across|diameter|dia|round)\\b`, "gi"))) {
    const a = m.index!, b = a + m[0].length;
    if (!free(a, b)) continue;
    take(a, b);
    out.push({ axis: axisOf(m[2]), value_in: lengthIn(m[1]), quote: m[0].trim() });
  }
  // 4) A bare length with a unit and no axis ("36 inch", "6 foot", "60\" desk"): any axis, unless it sizes something else.
  for (const m of p.matchAll(new RegExp(`(?<![\\w/.])(${NUM}\\s*${FT_U}(?:\\s*-?\\s*${NUM}\\s*${IN_U})?|${NUM}\\s*(?:${IN_U}|cm\\b|mm\\b))`, "gi"))) {
    const a = m.index!, b = a + m[0].length;
    if (!free(a, b)) continue;
    take(a, b);
    if (FIT_BEFORE.test(p.slice(Math.max(0, a - 24), a)) || FIT_AFTER.test(p.slice(b))) continue;
    if (/^\s*(?:-|\s)?\s*(?:seat|tread|rise|run|overhang|leg|shelf spacing|spacing|apart|thick|thickness|on center|o\.c\.)/i.test(p.slice(b))) continue;
    if (/^\s*(?:-\s*)?(?:step|tier|drawer|door|shelf|shelves|rod|bin)s?\b/i.test(p.slice(b))) continue;
    out.push({ axis: "unknown", value_in: lengthIn(m[1]), quote: m[0].trim() });
  }
  return out.filter((s) => Number.isFinite(s.value_in) && s.value_in > 0);
}

const NUMW: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, single: 1, double: 2, pair: 2, "a pair of": 2, "pair of": 2 };
const THING: [RegExp, string][] = [[/^drawers?$/, "drawers"], [/^doors?$/, "doors"], [/^(?:shelf|shelves)$/, "shelves"], [/^steps?$/, "steps"], [/^bins?$/, "bins"], [/^legs?$/, "legs"], [/^rods?$/, "rods"], [/^seats?$/, "seats"]];
export function typedCounts(prompt: string): Count[] {
  const out: Count[] = [];
  const re = /(?<![\w/.x×])(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a pair of|pair of)\s*(?:-\s*)?(drawers?|doors?|shelf|shelves|steps?|bins?|legs?|rods?|seats?)\b/gi;
  for (const m of prompt.matchAll(re)) {
    const raw = m[1].toLowerCase();
    const n = /^\d+$/.test(raw) ? +raw : NUMW[raw];
    const thing = THING.find(([r]) => r.test(m[2].toLowerCase()))?.[1];
    // "6 inch shelf" is a size, not a count; a number already read as a length is skipped by the caller.
    if (!thing || !n || n > 60) continue;
    if (!out.some((c) => c.thing === thing)) out.push({ thing, n, quote: m[0] });
  }
  return out;
}

const FEATURES: [RegExp, string][] = [
  [/\brolling\b|\bcasters?\b|\bon wheels\b|\bwith wheels\b/i, "rolling"], [/\bstorage\b/i, "storage"], [/\bdovetail(?:s|ed)?\b/i, "dovetail"], [/\bvise\b/i, "vise"],
  [/\bwall[- ]?(?:mounted|mount|hung|hanging)\b|\bon the wall\b|\bhangs? on (?:a|the) wall\b/i, "wall"], [/\bfold(?:ing|able|s)?\b|\bfold[- ](?:down|up)\b/i, "folding"],
  [/\bwith (?:\w+ )?(?:and )?doors?\b|\bdoored\b/i, "doors"], [/\bwith (?:\w+ )?(?:and )?drawers?\b/i, "drawers"], [/\bwith (?:\w+ )?(?:and )?(?:shelf|shelves)\b/i, "shelves"],
  [/\bwith (?:a )?lid\b|\blidded\b/i, "lid"], [/\boutdoors?\b|\bexterior\b/i, "outdoor"], [/\bcovered\b/i, "covered"],
];
const MATERIALS: [RegExp, string][] = [
  [/\bpopsicle\b|\bcraft sticks?\b/i, "popsicle"], [/\bpvc\b/i, "pvc"], [/\bcardboard\b/i, "cardboard"], [/\bwalnut\b/i, "walnut"], [/\bcedar\b/i, "cedar"],
  [/\b(?:half|full|quarter) (?:a )?sheet of (?:plywood|ply)\b/i, "plywood"], [/\b2x4s?\b|\b2×4s?\b/i, "2x4"], [/\b1x6s?\b|\b1×6s?\b/i, "1x6"], [/\bplywood\b|\bply\b/i, "plywood"], [/\b(?:white )?oak\b/i, "oak"], [/\bmaple\b/i, "maple"],
  [/\bpine\b/i, "pine"], [/\bcherry\b/i, "cherry"], [/\bbirch\b/i, "birch"], [/\bpoplar\b/i, "poplar"], [/\bredwood\b/i, "redwood"], [/\bmdf\b/i, "mdf"], [/\bbamboo\b/i, "bamboo"],
];
const GENERIC_HEAD = /^(?:something|somewhere|a place|place|organize|organizer|organizer for|storage for|holder|plants|a way|way|thing|stuff|help)\b/i;
const LEAD = /^(?:(?:a|an|the|my|simple|cheap|small|big|large|tiny|little|kids?|kid's|modern|rustic|easy|basic|nice|sturdy|wooden|wood|diy|custom|build me|build|make me|make|i want|i need)\s+)+/i;

/** The head noun: what is left once sizes, counts, stock and clauses are cut away ("walnut dresser 6 drawers 60 wide" → "dresser"). */
export function typedHeadNoun(prompt: string, spans: string[]): Said | null {
  let q = ` ${prompt} `;
  for (const s of [...spans].sort((a, b) => b.length - a.length)) q = q.replace(s, " ");
  q = q.replace(/\b(?:half|full|quarter|one)\s+(?:a\s+)?sheet\s+of\s+\w+/gi, " ");
  q = q.replace(/[,;:(].*$/, " ");
  q = q.replace(/\s(?:with|for|from|that|to|which|in|on|under|by|of|out of|made|using|so|and|about|as|at|into|over|between|than|holding|holds)\s.*$/i, " ");
  for (const [re] of MATERIALS) q = q.replace(re, " ");
  q = q.replace(/\b(?:painted|stained|black|white|natural|unfinished|grey|gray|red|blue|green)\b/gi, " ");
  q = q.replace(/\b(?:\d+(?:[./-]\d+)*|[½¼¾⅛⅜⅝⅞]|one|two|three|four|five|six|seven|eight|nine|ten)\b[-\s]*(?:drawers?|doors?|shelf|shelves|steps?|tiers?|bins?|legs?|rods?|seats?|platforms?)?\b/gi, " ");
  q = q.replace(/\b(?:inch(?:es)?|in|ft|feet|foot|wide|tall|high|deep|long)\b|["'”’″′x×]/gi, " ");
  q = lc(q).replace(/\b(?:pair|set|seat height|height|size)\b/g, " ").replace(/\s+/g, " ").replace(LEAD, "").trim();
  if (!q || GENERIC_HEAD.test(q) || !/[a-z]{3,}/.test(q)) return null;
  return { value: q, quote: q };
}

/** All typed demands, from rules only (the deterministic stand-in for a validated Grok spec). */
export function typedDemands(prompt: string): Demands {
  const sizes = typedSizes(prompt);
  const counts = typedCounts(prompt).filter((c) => !sizes.some((s) => s.quote.includes(c.quote)));
  const features: Said[] = [];
  for (const [re, value] of FEATURES) {
    const m = prompt.match(re);
    if (!m) continue;
    if (value === "doors" && counts.some((c) => c.thing === "doors")) continue;
    if (value === "drawers" && counts.some((c) => c.thing === "drawers")) continue;
    if (value === "shelves" && counts.some((c) => c.thing === "shelves")) continue;
    features.push({ value, quote: m[0] });
  }
  const material: Said[] = [];
  for (const [re, value] of MATERIALS) { const m = prompt.match(re); if (m) material.push({ value, quote: m[0] }); }
  const finish: Said[] = [];
  const f = prompt.match(/\b(?:painted\s+)?(black|white)\b/i);
  if (f) finish.push({ value: `painted ${f[1].toLowerCase()}`, quote: f[0] });
  const b = prompt.match(/\b(?:under|below|less than|max(?:imum)?|budget(?: of)?|for)\s*\$\s*(\d+(?:\.\d+)?)|\bunder\s+(\d+)\s*(?:dollars|bucks)\b/i);
  const budget = b ? { max_usd: +(b[1] ?? b[2]), quote: b[0] } : null;
  const spans = [...sizes.map((s) => s.quote), ...counts.map((c) => c.quote), ...features.map((x) => x.quote), ...(budget ? [budget.quote] : [])];
  return { head_noun: typedHeadNoun(prompt, spans), sizes: dedupeSizes(sizes), counts, features, budget, material, finish };
}
function dedupeSizes(s: Size[]): Size[] {
  const seen = new Set<string>();
  return s.filter((z) => { const k = `${z.axis}|${z.value_in}|${z.quote}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ---------- validation of a frozen Grok spec (ported from engine.ts validate): every field quotes the prompt ----------
const numsIn = (q: string) => [...q.matchAll(/\d+(?:\.\d+)?/g)].map((m) => +m[0]);
const countIn = (q: string): number | null => { const d = q.match(/\d+/); if (d) return +d[0]; const w = lc(q).split(/[^a-z]+/).find((x) => x in NUMW); return w ? NUMW[w] : null; };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateSpec(raw: any, prompt: string): Demands | null {
  if (!raw || typeof raw !== "object") return null;
  const P = lc(prompt);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quoted = (x: any) => x && typeof x.quote === "string" && x.quote.trim() && P.includes(lc(x.quote));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keep = (arr: any[] | undefined, extra?: (x: any) => boolean) => (arr ?? []).filter((x) => quoted(x) && (!extra || extra(x)));
  const sizes = keep(raw.sizes, (x) => {
    const ns = numsIn(x.quote);
    const ft = /\b(?:ft|foot|feet)\b|'/.test(x.quote) || (/^\d+\s*(x|by)\s*\d+$/.test(x.quote.trim()) && /bed|coop|pergola|compost|garden/.test(P) && !/platform|twin|queen|king/.test(P));
    return ns.some((n) => Math.abs(n - x.value_in) < 0.01 || (ft && Math.abs(n * 12 - x.value_in) < 0.01));
  }).map((x) => ({ axis: x.axis as Axis, value_in: x.value_in as number, quote: x.quote as string }));
  const counts = keep(raw.counts, (x) => countIn(x.quote) === x.n).map((x) => ({ thing: x.thing as string, n: x.n as number, quote: x.quote as string }));
  const said = (arr: unknown[] | undefined) => keep(arr as never).map((x: { value: string; quote: string }) => ({ value: x.value, quote: x.quote }));
  let budget = raw.budget && quoted(raw.budget) ? { max_usd: raw.budget.max_usd ?? null, quote: raw.budget.quote } : null;
  if (budget?.max_usd != null && !numsIn(budget.quote).includes(budget.max_usd)) budget = { ...budget, max_usd: null };
  return {
    head_noun: quoted(raw.head_noun) ? { value: raw.head_noun.value, quote: raw.head_noun.quote } : null,
    sizes, counts, features: said(raw.features), budget, material: said(raw.material), finish: said(raw.finish),
  };
}
