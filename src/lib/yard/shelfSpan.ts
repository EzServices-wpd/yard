/**
 * Fixed shelves housed in a carcass: clear span follows the stock.
 *
 * Sagulator (woodbin.com/calcs/sagulator), simply supported, ~12" deep, ~40 lb/ft of books,
 * sag near 0.02" per foot, plus creep. Plywood has no creep factor; MDF and solid wood use
 * Sagulator's 1.5 creep, so the shop spans at 3/4" are plywood 30", MDF 24", 1× pine 26".
 * The same sag per foot means the clear span scales with thickness (L ∝ t).
 * A span equal to the limit stays (a 31 1/2" case is 30" inside). Any adjustable shelf
 * past that gets a fixed divider housed in the top and the bottom, and each bay is at or
 * under the stock limit. A fixed shelf may instead carry a 1×3 or 1×4 on edge, glued and
 * screwed under the front edge, when that section's sag (simple support plus creep) is
 * within 0.02" per foot. An island with a solid top is not a shelf span. The same panels
 * the model, cut list, steps and Buy read.
 */
import { createId } from "@/lib/utils";
import type { Panel, YardProject } from "./types";
import { inchFrac } from "./inchText";
import { wantsFixedGlueShelves } from "./honesty";
import { solidsOverlap } from "./solids";
import { allowSpanIn, wantsOpenSpan } from "./spanCheck";
import { closetShelfClearIn } from "./shelfClear";

export { closetShelfMinHeight, rodShelfMinHeight, typedRodDemand, typedShelfDemand } from "./shelfClear";

const EPS = 1 / 32;
/** Shelves shallower than this carry light loads (a spice rack). The span rule does not apply. */
const LIGHT_DEPTH = 8;
/** Clear of a screw joint (0.07") and still a pin end (within 0.1" and 0.26"). */
const PIN_GAP = 0.08;
const PIN_NOTE = 'Drill 13/64" pin holes on both faces at each shelf, 1 1/4" from the front.';
const PLATES = new Set(["shelf", "top"]);
const STANDS = new Set(["shelf", "bottom", "top", "counter"]);

export type ShelfSpanHit = { name: string; span: number; limit: number; thick: number; materialId: string };

/** Longest clear span still allowed for this shelf stock. Infinity means the rule does not apply. */
export function shelfSpanLimit(materialId: string | undefined, thick: number): number {
  if (!(thick >= 0.4)) return Infinity;
  const id = (materialId ?? "").toLowerCase();
  // 3/4" shop spans, then L ∝ t. See the file comment for the Sagulator basis.
  const base = /mdf|particle|chipboard|hardboard/.test(id) ? 24 : /plywood|^ply-/.test(id) || !id ? 30 : 26;
  return Math.round(base * (thick / 0.75) * 16) / 16;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

/** Books at about 40 lb per foot of shelf, the load behind the shop spans. */
const BOOK_LB_PER_FT = 40;
/** Allowed sag: 0.02" per foot of span. */
const SAG_PER_FT = 0.02;
/**
 * E (psi) so a 12" deep 3/4" shelf at its shop span sags exactly 0.02" per foot.
 * δ = 5·w·L⁴·creep / (384·E·I), δ = L/600, I = 12·t³/12, w = 40/12.
 */
const E_PLY = 1_666_667;
const E_PINE = 1_627_407;
const E_MDF = 1_280_000;
/** 1×3 then 1×4, actual height when the board stands on edge. */
const EDGE_RAILS: { height: number; materialId: string }[] = [
  { height: 2.5, materialId: "lumber-1x3-8" },
  { height: 3.5, materialId: "lumber-1x4-8" },
];

function creepOf(materialId: string | undefined): number {
  const id = (materialId ?? "").toLowerCase();
  return /plywood|^ply-/.test(id) || !id ? 1 : 1.5;
}

function modulusOf(materialId: string | undefined): number {
  const id = (materialId ?? "").toLowerCase();
  if (/mdf|particle|chipboard|hardboard/.test(id)) return E_MDF;
  if (/plywood|^ply-/.test(id) || !id) return E_PLY;
  return E_PINE;
}

/** Second moment of the shelf, plus a rail on edge glued under the front (transformed section). */
function sectionI(depth: number, thick: number, railH: number, n: number): number {
  const Is = depth * thick ** 3 / 12;
  const As = depth * thick;
  const ys = thick / 2;
  if (!(railH > 0)) return Is;
  const br = 0.75;
  const Ir = n * br * railH ** 3 / 12;
  const Ar = n * br * railH;
  const yr = -railH / 2;
  const yb = (As * ys + Ar * yr) / (As + Ar);
  return Is + As * (ys - yb) ** 2 + Ir + Ar * (yr - yb) ** 2;
}

/**
 * Simply supported sag, inches, with creep. `railH` is a 3/4" rail on edge under the front
 * (2.5 for a 1×3, 3.5 for a 1×4). Zero is the bare shelf.
 */
export function shelfSagIn(span: number, depth: number, thick: number, materialId: string | undefined, railH = 0): number {
  if (!(span > 0) || !(depth > 0) || !(thick > 0)) return 0;
  const Es = modulusOf(materialId);
  const n = railH > 0 ? modulusOf("lumber-1x4-8") / Es : 1;
  const I = sectionI(depth, thick, railH, n);
  const w = BOOK_LB_PER_FT / 12;
  return (5 * w * span ** 4 * creepOf(materialId)) / (384 * Es * I);
}

/** 0.02" of sag per foot of this span. */
export function sagLimitIn(span: number): number {
  return span * (SAG_PER_FT / 12);
}

function thickOf(panel: Panel): number {
  return Math.min(panel.size.width, panel.size.height, panel.size.depth);
}

function flatShelf(panel: Panel): boolean {
  if (!PLATES.has(panel.type) || panel.outline || /lid/i.test(panel.name)) return false;
  const t = thickOf(panel);
  return t >= 0.4 && t <= 2 && Math.abs(panel.size.height - t) < 0.08;
}

/** Both ends of the plate meet an upright or bay divider, so this is a housed carcass shelf, not a tabletop. */
function housed(plate: Panel, panels: Panel[]): boolean {
  const { x, y, z } = plate.position;
  const { width: w, height: h, depth: d } = plate.size;
  const members = panels.filter((q) => (q.type === "upright" || q.type === "divider") && !/\b(?:leg|post)s?\b/i.test(q.name));
  if (members.filter((q) => q.type === "upright").length < 2) return false;
  const meet = (edge: number, side: 0 | 1) =>
    members.some((q) => {
      const face = side === 0 ? q.position.x + q.size.width : q.position.x;
      if (Math.abs(face - edge) > 0.45) return false;
      const oy = overlap(y, y + h, q.position.y, q.position.y + q.size.height);
      const oz = overlap(z, z + d, q.position.z, q.position.z + q.size.depth);
      if (oz < d * 0.4) return false;
      if (oy >= h - 0.08) return true;
      // A fixed shelf's inner end is carried by the divider that stands on it and runs up to the top.
      return isFixedSpanShelf(plate) && Math.abs(q.position.y - (y + h)) <= 0.35 && q.size.height >= h - 0.02;
    });
  return meet(x, 0) && meet(x + w, 1);
}

function bearsPlate(plate: Panel, q: Panel): boolean {
  const top = q.position.y + q.size.height;
  if (Math.abs(top - plate.position.y) <= 0.35) return true;
  return q.position.y < plate.position.y - 0.1 && top > plate.position.y + plate.size.height + 0.1;
}

/** Vertical faces that already carry this plate. Pieces at one station add their depth together. */
function spanStops(plate: Panel, panels: Panel[]): number[] {
  const x0 = plate.position.x;
  const x1 = x0 + plate.size.width;
  const z0 = plate.position.z;
  const z1 = z0 + plate.size.depth;
  const stops = [x0, x1];
  const groups = new Map<number, Panel[]>();
  for (const q of panels) {
    if (q === plate || q.type === "back" || q.type === "door" || q.type === "rail" || q.type === "kick" || STANDS.has(q.type)) continue;
    if (q.size.width > 2.25 || q.size.height < 0.35) continue;
    const mid = Math.round((q.position.x + q.size.width / 2) * 4) / 4;
    if (mid <= x0 + 0.4 || mid >= x1 - 0.4) continue;
    groups.set(mid, [...(groups.get(mid) ?? []), q]);
  }
  for (const list of groups.values()) {
    if (!list.some((q) => bearsPlate(plate, q))) continue;
    const ranges = list
      .map((q) => [Math.max(z0, q.position.z), Math.min(z1, q.position.z + q.size.depth)] as [number, number])
      .filter(([a, b]) => b - a > 0.05)
      .sort((a, b) => a[0] - b[0]);
    let cover = 0;
    let end = -Infinity;
    for (const [a, b] of ranges) {
      const s = Math.max(a, end);
      if (b > s) cover += b - s;
      end = Math.max(end, b);
    }
    if (cover < plate.size.depth * 0.5) continue;
    const a = Math.min(...list.map((q) => q.position.x));
    const b = Math.max(...list.map((q) => q.position.x + q.size.width));
    stops.push(Math.max(x0, a), Math.min(x1, b));
  }
  return [...new Set(stops.map((n) => Math.round(n * 64) / 64))].sort((a, b) => a - b);
}

function clearGaps(plate: Panel, panels: Panel[]): [number, number][] {
  const stops = spanStops(plate, panels);
  const gaps: [number, number][] = [];
  for (let i = 1; i < stops.length; i++) if (stops[i] - stops[i - 1] > 0.2) gaps.push([stops[i - 1], stops[i]]);
  return gaps;
}

function lightShelf(plate: Panel): boolean {
  return plate.type === "shelf" && plate.size.depth < LIGHT_DEPTH;
}

function isHangingRod(panel: Panel): boolean {
  return panel.type === "rail" && /hanging rod/i.test(panel.name);
}

/** A rail, lip or rod the divider would cut through. A hanging rod is a bay, not a part to split. */
function splitsAtDivider(panel: Panel): boolean {
  if (isHangingRod(panel) || /^Center divider\b/.test(panel.name)) return false;
  return panel.type === "rail" || /\blip\b|\brail\b|\brod\b/i.test(panel.name);
}

function crossesHanging(panels: Panel[], x: number, y0: number, y1: number): boolean {
  return panels.some((q) => {
    if (!isHangingRod(q)) return false;
    if (overlap(x - 0.75, x + 0.75, q.position.x, q.position.x + q.size.width) <= 0) return false;
    return overlap(y0, y1, q.position.y - 0.05, q.position.y + q.size.height + 0.05) > 0;
  });
}

/** The shelf is the cap of a hanging-rod bay: the rod owns that opening (row 229). */
function hangingBayShelf(plate: Panel, panels: Panel[]): boolean {
  if (plate.type !== "shelf") return false;
  const x = plate.position.x + plate.size.width / 2;
  const y0 = plateBelow(panels, plate, x);
  return y0 != null && crossesHanging(panels, x, y0, plate.position.y);
}

/** A butcher-block or solid-top island is a slab, not a carcass shelf this rule divides. */
function solidTopIsland(project: YardProject, prompt = ""): boolean {
  const hay = `${prompt} ${project.prompt ?? ""} ${project.name ?? ""}`.toLowerCase();
  if (!/\bisland\b/.test(hay)) return false;
  if (/\bbutcher\b/.test(hay)) return true;
  return project.panels.some((p) => (p.type === "top" || p.type === "counter") && !!p.materialId && !/plywood|mdf|particle|hardboard|cardboard/.test(p.materialId));
}

export function shelfSpanViolations(project: YardProject): ShelfSpanHit[] {
  if (solidTopIsland(project)) return [];
  const out: ShelfSpanHit[] = [];
  for (const plate of project.panels) {
    if (plate.type !== "shelf" || !flatShelf(plate) || !housed(plate, project.panels)) continue;
    if (lightShelf(plate)) continue;
    const thick = thickOf(plate);
    const limit = shelfSpanLimit(plate.materialId, thick);
    const span = Math.max(0, ...clearGaps(plate, project.panels).map(([a, b]) => b - a));
    if (span <= limit + EPS) continue;
    // A fixed shelf may stay one piece when a 1×3 or 1×4 on edge under the front keeps the sag in limit.
    const x0 = plate.position.x;
    const rail = project.panels.find((q) => {
      if (!/^Front rail\b/.test(q.name)) return false;
      if (overlap(x0, x0 + plate.size.width, q.position.x, q.position.x + q.size.width) < plate.size.width * 0.8) return false;
      return Math.abs(q.position.y + q.size.height - plate.position.y) <= 0.12;
    });
    const braced = !!rail && isFixedSpanShelf(plate) && shelfSagIn(span, plate.size.depth, thick, plate.materialId, rail.size.height) <= sagLimitIn(span) + EPS;
    if (!braced) out.push({ name: plate.name, span, limit, thick, materialId: plate.materialId });
  }
  return out;
}

/** One shelf line per height. Bay pieces of that line are not extra shelves. */
export function shelfLineCount(shelves: Panel[]): number {
  return new Set(shelves.map((p) => Math.round(p.position.y * 4) / 4)).size;
}

/** Levels of the shelf stack: one height per shelf number. Two bays of Shelf 4 are one level. */
export function shelfLevelLayout(panels: Panel[]): { levels: number; keyed: number; minClear: number; shared: boolean } {
  const at = new Map<string, number>();
  const thickAt = new Map<number, number>();
  let split = false;
  for (const s of panels) {
    if (s.type !== "shelf" || s.outline) continue;
    if (!/\bshelf\b/i.test(s.name) || /nosing|climb|step-shelf|media shelf/i.test(s.name)) continue;
    const key = (s.name.match(/(\d+)\s*$/)?.[1] ?? s.name).toLowerCase();
    const y = Math.round(s.position.y * 4) / 4;
    const prev = at.get(key);
    if (prev != null && Math.abs(prev - y) > 0.02) split = true;
    else at.set(key, y);
    thickAt.set(y, Math.max(thickAt.get(y) ?? 0, s.size.height));
  }
  const ys = [...new Set(at.values())].sort((a, b) => a - b);
  let minClear = Infinity;
  for (let i = 1; i < ys.length; i++) minClear = Math.min(minClear, ys[i] - (ys[i - 1] + (thickAt.get(ys[i - 1]) ?? 0.75)));
  return { levels: ys.length, keyed: at.size, minClear: ys.length < 2 ? Infinity : minClear, shared: split || ys.length < at.size };
}

/** The typed count is still there: one height each, and a usable opening between them. */
export function shelfLevelsFit(panels: Panel[], asked: number): boolean {
  const layout = shelfLevelLayout(panels);
  return !layout.shared && layout.keyed === asked && layout.levels === asked && layout.minClear + 1e-6 >= closetShelfClearIn();
}

/** The shelf over a hanging bay is screwed to the uprights. A divider may stand on it. Loose pin shelves may not carry one. */
export function isFixedSpanShelf(panel: Panel): boolean {
  return panel.type === "shelf" && /^Screwed fixed shelf/.test(panel.cutNote ?? "");
}

/** Clear distance along the depth, between front-to-back supports that cover at least half the shelf. */
export function shelfDepthSpan(plate: Panel, panels: Panel[]): number {
  const z0 = plate.position.z;
  const z1 = z0 + plate.size.depth;
  const x0 = plate.position.x;
  const x1 = x0 + plate.size.width;
  const stops = [z0, z1];
  const groups = new Map<number, Panel[]>();
  for (const q of panels) {
    if (q === plate || q.size.depth > 2.25 || q.size.height < 0.35) continue;
    if (q.type === "back" || q.type === "door" || q.type === "rail" || q.type === "kick" || STANDS.has(q.type)) continue;
    const mid = Math.round((q.position.z + q.size.depth / 2) * 4) / 4;
    if (mid <= z0 + 0.4 || mid >= z1 - 0.4) continue;
    if (overlap(x0, x1, q.position.x, q.position.x + q.size.width) < plate.size.width * 0.5) continue;
    if (!bearsPlate(plate, q)) continue;
    groups.set(mid, [...(groups.get(mid) ?? []), q]);
  }
  for (const list of groups.values()) {
    stops.push(Math.max(z0, Math.min(...list.map((q) => q.position.z))), Math.min(z1, Math.max(...list.map((q) => q.position.z + q.size.depth))));
  }
  const s = [...new Set(stops.map((n) => Math.round(n * 64) / 64))].sort((a, b) => a - b);
  let span = 0;
  for (let i = 1; i < s.length; i++) span = Math.max(span, s[i] - s[i - 1]);
  return span;
}

function stockWord(id: string): string {
  const s = id.toLowerCase();
  if (/mdf|particle|chipboard|hardboard/.test(s)) return "MDF";
  if (/plywood/.test(s)) return "plywood";
  return "solid wood";
}

function plateBelow(panels: Panel[], plate: Panel, x: number): number | null {
  let y: number | null = null;
  for (const q of panels) {
    if (q === plate || !STANDS.has(q.type)) continue;
    const top = q.position.y + q.size.height;
    if (top > plate.position.y - 0.15) continue;
    if (overlap(x - 0.5, x + 0.5, q.position.x, q.position.x + q.size.width) <= 0) continue;
    if (overlap(plate.position.z, plate.position.z + plate.size.depth, q.position.z, q.position.z + q.size.depth) < 1) continue;
    if (y == null || top > y) y = top;
  }
  return y;
}

function depthBox(plate: Panel, panels: Panel[], x: number, y0: number, y1: number): { z: number; d: number } | null {
  let z0 = plate.position.z;
  let z1 = z0 + plate.size.depth;
  for (const q of panels) {
    if (q.type !== "back" && q.type !== "door" && q.type !== "kick" && q.type !== "glass_panel" && q.type !== "mirror") continue;
    if (overlap(x - 0.4, x + 0.4, q.position.x, q.position.x + q.size.width) <= 0) continue;
    if (overlap(y0, y1, q.position.y, q.position.y + q.size.height) <= 0) continue;
    const q0 = q.position.z;
    const q1 = q0 + q.size.depth;
    const mid = (z0 + z1) / 2;
    // Clear of the back and the door by more than a screw joint (0.07"), so the back can still
    // go on before the shelves and the divider goes on after the shelf it stands on.
    if (q1 <= mid) z0 = Math.max(z0, q1 + 0.125);
    else if (q0 >= mid) z1 = Math.min(z1, q0 - 0.125);
  }
  // The cut list rounds to 1/8". Keep the divider on that grid so the model and the cut agree.
  const d = Math.floor((z1 - z0 + 1e-6) * 8) / 8;
  if (d < Math.max(2, plate.size.depth * 0.5)) return null;
  return { z: z0, d };
}

function hitsDrawer(panels: Panel[], x: number, y: number, z: number, w: number, h: number, d: number): boolean {
  return panels.some((q) => {
    if (q.type !== "drawer" && !/drawer/i.test(q.name)) return false;
    return (
      overlap(x, x + w, q.position.x, q.position.x + q.size.width) > 0.05 &&
      overlap(y, y + h, q.position.y, q.position.y + q.size.height) > 0.05 &&
      overlap(z, z + d, q.position.z, q.position.z + q.size.depth) > 0.05
    );
  });
}

/** The knee stays open: no divider lands between the knee dividers where the bottom is cut away. */
function inOpenKnee(panels: Panel[], x: number, y0: number): boolean {
  const knees = panels.filter((q) => /knee divider/i.test(q.name)).map((q) => q.position.x + q.size.width / 2).sort((a, b) => a - b);
  if (knees.length < 2 || x <= knees[0] + 0.5 || x >= knees[knees.length - 1] - 0.5) return false;
  return !panels.some(
    (q) =>
      (q.type === "bottom" || q.type === "shelf") &&
      q.position.y < y0 &&
      q.position.y + q.size.height <= y0 + 0.2 &&
      overlap(x - 1, x + 1, q.position.x, q.position.x + q.size.width) > 0,
  );
}

/** A thinner side (a 1/2" stamp) leaves the shelf short of the upright. Pull it back so it is carried by the sides. */
function seatToSides(plate: Panel, panels: Panel[]) {
  if (!housed(plate, panels)) return;
  const uprights = panels.filter((q) => q.type === "upright" && !/\b(?:leg|post)s?\b/i.test(q.name));
  const x0 = plate.position.x;
  const x1 = x0 + plate.size.width;
  const face = (edge: number, side: 0 | 1) =>
    uprights.find((q) => {
      const at = side === 0 ? q.position.x + q.size.width : q.position.x;
      if (Math.abs(at - edge) > 0.45) return false;
      const oy = overlap(plate.position.y, plate.position.y + plate.size.height, q.position.y, q.position.y + q.size.height);
      const oz = overlap(plate.position.z, plate.position.z + plate.size.depth, q.position.z, q.position.z + q.size.depth);
      return oy >= plate.size.height - 0.08 && oz >= plate.size.depth * 0.4;
    });
  const left = face(x0, 0);
  const right = face(x1, 1);
  if (!left || !right) return;
  const nx = Math.min(x0, left.position.x + left.size.width);
  const nx1 = Math.max(x1, right.position.x);
  if (nx1 - nx < 4 || nx1 - nx > plate.size.width + 1) return;
  plate.position = { ...plate.position, x: nx };
  plate.size = { ...plate.size, width: nx1 - nx };
}

function alreadyHeld(plate: Panel, panels: Panel[], at: number): boolean {
  return panels.some((q) => {
    if ((q.type !== "divider" && q.type !== "upright") || Math.abs(q.position.x + q.size.width / 2 - at) > 1) return false;
    const top = q.position.y + q.size.height;
    return Math.abs(top - plate.position.y) <= 0.35 || (q.position.y < plate.position.y && top > plate.position.y + plate.size.height);
  });
}

/**
 * A depth support from the loaded-top rule crosses a width divider in a very deep case.
 * Cut the divider into the bays between those supports so the two meet on a face.
 */
export function separateSpanSupports(project: YardProject): YardProject {
  const kept = project.panels.filter((b) => b.name !== "Shelf bearer" || !project.panels.some((q) => q !== b && solidsOverlap(b, q)));
  const base = kept.length === project.panels.length ? project : { ...project, panels: kept };
  const blocks = base.panels.filter((p) => p.name.startsWith("Center support"));
  if (!blocks.length || !base.panels.some((p) => /^Center divider\b/.test(p.name))) return base;
  const panels = base.panels.map((p) => ({ ...p, position: { ...p.position }, size: { ...p.size } }));
  let changed = false;
  for (let i = panels.length - 1; i >= 0; i--) {
    const d = panels[i];
    if (!/^Center divider\b/.test(d.name)) continue;
    const hits = blocks
      .filter((b) => {
        const ox = overlap(d.position.x, d.position.x + d.size.width, b.position.x, b.position.x + b.size.width);
        const oy = overlap(d.position.y, d.position.y + d.size.height, b.position.y, b.position.y + b.size.height);
        const oz = overlap(d.position.z, d.position.z + d.size.depth, b.position.z, b.position.z + b.size.depth);
        return ox > 1 / 16 && oy > 1 / 16 && oz > 1 / 16;
      })
      .map((b) => [b.position.z, b.position.z + b.size.depth] as [number, number])
      .sort((a, b) => a[0] - b[0]);
    if (!hits.length) continue;
    const pieces: { z: number; d: number }[] = [];
    let z = d.position.z;
    const end = z + d.size.depth;
    for (const [a, b] of hits) {
      if (a - z >= 2) pieces.push({ z, d: a - z });
      z = Math.max(z, b);
    }
    if (end - z >= 2) pieces.push({ z, d: end - z });
    if (!pieces.length) continue;
    panels.splice(i, 1, ...pieces.map((piece) => ({ ...d, id: createId("di"), position: { ...d.position, z: piece.z }, size: { ...d.size, depth: piece.d } })));
    changed = true;
  }
  return changed ? { ...base, panels } : base;
}

/** Cut a rail, lip or rod where a divider crosses it. The first piece keeps its name. Hanging rods are not cut. */
function splitCrossed(panels: Panel[], dividers: Panel[]) {
  for (let i = panels.length - 1; i >= 0; i--) {
    const rod = panels[i];
    if (!splitsAtDivider(rod)) continue;
    const hits = dividers
      .filter((d) => {
        const ox = overlap(rod.position.x, rod.position.x + rod.size.width, d.position.x, d.position.x + d.size.width);
        const oy = overlap(rod.position.y, rod.position.y + rod.size.height, d.position.y, d.position.y + d.size.height);
        const oz = overlap(rod.position.z, rod.position.z + rod.size.depth, d.position.z, d.position.z + d.size.depth);
        return ox > 0.02 && oy > 0.02 && oz > 0.02;
      })
      .sort((a, b) => a.position.x - b.position.x);
    if (!hits.length) continue;
    const pieces: { x: number; w: number }[] = [];
    let x = rod.position.x;
    const end = x + rod.size.width;
    for (const d of hits) {
      if (d.position.x - x >= 2) pieces.push({ x, w: d.position.x - x });
      x = Math.max(x, d.position.x + d.size.width);
    }
    if (end - x >= 2) pieces.push({ x, w: end - x });
    panels.splice(i, 1);
    pieces.forEach((piece, n) => {
      panels.push({
        ...rod,
        id: createId("ra"),
        name: pieces.length === 1 || n === 0 ? rod.name : `${rod.name} ${n + 1}`,
        position: { ...rod.position, x: piece.x },
        size: { ...rod.size, width: piece.w },
      });
    });
  }
}

/** Widest shelf opening. Trimming a divider must not make this larger. */
function widestShelfGap(panels: Panel[]): number {
  let span = 0;
  for (const plate of panels) {
    if (plate.type !== "shelf" || !flatShelf(plate) || !housed(plate, panels) || lightShelf(plate)) continue;
    for (const [a, b] of clearGaps(plate, panels)) span = Math.max(span, b - a);
    span = Math.max(span, shelfDepthSpan(plate, panels));
  }
  return span;
}

/** A divider that still shares solid space with another part is trimmed off that part, or dropped. */
function clearOverlaps(panels: Panel[]) {
  const eps = 1 / 16;
  const before = widestShelfGap(panels);
  const saved = panels
    .filter((d) => /^Center divider\b/.test(d.name))
    .map((d) => ({ id: d.id, position: { ...d.position }, size: { ...d.size } }));
  for (let pass = 0; pass < 4; pass++) {
    let hit = false;
    for (const div of panels) {
      if (!/^Center divider\b/.test(div.name)) continue;
      for (const other of panels) {
        if (other === div || !solidsOverlap(div, other)) continue;
        hit = true;
        const box = (axis: "x" | "y" | "z", size: "width" | "height" | "depth") => {
          const q0 = other.position[axis];
          const q1 = q0 + other.size[size];
          const mid = div.position[axis] + div.size[size] / 2;
          if (q1 <= mid) {
            const next = q1 + eps;
            div.size = { ...div.size, [size]: div.position[axis] + div.size[size] - next };
            div.position = { ...div.position, [axis]: next };
          } else div.size = { ...div.size, [size]: Math.max(0, q0 - eps - div.position[axis]) };
        };
        const yOv = overlap(div.position.y, div.position.y + div.size.height, other.position.y, other.position.y + other.size.height);
        const zOv = overlap(div.position.z, div.position.z + div.size.depth, other.position.z, other.position.z + other.size.depth);
        if (zOv <= yOv) box("z", "depth");
        else box("y", "height");
      }
    }
    if (!hit) break;
  }
  for (let i = panels.length - 1; i >= 0; i--) {
    const div = panels[i];
    if (/^Center divider\b/.test(div.name) && (div.size.height < 0.4 || div.size.depth < 2 || div.size.width < 0.2)) {
      panels.splice(i, 1);
    }
  }
  // A trim that opens a shelf past its stock limit is undone. The support stays.
  if (widestShelfGap(panels) > before + EPS) {
    for (const div of panels) {
      const snap = saved.find((s) => s.id === div.id);
      if (!snap) continue;
      div.position = { ...snap.position };
      div.size = { ...snap.size };
    }
  }
}

function dividerAt(panels: Panel[], added: Panel[], plate: Panel, at: number, y0: number, y1: number, t: number): Panel | null {
  if (y1 - y0 < t - 0.02 || inOpenKnee(panels, at, y0)) return null;
  const box = depthBox(plate, panels, at, y0, y1);
  if (!box) return null;
  const piece = { x: at - t / 2, y: y0, z: box.z, w: t, h: y1 - y0, d: box.d };
  if (hitsDrawer(panels, piece.x, piece.y, piece.z, piece.w, piece.h, piece.d)) return null;
  const panel: Panel = {
    id: createId("di"),
    type: "divider",
    name: "Center divider",
    position: { x: piece.x, y: piece.y, z: piece.z },
    size: { width: piece.w, height: piece.h, depth: piece.d },
    materialId: plate.materialId,
  };
  panels.push(panel);
  added.push(panel);
  return panel;
}

function overSpan(plate: Panel, panels: Panel[]): boolean {
  if (!flatShelf(plate) || !housed(plate, panels) || lightShelf(plate)) return false;
  const cap = shelfSpanLimit(plate.materialId, thickOf(plate));
  return clearGaps(plate, panels).some(([a, b]) => b - a > cap + EPS);
}

/** Floor of this bay (the bottom under the shelf) up to the underside of the top. Never a loose shelf. */
function columnEnds(panels: Panel[], x: number, plate: Panel): { y0: number; y1: number } | null {
  let y0 = 0;
  let bottom = false;
  for (const q of panels) {
    if (q.type !== "bottom") continue;
    const top = q.position.y + q.size.height;
    if (top > plate.position.y + 0.05) continue;
    if (overlap(x - 0.5, x + 0.5, q.position.x, q.position.x + q.size.width) <= 0) continue;
    if (!bottom || top > y0) { y0 = top; bottom = true; }
  }
  if (!bottom && !panels.some((q) => q.type === "upright" && overlap(x - 0.5, x + 0.5, q.position.x, q.position.x + q.size.width) > 0)) return null;
  let y1: number | null = null;
  for (const q of panels) {
    if ((q.type !== "top" && q.type !== "counter" && q.type !== "bottom") || q.position.y < y0 + 0.4) continue;
    if (q.type === "bottom" && q.position.y + q.size.height <= plate.position.y + 0.05) continue;
    if (overlap(x - 0.5, x + 0.5, q.position.x, q.position.x + q.size.width) <= 0) continue;
    if (y1 == null || q.position.y < y1) y1 = q.position.y;
  }
  if (y1 == null || y1 - y0 < 2) return null;
  // A hanging rod owns its bay when the shelf above it is already inside the span check.
  // The divider stands on that shelf and the rod stays one piece. A wider hat is cut with
  // the rod, one of each per bay, because a rail under it does not shorten the span check.
  const rod = panels.find((q) => isHangingRod(q) && overlap(x - 0.5, x + 0.5, q.position.x, q.position.x + q.size.width) > 0 && q.position.y < y1 && q.position.y + q.size.height > y0);
  if (rod) {
    const hat = panels
      .filter((p) => p.type === "shelf" && !p.outline && p.position.y >= rod.position.y + rod.size.height - 0.05 && overlap(x - 0.5, x + 0.5, p.position.x, p.position.x + p.size.width) > 0)
      .sort((a, b) => a.position.y - b.position.y)[0];
    if (!hat) return null;
    const allow = allowSpanIn(thickOf(hat), "shelf") * 1.1;
    if (hat.size.width <= allow + EPS) {
      y0 = hat.position.y + hat.size.height;
      if (y1 - y0 < 2) return null;
    }
  }
  return { y0, y1 };
}

/** One fixed divider per station, housed in the top and the bottom, wherever a taken shelf is past its stock limit. */
function placeBayDividers(panels: Panel[], added: Panel[], take: (plate: Panel) => boolean) {
  const stations = new Map<number, number>();
  for (const plate of panels) {
    if (plate.type !== "shelf" || lightShelf(plate) || !overSpan(plate, panels) || !take(plate)) continue;
    const limit = shelfSpanLimit(plate.materialId, thickOf(plate));
    const t = plate.size.height;
    if (!Number.isFinite(limit)) continue;
    for (const [a, b] of clearGaps(plate, panels)) {
      if (b - a <= limit + EPS) continue;
      let k = Math.max(2, Math.ceil((b - a) / limit));
      while (k < 8 && (b - a - (k - 1) * t) / k > limit + EPS) k++;
      for (let i = 1; i < k; i++) {
        const at = a + ((b - a) * i) / k;
        stations.set(Math.round(at * 8) / 8, at);
      }
    }
  }
  for (const at of stations.values()) {
    const plate = panels
      .filter((p) => p.type === "shelf" && !lightShelf(p) && p.position.x < at && at < p.position.x + p.size.width)
      .sort((a, b) => a.position.y - b.position.y)[0];
    if (!plate || alreadyHeld(plate, panels, at)) continue;
    const ends = columnEnds(panels, at, plate);
    if (!ends || inOpenKnee(panels, at, ends.y0)) continue;
    dividerAt(panels, added, plate, at, ends.y0, ends.y1, plate.size.height);
  }
}

function crosses(a: Panel, d: Panel): boolean {
  return (
    overlap(a.position.x, a.position.x + a.size.width, d.position.x, d.position.x + d.size.width) > 0.2 &&
    overlap(a.position.y, a.position.y + a.size.height, d.position.y, d.position.y + d.size.height) > 0.2 &&
    overlap(a.position.z, a.position.z + a.size.depth, d.position.z, d.position.z + d.size.depth) > 0.2
  );
}

/** Each bay keeps its own shelf and, in a wardrobe, its own rod. The pieces meet the divider on a face. */
function splitWide(panels: Panel[], dividers: Panel[]) {
  // Pieces meet the divider on a face. A gap here walks the cut off the 1/8" the cut list uses.
  const gap = 0;
  for (let i = panels.length - 1; i >= 0; i--) {
    const part = panels[i];
    const shelf = part.type === "shelf" && !part.outline;
    if (!shelf && !isHangingRod(part)) continue;
    const hits = dividers.filter((d) => crosses(part, d)).sort((a, b) => a.position.x - b.position.x);
    if (!hits.length) continue;
    const pieces: { x: number; w: number }[] = [];
    let x = part.position.x;
    const end = x + part.size.width;
    for (const d of hits) {
      if (d.position.x - gap - x >= 1) pieces.push({ x, w: d.position.x - gap - x });
      x = Math.max(x, d.position.x + d.size.width + gap);
    }
    if (end - x >= 1) pieces.push({ x, w: end - x });
    if (pieces.length < 2) continue;
    panels.splice(i, 1);
    pieces.forEach((piece, n) =>
      panels.push({
        ...part,
        id: n === 0 ? part.id : createId(shelf ? "sh" : "ra"),
        name: shelf || n === 0 ? part.name : `${part.name} ${n + 1}`,
        position: { ...part.position, x: piece.x },
        size: { ...part.size, width: piece.w },
        polygon: undefined,
      }),
    );
  }
  // A deep shelf cut into bays is also cut front to back, so each piece stays within the stock and
  // still meets the divider along its whole depth. The loaded-top support can then stay on the left bay.
  for (let i = panels.length - 1; i >= 0; i--) {
    const part = panels[i];
    if (part.type !== "shelf" || part.outline) continue;
    const limit = shelfSpanLimit(part.materialId, thickOf(part));
    if (!(part.size.depth > limit + EPS)) continue;
    const near = dividers.some((d) => {
      const end = Math.min(Math.abs(d.position.x - (part.position.x + part.size.width)), Math.abs(d.position.x + d.size.width - part.position.x));
      return end < 0.3 && overlap(part.position.y, part.position.y + part.size.height, d.position.y, d.position.y + d.size.height) > 0.2;
    });
    if (!near) continue;
    let k = Math.max(2, Math.ceil(part.size.depth / limit));
    while (k < 6 && part.size.depth / k > limit + EPS) k++;
    const z0 = part.position.z;
    const d = part.size.depth;
    panels.splice(i, 1);
    for (let n = 0; n < k; n++) {
      const z = z0 + (d * n) / k;
      const zn = z0 + (d * (n + 1)) / k;
      panels.push({
        ...part,
        id: n === 0 ? part.id : createId("sh"),
        position: { ...part.position, z: n === 0 ? z : z + gap },
        size: { ...part.size, depth: (n === k - 1 ? zn : zn - gap) - (n === 0 ? z : z + gap) },
      });
    }
  }
}

function crowdsRod(panels: Panel[], part: Panel): boolean {
  return panels.some((q) => {
    if (!isHangingRod(q)) return false;
    const ox = overlap(part.position.x, part.position.x + part.size.width, q.position.x, q.position.x + q.size.width);
    const oz = overlap(part.position.z, part.position.z + part.size.depth, q.position.z, q.position.z + q.size.depth);
    const top = q.position.y + q.size.height;
    return ox > 0.5 && oz > 0.5 && part.position.y < top + 2 - 0.02 && part.position.y + part.size.height > top + 0.02;
  });
}

/** Raise a shelf so a 1×2 under it stays 2" clear of the rod, when the bay above has room. */
function liftClear(shelf: Panel, panels: Panel[], drop: number) {
  const rod = panels.find((q) => isHangingRod(q) && overlap(shelf.position.x, shelf.position.x + shelf.size.width, q.position.x, q.position.x + q.size.width) > 0.5 && q.position.y + q.size.height <= shelf.position.y + 0.2);
  if (!rod) return;
  const need = rod.position.y + rod.size.height + 2 + drop;
  if (shelf.position.y >= need - 0.02) return;
  const blocked = panels.some((q) => {
    if (q === shelf || q === rod) return false;
    const ox = overlap(shelf.position.x, shelf.position.x + shelf.size.width, q.position.x, q.position.x + q.size.width);
    const oz = overlap(shelf.position.z, shelf.position.z + shelf.size.depth, q.position.z, q.position.z + q.size.depth);
    return ox > 0.5 && oz > 0.5 && q.position.y < need + shelf.size.height - 0.02 && q.position.y + q.size.height > shelf.position.y + shelf.size.height - 0.02;
  });
  if (!blocked) shelf.position = { ...shelf.position, y: need };
}

function addStick(panels: Panel[], extra: Panel[], piece: Omit<Panel, "id">) {
  const draft = { ...piece, id: "pending" };
  if (crowdsRod(panels, draft) || [...panels, ...extra].some((q) => solidsOverlap(draft, q))) return;
  const n = extra.filter((p) => p.name === piece.name || p.name.startsWith(`${piece.name} `)).length;
  extra.push({ ...piece, id: createId("di"), name: n ? `${piece.name} ${n + 1}` : piece.name });
}

/** A build whose every board is one lumber size cannot grow a second size. Null when plywood is in the case. */
function onlyLumber(panels: Panel[]): string | null {
  const ids = new Set(panels.map((p) => p.materialId).filter((id) => /^lumber-/.test(id)));
  if (panels.some((p) => /plywood|mdf|particle|hardboard/.test(p.materialId))) return null;
  return ids.size === 1 ? [...ids][0] : null;
}

/**
 * A 1×3 or 1×4 on edge under a fixed shelf's front edge, only when the sag (simple support
 * plus creep) comes in under 0.02" per foot. The shelf stays full depth.
 */
function edgeRail(panels: Panel[], extra: Panel[], shelf: Panel): boolean {
  const span = Math.max(0, ...clearGaps(shelf, panels).map(([a, b]) => b - a));
  if (!Number.isFinite(span)) return false;
  const thick = thickOf(shelf);
  const sole = onlyLumber(panels.concat(extra));
  const choices = EDGE_RAILS.filter((r) => !sole || r.materialId === sole);
  for (const rail of choices) {
    if (shelfSagIn(span, shelf.size.depth, thick, shelf.materialId, rail.height) > sagLimitIn(span) + EPS) continue;
    const n = extra.length;
    addStick(panels, extra, {
      type: "rail",
      name: "Front rail",
      position: { x: shelf.position.x, y: shelf.position.y - rail.height, z: shelf.position.z + shelf.size.depth - 0.75 },
      size: { width: shelf.size.width, height: rail.height, depth: 0.75 },
      materialId: rail.materialId,
      cutNote: "Glued and screwed on edge under this shelf's front edge.",
    });
    if (extra.length > n) return true;
  }
  return false;
}

/** Another shelf already occupies this height in the same bay. A lift must not park two levels on one height. */
function landsOnShelf(panels: Panel[], shelf: Panel, y: number): boolean {
  const top = y + shelf.size.height;
  return panels.some(
    (s) =>
      s !== shelf &&
      s.type === "shelf" &&
      !s.outline &&
      overlap(shelf.position.x, shelf.position.x + shelf.size.width, s.position.x, s.position.x + s.size.width) > 1 &&
      overlap(y, top, s.position.y, s.position.y + s.size.height) > 0.05,
  );
}

/** The shelf directly over a hanging rod sits 2" clear of it before any divider is cut to that height. */
function clearRodHats(panels: Panel[]) {
  const rods = panels.filter(isHangingRod);
  if (!rods.length) return;
  for (const shelf of panels.filter((p) => p.type === "shelf" && !p.outline)) {
    const rod = rods.find((r) => overlap(shelf.position.x, shelf.position.x + shelf.size.width, r.position.x, r.position.x + r.size.width) > 1 && r.position.y + r.size.height <= shelf.position.y + 0.05);
    if (!rod) continue;
    const rodTop = rod.position.y + rod.size.height;
    const between = panels.some((s) => s !== shelf && s.type === "shelf" && s.position.y > rodTop && s.position.y < shelf.position.y - 0.05 && overlap(shelf.position.x, shelf.position.x + shelf.size.width, s.position.x, s.position.x + s.size.width) > 1);
    const y = rodTop + 2;
    if (between || shelf.position.y >= y - 0.02 || landsOnShelf(panels, shelf, y)) continue;
    shelf.position = { ...shelf.position, y };
  }
}

/** A front rail under a floor-level shelf hangs below the uprights. Lift the build and let the sides cover it. */
function seatFrontRails(panels: Panel[]): number {
  const rails = panels.filter((p) => /^Front rail\b/.test(p.name));
  const sides = panels.filter((p) => p.type === "upright" || p.type === "back");
  if (!rails.length || !sides.length) return 0;
  const y0 = Math.min(...sides.map((p) => p.position.y));
  const low = Math.min(...rails.map((p) => p.position.y));
  if (low >= y0 - EPS) return 0;
  const drop = y0 - low;
  for (const p of panels) {
    if (p.type === "upright" || p.type === "back") p.size = { ...p.size, height: p.size.height + drop };
    else p.position = { ...p.position, y: p.position.y + drop };
  }
  return drop;
}

/** The grown case says one height: the number the drawings measure, in the name, the notes, and the unit. */
function growCase(project: YardProject, drop: number): YardProject {
  const newH = Math.round((project.overall.height + drop) * 16) / 16;
  const from = `${inchFrac(project.overall.height)}"`;
  const to = `${inchFrac(newH)}"`;
  const say = (s: string) => s.split(from).join(to);
  const fitted = project.fitted?.unit
    ? { ...project.fitted, name: project.fitted.name ? say(project.fitted.name) : project.fitted.name, unit: { ...project.fitted.unit, height: Math.round((project.fitted.unit.height + drop) * 16) / 16 } }
    : project.fitted;
  return {
    ...project,
    name: say(project.name),
    overall: { ...project.overall, height: newH },
    notes: (project.notes ?? []).map(say),
    ...(fitted ? { fitted } : {}),
    ...(project.opening ? { opening: { ...project.opening, height: Math.round((project.opening.height + drop) * 16) / 16 } } : {}),
  };
}

/** Loose pin shelves: one level per height, one piece per bay. A center divider is what makes a level into pieces. The screwed shelf over a rod is the hat, and it is named with the adjustable ones. */
export function adjustableShelfTalk(panels: Panel[]): { levels: number; pieces: number; multi: boolean; phrase: string } {
  const rods = panels.filter((p) => p.type === "rail" && /hanging rod/i.test(p.name));
  const hats = panels.filter(
    (p) =>
      isFixedSpanShelf(p) &&
      rods.some(
        (r) =>
          overlap(p.position.x, p.position.x + p.size.width, r.position.x, r.position.x + r.size.width) > 1 &&
          r.position.y + r.size.height <= p.position.y + 0.05,
      ),
  );
  const loose = panels.filter((p) => p.type === "shelf" && !isFixedSpanShelf(p));
  const pieces = loose.length;
  const levels = shelfLineCount(loose);
  const hatLevels = shelfLineCount(hats);
  const multi = pieces > levels && panels.some((p) => /^Center divider\b/.test(p.name));
  const adjustable = multi
    ? `${levels} adjustable (${pieces} pieces)`
    : `${pieces} adjustable shel${pieces === 1 ? "f" : "ves"}`;
  const total = hatLevels + levels;
  const phrase =
    hatLevels > 0 && pieces > 0
      ? `${total} shel${total === 1 ? "f" : "ves"}: ${hatLevels} fixed hat shel${hatLevels === 1 ? "f" : "ves"} over the rod and ${adjustable}`
      : multi
        ? `${levels} shel${levels === 1 ? "f" : "ves"} (${pieces} adjustable pieces)`
        : `${pieces} adjustable shel${pieces === 1 ? "f" : "ves"}`;
  return { levels, pieces, multi, phrase };
}

/** "4 adjustable shelf lines" counted the screwed hat. A split case names the levels and the pieces. */
function recountAdjustable(notes: string[] | undefined, panels: Panel[]): string[] | undefined {
  if (!notes?.length) return notes;
  const talk = adjustableShelfTalk(panels);
  if (!talk.pieces) return notes;
  return notes.map((s) => s.replace(/\d+ adjustable shelf lines?/, talk.phrase));
}

/** Each hanging bay gets one fixed shelf on a back cleat. A fixed shelf still past its limit gets a front rail when the sag passes. */
function hatAndStiff(panels: Panel[], dividers: Panel[], extra: Panel[]) {
  if (dividers.length) {
    const rods = panels.filter(isHangingRod);
    for (const shelf of panels.filter((p) => p.type === "shelf" && !p.outline)) {
      const rod = rods.find((r) => overlap(shelf.position.x, shelf.position.x + shelf.size.width, r.position.x, r.position.x + r.size.width) > 1 && r.position.y + r.size.height <= shelf.position.y + 0.05);
      if (!rod) continue;
      const rodTop = rod.position.y + rod.size.height;
      const between = panels.some((s) => s !== shelf && s.type === "shelf" && s.position.y > rodTop && s.position.y < shelf.position.y - 0.05 && overlap(shelf.position.x, shelf.position.x + shelf.size.width, s.position.x, s.position.x + s.size.width) > 1);
      if (between) continue;
      if (shelf.position.y < rodTop + 2 && !landsOnShelf(panels, shelf, rodTop + 2)) shelf.position = { ...shelf.position, y: rodTop + 2 };
      shelf.cutNote = "Screwed fixed shelf. Screw it to both uprights of the bay.";
      const y = shelf.position.y;
      addStick(panels, extra, { type: "cleat", name: "Back cleat", position: { x: shelf.position.x, y: y - 0.75, z: shelf.position.z }, size: { width: shelf.size.width, height: 0.75, depth: Math.min(1.5, shelf.size.depth) }, materialId: "lumber-1x2-8" });
    }
  }
  for (const shelf of panels) {
    if (shelf.type !== "shelf" || !isFixedSpanShelf(shelf) || lightShelf(shelf) || !overSpan(shelf, panels)) continue;
    edgeRail(panels, extra, shelf);
  }
}

/**
 * One rule for every carcass: a housed shelf (and the case top over it) whose clear span
 * exceeds its stock gets a center divider in each opening. Same panels the rest of the plan reads.
 */
export function withShelfSpanSupports(project: YardProject, prompt = ""): YardProject {
  if (!project.panels.length || project.pocket || project.windowPkg || wantsOpenSpan(prompt) || solidTopIsland(project, prompt)) return project;
  if (!project.panels.some((p) => p.type === "shelf" && overSpan(p, project.panels))) return project;
  const panels = project.panels.map((p) => ({ ...p, position: { ...p.position }, size: { ...p.size } }));
  clearRodHats(panels);
  for (const p of panels) if (p.type === "shelf" || p.type === "top" || p.type === "bottom") seatToSides(p, panels);
  const plates = panels.filter((p) => flatShelf(p) && housed(p, panels));
  const added: Panel[] = [];
  let before = 0;
  let thick = 0.75;
  let materialId = "";
  let limit = 30;
  for (const plate of plates) {
    if (plate.type !== "shelf") continue;
    const span = Math.max(0, ...clearGaps(plate, panels).map(([a, b]) => b - a));
    if (span > before) {
      before = span;
      thick = thickOf(plate);
      materialId = plate.materialId;
      limit = shelfSpanLimit(plate.materialId, thick);
    }
  }
  const glued = wantsFixedGlueShelves(project);
  placeBayDividers(panels, added, (p) => !glued && !isFixedSpanShelf(p));
  splitCrossed(panels, added);
  splitWide(panels, added);
  const extra: Panel[] = [];
  hatAndStiff(panels, added, extra);
  // A glued shelf (wine grid, media bay) stays one piece when a 1×3 or 1×4 on edge passes the sag.
  if (glued) {
    for (const shelf of panels) {
      if (shelf.type !== "shelf" || lightShelf(shelf) || isFixedSpanShelf(shelf) || !overSpan(shelf, panels)) continue;
      if (!edgeRail(panels, extra, shelf)) continue;
      shelf.cutNote = "Screwed fixed shelf. Screw it to both uprights of the bay.";
    }
  }
  const railed = (shelf: Panel) =>
    extra.some((q) => /^Front rail\b/.test(q.name) && Math.abs(q.position.y + q.size.height - shelf.position.y) <= 0.12 && overlap(shelf.position.x, shelf.position.x + shelf.size.width, q.position.x, q.position.x + q.size.width) > shelf.size.width * 0.8);
  if (panels.some((p) => p.type === "shelf" && (glued || isFixedSpanShelf(p)) && overSpan(p, panels) && !railed(p))) {
    placeBayDividers(panels, added, (p) => (glued || isFixedSpanShelf(p)) && !railed(p));
    splitCrossed(panels, added);
    splitWide(panels, added);
  }
  for (const p of extra) panels.push(p);
  if (!added.length && !extra.length) return project;
  const drop = seatFrontRails(panels);
  const seated = drop > EPS ? growCase(project, drop) : project;
  const told = recountAdjustable(seated.notes, panels) ?? seated.notes;
  const stations = [...new Set(added.map((d) => Math.round((d.position.x + d.size.width / 2) * 8) / 8))].sort((a, b) => a - b);
  for (const d of added) {
    const i = stations.indexOf(Math.round((d.position.x + d.size.width / 2) * 8) / 8);
    if (i > 0) d.name = `Center divider ${i + 1}`;
  }
  if (!wantsFixedGlueShelves(project)) for (const d of added) d.cutNote = PIN_NOTE;
  clearOverlaps(panels);
  if (!added.length) return { ...seated, panels, ...(told ? { notes: told } : {}) };
  const after = Math.max(0, ...panels.filter((p) => p.type === "shelf" && housed(p, panels)).flatMap((p) => clearGaps(p, panels).map(([a, b]) => b - a)));
  const word = stations.length === 1 ? "a divider stands in the middle" : `${stations.length} dividers stand across the span`;
  const note = `Center divider under the shelves: ${inchFrac(before)}" is a long span for ${inchFrac(thick)}" ${stockWord(materialId)} (books want about ${inchFrac(limit)}" between supports), so ${word} and every shelf span is ${inchFrac(after)}" or less.`;
  return { ...seated, panels, notes: [...(told ?? []), note] };
}
