/**
 * Opening cuts from Your space. One path for every carcase:
 * an arch is a curved top rail and side cuts, a slope is tapered sides,
 * an outlet is a cutout in the back, a baseboard is a floor notch on the back edge.
 */
import { inchFrac } from "./inchText";
import type { Panel, YardProject } from "./types";

export type SpaceAsk = {
  shape: "rectangle" | "arch" | "slope";
  archRise?: number;
  lowSide?: number;
  outlet?: { x: number; y: number; width: number; height: number } | null;
  baseboard?: { height: number; depth: number } | null;
};

const NOTE = "Space cut: ";

function arcPts(width: number, rise: number, steps = 8): [number, number][] {
  const pts: [number, number][] = [[0, 0]];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = width * t;
    const y = rise * Math.sin(Math.PI * t);
    pts.push([x, y]);
  }
  pts.push([width, 0]);
  return pts;
}

function strip(panel: Panel): Panel {
  const next: Panel = { ...panel, position: { ...panel.position }, size: { ...panel.size } };
  if (next.cutouts?.some((c) => c.id.startsWith("space-"))) {
    next.cutouts = next.cutouts.filter((c) => !c.id.startsWith("space-"));
    if (!next.cutouts.length) delete next.cutouts;
  }
  if (next.cutNote?.startsWith(NOTE)) {
    const lift = next.cutNote.match(/baseboard lift ([0-9./ ]+)/);
    if (lift) {
      const n = parseFrac(lift[1]);
      if (n > 0) {
        next.position = { ...next.position, y: next.position.y - n };
        next.size = { ...next.size, height: next.size.height + n };
      }
    }
    delete next.cutNote;
    delete next.polygon;
  }
  if (next.type === "top" && /curved top rail|sloped top/i.test(next.name)) next.name = "Top";
  return next;
}

function parseFrac(raw: string): number {
  const t = raw.trim();
  const m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  const f = t.match(/^(\d+)\/(\d+)$/);
  if (f) return Number(f[1]) / Number(f[2]);
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

/** Apply the opening cuts. Safe to call again: the last space cut is replaced, not stacked. */
export function applySpaceCuts(project: YardProject, ask: SpaceAsk): YardProject {
  const panels = project.panels.map(strip);
  const top = panels.find((p) => p.type === "top");
  const uprights = panels.filter((p) => p.type === "upright");
  const back = panels.find((p) => p.type === "back");
  const rise = Math.max(1, ask.archRise ?? 4);
  const high = Math.max(...uprights.map((p) => p.position.y + p.size.height), top?.position.y ?? project.overall.height);
  const low = Math.min(Math.max(4, ask.lowSide ?? high * 0.66), high - 1);

  if (ask.shape === "arch" && top) {
    top.name = "Curved top rail";
    top.cutNote = `${NOTE}cut the top rail to a curve, rise ${inchFrac(rise)}".`;
    top.position = { ...top.position, y: Math.max(0, top.position.y + top.size.height - rise) };
    top.size = { ...top.size, height: rise };
    top.polygon = { plane: "xy", pts: arcPts(top.size.width, rise) };
    for (const side of uprights) {
      const innerDrop = rise;
      side.cutNote = `${NOTE}cut the top of the side to the curve, ${inchFrac(innerDrop)}" down at the inner edge.`;
      side.polygon = {
        plane: "xy",
        pts: [
          [0, 0],
          [side.size.width, 0],
          [side.size.width, side.size.height - innerDrop],
          [0, side.size.height],
        ],
      };
    }
  }

  if (ask.shape === "slope" && uprights.length) {
    const right = uprights[uprights.length - 1];
    const left = uprights[0];
    left.cutNote = `${NOTE}tapered side, high end ${inchFrac(left.size.height)}".`;
    left.polygon = {
      plane: "xy",
      pts: [
        [0, 0],
        [left.size.width, 0],
        [left.size.width, low],
        [0, left.size.height],
      ],
    };
    right.cutNote = `${NOTE}tapered side, low end ${inchFrac(low)}".`;
    right.size = { ...right.size, height: low };
    right.polygon = {
      plane: "xy",
      pts: [
        [0, 0],
        [right.size.width, 0],
        [right.size.width, low],
        [0, Math.max(1, low - (left.size.height - low))],
      ],
    };
    if (top) {
      top.name = "Sloped top";
      top.cutNote = `${NOTE}cut the top to the slope, high ${inchFrac(left.size.height)}" to low ${inchFrac(low)}".`;
      top.polygon = {
        plane: "xy",
        pts: [
          [0, 0],
          [top.size.width, 0],
          [top.size.width, Math.max(0.5, top.size.height * 0.45)],
          [0, top.size.height],
        ],
      };
    }
  }

  if (ask.outlet && back) {
    const o = ask.outlet;
    back.cutouts = [...(back.cutouts ?? []), { id: "space-outlet", x: o.x, y: o.y, width: o.width, height: o.height, label: "Outlet" }];
    back.cutNote = `${NOTE}cut an outlet opening in the back, ${inchFrac(o.x)}" from the left, ${inchFrac(o.y)}" up, ${inchFrac(o.width)}" by ${inchFrac(o.height)}".`;
    back.polygon = back.polygon ?? {
      plane: "xy",
      pts: [
        [0, 0],
        [back.size.width, 0],
        [back.size.width, back.size.height],
        [0, back.size.height],
      ],
    };
  }

  if (ask.baseboard && back) {
    const h = Math.max(0.5, ask.baseboard.height);
    const d = Math.max(0.25, ask.baseboard.depth);
    back.position = { ...back.position, y: back.position.y + h };
    back.size = { ...back.size, height: Math.max(1, back.size.height - h) };
    back.cutNote = `${NOTE}notch the back edge at the floor for the baseboard, ${inchFrac(h)}" tall, ${inchFrac(d)}" deep. baseboard lift ${inchFrac(h)}`;
    for (const side of uprights) {
      side.cutNote = `${NOTE}notch the back edge at the floor, ${inchFrac(h)}" tall and ${inchFrac(d)}" deep.`;
    }
  }

  return { ...project, panels };
}

/** One step so the plan says the opening cuts, not only the cut list. */
export function spaceCutStep(project: YardProject): { title: string; description: string } | null {
  const notes = project.panels.map((p) => p.cutNote ?? "").filter((n) => n.startsWith(NOTE));
  if (!notes.length) return null;
  const bits: string[] = [];
  if (notes.some((n) => /curve/.test(n))) bits.push("cut the top rail to the curve and the side tops to meet it");
  if (notes.some((n) => /tapered side|slope/.test(n))) bits.push("cut the sides to the slope, high end to low end");
  if (notes.some((n) => /outlet/.test(n))) bits.push("cut the outlet opening in the back before the back goes on");
  if (notes.some((n) => /baseboard/.test(n))) bits.push("notch the back edge at the floor so the baseboard sits in the notch");
  return {
    title: "Cut the opening",
    description: `The room is not a rectangle. ${bits.join("; ")}.`,
  };
}
