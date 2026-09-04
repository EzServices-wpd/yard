/**
 * Figure armature — one connected wire for any living / posed thing.
 * Named animals are proportion shortcuts. Unknown characters still
 * get a stance so Grok has a skeleton to refine, and offline still
 * reads as a creature with enough members to take stock.
 */

import type { FigureStance } from "./anatomy";

export type FigureStroke = {
  points: { x: number; y: number; z: number }[];
  role?: string;
};

type P = { x: number; y: number; z: number };

const pt = (x: number, y: number, z: number): P => ({ x, y, z });

function stroke(role: string, points: P[]): FigureStroke {
  return { role, points };
}

function hoop(role: string, x: number, y: number, rx: number, rz: number, n = 6): FigureStroke {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(pt(x + Math.cos(a) * rx, y, Math.sin(a) * rz));
  }
  return stroke(role, pts);
}

function bentLeg(role: string, foot: P, hip: P, kneeIn = 0.12): FigureStroke {
  const mid: P = {
    x: (foot.x + hip.x) / 2,
    y: (foot.y + hip.y) * 0.48,
    z: (foot.z + hip.z) / 2 + kneeIn * (hip.y - foot.y),
  };
  return stroke(role, [foot, mid, hip]);
}

export function figureStrokes(opts: {
  height: number;
  stance: FigureStance;
  width?: number;
}): FigureStroke[] {
  const H = Math.max(opts.height, 8);
  switch (opts.stance) {
    case "liberty":
      return libertyStrokes(H);
    case "longneck":
      return longneckStrokes(H);
    case "winged":
      return wingedStrokes(H);
    case "wyvern":
      return wyvernStrokes(H);
    case "biped":
      return bipedStrokes(H, false);
    default:
      return quadrupedStrokes(H, opts.width ?? H * 1.15);
  }
}

function hipRect(hx: number, y: number, z: number): FigureStroke[] {
  const a = pt(hx, y, -z);
  const b = pt(hx, y, z);
  const c = pt(-hx, y, z);
  const d = pt(-hx, y, -z);
  return [stroke("rail", [a, b, c, d, a])];
}

function bipedStrokes(H: number, raised: boolean): FigureStroke[] {
  const hip = H * 0.48;
  const shoulder = H * 0.72;
  const hz = H * 0.05;
  const hx = H * 0.07;
  const knee = H * 0.24;
  const out: FigureStroke[] = [
    bentLeg("leg", pt(-hx, 0, -hz), pt(-hx, hip, -hz), 0.08),
    bentLeg("leg", pt(hx, 0, hz), pt(hx, hip, hz), -0.08),
    ...hipRect(hx, hip, hz),
    hoop("ring", 0, hip + H * 0.08, hx * 1.15, hz * 1.2, 8),
    hoop("ring", 0, H * 0.54, hx * 1.1, hz * 1.15, 8),
    hoop("ring", 0, H * 0.6, hx * 1.05, hz * 1.1, 8),
    stroke("support", [pt(0, hip, 0), pt(0, H * 0.54, 0), pt(0, H * 0.6, 0), pt(0, shoulder, 0), pt(0, H * 0.88, 0)]),
    stroke("rail", [pt(-hx * 1.05, H * 0.54, -hz), pt(hx * 1.05, H * 0.54, hz)]),
    stroke("brace", [pt(-hx, hip, -hz), pt(hx, H * 0.54, hz)]),
    stroke("brace", [pt(hx, hip, hz), pt(-hx, H * 0.54, -hz)]),
    hoop("ring", 0, shoulder, hx * 1.25, hz * 1.15, 6),
    hoop("tip", 0, H * 0.94, hx * 0.7, hz * 0.7, 6),
    stroke("tip", [pt(0, H * 0.88, 0), pt(0, H, 0)]),
  ];
  if (raised) {
    out.push(
      stroke("brace", [pt(hx * 1.1, shoulder, 0), pt(H * 0.18, H * 0.82, 0), pt(H * 0.22, H * 0.92, 0), pt(H * 0.26, H, 0)]),
      stroke("brace", [pt(-hx * 1.1, shoulder, 0), pt(-H * 0.14, H * 0.62, 0), pt(-H * 0.16, H * 0.5, 0)]),
    );
  } else {
    out.push(
      stroke("brace", [pt(hx * 1.1, shoulder, 0), pt(H * 0.14, H * 0.6, 0), pt(H * 0.16, H * 0.48, 0)]),
      stroke("brace", [pt(-hx * 1.1, shoulder, 0), pt(-H * 0.14, H * 0.6, 0), pt(-H * 0.16, H * 0.48, 0)]),
    );
  }
  out.push(
    stroke("rail", [pt(-hx, knee, -hz), pt(hx, knee, hz)]),
    stroke("support", [pt(-hx * 0.4, hip, 0), pt(hx * 0.4, hip, 0)]),
  );
  return out;
}

function libertyStrokes(H: number): FigureStroke[] {
  const y0 = H * 0.48;
  const fig = H - y0;
  const hip = y0 + fig * 0.42;
  const shoulder = y0 + fig * 0.68;
  const hx = fig * 0.08;
  const hz = fig * 0.05;
  return [
    stroke("leg", [pt(-hx * 1.6, 0, -hz * 1.4), pt(-hx * 1.6, y0, -hz * 1.4)]),
    stroke("leg", [pt(hx * 1.6, 0, -hz * 1.4), pt(hx * 1.6, y0, -hz * 1.4)]),
    stroke("leg", [pt(hx * 1.6, 0, hz * 1.4), pt(hx * 1.6, y0, hz * 1.4)]),
    stroke("leg", [pt(-hx * 1.6, 0, hz * 1.4), pt(-hx * 1.6, y0, hz * 1.4)]),
    stroke("rail", [
      pt(-hx * 1.6, 0, -hz * 1.4),
      pt(hx * 1.6, 0, -hz * 1.4),
      pt(hx * 1.6, 0, hz * 1.4),
      pt(-hx * 1.6, 0, hz * 1.4),
      pt(-hx * 1.6, 0, -hz * 1.4),
    ]),
    stroke("rail", [
      pt(-hx * 1.6, y0, -hz * 1.4),
      pt(hx * 1.6, y0, -hz * 1.4),
      pt(hx * 1.6, y0, hz * 1.4),
      pt(-hx * 1.6, y0, hz * 1.4),
      pt(-hx * 1.6, y0, -hz * 1.4),
    ]),
    hoop("ring", 0, y0 * 0.5, hx * 1.55, hz * 1.35, 8),
    bentLeg("leg", pt(-hx, y0, -hz), pt(-hx, hip, -hz), 0.06),
    bentLeg("leg", pt(hx, y0, hz), pt(hx, hip, hz), -0.06),
    stroke("support", [pt(-hx * 1.4, y0, 0), pt(-hx, hip, 0), pt(0, shoulder, 0)]),
    stroke("support", [pt(hx * 1.4, y0, 0), pt(hx, hip, 0), pt(0, shoulder, 0)]),
    ...hipRect(hx, hip, hz),
    hoop("ring", 0, hip + fig * 0.08, hx * 1.3, hz * 1.2, 6),
    hoop("ring", 0, shoulder, hx * 1.15, hz, 6),
    stroke("support", [pt(0, hip, 0), pt(0, shoulder, 0), pt(0, y0 + fig * 0.88, 0)]),
    stroke("brace", [pt(hx, shoulder, 0), pt(fig * 0.22, y0 + fig * 0.82, 0), pt(fig * 0.28, y0 + fig * 0.92, 0), pt(fig * 0.32, H, 0)]),
    stroke("tip", [pt(fig * 0.32, H, 0), pt(fig * 0.32, H + fig * 0.04, 0), pt(fig * 0.28, H + fig * 0.05, 0)]),
    stroke("brace", [pt(-hx, shoulder, 0), pt(-fig * 0.12, y0 + fig * 0.58, 0), pt(-fig * 0.14, y0 + fig * 0.5, 0)]),
    hoop("tip", 0, y0 + fig * 0.94, hx * 0.65, hz * 0.65, 6),
    stroke("tip", [pt(0, y0 + fig * 0.88, 0), pt(0, H * 0.98, 0)]),
  ];
}

function longneckStrokes(H: number): FigureStroke[] {
  const L = H * (4.3 / 5.5);
  const hip = H * 0.42;
  const shoulder = H * 0.46;
  const z = H * 0.055;
  const hipX = L * 0.78;
  const shX = L * 0.22;
  const neck = [
    pt(shX, shoulder, 0),
    pt(shX - L * 0.04, H * 0.58, 0),
    pt(shX - L * 0.06, H * 0.68, 0),
    pt(shX - L * 0.02, H * 0.78, 0),
    pt(shX + L * 0.02, H * 0.86, 0),
    pt(shX + L * 0.08, H * 0.96, 0),
  ];
  return [
    bentLeg("leg", pt(hipX - L * 0.04, 0, -z), pt(hipX, hip, -z), 0.1),
    bentLeg("leg", pt(hipX + L * 0.06, 0, z), pt(hipX, hip, z), -0.1),
    bentLeg("leg", pt(shX + L * 0.04, 0, -z), pt(shX, shoulder, -z), 0.1),
    bentLeg("leg", pt(shX - L * 0.04, 0, z), pt(shX, shoulder, z), -0.1),
    stroke("rail", [
      pt(hipX, hip, -z),
      pt(hipX, hip, z),
      pt(shX, shoulder, z),
      pt(shX, shoulder, -z),
      pt(hipX, hip, -z),
    ]),
    hoop("ring", hipX, hip, L * 0.06, z * 1.15, 6),
    hoop("ring", (hipX + shX) / 2, hip + H * 0.04, L * 0.07, z * 1.2, 6),
    hoop("ring", shX, shoulder, L * 0.055, z, 6),
    stroke("support", [pt(hipX, hip, 0), pt((hipX + shX) / 2, hip + H * 0.05, 0), pt(shX, shoulder, 0)]),
    stroke("support", neck),
    stroke("tip", [pt(shX + L * 0.08, H * 0.96, 0), pt(shX + L * 0.16, H * 0.99, 0), pt(shX + L * 0.22, H * 0.97, 0)]),
    stroke("tip", [pt(shX + L * 0.1, H * 0.99, -z * 0.4), pt(shX + L * 0.1, H * 1.04, -z * 0.4)]),
    stroke("tip", [pt(shX + L * 0.1, H * 0.99, z * 0.4), pt(shX + L * 0.1, H * 1.04, z * 0.4)]),
    stroke("brace", [pt(hipX, hip, 0), pt(hipX + L * 0.16, H * 0.36, 0), pt(hipX + L * 0.22, H * 0.28, 0)]),
  ];
}

function quadrupedStrokes(H: number, L: number): FigureStroke[] {
  const hip = H * 0.48;
  const z = H * 0.08;
  const hipX = L * 0.28;
  const shX = -L * 0.22;
  const midX = (hipX + shX) / 2;
  const knee = hip * 0.48;
  // Denser craft armature: more ribs + belly rails + cross ties so popsicle
  // densify reads as an animal, not four sticks and a hoop — still one connected wire.
  return [
    bentLeg("leg", pt(hipX, 0, -z), pt(hipX, hip, -z), 0.12),
    bentLeg("leg", pt(hipX, 0, z), pt(hipX, hip, z), -0.12),
    bentLeg("leg", pt(shX, 0, -z), pt(shX, hip, -z), 0.12),
    bentLeg("leg", pt(shX, 0, z), pt(shX, hip, z), -0.12),
    // Knee spreader + hock rails — lateral ribs on the legs.
    stroke("rail", [pt(hipX, knee, -z), pt(hipX, knee, z)]),
    stroke("rail", [pt(shX, knee, -z), pt(shX, knee, z)]),
    stroke("rail", [pt(hipX, knee, -z), pt(shX, knee, -z)]),
    stroke("rail", [pt(hipX, knee, z), pt(shX, knee, z)]),
    // Hip deck + belly stringers (paired for stick densify).
    stroke("rail", [pt(hipX, hip, -z), pt(hipX, hip, z), pt(shX, hip, z), pt(shX, hip, -z), pt(hipX, hip, -z)]),
    stroke("support", [pt(hipX, hip - H * 0.02, -z * 0.55), pt(midX, hip - H * 0.04, -z * 0.7), pt(shX, hip - H * 0.02, -z * 0.55)]),
    stroke("support", [pt(hipX, hip - H * 0.02, z * 0.55), pt(midX, hip - H * 0.04, z * 0.7), pt(shX, hip - H * 0.02, z * 0.55)]),
    stroke("support", [pt(hipX, hip, 0), pt(midX, hip + H * 0.04, 0), pt(shX, hip, 0)]),
    stroke("support", [pt(hipX, hip + H * 0.02, -z * 0.35), pt(midX, hip + H * 0.08, 0), pt(shX, hip + H * 0.02, z * 0.35)]),
    // Rib hoops along the torso (hip → mid → chest → withers).
    hoop("ring", hipX, hip, L * 0.06, z * 1.1, 8),
    hoop("ring", hipX * 0.55, hip + H * 0.03, L * 0.07, z * 1.15, 8),
    hoop("ring", midX, hip + H * 0.06, L * 0.085, z * 1.25, 8),
    hoop("ring", shX * 0.55, hip + H * 0.04, L * 0.07, z * 1.15, 8),
    hoop("ring", shX, hip, L * 0.055, z * 1.05, 8),
    // Cross braces on the chest / loin so faces densify with whole sticks.
    stroke("brace", [pt(hipX, hip, -z), pt(midX, hip + H * 0.06, z)]),
    stroke("brace", [pt(hipX, hip, z), pt(midX, hip + H * 0.06, -z)]),
    stroke("brace", [pt(shX, hip, -z), pt(midX, hip + H * 0.06, z)]),
    stroke("brace", [pt(shX, hip, z), pt(midX, hip + H * 0.06, -z)]),
    // Neck chain with intermediate stations + collar ring.
    stroke("support", [
      pt(shX, hip, 0),
      pt(shX - L * 0.03, H * 0.56, 0),
      pt(shX - L * 0.055, H * 0.66, 0),
      pt(shX - L * 0.075, H * 0.76, 0),
      pt(shX - L * 0.05, H * 0.86, 0),
      pt(shX - L * 0.02, H * 0.92, 0),
    ]),
    hoop("ring", shX - L * 0.04, H * 0.7, L * 0.035, z * 0.85, 6),
    hoop("tip", shX - L * 0.02, H * 0.92, L * 0.045, z * 0.75, 6),
    stroke("tip", [pt(shX - L * 0.04, H * 0.9, 0), pt(shX + L * 0.12, H * 0.93, 0), pt(shX + L * 0.16, H * 0.91, 0)]),
    stroke("tip", [pt(shX - L * 0.02, H * 0.96, -z * 0.55), pt(shX - L * 0.02, H, -z * 0.55)]),
    stroke("tip", [pt(shX - L * 0.02, H * 0.96, z * 0.55), pt(shX - L * 0.02, H, z * 0.55)]),
    // Tail with an extra mid vertebra + lateral flare.
    stroke("brace", [pt(hipX, hip, 0), pt(hipX + L * 0.1, H * 0.44, 0), pt(hipX + L * 0.18, H * 0.38, 0), pt(hipX + L * 0.28, H * 0.32, 0)]),
    stroke("brace", [pt(hipX + L * 0.12, H * 0.42, -z * 0.35), pt(hipX + L * 0.22, H * 0.34, 0)]),
    stroke("brace", [pt(hipX + L * 0.12, H * 0.42, z * 0.35), pt(hipX + L * 0.22, H * 0.34, 0)]),
  ];
}

function wingedStrokes(H: number): FigureStroke[] {
  const body = quadrupedStrokes(H * 0.72, H);
  const sy = H * 0.4;
  body.push(
    stroke("brace", [pt(0, sy, 0), pt(-H * 0.28, sy + H * 0.1, -H * 0.04), pt(-H * 0.55, sy + H * 0.14, -H * 0.06), pt(-H * 0.72, sy - H * 0.04, 0)]),
    stroke("brace", [pt(0, sy, 0), pt(H * 0.28, sy + H * 0.1, H * 0.04), pt(H * 0.55, sy + H * 0.14, H * 0.06), pt(H * 0.72, sy - H * 0.04, 0)]),
    stroke("rail", [pt(-H * 0.28, sy + H * 0.1, -H * 0.04), pt(-H * 0.2, sy - H * 0.02, 0), pt(-H * 0.55, sy - H * 0.06, 0)]),
    stroke("rail", [pt(H * 0.28, sy + H * 0.1, H * 0.04), pt(H * 0.2, sy - H * 0.02, 0), pt(H * 0.55, sy - H * 0.06, 0)]),
  );
  return body;
}

/** Biped + wings + tail + snout — Charizard, Godzilla, a dragon on two legs. */
function wyvernStrokes(H: number): FigureStroke[] {
  const hip = H * 0.38;
  const shoulder = H * 0.62;
  const hx = H * 0.08;
  const hz = H * 0.06;
  return [
    bentLeg("leg", pt(-hx, 0, -hz), pt(-hx, hip, -hz), 0.14),
    bentLeg("leg", pt(hx, 0, hz), pt(hx, hip, hz), -0.14),
    ...hipRect(hx * 1.1, hip, hz),
    hoop("ring", 0, hip + H * 0.06, hx * 1.3, hz * 1.3, 6),
    hoop("ring", 0, H * 0.5, hx * 1.2, hz * 1.2, 6),
    stroke("support", [pt(0, hip, 0), pt(0, H * 0.5, 0), pt(0, shoulder, 0), pt(0, H * 0.78, 0)]),
    hoop("ring", 0, shoulder, hx * 1.15, hz, 6),
    stroke("brace", [pt(hx * 1.1, shoulder, 0), pt(H * 0.14, H * 0.52, 0), pt(H * 0.16, H * 0.42, 0)]),
    stroke("brace", [pt(-hx * 1.1, shoulder, 0), pt(-H * 0.14, H * 0.52, 0), pt(-H * 0.16, H * 0.42, 0)]),
    stroke("brace", [
      pt(0, shoulder, 0),
      pt(-H * 0.22, shoulder + H * 0.08, -H * 0.04),
      pt(-H * 0.42, shoulder + H * 0.12, -H * 0.06),
      pt(-H * 0.58, shoulder - H * 0.02, 0),
    ]),
    stroke("brace", [
      pt(0, shoulder, 0),
      pt(H * 0.22, shoulder + H * 0.08, H * 0.04),
      pt(H * 0.42, shoulder + H * 0.12, H * 0.06),
      pt(H * 0.58, shoulder - H * 0.02, 0),
    ]),
    stroke("rail", [pt(-H * 0.22, shoulder + H * 0.08, -H * 0.04), pt(-H * 0.18, shoulder - H * 0.04, 0), pt(-H * 0.4, shoulder - H * 0.06, 0)]),
    stroke("rail", [pt(H * 0.22, shoulder + H * 0.08, H * 0.04), pt(H * 0.18, shoulder - H * 0.04, 0), pt(H * 0.4, shoulder - H * 0.06, 0)]),
    stroke("support", [
      pt(0, hip, 0),
      pt(H * 0.12, hip - H * 0.04, 0),
      pt(H * 0.22, H * 0.22, 0),
      pt(H * 0.28, H * 0.08, 0),
    ]),
    stroke("support", [
      pt(0, H * 0.78, 0),
      pt(H * 0.04, H * 0.86, 0),
      pt(H * 0.1, H * 0.92, 0),
    ]),
    stroke("tip", [pt(H * 0.1, H * 0.92, 0), pt(H * 0.2, H * 0.9, 0)]),
    stroke("tip", [pt(H * 0.08, H * 0.96, -hz * 0.6), pt(H * 0.08, H, -hz * 0.6)]),
    stroke("tip", [pt(H * 0.08, H * 0.96, hz * 0.6), pt(H * 0.08, H, hz * 0.6)]),
    hoop("tip", H * 0.06, H * 0.9, hx * 0.55, hz * 0.55, 5),
  ];
}
