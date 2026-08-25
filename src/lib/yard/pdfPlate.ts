import { jsPDF } from "jspdf";
import { isoCaption, isoDims, isoFaces, isoMarks, isoViewBox } from "./iso";
import { stepInstanceIds } from "./assembly";
import type { AssemblyStep, YardProject } from "./types";

const MUTED: [number, number, number] = [107, 99, 88];
const RULE: [number, number, number] = [216, 208, 194];
const PLY_FILL: [number, number, number] = [232, 220, 196];
const PLY_EDGE: [number, number, number] = [160, 140, 110];

export function drawStepPlate(doc: jsPDF, project: YardProject, step: AssemblyStep, x: number, y: number, w: number, h: number) {
  doc.setFillColor(232, 226, 214);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.rect(x, y, w, h, "FD");
  const ids = stepInstanceIds(project, step);
  const box = isoViewBox(project, ids);
  const faces = isoFaces(project, ids);
  const s = Math.min((w - 16) / Math.max(box.maxX - box.minX, 1), (h - 28) / Math.max(box.maxY - box.minY, 1));
  const mapX = (v: number) => x + 8 + (v - box.minX) * s;
  const mapY = (v: number) => y + 8 + (v - box.minY) * s;
  for (const f of faces) {
    doc.setFillColor(...PLY_FILL);
    doc.setDrawColor(...PLY_EDGE);
    doc.setLineWidth(0.4);
    const pts = f.pts.map((p) => [mapX(p[0]), mapY(p[1])] as [number, number]);
    if (pts.length < 2) continue;
    doc.lines(
      pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]),
      pts[0][0],
      pts[0][1],
      [1, 1],
      "FD",
      true,
    );
  }
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(isoCaption(project, step) || isoDims(project), x + w / 2, y + h - 8, { align: "center" });
}
