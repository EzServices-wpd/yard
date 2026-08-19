/**
 * Continuous shell — meridians + belts, not stacked hoops.
 * Used for Taj, capitol, igloo, any dome-like prompt.
 */

import type { CatalogItem, JoinMethod } from "./types";
import { StructureEdge, StructureNode, Vec3, createId } from "./structureGraph";
import { stockDensity } from "./connect";

export type ShellProfile = "hemisphere" | "onion" | "drum";

export type ShellOptions = {
  y0: number;
  y1: number;
  r: number;
  cx?: number;
  cz?: number;
  profile?: ShellProfile;
  item: CatalogItem;
  join: JoinMethod;
  braceJoin: JoinMethod;
};

function radiusAt(profile: ShellProfile, t: number, r: number): number {
  const u = Math.min(1, Math.max(0, t));
  if (profile === "drum") return r;
  if (profile === "onion") {
    if (u < 0.14) return r;
    const s = (u - 0.14) / 0.86;
    const bulge = Math.sin(Math.min(1, s * 1.15) * Math.PI) * 0.2;
    return Math.max(r * 0.06, r * (1 - s * s) * (1 + bulge));
  }
  return r * Math.cos(u * Math.PI * 0.5);
}

function heightAt(profile: ShellProfile, t: number, y0: number, span: number, r: number): number {
  const u = Math.min(1, Math.max(0, t));
  if (profile === "hemisphere") return y0 + Math.sin(u * Math.PI * 0.5) * Math.min(span, r);
  return y0 + u * span;
}

export function buildShell(opts: ShellOptions): { nodes: StructureNode[]; edges: StructureEdge[] } {
  const dens = stockDensity(opts.item);
  const profile = opts.profile ?? "hemisphere";
  const span = Math.max(opts.y1 - opts.y0, 1);
  const cx = opts.cx ?? 0;
  const cz = opts.cz ?? 0;
  const mer = dens.fat ? 6 : Math.max(8, Math.min(20, Math.round((2 * Math.PI * opts.r) / dens.faceStep)));
  const stories = dens.fat ? 4 : Math.max(5, Math.round(span / dens.bay));
  const beltEvery = dens.fat ? 2 : 3;

  const nodes: StructureNode[] = [];
  const edges: StructureEdge[] = [];
  const addNode = (p: Vec3, role: StructureNode["role"]) => {
    const id = createId("n");
    nodes.push({ id, position: p, role });
    return id;
  };
  const addEdge = (from: string, to: string, role: StructureEdge["role"], critical = false) => {
    if (from === to) return;
    edges.push({
      id: createId("e"),
      from,
      to,
      join: role === "brace" ? opts.braceJoin : opts.join,
      role,
      critical,
    });
  };

  const rows: string[][] = [];
  for (let L = 0; L <= stories; L++) {
    const t = L / stories;
    const y = heightAt(profile, t, opts.y0, span, opts.r);
    const rad = radiusAt(profile, t, opts.r);
    const n = Math.max(3, Math.round(mer * Math.max(rad / opts.r, 0.22)));
    const row: string[] = [];
    if (rad < dens.thick * 1.4) {
      row.push(addNode({ x: cx, y, z: cz }, "tip"));
    } else {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        row.push(
          addNode(
            { x: cx + Math.cos(a) * rad, y, z: cz + Math.sin(a) * rad },
            L === 0 ? "base" : "ring",
          ),
        );
      }
    }
    rows.push(row);
    const hoop = L === 0 || L === stories || L % beltEvery === 0 || rad < dens.thick * 2;
    if (hoop && row.length > 2) {
      for (let k = 0; k < row.length; k++) addEdge(row[k], row[(k + 1) % row.length], "ring", L === 0);
    }
  }

  for (let L = 0; L < rows.length - 1; L++) {
    const a = rows[L];
    const b = rows[L + 1];
    for (let k = 0; k < a.length; k++) {
      const j = Math.floor((k * b.length) / a.length) % b.length;
      addEdge(a[k], b[j], "leg", true);
      const j2 = Math.floor((((k + 1) % a.length) * b.length) / a.length) % b.length;
      if (L % 2 === 0) addEdge(a[k], b[j2], "brace");
      else addEdge(a[(k + 1) % a.length], b[j], "brace");
    }
  }

  return { nodes, edges };
}
