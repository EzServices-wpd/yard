/**
 * Continuous square loft — the Stage 1 frame primitive.
 *
 * One structure, not stacked floors:
 *   • corner chords run the full height on a profile curve
 *   • face posts keep the same u-fraction so lacing continues
 *   • horizontals only at hoops (base, platforms, a few belts)
 *   • Warren diagonals triangulate each bay
 *
 * Accuracy first (profile + zones), then stock density, then a
 * downward load path so the model can stand.
 */

import type { CatalogItem, JoinMethod } from "./types";
import {
  StructureEdge,
  StructureNode,
  Vec3,
  createId,
} from "./structureGraph";
import { dist, lerp, stockDensity } from "./connect";

export type ProfileStation = { t: number; face: number };

export function halfAtStations(stations: ProfileStation[], t: number): number {
  if (!stations.length) return 1;
  const u = Math.min(1, Math.max(0, t));
  if (u <= stations[0].t) return stations[0].face / 2;
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    if (u <= b.t) {
      const s = (u - a.t) / Math.max(b.t - a.t, 1e-6);
      const ease = s * s * (3 - 2 * s);
      return (a.face + (b.face - a.face) * ease) / 2;
    }
  }
  return stations[stations.length - 1].face / 2;
}

export function squareCorner(half: number, y: number, corner: number): Vec3 {
  const a = (corner / 4) * Math.PI * 2 + Math.PI / 4;
  const r = half * Math.SQRT2;
  return { x: Math.cos(a) * r, y, z: Math.sin(a) * r };
}

export function facePoint(half: number, y: number, face: number, u: number): Vec3 {
  const a = squareCorner(half, y, face);
  const b = squareCorner(half, y, (face + 1) % 4);
  return lerp(a, b, u);
}

export type LoftOptions = {
  height: number;
  halfAt: (t: number) => number;
  ts: number[];
  item: CatalogItem;
  hoopAt: (t: number, index: number) => boolean;
  /** Faces get lattice only when this is true at the *lower* story. */
  laceFace: (t0: number, t1: number) => boolean;
  /** Use both diagonals (X) instead of Warren. */
  bothDiagonals?: (t0: number) => boolean;
  /** Cap face divisions so a skinny tower does not become a solid. */
  maxFaceDivs?: number;
  join: JoinMethod;
  braceJoin: JoinMethod;
  pierChords?: number;
};

export type LoftBuild = {
  nodes: StructureNode[];
  edges: StructureEdge[];
  mains: string[][];
  stories: number[];
};

function uStops(count: number): number[] {
  if (count <= 1) return [0, 1];
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(i / count);
  return out;
}

function nearest(us: number[], u: number): number {
  let best = 0;
  let d = Infinity;
  for (let i = 0; i < us.length; i++) {
    const ad = Math.abs(us[i] - u);
    if (ad < d) {
      d = ad;
      best = i;
    }
  }
  return best;
}

export function buildSquareLoft(opts: LoftOptions): LoftBuild {
  const dens = stockDensity(opts.item);
  const ts = opts.ts;
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

  const mains: string[][] = [];
  // facePosts[L][face][k] aligned to uStops at that story
  const facePosts: string[][][] = [];
  const faceUs: number[][][] = [];

  for (let L = 0; L < ts.length; L++) {
    const t = ts[L];
    const y = t * opts.height;
    const half = opts.halfAt(t);
    const role: StructureNode["role"] =
      L === 0 ? "base" : L === ts.length - 1 ? "tip" : "leg";
    const row: string[] = [];
    for (let c = 0; c < 4; c++) {
      row.push(addNode(squareCorner(half, y, c), role));
    }
    mains.push(row);

    const faceW = half * 2;
    const nMid = dens.fat
      ? faceW > dens.stock * 1.6
        ? 1
        : 0
      : Math.max(0, Math.min(opts.maxFaceDivs ?? 10, Math.round(faceW / dens.faceStep) - 1));
    const us = uStops(nMid + 1);
    const faces: string[][] = [];
    const uRows: number[][] = [];
    for (let f = 0; f < 4; f++) {
      const ids: string[] = [];
      const uf: number[] = [];
      for (const u of us) {
        if (u === 0) {
          ids.push(row[f]);
          uf.push(0);
          continue;
        }
        if (u === 1) {
          ids.push(row[(f + 1) % 4]);
          uf.push(1);
          continue;
        }
        ids.push(addNode(facePoint(half, y, f, u), L === 0 ? "base" : "ring"));
        uf.push(u);
      }
      faces.push(ids);
      uRows.push(uf);
    }
    facePosts.push(faces);
    faceUs.push(uRows);

    if (opts.hoopAt(t, L)) {
      for (let f = 0; f < 4; f++) {
        const chain = faces[f];
        for (let i = 0; i < chain.length - 1; i++) {
          addEdge(chain[i], chain[i + 1], L === 0 ? "ring" : "rail", L === 0 || t > 0.05);
        }
      }
    }
  }

  for (let L = 0; L < ts.length - 1; L++) {
    const lace = opts.laceFace(ts[L], ts[L + 1]);
    for (let c = 0; c < 4; c++) {
      addEdge(mains[L][c], mains[L + 1][c], "leg", true);
    }
    if (!lace) continue;
    for (let f = 0; f < 4; f++) {
      const lo = facePosts[L][f];
      const hi = facePosts[L + 1][f];
      const uLo = faceUs[L][f];
      const uHi = faceUs[L + 1][f];
      for (let i = 0; i < lo.length; i++) {
        const j = nearest(uHi, uLo[i]);
        if (i !== 0 && i !== lo.length - 1) {
          addEdge(lo[i], hi[j], "brace", false, opts.braceJoin);
        }
        if (i + 1 < lo.length) {
          const j2 = nearest(uHi, uLo[i + 1]);
          const x = opts.bothDiagonals?.(ts[L]) ?? false;
          if (x || L % 2 === 0) addEdge(lo[i], hi[j2], "brace", false, opts.braceJoin);
          if (x || L % 2 === 1) addEdge(lo[i + 1], hi[j], "brace", false, opts.braceJoin);
        }
      }
    }
  }

  const pierN = opts.pierChords ?? 0;
  if (pierN > 1 && !dens.fat) {
    const spread = Math.max(dens.thick * 2.2, 0.4);
    for (let L = 0; L < ts.length; L++) {
      const t = ts[L];
      if (t > 0.36) continue;
      const y = t * opts.height;
      const half = opts.halfAt(t);
      for (let c = 0; c < 4; c++) {
        const axis = squareCorner(half, y, c);
        const a = (c / 4) * Math.PI * 2 + Math.PI / 4;
        const inward = { x: -Math.cos(a), z: -Math.sin(a) };
        const tangent = { x: -Math.sin(a), z: Math.cos(a) };
        const extras = pierN >= 4 ? ([-1, 1] as const) : ([-1] as const);
        const ids: string[] = [];
        for (const ti of extras) {
          ids.push(
            addNode(
              {
                x: axis.x + tangent.x * spread * ti + inward.x * spread * 0.7,
                y,
                z: axis.z + tangent.z * spread * ti + inward.z * spread * 0.7,
              },
              L === 0 ? "base" : "leg",
            ),
          );
        }
        for (const id of ids) addEdge(mains[L][c], id, "brace", false, opts.braceJoin);
        if (ids.length === 2) addEdge(ids[0], ids[1], "brace", false, opts.braceJoin);
      }
    }
  }

  return { nodes, edges, mains, stories: ts };
}

/** Drop a belt every `every` stories, plus forced t values (platforms). */
export function hoopSchedule(ts: number[], forced: number[], every: number) {
  return (t: number, index: number) => {
    if (index === 0 || index === ts.length - 1) return true;
    if (forced.some((p) => Math.abs(p - t) < 0.012)) return true;
    return every > 1 && index % every === 0;
  };
}

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

/**
 * Khufu is stacked courses, not a laced loft. Square belts shrink to a
 * pyramidion, four hip rafters, a north-face door you can walk through.
 * Frame = hips + base + every third course + door. Full = every course.
 * Faces are belts, not a stud grid — filling them is the lattice-cage bug.
 */
export function buildSteppedPyramid(opts: {
  height: number;
  half0: number;
  half1?: number;
  item: CatalogItem;
  join: JoinMethod;
  braceJoin: JoinMethod;
}): {
  nodes: StructureNode[];
  edges: StructureEdge[];
  door: { width: number; height: number; z0: number };
} {
  const dens = stockDensity(opts.item);
  const H = Math.max(opts.height, 12);
  const h0 = Math.max(opts.half0, 6);
  const h1 = Math.max(opts.half1 ?? dens.thick * 2.4, dens.thick * 1.8);
  const pitch = dens.fat
    ? Math.max(H / 5.5, dens.bay * 1.15)
    : Math.max(dens.stock * 0.95, dens.bay * 2.2, H / 10);
  const n = Math.max(dens.fat ? 4 : 5, Math.min(dens.fat ? 6 : 9, Math.round(H / pitch)));

  const halfAt = (t: number) => h0 + (h1 - h0) * t;
  const personish =
    (opts.item.category === "lumber" || opts.item.category === "sheet_goods") && H >= 72;
  const door = pyramidDoorDims(H, h0, personish);
  const doorW = door.width;
  const NORTH = 2;

  const stations: number[] = [];
  for (let i = 0; i <= n; i++) stations.push((i / n) * H);
  const near = stations.findIndex((y) => Math.abs(y - door.height) < pitch * 0.3);
  let doorY = door.height;
  if (near >= 0) {
    doorY = stations[near]!;
  } else {
    stations.push(door.height);
    stations.sort((a, b) => a - b);
    doorY = door.height;
  }
  const doorIdx = stations.findIndex((y) => Math.abs(y - doorY) < 0.05);

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

  const corners: string[][] = [];
  const jambL: string[] = [];
  const jambR: string[] = [];
  const last = stations.length - 1;

  for (let i = 0; i < stations.length; i++) {
    const y = stations[i]!;
    const t = y / H;
    const half = halfAt(t);
    const beltRole: StructureEdge["role"] =
      i === 0 ? "ring" : i === last || i === doorIdx || i % 3 === 0 ? "rail" : "brace";
    const nodeRole: StructureNode["role"] = i === 0 ? "base" : i === last ? "tip" : "leg";
    const row: string[] = [];
    for (let c = 0; c < 4; c++) row.push(addNode(squareCorner(half, y, c), nodeRole));
    corners.push(row);

    const belowDoor = y < doorY - 0.08;
    const atDoor = Math.abs(y - doorY) < 0.08;
    if (y <= doorY + 0.08) {
      const zN = -half;
      jambL.push(addNode({ x: -doorW / 2, y, z: zN }, y < 0.4 ? "base" : "leg"));
      jambR.push(addNode({ x: doorW / 2, y, z: zN }, y < 0.4 ? "base" : "leg"));
    }

    for (let f = 0; f < 4; f++) {
      const a = row[f]!;
      const b = row[(f + 1) % 4]!;
      const north = f === NORTH;
      if (north && (belowDoor || atDoor) && jambL.length && jambR.length) {
        const jl = jambL[jambL.length - 1]!;
        const jr = jambR[jambR.length - 1]!;
        addEdge(a, jl, beltRole, i === 0 || atDoor);
        if (atDoor) addEdge(jl, jr, "rail", true);
        addEdge(jr, b, beltRole, i === 0 || atDoor);
      } else {
        addEdge(a, b, beltRole, i === 0 || i === last);
      }
    }
  }

  for (let c = 0; c < 4; c++) {
    addEdge(corners[0]![c]!, corners[last]![c]!, "leg", true);
  }

  for (let i = 0; i < jambL.length - 1; i++) {
    addEdge(jambL[i]!, jambL[i + 1]!, "leg", true);
    addEdge(jambR[i]!, jambR[i + 1]!, "leg", true);
  }

  const cap = halfAt(1);
  if (cap > dens.thick * 3) {
    addEdge(corners[last]![0]!, corners[last]![2]!, "rail", false, opts.braceJoin);
  }

  return {
    nodes,
    edges,
    door: { width: doorW, height: doorY, z0: -h0 },
  };
}

