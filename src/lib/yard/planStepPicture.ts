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
import type { AssemblyStep, BuildPlan, Panel, YardProject } from "./types";
import { getCatalogItem } from "./catalog";
import { stockT } from "./face";

const longest = (p: Panel) => Math.max(p.size.width, p.size.height, p.size.depth);
const thinnest = (p: Panel) => (p.blank ? p.blank.thicknessIn : Math.min(p.size.width, p.size.height, p.size.depth));

/**
 * A bench step (splice, glue-up, sheet join) works on named members before they go on the build:
 * light exactly those, never the whole model and never nothing.
 */
export function benchStepHot(project: YardProject, s: AssemblyStep): string[] {
  const t = clean(s.title).toLowerCase();
  const panels = project.panels;
  if (/^splice the long members\b/.test(t)) {
    return panels.filter((p) => { const len = getCatalogItem(p.materialId)?.dims.length; return /^lumber-/.test(p.materialId) && !!len && longest(p) > len + 0.01; }).map((p) => p.id);
  }
  if (/^glue up the thick parts\b/.test(t)) {
    return panels.filter((p) => /^(?:plywood|lumber)-/.test(p.materialId) && thinnest(p) > stockT(p.materialId) + 0.05).map((p) => p.id);
  }
  if (/^join sheet splices\b/.test(t)) {
    return panels.filter((p) => { const d = [p.size.width, p.size.height, p.size.depth].sort((a, b) => a - b); return /^plywood-/.test(p.materialId) && (d[1] > 48.01 || d[2] > 120.01); }).map((p) => p.id);
  }
  return [];
}

/** "Level it" works on what stands on the floor: light the feet, posts and legs, not every part. */
export function levelStepHot(project: YardProject, s: AssemblyStep, ids: string[]): string[] {
  if (!/^level it\b/i.test(clean(s.title))) return [];
  const want = new Set(ids);
  return project.panels.filter((p) => want.has(p.id) && p.position.y < 0.5).map((p) => p.id);
}

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
    const tones = allTones(project, "built");
    for (const id of [...benchStepHot(project, s), ...levelStepHot(project, s, allIds(project))]) tones.set(id, "hot");
    return { kind, tones, cutLines: [] };
  }
  const tones = new Map<string, Tone>();
  const level = levelStepHot(project, s, sp.ids);
  let hot = level.length ? level : sp.fresh;
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
  // A step that adds nothing new still works on its parts (fastening, squaring): highlight those, never grey everything.
  if (!hot.length) hot = sp.ids.filter((id) => tones.has(id));
  for (const id of hot) tones.set(id, "hot");
  if (!hot.length) for (const id of tones.keys()) tones.set(id, "built");
  // F12 cutaway (any build): a thin panel nearer the camera that covers a hot part's centre is cut away,
  // so a part inside a box (a roost, a nest, a shelf behind a side) is seen, not hidden behind the wall.
  for (const id of cutaway(project, hot, [...tones.keys()])) tones.delete(id);
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

/** Iso camera looks down (1,1,1): screen = ((x−z)·cos30, −y + (x+z)·sin30); larger x+y+z is nearer. */
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
type P2 = { x: number; y: number };
const scr = (x: number, y: number, z: number): P2 => ({ x: (x - z) * C30, y: -y + (x + z) * S30 });
function corners(p: Panel): { pts: P2[]; c: P2; depth: number } {
  const { x, y, z } = p.position, { width: w, height: h, depth: d } = p.size;
  const pts: P2[] = [];
  for (const a of [0, w]) for (const b of [0, h]) for (const e of [0, d]) pts.push(scr(x + a, y + b, z + e));
  return { pts, c: scr(x + w / 2, y + h / 2, z + d / 2), depth: x + w / 2 + y + h / 2 + z + d / 2 };
}
function hull(pts: P2[]): P2[] {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: P2, a: P2, b: P2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: P2[] = [], up: P2[] = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...s].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
function insideHull(h: P2[], q: P2): boolean {
  if (h.length < 3) return false;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    if ((b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x) < -1e-6) return false;
  }
  return true;
}
export function cutaway(project: YardProject, hot: string[], drawn: string[]): string[] {
  const hotSet = new Set(hot);
  const hp = project.panels.filter((p) => hotSet.has(p.id) && !p.polygon);
  if (!hp.length) return [];
  const out: string[] = [];
  for (const q of project.panels) {
    if (hotSet.has(q.id) || !drawn.includes(q.id) || q.polygon) continue;
    if (Math.min(q.size.width, q.size.height, q.size.depth) > 1) continue; // only sheet walls and roofs, never legs or frames
    const Q = corners(q);
    const H = hull(Q.pts);
    if (hp.every((p) => { const P = corners(p); return !(Q.depth > P.depth + 0.5 && insideHull(H, P.c)); })) continue;
    out.push(q.id);
  }
  return out;
}
