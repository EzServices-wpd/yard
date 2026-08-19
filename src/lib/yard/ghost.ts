import type { StructureKind, Vec3, YardProject } from "./types";
import { pocketStrokes } from "./pocket";

export type GhostStroke = {
  points: [number, number, number][];
  weight: "main" | "fine";
};

export const FAMOUS_KINDS: StructureKind[] = ["eiffel", "taj", "pyramid"];

export function isFamousKind(kind: StructureKind) {
  return FAMOUS_KINDS.includes(kind);
}

export function hasHistoricProfile(kind: StructureKind) {
  return isFamousKind(kind);
}

export function promptWantsGhost(prompt: string) {
  return /true form|ghost|silhouette|wire\s*frame|historic|real (shape|form|tower|outline)|show the (real|true|form)|underlay|reference form|true scale outline/.test(
    prompt.toLowerCase(),
  );
}

/** Famous / requested → historic on. Hull only if they asked and it is not a famous site. */
export function defaultGhostFlags(kind: StructureKind, prompt: string, historic = false) {
  const famous = isFamousKind(kind) || historic;
  const wants = promptWantsGhost(prompt);
  return {
    showHistoric: famous || (wants && hasHistoricProfile(kind)),
    showHull: wants && !famous,
  };
}

export const EIFFEL_REAL = {
  heightM: 324,
  baseM: 125,
  platformsM: [57, 115, 276] as const,
  archM: 40,
  /** Outer face width (m) at published stations — legs come together, then one shaft. */
  profile: [
    { t: 0, faceM: 125 },
    { t: 57 / 324, faceM: 72 },
    { t: 115 / 324, faceM: 41 },
    { t: 200 / 324, faceM: 17 },
    { t: 276 / 324, faceM: 11 },
    { t: 1, faceM: 4 },
  ],
};

export function eiffelHalfAt(t: number, heightIn: number): number {
  const scale = heightIn / EIFFEL_REAL.heightM;
  const u = Math.min(1, Math.max(0, t));
  const pts = EIFFEL_REAL.profile;
  if (u <= pts[0].t) return (pts[0].faceM * scale) / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (u <= b.t) {
      const s = (u - a.t) / Math.max(b.t - a.t, 1e-6);
      const ease = s * s * (3 - 2 * s);
      return ((a.faceM + (b.faceM - a.faceM) * ease) * scale) / 2;
    }
  }
  return (pts[pts.length - 1].faceM * scale) / 2;
}

export function eiffelCorner(t: number, heightIn: number, corner: number): Vec3 {
  const a = (corner / 4) * Math.PI * 2 + Math.PI / 4;
  const r = eiffelHalfAt(t, heightIn) * Math.SQRT2;
  return { x: Math.cos(a) * r, y: t * heightIn, z: Math.sin(a) * r };
}

export function eiffelPlatformTs(): number[] {
  return [
    0,
    ...EIFFEL_REAL.platformsM.map((m) => m / EIFFEL_REAL.heightM),
    1,
  ];
}

function v(x: number, y: number, z: number): [number, number, number] {
  return [x, y, z];
}

function rectAt(y: number, halfX: number, halfZ: number): GhostStroke[] {
  const a = v(-halfX, y, -halfZ);
  const b = v(halfX, y, -halfZ);
  const c = v(halfX, y, halfZ);
  const d = v(-halfX, y, halfZ);
  return [{ points: [a, b, c, d, a], weight: "fine" }];
}

/** A — envelope of *our* pieces, so the ghost always matches the bench. */
export function hullStrokes(project: YardProject): GhostStroke[] {
  if (project.pocket) return pocketStrokes(project.pocket);
  if (project.panels.length && !project.instances.length) {
    const o = project.opening ?? {
      width: project.overall.width,
      height: project.overall.height,
      depth: project.overall.depth,
    };
    return boxEdges(o.width, o.height, o.depth);
  }
  const list = project.instances;
  if (!list.length) {
    return boxEdges(project.overall.width, project.overall.height, project.overall.depth);
  }

  const ys = list.map((i) => i.position.y);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const span = Math.max(yMax - yMin, 1);
  const bands = Math.min(10, Math.max(4, Math.round(span / 6)));
  const corners: { y: number; hx: number; hz: number }[] = [];

  for (let b = 0; b <= bands; b++) {
    const t = b / bands;
    const y = yMin + t * span;
    const pad = span / bands;
    const inBand = list.filter((i) => Math.abs(i.position.y - y) <= pad * 0.85);
    const src = inBand.length ? inBand : list;
    const xs = src.map((i) => i.position.x);
    const zs = src.map((i) => i.position.z);
    const hx = Math.max(0.4, (Math.max(...xs) - Math.min(...xs)) / 2);
    const hz = Math.max(0.4, (Math.max(...zs) - Math.min(...zs)) / 2);
    corners.push({ y, hx, hz });
  }

  const strokes: GhostStroke[] = [];
  for (const c of corners) {
    strokes.push(...rectAt(c.y, c.hx, c.hz));
  }
  const idx = [0, 1, 2, 3];
  const cornerOf = (c: { y: number; hx: number; hz: number }, i: number): [number, number, number] => {
    const sx = i === 0 || i === 3 ? -1 : 1;
    const sz = i === 0 || i === 1 ? -1 : 1;
    return v(sx * c.hx, c.y, sz * c.hz);
  };
  for (const i of idx) {
    const pts = corners.map((c) => cornerOf(c, i));
    strokes.push({ points: pts, weight: "main" });
  }
  return strokes;
}

function boxEdges(w: number, h: number, d: number): GhostStroke[] {
  const hx = w / 2;
  const hz = d / 2;
  const p = (x: number, y: number, z: number) => v(x, y, z);
  const bot = [p(-hx, 0, -hz), p(hx, 0, -hz), p(hx, 0, hz), p(-hx, 0, hz), p(-hx, 0, -hz)];
  const top = [p(-hx, h, -hz), p(hx, h, -hz), p(hx, h, hz), p(-hx, h, hz), p(-hx, h, -hz)];
  const legs: GhostStroke[] = [
    { points: [p(-hx, 0, -hz), p(-hx, h, -hz)], weight: "main" },
    { points: [p(hx, 0, -hz), p(hx, h, -hz)], weight: "main" },
    { points: [p(hx, 0, hz), p(hx, h, hz)], weight: "main" },
    { points: [p(-hx, 0, hz), p(-hx, h, hz)], weight: "main" },
  ];
  return [{ points: bot, weight: "fine" }, { points: top, weight: "fine" }, ...legs];
}

/**
 * B — published monument proportions, scaled to this model's height.
 * Encoded facts, not a downloaded mesh.
 */
export function historicStrokes(project: YardProject): GhostStroke[] {
  const H = Math.max(project.overall.height, 8);
  switch (project.kind) {
    case "eiffel":
    case "lattice":
      return eiffelHistoric(H);
    case "taj":
      return tajHistoric(H);
    case "pyramid":
      return pyramidHistoric(H);
    default:
      return [];
  }
}

/** Eiffel: 324 m to tip, 125 m square base, platforms 57 / 115 / 276 m, arch ~40 m. */
function eiffelHistoric(H: number): GhostStroke[] {
  const samples = 18;
  const strokes: GhostStroke[] = [];
  for (let c = 0; c < 4; c++) {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= samples; i++) {
      const p = eiffelCorner(i / samples, H, c);
      pts.push(v(p.x, p.y, p.z));
    }
    strokes.push({ points: pts, weight: "main" });
  }
  for (const t of EIFFEL_REAL.platformsM.map((m) => m / EIFFEL_REAL.heightM)) {
    const half = eiffelHalfAt(t, H);
    strokes.push(...rectAt(t * H, half, half));
  }
  const archY = (EIFFEL_REAL.archM / EIFFEL_REAL.heightM) * H;
  const ground = eiffelHalfAt(0, H);
  for (const face of [0, 1, 2, 3]) {
    const pts: [number, number, number][] = [];
    const segs = 10;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const x0 = (u - 0.5) * 2 * ground;
      const y = Math.sin(Math.PI * u) * archY;
      if (face === 0) pts.push(v(x0, y, -ground));
      else if (face === 1) pts.push(v(x0, y, ground));
      else if (face === 2) pts.push(v(-ground, y, x0));
      else pts.push(v(ground, y, x0));
    }
    strokes.push({ points: pts, weight: "fine" });
  }
  strokes.push({ points: [v(0, (300 / EIFFEL_REAL.heightM) * H, 0), v(0, H, 0)], weight: "fine" });
  return strokes;
}

/** Taj: ~73 m to finial, ~95 m platform, minarets ~42 m. */
function tajHistoric(H: number): GhostStroke[] {
  const REAL_H = 73;
  const plat = H * (95 / REAL_H) * 0.5;
  const minaH = H * (42 / REAL_H);
  const drumH = H * 0.55;
  const domeH = H * 0.82;
  const strokes: GhostStroke[] = [];
  strokes.push(...rectAt(0.15, plat, plat));
  strokes.push(...rectAt(0, plat * 1.02, plat * 1.02));
  const minaR = plat * 0.82;
  for (let c = 0; c < 4; c++) {
    const a = (c / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * minaR;
    const z = Math.sin(a) * minaR;
    strokes.push({ points: [v(x, 0, z), v(x, minaH, z)], weight: "main" });
    const cap = 1.2;
    strokes.push({
      points: [v(x - cap, minaH, z), v(x, minaH + cap * 2, z), v(x + cap, minaH, z)],
      weight: "fine",
    });
  }
  const body = plat * 0.42;
  strokes.push(...boxEdges(body * 2, drumH, body * 2).map((s) => ({ ...s, weight: "main" as const })));
  const onion: [number, number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const y = drumH + t * (domeH - drumH);
    const r = body * Math.sin(t * Math.PI) * (t < 0.55 ? 1.05 : 0.7);
    onion.push(v(r, y, 0));
  }
  strokes.push({ points: onion, weight: "main" });
  strokes.push({ points: onion.map(([x, y]) => v(-x, y, 0)), weight: "main" });
  strokes.push({ points: onion.map(([x, y]) => v(0, y, x)), weight: "fine" });
  strokes.push({ points: [v(0, domeH, 0), v(0, H, 0)], weight: "fine" });
  return strokes;
}

/** Khufu: base 230.3 m, original height 146.6 m. */
function pyramidHistoric(H: number): GhostStroke[] {
  const half = (H * (230.3 / 146.6)) / 2;
  const apex = v(0, H, 0);
  const a = v(-half, 0, -half);
  const b = v(half, 0, -half);
  const c = v(half, 0, half);
  const d = v(-half, 0, half);
  return [
    { points: [a, b, c, d, a], weight: "main" },
    { points: [a, apex], weight: "main" },
    { points: [b, apex], weight: "main" },
    { points: [c, apex], weight: "main" },
    { points: [d, apex], weight: "main" },
  ];
}

export function homeOf(inst: { position: Vec3; home?: Vec3 }): Vec3 {
  return inst.home ?? inst.position;
}

export function dist3(a: Vec3, b: Vec3) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
