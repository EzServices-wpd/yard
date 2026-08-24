import { jsPDF } from "jspdf";
import { usd } from "@/lib/utils";
import { isoCaption, isoDims, isoFaces, isoMarks, isoViewBox } from "./iso";
import { stepInstanceIds } from "./assembly";
import type { AssemblyStep, BuildPlan, YardProject } from "./types";

const INK: [number, number, number] = [26, 22, 18];
const MUTED: [number, number, number] = [107, 99, 88];
const RULE: [number, number, number] = [216, 208, 194];
const PAPER: [number, number, number] = [243, 238, 228];

export function slugPlan(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "yard-plan";
}

function drawStepPlate(
  doc: jsPDF,
  project: YardProject,
  step: AssemblyStep,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.setFillColor(232, 226, 214);
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.5);
  doc.rect(x, y, w, h, "FD");
  const ids = stepInstanceIds(project, step);
  const box = isoViewBox(project, ids);
  const marks = isoMarks(project, ids);
  const dims = isoDims(project, ids);
  const faces = isoFaces(project, ids);
  const caption = isoCaption(project, ids, step);
  if ((!marks.length && !faces.length) || box.w <= 0 || box.h <= 0) return;
  const pad = 10;
  const captionH = caption ? 14 : 0;
  const s = Math.min((w - pad * 2) / box.w, (h - pad * 2 - captionH) / box.h);
  const ox = x + (w - box.w * s) / 2;
  const oy = y + (h - captionH - box.h * s) / 2;
  const mapX = (v: number) => ox + (v - box.minX) * s;
  const mapY = (v: number) => oy + (v - box.minY) * s;
  for (const f of faces) {
    const pts = f.points.split(" ").map((p) => {
      const [px, py] = p.split(",").map(Number);
      return { x: mapX(px), y: mapY(py) };
    });
    if (pts.length < 3) continue;
    doc.setFillColor(f.hot ? 217 : 236, f.hot ? 203 : 230, f.hot ? 176 : 218);
    doc.triangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[2].x, pts[2].y, "F");
    if (pts[3]) {
      doc.triangle(pts[0].x, pts[0].y, pts[2].x, pts[2].y, pts[3].x, pts[3].y, "F");
    }
  }
  for (const m of marks) {
    doc.setDrawColor(...(m.hot || !ids.length ? INK : RULE));
    doc.setLineWidth(m.hot || !ids.length ? 1.15 : 0.4);
    doc.line(mapX(m.x1), mapY(m.y1), mapX(m.x2), mapY(m.y2));
  }
  doc.setDrawColor(...MUTED);
  doc.setTextColor(...INK);
  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.setLineWidth(0.4);
  for (const d of dims) {
    doc.line(mapX(d.x1), mapY(d.y1), mapX(d.x2), mapY(d.y2));
    doc.text(d.label, mapX(d.lx), mapY(d.ly) - 2, { align: "center" });
  }
  if (caption) {
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    doc.text(caption, x + w / 2, y + h - 5, { align: "center" });
  }
}

export function buildPlanPdf(project: YardProject, plan: BuildPlan): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 54;
  const right = pageW - 54;
  const width = right - left;
  let y = 56;

  function paintPage() {
    doc.setFillColor(...PAPER);
    doc.rect(0, 0, pageW, pageH, "F");
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Yard — guidance only. Not stamped engineering.", left, pageH - 28);
    doc.text(String(doc.getCurrentPageInfo().pageNumber), right, pageH - 28, { align: "right" });
  }

  function ensure(h: number) {
    if (y + h > pageH - 48) {
      doc.addPage();
      paintPage();
      y = 56;
    }
  }

  function wrap(text: string, size: number, max = width) {
    doc.setFontSize(size);
    return doc.splitTextToSize(text, max) as string[];
  }

  paintPage();

  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("YARD PLAN", left, y);
  y += 22;

  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  const title = wrap(project.name, 22);
  doc.text(title, left, y);
  y += title.length * 26 + 6;

  if (project.prompt) {
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    const p = wrap(project.prompt, 11);
    doc.text(p, left, y);
    y += p.length * 14 + 12;
  }

  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.6);
  doc.line(left, y, right, y);
  y += 22;

  heading("Check");
  body(plan.feasibility.summary);
  for (const issue of plan.feasibility.issues) {
    const line = `${issue.severity === "critical" ? "Stop — " : issue.severity === "warning" ? "Note — " : ""}${issue.message}`;
    body(line);
    if (issue.suggestion) muted(issue.suggestion);
  }

  if (plan.cutList.length) {
    heading(plan.partsKind === "whole" ? "Stick list" : "Cut list");
    muted(
      plan.partsKind === "whole"
        ? "Full pieces from the pack. Glue them. Do not cut."
        : "Same size is the same letter. Mark A on the first cut, then batch.",
    );
    for (const c of plan.cutList) {
      ensure(16);
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      doc.text(c.label ?? "", left, y);
      doc.setFont("times", "normal");
      doc.text(`${c.quantity}×`, left + 18, y);
      const nameLines = wrap(c.name, 11, width - 160);
      doc.text(nameLines, left + 42, y);
      doc.setTextColor(...MUTED);
      doc.text(`${c.lengthIn}" × ${c.widthIn}" × ${c.thicknessIn}"`, right, y, { align: "right" });
      y += Math.max(16, nameLines.length * 14);
    }
    y += 6;
  }

  if (plan.bom.length) {
    heading("Buy");
    muted(
      plan.partsKind === "whole"
        ? `${plan.totals.pieces} full pieces · glue · do not cut · ${usd(plan.totals.estCostUsd)} estimated`
        : `${plan.totals.pieces} pieces · ${usd(plan.totals.estCostUsd)} estimated · cheapest same-size listing first`,
    );
    for (const b of plan.bom) {
      ensure(16);
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      const label = `${b.quantity} ${b.unit} · ${b.name}${b.estimatedCost != null ? ` · ${usd(b.estimatedCost)}` : ""}`;
      const lines = wrap(label, 11);
      doc.text(lines, left, y);
      y += lines.length * 14;
      if (b.notes) muted(b.notes);
      const offers = b.offers ?? [];
      const best = offers.find((o) => o.best) ?? offers[0];
      if (best) {
        muted(`Shop · ${best.label}: ${best.title}`);
        muted(best.href);
        const second = offers.find((o) => o !== best);
        if (second) muted(`Also · ${second.label}: ${second.title}`);
      }
    }
    y += 6;
  }

  if (plan.instructions.length) {
    heading("Build");
    for (const s of plan.instructions) {
      const titleLines = wrap(`${String(s.step).padStart(2, "0")}  ${s.title}`, 13);
      const descLines = wrap(s.description, 11);
      const tipLines = s.tips ? wrap(s.tips, 10) : [];
      const hasPhoto = Boolean(s.imageDataUrl && s.imageDataUrl.startsWith("data:image"));
      // Full-width bench capture when present; otherwise demote the old 132-pt
      // triangle iso to a small secondary plate so prose leads.
      const photoH = hasPhoto ? 198 : 0;
      const isoH = hasPhoto ? 52 : 72;
      ensure(
        titleLines.length * 16 +
          photoH +
          isoH +
          descLines.length * 14 +
          tipLines.length * 13 +
          28,
      );
      doc.setFont("times", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...INK);
      doc.text(titleLines, left, y);
      y += titleLines.length * 16 + 4;

      if (hasPhoto && s.imageDataUrl) {
        try {
          const imgW = width;
          const imgH = photoH;
          doc.addImage(s.imageDataUrl, "JPEG", left, y, imgW, imgH);
          doc.setDrawColor(...RULE);
          doc.setLineWidth(0.4);
          doc.rect(left, y, imgW, imgH, "S");
          y += imgH + 6;
          doc.setFont("times", "italic");
          doc.setFontSize(8);
          doc.setTextColor(...MUTED);
          doc.text("Bench view — lit parts are this step", left + width / 2, y, { align: "center" });
          y += 12;
        } catch {
          /* fall through to iso only */
        }
      }

      // Secondary iso plate (demoted from the old hero scribble)
      drawStepPlate(doc, project, s, left, y, width, isoH);
      y += isoH + 8;

      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      doc.text(descLines, left, y);
      y += descLines.length * 14;
      if (tipLines.length) {
        doc.setFont("times", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        doc.text(tipLines, left, y);
        y += tipLines.length * 13;
      }
      y += 10;
    }
  }

  function heading(label: string) {
    ensure(36);
    y += 8;
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...INK);
    doc.text(label, left, y);
    y += 18;
  }

  function body(text: string) {
    const lines = wrap(text, 11);
    ensure(lines.length * 14 + 4);
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(lines, left, y);
    y += lines.length * 14 + 4;
  }

  function muted(text: string) {
    const lines = wrap(text, 10);
    ensure(lines.length * 13 + 2);
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(lines, left, y);
    y += lines.length * 13 + 2;
  }

  return doc;
}

export function planPdfBlob(project: YardProject, plan: BuildPlan): Blob {
  return buildPlanPdf(project, plan).output("blob");
}
