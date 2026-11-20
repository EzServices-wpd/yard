/**
 * 5b (a typed size with no axis binds the class's own axes): a lone or paired size with no axis word that the build
 * left on no axis, or put on the wrong one. One rule for every class, read off the class's own default build:
 *   - a lone size is the class's lead axis, its largest default (‘spice rack 18 inches’ is 18 wide, "towel ladder
 *     4 ft" is 4 ft tall, "storage ottoman 36 square" is 36 wide and 36 deep);
 *   - a pair is width × depth, the plan, never a height, on anything that stands on its footprint ("twin platform bed
 *     39 by 75", "chicken coop 4 by 6"): the same rule as a two-number place. A front (a tall indoor class, or a wall
 *     piece with a shallow default depth: "closet system 80x120") reads a pair as width × height.
 * Sizes are read by lengthReader, the one number reader. Prompts with an axis word, a triple, or lumber nominals are
 * left to the readers that own them, as are builds in module stock (craft sticks, pipe: their own envelope readers);
 * so are a size of what the build holds ("for a 75 inch TV", "32 inch TV stand") or of a part or gap ("tiers clear 6 in",
 * "legs 30 inches"), a bare lone number
 * (a count), an indoor bare small pair (a grid), and a size the build already carries on some axis.
 */
import { readLengths, readTuple, type Length } from "./lengthReader";
import { outdoorBuild } from "./outdoor";
import type { YardProject } from "./types";

type Axis = "width" | "height" | "depth";
/** The prompt with the size written on its axes, in the wordings to try in order; `plan` when a pair binds the plan. */
export type ClassAxisBind = { bind: Partial<Record<Axis, number>>; prompts: string[]; plan?: [number, number] };

const AXIS_WORD = /\b(?:wide|width|deep|depth|tall|high|height|long|length|dia|diameter|round|radius|[whdl])\b/i;
const NOMINAL = /\b(?:1\s*x\s*(?:2|3|4|6|8|10|12)|2\s*x\s*(?:2|3|4|6|8|10|12)|4\s*x\s*[46]|6\s*x\s*6)s?\b/i;
const WORD: Record<Axis, string> = { width: "wide", height: "tall", depth: "deep" };
const near = (a: number, b: number) => Math.abs(a - b) <= 0.5;
/** On the build already, within the class's own rounding (a stick lattice rounds 36" to whole sticks). */
const carried = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.5, 0.05 * b);
/** A size inside "for a 75 inch TV", "fits a 12 inch record", "to hold …": the size of what the build holds. */
/** "32 inch TV stand", "a 12 inch record shelf": a size right before a held object sizes that object. */
const HELD_AFTER = /^\s*-?\s*(?:tvs?|televisions?|monitors?|screens?|records?|lps?|vinyl|mattress(?:es)?|aquariums?|fish\s+tanks?|turntables?|speakers?)\b/i;
/** Stock with its own module (craft sticks, pipe) snaps a size to whole pieces and reads its own envelope. */
const MODULE_STOCK = /^(?:popsicle|craft|toothpick|bamboo-skewer|straw|balsa|cardboard|chipboard|pvc|pipe|conduit|emt|copper)/;
/** A size next to a part or a gap sizes that part ("tiers clear 6 in", "legs 30 inches", "6 inches apart"). */
// Before a size, only words that never name the object itself ("wall shelf 24 inches" is the shelf's own size).
const PART_BEFORE = /\b(?:clear(?:ance)?|gaps?|spacing|spaced|legs?|rails?|slats?|each|per)\s+(?:of\s+|at\s+|is\s+|are\s+)?$/i;
const PART_AFTER = /^\s*\+?\s*(?:apart|each|clear(?:ance)?|gaps?|spacing|between|legs?|shel(?:f|ves)|tiers?|slats?|rails?|drawers?|doors?|cubb(?:y|ies)|on\s+center|o\.?c\.?)\b/i;
const HELD_BEFORE = /\b(?:for|fits?|fitting|holds?|holding|hold)\s+(?:a|an|the|my|our|two|\d+)?\s*$/i;
const fmt = (n: number) => `${Math.round(n * 100) / 100}`;
/**
 * The length reader takes the preposition in "6 in the corner" as inches. "6 inch" and 6" stay units.
 * A place phrase is not this rule: #373 owns sizes typed against a place.
 */
function inIsPreposition(prompt: string, l: Length): boolean {
  if (l.unit !== "in" || /inch|["″”]/i.test(l.raw)) return false;
  return /^\s+(?:the|a|an|my|our|this|that|your)\b/i.test(prompt.slice(l.end));
}

/** The class's lead axis: its largest default, width first on a tie (the way a front reads). */
function leadAxis(o: YardProject["overall"]): Axis {
  return (["width", "height", "depth"] as Axis[]).reduce((a, b) => (o[b] > o[a] + 0.5 ? b : a));
}

export function classAxisBind(prompt: string, built: YardProject): ClassAxisBind | null {
  if (AXIS_WORD.test(prompt) || NOMINAL.test(prompt) || MODULE_STOCK.test(built.primaryMaterialId ?? "")) return null;
  const o = built.overall;
  const lens = readLengths(prompt);
  const tuple = readTuple(prompt);
  const say = (start: number, end: number, words: string) => `${prompt.slice(0, start)}${words}${prompt.slice(end)}`.replace(/\s+/g, " ").trim();
  const edit = (start: number, end: number, bind: Partial<Record<Axis, number>>): ClassAxisBind => ({
    bind,
    prompts: [say(start, end, (Object.keys(bind) as Axis[]).map((a) => `${fmt(bind[a]!)} inches ${WORD[a]}`).join(" "))],
  });
  if (tuple && tuple.places.length === 2 && lens.length === 2) {
    const [a, b] = tuple.places;
    if (inIsPreposition(prompt, a) || inIsPreposition(prompt, b)) return null;
    if (HELD_BEFORE.test(prompt.slice(0, tuple.start)) || HELD_AFTER.test(prompt.slice(tuple.end))) return null;
    if (PART_BEFORE.test(prompt.slice(0, tuple.start)) || PART_AFTER.test(prompt.slice(tuple.end))) return null;
    // Outdoors a bare pair is the footprint in feet ("pergola 12x16", "sandbox 4 by 4", "chicken coop 4 by 6");
    // indoors a bare small pair is a grid ("storage cubby 3x3").
    const bare = !a.unit && !b.unit;
    const outdoors = outdoorBuild(built, prompt);
    const feet = bare && a.value <= 24 && b.value <= 24 && outdoors;
    if (bare && a.value <= 12 && b.value <= 12 && !feet) return null;
    const [w, s] = [a, b].map((l: Length) => (feet ? l.value * 12 : l.inches));
    if (!(w >= 6 && s >= 6)) return null;
    // A front: a tall indoor class (its height its largest default: closet, bookcase, cabinet) or a wall piece reads
    // the pair as width × height. A footprint: anything outdoors, or a low class (a bed, a table, a bench).
    const front = !outdoors && (leadAxis(o) === "height" || (o.depth < 12 && o.depth <= Math.min(o.width, o.height)));
    const second: Axis = front ? "height" : "depth";
    // Already on that plane, either way round, in this reading or, bare, in feet: the class's own reader placed it
    // ("pergola 12x16", "sawbuck 30x40"). A bare small pair carried as inches outdoors is the misread (a 3" compost bin).
    const readings = [[w, s], ...(bare && !feet ? [[a.value * 12, b.value * 12]] : [])];
    if (readings.some(([x, y]) => (near(o.width, x) && near(o[second], y)) || (near(o.width, y) && near(o[second], x)))) return null;
    if (front) return edit(tuple.start, tuple.end, { width: w, height: s });
    // The plan: a class names its plan axes its own way (a bed's "wide" is its short side, its "long" runs the
    // length), so the class's own orientation is tried first (the larger number on its larger default plan axis: a
    // coop's 6 ft runs its 48" width, not its 36" depth), then the order typed; the build is kept when its plan holds
    // the typed pair.
    const [lo, hi] = [Math.min(w, s), Math.max(w, s)];
    const oriented: [number, number] = o.width >= o.depth ? [hi, lo] : [lo, hi];
    const words = ([x, y]: [number, number], end: string) => say(tuple.start, tuple.end, `${fmt(x)} inches wide ${fmt(y)} inches ${end}`);
    const prompts = [...new Set([words(oriented, "deep"), words([w, s], "deep"), words([w, s], "long"), words(oriented, "long")])];
    return { bind: { width: oriented[0], depth: oriented[1] }, prompts, plan: [w, s] };
  }
  if (tuple || lens.length !== 1) return null;
  const [l] = lens;
  if (inIsPreposition(prompt, l)) return null;
  if (HELD_BEFORE.test(prompt.slice(0, l.start)) || HELD_AFTER.test(prompt.slice(l.end))) return null;
  if (PART_BEFORE.test(prompt.slice(0, l.start)) || PART_AFTER.test(prompt.slice(l.end))) return null;
  if (!(l.inches >= 6 && l.inches <= 240)) return null;
  // "36 square" is a size even bare: square says both plan axes.
  if (/^\s*square\b/i.test(prompt.slice(l.end))) {
    if (near(o.width, l.inches) && near(o.depth, l.inches)) return null;
    return edit(l.start, l.end + prompt.slice(l.end).match(/^\s*square\b/i)![0].length, { width: l.inches, depth: l.inches });
  }
  if (!l.unit) return null; // a bare lone number is a count ("12 washer stack"), not a size
  // Already on some axis: the class's own reader placed it.
  if (carried(o.width, l.inches) || carried(o.height, l.inches) || carried(o.depth, l.inches)) return null;
  return edit(l.start, l.end, { [leadAxis(o)]: l.inches });
}

/**
 * The rebuilt build carries the size: every axis bound, or for a plan pair a plan that holds it either way round with
 * at most a frame's allowance (a bed built around a typed 60 × 80 mattress is 67 × 87) and no typed number as its height.
 */
export function carriesBind(p: YardProject, b: ClassAxisBind): boolean {
  if (!b.plan) return (Object.keys(b.bind) as Axis[]).every((a) => near(p.overall[a], b.bind[a]!));
  const got = [p.overall.width, p.overall.depth].sort((x, y) => x - y);
  const want = [...b.plan].sort((x, y) => x - y);
  return got.every((g, i) => g >= want[i] - 0.5 && g <= want[i] + 12) && !b.plan.some((n) => near(p.overall.height, n) && !near(n, got[0]) && !near(n, got[1]));
}
