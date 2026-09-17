import { jsPDF } from "jspdf";
import type { NestSheet } from "./nesting";
import { sheetSizeLabel } from "./nesting";

const MUTED: [number, number, number] = [107, 99, 88];
const PAPER: [number, number, number] = [243, 238, 228];
const PLY_FILL: [number, number, number] = [232, 220, 196];
const PLY_EDGE: [number, number, number] = [160, 140, 110];
const INK: [number, number, number] = [26, 22, 18];
const GRAIN: [number, number, number] = [210, 196, 168];

export function nestPageTitle(sheet: NestSheet): string {
  return `Cut this ${sheetSizeLabel(sheet)} plywood`;
}

export function drawNestSheet(
  doc: jsPDF,
  sheet: NestSheet,
  left: number,
  top: number,
  width: number,
  opts?: { maxHeight?: number; sheetCount?: number },
): number {
  const sheetW = sheet.width || 96;
  const sheetH = sheet.height || 48;
  const maxH = opts?.maxHeight ?? 280;
  const scale = Math.min(width / sheetW, maxH / sheetH);
  const drawW = sheetW * scale;
  const drawH = sheetH * scale;
  doc.setDrawColor(...PLY_EDGE);
  doc.setFillColor(...PAPER);
  doc.setLineWidth(0.8);
  doc.rect(left, top, drawW, drawH, "FD");

  // Grain hint — long axis of the sheet.
  doc.setDrawColor(...GRAIN);
  doc.setLineWidth(0.35);
  const grainStep = 12 * scale;
  for (let gx = left + grainStep; gx < left + drawW - 1; gx += grainStep) {
    doc.line(gx, top + 2, gx, top + drawH - 2);
  }

  const placed = sheet.parts ?? [];
  for (const p of placed) {
    const x = left + p.x * scale;
    const y = top + p.y * scale;
    const w = p.width * scale;
    const h = p.height * scale;
    doc.setFillColor(...PLY_FILL);
    doc.setDrawColor(...PLY_EDGE);
    doc.setLineWidth(0.7);
    doc.rect(x, y, w, h, "FD");
    const label = p.label || "?";
    const canName = Math.min(w, h) > 36;
    const canDims = Math.min(w, h) > 22;
    doc.setFont("times", "bold");
    doc.setFontSize(canName ? 14 : 11);
    doc.setTextColor(...INK);
    const midY = y + h / 2 + (canName ? -6 : canDims ? -4 : 3);
    doc.text(label, x + w / 2, midY, { align: "center" });
    if (canDims) {
      doc.setFont("times", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(`${p.width.toFixed(1)} x ${p.height.toFixed(1)}`, x + w / 2, midY + 11, { align: "center" });
    }
    if (canName && p.name) {
      doc.setFont("times", "italic");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(p.name, x + w / 2, midY + 22, { align: "center" });
    }
  }
  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const usedPct = Math.round((sheet.utilization ?? 0) * 100);
  const used = usedPct > 0 ? ` · ${usedPct}% used` : "";
  const of = opts?.sheetCount && opts.sheetCount > 1 ? ` of ${opts.sheetCount}` : "";
  const size = sheetSizeLabel(sheet);
  const material = (sheet.material || '3/4" plywood').replace(/×/g, "x");
  doc.text(
    `Sheet ${sheet.index}${of} · ${material} · ${size} · ${sheetW}" x ${sheetH}"${used} · 1/8" kerf`,
    left + drawW / 2,
    top + drawH + 14,
    { align: "center" },
  );
  return top + drawH + 22;
}
