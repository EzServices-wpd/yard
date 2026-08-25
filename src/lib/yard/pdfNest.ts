import { jsPDF } from "jspdf";
import type { NestSheet } from "./nesting";

const MUTED: [number, number, number] = [107, 99, 88];
const PAPER: [number, number, number] = [243, 238, 228];
const PLY_FILL: [number, number, number] = [232, 220, 196];
const PLY_EDGE: [number, number, number] = [160, 140, 110];
const INK: [number, number, number] = [26, 22, 18];

export function drawNestSheet(doc: jsPDF, sheet: NestSheet, left: number, top: number, width: number) {
  const sheetW = sheet.width || 96;
  const sheetH = sheet.height || 48;
  const scale = Math.min(width / sheetW, 280 / sheetH);
  const drawW = sheetW * scale;
  const drawH = sheetH * scale;
  doc.setDrawColor(...PLY_EDGE);
  doc.setFillColor(...PAPER);
  doc.setLineWidth(0.8);
  doc.rect(left, top, drawW, drawH, "FD");
  const placed = sheet.parts ?? [];
  for (const p of placed) {
    const x = left + p.x * scale;
    const y = top + p.y * scale;
    const w = p.width * scale;
    const h = p.height * scale;
    doc.setFillColor(...PLY_FILL);
    doc.setDrawColor(...PLY_EDGE);
    doc.rect(x, y, w, h, "FD");
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    const label = p.label || "?";
    doc.text(label, x + w / 2, y + h / 2 - 4, { align: "center" });
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`${p.width.toFixed(1)}x${p.height.toFixed(1)}`, x + w / 2, y + h / 2 + 8, { align: "center" });
  }
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const usedPct = Math.round((sheet.utilization ?? 0) * 100);
  const used = usedPct > 0 ? ` · ${usedPct}% used` : "";
  doc.text(
    `Sheet ${sheet.index} · 3/4" Plywood 4x8 · 96" x 48"${used} · 1/8" kerf`,
    left + drawW / 2,
    top + drawH + 14,
    { align: "center" },
  );
}
