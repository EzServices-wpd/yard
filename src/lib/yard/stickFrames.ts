/**
 * Stick-native 2D frames — each edge is one practical craft stick.
 */

import { createId } from "@/lib/utils";
import { toPrimitive, isWholeStock } from "./geometry";
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

  if (s === "frame" || s === "shape") {
    return [
      e(0.12, 0.12, 0.88, 0.12),
      e(0.88, 0.12, 0.88, 0.88),
      e(0.88, 0.88, 0.12, 0.88),
      e(0.12, 0.88, 0.12, 0.12),
      e(0.22, 0.22, 0.78, 0.22),
      e(0.78, 0.22, 0.78, 0.78),
      e(0.78, 0.78, 0.22, 0.78),
      e(0.22, 0.78, 0.22, 0.22),
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
  const toIn = (p: Pt): Pt => ({ x: margin + p.x * drawW, y: margin + p.y * drawH });
  const instances: YardInstance[] = [];
  const wholePreferred = isWholeStock(item);

  for (const edge of edges) {
    const a = toIn(edge.a);
    const b = toIn(edge.b);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < Math.max(0.35, faceW * 1.2)) continue;
    const n = Math.max(1, Math.ceil(len / (stockLen * 0.98)));
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const x1 = a.x + (b.x - a.x) * t0;
      const y1 = a.y + (b.y - a.y) * t0;
      const x2 = a.x + (b.x - a.x) * t1;
      const y2 = a.y + (b.y - a.y) * t1;
      const segLen = Math.hypot(x2 - x1, y2 - y1);
      if (segLen < 0.3) continue;
      const from: Vec3 = { x: x1 - paperW / 2, y: y1, z: 0 };
      const to: Vec3 = { x: x2 - paperW / 2, y: y2, z: 0 };
      const mid: Vec3 = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: 0 };
      const ang = Math.atan2(to.y - from.y, to.x - from.x);
      const nearWhole = wholePreferred && segLen >= stockLen * 0.85;
      instances.push({
        id: createId("f"),
        catalogId: item.id,
        position: mid,
        rotation: { x: 0, y: 0, z: ang },
        cutLength: nearWhole ? undefined : Math.min(segLen, stockLen),
        role: "rail",
        join: item.preferredJoins?.[0] || "glue",
        from,
        to,
      });
    }
  }
  return instances;
}
