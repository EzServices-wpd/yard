/**
 * Where a pipe frame is placed.
 *
 * Geometry joints leave the pipes where the grid snapped them, and a wall rack
 * never takes the freestanding drop, so the assembled frame no longer meets y = 0.
 * One rule for every seated pipe frame: the lowest outside of the round stock
 * (the pipe OD; a fitting is centered on that pipe) rests on y = 0. The whole
 * frame shifts together, so lengths, joint kinds, and step order stay put.
 */
import { getCatalogItem } from "./catalog";
import { jointNodes } from "./joints";
import { drawnExtent } from "./pdfDraw";
import { isSeatedPipeFrame } from "./pipeRackFrame";
import type { YardProject } from "./types";

/** Open end below this is a foot, not a cap (classifyJoint). */
const GROUND_Y = 0.45;
/** A member whose low end is at or below this rests on the floor (roleSupports). */
const FLOOR_Y = 0.1;

function shift<T extends { y: number }>(v: T, dy: number): T {
  return { ...v, y: v.y + dy };
}

/**
 * A uniform lift or drop would move an open end across the foot/cap line, or a
 * member end across the floor line. Either one changes Buy or step order, so
 * the frame is left where it is.
 */
function crossesGrade(project: YardProject, dy: number): boolean {
  for (const inst of project.instances) {
    if (!inst.from || !inst.to) continue;
    const y0 = Math.min(inst.from.y, inst.to.y);
    if ((y0 <= FLOOR_Y) !== (y0 + dy <= FLOOR_Y)) return true;
  }
  const item = getCatalogItem(project.primaryMaterialId);
  const radius = (item?.dims.diameter ?? 0) / 2;
  if (!(radius > 0)) return false;
  const nodes = jointNodes(project.instances.map((inst) => ({ from: inst.from, to: inst.to, radius })));
  for (const node of nodes) {
    if (node.dirs.length > 1) continue;
    if ((node.p.y < GROUND_Y) !== (node.p.y + dy < GROUND_Y)) return true;
  }
  return false;
}

/** Seat a geometry-joint pipe frame on y = 0. Any other build is returned as it arrived. */
export function restSeatedFrame(project: YardProject): YardProject {
  if (!isSeatedPipeFrame(project)) return project;
  const ext = drawnExtent(project);
  if (!ext || !(Math.abs(ext.min.y) > 1e-6)) return project;
  const dy = -ext.min.y;
  if (crossesGrade(project, dy)) return project;
  return {
    ...project,
    instances: project.instances.map((inst) => ({
      ...inst,
      position: shift(inst.position, dy),
      ...(inst.from ? { from: shift(inst.from, dy) } : {}),
      ...(inst.to ? { to: shift(inst.to, dy) } : {}),
      ...(inst.home ? { home: shift(inst.home, dy) } : {}),
    })),
  };
}
