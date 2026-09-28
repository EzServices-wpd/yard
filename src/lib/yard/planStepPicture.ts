/**
 * One picture path for every plan step: the same renderProject / parts-plate drawing the PDF uses,
 * recorded into SVG for the plan drawer and print preview. No JPEG photos, no IsoPlate crop.
 */
import type { jsPDF } from "jspdf";
import { planStepParts } from "./stepParts";
import { stepPlacements } from "./placement";
import { partLetters, renderProject, type Frame, type Tone } from "./pdfDraw";
import { drawPartsPlate } from "./pdf";
import { KIT, clean } from "./pdfKit";
import { cutListName } from "./shopPlural";
import { SvgDoc, type SvgDocStats } from "./svgDoc";
import type { BuildPlan, YardProject } from "./types";

function asPdf(doc: SvgDoc): jsPDF {
  return doc as unknown as jsPDF;
}

function allIds(project: YardProject) {
  return [...project.panels.map((p) => p.id), ...project.instances.map((i) => i.id)];
}

function allTones(project: YardProject, tone: Tone) {
  return new Map<string, Tone>(allIds(project).map((id) => [id, tone]));
}

export type StepPicture = { svg: string; stats: SvgDocStats; kind: string };

/** Build tones the same way buildPlanPdf does for a build step. */
export function stepTones(
  project: YardProject,
  plan: BuildPlan,
  stepIndex: number,
  letters: Map<string, string>,
): {
  kind: string;
  tones: Map<string, Tone>;
  cutLines: BuildPlan["cutList"];
  measures?: NonNullable<ReturnType<typeof stepPlacements>[number]>["arrows"];
} {
  const steps = plan.instructions;
  const stepParts = planStepParts(project, steps, letters);
  const placements = stepPlacements(project, steps, plan.cutList, plan.partsKind === "whole");
  const placed = new Set<string>();
  for (let i = 0; i < stepIndex; i++) {
    const sp = stepParts[i];
    if (sp.kind !== "build") continue;
    const drawn = sp.said ? [...placed, ...sp.fresh, ...sp.onto] : [...placed, ...sp.ids];
    drawn.forEach((id) => placed.add(id));
  }
  const s = steps[stepIndex];
  const sp = stepParts[stepIndex];
  const kind = sp.kind;
  if (kind === "cut") {
    const want = new Set(sp.ids.map((id) => letters.get(id)).filter(Boolean) as string[]);
    const all = (s.partsUsed ?? []).includes("*") || !want.size;
    const cutLines = plan.cutList.filter((c) => all || want.has(c.label ?? ""));
    return { kind, tones: new Map(), cutLines };
  }
  if (kind === "prep") {
    return { kind, tones: allTones(project, "built"), cutLines: [] };
  }
  const tones = new Map<string, Tone>();
  let hot = sp.fresh;
  if (!sp.said && !hot.length) {
    const t = clean(s.title).toLowerCase();
    hot = sp.ids.filter((id) => {
      const p = project.panels.find((q) => q.id === id);
      if (!p) return false;
      const fam = cutListName(p.name, p.type).toLowerCase();
      return t.includes(fam) || t.includes(p.name.toLowerCase());
    });
  }
  const drawn = sp.said ? new Set([...placed, ...sp.fresh, ...sp.onto]) : new Set([...placed, ...sp.ids]);
  for (const id of drawn) tones.set(id, "ghost");
  for (const id of hot) tones.set(id, "hot");
  if (!hot.length) for (const id of tones.keys()) tones.set(id, "built");
  return { kind, tones, cutLines: [], measures: placements[stepIndex]?.arrows };
}

/** Draw one plan step into an SvgDoc (shared with the PDF's renderProject path). */
export function drawPlanStep(
  doc: SvgDoc,
  project: YardProject,
  plan: BuildPlan,
  stepIndex: number,
  frame: Frame,
) {
  const letters = partLetters(project, plan.cutList);
  const craft = plan.partsKind === "whole" || (project.instances.length > 0 && project.panels.length === 0);
  const pic = stepTones(project, plan, stepIndex, letters);
  doc.setFillColor(...KIT.paper);
  doc.roundedRect(frame.x, frame.y, frame.w, frame.h, 6, 6, "F");
  // Framing stats count model ink only — not the paper fill.
  doc.stats = { ops: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  if (pic.kind === "cut") {
    drawPartsPlate(
      asPdf(doc),
      project,
      pic.cutLines,
      letters,
      { x: frame.x + 10, y: frame.y + 8, w: frame.w - 20, h: frame.h - 14 },
      craft,
      true,
    );
    return;
  }
  if (pic.kind === "prep") {
    renderProject(asPdf(doc), project, frame, { tones: pic.tones, dims: true, pad: 26 });
    return;
  }
  renderProject(asPdf(doc), project, frame, {
    tones: pic.tones,
    fitIds: allIds(project),
    letters,
    pad: 26,
    measures: pic.measures,
  });
}

export function planStepSvg(
  project: YardProject,
  plan: BuildPlan,
  stepIndex: number,
  w = 480,
  h = 270,
): StepPicture {
  const doc = new SvgDoc(w, h);
  const frame: Frame = { x: 0, y: 0, w, h };
  const pic = stepTones(project, plan, stepIndex, partLetters(project, plan.cutList));
  drawPlanStep(doc, project, plan, stepIndex, frame);
  return { svg: doc.toSvg(KIT.paper), stats: doc.stats, kind: pic.kind };
}

/** Finished piece overview — same vector path the PDF hero uses. */
export function planOverviewSvg(project: YardProject, w = 480, h = 300): StepPicture {
  const doc = new SvgDoc(w, h);
  const frame: Frame = { x: 0, y: 0, w, h };
  doc.setFillColor(...KIT.paper);
  doc.roundedRect(frame.x, frame.y, frame.w, frame.h, 6, 6, "F");
  doc.stats = { ops: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  renderProject(asPdf(doc), project, frame, {
    tones: allTones(project, "built"),
    dims: true,
    pad: 30,
  });
  return { svg: doc.toSvg(KIT.paper), stats: doc.stats, kind: "overview" };
}

/** Guard helper: picture must draw something and fill most of the frame. */
export function pictureFramed(
  stats: SvgDocStats,
  frame: Frame,
  minFill = 0.22,
): { ok: boolean; fill: number; ops: number } {
  if (stats.ops < 2 || !Number.isFinite(stats.minX)) return { ok: false, fill: 0, ops: stats.ops };
  const bw = Math.max(0, stats.maxX - stats.minX);
  const bh = Math.max(0, stats.maxY - stats.minY);
  const fill = Math.max(bw / Math.max(frame.w, 1), bh / Math.max(frame.h, 1));
  // Dim chips and letter bubbles may sit a few points past the pad; allow a small overhang.
  const margin = 28;
  const inside =
    stats.minX >= frame.x - margin &&
    stats.minY >= frame.y - margin &&
    stats.maxX <= frame.x + frame.w + margin &&
    stats.maxY <= frame.y + frame.h + margin;
  return { ok: inside && fill >= minFill && stats.ops >= 2, fill, ops: stats.ops };
}
