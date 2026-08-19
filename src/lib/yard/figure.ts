/**
 * Figure armature — one connected wire for any living / posed thing.
 * Named animals are proportion shortcuts. Unknown characters still
 * get a stance (biped / quadruped / longneck / winged) so Grok has
 * a real skeleton to refine, and offline still looks like a creature.
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
  const out: FigureStroke[] = [
    stroke("leg", [pt(-hx, 0, -hz), pt(-hx, hip, -hz)]),
    stroke("leg", [pt(hx, 0, hz), pt(hx, hip, hz)]),
    ...hipRect(hx, hip, hz),
    stroke("support", [pt(0, hip, 0), pt(0, shoulder, 0), pt(0, H * 0.88, 0)]),
    stroke("ring", [
      pt(-hx * 1.1, shoulder, -hz),
      pt(hx * 1.1, shoulder, -hz),
      pt(hx * 1.1, shoulder, hz),
      pt(-hx * 1.1, shoulder, hz),
      pt(-hx * 1.1, shoulder, -hz),
    ]),
    stroke("tip", [pt(0, H * 0.88, 0), pt(0, H, 0)]),
  ];
  if (raised) {
    out.push(
      stroke("brace", [pt(hx * 1.1, shoulder, 0), pt(H * 0.22, H * 0.92, 0), pt(H * 0.26, H, 0)]),
      stroke("brace", [pt(-hx * 1.1, shoulder, 0), pt(-H * 0.16, H * 0.58, 0)]),
    );
  } else {
    out.push(
      stroke("brace", [pt(hx * 1.1, shoulder, 0), pt(H * 0.16, H * 0.5, 0)]),
      stroke("brace", [pt(-hx * 1.1, shoulder, 0), pt(-H * 0.16, H * 0.5, 0)]),
    );
  }
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
    stroke("leg", [pt(-hx, y0, -hz), pt(-hx, hip, -hz)]),
    stroke("leg", [pt(hx, y0, hz), pt(hx, hip, hz)]),
    stroke("rail", [
      pt(-hx * 1.6, y0, -hz * 1.4),
      pt(hx * 1.6, y0, -hz * 1.4),
      pt(hx * 1.6, y0, hz * 1.4),
      pt(-hx * 1.6, y0, hz * 1.4),
      pt(-hx * 1.6, y0, -hz * 1.4),
    ]),
    stroke("support", [pt(-hx * 1.4, y0, 0), pt(-hx, hip, 0), pt(0, shoulder, 0)]),
    stroke("support", [pt(hx * 1.4, y0, 0), pt(hx, hip, 0), pt(0, shoulder, 0)]),
    ...hipRect(hx, hip, hz),
    stroke("support", [pt(0, hip, 0), pt(0, shoulder, 0), pt(0, y0 + fig * 0.88, 0)]),
    stroke("brace", [pt(hx, shoulder, 0), pt(fig * 0.28, y0 + fig * 0.92, 0), pt(fig * 0.32, H, 0)]),
    stroke("tip", [pt(fig * 0.32, H, 0), pt(fig * 0.32, H + fig * 0.04, 0)]),
    stroke("brace", [pt(-hx, shoulder, 0), pt(-fig * 0.14, y0 + fig * 0.52, 0)]),
    stroke("ring", [
      pt(-hx * 0.7, y0 + fig * 0.92, -hz),
      pt(hx * 0.7, y0 + fig * 0.92, -hz),
      pt(hx * 0.7, y0 + fig * 0.92, hz),
      pt(-hx * 0.7, y0 + fig * 0.92, hz),
      pt(-hx * 0.7, y0 + fig * 0.92, -hz),
    ]),
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
  return [
    stroke("leg", [pt(hipX - L * 0.04, 0, -z), pt(hipX, hip, -z)]),
    stroke("leg", [pt(hipX + L * 0.06, 0, z), pt(hipX, hip, z)]),
    stroke("leg", [pt(shX + L * 0.04, 0, -z), pt(shX, shoulder, -z)]),
    stroke("leg", [pt(shX - L * 0.04, 0, z), pt(shX, shoulder, z)]),
    stroke("rail", [
      pt(hipX, hip, -z),
      pt(hipX, hip, z),
      pt(shX, shoulder, z),
      pt(shX, shoulder, -z),
      pt(hipX, hip, -z),
    ]),
    stroke("support", [
      pt(hipX, hip, 0),
      pt((hipX + shX) / 2, hip + H * 0.05, 0),
      pt(shX, shoulder, 0),
    ]),
    stroke("support", [
      pt(shX, shoulder, 0),
      pt(shX - L * 0.06, H * 0.68, 0),
      pt(shX + L * 0.02, H * 0.86, 0),
      pt(shX + L * 0.08, H * 0.96, 0),
    ]),
    stroke("tip", [pt(shX + L * 0.08, H * 0.96, 0), pt(shX + L * 0.2, H * 0.98, 0)]),
  ];
}

function quadrupedStrokes(H: number, L: number): FigureStroke[] {
  const hip = H * 0.48;
  const z = H * 0.08;
  const hipX = L * 0.28;
  const shX = -L * 0.22;
  return [
    stroke("leg", [pt(hipX, 0, -z), pt(hipX, hip, -z)]),
    stroke("leg", [pt(hipX, 0, z), pt(hipX, hip, z)]),
    stroke("leg", [pt(shX, 0, -z), pt(shX, hip, -z)]),
    stroke("leg", [pt(shX, 0, z), pt(shX, hip, z)]),
    stroke("rail", [pt(hipX, hip, -z), pt(hipX, hip, z), pt(shX, hip, z), pt(shX, hip, -z), pt(hipX, hip, -z)]),
    stroke("support", [pt(hipX, hip, 0), pt(0, hip + H * 0.04, 0), pt(shX, hip, 0)]),
    stroke("support", [pt(shX, hip, 0), pt(shX - L * 0.08, H * 0.72, 0), pt(shX - L * 0.04, H * 0.9, 0)]),
    stroke("tip", [pt(shX - L * 0.04, H * 0.9, 0), pt(shX + L * 0.08, H * 0.92, 0)]),
    stroke("brace", [pt(hipX, hip, 0), pt(hipX + L * 0.22, H * 0.38, 0)]),
  ];
}

function wingedStrokes(H: number): FigureStroke[] {
  const body = quadrupedStrokes(H * 0.7, H);
  const sy = H * 0.42;
  body.push(
    stroke("brace", [pt(0, sy, 0), pt(-H * 0.55, sy + H * 0.12, -H * 0.05), pt(-H * 0.7, sy - H * 0.05, 0)]),
    stroke("brace", [pt(0, sy, 0), pt(H * 0.55, sy + H * 0.12, H * 0.05), pt(H * 0.7, sy - H * 0.05, 0)]),
  );
  return body;
}
