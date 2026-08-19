import { jsPDF } from "jspdf";
import { usd } from "@/lib/utils";
import type { BuildPlan, YardProject } from "./types";

const INK: [number, number, number] = [26, 22, 18];
const MUTED: [number, number, number] = [107, 99, 88];
const RULE: [number, number, number] = [216, 208, 194];
const PAPER: [number, number, number] = [243, 238, 228];

export function slugPlan(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "yard-plan";
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
    body(`${issue.severity === "critical" ? "Stop — " : issue.severity === "warning" ? "Note — " : ""}${issue.message}`);
    if (issue.suggestion) muted(issue.suggestion);
  }
  if (plan.cutList.length) {
    heading("Cut list");
    for (const c of plan.cutList) {
      ensure(16);
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      doc.text(`${c.quantity}×`, left, y);
      const nameLines = wrap(c.name, 11, width - 150);
      doc.text(nameLines, left + 28, y);
      doc.setTextColor(...MUTED);
      doc.text(`${c.lengthIn}" × ${c.widthIn}" × ${c.thicknessIn}"`, right, y, { align: "right" });
      y += Math.max(16, nameLines.length * 14);
    }
    y += 6;
  }
  if (plan.bom.length) {
    heading("Buy");
    muted(`${plan.totals.pieces} pieces · ${usd(plan.totals.estCostUsd)} estimated`);
    for (const b of plan.bom) {
      ensure(16);
      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      const lines = wrap(`${b.quantity} ${b.unit} · ${b.name}${b.estimatedCost != null ? ` · ${usd(b.estimatedCost)}` : ""}`, 11);
      doc.text(lines, left, y);
      y += lines.length * 14;
      if (b.notes) muted(b.notes);
    }
    y += 6;
  }
  if (plan.instructions.length) {
    heading("Build");
    for (const s of plan.instructions) {
      const titleLines = wrap(`${String(s.step).padStart(2, "0")}  ${s.title}`, 13);
      const descLines = wrap(s.description, 11);
      const tipLines = s.tips ? wrap(s.tips, 10) : [];
      ensure(titleLines.length * 16 + descLines.length * 14 + tipLines.length * 13 + 18);
      doc.setFont("times", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...INK);
      doc.text(titleLines, left, y);
      y += titleLines.length * 16;
      doc.setFont("times", "normal");
      doc.setFontSize(11);
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
