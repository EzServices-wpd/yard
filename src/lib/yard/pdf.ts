import { jsPDF } from "jspdf";
import { usd } from "@/lib/utils";
import { nestCutList, type NestSheet } from "./nesting";
import type { AssemblyStep, BuildPlan, YardProject } from "./types";
import { ACCENT, PHOTO_RULE } from "./pdfTheme";
import { SHOP_GLOSSARY } from "./pdfGlossary";
import { drawStepPlate } from "./pdfPlate";
import { drawNestSheet } from "./pdfNest";

const INK: [number, number, number] = [26, 22, 18];
const MUTED: [number, number, number] = [107, 99, 88];
const RULE: [number, number, number] = [216, 208, 194];
const PAPER: [number, number, number] = [243, 238, 228];
const PLY_FILL: [number, number, number] = [232, 220, 196];
const PLY_EDGE: [number, number, number] = [160, 140, 110];

export function slugPlan(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "yard-plan";
}

function dataUrlFormat(dataUrl: string): "JPEG" | "PNG" | "WEBP" | null {
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "JPEG";
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  if (dataUrl.startsWith("data:image")) return "JPEG";
  return null;
}

export function buildPlanPdf(project: YardProject, plan: BuildPlan): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 48;
  const right = pageW - 48;
  const width = right - left;
  let y = 52;

  const ensure = (need: number) => {
    if (y + need > pageH - 48) {
      doc.addPage();
      y = 52;
    }
  };

  const footer = (n: number) => {
    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Yard — guidance only. Not stamped engineering.", left, pageH - 28);
    doc.text(String(n), right, pageH - 28, { align: "right" });
  };

  const heading = (t: string) => {
    ensure(36);
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(t.toUpperCase(), left, y);
    const tw = doc.getTextWidth(t.toUpperCase());
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(1.2);
    doc.line(left, y + 3, left + Math.max(tw, 36), y + 3);
    y += 20;
  };

  const body = (t: string, size = 11) => {
    const lines = doc.splitTextToSize(t, width);
    ensure(lines.length * (size + 3) + 6);
    doc.setFont("times", "normal");
    doc.setFontSize(size);
    doc.setTextColor(...INK);
    doc.text(lines, left, y);
    y += lines.length * (size + 3) + 6;
  };

  const muted = (t: string) => {
    const lines = doc.splitTextToSize(t, width);
    ensure(lines.length * 13 + 4);
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(lines, left, y);
    y += lines.length * 13 + 4;
  };

  const wrap = (t: string, size = 11) => doc.splitTextToSize(t, width);

  // Cover
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...ACCENT);
  doc.text("YARD PLAN", left, y);
  const eyeW = doc.getTextWidth("YARD PLAN");
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1);
  doc.line(left, y + 3, left + eyeW, y + 3);
  y += 22;
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  const titleLines = wrap(project.name, 22);
  doc.text(titleLines, left, y);
  y += titleLines.length * 26 + 6;
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...MUTED);
  const dim = `${project.overall.width}" x ${project.overall.height}" x ${project.overall.depth}"`;
  doc.text(dim, left, y);
  y += 16;
  if (plan.effort || plan.totals.estCostUsd) {
    doc.setFontSize(10);
    const bits = [
      plan.effort ? `About ${plan.effort}` : null,
      plan.totals.estCostUsd ? `~${usd(plan.totals.estCostUsd)} estimated` : null,
      plan.totals.pieces ? `${plan.totals.pieces} pieces` : null,
    ].filter(Boolean);
    doc.text(bits.join(" · "), left, y);
    y += 14;
  }
  if (project.prompt) {
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    const p = wrap(project.prompt, 11);
    doc.text(p, left, y);
    y += p.length * 14 + 12;
  }
  const coverStep = plan.instructions.find((s) => s.imageDataUrl && s.imageDataUrl.startsWith("data:image") && s.imageDataUrl.length > 800);
  if (coverStep?.imageDataUrl) {
    const fmt = dataUrlFormat(coverStep.imageDataUrl);
    if (fmt) {
      try {
        const imgH = 220;
        ensure(imgH + 28);
        doc.addImage(coverStep.imageDataUrl, fmt, left, y, width, imgH, undefined, "FAST");
        doc.setDrawColor(...PHOTO_RULE);
        doc.setLineWidth(0.75);
        doc.rect(left, y, width, imgH, "S");
        y += imgH + 10;
        doc.setFont("times", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text("The unit on the bench", left + width / 2, y, { align: "center" });
        y += 18;
      } catch { /* skip */ }
    }
  }
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.6);
  doc.line(left, y, right, y);
  y += 22;
  heading("Check");
  body(plan.feasibility.summary);
  for (const issue of plan.feasibility.issues) {
    body(`${issue.severity === "critical" ? "Stop — " : issue.severity === "warning" ? "Note — " : ""}${issue.message}`);
    if (issue.suggestion) muted(issue.suggestion);
  }
  if (plan.cutList.length) {
    heading(plan.partsKind === "whole" ? "Stick list" : "Cut list");
    muted(plan.partsKind === "whole" ? "Full pieces from the pack. Glue them. Do not cut." : "Same size is the same letter. Mark A on the first cut, then batch.");
    for (const c of plan.cutList) {
      ensure(16);
      doc.setFont("times", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      const label = c.label ? `${c.label}  ` : "";
      doc.text(`${label}${c.quantity}x  ${c.name}`, left, y);
      doc.setFont("times", "normal");
      const dims = `${c.lengthIn}" x ${c.widthIn}" x ${c.thicknessIn}"`;
      doc.text(dims, right, y, { align: "right" });
      y += 15;
    }
  }

  // Nest pages
  if (plan.partsKind !== "whole" && plan.cutList.length) {
    const structural = plan.cutList.filter((c) => (c.thicknessIn ?? 0.75) >= 0.5);
    const thin = plan.cutList.filter((c) => (c.thicknessIn ?? 0.75) < 0.5);
    if (structural.length) {
      const nest = nestCutList(structural);
      for (const sheet of nest.sheets) {
        doc.addPage();
        y = 52;
        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...INK);
        doc.text("Cut this 4x8", left, y);
        y += 18;
        doc.setFont("times", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        doc.text("Letters match the cut list. 1/8\" kerf included. Grain runs long on the sheet.", left, y);
        y += 14;
        if (thin.length) {
          doc.text(
            `Thin backer (${thin.map((t) => t.label ?? t.name).join(", ")}) is not on this sheet — buy 1/4\" separately.`,
            left,
            y,
          );
          y += 16;
        }
        drawNestSheet(doc, sheet, left, y, width);
      }
    }
  }

  // Buy
  doc.addPage();
  y = 52;
  heading("Buy");
  body(
    `${plan.totals.pieces} pieces · ${plan.totals.estCostUsd != null ? `~${usd(plan.totals.estCostUsd)} estimated` : "cost varies"} · cheapest same-size listing first`,
  );
  for (const b of plan.bom) {
    ensure(48);
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    const label = `${b.quantity} ${b.unit} · ${b.name}${b.estimatedCost != null ? ` · ${usd(b.estimatedCost)}` : ""}`;
    const lines = wrap(label, 11);
    doc.text(lines, left, y);
    y += lines.length * 14;
    if (b.notes) {
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...MUTED);
      const n = wrap(b.notes, 10);
      doc.text(n, left, y);
      y += n.length * 12;
    }
    if (b.searchQuery) {
      doc.setFont("times", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      const shopLine = wrap(`Shop · ${b.searchQuery}`, 9);
      doc.text(shopLine, left, y);
      y += shopLine.length * 11 + 6;
    } else {
      y += 6;
    }
  }

  // Shop words
  doc.addPage();
  y = 52;
  heading("Shop words");
  muted("Every term used in this plan, defined once so you can build without a trade dictionary.");
  for (const g of SHOP_GLOSSARY) {
    ensure(28);
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(g.term, left, y);
    doc.setFont("times", "normal");
    doc.setTextColor(...MUTED);
    const def = doc.splitTextToSize(g.def, width - 110);
    doc.text(def, left + 110, y);
    y += Math.max(14, def.length * 12) + 4;
  }

  // Build steps
  doc.addPage();
  y = 52;
  heading("Build");
  for (const s of plan.instructions) {
    ensure(80);
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...ACCENT);
    const num = String(s.step).padStart(2, "0");
    doc.text(num, left, y);
    doc.setTextColor(...INK);
    doc.setFontSize(12);
    doc.text(s.title, left + 36, y);
    y += 18;
    const fmt = s.imageDataUrl ? dataUrlFormat(s.imageDataUrl) : null;
    const hasPhoto = Boolean(fmt && s.imageDataUrl && s.imageDataUrl.length > 800);
    if (hasPhoto && s.imageDataUrl && fmt) {
      try {
        const photoH = 300;
        ensure(photoH + 24);
        doc.addImage(s.imageDataUrl, fmt, left, y, width, photoH, undefined, "FAST");
        doc.setDrawColor(...PHOTO_RULE);
        doc.setLineWidth(0.75);
        doc.rect(left, y, width, photoH, "S");
        y += photoH + 8;
        doc.setFont("times", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text("Bench view — lit parts are this step", left + width / 2, y, { align: "center" });
        y += 16;
      } catch {
        /* skip */
      }
    } else {
      try {
        const isoH = 120;
        ensure(isoH + 12);
        drawStepPlate(doc, project, s, left, y, width, isoH);
        y += isoH + 10;
      } catch {
        muted(`${project.overall.width}" W × ${project.overall.height}" H × ${project.overall.depth}" D`);
      }
    }
    body(s.description);
    if (s.tips) muted(s.tips);
    y += 8;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    footer(i);
  }
  return doc;
}

export function planPdfBlob(project: YardProject, plan: BuildPlan): Blob {
  return buildPlanPdf(project, plan).output("blob");
}
