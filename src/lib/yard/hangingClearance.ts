/**
 * Hanging clearance (row 209): a clothes hanger is about 18" across the shoulders, so a rod
 * that runs side to side, parallel to the front, needs about 20" of interior depth (a 24" box
 * is the usual untyped depth). Below that, the rod is a front-to-back pull-out, or the build
 * is refused with a depth that does hang. A pull-out is named so the check can tell it apart.
 */
import { inchFrac } from "./inchText";
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
/** Below this, even a pull-out rod has nowhere to live. */
export const PULL_OUT_MIN_IN = 12;
/** Long-hang rod centerline, inches off the floor. */
export const LONG_HANG_IN = 66;
export const LONG_HANG_LO = 64;
export const LONG_HANG_HI = 70;
/** Double-hang lower rod. */
export const DOUBLE_HANG_IN = 42;
/** A closet rod sags past this clear span, so a wide bay gets a divider. */
export const ROD_BAY_MAX_IN = 42;
export const ROD_DIA = 1.25;

export function sideHangFits(interiorIn: number): boolean {
  return interiorIn + CLEAR_TOL >= HANGER_CLEAR_IN;
}

/** A wardrobe, armoire, or closet that hangs clothes. Linen and towel closets do not. */
export function isClothesRodPrompt(lower: string): boolean {
  if (/\blinen\b|\btowel\b/.test(lower) && !/\bwardrobe\b/.test(lower)) return false;
  if (/\bwardrobe\b|\barmoire\b/.test(lower)) return true;
  return /\bcloset\b/.test(lower) && /system|walk-?in|along the wall|wall of closets|\brod\b|\bhang\b|\brail\b/.test(lower);
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
  if (doubleHang && cap >= 80) {
    const upper = Math.min(84, cap);
    if (upper >= DOUBLE_HANG_IN + 34) return [DOUBLE_HANG_IN, upper];
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

const ROD_NAME = /\bhanging rod\b|\bclothes rod\b/i;

export function isPullOutRod(p: { name: string }): boolean {
  return /pull-out/i.test(p.name);
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

/** Side-to-side rods must clear a hanger. An explicit pull-out rod is the shallow-box alternative. */
export function hangingClearanceIssues(p: YardProject): string[] {
  if (p.refused || !p.panels.length) return [];
  const rods = p.panels.filter((x) => ROD_NAME.test(x.name));
  const side = rods.filter((x) => !isPullOutRod(x));
  if (!side.length) return [];
  const out: string[] = [];
  const turned = side.find((x) => longAxis(x) !== "width");
  if (turned) out.push(`${turned.name} does not run side to side across the width`);
  const interior = hangerInterior(p);
  if (!sideHangFits(interior)) out.push(`hanging rod in a ${inchFrac(interior)}" interior (hangers need about ${HANGER_CLEAR_IN}")`);
  return out;
}

/**
 * A typed depth too shallow for a pull-out is refused. The named 22" builds a real side-to-side rod.
 * Returns null when the build stands.
 */
export function hangingDepthRefusal(p: YardProject, prompt: string): YardProject | null {
  if (p.refused || !p.panels.length) return null;
  const lower = prompt.toLowerCase();
  if (!isClothesRodPrompt(lower) && clothesRodDefaultDepth(lower, "") == null) return null;
  if (!/(?:\bdeep\b|\bdepth\b)/i.test(prompt)) return null;
  if (p.overall.depth + 1e-6 >= PULL_OUT_MIN_IN) return null;
  const noun = askedNoun(p);
  const a = /^[aeio]/i.test(noun) ? "An" : "A";
  const why = `${a} ${noun.toLowerCase()} needs at least ${inchFrac(HANGER_MIN_DEPTH_IN)}" deep so clothes can hang (hangers need about ${HANGER_CLEAR_IN}" inside). Nothing is built at ${inchFrac(p.overall.depth)}".`;
  return { ...p, name: noun, panels: [], instances: [], refused: why, cardNote: why, notes: [why] };
}
