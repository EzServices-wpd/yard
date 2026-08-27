/**
 * Freestanding table — round or rect top, legs fully under the top, aprons on the chords.
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
  yaw = 0,
): Panel {
  return {
    id: createId(type.slice(0, 2)),
    type,
    name,
    position: { x, y, z },
    size: { width: w, height: h, depth: d },
    materialId: PLY,
    yaw,
  };
}

export function buildTable(spec: FittedSpec, prompt = ""): YardProject {
  const u = spec.unit;
  const W = u.width;
  const H = u.height;
  const D = u.depth;
  const x0 = -W / 2;
  const z0 = -D / 2;
  const panels: Panel[] = [];
  const legN = Math.max(3, Math.min(4, u.legs ?? 4));
  const round = u.shape === "round";
  // 2x2 actual — a table, not a picnic post.
  const legW = 1.5;
  const topT = P;
  const apronH = 3.5;
  const apronT = P;
  const legH = H - topT;

  panels.push(
    panel(
      "top",
      round ? `Top (cut round dia ${W}")` : "Top",
      x0,
      H - topT,
      z0,
      W,
      topT,
      D,
    ),
  );

  type XY = { x: number; z: number };
  const centers: XY[] = [];

  if (round) {
    const radius = Math.min(W, D) / 2;
    // Keep the square post fully inside the disc (corner radius + 1.75" from rim).
    const corner = (legW * Math.SQRT2) / 2;
    const rim = Math.max(radius * 0.52, radius - corner - 1.75);
    // 3-leg: two toward +Z (camera), one away. 4-leg: on the diagonals.
    const spin = legN === 3 ? Math.PI / 6 : Math.PI / 4;
    for (let i = 0; i < legN; i++) {
      const ang = (Math.PI * 2 * i) / legN + spin;
      centers.push({ x: Math.cos(ang) * rim, z: Math.sin(ang) * rim });
    }
  } else {
    const inset = Math.max(2.5, legW + 1.25);
    const xs = [x0 + inset, x0 + W - inset];
    const zs = [z0 + inset, z0 + D - inset];
    if (legN === 3) {
      centers.push({ x: xs[0], z: zs[0] }, { x: xs[1], z: zs[0] }, { x: 0, z: zs[1] });
    } else {
      for (const x of xs) for (const z of zs) centers.push({ x, z });
    }
  }

  centers.forEach((c, i) => {
    const yaw = Math.atan2(c.z, c.x);
    panels.push(
      panel("upright", `Leg ${i + 1}`, c.x - legW / 2, 0, c.z - legW / 2, legW, legH, legW, yaw),
    );
  });

  // Aprons: one rail on each chord, just under the top.
  const apronY = H - topT - apronH;
  for (let i = 0; i < centers.length; i++) {
    const a = centers[i];
    const b = centers[(i + 1) % centers.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const span = Math.hypot(dx, dz);
    const length = Math.max(4, span - legW * 0.9);
    const yaw = Math.atan2(dz, dx);
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    panels.push(
      panel(
        "rail",
        `Apron ${i + 1}`,
        mx - length / 2,
        apronY,
        mz - apronT / 2,
        length,
        apronH,
        apronT,
        yaw,
      ),
    );
  }

  const notes = [
    `${spec.name}. Freestanding table — top + ${legN} legs + ${legN} aprons.`,
    round
      ? `Round top: cut a ${W}" square blank, then band-saw / jigsaw to a ${W}" diameter circle. Height ${H}".`
      : `Top ${W}" × ${D}". Height ${H}".`,
    `Legs are 1-1/2" square (2x2 actual), ${legN}× — buy 2x2 lumber. Aprons nest on the 3/4" sheet. Legs stay under the top.`,
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
