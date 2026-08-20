/**
 * Form-factor aware helpers for Yard materials.
 * Used by freehand placement, prompt generation, and packing.
 */

import type { CatalogItem, FormFactor } from "./types";
import { getCatalogItem } from "./catalog";

export interface PrimitiveDims {
  length: number;
  width: number;
  height: number;
  /** For cylinders */
  radius?: number;
  innerRadius?: number;
}

/** Smallest on-screen thickness so craft stock still reads at bench scale. */
export const MIN_VISUAL_THICKNESS = 0.28;

/**
 * Pipe/tube thinner than this vanishes on a 6-ft bench. Cut list and BOM
 * stay true-to-stock; only the mesh is thickened so joints can be seen.
 */
export function readableDiameter(
  trueDiameter: number,
  overallSpan: number,
  cylindrical: boolean,
): number {
  if (!cylindrical) return Math.max(trueDiameter, MIN_VISUAL_THICKNESS);
  const minPipe = Math.min(Math.max(overallSpan * 0.028, 1.15), 3.4);
  return Math.max(trueDiameter, minPipe);
}


/** Normalize any CatalogItem to a bounding box + optional cylinder params */
export function toPrimitive(item: CatalogItem, cutLength?: number): PrimitiveDims {
  const d = item.dims;
  const L = cutLength ?? d.length ?? 1;

  switch (item.formFactor) {
    case "stick":
    case "board":
      return {
        length: L,
        width: d.width ?? 0.5,
        height: d.thickness ?? d.height ?? 0.1,
      };
    case "dowel":
    case "tube":
    case "pipe": {
      const r = (d.diameter ?? 0.5) / 2;
      return {
        length: L,
        width: d.diameter ?? 1,
        height: d.diameter ?? 1,
        radius: r,
        innerRadius: d.innerDiameter ? d.innerDiameter / 2 : undefined,
      };
    }
    case "sheet":
      return {
        length: d.length ?? 48,
        width: d.width ?? 24,
        height: d.thickness ?? 0.25,
      };
    case "block":
      return {
        length: d.length ?? 1,
        width: d.width ?? 1,
        height: d.height ?? 1,
      };
    default:
      return {
        length: L,
        width: d.width ?? d.diameter ?? 1,
        height: d.height ?? d.thickness ?? d.diameter ?? 1,
      };
  }
}

/** Same as toPrimitive, but thin stock is thickened so the bench can see it. */
export function visualPrimitive(item: CatalogItem, cutLength?: number): PrimitiveDims {
  const p = toPrimitive(item, cutLength);
  return {
    ...p,
    width: Math.max(p.width, MIN_VISUAL_THICKNESS),
    height: Math.max(p.height, MIN_VISUAL_THICKNESS),
    radius: p.radius != null ? Math.max(p.radius, MIN_VISUAL_THICKNESS / 2) : undefined,
  };
}

/** How many whole units needed for a target length (with optional kerf/waste) */
export function unitsForLength(
  item: CatalogItem,
  targetLengthIn: number,
  kerfIn = 0.05
): { units: number; cuts: number[] } {
  const stock = item.dims.length ?? 1;
  if (!(item.canCut ?? true) || targetLengthIn <= stock) {
    return { units: 1, cuts: [Math.min(targetLengthIn, stock)] };
  }
  const cuts: number[] = [];
  let remaining = targetLengthIn;
  let units = 0;
  while (remaining > 0.01) {
    const take = Math.min(remaining, stock);
    cuts.push(take);
    remaining -= take + (remaining > take ? kerfIn : 0);
    units += 1;
  }
  return { units, cuts };
}

/** Rough volume for density / weight estimates later */
export function approxVolumeIn3(item: CatalogItem, qty = 1): number {
  const p = toPrimitive(item);
  if (p.radius != null) {
    const outer = Math.PI * p.radius ** 2 * p.length;
    const inner = p.innerRadius ? Math.PI * p.innerRadius ** 2 * p.length : 0;
    return (outer - inner) * qty;
  }
  return p.length * p.width * p.height * qty;
}

export function isCylindrical(ff: FormFactor): boolean {
  return ff === "tube" || ff === "pipe" || ff === "dowel";
}

export function describeMaterial(id: string): string {
  const item = getCatalogItem(id);
  if (!item) return "Unknown material";
  const p = toPrimitive(item);
  if (isCylindrical(item.formFactor)) {
    return `${item.name} (⌀${(p.radius! * 2).toFixed(2)}" × ${p.length}")`;
  }
  return `${item.name} (${p.length}" × ${p.width}" × ${p.height}")`;
}
