/**
 * Shop rule of thumb for a clear span. Not a stamp.
 * Support goes under the surface, bearing on the frame that is already there.
 * It does not stand in the space a person sleeps, sits, or shelves into.
 */
import { createId } from "@/lib/utils";
import type { Panel, YardProject } from "./types";

export type SpanLoad = "person" | "shelf" | "surface" | "light";

export type SpanFinding = {
  panelId: string;
  name: string;
  span: number;
  thick: number;
  allow: number;
  load: SpanLoad;
  message: string;
  suggestion: string;
};

const TOL = 1.1;
/** How far a frame may hang below the deck above before it is in the sleeper. */
const FRAME = 8;
/** A shelf bay still has to hold something after an apron. */
const BAY = 6;

const BEAMS: { depth: number; stock: string }[] = [
  { depth: 3.5, stock: "lumber-2x4-8" },
  { depth: 5.5, stock: "lumber-2x6-8" },
  { depth: 7.25, stock: "lumber-2x8-8" },
  { depth: 9.25, stock: "lumber-2x10-8" },
  { depth: 11.25, stock: "lumber-2x12-8" },
];

const APRONS: { depth: number; thick: number; stock: string }[] = [
  { depth: 1.5, thick: 0.75, stock: "lumber-1x2-8" },
  { depth: 2.5, thick: 0.75, stock: "lumber-1x3-8" },
  { depth: 3.5, thick: 1.5, stock: "lumber-2x4-8" },
  { depth: 5.5, thick: 1.5, stock: "lumber-2x6-8" },
];

type Box = { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };

export function allowSpanIn(thick: number, load: SpanLoad): number {
  return Math.round(allowBeam(thick, load) * 10) / 10;
}

/** Beam capacity. No 5-foot cap — a deeper rail spans to the posts instead of growing a leg in the bed. */
function allowBeam(thick: number, load: SpanLoad): number {
  const t = Math.max(0.15, thick);
  const k = load === "person" ? 26 : load === "shelf" || load === "surface" ? 42 : 58;
  return Math.min(load === "person" ? 144 : 168, k * Math.pow(t, 0.8));
}

function beamFor(span: number, load: SpanLoad, room: number): { depth: number; stock: string } | null {
  return BEAMS.find((b) => b.depth <= room + 0.05 && allowBeam(b.depth, load) >= span) ?? null;
}

function thickLabel(t: number): string {
  const known: [number, string][] = [
    [0.25, "¼"],
    [0.375, "⅜"],
    [0.5, "½"],
    [0.75, "¾"],
    [1, "1"],
    [1.5, "1½"],
    [2.5, "2½"],
    [3.5, "3½"],
    [5.5, "5½"],
    [7.25, "7¼"],
    [9.25, "9¼"],
    [11.25, "11¼"],
  ];
  for (const [n, s] of known) if (Math.abs(t - n) < 0.06) return `${s}″`;
  return `${Math.round(t * 10) / 10}″`;
}

function loadOf(project: YardProject, panel: Panel): SpanLoad {
  const blob = `${panel.name} ${project.name} ${project.prompt}`.toLowerCase();
  if (panel.type === "deck") return "person";
  if (/seat|bench/.test(panel.name.toLowerCase())) return "person";
  if (/bunk|loft bed|platform bed|daybed|mattress/.test(blob) && /deck|bunk|platform|seat/.test(panel.name.toLowerCase())) {
    return "person";
  }
  if (panel.type === "shelf" || panel.type === "bottom" || /shelf/.test(panel.name.toLowerCase())) return "shelf";
  // A table, desk or counter top carries its own use (dishes, a monitor, elbows), not a shelf of books.
  if (panel.type === "counter" || panel.type === "top" || /desktop|\btop\b|counter/.test(panel.name.toLowerCase())) {
    return surfaceUse(project) ? "surface" : "shelf";
  }
  return "light";
}

function isFlatPlate(panel: Panel): boolean {
  if (panel.name.startsWith("Support ")) return false;
  if (!["shelf", "deck", "counter", "top", "bottom"].includes(panel.type)) return false;
  const { width: w, height: h, depth: d } = panel.size;
  const thick = Math.min(w, h, d);
  if (thick > 2 || thick < 0.15) return false;
  return Math.abs(h - thick) < 0.08;
}

function overlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

/** The volume a person actually uses. Support is not allowed in it. */
function usableBoxes(panels: Panel[], project: YardProject): Box[] {
  const boxes: Box[] = [];
  for (const p of panels) {
    if (!isFlatPlate(p) || loadOf(project, p) !== "person") continue;
    const inset = 2;
    const x0 = p.position.x + inset;
    const x1 = p.position.x + p.size.width - inset;
    const z0 = p.position.z + inset;
    const z1 = p.position.z + p.size.depth - inset;
    if (x1 - x0 < 8 || z1 - z0 < 8) continue;
    const top = p.position.y + p.size.height;
    let y1 = top + 36;
    for (const q of panels) {
      if (q === p || !isFlatPlate(q) || q.position.y < top + 4) continue;
      const ox = overlap(x0, x1, q.position.x, q.position.x + q.size.width);
      const oz = overlap(z0, z1, q.position.z, q.position.z + q.size.depth);
      if (ox > 6 && oz > 6) y1 = Math.min(y1, q.position.y - FRAME);
    }
    if (y1 > top + 4) boxes.push({ x0, x1, y0: top, y1, z0, z1 });
  }
  return boxes;
}

function hitsUse(x: number, y: number, z: number, w: number, h: number, d: number, boxes: Box[]) {
  return boxes.some(
    (b) =>
      x + w > b.x0 + 0.2 &&
      x < b.x1 - 0.2 &&
      y + h > b.y0 + 0.2 &&
      y < b.y1 - 0.2 &&
      z + d > b.z0 + 0.2 &&
      z < b.z1 - 0.2,
  );
}

function sectionOf(panel: Panel, panels: Panel[]): number {
  let t = panel.size.height;
  for (const q of panels) {
    if (!q.name.startsWith("Support apron") || !q.name.includes(`under ${panel.name}`)) continue;
    if (Math.abs(q.position.y + q.size.height - panel.position.y) > 0.25) continue;
    t = Math.max(t, q.size.height);
  }
  return t;
}

/** Longest gap between supports already under this plate. */
function clearSpan(panel: Panel, panels: Panel[]): number {
  const longX = panel.size.width >= panel.size.depth;
  const span0 = longX ? panel.size.width : panel.size.depth;
  const across0 = longX ? panel.size.depth : panel.size.width;
  const c0 = longX ? panel.position.z : panel.position.x;
  const rails = panels.filter((q) => {
    if (q === panel || !q.name.startsWith("Support rail")) return false;
    const top = q.position.y + q.size.height;
    if (top < panel.position.y - 0.15 || q.position.y > panel.position.y + 0.15) return false;
    const ox = overlap(panel.position.x, panel.position.x + panel.size.width, q.position.x, q.position.x + q.size.width);
    const oz = overlap(panel.position.z, panel.position.z + panel.size.depth, q.position.z, q.position.z + q.size.depth);
    const along = longX ? ox : oz;
    return along > span0 * 0.5 && Math.min(ox, oz) > 0.4;
  });
  if (rails.length >= 2) {
    const mids = rails
      .map((q) => (longX ? q.position.z + q.size.depth / 2 : q.position.x + q.size.width / 2))
      .sort((a, b) => a - b);
    let across = Math.max(mids[0] - c0, c0 + across0 - mids[mids.length - 1]);
    for (let i = 1; i < mids.length; i++) across = Math.max(across, mids[i] - mids[i - 1]);
    return across;
  }
  return span0;
}

/** The real use of a top, from the build itself. */
function surfaceUse(project: YardProject): string | null {
  const hay = `${project.name} ${project.prompt ?? ""}`.toLowerCase();
  if (/\bdesk\b|workstation|writing/.test(hay)) return "Desk use (a monitor, a laptop, leaning elbows)";
  if (/workbench|island|counter|prep|butcher|potting/.test(hay)) return "Counter use (a cutting board, tools, leaning weight)";
  if (/table|nightstand|console|cart|sideboard|credenza|buffet|vanity|dresser/.test(hay)) return "Table use (dishes, a lamp, leaning elbows)";
  return null;
}

/** A top that sits on aprons along its edges: the aprons are the support under it. */
function restsOnAprons(panel: Panel, panels: Panel[]): boolean {
  return panels.some((q) => {
    if (q === panel || !/apron|stretcher|\brail\b/i.test(q.name)) return false;
    if (Math.abs(q.position.y + q.size.height - panel.position.y) > 0.3) return false;
    const ox = overlap(panel.position.x, panel.position.x + panel.size.width, q.position.x, q.position.x + q.size.width);
    const oz = overlap(panel.position.z, panel.position.z + panel.size.depth, q.position.z, q.position.z + q.size.depth);
    return ox > 0.2 && oz > 0.2;
  });
}

function say(project: YardProject, name: string, span: number, thick: number, allow: number, load: SpanLoad): Pick<SpanFinding, "message" | "suggestion"> {
  const who = load === "person" ? "A person" : load === "shelf" ? "A shelf of books" : load === "surface" ? surfaceUse(project) ?? "Everyday use on the top" : "A light load";
  return {
    message: `${name} spans ${Math.round(span)}″ on ${thickLabel(thick)} stock. ${who} wants that thickness held about every ${Math.round(allow)}″.`,
    suggestion: "Add support. It stays under the surface and out of the space you use. Shop rule of thumb — not an engineer's stamp.",
  };
}

export function spanFindings(project: YardProject): SpanFinding[] {
  const out: SpanFinding[] = [];
  for (const panel of project.panels) {
    if (!isFlatPlate(panel)) continue;
    const load = loadOf(project, panel);
    const span = clearSpan(panel, project.panels);
    const thick = sectionOf(panel, project.panels);
    const allow = allowSpanIn(thick, load);
    if (span <= allow * TOL || span < 12) continue;
    if (load === "surface" && restsOnAprons(panel, project.panels)) continue;
    const text = say(project, panel.name, span, thick, allow, load);
    out.push({ panelId: panel.id, name: panel.name, span, thick, allow, load, ...text });
  }
  out.sort((a, b) => b.span / b.allow - a.span / a.allow);
  return out;
}

export function stampSpanOffer(project: YardProject): YardProject {
  if (project.supportOffer?.included) return project;
  const findings = spanFindings(project);
  if (!findings.length) return project;
  const extra = findings.length > 1 ? ` ${findings.length - 1} more span${findings.length > 2 ? "s are" : " is"} over the limit.` : "";
  return {
    ...project,
    supportOffer: {
      needed: true,
      included: false,
      kind: "span",
      reason: findings[0].message + extra,
    },
  };
}

function pushPanel(
  panels: Panel[],
  type: Panel["type"],
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  materialId: string,
) {
  panels.push({
    id: createId(type.slice(0, 2)),
    type,
    name,
    position: { x, y, z },
    size: { width: w, height: h, depth: d },
    materialId,
  });
}

function plateBelow(panels: Panel[], panel: Panel): number {
  let base = 0;
  for (const q of panels) {
    if (q === panel || q.name.startsWith("Support ")) continue;
    const top = q.position.y + q.size.height;
    if (top >= panel.position.y - 0.1) continue;
    const ox = overlap(panel.position.x, panel.position.x + panel.size.width, q.position.x, q.position.x + q.size.width);
    const oz = overlap(panel.position.z, panel.position.z + panel.size.depth, q.position.z, q.position.z + q.size.depth);
    if (ox > 4 && oz > 4 && top > base) base = top;
  }
  return base;
}

/** Rails under a deck or seat. Ends land on a head and foot rail, which land on the posts. Nothing rises into the bed. */
function supportPerson(panels: Panel[], panel: Panel, boxes: Box[]) {
  const longX = panel.size.width >= panel.size.depth;
  const span = longX ? panel.size.width : panel.size.depth;
  const across = longX ? panel.size.depth : panel.size.width;
  const room = panel.position.y - 0.5;
  const beam = beamFor(span, "person", room);
  if (!beam) return;
  const allow = allowSpanIn(panel.size.height, "person");
  const spaces = Math.max(1, Math.ceil(across / (allow * TOL)));
  const endT = 1.5;
  const y = panel.position.y - beam.depth;
  if (y < 0) return;
  const ends = [0, span - endT];
  const placed: { x: number; y: number; z: number; w: number; h: number; d: number }[] = [];
  for (const along of ends) {
    const piece = longX
      ? { x: panel.position.x + along, y, z: panel.position.z, w: endT, h: beam.depth, d: across }
      : { x: panel.position.x, y, z: panel.position.z + along, w: across, h: beam.depth, d: endT };
    if (hitsUse(piece.x, piece.y, piece.z, piece.w, piece.h, piece.d, boxes)) return;
    placed.push(piece);
  }
  const count = spaces + 1;
  const run = span - endT * 2;
  if (run < 6) return;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const alongShort = t * Math.max(0, across - 1.5);
    const piece = longX
      ? { x: panel.position.x + endT, y, z: panel.position.z + alongShort, w: run, h: beam.depth, d: 1.5 }
      : { x: panel.position.x + alongShort, y, z: panel.position.z + endT, w: 1.5, h: beam.depth, d: run };
    if (hitsUse(piece.x, piece.y, piece.z, piece.w, piece.h, piece.d, boxes)) return;
    placed.push(piece);
  }
  for (const piece of placed) {
    pushPanel(panels, "rail", `Support rail under ${panel.name}`, piece.x, piece.y, piece.z, piece.w, piece.h, piece.d, beam.stock);
  }
}

/** An apron under the edge deepens the shelf. It does not stand up through the bay. */
function supportShelf(panels: Panel[], panel: Panel, project: YardProject, boxes: Box[]) {
  const longX = panel.size.width >= panel.size.depth;
  const span = longX ? panel.size.width : panel.size.depth;
  const load = loadOf(project, panel);
  const base = plateBelow(panels, panel);
  const gap = panel.position.y - base;
  const need = base > 0 ? BAY : 1;
  const apron = APRONS.find((a) => a.depth <= gap - need && allowBeam(a.depth, load) >= span);
  if (!apron) return;
  const y = panel.position.y - apron.depth;
  const piece = longX
    ? {
        x: panel.position.x,
        y,
        z: panel.position.z + Math.max(0, panel.size.depth - apron.thick),
        w: span,
        h: apron.depth,
        d: Math.min(apron.thick, panel.size.depth),
      }
    : {
        x: panel.position.x + Math.max(0, panel.size.width - apron.thick),
        y,
        z: panel.position.z,
        w: Math.min(apron.thick, panel.size.width),
        h: apron.depth,
        d: span,
      };
  if (hitsUse(piece.x, piece.y, piece.z, piece.w, piece.h, piece.d, boxes)) return;
  pushPanel(panels, "rail", `Support apron under ${panel.name}`, piece.x, piece.y, piece.z, piece.w, piece.h, piece.d, apron.stock);
}

export function withSupports(project: YardProject): YardProject {
  const before = spanFindings(project);
  if (!before.length) {
    return {
      ...project,
      supportOffer: { needed: false, included: true, kind: "span", reason: "Nothing is over its span." },
    };
  }
  const panels = project.panels.map((p) => ({ ...p, position: { ...p.position }, size: { ...p.size } }));
  const boxes = usableBoxes(panels, project);
  const targets = new Set(before.map((f) => f.panelId));
  for (const panel of [...panels]) {
    if (!targets.has(panel.id)) continue;
    if (loadOf(project, panel) === "person") supportPerson(panels, panel, boxes);
    else supportShelf(panels, panel, project, boxes);
  }
  const added = panels.length - project.panels.length;
  const next: YardProject = {
    ...project,
    panels,
    notes: added
      ? [...project.notes, "Support is under the spans, clear of the space you use. Shop rule of thumb — not an engineer's stamp."]
      : project.notes,
  };
  const left = spanFindings(next);
  const extra = left.length > 1 ? ` ${left.length - 1} more still over.` : "";
  return {
    ...next,
    supportOffer: {
      needed: left.length > 0,
      included: true,
      kind: "span",
      reason: left.length
        ? `${left[0].message}${extra} ${added ? "What fits without blocking the use is in." : "Nothing fits without blocking the use."}`
        : "Support is in, under the surface. The space you use is clear.",
    },
  };
}
