/**
 * Eiffel / lattice — stock mapped onto the published wire, not a hull.
 * Corner chords sit on the historic curve; face webs sit on the same
 * joints. Density comes from stock length and thickness. No piece cap.
 */

import type { CatalogItem, JoinMethod } from "../types";
import {
  StructureGraph,
  StructureNode,
  StructureEdge,
  createId,
  Vec3,
} from "../structureGraph";
import { EIFFEL_REAL, eiffelCorner, eiffelHalfAt, eiffelPlatformTs } from "../ghost";
import { dist, lerp, stockDensity } from "../connect";

export interface LatticeTowerOptions {
  targetHeightIn: number;
  baseRatio?: number;
  tipRatio?: number;
  levels?: number;
  platforms?: boolean;
  materialId: string;
  item: CatalogItem;
  name?: string;
  eiffel?: boolean;
}

function uniqueTs(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of sorted) {
    if (!out.length || Math.abs(t - out[out.length - 1]) > 0.004) out.push(t);
  }
  return out;
}

function storyTs(H: number, bay: number, force: number[]): number[] {
  const ts = [...force];
  for (let i = 0; i < force.length - 1; i++) {
    const span = (force[i + 1] - force[i]) * H;
    const n = Math.max(1, Math.round(span / bay));
    for (let k = 1; k < n; k++) ts.push(force[i] + ((force[i + 1] - force[i]) * k) / n);
  }
  return uniqueTs(ts);
}

function satellitePts(axis: Vec3, corner: number, spread: number, count: number): Vec3[] {
  if (count <= 1) return [];
  const a = (corner / 4) * Math.PI * 2 + Math.PI / 4;
  const inward = { x: -Math.cos(a), z: -Math.sin(a) };
  const tangent = { x: -Math.sin(a), z: Math.cos(a) };
  const extras = count - 1;
  const pts: Vec3[] = [];
  const offsets: [number, number][] =
    extras >= 3
      ? [
          [-1, 0.15],
          [1, 0.15],
          [0, 1],
        ]
      : extras === 2
        ? [
            [-1, 0.55],
            [1, 0.55],
          ]
        : [[0, 1]];
  for (const [ti, ri] of offsets.slice(0, extras)) {
    pts.push({
      x: axis.x + tangent.x * spread * ti + inward.x * spread * ri,
      y: axis.y,
      z: axis.z + tangent.z * spread * ti + inward.z * spread * ri,
    });
  }
  return pts;
}

export function buildLatticeTowerGraph(opts: LatticeTowerOptions): StructureGraph {
  const H = Math.max(6, opts.targetHeightIn);
  const eiffel = opts.eiffel !== false;
  const dens = stockDensity(opts.item);
  const stock = dens.stock;
  const thick = dens.thick;
  const fat = dens.fat;
  const chordsPerLeg = dens.chords;
  const spread = Math.max(thick * 2.2, fat ? thick : 0.45);
  const bay = dens.bay;
  const faceStep = dens.faceStep;

  const platforms = eiffel ? eiffelPlatformTs() : [0, 0.33, 0.66, 1];
  const ts = (() => {
    if (opts.levels) {
      const n = opts.levels;
      return uniqueTs(Array.from({ length: n + 1 }, (_, i) => i / n));
    }
    return storyTs(H, bay, platforms);
  })();

  const joinPrimary: JoinMethod =
    (opts.item.preferredJoins && opts.item.preferredJoins[0]) || "glue";
  const joinBrace: JoinMethod =
    joinPrimary === "solvent" ? "solvent" : joinPrimary === "screw" ? "screw" : "glue";

  const nodes: StructureNode[] = [];
  const edges: StructureEdge[] = [];

  const addNode = (id: string, position: Vec3, role: StructureNode["role"]) => {
    nodes.push({ id, position, role });
    return id;
  };
  const addEdge = (
    id: string,
    from: string,
    to: string,
    role: StructureEdge["role"],
    critical = false,
    join: JoinMethod = joinPrimary,
  ) => {
    if (from === to) return;
    edges.push({ id, from, to, join, role, critical });
  };

  // mains[level][corner] — on the published wire
  const mains: string[][] = [];
  // sats[level][corner][]
  const sats: string[][][] = [];
  // face mids[level][face][]
  const mids: string[][][] = [];

  for (let L = 0; L < ts.length; L++) {
    const t = ts[L];
    const mainRow: string[] = [];
    const satRow: string[][] = [];
    for (let c = 0; c < 4; c++) {
      const axis = eiffelCorner(t, H, c);
      const role: StructureNode["role"] = L === 0 ? "base" : L === ts.length - 1 ? "tip" : "leg";
      const mid = addNode(createId(`n${L}c${c}`), axis, role);
      mainRow.push(mid);
      const extras = satellitePts(axis, c, spread, chordsPerLeg).map((p, k) =>
        addNode(createId(`s${L}c${c}k${k}`), p, role),
      );
      satRow.push(extras);
      for (const s of extras) addEdge(createId(`lace0-${L}-${c}-${s}`), mid, s, "brace", false, joinBrace);
      for (let i = 0; i < extras.length - 1; i++) {
        addEdge(createId(`lace1-${L}-${c}-${i}`), extras[i], extras[i + 1], "brace", false, joinBrace);
      }
    }
    mains.push(mainRow);
    sats.push(satRow);

    const faceRow: string[][] = [];
    for (let f = 0; f < 4; f++) {
      const left = nodes.find((n) => n.id === mainRow[f])!;
      const right = nodes.find((n) => n.id === mainRow[(f + 1) % 4])!;
      const faceW = dist(left.position, right.position);
      const midCount = fat
        ? faceW > stock * 1.5
          ? 1
          : 0
        : Math.max(0, Math.min(12, Math.floor(faceW / faceStep) - 1));
      const ids: string[] = [];
      for (let k = 1; k <= midCount; k++) {
        ids.push(
          addNode(
            createId(`f${L}f${f}m${k}`),
            lerp(left.position, right.position, k / (midCount + 1)),
            "ring",
          ),
        );
      }
      faceRow.push(ids);
      const chain = [mainRow[f], ...ids, mainRow[(f + 1) % 4]];
      const onPlat = platforms.some((p) => Math.abs(p - t) < 0.01);
      for (let i = 0; i < chain.length - 1; i++) {
        addEdge(createId(`ring-${L}-${f}-${i}`), chain[i], chain[i + 1], "ring", L === 0 || onPlat);
      }
    }
    mids.push(faceRow);

    const isPlatform = platforms.some((p) => Math.abs(p - t) < 0.01) && t > 0 && t < 0.99;
    if (isPlatform && opts.platforms !== false) {
      addEdge(createId(`plat-a-${L}`), mainRow[0], mainRow[2], "rail", true);
      addEdge(createId(`plat-b-${L}`), mainRow[1], mainRow[3], "rail", true);
      if (!fat) {
        addEdge(createId(`plat-x-${L}a`), mainRow[0], mainRow[1], "rail");
        addEdge(createId(`plat-x-${L}b`), mainRow[1], mainRow[2], "rail");
        addEdge(createId(`plat-x-${L}c`), mainRow[2], mainRow[3], "rail");
        addEdge(createId(`plat-x-${L}d`), mainRow[3], mainRow[0], "rail");
      }
    }
  }

  for (let L = 0; L < ts.length - 1; L++) {
    for (let c = 0; c < 4; c++) {
      addEdge(createId(`leg-${L}-${c}`), mains[L][c], mains[L + 1][c], "leg", true);
      const here = sats[L][c];
      const above = sats[L + 1][c];
      const n = Math.min(here.length, above.length);
      for (let k = 0; k < n; k++) {
        addEdge(createId(`sat-${L}-${c}-${k}`), here[k], above[k], "leg", false);
        addEdge(createId(`satx-${L}-${c}-${k}`), here[k], mains[L + 1][c], "brace", false, joinBrace);
      }
    }

    for (let f = 0; f < 4; f++) {
      const lo = [mains[L][f], ...mids[L][f], mains[L][(f + 1) % 4]];
      const hi = [mains[L + 1][f], ...mids[L + 1][f], mains[L + 1][(f + 1) % 4]];
      const n = Math.min(lo.length, hi.length);
      for (let k = 0; k < n; k++) {
        if (k > 0 && k < n - 1) {
          addEdge(createId(`web-${L}-${f}-${k}`), lo[k], hi[k], "brace", false, joinBrace);
        }
        if (k + 1 < hi.length) {
          addEdge(createId(`x-${L}-${f}-${k}a`), lo[k], hi[k + 1], "brace", false, joinBrace);
        }
        if (k + 1 < lo.length) {
          addEdge(createId(`x-${L}-${f}-${k}b`), lo[k + 1], hi[k], "brace", false, joinBrace);
        }
      }
    }
  }

  if (eiffel) {
    const archY = (EIFFEL_REAL.archM / EIFFEL_REAL.heightM) * H;
    const segs = fat ? 5 : Math.max(7, Math.min(14, Math.round((eiffelHalfAt(0, H) * 2) / faceStep)));
    const platT = EIFFEL_REAL.platformsM[0] / EIFFEL_REAL.heightM;
    const platL = ts.findIndex((t) => Math.abs(t - platT) < 0.02);
    for (let f = 0; f < 4; f++) {
      const a = nodes.find((n) => n.id === mains[0][f])!.position;
      const b = nodes.find((n) => n.id === mains[0][(f + 1) % 4])!.position;
      const archIds: string[] = [mains[0][f]];
      for (let i = 1; i < segs; i++) {
        const u = i / segs;
        const p = lerp(a, b, u);
        p.y = Math.sin(Math.PI * u) * archY;
        archIds.push(addNode(createId(`arch-${f}-${i}`), p, "brace"));
      }
      archIds.push(mains[0][(f + 1) % 4]);
      for (let i = 0; i < archIds.length - 1; i++) {
        addEdge(
          createId(`arch-e-${f}-${i}`),
          archIds[i],
          archIds[i + 1],
          "support",
          i === 0 || i === archIds.length - 2,
        );
      }
      if (platL > 0) {
        const crown = archIds[Math.floor(archIds.length / 2)];
        const mid =
          mids[platL]?.[f]?.[Math.floor((mids[platL][f].length || 1) / 2)] ?? mains[platL][f];
        addEdge(createId(`strut-${f}`), crown, mid, "support", true, joinPrimary);
      }
    }
  }

  const last = mains[mains.length - 1];
  const tipId = addNode(createId("tip"), { x: 0, y: H + stock * 0.2, z: 0 }, "tip");
  if (!fat) {
    const lanternY = H - Math.min(stock * 1.1, H * 0.06);
    const lanternR = Math.max(thick * 4, eiffelHalfAt(0.97, H) * 0.9);
    const cage: string[] = [];
    for (let c = 0; c < 4; c++) {
      const a = (c / 4) * Math.PI * 2 + Math.PI / 4;
      cage.push(
        addNode(
          createId(`lantern-${c}`),
          { x: Math.cos(a) * lanternR, y: lanternY, z: Math.sin(a) * lanternR },
          "tip",
        ),
      );
    }
    for (let c = 0; c < 4; c++) {
      addEdge(createId(`lantern-r-${c}`), cage[c], cage[(c + 1) % 4], "ring");
      addEdge(createId(`lantern-up-${c}`), last[c], cage[c], "leg", true);
      addEdge(createId(`finial-${c}`), cage[c], tipId, "leg", true);
    }
  } else {
    for (let c = 0; c < 4; c++) addEdge(createId(`finial-${c}`), last[c], tipId, "leg", true);
  }

  const baseW = eiffelHalfAt(0, H) * 2;
  const slenderness = H / Math.max(baseW, 1);
  const name =
    opts.name ??
    (eiffel ? `Eiffel frame · ${H.toFixed(0)}" high` : `Lattice tower · ${H.toFixed(0)}" high`);

  const assumptions = [
    `Scale: ${H.toFixed(0)}" overall. Stock mapped onto the published Eiffel wire (324 m / 125 m base / platforms 57·115·276 m).`,
    `Legs: 1 published chord per corner${chordsPerLeg > 1 ? ` + ${chordsPerLeg - 1} satellite${chordsPerLeg > 2 ? "s" : ""} of ${opts.item.name}` : " (column stock)"}.`,
    `${ts.length - 1} stories · bay ≈ ${bay.toFixed(1)}" · face step ≈ ${faceStep.toFixed(1)}" (driven by ${opts.item.name} @ ${stock.toFixed(1)}" × ${thick.toFixed(2)}").`,
    `Primary join: ${joinPrimary}. Braces are not optional — a bare frame will rack.`,
    `Slenderness H/B ≈ ${slenderness.toFixed(1)}. Arches take the first-platform thrust.`,
  ];

  return {
    id: createId("graph"),
    name,
    envelope: { width: baseW, height: H + stock * 0.4, depth: baseW },
    materialId: opts.materialId,
    nodes,
    edges,
    assumptions,
    notes: [
      name,
      `${nodes.length} nodes · ${edges.length} members before stock cuts`,
      "Frame (legs, rings, platforms) first. Bracing next. The frame will fail without it.",
    ],
    structureClass: eiffel ? "eiffel" : "lattice_tower",
  };
}
