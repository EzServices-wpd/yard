/**
 * Freestanding table — round or rect top, 2x2 legs under the top, aprons inside the legs.
 *
 * Global apron rule (every table this builder emits):
 * - rails sit on the inner faces of the posts, spanning post-to-post
 * - never a diagonal of the top AABB (the old 55.25" yaw-blind lie)
 * - never a stretcher floating mid-span off the 2x2s
 * - never longer than the inner span (nothing past the posts or the top)
 * - 3-leg chords inset toward the centroid so apron bulk stays inside the
 *   post triangle — a centerline chord reads as bars past the posts
 */
import { createId } from "@/lib/utils";
import type { FittedSpec, Panel, YardProject } from "./types";

const PLY = "plywood-3-4-4x8";
const TWO_BY_TWO = "lumber-2x2-8";
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
  materialId = PLY,
): Panel {
  return {
    id: createId(type.slice(0, 2)),
    type,
    name,
    position: { x, y, z },
    size: { width: w, height: h, depth: d },
    materialId,
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
  const legW = 1.5;
  const topT = P;
  // Short coffee/side tables: a 3.5" apron eats the silhouette. Cap by height.
  const apronH = Math.min(3.5, Math.max(2.25, Math.round(H * 0.14 * 8) / 8));
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
    // Visible overhang so it reads as a table, posts fully inside the disc.
    const overhang = Math.min(4.25, Math.max(3.25, radius * 0.2));
    const rim = Math.max(legW * 2, radius - overhang - legW / 2);
    // One leg toward the iso camera (+X/+Z), the rest equally spaced.
    const spin = Math.PI / 4;
    for (let i = 0; i < legN; i++) {
      const ang = (Math.PI * 2 * i) / legN + spin;
      centers.push({ x: Math.cos(ang) * rim, z: Math.sin(ang) * rim });
    }
  } else {
    const inset = Math.max(3.25, legW + 1.75);
    const xs = [x0 + inset, x0 + W - inset];
    const zs = [z0 + inset, z0 + D - inset];
    if (legN === 3) {
      centers.push({ x: xs[0], z: zs[0] }, { x: xs[1], z: zs[0] }, { x: 0, z: zs[1] });
    } else {
      for (const x of xs) for (const z of zs) centers.push({ x, z });
    }
  }

  centers.forEach((c, i) => {
    panels.push(
      panel("upright", `Leg ${i + 1}`, c.x - legW / 2, 0, c.z - legW / 2, legW, legH, legW, 0, TWO_BY_TWO),
    );
  });

  // Aprons screw into the 2x2s, under the top.
  // 4-leg (round or rect): axis-aligned rails on the inner faces (no yaw).
  //   Round 4-leg lands on an axis-aligned square because of the 45° spin.
  //   The old circular pairing walked x-then-z so two "aprons" were diagonals
  //   (~43.5" on a 48×24 top) and yaw-blind plan bounds read 55.25".
  // 3-leg: chords between consecutive posts, inset toward the centroid so the
  //   apron body sits on the INNER side of the post-to-post line (same rule as
  //   4-leg inner faces). A centerline chord puts half the apron thickness
  //   outside the posts and reads as bars past the legs. Length uses the
  //   square half-extent along the chord so ends meet posts, not past them.
  //   Do NOT deep-inset toward origin — that floats a triangle off the 2x2s.
  const apronY = H - topT - apronH;
  const half = legW / 2;
  const squareHalfAlong = (ux: number, uz: number) => {
    const cands: number[] = [];
    if (Math.abs(ux) > 1e-9) cands.push(half / Math.abs(ux));
    if (Math.abs(uz) > 1e-9) cands.push(half / Math.abs(uz));
    return cands.length ? Math.min(...cands) : half;
  };
  if (legN === 4 && centers.length === 4) {
    const lx = Math.min(centers[0].x, centers[1].x, centers[2].x, centers[3].x);
    const rx = Math.max(centers[0].x, centers[1].x, centers[2].x, centers[3].x);
    const fz = Math.min(centers[0].z, centers[1].z, centers[2].z, centers[3].z);
    const bz = Math.max(centers[0].z, centers[1].z, centers[2].z, centers[3].z);
    const spanX = Math.max(4, rx - lx - legW);
    const spanZ = Math.max(4, bz - fz - legW);
    panels.push(
      panel("rail", "Front apron", lx + legW / 2, apronY, fz + legW / 2, spanX, apronH, apronT),
    );
    panels.push(
      panel("rail", "Back apron", lx + legW / 2, apronY, bz - legW / 2 - apronT, spanX, apronH, apronT),
    );
    panels.push(
      panel("rail", "Left apron", lx + legW / 2, apronY, fz + legW / 2, apronT, apronH, spanZ),
    );
    panels.push(
      panel("rail", "Right apron", rx - legW / 2 - apronT, apronY, fz + legW / 2, apronT, apronH, spanZ),
    );
  } else {
    for (let i = 0; i < centers.length; i++) {
      const a = centers[i];
      const b = centers[(i + 1) % centers.length];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const span = Math.hypot(dx, dz);
      const ux = dx / span;
      const uz = dz / span;
      const yaw = Math.atan2(dz, dx);
      const midX = (a.x + b.x) / 2;
      const midZ = (a.z + b.z) / 2;
      // Inward normal (toward origin / triangle centroid).
      let nx = -uz;
      let nz = ux;
      if (nx * -midX + nz * -midZ < 0) {
        nx = -nx;
        nz = -nz;
      }
      // Outer face of apron on the post-to-post centerline → body inside the posts.
      const inset = apronT / 2;
      const cx = midX + nx * inset;
      const cz = midZ + nz * inset;
      const tA = squareHalfAlong(ux, uz);
      const tB = squareHalfAlong(ux, uz);
      const length = Math.max(4, span - tA - tB);
      panels.push(
        panel(
          "rail",
          `Apron ${i + 1}`,
          cx - length / 2,
          apronY,
          cz - apronT / 2,
          length,
          apronH,
          apronT,
          yaw,
        ),
      );
    }
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
