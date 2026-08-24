import { jsPDF } from "jspdf";
import { usd } from "@/lib/utils";
import { isoCaption, isoDims, isoFaces, isoMarks, isoViewBox } from "./iso";
import { stepInstanceIds } from "./assembly";
import { nestCutList, type NestSheet } from "./nesting";
import type { AssemblyStep, BuildPlan, YardProject } from "./types";

const INK: [number, number, number] = [26, 22, 18];
const MUTED: [number, number, number] = [107, 99, 88];
const RULE: [number, number, number] = [216, 208, 194];
const PAPER: [number, number, number] = [243, 238, 228];
const PLY_FILL: [number, number, number] = [232, 220, 196];
const PLY_EDGE: [number, number, number] = [160, 140, 110];

/** Plain-English definitions for every shop term used in house plans. */
const SHOP_GLOSSARY: { term: string; def: string }[] = [
  { term: "Carcase", def: "The main box of the unit — uprights, top, bottom, and back screwed together." },
  { term: "Toekick", def: "The recessed strip at the floor so your toes clear when you stand close to the face." },
  { term: "Dry-fit", def: "Assemble without glue or screws first, to check fit and square before you commit." },
  { term: "Overlay", def: "Door or drawer front sits on top of the face, not inside the opening." },
  { term: "Lag", def: "Long heavy screw driven into a wall stud (or masonry anchor) to hold the unit." },
  { term: "Edge banding", def: "Thin strip of veneer ironed onto a raw plywood edge so the edge looks finished." },
  { term: "Shim", def: "Thin wedge used to fill a gap and level or plumb the unit against an uneven wall or floor." },
  { term: "Scribe", def: "Mark and cut an edge to match a wavy wall so the box stays square instead of being forced." },
  { term: "Rack / racking", def: "Twisting the box out of square. A racked carcase makes doors and drawers bind." },
  { term: "Plumb", def: "Truly vertical — checked with a level on the uprights." },
  { term: "Square", def: "Corners at 90°. Check by measuring both diagonals — they should match within about 1/16\"." },
  { term: "Predrill", def: "Drill a small pilot hole before driving a screw so the plywood does not split." },
  { term: "Side-mount slides", def: "Metal drawer tracks that screw to the sides of the box and the cabinet opening." },
  { term: "Concealed hinges", def: "Cup hinges that mount inside the door and carcase so you do not see the hinge from the front." },
  { term: "Soft-close", def: "Hinges or slides that pull the door or drawer shut gently on the last inch." },
  { term: "French cleat", def: "Two interlocking angled strips — one on the wall, one on the piece — so the piece hangs strong and level." },
  { term: "Kerf", def: "The width of material the saw blade removes (about ⅛\" on a circular saw). Already included in the nest." },
  { term: "32mm pin holes", def: "Standard shelf-pin spacing: holes 32mm (about 1¼\") apart, 5mm diameter, set back about 1¼\" from the front edge." },
];

export function slugPlan(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "yard-plan";
}

/** jsPDF needs the right format string; wrong format → silent catch and no photo. */
function dataUrlFormat(dataUrl: string): "JPEG" | "PNG" | "WEBP" | null {
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "JPEG";
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  if (dataUrl.startsWith("data:image")) return "JPEG"; // StepCapture uses jpeg; guess
  return null;
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

/** Draw one 4×8 sheet layout (parts lettered to match cut list). */
function drawNestSheet(
  doc: jsPDF,
  sheet: NestSheet,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
) {
  const pad = 8;
  const s = Math.min((maxW - pad * 2) / sheet.width, (maxH - pad * 2 - 18) / sheet.height);
  const sheetW = sheet.width * s;
  const sheetH = sheet.height * s;
  const ox = x + (maxW - sheetW) / 2;
  const oy = y + 14;

  doc.setFillColor(250, 246, 238);
  doc.setDrawColor(...PLY_EDGE);
  doc.setLineWidth(1.1);
  doc.rect(ox, oy, sheetW, sheetH, "FD");

  doc.setDrawColor(230, 220, 200);
  doc.setLineWidth(0.3);
  for (let gy = 0; gy < sheet.height; gy += 6) {
    const ly = oy + gy * s;
    if (ly > oy + sheetH - 1) break;
    doc.line(ox + 1, ly, ox + sheetW - 1, ly);
  }

  for (const p of sheet.parts) {
    const px = ox + p.x * s;
    const py = oy + p.y * s;
    const pw = p.width * s;
    const ph = p.height * s;
    doc.setFillColor(...PLY_FILL);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.7);
    doc.rect(px, py, pw, ph, "FD");
    const letter = p.label || "?";
    doc.setFont("times", "bold");
    doc.setFontSize(Math.min(14, Math.max(8, Math.min(pw, ph) * 0.35)));
    doc.setTextColor(...INK);
    doc.text(letter, px + pw / 2, py + ph / 2 + 3, { align: "center" });
    if (pw > 28 && ph > 16) {
      doc.setFont("times", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      const dim = `${p.width.toFixed(1)}×${p.height.toFixed(1)}`;
      doc.text(dim, px + pw / 2, py + ph - 4, { align: "center" });
    }
  }

  doc.setFont("times", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const util = Math.round(sheet.utilization * 100);
  doc.text(
    `Sheet ${sheet.index} · ${sheet.material} · 96″ × 48″ · ${util}% used · ⅛″ kerf`,
    x + maxW / 2,
    oy + sheetH + 12,
    { align: "center" },
  );
}

export function buildPlanPdf(project: YardProject, plan: BuildPlan): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 48;
  const right = pageW - 48;
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

  // Sheet nest — house ply only (partsKind cut). Crafts stay whole-pack.
  if (plan.partsKind !== "whole" && plan.cutList.length) {
    const nest = nestCutList(plan.cutList);
    if (nest && nest.sheets.length > 0) {
      for (const sheet of nest.sheets) {
        doc.addPage();
        paintPage();
        y = 56;
        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...INK);
        doc.text("Cut this 4×8", left, y);
        y += 16;
        doc.setFont("times", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        doc.text(
          "Letters match the cut list. ⅛″ kerf included. Grain runs long on the sheet.",
          left,
          y,
        );
        y += 18;
        const plateH = pageH - y - 48;
        drawNestSheet(doc, sheet, left, y, width, plateH);
      }
      y = pageH; // force ensure to new page on next content
    }
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

  // Full shop-words glossary so a first-time builder never has to guess.
  if (plan.partsKind !== "whole" || plan.instructions.some((s) => /carcase|toekick|dry-fit|overlay|lag|shim|scribe/i.test(s.description + (s.tips ?? "")))) {
    heading("Shop words");
    muted("Every term used in this plan, defined once so you can build without a trade dictionary.");
    for (const g of SHOP_GLOSSARY) {
      ensure(28);
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...INK);
      doc.text(g.term, left, y);
      const defLines = wrap(g.def, 10, width - 110);
      doc.setFont("times", "normal");
      doc.setTextColor(...MUTED);
      doc.text(defLines, left + 100, y);
      y += Math.max(14, defLines.length * 12) + 4;
    }
    y += 4;
  }

  if (plan.instructions.length) {
    heading("Build");
    for (const s of plan.instructions) {
      const titleLines = wrap(`${String(s.step).padStart(2, "0")}  ${s.title}`, 13);
      const descLines = wrap(s.description, 11);
      const tipLines = s.tips ? wrap(s.tips, 10) : [];
      const fmt = s.imageDataUrl ? dataUrlFormat(s.imageDataUrl) : null;
      const hasPhoto = Boolean(fmt && s.imageDataUrl && s.imageDataUrl.length > 800);
      // Big photo: ~4.2" tall full-width. Skip the tiny iso when a real bench photo exists.
      const photoH = hasPhoto ? 300 : 0;
      const isoH = hasPhoto ? 0 : 88;
      ensure(
        titleLines.length * 16 +
          photoH +
          isoH +
          descLines.length * 14 +
          tipLines.length * 13 +
          32,
      );
      doc.setFont("times", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...INK);
      doc.text(titleLines, left, y);
      y += titleLines.length * 16 + 6;

      if (hasPhoto && s.imageDataUrl && fmt) {
        try {
          const imgW = width;
          const imgH = photoH;
          doc.addImage(s.imageDataUrl, fmt, left, y, imgW, imgH, undefined, "FAST");
          doc.setDrawColor(...RULE);
          doc.setLineWidth(0.5);
          doc.rect(left, y, imgW, imgH, "S");
          y += imgH + 6;
          doc.setFont("times", "italic");
          doc.setFontSize(9);
          doc.setTextColor(...MUTED);
          doc.text("Bench view — lit parts are this step", left + width / 2, y, { align: "center" });
          y += 14;
        } catch {
          /* fall through to iso only */
          drawStepPlate(doc, project, s, left, y, width, 88);
          y += 96;
        }
      } else if (isoH > 0) {
        drawStepPlate(doc, project, s, left, y, width, isoH);
        y += isoH + 8;
      }

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
      y += 14;
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
