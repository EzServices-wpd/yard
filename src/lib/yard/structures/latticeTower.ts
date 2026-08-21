/**
 * Eiffel — four piers on the published curve, then one shaft.
 * Character first: base arches dominate the lower third, pier→platform
 * break is explicit, shaft continues as one continuous lattice.
 * Not stacked floors: hoops only at the base, platforms, and a few belts.
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

/** Craft-scale visual boost so signature features read at tabletop sizes. */
function characterRise(publishedRatio: number, H: number): number {
  const base = publishedRatio * H;
  const target = Math.max(base, H * 0.18);
  return Math.min(target, H * 0.22);
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
  const tBelt = eiffel ? 0.55 : 0.5;
  const force = eiffel
    ? uniqueTs([...platforms, tBelt].filter((t) => t > 0.01 && t < 0.99))
    : platforms;
  const nLevels = opts.levels;
  const ts = nLevels
    ? uniqueTs(Array.from({ length: nLevels + 1 }, (_, i) => i / nLevels))
    : storyTs(H, dens.bay, force);

  const joinPrimary: JoinMethod =
    (opts.item.preferredJoins && opts.item.preferredJoins[0]) || "glue";
  const joinBrace: JoinMethod =
    joinPrimary === "solvent" ? "solvent" : joinPrimary === "screw" ? "screw" : "glue";

  const loft = buildSquareLoft({
    height: H,
    halfAt: (t) => eiffelHalfAt(t, H),
    ts,
    item: opts.item,
    hoopAt: hoopSchedule(
      ts,
      eiffel ? [t1, t2, tBelt, platforms[3] ?? 0.85] : [0.33, 0.66],
      fat ? 2 : eiffel ? 2 : 3,
    ),
    laceFace: (t0, t1b) => {
      if (!eiffel) return true;
      return t0 >= t1 - 0.01 || t1b >= t1 - 0.01;
    },
    join: joinPrimary,
    braceJoin: joinBrace,
    pierChords: eiffel ? Math.max(dens.chords ?? 0, fat ? 2 : 3) : dens.chords,
    maxFaceDivs: fat ? 6 : 10,
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

  if (opts.platforms !== false) {
    for (let L = 0; L < ts.length; L++) {
      const onPlat =
        platforms.some((p) => Math.abs(p - ts[L]) < 0.012) && ts[L] > 0.02 && ts[L] < 0.98;
      if (!onPlat) continue;
      const row = mains[L];
      addEdge(createId(`plat-a-${L}`), row[0], row[2], "rail", true);
      addEdge(createId(`plat-b-${L}`), row[1], row[3], "rail", true);
      addEdge(createId(`plat-x-${L}a`), row[0], row[1], "rail", true);
      addEdge(createId(`plat-x-${L}b`), row[1], row[2], "rail", true);
      addEdge(createId(`plat-x-${L}c`), row[2], row[3], "rail", true);
      addEdge(createId(`plat-x-${L}d`), row[3], row[0], "rail", true);
      if (!fat) {
        const major = Math.abs(ts[L] - t1) < 0.02 || Math.abs(ts[L] - t2) < 0.02;
        if (major) {
          for (let f = 0; f < 4; f++) {
            const a = nodeOf(row[f]).position;
            const b = nodeOf(row[(f + 1) % 4]).position;
            for (const u of [0.33, 0.67]) {
              const mid = lerp(a, b, u);
              const midId = addNode(createId(`plat-mid-${L}-${f}-${u}`), mid, "ring");
              addEdge(createId(`plat-mid-e-${L}-${f}-${u}`), row[f], midId, "rail", true);
              addEdge(createId(`plat-mid-e2-${L}-${f}-${u}`), midId, row[(f + 1) % 4], "rail", true);
            }
          }
        }
      }
    }
  }

  if (eiffel) {
    const platL = ts.findIndex((t) => Math.abs(t - t1) < 0.02);
    if (platL > 0) {
      const prev = mains[platL - 1] ?? mains[0];
      const row = mains[platL];
      for (let f = 0; f < 4; f++) {
        addEdge(createId(`trans-${f}`), prev[f], row[f], "leg", true);
        if (!fat) {
          addEdge(createId(`trans-x-${f}`), prev[f], row[(f + 1) % 4], "brace", false, joinBrace);
          addEdge(createId(`trans-x2-${f}`), prev[(f + 1) % 4], row[f], "brace", false, joinBrace);
        }
      }
    }
  }

  if (eiffel) {
    const publishedRatio = EIFFEL_REAL.archM / EIFFEL_REAL.heightM;
    const archY = characterRise(publishedRatio, H);
    const springY = Math.min(H * t1 * 0.12, archY * 0.22);
    const segs = fat
      ? 6
      : Math.max(14, Math.min(24, Math.round((eiffelHalfAt(0, H) * 2) / Math.max(dens.faceStep * 0.7, 0.35))));
    const platL = ts.findIndex((t) => Math.abs(t - t1) < 0.02);

    for (let f = 0; f < 4; f++) {
      const a = nodeOf(mains[0][f]).position;
      const b = nodeOf(mains[0][(f + 1) % 4]).position;
      const springA: Vec3 = { x: a.x, y: springY, z: a.z };
      const springB: Vec3 = { x: b.x, y: springY, z: b.z };
      const springAId = addNode(createId(`spring-${f}-a`), springA, "leg");
      const springBId = addNode(createId(`spring-${f}-b`), springB, "leg");
      addEdge(createId(`spring-up-${f}-a`), mains[0][f], springAId, "leg", true);
      addEdge(createId(`spring-up-${f}-b`), mains[0][(f + 1) % 4], springBId, "leg", true);

      const archIds: string[] = [springAId];
      for (let i = 1; i < segs; i++) {
        const u = i / segs;
        const p = lerp(springA, springB, u);
        p.y = springY + Math.sin(Math.PI * u) * archY;
        archIds.push(addNode(createId(`arch-${f}-${i}`), p, "brace"));
      }
      archIds.push(springBId);

      for (let i = 0; i < archIds.length - 1; i++) {
        addEdge(createId(`arch-e-${f}-${i}`), archIds[i], archIds[i + 1], "support", true);
      }

      if (platL > 0) {
        const crown = archIds[Math.floor(archIds.length / 2)];
        addEdge(createId(`strut-${f}`), crown, mains[platL][f], "support", true);
        addEdge(createId(`strut2-${f}`), crown, mains[platL][(f + 1) % 4], "support", true);
        if (!fat) {
          const fractions = [0.2, 0.35, 0.5, 0.65, 0.8];
          for (const frac of fractions) {
            const node = archIds[Math.floor(archIds.length * frac)];
            const target = frac <= 0.5 ? mains[platL][f] : mains[platL][(f + 1) % 4];
            addEdge(createId(`strut-w-${f}-${frac}`), node, target, "support", false, joinBrace);
          }
        }
      }

      if (!fat && segs >= 10) {
        const innerRise = archY * 0.55;
        const innerIds: string[] = [springAId];
        const innerSegs = Math.max(6, Math.floor(segs * 0.55));
        for (let i = 1; i < innerSegs; i++) {
          const u = i / innerSegs;
          const p = lerp(springA, springB, u);
          p.y = springY + Math.sin(Math.PI * u) * innerRise;
          const mid = lerp(springA, springB, 0.5);
          p.x = p.x + (mid.x - p.x) * 0.08;
          p.z = p.z + (mid.z - p.z) * 0.08;
          innerIds.push(addNode(createId(`arch2-${f}-${i}`), p, "brace"));
        }
        innerIds.push(springBId);
        for (let i = 0; i < innerIds.length - 1; i++) {
          addEdge(createId(`arch2-e-${f}-${i}`), innerIds[i], innerIds[i + 1], "brace", false, joinBrace);
        }
      }
    }

    const pierLevels = [0.28, 0.48, 0.68].map((f) => t1 * f);
    for (const midPierT of pierLevels) {
      const midPierL = ts.reduce(
        (best, t, i) => (Math.abs(t - midPierT) < Math.abs(ts[best] - midPierT) ? i : best),
        0,
      );
      if (midPierL <= 0 || midPierL >= (platL > 0 ? platL : ts.length)) continue;
      const row = mains[midPierL];
      for (let f = 0; f < 4; f++) {
        const a = nodeOf(row[f]).position;
        const b = nodeOf(row[(f + 1) % 4]).position;
        for (const [u, tag] of [[0.18, "a"], [0.82, "b"]] as const) {
          const p = lerp(a, b, u);
          const id = addNode(createId(`pier-h-${f}-${tag}-${midPierL}`), p, "ring");
          const corner = u < 0.5 ? row[f] : row[(f + 1) % 4];
          addEdge(createId(`pier-h-e-${f}-${tag}-${midPierL}`), corner, id, "rail", false, joinBrace);
        }
      }
    }

    if (!fat && platL > 1) {
      const inset = Math.max(thick * 2.4, dens.faceStep * 0.35);
      for (let f = 0; f < 4; f++) {
        const base = nodeOf(mains[0][f]).position;
        const top = nodeOf(mains[platL][f]).position;
        const a = (f / 4) * Math.PI * 2 + Math.PI / 4;
        const inward = { x: -Math.cos(a) * inset, z: -Math.sin(a) * inset };
        const botId = addNode(
          createId(`pier-v-${f}-bot`),
          { x: base.x + inward.x, y: base.y, z: base.z + inward.z },
          "base",
        );
        const topId = addNode(
          createId(`pier-v-${f}-top`),
          { x: top.x + inward.x * 0.55, y: top.y, z: top.z + inward.z * 0.55 },
          "leg",
        );
        addEdge(createId(`pier-v-e-${f}`), botId, topId, "leg", true);
        addEdge(createId(`pier-v-base-${f}`), mains[0][f], botId, "brace", false, joinBrace);
        addEdge(createId(`pier-v-plat-${f}`), mains[platL][f], topId, "brace", false, joinBrace);
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
    `Four piers to the first platform, then a single shaft. Base arches are the signature — they dominate the lower third.`,
    `${ts.length - 1} stories · bay ≈ ${dens.bay.toFixed(1)}" (driven by ${opts.item.name} @ ${stock.toFixed(1)}" × ${thick.toFixed(2)}").`,
    `Primary join: ${joinPrimary}. Warren lacing is the face above the first deck — a bare frame will rack.`,
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
      "Piers and arches first. First deck next. Shaft lacing last. The frame will fail without it.",
    ],
    structureClass: eiffel ? "eiffel" : "lattice_tower",
  };
}
