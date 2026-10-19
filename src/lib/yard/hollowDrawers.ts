import type { Panel, YardProject } from "./types";
import { plySheetThickness } from "./sheetThickness";

/**
 * Hollow drawers (class F17 doors-drawers, 10-17). Every drawer in every build is a real open box of five parts: a
 * front, two sides, a back and a 1/4" bottom, cut from the same stock rows the cut list carries, with an open top and
 * nothing filling its inside. Each part carries its drawer's id. The builders lay a drawer out as one envelope; this
 * pass, run once on the finished model, turns every envelope into its parts.
 */

export const DRAWER_SIDE_T = 0.75;
/** A drawer box's sides and back are cut from the drawer's own sheet, at that sheet's thickness (3/4" off a sheet). */
export const drawerSideT = (boxMaterialId: string | undefined) => plySheetThickness(boxMaterialId) ?? DRAWER_SIDE_T;
export const DRAWER_BOTTOM_T = 0.25;
const r8 = (n: number) => Math.round(n * 8) / 8;

type Box = { x: number; y: number; z: number; w: number; h: number; d: number };
const span = (a: number, al: number, b: number, bl: number) => Math.min(a + al, b + bl) - Math.max(a, b);

/** A drawer envelope still waiting to be hollowed (a solid block). */
export const isSolidDrawer = (p: Pick<Panel, "type" | "name" | "drawerId">) => p.type === "drawer" && !p.drawerId && !/drawer\s*front/i.test(p.name);

/** The ¼" bottom of a sheet- or board-stock drawer is cut from the ¼" sheet (the cut list's row); other stock keeps its own. */
export function drawerBottomStock(boxMaterialId: string): string {
  return /plywood/i.test(boxMaterialId) || /^lumber-1x\d+-/.test(boxMaterialId) ? "plywood-1-4-4x8" : boxMaterialId;
}

/** "Left drawer 1" + "side" → "Left drawer side 1"; "Drawer" + "back" → "Drawer back". */
function partName(box: string, part: string): string {
  return /\bdrawer\b/i.test(box) ? box.replace(/\b(drawer)\b/i, `$1 ${part}`) : `${box} drawer ${part}`;
}

/** One envelope → its four box parts, the same sizes the cut list always cut (explodeDrawerBoxCuts). */
export function hollowParts(env: Panel): Panel[] {
  const { x, y, z } = env.position;
  const H = r8(env.size.height), D = r8(env.size.depth);
  const T = drawerSideT(env.materialId);
  const innerW = Math.max(r8(env.size.width - 2 * T), 1);
  const bottomD = Math.max(r8(env.size.depth - T), 1);
  const id = env.id;
  const tag = (part: Panel["drawerPart"], name: string, at: Box, materialId = env.materialId): Panel => {
    const { yaw: _yaw, joints: _joints, ...rest } = env;
    return { ...rest, id: `${id}-${name.toLowerCase().replace(/\W+/g, "-")}`, type: "drawer", name, position: { x: at.x, y: at.y, z: at.z }, size: { width: at.w, height: at.h, depth: at.d }, materialId, drawerId: id, drawerPart: part };
  };
  return [
    tag("side", `${partName(env.name, "side")} (left)`, { x, y, z, w: T, h: H, d: D }),
    tag("side", `${partName(env.name, "side")} (right)`, { x: x + T + innerW, y, z, w: T, h: H, d: D }),
    tag("back", partName(env.name, "back"), { x: x + T, y, z, w: innerW, h: H, d: T }),
    tag("bottom", partName(env.name, "bottom"), { x: x + T, y, z: z + T, w: innerW, h: DRAWER_BOTTOM_T, d: bottomD }, drawerBottomStock(env.materialId)),
  ];
}

/** Every drawer envelope in the model becomes a hollow five-part drawer; its front takes the drawer's id. */
export function hollowDrawers(project: YardProject): YardProject {
  const envs = project.panels.filter((p) => isSolidDrawer(p) && !p.yaw);
  if (!envs.length) return project;
  const fronts = project.panels.filter((p) => /drawer\s*front/i.test(p.name) && !p.drawerId);
  const frontOf = new Map<string, string>();
  for (const f of fronts) {
    // The front closes the envelope it overlaps most face-on.
    let best: Panel | undefined, area = 0.25;
    for (const e of envs) {
      const a = Math.max(0, span(f.position.x, f.size.width, e.position.x, e.size.width)) * Math.max(0, span(f.position.y, f.size.height, e.position.y, e.size.height));
      if (a > area && ![...frontOf.values()].includes(e.id)) { best = e; area = a; }
    }
    if (best) frontOf.set(f.id, best.id);
  }
  const panels = project.panels.flatMap((p) => {
    if (envs.includes(p)) return hollowParts(p);
    const id = frontOf.get(p.id);
    return id ? [{ ...p, drawerId: id, drawerPart: "front" as const }] : [p];
  });
  return { ...project, panels };
}

/**
 * One box per drawer, for counting and sizing: a hollow drawer's parts read back as their envelope (the drawer's id,
 * its name and its outside box); a solid envelope reads as itself.
 */
export function drawerBoxes(panels: Panel[]): Panel[] {
  const out: Panel[] = [];
  const groups = new Map<string, Panel[]>();
  for (const p of panels) {
    if (p.type !== "drawer" || /drawer\s*front/i.test(p.name)) continue;
    if (!p.drawerId) { out.push(p); continue; }
    groups.set(p.drawerId, [...(groups.get(p.drawerId) ?? []), p]);
  }
  for (const [id, parts] of groups) {
    const x0 = Math.min(...parts.map((q) => q.position.x)), x1 = Math.max(...parts.map((q) => q.position.x + q.size.width));
    const y0 = Math.min(...parts.map((q) => q.position.y)), y1 = Math.max(...parts.map((q) => q.position.y + q.size.height));
    const z0 = Math.min(...parts.map((q) => q.position.z)), z1 = Math.max(...parts.map((q) => q.position.z + q.size.depth));
    const back = parts.find((q) => q.drawerPart === "back") ?? parts[0];
    const name = back.name.replace(/\s*\bback\b/i, "").replace(/\s+/g, " ").trim();
    out.push({ ...back, id, name, drawerPart: undefined, position: { x: x0, y: y0, z: z0 }, size: { width: x1 - x0, height: y1 - y0, depth: z1 - z0 }, materialId: parts.find((q) => q.drawerPart === "side")?.materialId ?? back.materialId });
  }
  return out;
}

/** Every part of one drawer (its front included), by the drawer's id. */
export const drawerParts = (panels: Panel[], id: string) => panels.filter((p) => p.drawerId === id || p.id === id);
