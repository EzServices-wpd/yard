"use client";

import { useMemo } from "react";
import { partLetters, renderProject, type Frame, type Tone } from "@/lib/yard/pdfDraw";
import { KIT } from "@/lib/yard/pdfKit";
import { inchFrac } from "@/lib/yard/inchText";
import { SvgDoc } from "@/lib/yard/svgDoc";
import type { jsPDF } from "jspdf";
import type { BuildPlan, CutLine, YardProject } from "@/lib/yard/types";

/**
 * A cut-list part's own drawing, from the live vector renderer (the PDF / plan-plate path, every part a
 * <g data-part>), not the baked Ideas pictures: (1) in place, the row's parts hot over the rest ghosted, with its
 * letter; (2) alone, one of its parts with that part's own dimension lines (sheet builds; stick builds draw no dims).
 * Props and the scale figure are not project solids, so they never reach either picture.
 */
const W = 240;
const H = 180;
// The alone picture draws on a smaller sheet, so at 390 its size labels read ~8.5 px instead of ~6 px.
const AW = 180;
const AH = 135;

type PartPictures = { place: string; alone: string };

// One render per (build, row): a big house build is 80+ parts a picture, so a re-render or a re-tap reuses it.
const cache = new WeakMap<YardProject, Map<string, PartPictures>>();

function picture(project: YardProject, tones: Map<string, Tone>, opts: { fitIds?: string[]; letters?: Map<string, string>; dims?: boolean }, w = W, h = H) {
  const doc = new SvgDoc(w, h);
  const frame: Frame = { x: 0, y: 0, w, h };
  doc.setFillColor(...KIT.paper);
  doc.roundedRect(0, 0, w, h, 6, 6, "F");
  renderProject(doc as unknown as jsPDF, project, frame, {
    tones,
    pad: opts.dims ? 16 : 22,
    partGroup: (id) => ({ "data-part": id }),
    ...opts,
  });
  return doc.toSvg(KIT.paper);
}

function partPictures(project: YardProject, plan: BuildPlan, row: CutLine): PartPictures | null {
  const want = new Set(row.partIds ?? []);
  const all = [...project.panels.map((p) => p.id), ...project.instances.map((i) => i.id)];
  const ids = all.filter((id) => want.has(id));
  if (!ids.length) return null;
  let byRow = cache.get(project);
  if (!byRow) cache.set(project, (byRow = new Map()));
  const hit = byRow.get(row.id);
  if (hit) return hit;
  const hot = new Set(ids);
  const place = picture(project, new Map(all.map((id) => [id, hot.has(id) ? "hot" : "ghost"] as const)), {
    fitIds: all,
    letters: partLetters(project, plan.cutList),
  });
  // One part alone. Its lines may only say the row's own size (the numbers the cut list shows): the drawing measures a
  // part's 3D box, which differs for an angled, round, spliced or doubled part, so then it is drawn with no lines.
  const want3 = [row.lengthIn, row.widthIn, row.thicknessIn ?? 0.75].map((v) => `${inchFrac(v)}"`).sort().join("|");
  const labels = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)</g)].map((m) => m[1].replace(/&quot;/g, '"')).sort().join("|");
  const one = (id: string, dims: boolean) => picture(project, new Map([[id, "built" as Tone]]), { dims }, AW, AH);
  const alone = ids.slice(0, 4).map((id) => one(id, true)).find((svg) => labels(svg) === want3) ?? one(ids[0], false);
  const out = { place, alone };
  byRow.set(row.id, out);
  return out;
}

/** Under the active cut-list row: decorative (the row already names the part), fixed box so the drawer never jumps. */
export function PartDrawing({ project, plan, row }: { project: YardProject; plan: BuildPlan; row: CutLine }) {
  const pics = useMemo(() => partPictures(project, plan, row), [project, plan, row]);
  if (!pics) return null;
  const frame = "block aspect-[4/3] w-full overflow-hidden rounded border border-rule bg-paper [&>svg]:h-full [&>svg]:w-full";
  return (
    <div aria-hidden="true" data-yard-part-drawing={row.partIds?.join(" ")} className="grid grid-cols-2 gap-2 py-2 print:hidden">
      {/* SVG is built from our own geometry, never from user HTML. */}
      <span className={frame} data-yard-part-pic="place" dangerouslySetInnerHTML={{ __html: pics.place }} />
      <span className={frame} data-yard-part-pic="alone" dangerouslySetInnerHTML={{ __html: pics.alone }} />
    </div>
  );
}

/** The drawing row for one cut-list row: only the active one, and only when it carries model part ids. */
export function CutRowDrawing({ project, plan, row, active }: { project: YardProject; plan: BuildPlan; row: CutLine; active: boolean }) {
  if (!active || !row.partIds?.length) return null;
  return (
    <tr data-yard-part-row={row.label ?? undefined}>
      <td colSpan={4} className="p-0">
        <PartDrawing project={project} plan={plan} row={row} />
      </td>
    </tr>
  );
}
