import { aabbOfPanels } from "./geometry";
import { frac } from "./pdfKit";
import type { Panel } from "./types";

/**
 * The solved model is the one source of truth for size. Overlay doors and drawer fronts stand proud
 * of the box, so when the model runs deeper than the box size this returns the talk that says so
 * ("17 3/4" deep with the doors on"). The PDF cover, the cover arrow and the workspace HUD all read it.
 */
export function modelProudTalk(panels: Panel[] | undefined, boxDepth: number): string {
  const list = panels ?? [];
  const box3 = aabbOfPanels(list);
  const hasDoor = list.some((p) => p.type === "door");
  const hasFront = list.some((p) => /drawer\s*front/i.test(p.name));
  if (!box3 || !(hasDoor || hasFront)) return "";
  const deep = box3.maxZ - box3.minZ;
  if (!(deep > boxDepth + 1 / 16)) return "";
  const faceWord = hasDoor && hasFront ? "the doors and drawer fronts" : hasDoor ? "the doors" : "the drawer fronts";
  return `${frac(deep)} deep with ${faceWord} on`;
}
