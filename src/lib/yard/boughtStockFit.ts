/**
 * Sheet and board purchase is one fit, not one decision per part.
 *
 * A build that is already buying a board (the tote's 1×8 walls, a crate's ends) used to
 * open a whole sheet for any part whose material id was plywood — a 16 1/2 × 8 1/2 bottom
 * bought a $42 4×8 by itself. The packer that counts those boards already places parts on
 * the board and on the offcut of that board. A sheet part is moved onto that stock when it
 * fits there (its face is no bigger than the boards already in the build, its long side
 * fits one board, and its thickness is that board or a hair under it, the way a 1/2" bottom
 * is cut from the 3/4" board). A part that fails the fit stays a sheet, and a 1/4" backer
 * stays plywood. A typed "plywood" prompt is left alone.
 */
import { getCatalogItem } from "./catalog";
import { sheetCutDims } from "./shopPlural";
import type { Panel, YardProject } from "./types";

/** A 1/2" part can be cut from a 3/4" board. A 1/4" backer cannot. */
const THICK_SLACK = 0.3;

type Axis = "width" | "height" | "depth";
const AXES: { size: Axis; pos: "x" | "y" | "z" }[] = [
  { size: "width", pos: "x" },
  { size: "height", pos: "y" },
  { size: "depth", pos: "z" },
];

function faceArea(p: Panel): number {
  const d = sheetCutDims(p.size.width, p.size.height, p.size.depth);
  return d.lengthIn * d.widthIn;
}

function isPlywoodSheet(id: string): boolean {
  const item = getCatalogItem(id);
  return /^plywood-/.test(id) && !!item && (item.formFactor === "sheet" || item.category === "sheet_goods");
}

function boardStock(id: string): { thick: number; length: number } | null {
  const item = getCatalogItem(id);
  if (!item || item.category !== "lumber" || item.formFactor !== "board") return null;
  const face = item.dims.width ?? 0;
  const thick = item.dims.height ?? item.dims.thickness ?? 0;
  const length = item.dims.length ?? 0;
  if (!(face > 0) || !(thick > 0) || length < 24) return null;
  return { thick, length };
}

const AX = [["x", "width"], ["y", "height"], ["z", "depth"]] as const;

/** Parts that already pass through each other stay put: moving a sheet onto the board must not open a new intersection. */
function cutsThrough(a: Panel, b: Panel): boolean {
  if (a.joints?.some((j) => j.with === b.id) || b.joints?.some((j) => j.with === a.id)) return false;
  return AX.every(([k, s]) => Math.min(a.position[k] + a.size[s], b.position[k] + b.size[s]) - Math.max(a.position[k], b.position[k]) > 1 / 16);
}

/** Grow the thin axis to the board's thickness, toward the middle of the build, so the outside face stays. */
function atBoardThickness(p: Panel, materialId: string, thick: number, box: { x: number; y: number; z: number }): Panel {
  const thin = AXES.reduce((m, a) => (p.size[a.size] < p.size[m.size] ? a : m));
  const old = p.size[thin.size];
  const delta = thick - old;
  const position = { ...p.position };
  const size = { ...p.size, [thin.size]: Math.abs(delta) > 0.02 ? thick : old };
  if (delta > 0.02 && p.position[thin.pos] + old / 2 >= box[thin.pos]) position[thin.pos] -= delta;
  const blank = p.blank ? { ...p.blank, thicknessIn: thick } : p.blank;
  return { ...p, materialId, position, size, ...(blank ? { blank } : {}) };
}

/**
 * Move sheet parts onto a board the build is already buying, when they fit that board
 * (and the offcut the board packer will use). Parts that do not fit stay sheet goods.
 */
export function fitSheetPartsOntoBoughtBoards(project: YardProject): YardProject {
  const panels = project.panels ?? [];
  // Only the board the build is already buying as its primary stock. A plywood cat tree's 1× posts,
  // or a 2×6 bench's 1× aprons, are not a reason to turn the sheet parts into boards.
  const stock = boardStock(project.primaryMaterialId ?? "");
  if (!panels.length || !stock || project.refused || /\bply(?:wood)?\b/i.test(project.prompt ?? "")) return project;
  const boardPanels = panels.filter((p) => p.materialId === project.primaryMaterialId && !p.polygon && !p.turns);
  if (!boardPanels.length) return project;
  let area = boardPanels.reduce((sum, p) => sum + faceArea(p), 0);
  const box = {
    x: (project.overall?.width ?? 0) / 2,
    y: (project.overall?.height ?? 0) / 2,
    z: (project.overall?.depth ?? 0) / 2,
  };
  const moved = new Map<string, Panel>();
  for (const p of panels) {
    if (p.materialId === project.primaryMaterialId || !isPlywoodSheet(p.materialId) || p.polygon || p.turns || p.yaw || p.outline || p.strut) continue;
    const dims = sheetCutDims(p.size.width, p.size.height, p.size.depth);
    const long = Math.max(dims.lengthIn, dims.widthIn);
    const partArea = dims.lengthIn * dims.widthIn;
    if (partArea > area + 0.5) continue;
    if (long > stock.length + 0.01) continue;
    if (dims.thicknessIn < stock.thick - THICK_SLACK || dims.thicknessIn > stock.thick + 0.05) continue;
    const next = atBoardThickness(p, project.primaryMaterialId, stock.thick, box);
    const others = panels.map((q) => (q.id === p.id ? next : moved.get(q.id) ?? q));
    if (others.some((q) => q.id !== p.id && cutsThrough(next, q))) continue;
    moved.set(p.id, next);
    area += partArea;
  }
  if (!moved.size) return project;
  const next = panels.map((p) => moved.get(p.id) ?? p);
  const plywoodBottom = next.some((p) => /^plywood-/.test(p.materialId) && /bottom/i.test(p.name));
  const bottomMoved = [...moved.values()].some((p) => /bottom/i.test(p.name));
  const notes =
    bottomMoved && !plywoodBottom
      ? (project.notes ?? []).map((n) => n.replace(/1\/2" plywood bottom/g, "bottom"))
      : project.notes;
  return notes === project.notes ? { ...project, panels: next } : { ...project, panels: next, notes };
}
