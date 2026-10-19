import type { Panel, YardProject } from "./types";
import { isCasterPart } from "./casterParts";
import { genericFallbackBox } from "./genericBox";
import { typedHeadNoun } from "./headNoun";
import { typedSize } from "./recipeBuild";
import type { Recipe } from "./recipes";

/**
 * Closed storage carcase (refiner :20, 10-17). A prompt that types a carcase's size and its interior counts ("30 wide
 * 72 tall 16 deep with 4 shelves and 2 doors") is fully read when the engine's own sheet carcase holds every typed
 * axis and every typed count: the size and count words are read by the model, not by its title, and a modifier ahead
 * of the head noun ("utility", "craft", "paint") names a use, never another object. The learner placeholder, the rough
 * block and the display-only slab never replace such a build. The generic fallback box (no interior) never qualifies,
 * a named non-storage object whose head noun the build ignores keeps the learner, and a door that covers a drawer
 * front is not an honest build of the ask, so it does not qualify either.
 */

type Feature = "shelf" | "door" | "drawer";
const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const COUNT = /\b(\d+|an?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:[a-z]+\s+)?(shel(?:f|ves)|doors?|drawers?)\b/g;

/** The interior counts typed in the ask: "4 shelves and 2 doors" → { shelf: 4, door: 2 }. */
export function typedInteriorCounts(prompt: string): Partial<Record<Feature, number>> {
  const out: Partial<Record<Feature, number>> = {};
  for (const m of prompt.toLowerCase().matchAll(COUNT)) {
    const n = NUM[m[1]] ?? Number(m[1]);
    const f: Feature = m[2].startsWith("shel") ? "shelf" : m[2].startsWith("door") ? "door" : "drawer";
    if (Number.isFinite(n) && n > 0) out[f] = (out[f] ?? 0) + n;
  }
  return out;
}

const isFront = (x: Panel) => /\bdrawer front\b/i.test(x.name ?? "");
const isDoor = (x: Panel) => /\bdoors?\b/i.test(x.name ?? "") && !/\b(?:stop|catch|hinge|pull|knob)\b/i.test(x.name ?? "");
const isShelf = (x: Panel) => /\bshelf\b/i.test(x.name ?? "");

/** The interior counts the model carries. */
export function modelInteriorCounts(p: YardProject): Record<Feature, number> {
  const body = p.panels.filter((x) => !isCasterPart(x));
  return { shelf: body.filter(isShelf).length, door: body.filter(isDoor).length, drawer: body.filter(isFront).length };
}

/** The carcase is closed: two sides, a top, a bottom and a back. */
function closedCarcase(p: YardProject): boolean {
  const names = p.panels.filter((x) => !isCasterPart(x)).map((x) => (x.name ?? "").toLowerCase());
  const sides = names.filter((n) => /^(?:left|right)\s+(?:upright|side)$|^side \d+$/.test(n)).length;
  return sides >= 2 && ["top", "bottom", "back"].every((w) => names.includes(w));
}

/** A door face lies over a drawer front: the two fill the same opening. */
export function doorOverDrawer(p: YardProject): boolean {
  const doors = p.panels.filter(isDoor), fronts = p.panels.filter(isFront);
  const over = (a: Panel, b: Panel, k: "x" | "y", s: "width" | "height") =>
    Math.min(a.position[k] + a.size[s], b.position[k] + b.size[s]) - Math.max(a.position[k], b.position[k]) > 0.25;
  return doors.some((d) => fronts.some((f) => over(d, f, "x", "width") && over(d, f, "y", "height")));
}

/** The sizes typed with an axis word ("30 wide", "6 ft tall"). */
const typedAxes = (prompt: string) => typedSize(prompt, { feet: false } as unknown as Recipe);

/** The prompt types a size and at least one interior count. */
export function closedStorageAsk(prompt: string): boolean {
  return Object.keys(typedAxes(prompt)).length > 0 && Object.keys(typedInteriorCounts(prompt)).length > 0;
}

/**
 * The engine's sheet carcase read the whole closed-storage ask: a storage-program carcase, closed, holding every typed
 * axis within 1/2" and every typed interior count, with no door over a drawer, titled with the typed head noun and not
 * ignoring it.
 */
export function closedCarcaseReadsAsk(prompt: string, p: YardProject, ignored: () => string[] = () => []): boolean {
  if (p.displayOnly || p.standIn || p.unmatched || !p.fitted || p.fitted.program !== "storage" && !/^(?:closet|pantry|wardrobe|linen)$/.test(p.fitted.program ?? "")) return false;
  if (genericFallbackBox(p) || !closedCarcase(p) || !closedStorageAsk(prompt) || doorOverDrawer(p)) return false;
  const want = typedAxes(prompt);
  if ((Object.entries(want) as [keyof typeof want, number][]).some(([a, v]) => Math.abs(p.overall[a] - v) > 0.5)) return false;
  const have = modelInteriorCounts(p);
  if (!(Object.entries(typedInteriorCounts(prompt)) as [Feature, number][]).every(([f, n]) => have[f] === n)) return false;
  // Last (it rebuilds the phrase): the head noun is read by the carcase; only a modifier ahead of it may be ignored.
  // The title carries the typed head noun (a "guitar case" built as a Shelf unit is another object).
  const head = typedHeadNoun(prompt);
  return !!head && (p.name ?? "").toLowerCase().includes(head) && !ignored().some((w) => w.replace(/(?<!s)s$/, "") === head);
}
