/**
 * Stick-native 2D frames — each edge is one full craft stick (no cutting).
 *
 * Design rule for paper craft:
 *   • Buy a pack of sticks
 *   • Lay whole sticks on the printed lines
 *   • Glue ends where they meet
 *   • Never cut to length
 */

import { createId } from "@/lib/utils";
import { toPrimitive } from "./geometry";
import type { CatalogItem, Vec3, YardInstance } from "./types";

type Pt = { x: number; y: number };
type StickEdge = { a: Pt; b: Pt };

function e(x1: number, y1: number, x2: number, y2: number): StickEdge {
  return { a: { x: x1, y: y1 }, b: { x: x2, y: y2 } };
}

/** Stick-native frames: ~8–20 whole sticks, one sitting. */
export function stickEdges(subject: string): StickEdge[] {
  const s = subject.toLowerCase();

  if (s === "house") {
    return [
      e(0.15, 0.12, 0.85, 0.12),
      e(0.15, 0.12, 0.15, 0.48),
      e(0.85, 0.12, 0.85, 0.48),
      e(0.15, 0.48, 0.5, 0.82),
      e(0.85, 0.48, 0.5, 0.82),
      e(0.15, 0.48, 0.85, 0.48),
      e(0.42, 0.12, 0.42, 0.34),
      e(0.58, 0.12, 0.58, 0.34),
      e(0.42, 0.34, 0.58, 0.34),
      e(0.22, 0.28, 0.34, 0.28),
      e(0.22, 0.28, 0.22, 0.4),
      e(0.34, 0.28, 0.34, 0.4),
      e(0.22, 0.4, 0.34, 0.4),
    ];
  }

  if (s === "car") {
    return [
      e(0.1, 0.28, 0.9, 0.28),
      e(0.1, 0.28, 0.1, 0.42),
      e(0.9, 0.28, 0.9, 0.38),
      e(0.1, 0.42, 0.32, 0.52),
      e(0.32, 0.52, 0.62, 0.52),
      e(0.62, 0.52, 0.78, 0.4),
      e(0.78, 0.4, 0.9, 0.38),
      e(0.1, 0.42, 0.9, 0.38),
      e(0.28, 0.28, 0.28, 0.18),
      e(0.22, 0.18, 0.34, 0.18),
      e(0.72, 0.28, 0.72, 0.18),
      e(0.66, 0.18, 0.78, 0.18),
      e(0.36, 0.42, 0.36, 0.52),
      e(0.58, 0.42, 0.58, 0.52),
    ];
  }

  if (s === "star") {
    const pts: Pt[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 0.4 : 0.16;
      pts.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r });
    }
    return pts.map((p, i) => ({ a: p, b: pts[(i + 1) % 10] }));
  }

  if (s === "frame" || s === "shape" || s === "picture frame") {
    return [
      // Outer rectangle
      e(0.12, 0.12, 0.88, 0.12),
      e(0.88, 0.12, 0.88, 0.88),
      e(0.88, 0.88, 0.12, 0.88),
      e(0.12, 0.88, 0.12, 0.12),
      // Inner mat opening
      e(0.22, 0.22, 0.78, 0.22),
      e(0.78, 0.22, 0.78, 0.78),
      e(0.78, 0.78, 0.22, 0.78),
      e(0.22, 0.78, 0.22, 0.22),
      // Same-stock backing bars behind the rabbet (retain flat media)
      e(0.28, 0.32, 0.72, 0.32),
      e(0.28, 0.68, 0.72, 0.68),
    ];
  }

  if (s === "boat") {
    return [
      e(0.12, 0.28, 0.88, 0.28),
      e(0.12, 0.28, 0.22, 0.12),
      e(0.88, 0.28, 0.78, 0.12),
      e(0.22, 0.12, 0.78, 0.12),
      e(0.5, 0.28, 0.5, 0.72),
      e(0.5, 0.72, 0.72, 0.42),
      e(0.5, 0.42, 0.72, 0.42),
    ];
  }

  if (s === "ladder") {
    const edges: StickEdge[] = [e(0.32, 0.1, 0.32, 0.9), e(0.68, 0.1, 0.68, 0.9)];
    for (let i = 0; i < 6; i++) {
      const y = 0.16 + i * 0.14;
      edges.push(e(0.32, y, 0.68, y));
    }
    return edges;
  }

  if (s === "arrow") {
    return [e(0.1, 0.5, 0.72, 0.5), e(0.72, 0.5, 0.55, 0.68), e(0.72, 0.5, 0.55, 0.32), e(0.1, 0.42, 0.1, 0.58)];
  }

  if (s === "tree") {
    return [
      e(0.45, 0.08, 0.45, 0.42), e(0.55, 0.08, 0.55, 0.42), e(0.45, 0.08, 0.55, 0.08),
      e(0.3, 0.42, 0.7, 0.42), e(0.3, 0.42, 0.5, 0.72), e(0.7, 0.42, 0.5, 0.72),
      e(0.22, 0.55, 0.78, 0.55), e(0.22, 0.55, 0.5, 0.88), e(0.78, 0.55, 0.5, 0.88),
    ];
  }

  if (s === "heart") {
    return [
      e(0.5, 0.12, 0.22, 0.42), e(0.5, 0.12, 0.78, 0.42),
      e(0.22, 0.42, 0.18, 0.62), e(0.78, 0.42, 0.82, 0.62),
      e(0.18, 0.62, 0.35, 0.78), e(0.82, 0.62, 0.65, 0.78),
      e(0.35, 0.78, 0.5, 0.88), e(0.65, 0.78, 0.5, 0.88),
    ];
  }

  if (s === "person") {
    return [
      e(0.42, 0.72, 0.58, 0.72), e(0.42, 0.72, 0.42, 0.88), e(0.58, 0.72, 0.58, 0.88), e(0.42, 0.88, 0.58, 0.88),
      e(0.5, 0.72, 0.5, 0.42), e(0.28, 0.62, 0.5, 0.55), e(0.72, 0.62, 0.5, 0.55),
      e(0.5, 0.42, 0.35, 0.12), e(0.5, 0.42, 0.65, 0.12),
    ];
  }

  if (s === "rocket") {
    return [
      e(0.42, 0.2, 0.42, 0.72), e(0.58, 0.2, 0.58, 0.72), e(0.42, 0.72, 0.5, 0.9), e(0.58, 0.72, 0.5, 0.9),
      e(0.42, 0.2, 0.58, 0.2), e(0.42, 0.45, 0.58, 0.45), e(0.28, 0.2, 0.42, 0.32), e(0.72, 0.2, 0.58, 0.32),
    ];
  }

  if (s === "dinosaur") {
    return [
      e(0.25, 0.35, 0.7, 0.35), e(0.25, 0.35, 0.25, 0.5), e(0.7, 0.35, 0.7, 0.48), e(0.25, 0.5, 0.7, 0.48),
      e(0.7, 0.42, 0.88, 0.58), e(0.88, 0.58, 0.92, 0.52), e(0.22, 0.4, 0.1, 0.28),
      e(0.32, 0.35, 0.3, 0.14), e(0.42, 0.35, 0.44, 0.14), e(0.55, 0.35, 0.54, 0.14), e(0.65, 0.35, 0.68, 0.14),
    ];
  }

  if (s === "castle") {
    return [
      e(0.12, 0.12, 0.88, 0.12), e(0.12, 0.12, 0.12, 0.55), e(0.88, 0.12, 0.88, 0.55), e(0.12, 0.55, 0.88, 0.55),
      e(0.12, 0.55, 0.12, 0.78), e(0.28, 0.55, 0.28, 0.78), e(0.12, 0.78, 0.28, 0.78),
      e(0.72, 0.55, 0.72, 0.78), e(0.88, 0.55, 0.88, 0.78), e(0.72, 0.78, 0.88, 0.78),
      e(0.4, 0.12, 0.4, 0.32), e(0.6, 0.12, 0.6, 0.32), e(0.4, 0.32, 0.6, 0.32),
    ];
  }

  if (s === "letter" || s === "monogram") {
    return [e(0.22, 0.12, 0.5, 0.88), e(0.78, 0.12, 0.5, 0.88), e(0.34, 0.42, 0.66, 0.42)];
  }

  if (s === "dog" || s === "cat") {
    return [
      e(0.25, 0.35, 0.7, 0.35), e(0.25, 0.35, 0.25, 0.5), e(0.7, 0.35, 0.7, 0.5), e(0.25, 0.5, 0.7, 0.5),
      e(0.7, 0.42, 0.88, 0.55), e(0.3, 0.35, 0.28, 0.14), e(0.42, 0.35, 0.42, 0.14),
      e(0.55, 0.35, 0.55, 0.14), e(0.65, 0.35, 0.68, 0.14),
    ];
  }

  return stickEdges("frame");
}

/**
 * One FULL stick per edge. Never cut for paper craft.
 *
 * Scale the silhouette so the longest geometric edge ≈ stock length.
 * Each stick is centered on its line and spans the full pack length along
 * that direction — ends meet (and slightly overlap) at joints for glue.
 */
export function segmentInstances(
  edges: StickEdge[],
  paperW: number,
  paperH: number,
  item: CatalogItem,
  margin = 0.55,
): YardInstance[] {
  const prim = toPrimitive(item);
  const stockLen = Math.max(prim.length || 4.5, 2);
  const faceW = Math.max(prim.width || 0.25, prim.height || 0.08);
  const drawW = paperW - margin * 2;
  const drawH = paperH - margin * 2;

  // Longest normalized edge → real inches if drawn full-paper
  let maxNorm = 0;
  for (const edge of edges) {
    const ln = Math.hypot(edge.b.x - edge.a.x, edge.b.y - edge.a.y);
    if (ln > maxNorm) maxNorm = ln;
  }
  const fullMaxIn = maxNorm * Math.max(drawW, drawH);
  // Fit longest edge into one stock stick (tiny allowance for visual presence)
  const fit = fullMaxIn > stockLen * 1.02 ? stockLen / fullMaxIn : 1;
  const scaleW = drawW * fit;
  const scaleH = drawH * fit;
  // Center the scaled drawing on the paper
  const ox = margin + (drawW - scaleW) / 2;
  const oy = margin + (drawH - scaleH) / 2;
  const toIn = (p: Pt): Pt => ({ x: ox + p.x * scaleW, y: oy + p.y * scaleH });

  const instances: YardInstance[] = [];
  // Drop only micro-edges that are decorative noise (under ~1.2× face width)
  const minGeom = Math.max(0.35, faceW * 1.2);

  for (const edge of edges) {
    const a = toIn(edge.a);
    const b = toIn(edge.b);
    const geomLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (geomLen < minGeom) continue;

    // Direction of the printed line
    const dx = (b.x - a.x) / geomLen;
    const dy = (b.y - a.y) / geomLen;

    // Geometric midpoint on the paper
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;

    // FULL stick centered on the line — never cut
    const half = stockLen / 2;
    const from: Vec3 = {
      x: mx - dx * half - paperW / 2,
      y: my - dy * half,
      z: 0,
    };
    const to: Vec3 = {
      x: mx + dx * half - paperW / 2,
      y: my + dy * half,
      z: 0,
    };
    const mid: Vec3 = {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
      z: 0,
    };
    const ang = Math.atan2(to.y - from.y, to.x - from.x);

    instances.push({
      id: createId("f"),
      catalogId: item.id,
      position: mid,
      rotation: { x: 0, y: 0, z: ang },
      // Whole pack stick — no cutLength means full retail length
      cutLength: undefined,
      role: "rail",
      join: item.preferredJoins?.[0] || "glue",
      from,
      to,
    });
  }
  return instances;
}
