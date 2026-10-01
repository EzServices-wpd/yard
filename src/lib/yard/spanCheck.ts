/**
 * Shop rule of thumb for a clear span. Not a stamp.
 * A person-bearing beam gets a support by about 5 feet.
 * A ¾″ shelf is fine near 32″. A ¾″ deck that someone sleeps on is not.
 */
import { createId } from "@/lib/utils";
import type { Panel, YardProject } from "./types";

export type SpanLoad = "person" | "shelf" | "light";

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

export function allowSpanIn(thick: number, load: SpanLoad): number {
  const t = Math.max(0.15, thick);
  const k = load === "person" ? 26 : load === "shelf" ? 42 : 58;
  const cap = load === "person" ? 60 : 96;
  return Math.round(Math.min(cap, k * Math.pow(t, 0.8)) * 10) / 10;
}

function thickLabel(t: number): string {
  const known: [number, string][] = [
    [0.25, "¼"],
    [0.375, "⅜"],
    [0.5, "½"],
    [0.75, "¾"],
    [1, "1"],
    [1.5, "1½"],
    [3.5, "3½"],
    [5.5, "5½"],
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
  if (panel.type === "counter" || panel.type === "top") return "shelf";
  return "light";
}

function isFlatPlate(panel: Panel): boolean {
  if (panel.name.startsWith("Support ")) return false;
  if (!["shelf", "deck", "counter", "top", "bottom"].includes(panel.type)) return false;
  const { width: w, height: h, depth: d } = panel.size;
  const thick = Math.min(w, h, d);
  if (thick > 2 || thick < 0.15) return false;
  // Thickness is vertical. A door or a side is thin in plan, not in height.
  return Math.abs(h - thick) < 0.08;
}

/** Longest gap between supports already under this plate, along its long side. */
function clearSpan(panel: Panel, panels: Panel[]): { span: number; across: number } {
  const longX = panel.size.width >= panel.size.depth;
  const span0 = longX ? panel.size.width : panel.size.depth;
  const across0 = longX ? panel.size.depth : panel.size.width;
  const origin = longX ? panel.position.x : panel.position.z;
  const c0 = longX ? panel.position.z : panel.position.x;
  const rails = panels.filter((q) => {
    if (q === panel || !q.name.startsWith("Support rail")) return false;
    const top = q.position.y + q.size.height;
    if (top < panel.position.y - 0.15 || q.position.y > panel.position.y + 0.15) return false;
    const qx0 = q.position.x;
    const qz0 = q.position.z;
    const qx1 = qx0 + q.size.width;
    const qz1 = qz0 + q.size.depth;
    const x0 = panel.position.x;
    const z0 = panel.position.z;
    const ox = Math.min(x0 + panel.size.width, qx1) - Math.max(x0, qx0);
    const oz = Math.min(z0 + panel.size.depth, qz1) - Math.max(z0, qz0);
    return ox > 0.4 && oz > 0.4;
  });
  if (rails.length >= 2) {
    const mids = rails
      .map((q) => (longX ? q.position.z + q.size.depth / 2 : q.position.x + q.size.width / 2))
      .sort((a, b) => a - b);
    let across = Math.max(mids[0] - c0, c0 + across0 - mids[mids.length - 1]);
    for (let i = 1; i < mids.length; i++) across = Math.max(across, mids[i] - mids[i - 1]);
    return { span: across, across: span0 };
  }
  const stops = [origin, origin + span0];
  for (const q of panels) {
    if (q === panel) continue;
    if (q.type !== "upright" && !q.name.startsWith("Support leg") && !q.name.startsWith("Support divider")) continue;
    const top = q.position.y + q.size.height;
    if (top < panel.position.y - 0.2 || q.position.y > panel.position.y + panel.size.height) continue;
    const mid = longX ? q.position.x + q.size.width / 2 : q.position.z + q.size.depth / 2;
    const qx0 = q.position.x;
    const qz0 = q.position.z;
    const ox = Math.min(panel.position.x + panel.size.width, qx0 + q.size.width) - Math.max(panel.position.x, qx0);
    const oz = Math.min(panel.position.z + panel.size.depth, qz0 + q.size.depth) - Math.max(panel.position.z, qz0);
    if (ox < 0.4 || oz < 0.4) continue;
    if (mid > origin + 1 && mid < origin + span0 - 1) stops.push(mid);
  }
  stops.sort((a, b) => a - b);
  let span = 0;
  for (let i = 1; i < stops.length; i++) span = Math.max(span, stops[i] - stops[i - 1]);
  return { span: span || span0, across: across0 };
}

function say(name: string, span: number, thick: number, allow: number, load: SpanLoad): Pick<SpanFinding, "message" | "suggestion"> {
  const who = load === "person" ? "A person" : load === "shelf" ? "A shelf of books" : "A light load";
  return {
    message: `${name} spans ${Math.round(span)}″ on ${thickLabel(thick)} stock. ${who} wants that thickness held about every ${Math.round(allow)}″.`,
    suggestion: "Add support. It puts a rail or a divider only under the spans that are too long. Shop rule of thumb — not an engineer's stamp.",
  };
}

export function spanFindings(project: YardProject): SpanFinding[] {
  const out: SpanFinding[] = [];
  for (const panel of project.panels) {
    if (!isFlatPlate(panel)) continue;
    const load = loadOf(project, panel);
    const { span } = clearSpan(panel, project.panels);
    const allow = allowSpanIn(panel.size.height, load);
    if (span <= allow * TOL || span < 12) continue;
    const text = say(panel.name, span, panel.size.height, allow, load);
    out.push({ panelId: panel.id, name: panel.name, span, thick: panel.size.height, allow, load, ...text });
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

function pushPanel(panels: Panel[], type: Panel["type"], name: string, x: number, y: number, z: number, w: number, h: number, d: number, materialId: string) {
  panels.push({
    id: createId(type.slice(0, 2)),
    type,
    name,
    position: { x, y, z },
    size: { width: w, height: h, depth: d },
    materialId,
  });
}

function blocked(panels: Panel[], x: number, z: number, leg: number): [number, number][] {
  const ranges: [number, number][] = [];
  for (const q of panels) {
    if (q.name.startsWith("Support leg")) continue;
    const x1 = q.position.x + q.size.width;
    const z1 = q.position.z + q.size.depth;
    if (x + leg <= q.position.x + 0.05 || x >= x1 - 0.05 || z + leg <= q.position.z + 0.05 || z >= z1 - 0.05) continue;
    if (q.name.startsWith("Support rail")) {
      ranges.push([q.position.y, q.position.y + q.size.height]);
      continue;
    }
    const thin = Math.min(q.size.width, q.size.height, q.size.depth);
    if (Math.abs(q.size.height - thin) > 0.08) continue;
    ranges.push([q.position.y, q.position.y + q.size.height]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  return ranges;
}

function dropLegs(panels: Panel[], x: number, z: number, yTop: number, name: string) {
  const leg = 1.5;
  const ranges = blocked(panels, x, z, leg);
  let y = 0;
  const cuts: [number, number][] = [];
  for (const [a, b] of ranges) {
    if (b <= y || a >= yTop) continue;
    if (a > y + 4) cuts.push([y, Math.min(a, yTop)]);
    y = Math.max(y, b);
  }
  if (yTop > y + 4) cuts.push([y, yTop]);
  for (const [a, b] of cuts) {
    const taken = panels.some(
      (q) =>
        q.name.startsWith("Support leg") &&
        Math.abs(q.position.x - x) < 2 &&
        Math.abs(q.position.z - z) < 2 &&
        q.position.y < b - 1 &&
        q.position.y + q.size.height > a + 1,
    );
    if (taken) continue;
    pushPanel(panels, "upright", name, x, a, z, leg, b - a, leg, "lumber-2x4-8");
  }
}

function supportPlate(panels: Panel[], panel: Panel, project: YardProject) {
  const load = loadOf(project, panel);
  const allow = allowSpanIn(panel.size.height, load);
  const longX = panel.size.width >= panel.size.depth;
  const span = longX ? panel.size.width : panel.size.depth;
  const across = longX ? panel.size.depth : panel.size.width;
  const beam = load === "person" ? 3.5 : 1.5;
  const stock = load === "person" ? "lumber-2x4-8" : "lumber-1x3-8";

  if (load === "person" && panel.position.y > beam + 1) {
    const spaces = Math.max(1, Math.ceil(across / (allow * TOL)));
    const count = spaces + 1;
    const railAllow = allowSpanIn(beam, "person");
    const legSpaces = Math.max(1, Math.ceil(span / (railAllow * TOL)));
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const alongShort = t * Math.max(0, across - 1.5);
      const x = panel.position.x + (longX ? 0 : alongShort);
      const z = panel.position.z + (longX ? alongShort : 0);
      const y = panel.position.y - beam;
      const w = longX ? span : 1.5;
      const d = longX ? 1.5 : span;
      pushPanel(panels, "rail", `Support rail under ${panel.name}`, x, y, z, w, beam, d, stock);
      if (legSpaces > 1 && project.assumptions.installMode !== "wall") {
        for (let k = 1; k < legSpaces; k++) {
          const u = (span * k) / legSpaces;
          const lx = x + (longX ? u - 0.75 : 0);
          const lz = z + (longX ? 0 : u - 0.75);
          dropLegs(panels, lx, lz, y, `Support leg under ${panel.name}`);
        }
      }
    }
    return;
  }

  if (project.assumptions.installMode === "wall") {
    const below = panels.some((q) => {
      if (q === panel) return false;
      if (q.position.y + q.size.height > panel.position.y - 0.3) return false;
      const ox = Math.min(panel.position.x + panel.size.width, q.position.x + q.size.width) - Math.max(panel.position.x, q.position.x);
      const oz = Math.min(panel.position.z + panel.size.depth, q.position.z + q.size.depth) - Math.max(panel.position.z, q.position.z);
      return ox > 4 && oz > 4;
    });
    if (!below) return;
  }

  const spaces = Math.max(1, Math.ceil(span / (allow * TOL)));
  for (let i = 1; i < spaces; i++) {
    const u = (span * i) / spaces;
    const x = panel.position.x + (longX ? u - 0.375 : 0);
    const z = panel.position.z + (longX ? 0 : u - 0.375);
    let base = 0;
    for (const q of panels) {
      if (q === panel) continue;
      const top = q.position.y + q.size.height;
      if (top >= panel.position.y - 0.15) continue;
      const ox = Math.min(x + 0.75, q.position.x + q.size.width) - Math.max(x, q.position.x);
      const oz = Math.min(z + Math.min(panel.size.depth, panel.size.width), q.position.z + q.size.depth) - Math.max(z, q.position.z);
      if (ox < 0.4 || oz < 0.4) continue;
      if (top > base) base = top;
    }
    const h = panel.position.y - base;
    if (h < 3) continue;
    let z0 = panel.position.z;
    let d0 = panel.size.depth;
    let x0 = panel.position.x;
    let w0 = panel.size.width;
    for (const back of panels) {
      if (back.type !== "back") continue;
      if (back.size.depth <= 0.4 && back.position.z <= z0 + 0.05) {
        z0 = Math.max(z0, back.position.z + back.size.depth);
        d0 = panel.position.z + panel.size.depth - z0;
      }
      if (back.size.width <= 0.4 && back.position.x <= x0 + 0.05) {
        x0 = Math.max(x0, back.position.x + back.size.width);
        w0 = panel.position.x + panel.size.width - x0;
      }
    }
    if (longX) pushPanel(panels, "divider", `Support divider under ${panel.name}`, x, base, z0, 0.75, h, Math.max(1, d0), "plywood-3-4-4x8");
    else pushPanel(panels, "divider", `Support divider under ${panel.name}`, x0, base, z, Math.max(1, w0), h, 0.75, "plywood-3-4-4x8");
  }
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
  const targets = new Set(before.map((f) => f.panelId));
  for (const panel of [...panels]) {
    if (!targets.has(panel.id)) continue;
    supportPlate(panels, panel, project);
  }
  const added = panels.length - project.panels.length;
  const next: YardProject = {
    ...project,
    panels,
    notes: added
      ? [...project.notes, "Support added under the long spans. Shop rule of thumb — not an engineer's stamp."]
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
        ? `${left[0].message}${extra} ${added ? "What could be reached is in." : "Add support can't reach this one — it needs a bracket on the wall."}`
        : "Support is in. The long spans are broken up.",
    },
  };
}
