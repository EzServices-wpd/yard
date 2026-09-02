/**
 * Form-factor aware helpers for Yard materials.
 * Used by freehand placement, prompt generation, packing, and canvas mesh kind.
 *
 * True-to-form rule (global):
 * - stick with clear flat aspect  → flat bar + rounded ends (popsicle, craft stick)
 * - stick nearly square / pin     → thin cylinder (toothpick, pin)
 * - dowel / tube / pipe           → cylinder (hollow when innerDiameter present)
 * - board / sheet / block         → rectangular prism (sawn faces stay sharp)
 */

import type { CatalogItem, FormFactor, Panel } from "./types";
import { getCatalogItem } from "./catalog";

export interface PrimitiveDims {
  length: number;
  width: number;
  height: number;
  /** For cylinders */
  radius?: number;
  innerRadius?: number;
}

/** Cross-section kind for canvas InstancedMesh routing. */
export type MeshKind = "flatBar" | "box" | "cylinder" | "hollow";

/**
 * Tiny floor so a toothpick does not vanish. Aspect ratio stays true —
 * a popsicle stick stays flat, 3/4" PVC stays 1.05" OD. Never force a
 * square cross-section on a flat stick: scale both faces by the same factor
 * when the thinner face would vanish.
 */
export function visualPrimitive(item: CatalogItem, cutLength?: number, overallSpan = 36): PrimitiveDims {
  const p = toPrimitive(item, cutLength);
  const min = Math.max(0.05, Math.min(overallSpan * 0.0016, 0.12));

  // Near-square stick (toothpick) → true pin cylinder.
  if (isPinStick(item) && p.radius == null) {
    const dia = Math.max((p.width + p.height) / 2, min);
    const r = dia / 2;
    return { length: p.length, width: dia, height: dia, radius: r };
  }

  if (p.radius != null) {
    const r = Math.max(p.radius, min / 2);
    return { ...p, radius: r, innerRadius: p.innerRadius, width: r * 2, height: r * 2 };
  }
  const thin = Math.min(p.width, p.height);
  if (thin >= min) return p;
  const scale = min / thin;
  return {
    ...p,
    width: p.width * scale,
    height: p.height * scale,
  };
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
        length: L,
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

/**
 * Face aspect (width / thickness). Popsicle ~4.7, jumbo ~9, toothpick ~1.
 * Flat bars get rounded ends; near-square sticks render as thin cylinders.
 */
export function faceAspect(item: CatalogItem): number {
  const d = item.dims;
  const w = d.width ?? d.diameter ?? 0.5;
  const t = d.thickness ?? d.height ?? d.diameter ?? 0.1;
  return w / Math.max(t, 1e-4);
}

/** True craft stick: clearly flat rectangular bar (popsicle, jumbo, mini). */
export function isFlatBar(item: CatalogItem): boolean {
  if (item.formFactor !== "stick") return false;
  return faceAspect(item) >= 2.2;
}

/**
 * Near-round pin stock catalogued as stick (toothpick). More true as a thin cylinder
 * than a square box.
 */
export function isPinStick(item: CatalogItem): boolean {
  if (item.formFactor !== "stick") return false;
  return faceAspect(item) < 2.2;
}

/** Global mesh routing used by the canvas cloud. */
export function meshKind(item: CatalogItem): MeshKind {
  if (isHollow(item.formFactor)) return "hollow";
  if (isCylindrical(item.formFactor) || isPinStick(item)) return "cylinder";
  if (isFlatBar(item)) return "flatBar";
  return "box";
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

export function isHollow(ff: FormFactor): boolean {
  return ff === "tube" || ff === "pipe";
}

export function describeMaterial(id: string): string {
  const item = getCatalogItem(id);
  if (!item) return "Unknown material";
  const p = toPrimitive(item);
  if (isCylindrical(item.formFactor)) {
    const id = p.innerRadius ? ` ID ${(p.innerRadius * 2).toFixed(2)}"` : "";
    return `${item.name} (⌀${(p.radius! * 2).toFixed(2)}"${id} × ${p.length}")`;
  }
  return `${item.name} (${p.length}" × ${p.width}" × ${p.height}")`;
}


export type Aabb3 = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

/** World-space corners. Yaw is about Y through the panel center (same as PanelMesh). */
export function panelWorldCorners(panel: Panel): { x: number; y: number; z: number }[] {
  const { x, y, z } = panel.position;
  const { width: w, height: h, depth: d } = panel.size;
  const yaw = panel.yaw ?? 0;
  const locals: [number, number, number][] = [
    [x, y, z],
    [x + w, y, z],
    [x + w, y, z + d],
    [x, y, z + d],
    [x, y + h, z],
    [x + w, y + h, z],
    [x + w, y + h, z + d],
    [x, y + h, z + d],
  ];
  if (!yaw) return locals.map(([px, py, pz]) => ({ x: px, y: py, z: pz }));
  const cx = x + w / 2;
  const cz = z + d / 2;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return locals.map(([px, py, pz]) => {
    const dx = px - cx;
    const dz = pz - cz;
    return { x: cx + dx * c - dz * s, y: py, z: cz + dx * s + dz * c };
  });
}

export function aabbOfPanels(panels: Panel[]): Aabb3 | null {
  if (!panels.length) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const panel of panels) {
    for (const c of panelWorldCorners(panel)) {
      minX = Math.min(minX, c.x);
      maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y);
      maxY = Math.max(maxY, c.y);
      minZ = Math.min(minZ, c.z);
      maxZ = Math.max(maxZ, c.z);
    }
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, maxX, minY, maxY, minZ, maxZ };
}

export function aabbSize(b: Aabb3) {
  return { width: b.maxX - b.minX, height: b.maxY - b.minY, depth: b.maxZ - b.minZ };
}

/**
 * Craft stock is bought in a pack and glued whole.
 * A 10-year-old with 1,000 popsicle sticks should not be asked to cut 847 unique lengths.
 * Lumber, plywood, and shop-length pipe still cut to the list.
 */
export function isWholeStock(item: CatalogItem): boolean {
  if (item.formFactor === "stick") return true;
  if (item.category === "craft_wood") return true;
  if (item.category === "plastic") return true;
  return false;
}
