/**
 * Stepped square pyramid — Khufu geometry, not a laced loft.
 *
 * Signature features that must read at a glance:
 *   • denser courses near the base (visual mass of the tomb)
 *   • stock-aware face posts so faces are not empty four-corner panels
 *   • face diagonals on structural bays
 *   • open north door with jambs + lintel you can walk through
 *   • clear pyramidion tip (small top square, not a bare point)
 *
 * Frame = hips + base + every third structural course + door.
 * Full  = every structural course (stock-length pitch).
 * Fill  = faces packed at stick width — the finished object.
 */

import type { CatalogItem, JoinMethod } from "./types";
import {
  StructureEdge,
  StructureNode,
  Vec3,
  createId,
} from "./structureGraph";
import { stockDensity } from "./connect";
import { squareCorner, facePoint } from "./lattice";

/**
 * Khufu-style door on a square pyramid. Craft scale: a mouth a stranger
 * can name. Person scale: a real doorway.
 */
export function pyramidDoorDims(
  height: number,
  half: number,
  personish: boolean,
): { width: number; height: number } {
  if (personish) {
    return {
      width: Math.max(24, Math.min(half * 0.32, 36)),
      height: Math.max(36, Math.min(height * 0.22, 48)),
    };
  }
  return {
    width: Math.max(3.8, Math.min(half * 0.34, height * 0.24)),
    height: Math.max(4.4, Math.min(height * 0.24, half * 0.4)),
  };
}

function uStops(count: number): number[] {
  if (count <= 1) return [0, 1];
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(i / count);
  return out;
}

/**
 * Bias stations denser near the base so the lower third has more courses
 * (the visual mass of a real pyramid) without exploding the piece count.
 */
function baseBiasedStations(H: number, nFill: number): number[] {
  const stations: number[] = [];
  for (let i = 0; i <= nFill; i++) {
    const u = i / nFill;
    // ease-in: more samples in the lower third
    const t = u * u * (3 - 2 * u); // smoothstep
    // blend toward linear so upper courses are not too sparse
    const biased = u * 0.45 + t * 0.55;
    stations.push(biased * H);
  }
  // ensure exact tip
  stations[stations.length - 1] = H;
  return stations;
}

export function buildSteppedPyramid(opts: {
  height: number;
  half0: number;
  half1?: number;
  item: CatalogItem;
  join: JoinMethod;
  braceJoin: JoinMethod;
  grain?: number;
}): {
  nodes: StructureNode[];
  edges: StructureEdge[];
  door: { width: number; height: number; z0: number };
} {
  const dens = stockDensity(opts.item, opts.grain ?? 1);
  const H = Math.max(opts.height, 12);
  const h0 = Math.max(opts.half0, 6);
  const h1 = Math.max(opts.half1 ?? dens.thick * 2.4, dens.thick * 1.8);
  const stickW = Math.max(opts.item.dims?.width ?? dens.thick, dens.thick, 0.28);
  const g = Math.max(opts.grain ?? 1, 1);

  // Structural pitch: fat stock gets fewer, longer courses; thin gets denser
  const structPitch = dens.fat
    ? Math.max(H / 6.5, dens.bay * 1.05)
    : Math.max(dens.stock * 0.9, dens.bay * 1.9, H / 12);
  const nStruct = Math.max(
    dens.fat ? 5 : 6,
    Math.min(dens.fat ? 8 : 14, Math.round(H / structPitch)),
  );
  // Fill courses: stick-width packing for thin stock so faces read solid
  const nFill = dens.fat
    ? nStruct
    : Math.max(nStruct, Math.min(110, Math.round(H / (stickW * g * 0.92))));
  const stride = Math.max(1, Math.round(nFill / nStruct));
  const frameStride = stride * 3;

  const halfAt = (t: number) => h0 + (h1 - h0) * Math.min(1, Math.max(0, t));
  const personish =
    (opts.item.category === "lumber" || opts.item.category === "sheet_goods") &&
    H >= 72;
  const door = pyramidDoorDims(H, h0, personish);
  const doorW = door.width;
  const NORTH = 2; // face index whose outward normal points −Z

  let stations = baseBiasedStations(H, nFill);
  const pitch = H / nFill;
  const near = stations.findIndex((y) => Math.abs(y - door.height) < pitch * 0.5);
  let doorY = door.height;
  if (near >= 0) {
    doorY = stations[near]!;
  } else {
    stations.push(door.height);
    stations = [...stations].sort((a, b) => a - b);
    doorY = door.height;
  }
  // de-dupe after insert
  const uniq: number[] = [];
  for (const y of stations) {
    if (!uniq.length || Math.abs(y - uniq[uniq.length - 1]) > pitch * 0.2) uniq.push(y);
  }
  stations = uniq;
  stations[stations.length - 1] = H;
  const doorIdx = stations.findIndex((y) => Math.abs(y - doorY) < 0.08);

  const nodes: StructureNode[] = [];
  const edges: StructureEdge[] = [];
  const addNode = (p: Vec3, role: StructureNode["role"]) => {
    const id = createId("n");
    nodes.push({ id, position: p, role });
    return id;
  };
  const addEdge = (
    from: string,
    to: string,
    role: StructureEdge["role"],
    critical = false,
    join = opts.join,
  ) => {
    if (from === to) return;
    edges.push({ id: createId("e"), from, to, join, role, critical });
  };

  // corners[i][c] — corner node at station i, corner c
  const corners: string[][] = [];
  // facePosts[i][f] — ordered face-post ids (incl. corners) on face f at station i
  const facePosts: string[][][] = [];
  const jambL: string[] = [];
  const jambR: string[] = [];
  const last = stations.length - 1;

  const beltRoleAt = (i: number): StructureEdge["role"] => {
    if (i === 0) return "ring";
    if (i === last || i === doorIdx) return "rail";
    if (i % frameStride === 0) return "rail";
    if (i % stride === 0) return "brace";
    return "skin";
  };

  // Face-post count driven by stock faceStep so thin sticks fill faces
  const faceDivsAt = (half: number): number => {
    if (dens.fat) {
      return half > dens.stock * 2.2 ? 1 : 0;
    }
    const faceW = half * 2;
    return Math.max(
      0,
      Math.min(8, Math.round(faceW / Math.max(dens.faceStep, stickW * 1.4)) - 1),
    );
  };

  for (let i = 0; i < stations.length; i++) {
    const y = stations[i]!;
    const t = y / H;
    const half = halfAt(t);
    const beltRole = beltRoleAt(i);
    const nodeRole: StructureNode["role"] =
      i === 0 ? "base" : i === last ? "tip" : "leg";
    const row: string[] = [];
    for (let c = 0; c < 4; c++) {
      row.push(addNode(squareCorner(half, y, c), nodeRole));
    }
    corners.push(row);

    // Face posts (stock-aware mid-face nodes)
    const nMid = faceDivsAt(half);
    const us = uStops(nMid + 1);
    const faces: string[][] = [];
    for (let f = 0; f < 4; f++) {
      const ids: string[] = [];
      for (const u of us) {
        if (u === 0) {
          ids.push(row[f]!);
          continue;
        }
        if (u === 1) {
          ids.push(row[(f + 1) % 4]!);
          continue;
        }
        ids.push(
          addNode(
            facePoint(half, y, f, u),
            i === 0 ? "base" : i === last ? "tip" : "ring",
          ),
        );
      }
      faces.push(ids);
    }
    facePosts.push(faces);

    // Door jambs on north face (only while below / at lintel)
    const belowDoor = y < doorY - 0.08;
    const atDoor = Math.abs(y - doorY) < 0.08;
    if (y <= doorY + 0.08) {
      const zN = -half;
      jambL.push(
        addNode(
          { x: -doorW / 2, y, z: zN },
          y < 0.4 ? "base" : "leg",
        ),
      );
      jambR.push(
        addNode(
          { x: doorW / 2, y, z: zN },
          y < 0.4 ? "base" : "leg",
        ),
      );
    }

    // Horizontal belts (including face-post segments)
    for (let f = 0; f < 4; f++) {
      const chain = faces[f]!;
      const north = f === NORTH;
      if (north && (belowDoor || atDoor) && jambL.length && jambR.length) {
        // Split the north belt around the door opening
        const jl = jambL[jambL.length - 1]!;
        const jr = jambR[jambR.length - 1]!;
        // left corner → left jamb
        addEdge(chain[0]!, jl, beltRole, i === 0 || atDoor);
        // lintel only at the door course
        if (atDoor) addEdge(jl, jr, "rail", true);
        // right jamb → right corner
        addEdge(jr, chain[chain.length - 1]!, beltRole, i === 0 || atDoor);
      } else {
        for (let k = 0; k < chain.length - 1; k++) {
          addEdge(chain[k]!, chain[k + 1]!, beltRole, i === 0 || i === last);
        }
      }
    }
  }

  // Four hip rafters (corner chords) — continuous from base to tip
  for (let c = 0; c < 4; c++) {
    for (let i = 0; i < last; i++) {
      addEdge(corners[i]![c]!, corners[i + 1]![c]!, "leg", true);
    }
  }

  // Vertical face posts between stations (same u-fraction)
  for (let f = 0; f < 4; f++) {
    for (let i = 0; i < last; i++) {
      const lo = facePosts[i]![f]!;
      const hi = facePosts[i + 1]![f]!;
      // Match by index; lengths can differ as half shrinks
      const n = Math.min(lo.length, hi.length);
      for (let k = 1; k < n - 1; k++) {
        // map k from lo into hi proportionally
        const u = k / (lo.length - 1);
        const j = Math.round(u * (hi.length - 1));
        if (j > 0 && j < hi.length - 1) {
          addEdge(lo[k]!, hi[j]!, "brace", false, opts.braceJoin);
        }
      }
    }
  }

  // Face diagonals on structural bays (triangulate so faces don't rack)
  for (let i = 0; i < last; i++) {
    const isStruct = i % stride === 0 || i === doorIdx;
    if (!isStruct && dens.fat) continue;
    for (let f = 0; f < 4; f++) {
      if (f === NORTH && stations[i]! < doorY) continue; // never lace the opening
      const lo = facePosts[i]![f]!;
      const hi = facePosts[i + 1]![f]!;
      if (lo.length < 2 || hi.length < 2) continue;
      // Warren-style single diagonal per bay, alternating direction
      if (i % 2 === 0) {
        addEdge(lo[0]!, hi[hi.length - 1]!, "brace", false, opts.braceJoin);
      } else {
        addEdge(lo[lo.length - 1]!, hi[0]!, "brace", false, opts.braceJoin);
      }
      // On frame courses with mid posts, add a second diagonal for X
      if (i % frameStride === 0 && lo.length >= 3 && !dens.fat) {
        addEdge(lo[0]!, hi[Math.floor(hi.length / 2)]!, "brace", false, opts.braceJoin);
        addEdge(lo[lo.length - 1]!, hi[Math.floor(hi.length / 2)]!, "brace", false, opts.braceJoin);
      }
    }
  }

  // Door jambs run continuous to the lintel
  for (let i = 0; i < jambL.length - 1; i++) {
    addEdge(jambL[i]!, jambL[i + 1]!, "leg", true);
    addEdge(jambR[i]!, jambR[i + 1]!, "leg", true);
  }

  // Pyramidion: small top cross so the tip reads as a finished cap, not a point
  const tipHalf = halfAt(1);
  if (tipHalf > dens.thick * 1.6) {
    addEdge(corners[last]![0]!, corners[last]![2]!, "rail", true, opts.braceJoin);
    addEdge(corners[last]![1]!, corners[last]![3]!, "rail", true, opts.braceJoin);
  }
  // Peak node slightly above the last course when the tip is still open
  if (tipHalf > dens.thick * 2.5) {
    const peak = addNode({ x: 0, y: H + dens.thick * 0.35, z: 0 }, "tip");
    for (let c = 0; c < 4; c++) {
      addEdge(corners[last]![c]!, peak, "leg", true);
    }
  }

  return {
    nodes,
    edges,
    door: { width: doorW, height: doorY, z0: -h0 },
  };
}
