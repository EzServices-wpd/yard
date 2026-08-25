/**
 * Freestanding table builder — top + legs on a circle.
 * Split out so geometry fixes push cleanly without touching the rest of fitted.ts.
 */
import { createId } from "@/lib/utils";
import type { FittedSpec, Panel, YardProject } from "./types";

const PLY = "plywood-3-4-4x8";
const P = 0.75;

function panel(
  type: Panel["type"],
  name: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): Panel {
  return {
    id: createId(type.slice(0, 2)),
    type,
    name,
    position: { x, y, z },
    size: { width: w, height: h, depth: d },
    materialId: PLY,
  };
}

export function buildTable(spec: FittedSpec, prompt = ""): YardProject {
  const u = spec.unit;
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  const panels: Panel[] = [];
  const legN = Math.max(3, Math.min(4, u.legs ?? 4));
  const legW = 3.5;
  const topT = P;

  panels.push(
    panel(
      "top",
      u.shape === "round" ? `Top (cut round Ø${W}")` : "Top",
      x0,
      H - topT,
      0,
      W,
      topT,
      D,
    ),
  );

  for (let i = 0; i < legN; i++) {
    // Evenly space legs on a circle. Do NOT clamp z — rear legs must sit behind the top.
    const ang = (Math.PI * 2 * i) / legN + (legN === 4 ? Math.PI / 4 : -Math.PI / 2);
    const rx = (W / 2 - legW) * 0.72;
    const rz = (D / 2 - legW) * 0.72;
    const lx = Math.cos(ang) * rx - legW / 2;
    const lz = Math.sin(ang) * rz - legW / 2;
    panels.push(panel("upright", `Leg ${i + 1}`, lx, 0, lz, legW, H - topT, legW));
  }

  const notes = [
    `${spec.name}. Freestanding table — top + ${legN} legs.`,
    u.shape === "round"
      ? `Round top: cut a ${W}" square blank, then band-saw / jigsaw to Ø${W}". Height ${H}".`
      : `Top ${W}" × ${D}". Height ${H}".`,
    `Legs are 3-1/2" square posts (${legN}×) — buy solid 4x4 or laminate 3/4" ply. Not nested on the sheet.`,
    "Guidance only — level the top; do not rack the legs.",
  ];

  return {
    id: createId("proj"),
    name: spec.name,
    prompt,
    kind: "closet",
    overall: { width: W, height: H, depth: D },
    instances: [],
    panels,
    primaryMaterialId: PLY,
    notes,
    historic: false,
    opening: spec.opening,
    fitted: spec,
    assumptions: {
      load: "medium",
      units: "inches",
      installMode: "freestanding",
      wallType: "wood_stud",
    },
  };
}
