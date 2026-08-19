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
