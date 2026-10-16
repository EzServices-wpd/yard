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
  // "6 foot shelf" with no axis word: a storage form stands that tall.
  // Other forms already read a bare length on their own long axis (bench, arch, tower), so only storage forms are set here.
  if (TALL_FORMS.test(lower) && !/\d\s*(?:by|x|×)\s*\d/i.test(prompt)) set(/\b(\d+(?:\.\d+)?)\s*(?:-|\s)?(?:foot|feet|ft|')(?!\s*(?:wide|deep|tall|high|long|by|x|×))(?=\s+[a-z])/i, "height", (m) => Number(m[1]) * 12);
  if (!phrases.length) return { prompt, axes, phrases };
  s = s.replace(/\b(?:about|around|roughly|approximately)\s+(?=\s)/gi, " ").replace(/\b(?:a|an)\s+(?=(?:a|an)\b)/gi, "").replace(/\s+/g, " ").trim();
  const said = (Object.entries(axes) as [Axis, number][]).map(([a, v]) => `${fmt(v)} ${a === "width" ? "wide" : a === "depth" ? "deep" : "tall"}`).join(" ");
  return { prompt: `${s} ${said}`.replace(/\s+/g, " ").trim(), axes, phrases };
}
