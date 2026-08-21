/**
 * Eiffel — four piers on the published curve, then one shaft.
 * Not stacked floors: hoops only at the base, platforms, and a few belts.
 * Face lacing is a continuous Warren field so stories read as one tower.
 */

import type { CatalogItem, JoinMethod } from "../types";
import {
  StructureGraph,
  StructureNode,
  StructureEdge,
  createId,
  Vec3,
} from "../structureGraph";
import { EIFFEL_REAL, eiffelHalfAt, eiffelPlatformTs } from "../ghost";
import { lerp, stockDensity } from "../connect";
import { buildSquareLoft, hoopSchedule } from "../lattice";

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
  grain?: number;
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

export function buildLatticeTowerGraph(opts: LatticeTowerOptions): StructureGraph {
  const H = Math.max(6, opts.targetHeightIn);
  const eiffel = opts.eiffel !== false;
  const dens = stockDensity(opts.item, opts.grain ?? 1);
  const stock = dens.stock;
  const thick = dens.thick;
  const fat = dens.fat;

  const platforms = eiffel ? eiffelPlatformTs() : [0, 0.33, 0.66, 1];
  const t1 = platforms[1] ?? 0.18;
  const t2 = platforms[2] ?? 0.36;
  const nLevels = opts.levels;
  const ts = nLevels
    ? uniqueTs(Array.from({ length: nLevels + 1 }, (_, i) => i / nLevels))
    : storyTs(H, dens.bay, platforms);

  const joinPrimary: JoinMethod =
    (opts.item.preferredJoins && opts.item.preferredJoins[0]) || "glue";
  const joinBrace: JoinMethod =
    joinPrimary === "solvent" ? "solvent" : joinPrimary === "screw" ? "screw" : "glue";

  const loft = buildSquareLoft({
    height: H,
    halfAt: (t) => (eiffel ? eiffelHalfAt(t, H) : eiffelHalfAt(t, H)),
    ts,
    item: opts.item,
    hoopAt: hoopSchedule(ts, eiffel ? [t1, t2, platforms[3] ?? 0.85] : [0.33, 0.66], fat ? 2 : 3),
    laceFace: (t0, t1b) => {
      if (!eiffel) return true;
      // Below the first platform the four piers stand apart — only the arch + deck tie them.
      return t0 >= t1 - 0.01 || t1b >= t1 - 0.01;
    },
    join: joinPrimary,
    braceJoin: joinBrace,
    pierChords: dens.chords,
    maxFaceDivs: 8,
    bothDiagonals: (t) => t >= t2 - 0.02,
  });

  const nodes: StructureNode[] = [...loft.nodes];
  const edges: StructureEdge[] = [...loft.edges];
  const mains = loft.mains;

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

  const nodeOf = (id: string) => nodes.find((n) => n.id === id)!;

  // Platform decks — diaphragm on the published floors only
  if (opts.platforms !== false) {
    for (let L = 0; L < ts.length; L++) {
      const onPlat = platforms.some((p) => Math.abs(p - ts[L]) < 0.012) && ts[L] > 0.02 && ts[L] < 0.98;
      if (!onPlat) continue;
      const row = mains[L];
      addEdge(createId(`plat-a-${L}`), row[0], row[2], "rail", true);
      addEdge(createId(`plat-b-${L}`), row[1], row[3], "rail", true);
      if (!fat) {
        addEdge(createId(`plat-x-${L}a`), row[0], row[1], "rail");
        addEdge(createId(`plat-x-${L}b`), row[1], row[2], "rail");
        addEdge(createId(`plat-x-${L}c`), row[2], row[3], "rail");
        addEdge(createId(`plat-x-${L}d`), row[3], row[0], "rail");
      }
    }
  }

  if (eiffel) {
    const archY = (EIFFEL_REAL.archM / EIFFEL_REAL.heightM) * H;
    const segs = fat ? 5 : Math.max(7, Math.min(14, Math.round((eiffelHalfAt(0, H) * 2) / dens.faceStep)));
    const platL = ts.findIndex((t) => Math.abs(t - t1) < 0.02);
    for (let f = 0; f < 4; f++) {
      const a = nodeOf(mains[0][f]).position;
      const b = nodeOf(mains[0][(f + 1) % 4]).position;
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
        addEdge(createId(`strut-${f}`), crown, mains[platL][f], "support", true);
        addEdge(
          createId(`strut2-${f}`),
          crown,
          mains[platL][(f + 1) % 4],
          "support",
          true,
        );
      }
    }
  }

  const last = mains[mains.length - 1];
  const tipId = addNode(createId("tip"), { x: 0, y: H + stock * 0.2, z: 0 }, "tip");
  if (!fat) {
    const lanternY = H - Math.min(stock * 1.1, H * 0.05);
    const lanternR = Math.max(thick * 3, eiffelHalfAt(0.97, H) * 0.85);
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
    `Scale: ${H.toFixed(0)}" overall. Profile from published stations (125·72·41·17·11·4 m faces on a 324 m tower).`,
    `Four piers to the first platform, then a single shaft. Not stacked floors — hoops only at decks and belts.`,
    `${ts.length - 1} stories · bay ≈ ${dens.bay.toFixed(1)}" (driven by ${opts.item.name} @ ${stock.toFixed(1)}" × ${thick.toFixed(2)}").`,
    `Primary join: ${joinPrimary}. Warren lacing is the face — a bare frame will rack.`,
    `Slenderness H/B ≈ ${slenderness.toFixed(1)}. Arches + first deck take the splay.`,
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
      "Piers and shaft first. Decks next. Lacing last. The frame will fail without it.",
    ],
    structureClass: eiffel ? "eiffel" : "lattice_tower",
  };
}
