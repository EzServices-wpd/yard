import type { Panel } from "./types";

/**
 * OPERATE face classes — doors, drawers, and hinged lids.
 * Lid is panel type "top" named Lid (chest/trunk/box); never a table Top / counter.
 */
export type OperateFaceKinds = {
  doors: number;
  drawers: number;
  lids: number;
};

/**
 * Hinged-lid Operate panel — universal chest/trunk/box lid, not noun-only.
 * Lift-off lids are named "Lift-off lid" (no Operate swing / no /^Lid\b/ match).
 */
/** The edge a door hangs from: its name says, else the side of center it sits on (a centered single door hangs left).
 * The model, the support graph, the steps and the pull all read this one answer. */
export function doorHingesLeft(panel: Pick<Panel, "name" | "position" | "size">): boolean {
  if (/left/i.test(panel.name)) return true;
  if (/right/i.test(panel.name)) return false;
  return panel.position.x + panel.size.width / 2 < 0.5;
}

export function isHingedLidPanel(panel: Panel): boolean {
  return panel.type === "top" && /^Lid\b/i.test(panel.name);
}

export function operateFaceKinds(panels: readonly Panel[]): OperateFaceKinds {
  let doors = 0;
  let drawers = 0;
  let lids = 0;
  const seen = new Set<string>();
  for (const p of panels) {
    if (p.type === "door") doors += 1;
    else if (p.type === "drawer") { if (!p.drawerId || !seen.has(p.drawerId)) drawers += 1; if (p.drawerId) seen.add(p.drawerId); }
    else if (isHingedLidPanel(p)) lids += 1;
  }
  return { doors, drawers, lids };
}

export function hasOperableFaces(kinds: OperateFaceKinds): boolean {
  return kinds.doors > 0 || kinds.drawers > 0 || kinds.lids > 0;
}

/**
 * Densify Operate label to the face class(es) present.
 * Door-only / drawer-only / lid-only drop the slash mash; mixed keep " / ".
 */
export function operateFacesLabel(open: boolean, kinds: OperateFaceKinds): string {
  const verb = open ? "Shut" : "Open";
  const parts: string[] = [];
  if (kinds.doors > 0) parts.push(kinds.doors === 1 ? "door" : "doors");
  if (kinds.drawers > 0) parts.push(kinds.drawers === 1 ? "drawer" : "drawers");
  if (kinds.lids > 0) parts.push(kinds.lids === 1 ? "lid" : "lids");
  if (parts.length === 0) return `${verb} faces`;
  if (parts.length === 1) return `${verb} ${parts[0]}`;
  return `${verb} ${parts.join(" / ")}`;
}
