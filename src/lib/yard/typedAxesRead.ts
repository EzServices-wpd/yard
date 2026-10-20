/**
 * Which axes the person typed, read once for every size surface (PDF cover, header, I42). An axis is typed when the
 * prompt gives it a number with its own axis word ("31 1/2 wide", "5 ft tall", "16 inches deep"), or when the typed
 * size reader (typedExtents: tuples, beds, tables, openings) placed a number on it and the build stands at that number.
 */
import { typedExtents } from "./honesty";

export type Axis = "width" | "height" | "depth";
const AXES: Axis[] = ["width", "height", "depth"];
const near = (a: number, b: number) => Math.abs(a - b) < 1 / 16;

/** A bed's notes read long × wide: its "wide" is the model's depth and its "long" the model's width. */
export function isBedLongWide(notes: readonly string[] | null | undefined): boolean {
  return (notes ?? []).some((n) => /" long × [^.]*" wide × /.test(n));
}

/**
 * The sizes typed with their own axis word, read the shop way: whole and fractional inches ("18 1/2", "18-1/2"),
 * feet ("5 ft", "5'"), feet and inches ("1' 6 1/2""). Tuples and "long" are left out: their axis depends on the form, so typedExtents places them.
 * When the prompt also types a "long", its "wide" may be the depth (a planter 36 long 12 wide), so width is left out.
 */
export function labeledAxisValues(prompt: string): Partial<Record<Axis, number>> {
  const all = labeledAxisAll(prompt);
  const out: Partial<Record<Axis, number>> = {};
  for (const a of AXES) if (all[a]?.length) out[a] = all[a]![0];
  return out;
}

/**
 * Every number typed against each axis word, in order. A long prompt can type the room and the unit on one axis
 * ("back wall 38.5 inches wide … a unit 38 inches wide"): the build honours the typed size when it stands at any of them.
 */
const VULGAR: Record<string, string> = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅓": "1/3", "⅔": "2/3" };

export function labeledAxisAll(prompt: string): Partial<Record<Axis, number[]>> {
  // "12½" is 12 1/2: a unicode fraction reads the shop way.
  prompt = prompt.replace(/(\d?)\s*([½¼¾⅛⅜⅝⅞⅓⅔])/g, (_m, d: string, f: string) => `${d ? `${d} ` : ""}${VULGAR[f]}`);
  const out: Partial<Record<Axis, number[]>> = {};
  const re = /(?<![\d./])(?:(\d+)\s*(?:'|ft\.?|feet|foot)\s*)?(\d+\/\d+|\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+)|\s*-\s*(\d+)\/(\d+))?\s*(?:-\s*)?("|″|in\.?|inch(?:es)?|ft\.?|feet|foot|')?\s*(wide|tall|high|deep)\b/gi;
  const long = /\d\s*(?:"|″|in\.?|inch(?:es)?|ft\.?|feet|foot|')?\s*(?:long|length)\b/i.test(prompt);
  for (const m of prompt.matchAll(re)) {
    let n = m[2].includes("/") ? Number(m[2].split("/")[0]) / Number(m[2].split("/")[1]) : Number(m[2]);
    const [num, den] = m[3] ? [m[3], m[4]] : [m[5], m[6]];
    if (num && den && Number(den)) n += Number(num) / Number(den);
    if (/^(?:ft|feet|foot|')/i.test(m[7] ?? "")) n *= 12;
    // "1' 6 1/2" wide", "2 ft 6 in tall": the feet carry the inches after them.
    if (m[1]) n += Number(m[1]) * 12;
    const w = m[8].toLowerCase();
    const a: Axis = w === "wide" ? "width" : w === "deep" ? "depth" : "height";
    if (a === "width" && long) continue;
    if (n > 0) (out[a] ??= []).push(n);
  }
  // "a width of 30", "height 72": the axis named first.
  for (const m of prompt.matchAll(/\b(width|height|depth)\s*(?:of\s*|:\s*|=\s*)?(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?(?![\d./])/gi)) {
    const a = m[1].toLowerCase() as Axis;
    const n = Number(m[2]) + (m[3] && Number(m[4]) ? Number(m[3]) / Number(m[4]) : 0);
    if (a === "width" && long) continue;
    if (n > 0) (out[a] ??= []).push(n);
  }
  return out;
}

/**
 * The typed axes of a build. `shown` is the size each surface shows (depth may be the finished depth) and `box` the
 * built box: a typedExtents axis counts only when the build stands at its number, so a number the engine read on
 * another axis ("5 foot cabinet" is 60" tall, not 60" wide) never marks the wrong axis typed.
 */
export function typedAxesOf(
  prompt: string,
  bed: boolean,
  shown: Record<Axis, number>,
  box: Record<Axis, number> = shown,
): Set<Axis> {
  const out = new Set<Axis>();
  if (!bed) for (const a of Object.keys(labeledAxisAll(prompt)) as Axis[]) out.add(a);
  // typedExtents reads typed order (a bed's "82 long 44 wide" is 44 wide, 82 deep; the model lies 82 W × 44 D), so each
  // typed number claims one axis the build stands at: its own axis first, then any axis still free.
  const t = typedExtents(prompt);
  const words = labeledAxisAll(prompt);
  const left: number[] = [];
  if (t) for (const a of AXES) {
    const n = t[a];
    if (!t.labeled[a] || n == null || !Number.isFinite(n)) continue;
    // A number another axis word already owns ("cabinet 14in deep", or the 12 of "12 1/2 deep") is that axis's,
    // never a second typed axis: a bare-number reading of it does not make this axis typed.
    // A number typed twice ("36 long 12 wide 12 tall") is free once its axis words have each used one.
    const owns = (x: number) => near(x, n) || (x % 1 !== 0 && Math.floor(x) === n);
    const owned = (Object.entries(words) as [Axis, number[]][]).reduce((k, [b, xs]) => k + (b === a ? 0 : xs.filter(owns).length), 0);
    const times = Number.isInteger(n) ? (prompt.match(new RegExp(String.raw`(?<![\d./])${n}(?![\d.])`, "g")) ?? []).length : 1;
    if (owned >= times && !words[a]?.length) continue;
    // A number on its own axis is used there (already typed by its axis word, or typed now); only a number the
    // build does not stand at on its own axis looks for another axis.
    if (near(n, box[a]) || near(n, shown[a])) out.add(a);
    else if (!Object.values(labeledAxisAll(prompt)).some((xs) => xs?.some((x) => near(x, n)))) left.push(n);
  }
  for (const n of left) {
    const a = AXES.find((x) => !out.has(x) && (near(n, box[x]) || near(n, shown[x])));
    if (a) out.add(a);
  }
  return out;
}

/** The typed size a build stands away from on this axis, when every number typed against the axis word misses it. */
export function typedOffBy(prompt: string, a: Axis, built: number[]): number | null {
  const typed = labeledAxisAll(prompt)[a];
  if (!typed?.length || typed.some((t) => built.some((b) => near(t, b)))) return null;
  return typed[0];
}
