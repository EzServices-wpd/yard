import { projectSolids, truePts } from "./pdfDraw";
import { modelProudNote } from "./modelSize";
import type { YardProject } from "./types";

/** The height the plan states: a pocket build's unit, else the overall box (from the floor, as the header reads it). */
export function statedHeight(project: YardProject): number {
  return project.pocket?.unit?.height ?? project.overall.height;
}

/** A door or drawer front the build says stands proud (the note travels with it, so it may pass the box). */
function proudPart(project: YardProject, id: string): boolean {
  const p = project.panels.find((q) => q.id === id);
  if (!p || !(p.type === "door" || /\bfront\b/i.test(p.name))) return false;
  return !!modelProudNote(project.panels, project.overall.depth) || project.notes.some((n) => /\bproud\b/i.test(n));
}

/**
 * Parts whose true surface rises above the stated height by more than 1/16" (a jar lip sat on the top shelf, standing
 * over the uprights). Doors and fronts with a proud-part note are allowed past it.
 */
export function partsAboveStatedHeight(project: YardProject): { id: string; name: string; over: number }[] {
  const H = statedHeight(project);
  const out: { id: string; name: string; over: number }[] = [];
  for (const s of projectSolids(project)) {
    const pts = truePts(project, s);
    if (!pts.length) continue;
    const top = Math.max(...pts.map((p) => p.y));
    if (top > H + 1 / 16 && !proudPart(project, s.id)) {
      const name = project.panels.find((q) => q.id === s.id)?.name ?? (project.instances.find((i) => i.id === s.id)?.catalogId ?? s.id);
      out.push({ id: s.id, name, over: Math.round((top - H) * 1000) / 1000 });
    }
  }
  return out;
}
