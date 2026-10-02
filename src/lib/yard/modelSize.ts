import { aabbOfPanels } from "./geometry";
import { frac } from "./pdfKit";
import type { Panel } from "./types";

/**
 * Overlay doors and drawer fronts stand proud of the box. The stranger sees one depth:
 * the finished depth (the model), and a note with no second number. Cut-list thickness
 * stays the box. The PDF cover, the plan check, and the workspace HUD all read this.
 */
export function modelFinishedDepth(panels: Panel[] | undefined, boxDepth: number): number {
  const list = panels ?? [];
  const box3 = aabbOfPanels(list);
  if (!box3) return boxDepth;
  const deep = box3.maxZ - box3.minZ;
  if (deep > boxDepth + 1 / 16) return deep;
  return boxDepth;
}

/** Note only. Never a second inch figure. */
export function modelProudNote(panels: Panel[] | undefined, boxDepth: number): string {
  const list = panels ?? [];
  const hasDoor = list.some((p) => p.type === "door");
  const hasFront = list.some((p) => /drawer\s*front/i.test(p.name));
  if (!(hasDoor || hasFront)) return "";
  if (!(modelFinishedDepth(list, boxDepth) > boxDepth + 1 / 16)) return "";
  if (hasDoor && hasFront) return "doors and drawer fronts stand proud";
  return hasDoor ? "doors stand proud" : "drawer fronts stand proud";
}

/** @deprecated Prefer modelProudNote. Kept so older callers do not print a second depth. */
export function modelProudTalk(panels: Panel[] | undefined, boxDepth: number): string {
  return modelProudNote(panels, boxDepth);
}

/** Swap the trailing box depth in a stamped title for the finished depth. */
export function stampFinishedDepth(name: string, boxDepth: number, finished: number): string {
  if (!(finished > boxDepth + 1 / 16)) return name;
  const fin = frac(finished);
  if (!/[×x]\s*[\d\s/]+["″″']?\s*$/.test(name)) return name;
  return name.replace(/[×x]\s*[\d\s/]+["″″']?\s*$/, `× ${fin}`);
}
