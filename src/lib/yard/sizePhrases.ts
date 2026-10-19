/**
 * Spec 006 C2 · size phrases. Size words are parsed and stripped BEFORE noun matching, then said back as plain typed
 * axes ("about knee high bench" → "bench 18 tall"), so every builder reads them the way it reads "18 tall".
 * Typed and phrase axes always win (I21: each holds within 1/2").
 */
export type Axis = "width" | "height" | "depth";
export type PhraseAxes = Partial<Record<Axis, number>>;

const BED_W: Record<string, number> = { twin: 39, "twin xl": 39, full: 54, double: 54, queen: 60, king: 76, "california king": 72 };
const TALL_FORMS = /\b(?:shel(?:f|ves|ving)|bookcase|bookshel(?:f|ves)|cabinet|pantry|wardrobe|armoire|ladder|hutch|locker)\b/;
const SEAT = /\b(?:stool|chair|seat)\b/;
const TABLE_LIKE = /\b(?:table|workbench|bench top|platform|island|counter)\b/;
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** The axes a prompt's size phrases set, and the prompt with those phrases replaced by plain typed axes. */
export function sizePhrases(prompt: string): { prompt: string; axes: PhraseAxes; phrases: string[] } {
  let s = ` ${prompt} `;
  const axes: PhraseAxes = {};
  const phrases: string[] = [];
  const typedAxis = (a: Axis) => new RegExp(`\\d\\s*(?:"|in(?:ch(?:es)?)?|ft|feet|foot|')?\\s*${a === "width" ? "wide" : a === "depth" ? "deep" : "(?:tall|high)"}\\b`, "i").test(prompt);
  const set = (re: RegExp, a: Axis, v: number | ((m: RegExpMatchArray) => number | null)) => {
    const m = s.match(re);
    if (!m) return;
    const val = typeof v === "number" ? v : v(m);
    s = s.replace(m[0], " ");
    if (val == null || typedAxis(a)) return; // a typed axis wins over a phrase
    if (axes[a] == null) { axes[a] = val; phrases.push(m[0].trim()); }
  };
  const lower = prompt.toLowerCase();
  const seat = SEAT.test(lower);
  set(/\b(?:about|around|roughly|approximately)?\s*knee[\s-]+high\b/i, "height", 18);
  set(/\b(?:about|around|roughly|approximately)?\s*waist[\s-]+high\b/i, "height", 36);
  set(/\b(?:about|around|roughly|approximately)?\s*chest[\s-]+high\b/i, "height", 48);
  set(/\b(?:about|around|roughly|approximately)?\s*counter[\s-]+(?:height|high)\b/i, "height", seat ? 25 : 36);
  set(/\b(?:about|around|roughly|approximately)?\s*bar[\s-]+(?:height|high)\b/i, "height", seat ? 30 : 42);
  set(/\b(?:about|around|roughly)?\s*as wide as an? (california king|twin xl|twin|full|double|queen|king)(?:[\s-]+size)?\s+bed\b/i, "width", (m) => BED_W[m[1].toLowerCase()]);
  const sheet = s.match(/\b(?:half|a half)(?:\s+an?)?[\s-]+(?:sheet of plywood|plywood sheet|sheet)\b|\b(?:a full|full|one|a)\s+(?:sheet of plywood|plywood sheet)\b/i);
  if (sheet) {
    const half = /half/i.test(sheet[0]);
    s = s.replace(sheet[0], " ");
    if (!typedAxis("width")) { axes.width = half ? 48 : 96; phrases.push(sheet[0].trim()); }
    if (TABLE_LIKE.test(lower) && !typedAxis("depth")) axes.depth = 48;
  }
  set(/\b(?:that )?fits? under an? (\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:high |tall )?window\b/i, "height", (m) => Number(m[1]));
  const tvM = s.match(/\b(?:that fits |for |to fit |fits )an? (\d{2,3})\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:tv|television)\b/i);
  const tvStand = !!tvM && /\b(?:stand|console|media)\b/.test(lower) && !/\btv\s+(?:stand|console)\b/.test(lower);
  set(/\b(?:that fits |for |to fit |fits )an? (\d{2,3})\s*(?:"|in(?:ch(?:es)?)?)?\s*(?:tv|television)\b/i, "width", (m) => Math.round(Number(m[1]) * 0.87 + 4));
  if (tvStand) s = s.replace(/\b(stand|console|media)\b/i, "TV $1");
  // Fit clause (I21): the measure of a SPACE the build has to fit into is its outer width. A typed width or a typed
  // size (24w, 48 x 16, 28 x 12 x 72) always wins, so the typed axes keep their order. A measure that belongs to a
  // height, a person or an object ("7 foot ceiling", "5 foot kid", "22 inch vase") is never a width.
  const fc = fitClause(s);
  if (fc && fc.space && axes.width == null && !typedWidth(prompt)) {
    axes.width = fc.inches;
    phrases.push(fc.text.trim());
    // The measure moves to the width; the fit words and the noun stay ("for a 24 inch nook" → "for a nook … 24 wide").
    s = s.replace(fc.text, fc.text.replace(FIT_MEASURE, " "));
  }
  // "6 foot shelf" with no axis word: a storage form stands that tall.
  // Other forms already read a bare length on their own long axis (bench, arch, tower), so only storage forms are set here.
  if (TALL_FORMS.test(lower) && !/\d\s*(?:by|x|×)\s*\d/i.test(prompt)) set(/\b(\d+(?:\.\d+)?)\s*(?:-|\s)?(?:foot|feet|ft|')(?!\s*(?:wide|deep|tall|high|long|by|x|×))(?=\s+[a-z])/i, "height", (m) => Number(m[1]) * 12);
  if (!phrases.length) return { prompt, axes, phrases };
  s = s.replace(/\b(?:about|around|roughly|approximately)\s+(?=\s)/gi, " ").replace(/\b(?:a|an)\s+(?=(?:a|an)\b)/gi, "").replace(/\s+/g, " ").trim();
  const said = (Object.entries(axes) as [Axis, number][]).map(([a, v]) => `${fmt(v)} ${a === "width" ? "wide" : a === "depth" ? "deep" : "tall"}`).join(" ");
  return { prompt: `${s} ${said}`.replace(/\s+/g, " ").trim(), axes, phrases };
}

/** A typed width in any form: "28 wide", "28 inches wide", "24w", or the first number of a typed size "28 x 12 x 72". */
export function typedWidth(prompt: string): boolean {
  return /\d\s*(?:"|in(?:ch(?:es)?)?|ft|feet|foot|')?\s*(?:wide|width)\b|\b\d+(?:\.\d+)?\s*w\b/i.test(prompt) || typedSizeTuple(prompt) != null;
}

/**
 * A typed overall size "28 x 12 x 72" / "30 by 12" / "24w x 16d x 30h": the numbers in typed order. Lumber names
 * (2x4, 1x6, 4x4) are stock, not a build size, so a tuple that starts under 6" is not one.
 */
export function typedSizeTuple(prompt: string): number[] | null {
  for (const m of prompt.matchAll(/(?<![\d.\/])(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?|w)?\s*(?:x|×|by)\s*(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?|d)?(?:\s*(?:x|×|by)\s*(\d+(?:\.\d+)?))?/gi)) {
    if (Number(m[1]) >= 6) return [m[1], m[2], m[3]].filter((x) => x != null).map(Number);
  }
  return null;
}

const UNIT = String.raw`(inches|inch(?![a-z])|in(?![a-z])\.?|"|feet|foot|ft(?![a-z])\.?|')`;
export const FIT_MEASURE = new RegExp(String.raw`(\d+(?:\.\d+)?)\s*-?\s*` + UNIT.replace("(", "(?:") + String.raw`\s*(?:-\s*)?`, "i");
/**
 * Space nouns: the words that name an empty place a build fills, bounded on its sides (a gap, a nook, the space between
 * two things, a wall run). Their measure is the room the build has across, so it is the build's width. Rooms, ceilings,
 * people, pets and objects are not spaces the build fills: a room holds the build, a ceiling bounds its height, and a
 * person or an object is what the build serves or holds.
 */
const SPACE_NOUN = /^(?:gap|space|spot|nook|alcove|niche|recess|opening|cavity|slot|bay|cubby|cubbie|wall|corner|entry|entryway|doorway|hallway|hall|landing|run|span|stretch|width)s?$/i;
const PHRASE_END = /^(?:between|next|near|beside|by|in|into|on|at|under|over|of|with|and|or|so|that|which|for|to|from|behind|above|below|tall|high|deep|wide|long|x|about|around|is|are)$/;
export type FitClause = { text: string; inches: number; noun: string; space: boolean; ceiling: boolean };
/**
 * The fit clause of a prompt: "to fit / fits in / sized for / for / in" + a measure + the noun the measure belongs to,
 * or "the N inches between …" (the measure IS the space). Measures under 12" are part sizes and never a fit.
 */
export function fitClause(text: string): FitClause | null {
  const lead = String.raw`\b(?:(?:to|that|which|will|must|it)\s+fits?|fits?|fitting|fitted\s+(?:to|in(?:to)?)|sized\s+(?:for|to)|made\s+for|for|in|into|inside|within)\s+(?:(?:in|into|inside|within|between)\s+)?(?:a|an|the|my|our|this|that|your)\s+`;
  const between = text.match(new RegExp(lead.replace(String.raw`(?:a|an|the|my|our|this|that|your)\s+`, String.raw`(?:(?:a|an|the|my|our|this|that|your)\s+)?`) + String.raw`(\d+(?:\.\d+)?)\s*-?\s*` + UNIT + String.raw`\s+(?:of\s+(?:space|room)\s+)?between\b`, "i"));
  const m = between ?? text.match(new RegExp(lead + String.raw`(\d+(?:\.\d+)?)\s*-?\s*` + UNIT + String.raw`\s*(?:-\s*)?(?!(?:wide|width|deep|depth|tall|high|height|long|length|dia|diameter|round|x|by|tv|television|monitor|screen)\b)((?:[a-z]+)(?:\s+[a-z]+){0,2})`, "i"));
  if (!m) return null;
  const inches = Number(m[1]) * (/^(?:feet|foot|ft|')/i.test(m[2]) ? 12 : 1);
  if (!(inches >= 12 && inches <= 120)) return null;
  if (between) return { text: m[0], inches, noun: "between", space: true, ceiling: false };
  // The measure belongs to the head of its noun phrase: the last word before a preposition, a conjunction or the end
  // ("31.5 inch bathroom alcove, 78 tall" → alcove; "15 inch space next to the fridge" → space; "5 foot kid" → kid).
  const words: string[] = [];
  for (const w of m[3].toLowerCase().split(/\s+/)) { if (PHRASE_END.test(w)) break; words.push(w); }
  const noun = words[words.length - 1] ?? "";
  // Only the measure and its noun phrase belong to the clause; the words after it stay where they were.
  const said = m[0].slice(0, m[0].length - m[3].length) + m[3].split(/\s+/).slice(0, words.length).join(" ");
  return { text: said, inches, noun, space: SPACE_NOUN.test(noun), ceiling: /^ceilings?$/.test(noun) };
}
