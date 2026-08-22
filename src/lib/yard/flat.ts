/**
 * Orthographic 2D stock map — the printable face of a Yard project.
 *
 * Use cases:
 *   • Parents: 8×10 / letter print of a popsicle-stick layout for kids
 *   • Shop: flat face diagram so stock orientation is obvious
 *   • Later: source data for 2D → 3D lift (same ratios)
 *
 * Projection is true orthographic (no perspective). Each member is a
 * segment from its from→to ends on the chosen plane.
 */

import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import { homeOf } from "./ghost";
import type { YardInstance, YardProject } from "./types";

export type FlatPlane = "top" | "front" | "side";

export type FlatSeg = {
  id: string;
  role?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Stock thickness in inches (for stroke weight). */
  thick: number;
  /** True 3D length of the member (inches). */
  lengthIn: number;
};

export type FlatMap = {
  plane: FlatPlane;
  planeLabel: string;
  segs: FlatSeg[];
  /** Axis-aligned bounds in projected inches. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthIn: number;
  heightIn: number;
  pieceCount: number;
  materialName: string;
};

const PLANE_LABEL: Record<FlatPlane, string> = {
  top: "Top (plan)",
  front: "Front elevation",
  side: "Side elevation",
};

function endsOf(inst: YardInstance): { a: { x: number; y: number; z: number }; b: { x: number; y: number; z: number } } {
  const item = getCatalogItem(inst.catalogId);
  const prim = item ? toPrimitive(item, inst.cutLength) : null;
  const len = prim?.length ?? inst.cutLength ?? 4;
  const p = homeOf(inst);
  if (inst.from && inst.to) return { a: inst.from, b: inst.to };
  // Fallback: rotate length along Y rotation (matches iso.ts convention)
  const half = len / 2;
  const sy = Math.sin(inst.rotation.y);
  const cy = Math.cos(inst.rotation.y);
  return {
    a: { x: p.x - sy * half, y: p.y, z: p.z - cy * half },
    b: { x: p.x + sy * half, y: p.y, z: p.z + cy * half },
  };
}

function projectPoint(
  p: { x: number; y: number; z: number },
  plane: FlatPlane,
): { x: number; y: number } {
  if (plane === "top") return { x: p.x, y: p.z }; // X right, Z down-on-page
  if (plane === "front") return { x: p.x, y: -p.y }; // X right, Y up → page Y down flips
  return { x: p.z, y: -p.y }; // side: Z right, Y up
}

function thickOf(inst: YardInstance): number {
  const item = getCatalogItem(inst.catalogId);
  if (!item) return 0.15;
  const prim = toPrimitive(item, inst.cutLength);
  return Math.max(0.08, prim.height || prim.width || 0.15);
}

function spanOnPlane(inst: YardInstance, plane: FlatPlane): number {
  const { a, b } = endsOf(inst);
  const pa = projectPoint(a, plane);
  const pb = projectPoint(b, plane);
  return Math.hypot(pb.x - pa.x, pb.y - pa.y);
}

/** Pick the plane where members project with the most total length (most informative face). */
export function bestFlatPlane(project: YardProject): FlatPlane {
  const planes: FlatPlane[] = ["front", "top", "side"];
  let best: FlatPlane = "front";
  let bestSpan = -1;
  for (const plane of planes) {
    let total = 0;
    for (const inst of project.instances) total += spanOnPlane(inst, plane);
    if (total > bestSpan) {
      bestSpan = total;
      best = plane;
    }
  }
  return best;
}

export function buildFlatMap(project: YardProject, plane?: FlatPlane): FlatMap {
  const face = plane ?? bestFlatPlane(project);
  const segs: FlatSeg[] = [];
  for (const inst of project.instances) {
    const { a, b } = endsOf(inst);
    const pa = projectPoint(a, face);
    const pb = projectPoint(b, face);
    const len3 = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    // Drop near-zero projected segments (members perpendicular to the face)
    if (Math.hypot(pb.x - pa.x, pb.y - pa.y) < 0.05 && len3 > 0.5) continue;
    segs.push({
      id: inst.id,
      role: inst.role,
      x1: pa.x,
      y1: pa.y,
      x2: pb.x,
      y2: pb.y,
      thick: thickOf(inst),
      lengthIn: len3 || Math.hypot(pb.x - pa.x, pb.y - pa.y),
    });
  }

  let minX = 0;
  let minY = 0;
  let maxX = 1;
  let maxY = 1;
  if (segs.length) {
    const xs = segs.flatMap((s) => [s.x1, s.x2]);
    const ys = segs.flatMap((s) => [s.y1, s.y2]);
    minX = Math.min(...xs);
    maxX = Math.max(...xs);
    minY = Math.min(...ys);
    maxY = Math.max(...ys);
  }

  const item = getCatalogItem(project.primaryMaterialId);
  return {
    plane: face,
    planeLabel: PLANE_LABEL[face],
    segs,
    minX,
    minY,
    maxX,
    maxY,
    widthIn: Math.max(0.5, maxX - minX),
    heightIn: Math.max(0.5, maxY - minY),
    pieceCount: segs.length,
    materialName: item?.name ?? project.primaryMaterialId ?? "stock",
  };
}

export type PaperSize = "letter" | "letter-landscape" | "8x10" | "a4";

const PAPER: Record<PaperSize, { wIn: number; hIn: number; label: string }> = {
  letter: { wIn: 8.5, hIn: 11, label: "Letter 8.5×11\"" },
  "letter-landscape": { wIn: 11, hIn: 8.5, label: "Letter landscape" },
  "8x10": { wIn: 8, hIn: 10, label: "8×10\"" },
  a4: { wIn: 8.27, hIn: 11.69, label: "A4" },
};

/**
 * SVG string ready to print or download.
 * Coordinates are in inches; SVG uses a viewBox in inches so 1 unit = 1\".
 */
export function flatSvgString(
  project: YardProject,
  opts: {
    plane?: FlatPlane;
    paper?: PaperSize;
    /** Margin from paper edge in inches. */
    marginIn?: number;
    showLabels?: boolean;
  } = {},
): { svg: string; map: FlatMap; paper: { wIn: number; hIn: number; label: string } } {
  const map = buildFlatMap(project, opts.plane);
  const paper = PAPER[opts.paper ?? "letter"];
  const margin = opts.marginIn ?? 0.6;
  const showLabels = opts.showLabels !== false;

  const drawW = paper.wIn - margin * 2;
  const drawH = paper.hIn - margin * 2 - (showLabels ? 0.85 : 0.15);
  const scale = Math.min(drawW / map.widthIn, drawH / map.heightIn) * 0.92;
  const ox = margin + (drawW - map.widthIn * scale) / 2;
  const oy = margin + (showLabels ? 0.75 : 0.1) + (drawH - map.heightIn * scale) / 2;

  const toX = (x: number) => ox + (x - map.minX) * scale;
  const toY = (y: number) => oy + (y - map.minY) * scale;

  const lines = map.segs
    .map((s) => {
      const sw = Math.max(0.04, Math.min(0.22, s.thick * scale));
      return `<line x1="${toX(s.x1).toFixed(3)}" y1="${toY(s.y1).toFixed(3)}" x2="${toX(s.x2).toFixed(3)}" y2="${toY(s.y2).toFixed(3)}" stroke="#1a1612" stroke-width="${sw.toFixed(3)}" stroke-linecap="round"/>`;
    })
    .join("\n  ");

  // Scale bar ~ 2\" of real stock
  const barReal = map.widthIn >= 12 ? 4 : map.widthIn >= 6 ? 2 : 1;
  const barPx = barReal * scale;
  const barX = margin;
  const barY = paper.hIn - margin * 0.55;
  const scaleBar = `\n  <line x1="${barX}" y1="${barY}" x2="${barX + barPx}" y2="${barY}" stroke="#1a1612" stroke-width="0.04" stroke-linecap="square"/>\n  <line x1="${barX}" y1="${barY - 0.08}" x2="${barX}" y2="${barY + 0.08}" stroke="#1a1612" stroke-width="0.03"/>\n  <line x1="${barX + barPx}" y1="${barY - 0.08}" x2="${barX + barPx}" y2="${barY + 0.08}" stroke="#1a1612" stroke-width="0.03"/>\n  <text x="${barX + barPx / 2}" y="${barY - 0.12}" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="0.14" fill="#6b6358">${barReal}\"</text>`;

  const header = showLabels
    ? `\n  <text x="${margin}" y="${margin + 0.22}" font-family="ui-serif, Georgia, serif" font-size="0.28" fill="#1a1612">${escapeXml(project.name)}</text>\n  <text x="${margin}" y="${margin + 0.48}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="0.14" fill="#6b6358">${escapeXml(map.planeLabel)} · ${map.pieceCount} pieces · ${escapeXml(map.materialName)} · ${map.widthIn.toFixed(1)}\" × ${map.heightIn.toFixed(1)}\"</text>\n  <text x="${paper.wIn - margin}" y="${margin + 0.22}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="0.12" fill="#6b6358">${paper.label}</text>`
    : "";

  const footer = `\n  <text x="${paper.wIn - margin}" y="${paper.hIn - margin * 0.35}" text-anchor="end" font-family="ui-sans-serif, system-ui, sans-serif" font-size="0.11" fill="#6b6358">Yard · 2D stock map · guidance only</text>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${paper.wIn}in" height="${paper.hIn}in" viewBox="0 0 ${paper.wIn} ${paper.hIn}">\n  <rect width="100%" height="100%" fill="#f3eee4"/>\n  ${header}\n  ${lines}\n  ${scaleBar}\n  ${footer}\n</svg>`;

  return { svg, map, paper };
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Trigger a browser download of the 2D map SVG. */
export function downloadFlatSvg(project: YardProject, opts?: Parameters<typeof flatSvgString>[1]) {
  const { svg, paper } = flatSvgString(project, opts);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = project.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "yard";
  a.href = url;
  a.download = `${slug}-2d-${opts?.plane ?? "auto"}.svg`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { paperLabel: paper.label };
}
