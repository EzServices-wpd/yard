/**
 * Free-standing open frames: posts and rails of linear stock, no closing panel and no back.
 *
 * A uniform frame carries its weight about halfway up. It starts to tip when it is leaned far enough
 * that this weight passes the edge of the base. That lean, measured from vertical, is atan(base / height).
 * At a base of half the height the lean is about 27°, which is enough that a bump or a ball into a light
 * frame does not throw it over. At a quarter (a 12" base under a 4 ft frame) the lean is about 14° and the
 * frame tips. Shop practice for a bookcase or a goal is the same line: below half the height, anchor it or
 * give it a wider base.
 *
 * Frames shorter than 24" are tabletop pieces. Their proportions stay as they were designed.
 * A diagonal that stays inside the posts stops the rectangle from racking. It does not move the ground
 * the frame stands on, so it does not by itself keep a tall frame from tipping. Feet, splayed legs, and
 * rear supports count because the base is measured from every part that meets the ground.
 *
 * When the depth was not typed and that depth is what makes the base too small, the frame's own depth
 * members are lengthened and the rear posts move back until the base is half the height. The stock is
 * the stock the frame is already cut from. A depth the person typed is kept, and the note says the frame
 * will tip.
 */
import { getCatalogItem } from "./catalog";
import { inchFrac } from "./inchText";
import { typedDepth } from "./typedAxis";
import type { Panel, YardProject } from "./types";

/** Below this height the piece is a tabletop frame, not a standing one. */
export const OPEN_FRAME_MIN_HEIGHT = 24;
/** The base, in each plan direction, has to be at least this share of the height. */
export const OPEN_FRAME_BASE_RATIO = 0.5;

export type OpenFrameStance = {
  /** Posts and rails only, free-standing, tall enough to tip, with a real front and a real back. */
  open: boolean;
  height: number;
  /** Ground reach, left to right. */
  baseWidth: number;
  /** Ground reach, front to back. */
  baseDepth: number;
  /** A diagonal member inside the frame. It does not widen the base. */
  hasDiagonal: boolean;
  /** The base is under half the height on its short side. */
  tippy: boolean;
  /** The front-to-back base is the side under half the height, so a deeper base would help. */
  depthIsCause: boolean;
};

const SKIP_KIND = new Set(["ladder", "opening", "closet"]);

function sortedDims(p: Panel): [number, number, number] {
  return [p.size.width, p.size.height, p.size.depth].sort((a, b) => a - b) as [number, number, number];
}

/**
 * A face that closes a side. A sheet, or a thin skin whose two other sides are both a face
 * (a reindeer's body boards), not a stick. A 2×4's thickness is over an inch, so a post-and-rail
 * frame is not a skin.
 */
function isClosingPanel(p: Panel): boolean {
  if (!p.materialId || p.materialId === "hardware") return false;
  const item = getCatalogItem(p.materialId);
  const [a, b, c] = sortedDims(p);
  if (item?.formFactor === "sheet" || item?.category === "sheet_goods" || item?.category === "cardboard") return b > 6 && c > 6;
  return a <= 1.05 && b > 4 && c > 8;
}

/** A stick of pipe, tube, dowel, or a board used on edge. Not a panel. */
function isLinearMember(p: Panel): boolean {
  if (!p.materialId || p.materialId === "hardware") return false;
  if (isClosingPanel(p)) return false;
  const item = getCatalogItem(p.materialId);
  const ff = item?.formFactor;
  if (ff === "pipe" || ff === "tube" || ff === "stick" || ff === "dowel" || ff === "board") return true;
  const [a, b] = sortedDims(p);
  return a <= 3.6 && b <= 6.5;
}

/** Two of the three dimensions are long: a diagonal drawn in its box, or a strut. */
function isDiagonal(p: Panel): boolean {
  if (p.strut) return true;
  if (isClosingPanel(p)) return false;
  const [a, b, c] = sortedDims(p);
  return a <= 3.6 && b > a * 3 && c > a * 3 && b > 8;
}

function isUpright(p: Panel): boolean {
  return p.size.height + 0.01 >= p.size.width && p.size.height + 0.01 >= p.size.depth && p.size.height > 12 && p.position.y < 6;
}

/** Front posts and rear posts, with air between them. A flat ladder has none. */
function hasFrontAndRear(panels: Panel[]): boolean {
  const spans = panels
    .filter(isUpright)
    .map((p) => [p.position.z, p.position.z + p.size.depth] as const)
    .sort((a, b) => a[0] - b[0]);
  if (spans.length < 2) return false;
  let end = spans[0][1];
  for (let i = 1; i < spans.length; i++) {
    if (spans[i][0] > end + 2) return true;
    end = Math.max(end, spans[i][1]);
  }
  return false;
}

function groundPanels(panels: Panel[]): Panel[] {
  const low = Math.min(...panels.map((p) => p.position.y));
  return panels.filter((p) => p.position.y <= low + 0.75);
}

export function openFrameStance(project: YardProject): OpenFrameStance {
  const empty = { open: false, height: 0, baseWidth: 0, baseDepth: 0, hasDiagonal: false, tippy: false, depthIsCause: false };
  const panels = project.panels ?? [];
  const mode = project.assumptions?.installMode;
  if (!panels.length || project.fitted || project.pocket || project.refused) return empty;
  if (mode && mode !== "freestanding") return empty;
  if (SKIP_KIND.has(project.kind)) return empty;
  const structural = panels.filter((p) => p.materialId !== "hardware" && !/^dowel-/.test(p.materialId ?? ""));
  if (structural.length < 4 || structural.some(isClosingPanel) || !structural.every((p) => isLinearMember(p) || isDiagonal(p))) return empty;
  if (!hasFrontAndRear(structural)) return empty;
  const height = project.overall?.height ?? Math.max(...panels.map((p) => p.position.y + p.size.height));
  if (!(height > OPEN_FRAME_MIN_HEIGHT)) return empty;
  const ground = groundPanels(panels);
  const baseWidth = Math.max(...ground.map((p) => p.position.x + p.size.width)) - Math.min(...ground.map((p) => p.position.x));
  const baseDepth = Math.max(...ground.map((p) => p.position.z + p.size.depth)) - Math.min(...ground.map((p) => p.position.z));
  const need = height * OPEN_FRAME_BASE_RATIO - 0.01;
  const tippy = Math.min(baseWidth, baseDepth) < need;
  return {
    open: true,
    height,
    baseWidth,
    baseDepth,
    hasDiagonal: structural.some(isDiagonal),
    tippy,
    depthIsCause: baseDepth < need,
  };
}

/** A depth the person named, or a depth the bench set. Null when the depth is the engine's own default. */
export function givenDepth(prompt: string, sizeOverride?: { depth?: number }): number | null {
  if (sizeOverride?.depth != null) return sizeOverride.depth;
  return typedDepth(prompt);
}

function runsAlongDepth(p: Panel): boolean {
  return p.size.depth > p.size.width + 0.01 && p.size.depth > p.size.height + 0.01;
}

/**
 * Lengthen the members that run front to back, and move the rear posts with them, until the base
 * is half the height. Cross-sections stay put. A given depth is not changed.
 */
export function stabilizeOpenFrame(project: YardProject, prompt: string, sizeOverride?: { depth?: number }): YardProject {
  const stance = openFrameStance(project);
  if (!stance.open || !stance.tippy || !stance.depthIsCause) return project;
  const height = stance.height;
  const need = height * OPEN_FRAME_BASE_RATIO;
  const given = givenDepth(prompt, sizeOverride);
  if (given != null) {
    if ((project.notes ?? []).some((n) => /will tip unless it is held/.test(n))) return project;
    const deep = project.overall?.depth ?? stance.baseDepth;
    const asGiven = Math.abs(given - deep) < 0.75 ? ", as given" : "";
    const note = `Built ${inchFrac(deep)}" deep${asGiven}. This frame is ${inchFrac(height)}" tall, and a free-standing frame stands when the base is at least half the height (${inchFrac(need)}" front to back), so this one will tip unless it is held.`;
    return { ...project, notes: [...(project.notes ?? []), note] };
  }
  const panels0 = project.panels;
  const z0 = Math.min(...panels0.map((p) => p.position.z));
  const z1 = Math.max(...panels0.map((p) => p.position.z + p.size.depth));
  const delta = need - (z1 - z0);
  if (delta <= 0.01) return project;
  const mid = (z0 + z1) / 2;
  const panels = panels0.map((p) => {
    const lo = p.position.z;
    const hi = lo + p.size.depth;
    const spans = lo < mid - 0.01 && hi > mid + 0.01;
    if (spans && runsAlongDepth(p)) return { ...p, size: { ...p.size, depth: p.size.depth + delta } };
    if (!spans && lo + p.size.depth / 2 >= mid - 0.01) return { ...p, position: { ...p.position, z: p.position.z + delta } };
    return p;
  });
  const depth = Math.round((Math.max(...panels.map((p) => p.position.z + p.size.depth)) - Math.min(...panels.map((p) => p.position.z))) * 1e4) / 1e4;
  // The second sentence must not say tall, high, wide, or deep: an "Assumed" note is scanned for those
  // words, and a mention of another axis would swallow that axis's own assumed note.
  const note = `Assumed ${inchFrac(depth)}" deep (default size) — type a depth to lock it. A free-standing frame of ${inchFrac(height)}" needs a base at least half that, front to back.`;
  const notes = (project.notes ?? []).some((n) => /free-standing frame stands when the base/.test(n)) ? project.notes : [...(project.notes ?? []), note];
  return { ...project, panels, overall: { ...project.overall, depth }, notes };
}

/** Learned-recipe gate: an open frame that is still tippy after the build is not certified. */
export function openFrameTipFailures(project: YardProject): string[] {
  const s = openFrameStance(project);
  if (!s.open || !s.tippy) return [];
  const base = Math.min(s.baseWidth, s.baseDepth);
  return [`tips: free-standing open frame is ${inchFrac(s.height)}" tall on a ${inchFrac(base)}" base`];
}
