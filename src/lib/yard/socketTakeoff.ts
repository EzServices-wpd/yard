/**
 * Sch 40 slip-fitting take-off: the distance from the fitting centre to the socket bottom.
 *
 * A pipe cut to the centre-to-centre length lands long, because each end stops at the
 * socket bottom, not at the fitting centre. The cut is that centre length minus this
 * take-off at every end that meets a fitting. An open end or a foot meets no fitting,
 * so that end is not shortened.
 *
 * 3/4" is 9/16". ASTM D2466 Table 2 lists that as the minimum laying length G
 * (centre to end of socket). Spears publishes the same G on the 3/4" tee (401-007)
 * and the 3/4" 90° elbow (406-007). Charlotte Pipe's 3/4" tee (801-007) is 11/16",
 * above that minimum. The allowance used here is the 9/16" standard.
 * The rack seater's 1.375" fitting body is centre-to-face, not this take-off.
 */
import { clusterJointNodes } from "./joints";
import type { CatalogItem, Vec3, YardInstance } from "./types";

export type SocketTakeoff = { nominal: string; odIn: number; takeoffIn: number };

/** One row per nominal size. Add a size here when that pipe joins the catalog. */
export const SCH40_SOCKET_TAKEOFF: readonly SocketTakeoff[] = [
  { nominal: '3/4"', odIn: 1.05, takeoffIn: 9 / 16 },
];

const NEAR = 0.05;

/** Centre-to-socket-bottom for this pipe, or 0 when the size is not in the table. */
export function socketTakeoffIn(item: CatalogItem | null | undefined): number {
  if (!item || item.formFactor !== "pipe") return 0;
  const od = item.dims.diameter ?? 0;
  const row = SCH40_SOCKET_TAKEOFF.find((r) => Math.abs(r.odIn - od) < 0.02);
  if (!row) return 0;
  if (!(item.preferredJoins ?? []).includes("solvent")) return 0;
  if (!/schedule\s*40/i.test(item.name)) return 0;
  return row.takeoffIn;
}

function round8(n: number): number {
  return Math.round(n * 8) / 8;
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/** Ends of this segment that sit in a fitting (two or more pipes meet there). */
export function fittingEndsAt(from: Vec3, to: Vec3, nodes: { p: Vec3; dirs: Vec3[] }[]): number {
  const hit = (p: Vec3) => nodes.some((n) => dist(n.p, p) <= NEAR && n.dirs.length >= 2);
  return (hit(from) ? 1 : 0) + (hit(to) ? 1 : 0);
}

/**
 * Centre-to-centre length minus the take-off at each fitting end, on the 1/8"
 * the cut list already prints. Null when there is no allowance to take, or the
 * piece is shorter than the sockets and must keep the cut it already had.
 */
export function socketCutInches(spanIn: number, ends: number, takeoffIn: number): number | null {
  if (!(ends > 0) || !(takeoffIn > 0)) return null;
  const cut = spanIn - takeoffIn * ends;
  if (cut < 0.25) return null;
  return round8(cut);
}

/** Rewrite each slip-pipe cut to the socket length. Centre lines (from/to) stay put. */
export function withSocketCuts(instances: readonly YardInstance[], item: CatalogItem | null | undefined): YardInstance[] {
  const takeoff = socketTakeoffIn(item);
  if (!(takeoff > 0) || !item) return instances as YardInstance[];
  const radius = (item.dims.diameter ?? 1.05) / 2;
  const nodes = clusterJointNodes(instances.map((inst) => ({ from: inst.from, to: inst.to, radius })));
  // Split X: the take-off is a socket. Only a frame whose every meeting is a square catalog fitting
  // (no angled meeting, no straight butt of two pipes) has a socket at every fitting end.
  if (!nodes.every((n) => n.dirs.length < 2 || squareFitting(n.dirs))) return instances as YardInstance[];
  let changed = false;
  const next = instances.map((inst) => {
    if (inst.catalogId !== item.id || inst.cutLength == null || !inst.from || !inst.to) return inst;
    const ends = fittingEndsAt(inst.from, inst.to, nodes);
    if (ends === 0) return inst;
    const cut = socketCutInches(dist(inst.from, inst.to), ends, takeoff);
    if (cut == null || Math.abs(cut - inst.cutLength) < 1e-6) return inst;
    changed = true;
    return { ...inst, cutLength: cut };
  });
  return changed ? next : (instances as YardInstance[]);
}

/** Every pair of pipes in this meeting is square or straight through, and it is not two pipes butted end to end. */
function squareFitting(dirs: Vec3[]): boolean {
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      const d = dirs[i].x * dirs[j].x + dirs[i].y * dirs[j].y + dirs[i].z * dirs[j].z;
      if (!(Math.abs(d) < 0.08 || d < -0.95)) return false;
    }
  }
  if (dirs.length === 2) {
    const d = dirs[0].x * dirs[1].x + dirs[0].y * dirs[1].y + dirs[0].z * dirs[1].z;
    if (d < -0.95) return false;
  }
  return true;
}
