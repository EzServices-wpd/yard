/**
 * MaxRects Best Short Side Fit (BSSF) sheet nest for Yard house ply.
 * Ported from BuildHQ 0.5. All dimensions in inches.
 * House ply only — crafts stay whole-pack / do not cut.
 *
 * Thin backs (thickness < 1/2") are intentionally excluded from 3/4" sheets.
 * Buy 1/4" backer as a separate sheet; do not nest it with structural ply.
 */

import type { CutLine } from "./types";

export interface NestPart {
  id: string;
  name: string;
  /** Letter from cut list (A, B, C…) when present */
  label?: string;
  width: number;
  height: number;
  material: string;
  /** If true, part may be rotated 90° */
  allowRotate: boolean;
}

export interface PlacedPart {
  id: string;
  name: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  material: string;
}

export interface NestSheet {
  index: number;
  width: number;
  height: number;
  material: string;
  parts: PlacedPart[];
  usedArea: number;
  utilization: number; // 0–1
}

export interface NestResult {
  sheets: NestSheet[];
  unplaced: NestPart[];
  totalSheets: number;
  averageUtilization: number;
}

interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_SHEET = { width: 96, height: 48 }; // 4x8 ft plywood (long side first)
const KERF = 0.125; // 1/8" blade kerf
/** Structural sheet goods only. Thin backs (< 1/2") buy separately. */
const MIN_NEST_THICKNESS = 0.5;

function expandWithKerf(w: number, h: number) {
  return { width: w + KERF, height: h + KERF };
}

function fits(rect: FreeRect, w: number, h: number) {
  return w <= rect.width + 1e-6 && h <= rect.height + 1e-6;
}

function scoreBSSF(rect: FreeRect, w: number, h: number): number {
  const leftoverW = rect.width - w;
  const leftoverH = rect.height - h;
  return Math.min(leftoverW, leftoverH);
}

function splitFreeRect(rect: FreeRect, x: number, y: number, w: number, h: number): FreeRect[] {
  const result: FreeRect[] = [];
  // Right remnant
  if (rect.width - (x - rect.x + w) > 0.05) {
    result.push({
      x: x + w,
      y: rect.y,
      width: rect.width - (x - rect.x + w),
      height: rect.height,
    });
  }
  // Top remnant
  if (rect.height - (y - rect.y + h) > 0.05) {
    result.push({
      x: rect.x,
      y: y + h,
      width: w + (x - rect.x),
      height: rect.height - (y - rect.y + h),
    });
  }
  return result;
}

function pruneFreeList(list: FreeRect[]): FreeRect[] {
  const out: FreeRect[] = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    let contained = false;
    for (let j = 0; j < list.length; j++) {
      if (i === j) continue;
      const b = list[j];
      if (
        a.x >= b.x - 1e-6 &&
        a.y >= b.y - 1e-6 &&
        a.x + a.width <= b.x + b.width + 1e-6 &&
        a.y + a.height <= b.y + b.height + 1e-6
      ) {
        contained = true;
        break;
      }
    }
    if (!contained && a.width > 0.05 && a.height > 0.05) out.push(a);
  }
  return out;
}

function packSheet(
  parts: NestPart[],
  sheetW: number,
  sheetH: number
): { placed: PlacedPart[]; remaining: NestPart[] } {
  let free: FreeRect[] = [{ x: 0, y: 0, width: sheetW, height: sheetH }];
  const placed: PlacedPart[] = [];
  const remaining: NestPart[] = [];

  // Sort largest area first
  const sorted = [...parts].sort(
    (a, b) => b.width * b.height - a.width * a.height
  );

  for (const part of sorted) {
    const candidates = [
      { w: part.width, h: part.height, rotated: false },
    ];
    if (part.allowRotate && Math.abs(part.width - part.height) > 0.01) {
      candidates.push({ w: part.height, h: part.width, rotated: true });
    }

    let best: {
      rectIdx: number;
      score: number;
      w: number;
      h: number;
      rotated: boolean;
    } | null = null;

    for (const cand of candidates) {
      const { width: needW, height: needH } = expandWithKerf(cand.w, cand.h);
      for (let i = 0; i < free.length; i++) {
        if (!fits(free[i], needW, needH)) continue;
        const s = scoreBSSF(free[i], needW, needH);
        if (!best || s < best.score) {
          best = { rectIdx: i, score: s, w: needW, h: needH, rotated: cand.rotated };
        }
      }
    }

    if (!best) {
      remaining.push(part);
      continue;
    }

    const rect = free[best.rectIdx];
    const actualW = best.rotated ? part.height : part.width;
    const actualH = best.rotated ? part.width : part.height;

    placed.push({
      id: part.id,
      name: part.name,
      label: part.label,
      x: rect.x,
      y: rect.y,
      width: actualW,
      height: actualH,
      rotated: best.rotated,
      material: part.material,
    });

    // Remove used rect and add splits
    free.splice(best.rectIdx, 1);
    free.push(...splitFreeRect(rect, rect.x, rect.y, best.w, best.h));
    free = pruneFreeList(free);
  }

  return { placed, remaining };
}

/**
 * Nest parts onto standard 4x8 sheets (96" x 48"), grouped by material.
 */
export function nestParts(
  parts: NestPart[],
  sheetSize = DEFAULT_SHEET
): NestResult {
  const byMaterial = new Map<string, NestPart[]>();
  for (const p of parts) {
    const list = byMaterial.get(p.material) ?? [];
    list.push(p);
    byMaterial.set(p.material, list);
  }

  const sheets: NestSheet[] = [];
  const unplaced: NestPart[] = [];
  let sheetIndex = 0;

  for (const [material, matParts] of byMaterial) {
    let remaining = matParts;
    while (remaining.length > 0) {
      const { placed, remaining: still } = packSheet(
        remaining,
        sheetSize.width,
        sheetSize.height
      );
      if (placed.length === 0) {
        // Cannot place any more on a full sheet — give up on these
        unplaced.push(...still);
        break;
      }
      const usedArea = placed.reduce((s, p) => s + p.width * p.height, 0);
      const sheetArea = sheetSize.width * sheetSize.height;
      sheets.push({
        index: ++sheetIndex,
        width: sheetSize.width,
        height: sheetSize.height,
        material,
        parts: placed,
        usedArea,
        utilization: usedArea / sheetArea,
      });
      remaining = still;
    }
  }

  const avgUtil =
    sheets.length === 0
      ? 0
      : sheets.reduce((s, sh) => s + sh.utilization, 0) / sheets.length;

  return {
    sheets,
    unplaced,
    totalSheets: sheets.length,
    averageUtilization: avgUtil,
  };
}

/**
 * Expand a cut list into individual NestPart instances for sheet packing.
 * Only non-whole sheet/board parts (house ply). Crafts with whole=true are skipped.
 * Thin backs (thickness < 1/2") are skipped — buy as separate 1/4" sheet.
 * Grain: longer edge prefers sheet long axis; rotation allowed for square-ish panels.
 */
export function cutListToNestParts(cutList: CutLine[]): NestPart[] {
  const parts: NestPart[] = [];
  for (const c of cutList) {
    if (c.whole) continue;
    // Skip non-sheet (sticks, dowels, pipe) — only nest sheet goods
    const isSheet =
      (c.widthIn > 2 && c.lengthIn > 2) ||
      /ply|sheet|board|panel|mdf|osb/i.test(c.material + " " + c.name);
    if (!isSheet) continue;

    // Thin backer (1/4" or thinner) does not belong on a 3/4" structural sheet.
    const thick = c.thicknessIn ?? 0.75;
    if (thick < MIN_NEST_THICKNESS) continue;

    // Face dimensions: length x width (thickness is the saw kerf axis, not nested)
    const w = Math.max(c.lengthIn, c.widthIn);
    const h = Math.min(c.lengthIn, c.widthIn);
    const qty = Math.max(1, Math.floor(c.quantity) || 1);
    // ASCII material label — avoid Unicode fractions in PDF footers
    const material =
      c.material
        ?.replace(/¾/g, "3/4")
        .replace(/½/g, "1/2")
        .replace(/¼/g, "1/4")
        .replace(/″/g, "\"")
        .replace(/×/g, "x") || '3/4" plywood';
    for (let i = 0; i < qty; i++) {
      parts.push({
        id: `${c.id || c.label || "p"}-${i}`,
        name: c.name,
        label: c.label,
        width: w,
        height: h,
        material,
        // Allow rotate unless strongly grain-oriented long strip
        allowRotate: h / w > 0.25,
      });
    }
  }
  return parts;
}

/**
 * Convenience: nest a BuildPlan cut list. Returns null when nothing to nest
 * (whole-pack crafts, empty, or no sheet parts).
 */
export function nestCutList(cutList: CutLine[]): NestResult | null {
  const parts = cutListToNestParts(cutList);
  if (parts.length === 0) return null;
  return nestParts(parts);
}

export const SHEET_4X8 = DEFAULT_SHEET;
export const BLADE_KERF = KERF;
