/**
 * A refused build drew the size it refused (the measure wire, the hull, the floor shadow) even with no parts.
 * The stage frames a small empty bench instead, and draws none of those outlines.
 */
import { benchModelBox } from "@/lib/yard/benchFrame";
import { hullStrokes } from "@/lib/yard/ghost";
import type { YardProject } from "@/lib/yard/types";
import { measureBoxStrokes, type Pt } from "./measure-box";

type Emptyable = { refused?: string; panels?: unknown[]; instances?: unknown[] };

export function refusedEmpty(project: Emptyable): boolean {
  return typeof project.refused === "string" && project.refused.length > 0 && !project.panels?.length && !project.instances?.length;
}

/** Same span the empty bench uses (36 inches), not the refused overall. */
const EMPTY_BOX = { minX: -18, maxX: 18, minY: 0, maxY: 36, minZ: -18, maxZ: 18 };

export function stageBox(project: Pick<YardProject, "panels" | "instances" | "overall" | "refused">): ReturnType<typeof benchModelBox> {
  return refusedEmpty(project) ? EMPTY_BOX : benchModelBox(project);
}

/** Wire the stage would draw for this project. Empty when the build was refused. */
export function stageOutlines(project: YardProject, o: { measureOpen: boolean; showHull: boolean; width: number; height: number; depth: number }): Pt[][] {
  if (refusedEmpty(project)) return [];
  const lines: Pt[][] = [];
  if (o.showHull) for (const s of hullStrokes(project)) lines.push(s.points);
  if (o.measureOpen && o.width > 0 && o.height > 0) lines.push(...measureBoxStrokes(o.width, o.height, o.depth || 16));
  return lines;
}
