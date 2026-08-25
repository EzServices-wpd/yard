/**
 * Freestanding table builder — top + legs on a circle under the top.
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
  // Center the top on the origin in XZ so legs (also around origin) sit under it.
  const x0 = -W / 2;
  const z0 = -D / 2;
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
      z0,
      W,
      topT,
      D,
    ),
  );

  // Radius to leg centers — near the rim of a round top, inset by half the post.
  const rim = Math.min(W, D) / 2 - legW * 0.55;
  for (let i = 0; i < legN; i++) {
    const ang = (Math.PI * 2 * i) / legN - Math.PI / 2; // first leg toward -Z (rear)
    const cx = Math.cos(ang) * rim;
    const cz = Math.sin(ang) * rim;
    panels.push(
      panel("upright", `Leg ${i + 1}`, cx - legW / 2, 0, cz - legW / 2, legW, H - topT, legW),
    );
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
