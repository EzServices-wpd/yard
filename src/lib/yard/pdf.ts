import { jsPDF } from "jspdf";
import { usd } from "@/lib/utils";
import { nestCutList, nestParts, sheetSizeLabel, type NestPart, type NestSheet } from "./nesting";
import type { AssemblyStep, BuildPlan, CutLine, YardProject } from "./types";
import { fmtUnitEnvelope, shortSheetTalk } from "./pdfFormat";
import { SHOP_GLOSSARY } from "./pdfGlossary";
import { glossaryForPlan, speciesStockHonestyTalk } from "./voiceHonesty";
import { stepInstanceIds } from "./assembly";
import { cutListName } from "./shopPlural";
import { KIT, GRID, clean, frac, sentences, type RGB } from "./pdfKit";
import {
  TOOL_LABEL,
  drawBubble,
  drawHardware,
  drawShape,
  drawShapeInRect,
  drawTool,
  hardwareKind,
  isRoundPlate,
  partLetters,
  partShape,
  projectAspect,
  renderProject,
  screwLengthIn,
  type Frame,
  type Shape2D,
  type ToolKind,
  type Tone,
} from "./pdfDraw";

export function slugPlan(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "yard-plan";
}

type StepKind = "prep" | "cut" | "build";

const CRAFT_GLOSSARY = [
  { term: "Whole stock", def: "Pieces stay full length from the pack. Glue them as they come." },
  { term: "Dry-fit", def: "Assemble without glue first to check fit and square before you commit." },
  { term: "Joint", def: "Where two sticks meet. A small bead of glue on both faces, then hold for a slow count of 30." },
  { term: "Brace", def: "A stick set on a slant across a frame so it holds its shape." },
  { term: "Pivot", def: "The point a moving part turns on, like an axle." },
  { term: "Square", def: "Corners at 90 degrees. Check by measuring both diagonals: they should match." },
];

/** Plain, kit-manual plan PDF drawn from the same geometry as the cut list. */
export function buildPlanPdf(project: YardProject, plan: BuildPlan): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const L = GRID.margin;
  const R = pageW - GRID.margin;
  const W = R - L;
  const TOP = GRID.top;
  const BOTTOM = pageH - GRID.bottom;
  const title = clean(project.name) || "Yard plan";
  const craft = plan.partsKind === "whole" || (project.instances.length > 0 && project.panels.length === 0);
  const letters = partLetters(project, plan.cutList);
  const sections: string[] = [""];
  let y = TOP;

  // ── type helpers (font is set before every wrap, so lines never overrun the margin)
  const font = (size: number, style: "normal" | "bold" | "italic" = "normal", color: RGB = KIT.ink) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const wrap = (t: string, w: number, size: number, style: "normal" | "bold" | "italic" = "normal"): string[] => {
    font(size, style);
    return doc.splitTextToSize(clean(t), w) as string[];
  };
  const textBlock = (
    t: string,
    x: number,
    top: number,
    w: number,
    size: number,
    style: "normal" | "bold" | "italic" = "normal",
    color: RGB = KIT.ink,
    lh = size * 1.35,
  ) => {
    const lines = wrap(t, w, size, style);
    font(size, style, color);
    lines.forEach((ln, i) => doc.text(ln, x, top + size + i * lh));
    return lines.length * lh;
  };
  const newPage = (section: string) => {
    doc.addPage();
    sections.push(section);
    y = TOP;
  };
  const room = () => BOTTOM - y;
  const sectionTitle = (t: string, sub?: string) => {
    font(20, "bold");
    doc.text(clean(t), L, y + 20);
    doc.setDrawColor(...KIT.accent);
    doc.setLineWidth(2);
    doc.line(L, y + 28, L + 36, y + 28);
    y += 38;
    if (sub) {
      y += textBlock(sub, L, y, W, 10, "normal", KIT.muted) + 6;
    }
    y += 4;
  };
  const subTitle = (t: string) => {
    font(12, "bold");
    doc.text(clean(t), L, y + 12);
    y += 22;
  };
  const allIds = [...project.panels.map((p) => p.id), ...project.instances.map((i) => i.id)];
  const allTones = (tone: Tone) => new Map<string, Tone>(allIds.map((id) => [id, tone]));
  const envelopeTalk = clean(
    fmtUnitEnvelope(project.overall.width, project.overall.height, project.overall.depth, {
      shape: project.fitted?.unit?.shape,
      prompt: project.prompt,
      name: project.name,
      legs: project.fitted?.unit?.legs,
    }),
  );
  const envelope = /dia|round/i.test(envelopeTalk)
    ? envelopeTalk
    : `${frac(project.overall.width)} wide x ${frac(project.overall.height)} tall x ${frac(project.overall.depth)} deep`;

  // ── what the build needs, read from the plan itself
  const hay = `${project.prompt ?? ""} ${project.name} ${plan.instructions.map((s) => `${s.title} ${s.description}`).join(" ")}`.toLowerCase();
  const woodLine = (name: string) =>
    /plywood|sheet|backer|\b\d+\s*[x×]\s*\d+\b|board|stick|dowel|lumber|mdf|pine|oak|cedar|maple|birch|walnut|straw|pipe|pvc/i.test(name) &&
    !/screw|nail|brad|bolt/i.test(name);
  const hardware = plan.bom.filter((b) => !woodLine(b.name) || hardwareKind(b.name) === "glue");
  const hasScrews = hardware.some((b) => hardwareKind(b.name) === "screw");
  const hasGlue = hardware.some((b) => hardwareKind(b.name) === "glue");
  const structural = hardware.some((b) => /structural|lag|grk/i.test(b.name)) || /\bstuds?\b/.test(hay);
  const doors = project.panels.filter((p) => /door/i.test(p.type) || /\bdoor\b/i.test(p.name));
  const drawers = project.panels.filter((p) => /drawer/i.test(p.type) || /drawer/i.test(p.name));
  const lid = project.panels.some((p) => /\blid\b/i.test(p.name));
  const shelves = project.panels.filter((p) => /shelf/i.test(p.type) || /shelf/i.test(p.name));
  const legs = project.panels.filter((p) => /^leg/i.test(p.name));
  const round = project.fitted?.unit?.shape === "round" || project.panels.some((p) => isRoundPlate(project, p) || p.outline === "quarter-round");
  const angled = project.panels.some((p) => p.polygon || p.outline === "right-triangle" || /°/.test(p.cutNote ?? ""));

  const tools: ToolKind[] = (() => {
    if (craft) return ["ruler", "pencil", "glue", "clamp", "square"];
    const t: ToolKind[] = ["tape", "square", "pencil"];
    if (plan.cutList.length) t.push("saw");
    if (round) t.push("jigsaw");
    if (angled) t.push("bevel");
    if (hasScrews) t.push("drill");
    if (hasGlue) t.push("clamp");
    if (/\blevel\b|plumb/.test(hay) || legs.length) t.push("level");
    if (structural) t.push("studfinder");
    t.push("sander");
    return t;
  })();

  const skill = (() => {
    if (craft) return { n: 1, word: "Beginner" };
    let n = 0;
    if (plan.cutList.length > 6) n++;
    if (doors.length || drawers.length || lid) n++;
    if (angled || round) n++;
    if (plan.totals.pieces > 24) n++;
    return n <= 1 ? { n: 1, word: "Beginner" } : n === 2 ? { n: 2, word: "Intermediate" } : { n: 3, word: "Advanced" };
  })();

  // ═════════════════════════ COVER
  font(9, "bold", KIT.accent);
  doc.text("YARD BUILD PLAN", L, 58);
  doc.setDrawColor(...KIT.accent);
  doc.setLineWidth(1);
  doc.line(L, 62, L + doc.getTextWidth("YARD BUILD PLAN"), 62);
  y = 72;
  const tl = wrap(title, W, 28, "bold");
  font(28, "bold");
  tl.forEach((ln, i) => doc.text(ln, L, y + 26 + i * 32));
  y += tl.length * 32 + 8;
  font(13, "normal", KIT.muted);
  doc.text(envelope, L, y + 12);
  y += 22;
  const speciesTalk = speciesStockHonestyTalk(project.prompt ?? "", '3/4" plywood');
  if (speciesTalk) y += textBlock(speciesTalk, L, y, W, 9, "italic", KIT.muted) + 2;
  const heroH = Math.max(250, 470 - y + 72);
  const hero: Frame = { x: L, y: y + 6, w: W, h: heroH };
  doc.setFillColor(...KIT.paper);
  doc.roundedRect(hero.x, hero.y, hero.w, hero.h, 6, 6, "F");
  renderProject(doc, project, hero, { tones: allTones("built"), dims: true, pad: 30 });
  y = hero.y + hero.h + 14;
  // Info boxes
  const info: [string, string][] = [
    ["SKILL", skill.word],
    ["TIME", plan.effort ? clean(plan.effort).replace(/^about\s+/i, "") : "-"],
    ["COST", plan.totals.estCostUsd ? usd(plan.totals.estCostUsd) : "varies"],
    ["PIECES", String(plan.totals.pieces || plan.cutList.reduce((s, c) => s + c.quantity, 0))],
  ];
  const bw = (W - GRID.gutter * 3) / 4;
  info.forEach(([k, v], i) => {
    const bx = L + i * (bw + GRID.gutter);
    doc.setDrawColor(...KIT.rule);
    doc.setLineWidth(0.8);
    doc.roundedRect(bx, y, bw, 52, 4, 4, "S");
    font(8, "bold", KIT.muted);
    doc.text(k, bx + 10, y + 16);
    font(15, "bold");
    doc.text(clean(v), bx + 10, y + 38);
    if (k === "SKILL") {
      for (let d = 0; d < 3; d++) {
        doc.setFillColor(...(d < skill.n ? KIT.accent : KIT.rule));
        doc.circle(bx + bw - 34 + d * 10, y + 13, 3, "F");
      }
    }
  });
  y += 66;
  font(8, "bold", KIT.muted);
  doc.text("TOOLS", L, y + 8);
  y += 14;
  const tw = Math.min(62, W / tools.length);
  tools.forEach((t, i) => {
    const tx = L + i * tw;
    drawTool(doc, t, tx + (tw - 30) / 2, y, 30);
    font(7, "normal", KIT.muted);
    doc.text(TOOL_LABEL[t], tx + tw / 2, y + 42, { align: "center" });
  });
  y += 52;
  if (project.prompt && y < BOTTOM - 20) {
    textBlock(`You asked for: "${project.prompt}"`, L, y, W, 9, "italic", KIT.muted);
  }

  // ═════════════════════════ BEFORE YOU START
  newPage("Before you start");
  sectionTitle("Before you start");
  const checkLead = clean(plan.feasibility.summary);
  if (checkLead) y += textBlock(checkLead, L, y, W, 10.5) + 6;
  for (const issue of plan.feasibility.issues) {
    const tag = issue.severity === "critical" ? "Stop and fix: " : issue.severity === "warning" ? "Note: " : "";
    const h1 = wrap(`${tag}${issue.message}`, W - 14, 10).length * 13.5 + (issue.suggestion ? wrap(issue.suggestion, W - 14, 9).length * 12.5 : 0) + 8;
    if (h1 > room()) newPage("Before you start");
    doc.setFillColor(...(issue.severity === "critical" ? KIT.accent : KIT.rule));
    doc.rect(L, y + 2, 3, h1 - 8, "F");
    y += textBlock(`${tag}${issue.message}`, L + 12, y, W - 14, 10);
    if (issue.suggestion) y += textBlock(issue.suggestion, L + 12, y, W - 14, 9, "italic", KIT.muted);
    y += 8;
  }
  y += 6;
  subTitle("Buy");
  // Buy table
  const qtyW = 86;
  const costW = 64;
  const nameW = W - qtyW - costW;
  font(8, "bold", KIT.muted);
  doc.text("QTY", L, y + 8);
  doc.text("ITEM", L + qtyW, y + 8);
  doc.text("EST.", R, y + 8, { align: "right" });
  y += 14;
  doc.setDrawColor(...KIT.ink);
  doc.setLineWidth(0.8);
  doc.line(L, y, R, y);
  y += 4;
  for (const b of plan.bom) {
    const nameLines = wrap(b.name, nameW - 10, 10, "bold");
    const noteLines = b.notes ? wrap(b.notes, nameW - 10, 8.5) : [];
    const h = nameLines.length * 13 + noteLines.length * 11 + 10;
    if (h > room()) {
      newPage("Before you start");
    }
    font(10, "bold");
    doc.text(clean(`${b.quantity} ${b.unit}`), L, y + 12);
    nameLines.forEach((ln, i) => doc.text(ln, L + qtyW, y + 12 + i * 13));
    font(8.5, "normal", KIT.muted);
    noteLines.forEach((ln, i) => doc.text(ln, L + qtyW, y + 12 + nameLines.length * 13 + i * 11));
    font(10, "normal");
    if (b.estimatedCost != null) doc.text(usd(b.estimatedCost), R, y + 12, { align: "right" });
    y += h;
    doc.setDrawColor(...KIT.rule);
    doc.setLineWidth(0.5);
    doc.line(L, y - 3, R, y - 3);
  }
  font(9, "normal", KIT.muted);
  y += 4;
  if (plan.totals.estCostUsd) y += textBlock(`About ${usd(plan.totals.estCostUsd)} all-in, cheapest same-size listing first.`, L, y, W, 9, "normal", KIT.muted) + 8;
  if (room() < 110) newPage("Before you start");
  subTitle("Tools");
  const cols = Math.min(tools.length, 8);
  const cw = W / cols;
  tools.forEach((t, i) => {
    const cx = L + (i % cols) * cw;
    const cy = y + Math.floor(i / cols) * 58;
    drawTool(doc, t, cx + (cw - 34) / 2, cy, 34);
    font(8, "normal", KIT.muted);
    doc.text(TOOL_LABEL[t], cx + cw / 2, cy + 46, { align: "center" });
  });
  y += Math.ceil(tools.length / cols) * 58 + 6;

  // ═════════════════════════ EXPLODED VIEW + PARTS PLATE
  const partLines = plan.cutList;
  const exploded = project.panels.length >= 3 && project.panels.length <= 90 && project.instances.length === 0;
  if (exploded) {
    newPage("Parts");
    sectionTitle("How it goes together", "Every part, pulled apart. Letters match the parts plate and the cut list.");
    const f: Frame = { x: L, y, w: W, h: BOTTOM - y };
    doc.setFillColor(...KIT.paper);
    doc.roundedRect(f.x, f.y, f.w, f.h, 6, 6, "F");
    renderProject(doc, project, f, {
      tones: allTones("built"),
      explode: 0.55,
      letters,
      bubbleIds: new Set(allIds),
      pad: 36,
    });
  }

  if (partLines.length) {
    newPage("Parts");
    sectionTitle(
      craft ? "Parts" : "Parts plate",
      craft ? "Everything that goes into the build, straight from the pack." : "Every part drawn to the same scale. Letter, count, and finished size.",
    );
    y += drawPartsPlate(doc, project, partLines, letters, { x: L, y, w: W, h: BOTTOM - y }, craft) + 16;
  }

  // ═════════════════════════ HARDWARE
  if (hardware.length) {
    const hwNeed = 70 + hardware.length * 64;
    if (hwNeed > room()) newPage("Hardware");
    else sections[sections.length - 1] += " · Hardware";
    sectionTitle("Hardware", "Screws are drawn at actual size. Hold one against the page to check you bought the right length.");
    for (const b of hardware) {
      const kind = hardwareKind(b.name);
      const len = kind === "screw" || kind === "nail" ? screwLengthIn(b.name) ?? undefined : undefined;
      const rowH = kind === "screw" || kind === "nail" ? 64 : 58;
      if (rowH > room()) newPage("Hardware");
      doc.setDrawColor(...KIT.rule);
      doc.setLineWidth(0.6);
      doc.roundedRect(L, y, W, rowH - 8, 4, 4, "S");
      const gx = L + 14;
      const cy = y + (rowH - 8) / 2;
      const gw = drawHardware(doc, kind, gx, cy, { lengthIn: len, maxW: 240 });
      const tx = L + 14 + Math.max(gw, 110) + 18;
      font(14, "bold", KIT.accent);
      doc.text(clean(`${b.quantity} ${b.unit}`), tx, cy - 4);
      font(10, "bold");
      const nm = wrap(b.name, R - tx - 10, 10, "bold");
      doc.text(nm[0] ?? "", tx, cy + 10);
      if (len) {
        font(7.5, "bold", KIT.muted);
        doc.text(`ACTUAL SIZE · ${frac(len)} LONG`, gx, y + rowH - 12);
      }
      y += rowH;
    }
  }

  // ═════════════════════════ CUT LIST TABLE
  if (partLines.length) {
    const listNeed = 80 + partLines.reduce((a, c) => a + 30 + (c.notes ? 24 : 0), 0);
    if (listNeed < room()) {
      y += 12;
      sections[sections.length - 1] += craft ? "" : " · Cut list";
    } else newPage(craft ? "Parts" : "Cut list");
    sectionTitle(
      craft ? "Stick list" : "Cut list",
      craft ? "Full pieces from the pack. Glue them as they come." : "Same size is the same letter. Mark each part with its letter in pencil as you cut it.",
    );
    const cols2 = craft
      ? [
          { k: "", w: 30 },
          { k: "QTY", w: 44 },
          { k: "PART", w: W - 30 - 44 - 170 },
          { k: "SIZE", w: 170 },
        ]
      : [
          { k: "", w: 30 },
          { k: "QTY", w: 40 },
          { k: "PART", w: W - 30 - 40 - 64 * 3 - 90 },
          { k: "LENGTH", w: 64 },
          { k: "WIDTH", w: 64 },
          { k: "THICK", w: 64 },
          { k: "STOCK", w: 90 },
        ];
    const header = () => {
      let x = L;
      font(8, "bold", KIT.muted);
      for (const c of cols2) {
        doc.text(c.k, x, y + 8);
        x += c.w;
      }
      y += 13;
      doc.setDrawColor(...KIT.ink);
      doc.setLineWidth(0.8);
      doc.line(L, y, R, y);
      y += 3;
    };
    header();
    for (const c of partLines) {
      const partW = cols2[2].w - 8;
      const nameLines = wrap(c.name, partW, 10, "bold");
      const note = c.notes ? clean(c.notes) : "";
      const noteLines = note ? wrap(note, W - 74, 8.5) : [];
      const h = Math.max(24, nameLines.length * 13 + 11) + noteLines.length * 11 + (noteLines.length ? 4 : 0);
      if (h > room()) {
        newPage(craft ? "Parts" : "Cut list");
        header();
      }
      drawBubble(doc, L + 10, y + 12, c.label ?? "?", 8);
      font(10, "bold");
      doc.text(String(c.quantity), L + 30, y + 16);
      nameLines.forEach((ln, i) => doc.text(ln, L + 30 + cols2[1].w, y + 16 + i * 13));
      font(10, "normal");
      if (craft) {
        doc.text(`${frac(c.lengthIn)} x ${frac(c.widthIn)} x ${frac(c.thicknessIn)}`, L + W - 170, y + 16);
      } else {
        let x = L + 30 + cols2[1].w + cols2[2].w;
        for (const v of [c.lengthIn, c.widthIn, c.thicknessIn]) {
          doc.text(frac(v), x, y + 16);
          x += 64;
        }
        font(8.5, "normal", KIT.muted);
        const st = wrap(shortSheetTalk(c.material) || c.material, 86, 8.5);
        st.slice(0, 2).forEach((ln, i) => doc.text(ln, x, y + 16 + i * 10));
      }
      const baseH = Math.max(24, nameLines.length * 13 + 11);
      font(8.5, "italic", KIT.muted);
      noteLines.forEach((ln, i) => doc.text(ln, L + 30 + cols2[1].w, y + baseH + i * 11));
      y += h;
      doc.setDrawColor(...KIT.rule);
      doc.setLineWidth(0.5);
      doc.line(L, y - 2, R, y - 2);
    }
  }

  // ═════════════════════════ CUT DIAGRAMS
  if (!craft && partLines.length) {
    const nest = nestCutList(partLines);
    const sheets: NestSheet[] = [...(nest?.sheets ?? [])];
    const thin = partLines.filter((c) => !c.whole && (c.thicknessIn ?? 0.75) < 0.5 && Math.min(c.lengthIn, c.widthIn) > 2);
    if (thin.length) {
      const parts: NestPart[] = [];
      for (const c of thin) {
        for (let i = 0; i < Math.max(1, Math.floor(c.quantity)); i++) {
          parts.push({
            id: `${c.id}-${i}`,
            name: c.name,
            label: c.label,
            width: Math.max(c.lengthIn, c.widthIn),
            height: Math.min(c.lengthIn, c.widthIn),
            material: `${frac(c.thicknessIn)} plywood`,
            allowRotate: true,
          });
        }
      }
      const tall = parts.some((p) => p.width > 96);
      const res = nestParts(parts, tall ? { width: 120, height: 48 } : { width: 96, height: 48 });
      res.sheets.forEach((s) => sheets.push({ ...s, index: sheets.length + 1 }));
    }
    const nested = new Set(sheets.flatMap((s) => s.parts.map((p) => p.label)));
    const boards = partLines.filter((c) => !c.whole && !nested.has(c.label) && !(thin.includes(c)));
    const blocks: { h: number; draw: (top: number) => void }[] = [];
    for (const s of sheets) {
      const sc = Math.min(W / s.width, 196 / s.height);
      const h = s.height * sc + 60;
      blocks.push({ h, draw: (top) => drawSheet(doc, project, s, partLines, letters, L, top, W, sc, sheets.length) });
    }
    const boardGroups = new Map<string, CutLine[]>();
    for (const c of boards) {
      const k = c.material || "Board";
      boardGroups.set(k, [...(boardGroups.get(k) ?? []), c]);
    }
    for (const [mat, lines] of boardGroups) {
      const ft = Number(clean(mat).match(/(\d+)\s*ft/i)?.[1] ?? 8);
      const stock = ft * 12;
      const bars = packBoards(lines, stock);
      const h = 40 + bars.length * 34;
      blocks.push({ h, draw: (top) => drawBoards(doc, mat, bars, stock, L, top, W) });
    }
    if (blocks.length) {
      newPage("Cut diagrams");
      sectionTitle("Cut diagrams", "Cut in the order shown. Letters match the cut list. Dashed lines are angle, round, or diagonal cuts. 1/8\" saw kerf is included.");
      for (const b of blocks) {
        if (b.h > room()) {
          newPage("Cut diagrams");
        }
        b.draw(y);
        y += b.h + 8;
      }
    }
  }

  // ═════════════════════════ BUILD STEPS
  const placed = new Set<string>();
  const tallBuild = projectAspect(project) < 1.3;
  const stepKind = (s: AssemblyStep, ids: string[]): StepKind => {
    const t = clean(s.title).toLowerCase();
    if (/^(confirm|read|measure|check the|mark|lay out)\b|do not cut yet|before you/.test(t)) return "prep";
    if (/^(cut|rip|trim)\b|\bcut (the|all|every|\d)|stay whole|\bdo not cut\b/.test(t) && !/^(screw|glue|attach)/.test(t)) return "cut";
    if (!ids.length) return "prep";
    if ((s.partsUsed ?? []).includes("*") && /confirm|read|measure|check|lay out|mark|before/.test(t)) return "prep";
    return "build";
  };
  const hwChips = (s: AssemblyStep) => {
    const out: string[] = [];
    const re = /(\d+)\s+(?:structural\s+|wood\s+|pocket\s+|concealed\s+)?(screws?|hinges?|nails?|brads?|pulls?|knobs?|slides?|pins?|brackets?|clamps?)\b/gi;
    const text = clean(`${s.title} ${s.description}`);
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const chip = `${m[1]} ${m[2].toLowerCase()}`;
      if (!seen.has(chip)) {
        seen.add(chip);
        out.push(chip);
      }
    }
    return out.slice(0, 4);
  };
  const steps = plan.instructions;
  if (steps.length) {
    newPage("Build");
    sectionTitle("Build", craft ? "Orange is what you add in the step. Grey is already glued." : "Orange is what you add in the step. Grey is already built. Letters match the parts plate.");
  }
  for (const s of steps) {
    const ids = stepInstanceIds(project, s);
    const kind = stepKind(s, ids);
    const tones = new Map<string, Tone>();
    const hotIds: string[] = [];
    if (kind === "build") {
      let hot = ids.filter((id) => !placed.has(id));
      if (!hot.length) {
        const t = clean(s.title).toLowerCase();
        hot = ids.filter((id) => {
          const p = project.panels.find((q) => q.id === id);
          if (!p) return false;
          const fam = cutListName(p.name, p.type).toLowerCase();
          return t.includes(fam) || t.includes(p.name.toLowerCase());
        });
      }
      for (const id of placed) tones.set(id, "ghost");
      for (const id of ids) if (!tones.has(id)) tones.set(id, "ghost");
      for (const id of hot) tones.set(id, "hot");
      if (!hot.length) for (const id of tones.keys()) tones.set(id, "built");
      hotIds.push(...hot);
      ids.forEach((id) => placed.add(id));
    }
    // Callout row: part letters with counts.
    const counts = new Map<string, number>();
    if (kind === "build") {
      for (const id of hotIds) {
        const Lt = letters.get(id);
        if (Lt) counts.set(Lt, (counts.get(Lt) ?? 0) + 1);
        const p = project.panels.find((q) => q.id === id);
        if (!Lt && p && /drawer/i.test(`${p.type} ${p.name}`)) {
          // A drawer is drawn as one box but cut as sides, front, back, and bottom.
          for (const c of partLines) if (/drawer/i.test(c.name) && c.label) counts.set(c.label, c.quantity);
        }
      }
    }
    const cutLines =
      kind === "cut"
        ? (() => {
            const want = new Set(ids.map((id) => letters.get(id)).filter(Boolean) as string[]);
            const all = (s.partsUsed ?? []).includes("*") || !want.size;
            return partLines.filter((c) => all || want.has(c.label ?? ""));
          })()
        : [];
    if (kind === "cut") cutLines.forEach((c) => counts.set(c.label ?? "?", c.quantity));
    const chips = hwChips(s);
    const side = tallBuild && kind !== "cut";
    const picW = side ? Math.round(W * 0.5) : W;
    const tx = side ? L + picW + GRID.gutter : L;
    const bodyW = side ? R - tx : W;
    const sents = sentences(s.description);
    const sentLines = sents.map((t) => wrap(t, bodyW - 14, 10.5));
    const tipLines = s.tips ? wrap(`Tip: ${s.tips}`, bodyW - 14, 9.5, "italic") : [];
    const textH = sentLines.reduce((a, l) => a + l.length * 14 + 3, 0) + (tipLines.length ? tipLines.length * 13 + 6 : 0);
    const calloutRows = side ? Math.ceil((counts.size + chips.length) / 4) : 1;
    const calloutH = counts.size || chips.length ? 30 * calloutRows : 0;
    const headH = 34;
    let picH = side ? 280 : 250;
    const bodyH = (h: number) => (side ? Math.max(h, calloutH + textH) : h + 8 + calloutH + textH);
    let need = headH + bodyH(picH) + 16;
    if (need > BOTTOM - TOP) {
      picH = Math.max(150, picH - (need - (BOTTOM - TOP)));
      need = headH + bodyH(picH) + 16;
    }
    if (need > room()) newPage("Build");
    const top = y;
    // Step header
    font(26, "bold", KIT.accent);
    doc.text(String(s.step), L, top + 24);
    const nw = doc.getTextWidth(String(s.step));
    const titleLines = wrap(s.title, W - nw - 16, 13, "bold");
    font(13, "bold");
    doc.text(titleLines[0] ?? "", L + nw + 12, top + 22);
    y = top + headH;
    // Picture
    const frame: Frame = { x: L, y, w: picW, h: picH };
    doc.setFillColor(...KIT.paper);
    doc.roundedRect(frame.x, frame.y, frame.w, frame.h, 6, 6, "F");
    if (kind === "cut") {
      drawPartsPlate(doc, project, cutLines, letters, { x: frame.x + 10, y: frame.y + 8, w: frame.w - 20, h: frame.h - 14 }, craft, true);
    } else if (kind === "prep") {
      renderProject(doc, project, frame, { tones: allTones("built"), dims: true, pad: 26 });
    } else {
      renderProject(doc, project, frame, { tones, fitIds: allIds, letters, pad: 26 });
    }
    y = side ? top + headH : y + picH + 8;
    // Callouts
    if (calloutH) {
      let cx = tx;
      let cy = y;
      const wrapRow = (w: number) => {
        if (cx + w > R) {
          cx = tx;
          cy += 30;
        }
      };
      for (const [Lt, n] of [...counts.entries()].sort()) {
        font(11, "bold");
        const w = 21 + doc.getTextWidth(`x${n}`) + 14;
        wrapRow(w);
        drawBubble(doc, cx + 9, cy + 11, Lt, 8.5);
        font(11, "bold");
        doc.text(`x${n}`, cx + 21, cy + 15);
        cx += w;
      }
      for (const chip of chips) {
        font(9, "bold");
        const w = doc.getTextWidth(chip) + 16;
        wrapRow(w + 8);
        doc.setFillColor(...KIT.ghost);
        doc.roundedRect(cx, cy + 3, w, 17, 8, 8, "F");
        font(9, "bold");
        doc.text(chip, cx + 8, cy + 15);
        cx += w + 8;
      }
      y = cy + 30;
    }
    // Words: one short sentence per line.
    for (const lines of sentLines) {
      doc.setFillColor(...KIT.accent);
      doc.circle(tx + 3, y + 7, 1.8, "F");
      font(10.5, "normal");
      lines.forEach((ln, i) => doc.text(ln, tx + 12, y + 10.5 + i * 14));
      y += lines.length * 14 + 3;
    }
    if (tipLines.length) {
      y += 3;
      doc.setFillColor(...KIT.accentSoft);
      doc.rect(tx, y, 3, tipLines.length * 13, "F");
      font(9.5, "italic", KIT.muted);
      tipLines.forEach((ln, i) => doc.text(ln, tx + 12, y + 9.5 + i * 13));
      y += tipLines.length * 13 + 3;
    }
    y = Math.max(y, top + need - 10) + 10;
    if (room() > 60) {
      doc.setDrawColor(...KIT.rule);
      doc.setLineWidth(0.5);
      doc.line(L, y - 6, R, y - 6);
    }
  }

  // ═════════════════════════ CHECK IT
  newPage("Check it");
  sectionTitle("Check it", "Run every test before you load it or hand it over.");
  const finish: Frame = { x: L, y, w: W, h: 200 };
  doc.setFillColor(...KIT.paper);
  doc.roundedRect(finish.x, finish.y, finish.w, finish.h, 6, 6, "F");
  renderProject(doc, project, finish, { tones: allTones("built"), dims: true, pad: 22 });
  y += finish.h + 16;
  const tests: [string, string][] = [];
  if (craft) {
    tests.push(["Dry", "Let the glue dry overnight before you handle it."]);
    tests.push(["Square", "Set it on a flat table. Every leg touches and the frame stands straight when you sight along it."]);
    tests.push(["Joints", "Press gently on each joint. Every stick stays put; re-glue any that move."]);
    if (/pivot|axle|arm|hinge|wheel/.test(hay)) tests.push(["Operate", "Work the moving part ten times. It swings freely and returns without rubbing. Test with a soft payload only (a cotton ball or pom-pom), aimed away from people."]);
  } else {
    tests.push(["Square", "Measure both diagonals corner to corner. They match within 1/8\". Push on the long diagonal until they do."]);
    tests.push(["Level", "Set a level on the top, side to side and front to back. Shim the low corner until the bubble centers."]);
    if (legs.length || !structural) tests.push(["Steady", "Press down on each corner in turn. It sits still on every foot with no rocking."]);
    if (shelves.length) tests.push(["Load", `Load the ${shelves.length > 1 ? "shelves" : "shelf"} a few books at a time. Sight along the front edge: it stays straight.`]);
    else if (legs.length || /top/i.test(project.panels.map((p) => p.type).join(" "))) tests.push(["Load", "Lean on the middle of the top with both hands. It stays firm and quiet."]);
    if (doors.length) tests.push(["Doors", `Swing ${doors.length > 1 ? "each door" : "the door"} open and closed. Gaps stay even (about 1/8") and the door closes flush. Turn the hinge screws to tune.`]);
    if (drawers.length) tests.push(["Drawers", "Pull each drawer all the way out and push it closed. It runs smooth and stops flush with the front."]);
    if (lid) tests.push(["Lid", "Open the lid all the way and let it close. The hinges run free and the lid sits flat on the box."]);
    if (structural) tests.push(["Wall", "Pull firmly on the top edge. It stays tight to the wall, with every structural screw in a stud."]);
    tests.push(["Finish", "Run a hand over every edge and screw head. Sand anything sharp; every screw head sits flush."]);
  }
  for (const [k, v] of tests) {
    const lines = wrap(v, W - 120, 10.5);
    const h = Math.max(26, lines.length * 14 + 10);
    if (h > room()) newPage("Check it");
    doc.setDrawColor(...KIT.ink);
    doc.setLineWidth(1);
    doc.rect(L, y + 2, 13, 13, "S");
    font(10.5, "bold");
    doc.text(k, L + 24, y + 13);
    font(10.5, "normal");
    lines.forEach((ln, i) => doc.text(ln, L + 100, y + 13 + i * 14));
    y += h;
    doc.setDrawColor(...KIT.rule);
    doc.setLineWidth(0.5);
    doc.line(L, y - 4, R, y - 4);
  }

  // ═════════════════════════ SHOP WORDS
  const glossary = craft ? CRAFT_GLOSSARY : glossaryForPlan(`${project.prompt ?? ""} ${project.name}`, SHOP_GLOSSARY);
  if (glossary.length) {
    const colW0 = (W - GRID.gutter) / 2;
    const glossH = 30 + glossary.reduce((a, g) => a + 18 + wrap(g.def, colW0, 8.5).length * 11, 0) / 2 + 20;
    if (room() < glossH + 18) newPage("Shop words");
    else {
      y += 18;
      sections[sections.length - 1] = "Check it · Shop words";
    }
    subTitle("Shop words");
    const colW = (W - GRID.gutter) / 2;
    let colY = [y, y];
    glossary.forEach((g) => {
      const c = colY[0] <= colY[1] ? 0 : 1;
      const x = L + c * (colW + GRID.gutter);
      const def = wrap(g.def, colW, 8.5);
      const h = 12 + def.length * 11 + 6;
      if (colY[c] + h > BOTTOM) {
        if (colY[1 - c] + h <= BOTTOM) return;
        newPage("Shop words");
        colY = [y, y];
      }
      font(9, "bold");
      doc.text(clean(g.term), x, colY[c] + 9);
      font(8.5, "normal", KIT.muted);
      def.forEach((ln, i) => doc.text(ln, x, colY[c] + 21 + i * 11));
      colY[c] += h;
    });
  }

  // ═════════════════════════ running header + footer
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) {
    doc.setPage(i);
    font(8, "bold", KIT.muted);
    const head = title.length > 70 ? `${title.slice(0, 68)}...` : title;
    doc.text(head.toUpperCase(), L, 40);
    font(8, "normal", KIT.muted);
    doc.text((sections[i - 1] || "").toUpperCase(), R, 40, { align: "right" });
    doc.setDrawColor(...KIT.rule);
    doc.setLineWidth(0.6);
    doc.line(L, 47, R, 47);
  }
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...KIT.rule);
    doc.setLineWidth(0.6);
    doc.line(L, pageH - 40, R, pageH - 40);
    font(7.5, "normal", KIT.muted);
    doc.text("Yard · guidance only, not stamped engineering. Check sizes against your space before you cut.", L, pageH - 28);
    font(8, "bold", KIT.ink);
    doc.text(`${i} / ${pages}`, R, pageH - 28, { align: "right" });
  }
  return doc;
}

// ───────────────────────── parts plate ─────────────────────────

function drawPartsPlate(
  doc: jsPDF,
  project: YardProject,
  lines: CutLine[],
  letters: Map<string, string>,
  box: Frame,
  craft: boolean,
  compact = false,
) {
  const items = lines.map((c) => ({ c, sh: partShape(project, c, letters) }));
  items.sort((a, b) => b.sh.w * b.sh.h - a.sh.w * a.sh.h);
  const labelH = compact ? 26 : 32;
  const gap = compact ? 12 : 18;
  const textW = compact ? 92 : 118;
  const layout = (s: number) => {
    const rows: { items: { c: CutLine; sh: Shape2D; x: number; w: number; h: number }[]; h: number }[] = [];
    let row: (typeof rows)[number] = { items: [], h: 0 };
    let x = 0;
    for (const it of items) {
      const w = Math.max(it.sh.w * s, 3);
      const h = Math.max(it.sh.h * s, 3);
      const cell = Math.max(w, textW);
      if (x > 0 && x + cell > box.w) {
        rows.push(row);
        row = { items: [], h: 0 };
        x = 0;
      }
      row.items.push({ ...it, x, w, h });
      row.h = Math.max(row.h, h + labelH);
      x += cell + gap;
    }
    if (row.items.length) rows.push(row);
    const total = rows.reduce((a, r) => a + r.h + gap, 0);
    const wide = Math.max(...items.map((it) => it.sh.w * s));
    return { rows, total, ok: total <= box.h - (compact ? 0 : 24) && wide <= box.w };
  };
  // Craft sticks: actual size when they fit.
  let s = 72;
  if (!(craft && layout(72).ok)) {
    let lo = 0.2;
    let hi = compact ? 30 : 72;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      if (layout(mid).ok) lo = mid;
      else hi = mid;
    }
    s = lo;
  }
  const { rows } = layout(s);
  let y = box.y;
  for (const r of rows) {
    for (const it of r.items) {
      const x = box.x + it.x;
      const cy = y + (r.h - labelH - it.h) / 2;
      if (craft && !it.sh.circle && it.sh.pts.length === 4) {
        doc.setFillColor(...KIT.wood);
        doc.setDrawColor(...KIT.woodEdge);
        doc.setLineWidth(0.7);
        doc.roundedRect(x, cy, it.w, it.h, it.h / 2, it.h / 2, "FD");
      } else drawShape(doc, it.sh, x, cy, s, KIT.wood, KIT.woodEdge);
      const ly = y + r.h - labelH + 12;
      drawBubble(doc, x + 9, ly, it.c.label ?? "?", 8.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(compact ? 10 : 11);
      doc.setTextColor(...KIT.ink);
      doc.text(`x${it.c.quantity}`, x + 21, ly + 4);
      const qw = doc.getTextWidth(`x${it.c.quantity}`);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(compact ? 7.5 : 8.5);
      const name = clean(it.c.name).replace(/\s*\(.*?\)\s*/g, " ").trim();
      const room = Math.max(it.w, textW) - qw - 26;
      const nm = (doc.splitTextToSize(name, room) as string[])[0] ?? "";
      doc.text(nm, x + 25 + qw, ly + 3.5);
      doc.setTextColor(...KIT.muted);
      const dimT = `${frac(it.c.lengthIn)} x ${frac(it.c.widthIn)} x ${frac(it.c.thicknessIn)}`;
      doc.text(dimT, x, ly + (compact ? 13 : 16));
      const deg = clean(it.c.notes).match(/(\d+(?:\.\d+)?)°|(\d+(?:\.\d+)?) ?deg/);
      if (deg && !compact) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...KIT.accent);
        doc.text(`${deg[1] ?? deg[2]}° cut`, x + doc.getTextWidth(dimT) + 8, ly + 16);
      }
    }
    y += r.h + gap;
  }
  const used = y - box.y;
  if (!compact) {
    // Scale bar
    const unit = s >= 36 ? 1 : s >= 6 ? 6 : 12;
    const bar = unit * s;
    const by = s === 72 ? y + 4 : box.y + box.h - 10;
    doc.setDrawColor(...KIT.ink);
    doc.setLineWidth(1);
    doc.line(box.x, by, box.x + bar, by);
    doc.line(box.x, by - 3, box.x, by + 3);
    doc.line(box.x + bar, by - 3, box.x + bar, by + 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...KIT.muted);
    doc.text(s === 72 ? "Actual size" : `${frac(unit)} at this scale`, box.x + bar + 8, by + 3);
  }
  return s === 72 ? used + 24 : box.h;
}

// ───────────────────────── cut diagrams ─────────────────────────

function drawSheet(
  doc: jsPDF,
  project: YardProject,
  sheet: NestSheet,
  lines: CutLine[],
  letters: Map<string, string>,
  left: number,
  top: number,
  width: number,
  sc: number,
  count: number,
) {
  const mat = clean(sheet.material || '3/4" plywood');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...KIT.ink);
  doc.text(`Sheet ${sheet.index}${count > 1 ? ` of ${count}` : ""}  ·  ${mat}  ·  ${sheetSizeLabel(sheet)}`, left, top + 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...KIT.muted);
  doc.text(`${Math.round((sheet.utilization ?? 0) * 100)}% used`, left + width, top + 11, { align: "right" });
  const x0 = left + 16;
  const y0 = top + 30;
  const sw = sheet.width * sc;
  const sh = sheet.height * sc;
  const s2 = Math.min((width - 16) / sheet.width, sc);
  const w = sheet.width * s2;
  const h = sheet.height * s2;
  void sw;
  void sh;
  // Overall sheet dims
  doc.setDrawColor(...KIT.muted);
  doc.setLineWidth(0.5);
  doc.line(x0, y0 - 8, x0 + w, y0 - 8);
  doc.line(x0 - 8, y0, x0 - 8, y0 + h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...KIT.muted);
  doc.text(frac(sheet.width), x0 + w / 2, y0 - 11, { align: "center" });
  doc.text(frac(sheet.height), x0 - 11, y0 + h / 2, { align: "center", angle: 90 });
  doc.setFillColor(250, 248, 243);
  doc.setDrawColor(...KIT.woodEdge);
  doc.setLineWidth(0.8);
  doc.rect(x0, y0, w, h, "FD");
  for (const p of sheet.parts) {
    const px = x0 + p.x * s2;
    const py = y0 + p.y * s2;
    const pw = p.width * s2;
    const ph = p.height * s2;
    doc.setFillColor(...KIT.wood);
    doc.setDrawColor(...KIT.woodEdge);
    doc.setLineWidth(0.7);
    doc.rect(px, py, pw, ph, "FD");
    const line = lines.find((c) => c.label && c.label === p.label);
    if (line) {
      const shp = partShape(project, line, letters);
      if (shp.angled && (shp.pts.length || shp.circle)) drawShapeInRect(doc, shp, px, py, pw, ph, KIT.accent);
    }
    const big = Math.min(pw, ph) > 30;
    if (Math.min(pw, ph) > 14) {
      drawBubble(doc, px + pw / 2, py + ph / 2 - (big ? 6 : 0), p.label ?? "?", big ? 8.5 : 6.5);
    }
    if (big || (pw > 60 && ph > 18)) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...KIT.ink);
      const t = `${frac(p.width)} x ${frac(p.height)}`;
      if (doc.getTextWidth(t) < pw - 4) doc.text(t, px + pw / 2, py + ph / 2 + (big ? 13 : 10), { align: "center" });
    }
  }
  // Angle notes under the sheet
  const onSheet = new Set(sheet.parts.map((p) => p.label));
  const notes = lines.filter((c) => onSheet.has(c.label) && c.notes && /°|triangle|round|slope|diagonal|trapezoid|angle|bevel|arc/i.test(c.notes));
  let ny = y0 + h + 12;
  for (const c of notes.slice(0, 3)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...KIT.accent);
    doc.text(`${c.label}`, x0, ny);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...KIT.muted);
    const t = (doc.splitTextToSize(clean(c.notes), width - 30) as string[])[0] ?? "";
    doc.text(t, x0 + 12, ny);
    ny += 10;
  }
}

function packBoards(lines: CutLine[], stock: number) {
  const pieces: { label: string; len: number }[] = [];
  for (const c of lines) for (let i = 0; i < Math.max(1, Math.floor(c.quantity)); i++) pieces.push({ label: c.label ?? "?", len: c.lengthIn });
  pieces.sort((a, b) => b.len - a.len);
  const bars: { label: string; len: number }[][] = [];
  const used: number[] = [];
  for (const p of pieces) {
    let k = used.findIndex((u) => u + p.len + 0.125 <= stock);
    if (k < 0) {
      bars.push([]);
      used.push(0);
      k = bars.length - 1;
    }
    bars[k].push(p);
    used[k] += p.len + 0.125;
  }
  return bars;
}

function drawBoards(doc: jsPDF, mat: string, bars: { label: string; len: number }[][], stock: number, left: number, top: number, width: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...KIT.ink);
  doc.text(`${clean(mat)}  ·  ${bars.length} board${bars.length === 1 ? "" : "s"}, ${frac(stock)} long`, left, top + 11);
  const s = (width - 16) / stock;
  bars.forEach((bar, i) => {
    const by = top + 26 + i * 34;
    doc.setFillColor(250, 248, 243);
    doc.setDrawColor(...KIT.woodEdge);
    doc.setLineWidth(0.7);
    doc.rect(left + 16, by, stock * s, 16, "FD");
    let x = left + 16;
    for (const p of bar) {
      doc.setFillColor(...KIT.wood);
      doc.rect(x, by, p.len * s, 16, "FD");
      drawBubble(doc, x + p.len * s / 2 - 22, by + 8, p.label, 6.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...KIT.ink);
      doc.text(frac(p.len), x + p.len * s / 2 - 12, by + 11);
      x += (p.len + 0.125) * s;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...KIT.muted);
    doc.text("offcut", Math.min(left + 16 + stock * s - 22, x + 4), by + 11);
  });
}

export function planPdfBlob(project: YardProject, plan: BuildPlan): Blob {
  return buildPlanPdf(project, plan).output("blob");
}
