import { pdfCutListIntro } from "./wholeItems";
import { isUnitItem } from "./unitItems";
import { stepTones } from "./planStepPicture";
import { modelFinishedDepth, modelProudNote, stampFinishedDepth } from "./modelSize";
import { jsPDF } from "jspdf";
import { usd } from "@/lib/utils";
import { planSheetNest, sheetSizeLabel, type NestSheet } from "./nesting";
import type { AssemblyStep, BuildPlan, CutLine, YardProject } from "./types";
import { fmtUnitEnvelope, shortSheetTalk } from "./pdfFormat";
import { SHOP_GLOSSARY } from "./pdfGlossary";
import { glossaryForPlan, speciesStockHonestyTalk } from "./voiceHonesty";
import { planStepParts, stepKindOf } from "./stepParts";
import { affiliateActive, affiliateConfig, affiliateDisclosure, outboundHref } from "./outbound";
import { stepPlacements } from "./placement";
import { buyListCart } from "./amazonCart";
import { drawQr } from "./pdfQr";
import { cutListName } from "./shopPlural";
import { shelfLineCount } from "./shelfSpan";
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


export { typedAxesTalk } from "./headerSize";
import { headerSize, typedAxesTalk } from "./headerSize";

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
  const craft0 = plan.partsKind === "whole" || (project.instances.length > 0 && project.panels.length === 0);
  const sizing = typedAxesTalk(project, craft0);
  // The header's own words and W × D × H order on the cover title and every running head (Critic #93: the PDF
  // title said "File cabinet 30" x 24" x 30"" in W × H × D under a W × D × H header).
  const title = clean(headerTitle(project, { features: false }));
  const craft = plan.partsKind === "whole" || (project.instances.length > 0 && project.panels.length === 0);
  const letters = partLetters(project, plan.cutList);
  const aff = affiliateConfig();
  const affOn = affiliateActive(aff);
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
  // Typed axes print plainly; axes the stranger never typed are marked assumed (shared densify rule).
  const envelope = /dia|round/i.test(envelopeTalk) && !sizing.assumedTalk ? envelopeTalk : sizing.subtitle;

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
  const curved = project.panels.some((p) => /scallop|curved/i.test(p.cutNote ?? ""));
  const angled = project.panels.some((p) => (p.polygon && !/scallop|curved/i.test(p.cutNote ?? "")) || p.outline === "right-triangle" || /°/.test(p.cutNote ?? ""));

  const tools: ToolKind[] = (() => {
    if (craft) return ["ruler", "pencil", "glue", "clamp", "square"];
    const t: ToolKind[] = ["tape", "square", "pencil"];
    if (plan.cutList.length) t.push("saw");
    if (round || curved) t.push("jigsaw");
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
  const said = headerFeatures(project);
  if (said.length) y += textBlock(said.join(" · "), L, y, W, 12, "bold") + 4;
  y += textBlock(envelope, L, y, W, 13, "normal", KIT.muted, 16) + 6;
  // Only a build that is really ¾" plywood needs the "species = finish" disclaimer; named solid boards are the species.
  const onPly = project.panels.some((p) => /^plywood-3-4/i.test(p.materialId ?? ""));
  const speciesTalk = onPly ? speciesStockHonestyTalk(project.prompt ?? "", '3/4" plywood') : null;
  if (speciesTalk) y += textBlock(speciesTalk, L, y, W, 9, "italic", KIT.muted) + 2;
  const heroH = Math.max(250, 470 - y + 72);
  const hero: Frame = { x: L, y: y + 6, w: W, h: heroH };
  doc.setFillColor(...KIT.paper);
  doc.roundedRect(hero.x, hero.y, hero.w, hero.h, 6, 6, "F");
  renderProject(doc, project, hero, { tones: allTones("built"), dims: true, assumedAxes: sizing.assumed, pad: 30 });
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
  // The plan's own words name the build as the engine stamped it ("File cabinet 30" x 24" x 30"", W × H × D): on
  // the page that name is the header's, in its order (one size source, Critic #93).
  const named = (t: string) => {
    const raw = clean(project.name);
    return raw && raw !== headerName(project) ? t.split(raw).join(title) : t;
  };
  const checkLead = named(clean(plan.feasibility.summary));
  if (checkLead) y += textBlock(checkLead, L, y, W, 10.5) + 6;
  for (const issue of plan.feasibility.issues) {
    const tag = issue.severity === "critical" ? "Stop and fix: " : issue.severity === "warning" ? "Note: " : "";
    const message = named(clean(issue.message));
    const h1 = wrap(`${tag}${message}`, W - 14, 10).length * 13.5 + (issue.suggestion ? wrap(issue.suggestion, W - 14, 9).length * 12.5 : 0) + 8;
    if (h1 > room()) newPage("Before you start");
    doc.setFillColor(...(issue.severity === "critical" ? KIT.accent : KIT.rule));
    doc.rect(L, y + 2, 3, h1 - 8, "F");
    y += textBlock(`${tag}${message}`, L + 12, y, W - 14, 10);
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
    // "2 boxes (50 ct each)": the count inside wraps under the quantity, never into the item column.
    const qtyText = `${b.quantity} ${b.unit}`;
    const qtyLines = wrap(qtyText, qtyW - 8, 10, "bold").length > 1 && /\s\(/.test(qtyText)
      ? qtyText.split(/\s(?=\()/).flatMap((part) => wrap(part, qtyW - 8, 10, "bold"))
      : wrap(qtyText, qtyW - 8, 10, "bold");
    const h = Math.max(nameLines.length * 13 + noteLines.length * 11, qtyLines.length * 13) + 10;
    if (h > room()) {
      newPage("Before you start");
    }
    font(10, "bold");
    qtyLines.forEach((ln, i) => doc.text(ln, L, y + 12 + i * 13));
    nameLines.forEach((ln, i) => doc.text(ln, L + qtyW, y + 12 + i * 13));
    // Clickable item name → best offer, through the same outbound door as the site. Only once an
    // affiliate ID is live, so the inert PDF stays exactly as it was.
    const bestOffer = b.offers?.find((o) => o.best) ?? b.offers?.[0];
    if (affOn && bestOffer?.href) doc.link(L + qtyW, y + 2, nameW - 10, nameLines.length * 13, { url: outboundHref(bestOffer.href, aff) });
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
  if (plan.totals.estCostUsd) y += textBlock(`About ${usd(plan.totals.estCostUsd)} all-in, pricing each item at its cheapest same-size listing for the amount you need, any store.`, L, y, W, 9, "normal", KIT.muted) + 8;
  if (affOn) y += textBlock(affiliateDisclosure(aff), L, y, W, 8.5, "italic", KIT.muted) + 8;
  // Buy-list QR: scan to open the same one-click Amazon "Buy this list" cart as the site
  // (tagged through the same affiliate config). Drawn locally; only when the list has Amazon rows.
  const cart = buyListCart(plan.bom, aff);
  if (cart.href) {
    const qs = 84;
    if (room() < qs + 16) newPage("Before you start");
    drawQr(doc, cart.href, L, y, qs);
    doc.link(L, y, qs, qs, { url: cart.href });
    font(9.5, "bold");
    doc.text("Scan to buy this list", L + qs + 12, y + 30);
    font(8.5, "normal", KIT.muted);
    doc.text(`Opens an Amazon cart with ${cart.lines.length} of the items above.${cart.perRow.length ? " Get the rest locally." : ""}`, L + qs + 12, y + 44);
    y += qs + 10;
  }
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
      pdfCutListIntro(plan, craft),
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
    // The same sheets Buy counted (one nest per plan): structural sheets, then the thin backer's
    // own sheets. Named solid boards are never on a sheet — they get board diagrams below.
    const planNest = plan.sheetNest ?? planSheetNest(partLines);
    const sheets: NestSheet[] = [...(planNest.sheets?.sheets ?? [])];
    for (const s of planNest.backer?.sheets ?? []) {
      const thick = partLines.find((c) => s.parts.some((p) => p.label && p.label === c.label))?.thicknessIn ?? 0.25;
      sheets.push({ ...s, index: sheets.length + 1, material: `${frac(thick)} plywood` });
    }
    const thin = partLines.filter((c) => !c.whole && (c.thicknessIn ?? 0.75) < 0.5);
    const nested = new Set(sheets.flatMap((s) => s.parts.map((p) => p.label)));
    const boards = partLines.filter((c) => !c.whole && !nested.has(c.label) && !(thin.includes(c)));
    const blocks: { h: number; draw: (top: number) => void }[] = [];
    for (const s of sheets) {
      const sc = Math.min(W / s.width, 196 / s.height);
      const h = s.height * sc + 70;
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
  const tallBuild = projectAspect(project) < 1.3;
  const stepParts = planStepParts(project, plan.instructions, letters);
  // Same placement records as the step words — arrows on the pictures read the same numbers.
  const placements = stepPlacements(project, plan.instructions, plan.cutList, plan.partsKind === "whole");
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
  steps.forEach((s, si) => {
    const sp = stepParts[si];
    const ids = sp.ids;
    const kind = sp.kind;
    const tones = new Map<string, Tone>();
    const hotIds: string[] = [];
    let refIds: string[] = [];
    // One tone rule for the drawer, print preview and PDF (planStepPicture.stepTones).
    const pic = kind === "cut" ? null : stepTones(project, plan, si, letters);
    if (pic) for (const [id, t] of pic.tones) tones.set(id, t);
    if (kind === "build") {
      for (const [id, t] of tones) if (t === "hot") hotIds.push(id);
      // Grey "to" bubbles only when the step adds something onto them.
      if (hotIds.length) refIds = sp.onto;
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
    const refLetters = [...new Set(refIds.map((id) => letters.get(id)).filter((x): x is string => !!x && !counts.has(x)))].sort();
    const cutLines =
      kind === "cut"
        ? (() => {
            const want = new Set(ids.map((id) => letters.get(id)).filter(Boolean) as string[]);
            const all = (s.partsUsed ?? []).includes("*") || !want.size;
            return partLines.filter((c) => all || want.has(c.label ?? ""));
          })()
        : [];
    // The cut plate already shows letter, count, and name. A second chip row collides with it.
    const chips = hwChips(s);
    const side = tallBuild && kind !== "cut";
    const picW = side ? Math.round(W * 0.5) : W;
    const tx = side ? L + picW + GRID.gutter : L;
    const bodyW = side ? R - tx : W;
    const sents = sentences(s.description);
    const sentLines = sents.map((t) => wrap(t, bodyW - 14, 10.5));
    const tipLines = s.tips ? wrap(`Tip: ${s.tips}`, bodyW - 14, 9.5, "italic") : [];
    const textH = sentLines.reduce((a, l) => a + l.length * 14 + 3, 0) + (tipLines.length ? tipLines.length * 13 + 6 : 0);
    const calloutRows = side ? Math.ceil((counts.size + chips.length + (refLetters.length ? refLetters.length / 2 + 0.5 : 0)) / 4) : 1;
    const calloutH = counts.size || chips.length || refLetters.length ? 30 * calloutRows : 0;
    font(26, "bold", KIT.accent);
    const nw = doc.getTextWidth(String(s.step));
    const titleLines = wrap(s.title, W - nw - 16, 13, "bold");
    const headH = Math.max(34, 22 + Math.max(0, titleLines.length - 1) * 16 + 14);
    let picH = side ? 280 : 250;
    if (kind === "cut" && cutLines.length) {
      const plate = compactPlateHeight(project, cutLines, letters, picW - 20, craft);
      // Keep the whole legend on this page. Words that do not fit continue underneath.
      picH = Math.min(BOTTOM - TOP - headH - 96, Math.max(120, plate + 22));
    }
    const bodyH = (h: number) => (side ? Math.max(h, calloutH + textH) : h + 8 + calloutH + textH);
    let need = headH + bodyH(picH) + 16;
    if (kind !== "cut" && need > BOTTOM - TOP) {
      picH = Math.max(150, picH - (need - (BOTTOM - TOP)));
      need = headH + bodyH(picH) + 16;
    }
    // A step taller than one page still starts here — do not insert a blank page first.
    if (Math.min(need, BOTTOM - TOP) > room() + 1) newPage("Build");
    const top = y;
    const pageOfStep = doc.getNumberOfPages();
    // Step header
    font(26, "bold", KIT.accent);
    doc.text(String(s.step), L, top + 24);
    font(13, "bold");
    titleLines.forEach((ln, i) => doc.text(ln, L + nw + 12, top + 22 + i * 16));
    y = top + headH;
    // Picture
    const frame: Frame = { x: L, y, w: picW, h: picH };
    doc.setFillColor(...KIT.paper);
    doc.roundedRect(frame.x, frame.y, frame.w, frame.h, 6, 6, "F");
    if (kind === "cut") {
      drawPartsPlate(doc, project, cutLines, letters, { x: frame.x + 10, y: frame.y + 8, w: frame.w - 20, h: frame.h - 14 }, craft, true);
    } else if (kind === "prep") {
      renderProject(doc, project, frame, { tones, dims: true, assumedAxes: sizing.assumed, pad: 26 });
    } else {
      renderProject(doc, project, frame, { tones, fitIds: allIds, letters, pad: 26, measures: placements[si]?.arrows });
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
      if (refLetters.length) {
        // Parts already built that this step joins onto: grey bubbles after a small "to".
        font(9, "normal", KIT.muted);
        const tw0 = doc.getTextWidth("to") + 6;
        wrapRow(tw0 + refLetters.length * 22);
        doc.text("to", cx, cy + 15);
        cx += tw0;
        for (const Lt of refLetters) {
          drawBubble(doc, cx + 9, cy + 11, Lt, 8.5, true);
          cx += 22;
        }
        cx += 8;
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
    // Words: one short sentence per line. A step that runs past the footer continues on the next page.
    const spill = () => {
      newPage("Build");
      font(26, "bold", KIT.accent);
      doc.text(String(s.step), L, y + 24);
      font(13, "bold");
      titleLines.forEach((ln, i) => doc.text(ln, L + nw + 12, y + 22 + i * 16));
      font(10, "italic", KIT.muted);
      doc.text("continued", L + nw + 12, y + 22 + titleLines.length * 16);
      y += 30 + titleLines.length * 16 + 12;
    };
    let sentAt = 0;
    let tipDone = tipLines.length === 0;
    let spills = 0;
    while ((sentAt < sentLines.length || !tipDone) && spills < 8) {
      if (sentAt < sentLines.length) {
        const h = sentLines[sentAt].length * 14 + 3;
        if (y + h > BOTTOM && y > TOP + 48) {
          spills++;
          spill();
          continue;
        }
        const lines = sentLines[sentAt];
        doc.setFillColor(...KIT.accent);
        doc.circle(tx + 3, y + 7, 1.8, "F");
        font(10.5, "normal");
        lines.forEach((ln, i) => doc.text(ln, tx + 12, y + 10.5 + i * 14));
        y += lines.length * 14 + 3;
        sentAt++;
        continue;
      }
      const th = tipLines.length * 13 + 6;
      if (y + th > BOTTOM && y > TOP + 48) {
        spills++;
        spill();
        continue;
      }
      y += 3;
      doc.setFillColor(...KIT.accentSoft);
      doc.rect(tx, y, 3, tipLines.length * 13, "F");
      font(9.5, "italic", KIT.muted);
      tipLines.forEach((ln, i) => doc.text(ln, tx + 12, y + 9.5 + i * 13));
      y += tipLines.length * 13 + 3;
      tipDone = true;
    }
    if (doc.getNumberOfPages() === pageOfStep) y = Math.max(y, Math.min(top + need - 10, BOTTOM)) + 10;
    else y += 10;
    if (room() > 60) {
      doc.setDrawColor(...KIT.rule);
      doc.setLineWidth(0.5);
      doc.line(L, y - 6, R, y - 6);
    }
  });

  // ═════════════════════════ CHECK IT
  newPage("Check it");
  sectionTitle("Check it", "Run every test before you load it or hand it over.");
  const finish: Frame = { x: L, y, w: W, h: 200 };
  doc.setFillColor(...KIT.paper);
  doc.roundedRect(finish.x, finish.y, finish.w, finish.h, 6, 6, "F");
  renderProject(doc, project, finish, { tones: allTones("built"), dims: true, assumedAxes: sizing.assumed, pad: 22 });
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
  const glossary = craft ? CRAFT_GLOSSARY : glossaryForPlan(`${project.prompt ?? ""} ${project.name}`, SHOP_GLOSSARY, project.panels.map((p) => `${p.name} ${p.type}`).join(" "));
  if (glossary.length) {
    const colW = (W - GRID.gutter) / 2;
    const itemH = (g: { def: string }) => 12 + wrap(g.def, colW, 8.5).length * 11 + 6;
    const glossH = 30 + glossary.reduce((a, g) => a + itemH(g), 0) / 2 + 12;
    // Share the Check it page when the words fit, or when at least a solid block fits and the rest
    // carries on with a "continued" heading. Never leave a page holding only a word or two.
    const firstFits = (() => {
      let a = 0;
      let b = 0;
      let n = 0;
      for (const g of glossary) {
        const h = itemH(g);
        if (a <= b && y + 18 + 22 + a + h <= BOTTOM) a += h;
        else if (y + 18 + 22 + b + h <= BOTTOM) b += h;
        else break;
        n++;
      }
      return n;
    })();
    const share = room() >= glossH + 18 || (firstFits >= 6 && glossary.length - firstFits >= 4);
    if (!share) newPage("Shop words");
    else {
      y += 18;
      sections[sections.length - 1] = "Check it · Shop words";
    }
    subTitle("Shop words");
    let colY = [y, y];
    glossary.forEach((g) => {
      let c = colY[0] <= colY[1] ? 0 : 1;
      const x0 = () => L + c * (colW + GRID.gutter);
      const def = wrap(g.def, colW, 8.5);
      const h = 12 + def.length * 11 + 6;
      if (colY[c] + h > BOTTOM) {
        if (colY[1 - c] + h <= BOTTOM) c = 1 - c;
        else {
          newPage("Shop words");
          subTitle("Shop words (continued)");
          colY = [y, y];
          c = 0;
        }
      }
      const x = x0();
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
    const sec = (sections[i - 1] || "").toUpperCase();
    font(8, "normal", KIT.muted);
    const room0 = W - doc.getTextWidth(sec) - 24;
    font(8, "bold", KIT.muted);
    // Running header: honest title, plus the assumed axes so no page reads them as typed.
    // The title already marks the assumed axes ("(W, D assumed)"), so no page reads them as typed.
    let head = title.toUpperCase();
    if (doc.getTextWidth(head) > room0) head = title.replace(/ · .*$/, "").toUpperCase();
    while (head.length > 8 && doc.getTextWidth(head) > room0) head = `${head.slice(0, -4).trimEnd()}...`;
    doc.text(head, L, 40);
    font(8, "normal", KIT.muted);
    doc.text(sec, R, 40, { align: "right" });
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
    if (affOn) doc.text(affiliateDisclosure(aff), L, pageH - 18);
    font(8, "bold", KIT.ink);
    doc.text(`${i} / ${pages}`, R, pageH - 28, { align: "right" });
  }
  return doc;
}

// ───────────────────────── parts plate ─────────────────────────

type PlateItem = { c: CutLine; sh: Shape2D };

/** Largest scale that fits the box. Pass maxScale to measure a legend (small swatches); drawing fits the box it is given. */
function arrangePlate(items: PlateItem[], boxW: number, boxH: number, craft: boolean, compact: boolean, maxScale?: number) {
  const labelH = compact ? 26 : 32;
  let gap = compact ? 12 : 18;
  const textW = compact ? 92 : 118;
  const layout = (s: number) => {
    const rows: { items: { c: CutLine; sh: Shape2D; x: number; w: number; h: number }[]; h: number }[] = [];
    let row: (typeof rows)[number] = { items: [], h: 0 };
    let x = 0;
    for (const it of items) {
      const w = Math.max(it.sh.w * s, 3);
      const h = Math.max(it.sh.h * s, 3);
      const cell = Math.max(w, textW);
      if (x > 0 && x + cell > boxW) {
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
    const wide = items.length ? Math.max(...items.map((it) => it.sh.w * s)) : 0;
    return { rows, total, ok: total <= boxH - (compact ? 0 : 24) && wide <= boxW };
  };
  if (!items.length) return { s: 1, rows: [], total: 0, ok: true, labelH, gap, textW };
  let s = 72;
  if (!(craft && layout(72).ok)) {
    let hi = compact ? 30 : 72;
    if (maxScale != null) hi = Math.min(hi, maxScale);
    let lo = hi < 0.2 ? hi * 0.25 : 0.2;
    if (hi < lo) hi = lo;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      if (layout(mid).ok) lo = mid;
      else hi = mid;
    }
    s = lo;
  }
  return { s, labelH, gap, textW, ...layout(s) };
}

function compactPlateHeight(project: YardProject, lines: CutLine[], letters: Map<string, string>, width: number, craft: boolean) {
  const items = lines.map((c) => ({ c, sh: partShape(project, c, letters) }));
  items.sort((a, b) => b.sh.w * b.sh.h - a.sh.w * a.sh.h);
  const maxDim = Math.max(1, ...items.map((it) => Math.max(it.sh.w, it.sh.h)));
  // Legend scale: the longest edge is about 18pt, so 21 parts stay a grid instead of one giant row.
  return arrangePlate(items, width, 4000, craft, true, Math.min(30, 18 / maxDim)).total;
}

export function drawPartsPlate(
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
  const { s, rows, labelH, gap, textW } = arrangePlate(items, box.w, box.h, craft, compact);
  let y = box.y;
  for (const r of rows) {
    // Never paint a row past the frame — a short box clips instead of running into the words below.
    if (compact && y + r.h > box.y + box.h + 0.5) break;
    for (const it of r.items) {
      const x = box.x + it.x;
      const cy = y + (r.h - labelH - it.h) / 2;
      if (craft && !it.sh.circle && !it.sh.holes?.length && it.sh.pts.length === 4) {
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
  // Room under the sheet heading so the overall width label never crowds it.
  const y0 = top + 40;
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
    const roomy = big || (pw > 60 && ph > 34);
    const bubbled = Math.min(pw, ph) > 14;
    const sized = `${frac(p.width)} x ${frac(p.height)}`;
    // Small parts: move the bubble to one end so the size fits beside it.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    const tw6 = doc.getTextWidth(sized);
    const slide = !roomy && bubbled ? (pw >= ph ? (tw6 < pw - 19 ? "left" : "") : tw6 < ph - 22 ? "top" : "") : "";
    const bx = slide === "left" ? px + 9 : px + pw / 2;
    const by = slide === "top" ? py + 10 : py + ph / 2 - (big ? 6 : 0);
    if (bubbled) drawBubble(doc, bx, by, p.label ?? "?", big ? 8.5 : 6.5);
    if (roomy) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...KIT.ink);
      const tw = doc.getTextWidth(sized);
      const cy = by;
      if (tw < pw - 4) doc.text(sized, px + pw / 2, py + ph / 2 + (big ? 13 : 10), { align: "center" });
      // Tall narrow part: run the size down the part under its bubble.
      else if (ph > pw && cy + 12 + tw < py + ph - 2) doc.text(sized, px + pw / 2 + 2.5, cy + 12 + tw, { angle: 90 });
      // …or beside the bubble when the part is too short below it.
      else if (ph > pw && pw / 2 >= 20 && tw < ph - 6) doc.text(sized, px + pw / 2 + 14, py + ph / 2 + tw / 2, { angle: 90 });
    } else {
      // Tiny parts still carry their size (and their letter when there is no room for a bubble).
      doc.setFont("helvetica", bubbled ? "normal" : "bold");
      doc.setFontSize(6);
      doc.setTextColor(...KIT.ink);
      if (slide === "left") doc.text(sized, px + 17, py + ph / 2 + 2);
      else if (slide === "top") doc.text(sized, px + pw / 2 + 2, py + 20 + tw6, { angle: 90 });
      else if (!bubbled) {
        const t = `${p.label ?? "?"}  ${sized}`;
        const tw = doc.getTextWidth(t);
        if (pw >= ph && tw < pw - 4 && ph >= 6) doc.text(t, px + pw / 2, py + ph / 2 + 2, { align: "center" });
        else if (ph > pw && tw < ph - 4 && pw >= 6) doc.text(t, px + pw / 2 + 2, py + ph / 2 + tw / 2, { angle: 90 });
      }
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

export { planStepParts, stepKindOf };

/**
 * The header everywhere a size shows: the name without its bare size, then the finished size with every
 * axis labelled in one order, W × D × H, and the axes nobody typed marked assumed.
 */
/** What a refused build's header says after the thing asked for: no size, no count, no fallback family. */
export const NOTHING_BUILT_HEADER = "nothing built";
export function headerTitle(project: YardProject, opts: { features?: boolean } = {}): string {
  // A refused build names what was asked for and says nothing was built: never a size it didn't build, never a fallback.
  if (project.refused && !project.panels.length) return `${clean(project.name).trim() || "Yard plan"} · ${NOTHING_BUILT_HEADER}`;
  return [`${headerName(project)} · ${headerAxes(project)}`, ...(opts.features === false ? [] : headerFeatures(project))].join(" · ");
}

/** The build's name without its bare typed size ("File cabinet 30" x 24" x 30"" → "File cabinet"). */
export function headerName(project: YardProject): string {
  return clean(project.name).replace(/\s+[\d\s./'"″′]*\d[\d\s./'"″′]*(?:[×x]\s*[\d\s./'"″′]+)+$/, "").trim() || "Yard plan";
}

/** The one size in one order: `31 1/2" W × 16" D × 78" H`, axes nobody typed marked assumed. Header, bench, PDF. */
export function headerAxes(project: YardProject): string {
  const { assumed } = typedAxesTalk(project);
  // One size (headerSize): a typed axis is the size said back (the linen closet's 16″, doors standing proud are
  // a note); an assumed axis is the model's own extent, the number the drawings label.
  const { width: W, depth: d, height: H } = headerSize(project);
  const axes = [["W", W, "width"], ["D", d, "depth"], ["H", H, "height"]] as const;
  const guess = axes.filter(([, , a]) => assumed[a]).map(([l]) => l);
  // C3: a purchased item's size is the unit table's real piece, never an assumption.
  if (isUnitItem(project)) guess.length = 0;
  const mark = guess.length === 3 ? " (size assumed)" : guess.length ? ` (${guess.join(", ")} assumed)` : "";
  return `${axes.map(([l, v]) => `${frac(v)} ${l}`).join(" × ")}${mark}`;
}

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };

/**
 * The counts and features the prompt asked for, said back only as the model builds them: "12 bottles",
 * "4 hooks", "3 shelves", "cubbies", "with rod". A count is the model's own count, never the typed word.
 */
export function headerFeatures(project: YardProject): string[] {
  const lower = (project.typedPrompt ?? project.prompt ?? "").toLowerCase();
  const names = project.panels.map((p) => p.name.replace(/\s*\d+$/, "").toLowerCase());
  const count = (re: RegExp) => names.filter((n) => re.test(n)).length;
  const typed = (noun: string) => new RegExp(String.raw`\b(?:\d+|${Object.keys(NUM).join("|")}|with|and|plus)\b[\w\s-]{0,12}\b${noun}`).test(lower) || new RegExp(String.raw`\b${noun}`).test(lower);
  const out: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (/\bbottles?\b/.test(lower)) {
    const held = (project.notes ?? []).map((n) => n.match(/\bHolds (\d+) bottles\b/)?.[1]).find(Boolean);
    if (held) out.push(`${held} bottles`);
  }
  if (typed("hooks?\\b")) { const n = count(/\bhook\b/); if (n) out.push(plural(n, "hook", "hooks")); }
  if (typed("shel(?:f|ves)\\b") || /\bisland\b/.test(lower)) {
    const shelves = project.panels.filter((p) => /^(?:grid |adjustable |fixed |inner )?shelf$/i.test(p.name.replace(/\s*\d+$/, "")));
    const n = shelfLineCount(shelves);
    if (n) out.push(plural(n, "shelf", "shelves"));
  }
  if (typed("cubb(?:y|ies)\\b")) {
    // Cubbies said back as the model's own count: dividers split the run into dividers + 1 openings.
    const dividers = count(/^cubby divider$/);
    if (dividers) out.push(plural(dividers + 1, "cubby", "cubbies"));
    else if (count(/cubby/)) out.push("cubbies");
  }
  if (typed("(?:hanging )?(?:rod|bar)\\b") && count(/\b(?:rod|hanging bar|closet rod)\b/)) out.push("with rod");
  if (/\btrapezoid/.test(lower) && /trapezoid/i.test(`${project.name} ${(project.notes ?? []).join(" ")}`)) out.push("trapezoid");
  return out;
}
