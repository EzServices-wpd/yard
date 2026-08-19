import type { CatalogItem, JoinMethod } from "../types";
import { StructureGraph, StructureNode, StructureEdge, createId, Vec3 } from "../structureGraph";
import { toPrimitive } from "../geometry";
import { EIFFEL_REAL, eiffelCorner, eiffelHalfAt, eiffelPlatformTs } from "../ghost";

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

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
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

function legChords(t: number, corner: number, H: number, spread: number, count: number): Vec3[] {
  const axis = eiffelCorner(t, H, corner);
  if (count <= 1) return [axis];
  const a = (corner / 4) * Math.PI * 2 + Math.PI / 4;
  const inward = { x: -Math.cos(a), z: -Math.sin(a) };
  const tangent = { x: -Math.sin(a), z: Math.cos(a) };
  const pts: Vec3[] = [];
  for (const ti of [-1, 1] as const) {
    for (const ri of [0.12, 1] as const) {
      pts.push({
        x: axis.x + tangent.x * spread * ti + inward.x * spread * ri,
        y: axis.y,
        z: axis.z + tangent.z * spread * ti + inward.z * spread * ri,
      });
    }
  }
  return pts;
}

export function buildLatticeTowerGraph(opts: LatticeTowerOptions): StructureGraph {
  const H = Math.max(6, opts.targetHeightIn);
  const eiffel = opts.eiffel !== false;
  const prim = toPrimitive(opts.item);
  const stock = Math.max(1, prim.length);
  const thick = Math.max(prim.width, (prim.radius ?? 0) * 2, 0.2);
  const fat = thick >= 1.35;
  const chordsPerLeg = fat ? 1 : 4;
  const spread = Math.max(thick * 2.1, fat ? thick : 0.55);
  const bay = Math.max(stock * 0.82, 1.15);
  const platforms = eiffel ? eiffelPlatformTs() : [0, 0.33, 0.66, 1];
  const ts = opts.levels
    ? uniqueTs(Array.from({ length: opts.levels + 1 }, (_, i) => i / opts.levels))
    : storyTs(H, bay, platforms);
  const joinPrimary: JoinMethod = (opts.item.preferredJoins && opts.item.preferredJoins[0]) || "glue";
  const joinBrace: JoinMethod = joinPrimary === "solvent" ? "solvent" : joinPrimary === "screw" ? "screw" : "glue";
  const nodes: StructureNode[] = [];
  const edges: StructureEdge[] = [];
  const addNode = (id: string, position: Vec3, role: StructureNode["role"]) => {
    nodes.push({ id, position, role });
    return id;
  };
  const addEdge = (id: string, from: string, to: string, role: StructureEdge["role"], critical = false, join: JoinMethod = joinPrimary) => {
    if (from === to) return;
    edges.push({ id, from, to, join, role, critical });
  };
  const chords: string[][][] = [];
  const mids: string[][][] = [];
  for (let L = 0; L < ts.length; L++) {
    const t = ts[L];
    const row: string[][] = [];
    const faceRow: string[][] = [];
    const faceW = eiffelHalfAt(t, H) * 2;
    const midCount = fat ? (faceW > stock * 1.6 ? 1 : 0) : Math.max(0, Math.min(6, Math.floor(faceW / (stock * 0.95)) - 1));
    for (let c = 0; c < 4; c++) {
      const pts = legChords(t, c, H, spread, chordsPerLeg);
      row.push(pts.map((p, k) => addNode(createId(`n${L}c${c}k${k}`), p, L === 0 ? "base" : L === ts.length - 1 ? "tip" : "leg")));
    }
    for (let f = 0; f < 4; f++) {
      const a = eiffelCorner(t, H, f);
      const b = eiffelCorner(t, H, (f + 1) % 4);
      const ids: string[] = [];
      for (let k = 1; k <= midCount; k++) {
        ids.push(addNode(createId(`f${L}f${f}m${k}`), lerp(a, b, k / (midCount + 1)), "ring"));
      }
      faceRow.push(ids);
    }
    chords.push(row);
    mids.push(faceRow);
    for (let f = 0; f < 4; f++) {
      const left = row[f][0];
      const right = row[(f + 1) % 4][chordsPerLeg === 1 ? 0 : 1] ?? row[(f + 1) % 4][0];
      const chain = [left, ...faceRow[f], right];
      for (let i = 0; i < chain.length - 1; i++) {
        addEdge(createId(`ring-${L}-${f}-${i}`), chain[i], chain[i + 1], "ring", L === 0 || platforms.includes(t));
      }
    }
    const isPlatform = platforms.some((p) => Math.abs(p - t) < 0.01) && t > 0 && t < 0.99;
    if (isPlatform && opts.platforms !== false) {
      addEdge(createId(`plat-a-${L}`), row[0][0], row[2][0], "rail", true);
      addEdge(createId(`plat-b-${L}`), row[1][0], row[3][0], "rail", true);
    }
  }
  for (let L = 0; L < ts.length - 1; L++) {
    for (let c = 0; c < 4; c++) {
      const here = chords[L][c];
      const above = chords[L + 1][c];
      const n = Math.min(here.length, above.length);
      for (let k = 0; k < n; k++) addEdge(createId(`leg-${L}-${c}-${k}`), here[k], above[k], "leg", true);
      if (n >= 4) {
        addEdge(createId(`lace-${L}-${c}-a`), here[0], above[2], "brace", false, joinBrace);
        addEdge(createId(`lace-${L}-${c}-b`), here[1], above[3], "brace", false, joinBrace);
        addEdge(createId(`lace-${L}-${c}-c`), here[2], above[1], "brace", false, joinBrace);
        addEdge(createId(`lace-${L}-${c}-d`), here[3], above[0], "brace", false, joinBrace);
      } else if (n === 1) {
        addEdge(createId(`colbrace-${L}-${c}`), here[0], chords[L + 1][(c + 1) % 4][0], "brace", false, joinBrace);
      }
    }
    for (let f = 0; f < 4; f++) {
      const lo = mids[L][f];
      const hi = mids[L + 1][f];
      const n = Math.min(lo.length, hi.length);
      for (let k = 0; k < n; k++) {
        addEdge(createId(`web-${L}-${f}-${k}`), lo[k], hi[k], "brace", false, joinBrace);
        if (k + 1 < hi.length) addEdge(createId(`x-${L}-${f}-${k}a`), lo[k], hi[k + 1], "brace", false, joinBrace);
        if (k + 1 < lo.length) addEdge(createId(`x-${L}-${f}-${k}b`), lo[k + 1], hi[k], "brace", false, joinBrace);
      }
      if (lo.length && chords[L][f][0]) addEdge(createId(`webleg-${L}-${f}-l`), chords[L][f][0], lo[0], "brace", false, joinBrace);
      if (lo.length && chords[L][(f + 1) % 4][0]) addEdge(createId(`webleg-${L}-${f}-r`), lo[lo.length - 1], chords[L][(f + 1) % 4][0], "brace", false, joinBrace);
    }
  }
  if (eiffel) {
    const archY = (EIFFEL_REAL.archM / EIFFEL_REAL.heightM) * H;
    const segs = fat ? 5 : 9;
    const platT = EIFFEL_REAL.platformsM[0] / EIFFEL_REAL.heightM;
    const platL = ts.findIndex((t) => Math.abs(t - platT) < 0.02);
    for (let f = 0; f < 4; f++) {
      const a = eiffelCorner(0, H, f);
      const b = eiffelCorner(0, H, (f + 1) % 4);
      const archIds: string[] = [];
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const p = lerp(a, b, u);
        p.y = Math.sin(Math.PI * u) * archY;
        archIds.push(addNode(createId(`arch-${f}-${i}`), p, i === 0 || i === segs ? "base" : "brace"));
      }
      for (let i = 0; i < archIds.length - 1; i++) {
        addEdge(createId(`arch-e-${f}-${i}`), archIds[i], archIds[i + 1], "support", i === 0 || i === archIds.length - 2);
      }
      if (platL > 0 && mids[platL]?.[f]?.length) {
        const crown = archIds[Math.floor(archIds.length / 2)];
        const mid = mids[platL][f][Math.floor(mids[platL][f].length / 2)] ?? chords[platL][f][0];
        addEdge(createId(`strut-${f}`), crown, mid, "support", true, joinPrimary);
      } else if (platL > 0) {
        addEdge(createId(`strut-${f}`), archIds[Math.floor(archIds.length / 2)], chords[platL][f][0], "support", true);
      }
    }
  }
  const tipId = addNode(createId("tip"), { x: 0, y: H + stock * 0.25, z: 0 }, "tip");
  const last = chords[chords.length - 1];
  for (let c = 0; c < 4; c++) addEdge(createId(`finial-${c}`), last[c][0], tipId, "leg", true);
  const baseW = eiffelHalfAt(0, H) * 2;
  const slenderness = H / Math.max(baseW, 1);
  if (slenderness > 3.2 && !fat) {
    const mast0 = addNode(createId("mast0"), { x: 0, y: 0, z: 0 }, "base");
    const platT = EIFFEL_REAL.platformsM[0] / EIFFEL_REAL.heightM;
    const platL = Math.max(1, ts.findIndex((t) => t >= platT - 0.01));
    const mast1 = addNode(createId("mast1"), { x: 0, y: ts[platL] * H, z: 0 }, "platform");
    addEdge(createId("mast"), mast0, mast1, "support", true);
  }
  const name = opts.name ?? (eiffel ? `Eiffel frame · ${H.toFixed(0)}" high` : `Lattice tower · ${H.toFixed(0)}" high`);
  return {
    id: createId("graph"),
    name,
    envelope: { width: baseW, height: H + stock * 0.4, depth: baseW },
    materialId: opts.materialId,
    nodes,
    edges,
    assumptions: [
      `Scale: ${H.toFixed(0)}" overall. Stock mapped onto the published Eiffel wire (324 m / 125 m base / platforms 57·115·276 m).`,
      `Legs: ${chordsPerLeg} chord${chordsPerLeg > 1 ? "s" : ""} per corner (${fat ? "column stock" : "truss"}).`,
      `${ts.length - 1} stories · bay ≈ ${bay.toFixed(1)}" (driven by ${opts.item.name} @ ${stock.toFixed(1)}").`,
      `Primary join: ${joinPrimary}. Braces are not optional — a bare frame will rack.`,
      slenderness > 3.2
        ? `Slenderness H/B ≈ ${slenderness.toFixed(1)}. Internal support held until the first platform is braced.`
        : `Slenderness H/B ≈ ${slenderness.toFixed(1)} — arches take the first-platform thrust.`,
    ],
    notes: [name, `${nodes.length} nodes · ${edges.length} members before stock cuts`, "Frame first. Bracing next. The frame will fail without it."],
    structureClass: eiffel ? "eiffel" : "lattice_tower",
  };
}
