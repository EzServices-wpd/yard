/**
 * Fixed shelves housed in a carcass: clear span follows the stock.
 *
 * Sagulator (woodbin.com/calcs/sagulator), fixed ends, ~12" deep, ~40 lb/ft of books,
 * sag near 0.02" per foot. Plywood has no creep factor; MDF and solid wood use Sagulator's
 * 1.5 creep, so the shop spans at 3/4" are plywood 30", MDF 24", 1× pine 26".
 * The same sag per foot means the clear span scales with thickness (L ∝ t).
 * A span equal to the limit stays (a 31 1/2" case is 30" inside). Anything longer gets a
 * center divider in each opening, the same panel the model, cut list, steps and Buy read.
 */
import { createId } from "@/lib/utils";
import type { Panel, YardProject } from "./types";
import { inchFrac } from "./inchText";
import { wantsFixedGlueShelves } from "./honesty";
import { solidsOverlap } from "./solids";
import { spanFindings, wantsOpenSpan } from "./spanCheck";

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

export function shelfSpanViolations(project: YardProject): ShelfSpanHit[] {
  const out: ShelfSpanHit[] = [];
  for (const plate of project.panels) {
    if (plate.type !== "shelf" || !flatShelf(plate) || !housed(plate, project.panels)) continue;
    if (lightShelf(plate)) continue;
    const thick = thickOf(plate);
    const limit = shelfSpanLimit(plate.materialId, thick);
    const span = Math.max(0, ...clearGaps(plate, project.panels).map(([a, b]) => b - a));
    if (span > limit + EPS) out.push({ name: plate.name, span, limit, thick, materialId: plate.materialId });
  }
  return out;
}

/** Pieces of one shelf share a name and a height. A divider cut does not add a shelf. */
export function shelfLineCount(shelves: Panel[]): number {
  return new Set(shelves.map((p) => `${p.name}|${Math.round(p.position.y * 4) / 4}`)).size;
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
  const d = z1 - z0;
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

const ROD_CLEAR = 2;
const BRIDGE = 0.35;

function rodBlocks(panels: Panel[], x: number, y0: number, y1: number): boolean {
  return panels.some((q) => {
    if (!isHangingRod(q)) return false;
    if (overlap(x - 0.75, x + 0.75, q.position.x, q.position.x + q.size.width) <= 0) return false;
    return overlap(y0, y1, q.position.y - 0.05, q.position.y + q.size.height + ROD_CLEAR) > 0;
  });
}

/** The shelf over a hanging rod is cut into spans the stock can carry, and screwed down. The divider stands on it, 2" clear of the rod. */
function fixHangingCaps(panels: Panel[], stations: Map<number, number>) {
  const caps = panels.filter((p) => p.type === "shelf" && hangingBayShelf(p, panels) && overSpan(p, panels));
  for (const shelf of caps) {
    const limit = shelfSpanLimit(shelf.materialId, thickOf(shelf));
    if (!Number.isFinite(limit)) continue;
    const span = shelf.size.width;
    let k = Math.max(2, Math.ceil(span / limit));
    while (k < 8 && span / k > limit + EPS) k++;
    const x0 = shelf.position.x;
    const note = "Screwed fixed shelf. Screw it to the uprights, then the divider stands on it.";
    const pieces: Panel[] = [];
    for (let i = 0; i < k; i++) {
      pieces.push({
        ...shelf,
        id: i === 0 ? shelf.id : createId("sh"),
        position: { ...shelf.position, x: x0 + (span * i) / k },
        size: { ...shelf.size, width: span / k },
        cutNote: note,
      });
      if (i > 0) {
        const at = x0 + (span * i) / k;
        stations.set(Math.round(at * 8) / 8, at);
      }
    }
    const at = panels.indexOf(shelf);
    if (at >= 0) panels.splice(at, 1, ...pieces);
  }
}

function carrierTop(panels: Panel[], x: number, below: number): number | null {
  let y: number | null = null;
  for (const q of panels) {
    if (q.type !== "bottom" && !isFixedSpanShelf(q)) continue;
    const top = q.position.y + q.size.height;
    if (top > below - 0.02) continue;
    if (overlap(x - 0.5, x + 0.5, q.position.x, q.position.x + q.size.width) <= 0) continue;
    if (rodBlocks(panels, x, top, below)) continue;
    if (y == null || top > y) y = top;
  }
  return y;
}

function caseTop(panels: Panel[], x: number, y0: number): number | null {
  let y: number | null = null;
  for (const q of panels) {
    if (q.type !== "top" || q.position.y < y0 + 0.4) continue;
    if (overlap(x - 0.5, x + 0.5, q.position.x, q.position.x + q.size.width) <= 0) continue;
    if (y == null || q.position.y < y) y = q.position.y;
  }
  return y;
}

/** One divider per station, from a fixed carrier (the bottom, or the screwed shelf over a rod) up to the top. */
function placeColumns(panels: Panel[], added: Panel[]) {
  const stations = new Map<number, number>();
  fixHangingCaps(panels, stations);
  for (const plate of panels) {
    if (plate.type !== "shelf" || isFixedSpanShelf(plate) || lightShelf(plate) || !overSpan(plate, panels)) continue;
    const t = plate.size.height;
    const limit = shelfSpanLimit(plate.materialId, thickOf(plate));
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
    const loose = panels.filter((p) => p.type === "shelf" && !isFixedSpanShelf(p) && p.position.x < at && at < p.position.x + p.size.width);
    const fixed = panels.filter((p) => isFixedSpanShelf(p) && p.position.x - 0.5 < at && at < p.position.x + p.size.width + 0.5);
    const plate = loose[0] ?? fixed[0];
    if (!plate) continue;
    const below = loose.length ? Math.min(...loose.map((p) => p.position.y)) : Math.min(...fixed.map((p) => p.position.y + p.size.height)) + 1;
    const y0 = carrierTop(panels, at, below) ?? (fixed.length ? Math.min(...fixed.map((p) => p.position.y + p.size.height)) : null);
    const y1 = y0 == null ? null : caseTop(panels, at, y0);
    if (y0 == null || y1 == null || y1 - y0 < plate.size.height - 0.02) continue;
    if (rodBlocks(panels, at, y0, y1) || inOpenKnee(panels, at, y0) || alreadyHeld(plate, panels, at)) continue;
    const t = plate.size.height;
    if (hitsDrawer(panels, at - t / 2, y0, plate.position.z, t, y1 - y0, plate.size.depth)) continue;
    dividerAt(panels, added, plate, at, y0, y1, t);
  }
}

/** A divider passing through a loose shelf takes a notch, so the two solids do not share space and the divider does not stand on that shelf. */
function notchPassThrough(panels: Panel[]) {
  const divs = panels.filter((d) => /^Center divider\b/.test(d.name));
  for (const shelf of panels) {
    if (shelf.type !== "shelf" || isFixedSpanShelf(shelf)) continue;
    const hits = divs.filter((d) => {
      const oy = overlap(shelf.position.y, shelf.position.y + shelf.size.height, d.position.y, d.position.y + d.size.height);
      const ox = overlap(shelf.position.x, shelf.position.x + shelf.size.width, d.position.x, d.position.x + d.size.width);
      return oy > 0.2 && ox > 0.2;
    });
    if (!hits.length) continue;
    const slots: [number, number][] = [];
    for (const d of hits) {
      const back = shelf.position.z + shelf.size.depth - BRIDGE;
      if (d.position.z + d.size.depth > back) d.size = { ...d.size, depth: Math.max(2, back - d.position.z) };
      const a = d.position.x - shelf.position.x - 0.1;
      slots.push([Math.max(0.2, a), Math.min(shelf.size.width - 0.2, a + d.size.width + 0.2)]);
    }
    slots.sort((p, q) => p[0] - q[0]);
    const merged: [number, number][] = [];
    for (const s of slots) {
      const last = merged[merged.length - 1];
      if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
      else merged.push([s[0], s[1]]);
    }
    const W = shelf.size.width;
    const D = shelf.size.depth;
    const zb = Math.max(BRIDGE, D - BRIDGE);
    const pts: [number, number][] = [];
    let x = 0;
    for (const [a, b] of merged) {
      if (b - a < 0.2 || a >= W - 0.2) continue;
      pts.push([x, 0], [a, 0], [a, zb], [b, zb], [b, 0]);
      x = b;
    }
    if (!pts.length) continue;
    pts.push([W, 0], [W, D], [0, D]);
    shelf.polygon = { plane: "xz", pts };
  }
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

/** Openings shorter than the stock can't hold a sliver. One divider runs the stack and the shelves split around it. */
function braceTight(panels: Panel[], added: Panel[]) {
  const seen = new Set<string>();
  for (const shelf of panels.filter((p) => p.type === "shelf" && overSpan(p, panels))) {
    const key = `${Math.round(shelf.position.x * 4)}:${Math.round(shelf.size.width * 4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const bay = panels.filter((p) => (p.type === "shelf" || p.type === "top") && Math.abs(p.position.x - shelf.position.x) < 0.35 && Math.abs(p.size.width - shelf.size.width) < 0.35);
    const shelves = bay.filter((p) => p.type === "shelf").sort((a, b) => a.position.y - b.position.y);
    const top = bay.filter((p) => p.type === "top").sort((a, b) => b.position.y - a.position.y)[0];
    const tight = shelves.filter((s) => overSpan(s, panels));
    if (!tight.length) continue;
    const t = shelf.size.height;
    const cap = shelfSpanLimit(shelf.materialId, thickOf(shelf));
    const x0 = shelf.position.x;
    const span = shelf.size.width;
    const stand = plateBelow(panels, tight[0], x0 + span / 2);
    if (stand == null) continue;
    let yEnd = tight[0].position.y;
    for (const s of shelves) {
      if (s.position.y < tight[0].position.y - 0.01) continue;
      if (crossesHanging(panels, x0 + span / 2, yEnd, s.position.y)) break;
      if (hitsDrawer(panels, x0 + span / 2 - t / 2, stand, s.position.z, t, s.position.y - stand, s.size.depth)) break;
      yEnd = s.position.y;
    }
    if (
      top &&
      !crossesHanging(panels, x0 + span / 2, yEnd, top.position.y) &&
      !hitsDrawer(panels, x0 + span / 2 - t / 2, stand, top.position.z, t, top.position.y - stand, top.size.depth)
    ) {
      yEnd = Math.max(yEnd, top.position.y);
    }
    if (yEnd - stand < t) continue;
    let k = Math.max(2, Math.ceil(span / cap));
    while (k < 8 && (span - (k - 1) * t) / k > cap + EPS) k++;
    for (let i = 1; i < k; i++) {
      const at = x0 + (span * i) / k;
      if (alreadyHeld(tight[0], panels, at)) continue;
      const div = dividerAt(panels, added, tight[0], at, stand, yEnd, t);
      if (!div) continue;
      for (const s of [...shelves]) {
        const topY = s.position.y + s.size.height;
        if (s.position.y < stand - 0.02 || topY > yEnd + 0.02 || s.position.y <= stand + 0.02) continue;
        const x1 = s.position.x + s.size.width;
        const left = div.position.x - s.position.x;
        const right = x1 - (div.position.x + div.size.width);
        if (left < 1 || right < 1) continue;
        panels.push({ ...s, id: createId("sh"), position: { ...s.position, x: div.position.x + div.size.width }, size: { ...s.size, width: right } });
        s.size = { ...s.size, width: left };
      }
    }
  }
}

function overSpan(plate: Panel, panels: Panel[]): boolean {
  if (!flatShelf(plate) || !housed(plate, panels) || lightShelf(plate)) return false;
  const cap = shelfSpanLimit(plate.materialId, thickOf(plate));
  return clearGaps(plate, panels).some(([a, b]) => b - a > cap + EPS);
}

/**
 * The span check only counts a support whose top is under the shelf. A divider that runs through
 * the shelf does not, so a block beside that divider stands under the shelf and fastens to the divider.
 * It stops short of the shelf below, so it never stands on a pinned shelf.
 */
function bearLongShelves(project: YardProject, panels: Panel[]) {
  const over = new Set(spanFindings({ ...project, panels }).filter((f) => f.load === "shelf").map((f) => f.panelId));
  for (const shelf of panels) {
    if (!over.has(shelf.id)) continue;
    const divs = panels.filter((d) => {
      if (!/^Center divider\b/.test(d.name)) return false;
      const oy = overlap(shelf.position.y - 0.2, shelf.position.y + shelf.size.height, d.position.y, d.position.y + d.size.height);
      const ox = overlap(shelf.position.x, shelf.position.x + shelf.size.width, d.position.x, d.position.x + d.size.width);
      return oy > 0.2 && ox > 0.2;
    });
    for (const div of divs) {
      const w = div.size.width;
      let x = div.position.x + div.size.width;
      if (x + w > shelf.position.x + shelf.size.width - 0.2) x = div.position.x - w;
      if (x < shelf.position.x + 0.2) continue;
      const y = shelf.position.y - 2.25;
      const crowded = panels.some((q) => {
        if (q === shelf) return false;
        const top = q.position.y + q.size.height;
        if (top <= y - 0.15 || q.position.y >= shelf.position.y - 0.05) return false;
        const ox = overlap(x, x + w, q.position.x, q.position.x + q.size.width);
        const oz = overlap(shelf.position.z, shelf.position.z + shelf.size.depth, q.position.z, q.position.z + q.size.depth);
        return ox > 0.2 && oz > 0.2;
      });
      if (crowded || rodBlocks(panels, x + w / 2, y, shelf.position.y)) continue;
      const bearer: Panel = {
        id: createId("di"),
        type: "divider",
        name: "Shelf bearer",
        position: { x, y, z: shelf.position.z },
        size: { width: w, height: 2.25, depth: shelf.size.depth },
        materialId: shelf.materialId,
      };
      if (panels.some((q) => solidsOverlap(bearer, q))) continue;
      panels.push(bearer);
    }
  }
}

/**
 * One rule for every carcass: a housed shelf (and the case top over it) whose clear span
 * exceeds its stock gets a center divider in each opening. Same panels the rest of the plan reads.
 */
export function withShelfSpanSupports(project: YardProject, prompt = ""): YardProject {
  if (!project.panels.length || project.pocket || project.windowPkg || wantsOpenSpan(prompt)) return project;
  if (!project.panels.some((p) => p.type === "shelf" && overSpan(p, project.panels))) return project;
  const panels = project.panels.map((p) => ({ ...p, position: { ...p.position }, size: { ...p.size } }));
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
  placeColumns(panels, added);
  braceTight(panels, added);
  notchPassThrough(panels);
  if (!added.length) return project;
  const stations = [...new Set(added.map((d) => Math.round((d.position.x + d.size.width / 2) * 8) / 8))].sort((a, b) => a - b);
  for (const d of added) {
    const i = stations.indexOf(Math.round((d.position.x + d.size.width / 2) * 8) / 8);
    if (i > 0) d.name = `Center divider ${i + 1}`;
  }
  if (!wantsFixedGlueShelves(project)) for (const d of added) d.cutNote = PIN_NOTE;
  if (!added.length) return project;
  bearLongShelves(project, panels);
  splitCrossed(panels, added);
  clearOverlaps(panels);
  const after = Math.max(0, ...panels.filter((p) => p.type === "shelf" && housed(p, panels)).flatMap((p) => clearGaps(p, panels).map(([a, b]) => b - a)));
  const word = stations.length === 1 ? "a divider stands in the middle" : `${stations.length} dividers stand across the span`;
  const note = `Center divider under the shelves: ${inchFrac(before)}" is a long span for ${inchFrac(thick)}" ${stockWord(materialId)} (books want about ${inchFrac(limit)}" between supports), so ${word} and every shelf span is ${inchFrac(after)}" or less.`;
  return { ...project, panels, notes: [...(project.notes ?? []), note] };
}
