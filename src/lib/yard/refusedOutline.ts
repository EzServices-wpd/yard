/**
 * A refusal's outline (Critic #103 r2 row 147): every refused build (a size too small to use, a count that doesn't fit)
 * draws the same faint dashed outline of the size typed, so the bench isn't empty, and nothing else: no shadow, no
 * Measure box, no part. The caption says what it is; it is never a placeholder presented as a build.
 */
import type { YardProject } from "./types";

export type OutlineBox = { width: number; height: number; depth: number };

export function refusedOutline(p: Pick<YardProject, "refused" | "panels" | "instances" | "overall">): OutlineBox | null {
  if (!p.refused || p.panels.length || (p.instances ?? []).length) return null;
  const { width, height, depth } = p.overall;
  return width > 0 && height > 0 && depth > 0 ? { width, height, depth } : null;
}

export const REFUSED_OUTLINE_CAPTION = "The faint outline is the size you typed.";

/** The outline's twelve edges, centred on the bench like an empty build's frame (benchModelBox). */
export function outlineEdges({ width, height, depth }: OutlineBox): [number, number, number][][] {
  const x = width / 2, z = depth / 2;
  const c = (sx: number, y: number, sz: number): [number, number, number] => [sx * x, y, sz * z];
  const ring = (y: number) => [c(-1, y, -1), c(1, y, -1), c(1, y, 1), c(-1, y, 1), c(-1, y, -1)];
  return [ring(0), ring(height), ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => [c(sx, 0, sz), c(sx, height, sz)])];
}
