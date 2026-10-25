/**
 * Hanging clearance (row 209): a clothes hanger is about 18" across the shoulders, so a rod
 * that runs side to side, parallel to the front, needs about 20" of interior depth (a 24" box
 * is the usual untyped depth). Below that, a build that would hang clothes is refused and names
 * the depth that does hang. Shelves-only closets are not hanging builds.
 */
import { createId } from "@/lib/utils";
import { inchFrac } from "./inchText";
import { closetShelfClearIn, MIN_HANG_ROOM_IN, SHELF_CLEAR_FLOOR_IN } from "./shelfClear";
import { SPAN_TOL, spanFindings } from "./spanCheck";
import { askedNoun } from "./tooSmall";
import type { Panel, YardProject } from "./types";

/** Clear depth from the back's inner face to the door. A 1/4" back in a 20" box leaves 19.75". */
export const HANGER_CLEAR_IN = 20;
/** Shop tolerance so a typed 20" box (19.75" behind the back) still hangs. */
const CLEAR_TOL = 0.5;
/** Untyped wardrobe / closet-rod depth. Interior lands near 23", inside the 20–26" class. */
export const HANGER_DEPTH_IN = 24;
/** The smallest depth the refusal names. It builds a side-to-side rod, and sits in 18–24". */
export const HANGER_MIN_DEPTH_IN = 22;
/** Long-hang rod centerline, inches off the floor. */
export const LONG_HANG_IN = 66;
export const LONG_HANG_LO = 64;
export const LONG_HANG_HI = 70;
/** Double-hang lower rod. */
export const DOUBLE_HANG_IN = 42;
/** Shortest box that takes a double-hang pair: the upper rod sits 8" under the top and at least 80" up. */
export const DOUBLE_HANG_MIN_H_IN = 88;
/** Hang under each stacked rod: the upper rod of a pair sits at least this far over the lower one. */
const TIER_HANG_IN = 34;
/** A closet rod sags past this clear span, so a wide bay gets a divider. */
export const ROD_BAY_MAX_IN = 42;
/** Row 462: shortest rod a bay is split down to for a typed count (a single 18" closet section). */
const MIN_BAY_ROD_IN = 18;
export const ROD_DIA = 1.25;
const BAY_EPS = 1 / 32;
// One shelf-stack rule for the whole carcass family lives in shelfClear.ts (#142).
export { CLOSET_SHELF_CLEAR_IN, MIN_HANG_ROOM_IN, SHELF_CLEAR_FLOOR_IN, closetShelfClearIn } from "./shelfClear";

export function sideHangFits(interiorIn: number): boolean {
  return interiorIn + CLEAR_TOL >= HANGER_CLEAR_IN;
}

/** A wardrobe, armoire, or closet that hangs clothes. Linen and towel closets do not. */
export function isClothesRodPrompt(lower: string): boolean {
  if (/\blinen\b|\btowel\b/.test(lower) && !/\bwardrobe\b/.test(lower)) return false;
  if (/\bwardrobe\b|\barmoire\b/.test(lower)) return true;
  // Plurals and "hanging" too: "closet with 2 rods" / "hanging rods" hang clothes (typedRodDemand reads rods? as well).
  // "hanging"/"rails" hang clothes only when they don't name another hung thing ("hanging baskets", "drawer rails").
  const hangWord = /\bhanging\b(?!\s+(?!rods?\b|rails?\b|space\b|clothes\b|section\b|area\b|bar\b|and\b|with\b)[a-z])/.test(lower);
  const railWord = /(?:^|\b(?:with|hanging|clothes|closet|\d+|two|and)\s+)rails?\b/.test(lower);
  return /\bcloset\b/.test(lower) && (/system|walk-?in|along the wall|wall of closets|\brods?\b|\bhangs?\b/.test(lower) || hangWord || railWord);
}

const ROD_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/** Typed rod count: "3 rods", "two hanging rods", "1 rod". 0 when none is typed. A rod size ("1 1/4 rods", "1-1/4", "2.5") is not a count (row 439). */
export function rodsAsked(prompt: string): number {
  // A singular "rod" after a number past 6 ("a 36 rod", "closet 24 rod") is a rod length, not a count (row 446).
  const m = prompt.match(/(?<![\d/.-])(?<!\d\s)\b(?:(\d+|one|two|three|four|five|six)\s+(?:hanging\s+|clothes\s+|closet\s+)?rods|([1-6]|one|two|three|four|five|six)\s+(?:hanging\s+|clothes\s+|closet\s+)?rod)\b(?![\d/.-])/i);
  // Row 450: a count before a rod size ("two 1 1/4 rods", '2 1-1/4" rods'); a bare digit before a fraction is the size.
  const z = m ? null : prompt.match(/(?<![\d/.-])\b(one|two|three|four|five|six|[1-6])\s+(\d+(?:[ -]\d+\/\d+)?|\d+\/\d+)(\s*(?:"|inch(?:es)?\b))?\s+(?:hanging\s+|clothes\s+|closet\s+)?rods\b/i);
  const w = m ? m[1] ?? m[2] : z && (!/\d/.test(z[1]) || (z[3] && !/^\d+\/\d+$/.test(z[2]))) ? z[1] : "";
  return !w ? 0 : /\d/.test(w) ? parseInt(w, 10) : ROD_WORDS[w.toLowerCase()];
}

/**
 * Row 438: more rods typed than the finished bays hold one each, in a box tall enough for double hang: build it as
 * double hang, and hangingTalk keeps exactly the typed count (pairs in n − bays bays). Null when the first build stands.
 * The bays are only known after the shelf-span and rod splits, so this reads the built rods, not a guess.
 */
export function withRodPairs(p: YardProject, prompt: string, rebuild: (q: string) => YardProject): YardProject | null {
  if (p.refused || /\bdouble\s*(?:hang|rod)s?\b/i.test(prompt)) return null;
  const prog = p.fitted?.program;
  const rods = p.panels.filter(isHangingRod);
  const n = rodsAsked(prompt);
  if ((prog !== "wardrobe" && prog !== "closet") || !rods.length || rods.length >= n) return null;
  if (p.overall.height < DOUBLE_HANG_MIN_H_IN) {
    // Row 462: too short for a double-hang pair: one rod in each of n bays, when every rod is still a usable hang.
    if (/\b(?:bays?|sections?|dividers?)\b/i.test(prompt)) return null;
    const bayed = rebuild(`${prompt} and ${n} bays`);
    const br = bayed.panels.filter(isHangingRod);
    return !bayed.refused && br.length === n && Math.min(...br.map((r) => r.size.width)) >= MIN_BAY_ROD_IN ? bayed : null;
  }
  const paired = rebuild(`${prompt} double hang`);
  // The words "double hang" are ours here, not typed, so drop the row 450 "the count wins" note they would raise.
  const notes = (paired.notes ?? []).filter((n) => !/ and double hang\. The count wins/.test(n));
  return paired.panels.filter(isHangingRod).length > rods.length ? { ...paired, notes } : null;
}

/** Default depth for a clothes-rod build, or null when this prompt is not one. */
export function clothesRodDefaultDepth(lower: string, program: string): number | null {
  if (isClothesRodPrompt(lower)) return HANGER_DEPTH_IN;
  if (program === "wardrobe") return HANGER_DEPTH_IN;
  if (program === "closet" && isClothesRodPrompt(`closet ${lower}`)) return HANGER_DEPTH_IN;
  return null;
}

/** Rod centerlines: one long-hang rod, or a double-hang pair when asked and the box is tall enough. */
export function rodCenters(height: number, doubleHang: boolean): number[] {
  const cap = height - 8;
  if (doubleHang && height >= DOUBLE_HANG_MIN_H_IN) {
    const upper = Math.min(84, cap);
    if (upper >= DOUBLE_HANG_IN + TIER_HANG_IN) return [DOUBLE_HANG_IN, upper];
  }
  if (cap >= LONG_HANG_LO) return [Math.min(LONG_HANG_HI, Math.max(LONG_HANG_LO, Math.min(LONG_HANG_IN, cap)))];
  // Too short for a 64" hang: the rod sits 8" under the top, not forced up into the ceiling.
  return [Math.max(4, cap)];
}

/** Seat of a side-to-side rod: 12" from the inside of the back, kept off the door. */
export function rodSeatZ(boxDepth: number, backT = 0.25, dia = ROD_DIA): number {
  const center = Math.min(boxDepth - 2, Math.max(backT + dia, backT + 12));
  return center - dia / 2;
}

/** Inches from the top of the hanging bay down to the rod the builder stored. The step uses this, not a second guess. */
export function rodDropIn(bayTop: number, rodY: number): number {
  return Math.round(bayTop - rodY);
}

/** Underside of the first part over this rod (the hat, a drawer-bay floor, or the top); the box height when none. */
export function rodBayTop(rod: Panel, panels: Panel[], height: number): number {
  const over = panels.filter(
    (p) =>
      (p.type === "shelf" || p.type === "bottom" || p.type === "top") &&
      p.position.y >= rod.position.y + rod.size.height - 0.05 &&
      Math.min(p.position.x + p.size.width, rod.position.x + rod.size.width) - Math.max(p.position.x, rod.position.x) > 1,
  );
  return over.length ? Math.min(...over.map((p) => p.position.y)) : height;
}

function hangTail(rodY: number): string {
  if (rodY + 1e-6 >= LONG_HANG_LO) return ", so coats and shirts hang full length.";
  if (rodY + 1e-6 >= MIN_HANG_ROOM_IN) return ", so shirts hang.";
  return ".";
}

/** One rod's note. Full-length coats only in the long-hang band; a shirt hang says so; a shorter rod claims neither. A rod lowered for typed shelves names its exact height. */
export function singleRodNote(rodY: number, exact = false): string {
  return `A 1 1/4" closet rod in two sockets runs side to side ${exact ? inchFrac(rodY) : Math.round(rodY)}" up, with the shelves above it${hangTail(rodY)}`;
}

const ROD_NAME = /\bhanging rod\b|\bclothes rod\b/i;

/** Largest count whose even spacing leaves that clear gap. */
export function shelvesThatFit(zone: number, thick: number, clear = closetShelfClearIn()): number {
  const pitch = thick + Math.max(SHELF_CLEAR_FLOOR_IN, clear);
  if (!(zone > 0) || pitch <= 0) return 0;
  return Math.max(0, Math.floor((zone + 1e-6) / pitch) - 1);
}

/** Interior depth a hanger actually gets: back's inner face to the box front (an overlay door stands proud). */
export function hangerInterior(p: Pick<YardProject, "overall" | "panels">): number {
  const back = p.panels.find((x) => x.type === "back");
  const backT = back ? Math.min(back.size.width, back.size.height, back.size.depth) : 0;
  return p.overall.depth - backT;
}

function longAxis(p: Panel): "width" | "height" | "depth" {
  const s = p.size;
  if (s.width >= s.height && s.width >= s.depth) return "width";
  if (s.depth >= s.height) return "depth";
  return "height";
}

/** A side-to-side clothes rod has to clear a hanger. A shallow box is refused instead of hanging one. */
export function hangingClearanceIssues(p: YardProject): string[] {
  if (p.refused || !p.panels.length) return [];
  const rods = p.panels.filter((x) => ROD_NAME.test(x.name));
  if (!rods.length) return [];
  const out: string[] = [];
  const turned = rods.find((x) => longAxis(x) !== "width");
  if (turned) out.push(`${turned.name} does not run side to side across the width`);
  const interior = hangerInterior(p);
  if (!sideHangFits(interior)) out.push(`hanging rod in a ${inchFrac(interior)}" interior (hangers need about ${HANGER_CLEAR_IN}")`);
  return out;
}

/**
 * A clothes-rod box shallower than a hanger is refused. The named 22" builds a side-to-side rod.
 * Returns null when the build stands. A shelves-only closet is not a clothes-rod prompt.
 */
export function hangingDepthRefusal(p: YardProject, prompt: string): YardProject | null {
  if (p.refused || !p.panels.length) return null;
  // Only a build that hangs clothes (the wardrobe/closet program) is refused for depth; a pantry or shoe rack is not.
  const prog = (p as { fitted?: { program?: string } }).fitted?.program;
  if (prog && prog !== "wardrobe" && prog !== "closet") return null;
  const lower = prompt.toLowerCase();
  if (!isClothesRodPrompt(lower) && clothesRodDefaultDepth(lower, "") == null) return null;
  if (sideHangFits(hangerInterior(p))) return null;
  const noun = askedNoun(p);
  const a = /^[aeio]/i.test(noun) ? "An" : "A";
  const why = `${a} ${noun.toLowerCase()} needs at least ${inchFrac(HANGER_MIN_DEPTH_IN)}" deep so clothes can hang (hangers need about ${HANGER_CLEAR_IN}" inside). Nothing is built at ${inchFrac(p.overall.depth)}".`;
  return { ...p, name: noun, panels: [], instances: [], refused: why, cardNote: why, notes: [why] };
}

/** Narrowest box whose rod split gives the ceil(n / 2) bays that hold n rods as double-hang pairs (row 442). */
function wideFor(n: number, t = 0.75): number {
  return Math.ceil(ROD_BAY_MAX_IN * (Math.ceil(n / 2) - 1) + 2 * t + BAY_EPS);
}

/**
 * Row 433 (FR-004 count rule): a typed rod count the build does not hold is refused, never cut to one rod.
 * Each bay stacks at most a double-hang pair, which needs DOUBLE_HANG_MIN_H_IN; a third tier is another TIER_HANG_IN of hang.
 */
export function rodCountRefusal(p: YardProject, prompt: string): YardProject | null {
  if (p.refused || !p.panels.length) return null;
  const prog = p.fitted?.program;
  if (prog !== "wardrobe" && prog !== "closet") return null;
  const n = rodsAsked(prompt);
  const rods = p.panels.filter(isHangingRod);
  if (n < 2 || !rods.length || rods.length >= n) return null;
  const bays = new Set(rods.map((r) => r.position.x.toFixed(2))).size;
  const tiers = Math.ceil(n / bays);
  // Tall enough already (drawers under the rod, say): the hangingTalk note says one rod is built.
  if (tiers <= 2 && p.overall.height >= DOUBLE_HANG_MIN_H_IN) return null;
  const noun = askedNoun(p);
  const a = /^[aeio]/i.test(noun) ? "An" : "A";
  const minH = DOUBLE_HANG_MIN_H_IN + (tiers - 2) * TIER_HANG_IN;
  const at = `Nothing is built at ${inchFrac(p.overall.height)}".`;
  const why =
    tiers <= 2
      ? `${a} ${noun.toLowerCase()} needs at least ${minH}" tall for ${n} rods. ${at}`
      : `${a} ${noun.toLowerCase()} needs at least ${minH}" tall for ${n} rods, taller than a 4×8 sheet cuts. ${a} ${noun.toLowerCase()} up to 96" tall holds ${bays * 2}; one ${wideFor(n)}" wide and ${DOUBLE_HANG_MIN_H_IN}" tall holds ${n}. ${at}`;
  return { ...p, name: noun, panels: [], instances: [], refused: why, cardNote: why, notes: [why] };
}

function isHangingRod(panel: Panel): boolean {
  return panel.type === "rail" && /hanging rod/i.test(panel.name);
}

function overlapLen(a0: number, a1: number, b0: number, b1: number): number {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

/** A bay divider, not the splitter inside a drawer bank. */
function bayVerticals(panels: Panel[]): Panel[] {
  return panels.filter((q) => q.type === "divider" && q.size.width <= 2.25 && q.size.height >= 2 && !/drawer bay divider/i.test(q.name));
}

function crossesPart(a: Panel, d: Panel): boolean {
  return (
    overlapLen(a.position.x, a.position.x + a.size.width, d.position.x, d.position.x + d.size.width) > 0.2 &&
    overlapLen(a.position.y, a.position.y + a.size.height, d.position.y, d.position.y + d.size.height) > 0.2 &&
    overlapLen(a.position.z, a.position.z + a.size.depth, d.position.z, d.position.z + d.size.depth) > 0.2
  );
}

/**
 * Longest clear run of a raised floor. A vertical counts only when its top lands under the floor.
 * A divider that runs through the floor does not shorten it.
 */
export function unsupportedFloorSpan(floor: Panel, panels: Panel[]): number {
  const x0 = floor.position.x;
  const x1 = x0 + floor.size.width;
  const stops = [x0, x1];
  for (const q of panels) {
    if (q === floor || q.type === "back" || q.type === "door" || q.type === "rail") continue;
    if (q.size.width > 2.25 || q.size.height < 2) continue;
    const top = q.position.y + q.size.height;
    if (Math.abs(top - floor.position.y) > 0.35) continue;
    const at = q.position.x + q.size.width / 2;
    if (at <= x0 + 0.5 || at >= x1 - 0.5) continue;
    const oz = overlapLen(floor.position.z, floor.position.z + floor.size.depth, q.position.z, q.position.z + q.size.depth);
    if (oz < floor.size.depth * 0.5) continue;
    stops.push(at);
  }
  stops.sort((a, b) => a - b);
  let span = 0;
  for (let i = 1; i < stops.length; i++) span = Math.max(span, stops[i] - stops[i - 1]);
  return span;
}

function splitOnDividers(panels: Panel[], index: number, dividers: Panel[]): boolean {
  const part = panels[index];
  const hits = dividers.filter((d) => crossesPart(part, d)).sort((a, b) => a.position.x - b.position.x);
  if (!hits.length) return false;
  const pieces: { x: number; w: number }[] = [];
  let x = part.position.x;
  const end = x + part.size.width;
  for (const d of hits) {
    if (d.position.x - x >= 1) pieces.push({ x, w: d.position.x - x });
    x = Math.max(x, d.position.x + d.size.width);
  }
  if (end - x >= 1) pieces.push({ x, w: end - x });
  if (pieces.length < 2) return false;
  panels.splice(index, 1);
  pieces.forEach((piece, n) =>
    panels.push({
      ...part,
      id: n === 0 ? part.id : createId(part.type === "rail" ? "ra" : "bo"),
      name: n === 0 ? part.name : `${part.name} ${n + 1}`,
      position: { ...part.position, x: piece.x },
      size: { ...part.size, width: piece.w },
    }),
  );
  return true;
}

function splitMatching(panels: Panel[], take: (panel: Panel) => boolean): boolean {
  let changed = false;
  for (let i = panels.length - 1; i >= 0; i--) {
    if (!take(panels[i])) continue;
    if (splitOnDividers(panels, i, bayVerticals(panels))) changed = true;
  }
  return changed;
}

/** Depth that still covers the rod, cut back where another divider already stands. */
function openDepth(panels: Panel[], at: number, t: number, y0: number, y1: number, z0: number, z1: number, host: Panel): { z: number; d: number } | null {
  const blocks = panels
    .filter(
      (q) =>
        q.type === "divider" &&
        overlapLen(at - t / 2, at + t / 2, q.position.x, q.position.x + q.size.width) > 0.2 &&
        overlapLen(y0, y1, q.position.y, q.position.y + q.size.height) > 0.2 &&
        overlapLen(z0, z1, q.position.z, q.position.z + q.size.depth) > 0.2,
    )
    .map((q) => [q.position.z, q.position.z + q.size.depth] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const spans: [number, number][] = [];
  let z = z0;
  for (const [a, b] of blocks) {
    if (a - z >= 1) spans.push([z, a]);
    z = Math.max(z, b);
  }
  if (z1 - z >= 1) spans.push([z, z1]);
  const rod0 = host.position.z;
  const rod1 = rod0 + host.size.depth;
  const hit = spans.find(([a, b]) => a <= rod0 + 0.2 && b >= rod1 - 0.2);
  return hit ? { z: hit[0], d: hit[1] - hit[0] } : null;
}

/** Full height of the hanging bay: on the carcase bottom, up to a raised floor or the top. */
function standBayDivider(panels: Panel[], at: number, host: Panel): boolean {
  const t = 0.75;
  if (bayVerticals(panels).some((d) => Math.abs(d.position.x + d.size.width / 2 - at) < 1.5)) return false;
  const ground = panels.filter((p) => p.type === "bottom" && p.position.y < 0.3);
  const y0 = ground.length ? Math.max(...ground.map((b) => b.position.y + b.size.height)) : 0.75;
  const raised = panels
    .filter((p) => p.type === "bottom" && p.position.y > y0 + 4 && overlapLen(at - t / 2, at + t / 2, p.position.x, p.position.x + p.size.width) > 0)
    .sort((a, b) => a.position.y - b.position.y)[0];
  const cap = panels.filter((p) => p.type === "top").sort((a, b) => a.position.y - b.position.y)[0];
  const y1 = raised ? raised.position.y : cap ? cap.position.y : y0;
  if (y1 - y0 < 4) return false;
  const prefer = raised ?? ground[0] ?? host;
  const span = openDepth(panels, at, t, y0, y1, prefer.position.z, prefer.position.z + prefer.size.depth, host);
  if (!span) return false;
  const box = { x: at - t / 2, y: y0, z: span.z, w: t, h: y1 - y0, d: span.d };
  const hitsDrawer = panels.some(
    (q) =>
      (q.type === "drawer" || /drawer front/i.test(q.name)) &&
      overlapLen(box.x, box.x + box.w, q.position.x, q.position.x + q.size.width) > 0.2 &&
      overlapLen(box.y, box.y + box.h, q.position.y, q.position.y + q.size.height) > 0.2 &&
      overlapLen(box.z, box.z + box.d, q.position.z, q.position.z + q.size.depth) > 0.2,
  );
  if (hitsDrawer) return false;
  const n = panels.filter((p) => /^Bay divider\b/.test(p.name)).length;
  panels.push({
    id: createId("di"),
    type: "divider",
    name: `Bay divider ${n + 1}`,
    position: { x: box.x, y: box.y, z: box.z },
    size: { width: box.w, height: box.h, depth: box.d },
    materialId: (ground[0] ?? host).materialId,
  });
  return true;
}

/** A divider that stabs a raised floor is cut so its top bears the floor and the rest continues above it. */
function bearRaisedFloors(panels: Panel[]): boolean {
  let changed = false;
  const floors = panels.filter((p) => p.type === "bottom" && p.position.y >= 0.3 && unsupportedFloorSpan(p, panels) > ROD_BAY_MAX_IN + BAY_EPS);
  for (const floor of floors) {
    const piercers = bayVerticals(panels).filter(
      (d) => crossesPart(floor, d) && d.position.y < floor.position.y - 0.05 && d.position.y + d.size.height > floor.position.y + floor.size.height + 0.05,
    );
    for (const d of piercers) {
      const top = d.position.y + d.size.height;
      const aboveY = floor.position.y + floor.size.height;
      const aboveH = top - aboveY;
      d.size = { ...d.size, height: Math.max(0.5, floor.position.y - d.position.y) };
      if (aboveH > 1) {
        panels.push({
          ...d,
          id: createId("di"),
          name: `${d.name} upper`,
          position: { ...d.position, y: aboveY },
          size: { ...d.size, height: aboveH },
        });
      }
      changed = true;
    }
    if (unsupportedFloorSpan(floor, panels) <= ROD_BAY_MAX_IN + BAY_EPS) continue;
    const n = Math.max(2, Math.ceil((floor.size.width - BAY_EPS) / ROD_BAY_MAX_IN));
    for (let i = 1; i < n; i++) {
      if (standBayDivider(panels, floor.position.x + (floor.size.width * i) / n, floor)) changed = true;
    }
  }
  return changed;
}

/** Even split of [x0, x1] into the fewest bays no wider than `limit`, as interior centers. */
function evenStops(x0: number, x1: number, limit: number): number[] {
  const n = Math.max(1, Math.ceil((x1 - x0 - BAY_EPS) / limit));
  return Array.from({ length: n - 1 }, (_, i) => x0 + ((x1 - x0) * (i + 1)) / n);
}

/**
 * A raised floor over a hanging bay (the drawer-bay floor) is held at its own span limit, the one I7 reads,
 * not the 42" rod limit. Bay dividers go under the drawer-bank dividers that stand on the floor when those
 * alone keep every run inside the limit; otherwise the floor is split evenly. Rods are then cut at them.
 */
function seatRaisedFloors(project: YardProject, panels: Panel[]): boolean {
  let changed = false;
  const rods = panels.filter(isHangingRod);
  const floors = panels.filter(
    (p) =>
      p.type === "bottom" &&
      p.position.y >= 0.3 &&
      rods.some((r) => r.position.y < p.position.y && overlapLen(r.position.x, r.position.x + r.size.width, p.position.x, p.position.x + p.size.width) > 1),
  );
  for (const floor of floors) {
    const finding = spanFindings({ ...project, panels }).find((f) => f.panelId === floor.id);
    if (!finding) continue;
    const limit = Math.min(ROD_BAY_MAX_IN, finding.allow * SPAN_TOL);
    const x0 = floor.position.x;
    const x1 = x0 + floor.size.width;
    const onTop = floor.position.y + floor.size.height;
    const bank = panels
      .filter((q) => /drawer bay divider/i.test(q.name) && Math.abs(q.position.y - onTop) < 0.35)
      .map((q) => q.position.x + q.size.width / 2)
      .filter((x) => x > x0 + 1 && x < x1 - 1)
      .sort((a, b) => a - b);
    const edges = [x0, ...bank, x1];
    const bankHolds = bank.length > 0 && edges.every((x, i) => i === 0 || x - edges[i - 1] <= limit + BAY_EPS);
    const stops = bankHolds ? bank : evenStops(x0, x1, limit);
    for (const at of stops) if (standBayDivider(panels, at, floor)) changed = true;
  }
  return changed;
}

/**
 * Every hanging bay is 42" or less, shelf or no shelf. Rods are cut at the dividers.
 * A raised floor (the drawer-bay floor) is borne by those dividers, not stabbed by them.
 */
export function supportHangingBays(project: YardProject): YardProject {
  if (!project.panels.length || project.refused || !project.panels.some(isHangingRod)) return project;
  const panels = project.panels.map((p) => ({ ...p, position: { ...p.position }, size: { ...p.size } }));
  const wideRod = (p: Panel) => isHangingRod(p) && p.size.width > ROD_BAY_MAX_IN + BAY_EPS;
  let changed = seatRaisedFloors(project, panels);
  // Row 461: a rod under 42" can still cross a center support the span check stood under the hat shelf; it never passes through one.
  if (splitMatching(panels, isHangingRod)) changed = true;
  for (let guard = 0; panels.some(wideRod) && guard < 6; guard++) {
    const rod = panels.find(wideRod)!;
    const n = Math.max(2, Math.ceil((rod.size.width - BAY_EPS) / ROD_BAY_MAX_IN));
    let placed = false;
    for (let i = 1; i < n; i++) {
      if (standBayDivider(panels, rod.position.x + (rod.size.width * i) / n, rod)) placed = true;
    }
    if (splitMatching(panels, wideRod)) changed = true;
    if (!placed) break;
    changed = true;
  }
  if (bearRaisedFloors(panels)) changed = true;
  return changed ? { ...project, panels } : project;
}

/** What actually sits above this rod. Nothing above drops the shelves clause. */
function rodAbove(rodY: number, rodH: number, lines: { y: number; fixed: boolean }[]): "hat" | "shelves" | "none" {
  const over = lines.filter((line) => line.y >= rodY + rodH - 0.05);
  if (!over.length) return "none";
  return over.some((line) => line.fixed) ? "hat" : "shelves";
}

/** `at` is the height the builder already wrote (a rod lowered for typed shelves says 42 1/2", not 43"). */
function bayRodNote(rodY: number, at: string, count: number, above: "hat" | "shelves" | "none"): string {
  const where = count > 1 ? ` in each of ${count} bays` : "";
  const over = above === "hat" ? ", with the fixed hat shelf above it" : above === "shelves" ? ", with the shelves above it" : "";
  return `A 1 1/4" closet rod in two sockets runs side to side ${at}" up${where}${over}${hangTail(rodY)}`;
}

/** Shelf and rod notes follow the bays actually built: a fixed hat is not an adjustable line, and each bay's rod is counted. */
export function hangingTalk(input: YardProject, prompt = ""): YardProject {
  if (!input.panels.length || input.refused) return input;
  const project = fitRodCount(input, prompt);
  const rods = project.panels.filter(isHangingRod);
  const rows = new Map<string, { y: number; fixed: boolean }>();
  for (const shelf of project.panels) {
    if (shelf.type !== "shelf") continue;
    const key = shelf.position.y.toFixed(2);
    const row = rows.get(key) ?? { y: shelf.position.y, fixed: false };
    if (/^Screwed fixed shelf/.test(shelf.cutNote ?? "")) row.fixed = true;
    rows.set(key, row);
  }
  const lines = [...rows.values()];
  const hats = lines.filter((line) => line.fixed);
  const hatY = hats.length ? Math.min(...hats.map((line) => line.y)) : null;
  const above = hatY == null ? [] : lines.filter((line) => !line.fixed && line.y > hatY + 0.05);
  const piecesNear = (ys: number[]) => project.panels.filter((p) => p.type === "shelf" && ys.some((y) => Math.abs(p.position.y - y) < 0.05)).length;
  let changed = false;
  let notes = [...(project.notes ?? [])];
  if (hats.length) {
    const hatPieces = piecesNear(hats.map((line) => line.y));
    const abovePieces = piecesNear(above.map((line) => line.y));
    const hatWord = hatPieces > 1 ? `${hatPieces} fixed hat shelf pieces over the rod` : "One fixed hat shelf over the rod";
    const extra = abovePieces > above.length ? ` (${abovePieces} pieces)` : "";
    const shelf = above.length
      ? `${hatWord}, and ${above.length} adjustable shelf line${above.length === 1 ? "" : "s"} above it${extra}.`
      : `${hatWord}. No pinned shelf above the hat.`;
    notes = notes.map((note) => {
      if (!/\d+ adjustable shelf lines?\./.test(note)) return note;
      changed = true;
      return shelf;
    });
  }
  if (rods.length && rods.every((rod) => Math.abs(rod.position.y - rods[0].position.y) < 0.6)) {
    const overRod = rodAbove(rods[0].position.y, rods[0].size.height, lines);
    notes = notes.map((note) => {
      if (!/closet rod in two sockets runs side to side/.test(note) || /second rod/.test(note)) return note;
      const at = note.match(/runs side to side ([\d /]+)" up/)?.[1] ?? String(Math.round(rods[0].position.y));
      const next = bayRodNote(rods[0].position.y, at, rods.length, overRod);
      if (note === next) return note;
      changed = true;
      return next;
    });
  }
  return changed || project !== input ? { ...project, notes } : project;
}

/**
 * Row 438: the typed rod count, after the rod split, is built exactly: a double-hang pair in (n − bays) bays and one
 * rod in each other bay. A count the bays can't take is said in a note naming what is built (or refused, rodCountRefusal).
 * Stacked rods are named upper and lower (row 441).
 */
function fitRodCount(project: YardProject, prompt: string): YardProject {
  const n = rodsAsked(prompt);
  const rodsNow = project.panels.filter(isHangingRod);
  if (!rodsNow.length) return project;
  const bayOf = (r: Panel) => r.position.x.toFixed(2);
  const keys = [...new Set(rodsNow.map(bayOf))].sort((a, b) => +a - +b);
  const tiers = (k: string) => rodsNow.filter((r) => bayOf(r) === k).sort((a, b) => b.position.y - a.position.y);
  const drop = new Set<Panel>();
  if (n >= 1 && rodsNow.length > n) {
    let pairs = Math.max(0, n - keys.length);
    for (const k of keys) {
      const t = tiers(k);
      if (t.length < 2) continue;
      if (pairs > 0) pairs--;
      else t.slice(1).forEach((r) => drop.add(r));
    }
  }
  const panels = project.panels
    .filter((p) => !drop.has(p))
    .map((p) => {
      if (!isHangingRod(p)) return p;
      const t = tiers(bayOf(p)).filter((r) => !drop.has(r));
      if (t.length < 2) return p;
      const bay = keys.length > 1 ? `Bay ${keys.indexOf(bayOf(p)) + 1} ` : "";
      const tier = t[0] === p ? "upper" : "lower";
      return { ...p, name: bay ? `${bay}${tier} hanging rod` : `${tier[0].toUpperCase()}${tier.slice(1)} hanging rod` };
    });
  const rods = panels.filter(isHangingRod);
  let notes = [...(project.notes ?? [])];
  const pairBays = keys.filter((k) => rods.filter((r) => bayOf(r) === k).length > 1).length;
  if (drop.size || (pairBays && keys.length > 1)) {
    const hi = Math.round(Math.max(...rods.map((r) => r.position.y)));
    const lo = Math.round(Math.min(...rods.map((r) => r.position.y)));
    const where = pairBays === keys.length ? `in each of the ${keys.length} bays` : `in ${pairBays} of the ${keys.length} bays, and one rod ${hi}" up in each other bay`;
    const rodNote = pairBays ? `${rods.length} closet rods, 1 1/4" in two sockets each, run side to side: a double-hang pair ${lo}" and ${hi}" up ${where}.` : singleRodNote(hi);
    notes = notes.map((note) => (/closet rod in two sockets runs side to side/.test(note) ? rodNote : note));
  }
  if (n >= 1 && rods.length !== n) {
    const built = rods.length === 1 ? "One rod is" : `${rods.length} rods are`;
    const why =
      rods.length > n
        ? `, one in each of the ${keys.length} bays: a rod can't pass through a divider`
        : project.panels.some((p) => /drawer/i.test(p.name))
          ? `: the drawers leave room for one rod in each hanging bay, not a double-hang pair`
          : `: ${n} rods need the box at least ${wideFor(n)}" wide`; // row 449
    notes.push(`You asked for ${n} rod${n === 1 ? "" : "s"}. ${built} built${why}.`);
  }
  if (drop.size && !pairBays && /\bdouble\s*(?:hang|rod)s?\b/i.test(prompt)) // row 450: say which word won
    notes.push(
      rods.length === n
        ? `You asked for ${n} rod${n === 1 ? "" : "s"} and double hang. The count wins: ${n === 1 ? "one rod is" : `${n} rods are`} built, ${Math.round(Math.max(...rods.map((r) => r.position.y)))}" up.`
        : `You asked for ${n} rod${n === 1 ? "" : "s"} and double hang. There is no double-hang pair: each of the ${keys.length} bays gets one rod, ${Math.round(Math.max(...rods.map((r) => r.position.y)))}" up.`, // row 463
    );
  return drop.size || pairBays || notes.length !== (project.notes ?? []).length ? { ...project, panels, notes } : project;
}
