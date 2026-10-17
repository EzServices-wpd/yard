/**
 * Solid shapes, not bounding boxes: a ring is its band (its open centre is air), a bored part has a hole, a
 * dowel is a cylinder, a strut is a rod, an outlined plate is its outline. Two invariants read them:
 *
 * - I26 (no hidden overlap): no two solid parts share space unless a joint the plan cuts makes room for it
 *   (a declared dado, rabbet, lap, mortise, mitre or notch, or a hole the drilling step drills for a pin).
 * - I27 (rotors are held): every part that turns on a pin rides in an assembly the pin carries, with a stop on
 *   both sides along the pin (a collar, spacer or fixed part) so it can't slide more than 1/4" in total.
 *
 * Support and step code reads `shapeTouch` so a hub inside a ring's open centre never "sits on" the ring.
 */
import { isBoughtHardwareName } from "./boughtHardware";
import type { Panel, YardProject } from "./types";

type Ax = "x" | "y" | "z";
const AX: Ax[] = ["x", "y", "z"];
const SZ = { x: "width", y: "height", z: "depth" } as const;
/** Overlap deeper than this on every axis is interpenetration (the same 1/16" I16 uses). */
export const SOLID_EPS = 1 / 16;
/** A sample point counts as inside a solid only this far in from its surface. */
const SKIN = 1 / 64;

export const PIN_NAME = /\b(?:axle|pivot|shaft|pin|spindle|rod|dowel|peg)s?\b/i;
/** A pin: a dowel (or a part named axle/shaft) that other parts are drilled for or turn on. */
export const isPin = (p: Panel) => /^dowel-/.test(p.materialId) && PIN_NAME.test(p.name) && !p.polygon?.holes?.length;

/** The plane coordinates and extrusion axis of an outlined part. */
const planeAxes = (plane: "xz" | "xy" | "zy"): [Ax, Ax, Ax] => (plane === "xz" ? ["x", "z", "y"] : plane === "xy" ? ["x", "y", "z"] : ["z", "y", "x"]);

/** Parts judged by their real shape here. Curved forms, yawed and leaf parts are judged by their drawings elsewhere. */
export function solidPart(p: Panel): boolean {
  return !p.form && !p.outline && !p.yaw && !p.leaf && p.materialId !== "hardware" && !isBoughtHardwareName(p.name) && Math.min(p.size.width, p.size.height, p.size.depth) > 0.1;
}

function inPoly(pts: [number, number][], u: number, v: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function edgeDist(pts: [number, number][], u: number, v: number): number {
  let d = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j], [bx, by] = pts[i];
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / L2));
    d = Math.min(d, Math.hypot(ax + dx * t - u, ay + dy * t - v));
  }
  return d;
}

/** Is the world point inside the part's solid, at least `skin` in from its surface? */
export function insideSolid(p: Panel, q: Record<Ax, number>, skin = SKIN): boolean {
  const l = { x: q.x - p.position.x, y: q.y - p.position.y, z: q.z - p.position.z };
  for (const a of AX) if (l[a] < skin || l[a] > p.size[SZ[a]] - skin) return false;
  if (p.strut) {
    const { a, b, r } = p.strut;
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [l.x - a[0], l.y - a[1], l.z - a[2]];
    const L2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2 || 1;
    const t = Math.max(0, Math.min(1, (w[0] * d[0] + w[1] * d[1] + w[2] * d[2]) / L2));
    return Math.hypot(w[0] - d[0] * t, w[1] - d[1] * t, w[2] - d[2] * t) < r - skin;
  }
  if (p.polygon && p.polygon.pts.length >= 3) {
    const [ua, va] = planeAxes(p.polygon.plane);
    const u = l[ua], v = l[va];
    if (!inPoly(p.polygon.pts, u, v) || edgeDist(p.polygon.pts, u, v) < skin) return false;
    return !(p.polygon.holes ?? []).some((h) => Math.hypot(u - h.x, v - h.y) < h.r + skin);
  }
  if (/^dowel-/.test(p.materialId)) {
    // A dowel is round: a cylinder along its longest side.
    const L = AX.reduce((m, a) => (p.size[SZ[a]] > p.size[SZ[m]] ? a : m), "x" as Ax);
    const [a, b] = AX.filter((x) => x !== L);
    const r = Math.min(p.size[SZ[a]], p.size[SZ[b]]) / 2;
    return Math.hypot(l[a] - p.size[SZ[a]] / 2, l[b] - p.size[SZ[b]] / 2) < r - skin;
  }
  return true;
}

const boxOverlap = (a: Panel, b: Panel) => AX.map((k) => Math.min(a.position[k] + a.size[SZ[k]], b.position[k] + b.size[SZ[k]]) - Math.max(a.position[k], b.position[k]));

/** Some point lies inside both solids (sampled on a grid over the boxes' shared space). */
export function solidsOverlap(a: Panel, b: Panel, eps = SOLID_EPS, n = 8): boolean {
  const ov = boxOverlap(a, b);
  if (ov.some((v) => v <= eps)) return false;
  const lo = AX.map((k) => Math.max(a.position[k], b.position[k]));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
    const q = { x: lo[0] + (ov[0] * (i + 0.5)) / n, y: lo[1] + (ov[1] * (j + 0.5)) / n, z: lo[2] + (ov[2] * (k + 0.5)) / n };
    if (insideSolid(a, q) && insideSolid(b, q)) return true;
  }
  return false;
}

/**
 * The part sits wholly inside an open centre or bore of `ring` (a hub in a rim's open centre, an axle in a
 * wheel's open centre): their boxes meet, their solids never do.
 */
export function insideOpening(part: Panel, ring: Panel, tol = 0.05): boolean {
  const holes = ring.polygon?.holes;
  if (!holes?.length) return false;
  const [ua, va] = planeAxes(ring.polygon!.plane);
  const u0 = part.position[ua] - ring.position[ua], u1 = u0 + part.size[SZ[ua]];
  const v0 = part.position[va] - ring.position[va], v1 = v0 + part.size[SZ[va]];
  return holes.some((h) => [[u0, v0], [u1, v0], [u0, v1], [u1, v1]].every(([u, v]) => Math.hypot(u - h.x, v - h.y) <= h.r - tol));
}

/** Boxes within `gap` of each other on every axis, and neither lies in the other's open centre. */
export function shapeTouch(a: Panel, b: Panel, gap = 0.05): boolean {
  if (!AX.every((k) => a.position[k] <= b.position[k] + b.size[SZ[k]] + gap && b.position[k] <= a.position[k] + a.size[SZ[k]] + gap)) return false;
  return !insideOpening(a, b) && !insideOpening(b, a);
}

/** A joint the plan cuts for this pair: declared on either part (by id or name), or a hole drilled or bored for a pin. */
export function jointCutFor(a: Panel, b: Panel): boolean {
  const named = (p: Panel, q: Panel) => p.joints?.some((j) => j.with === q.id || j.with === q.name);
  if (named(a, b) || named(b, a)) return true;
  const drilled = (pin: Panel, host: Panel) => isPin(pin) && /\b(?:Drill (?:an? |\d+ )[^.]*holes?|[Bb]ored?\b|[Bb]ore an?\b)/.test(host.cutNote ?? "");
  return drilled(a, b) || drilled(b, a);
}

/** I26: pairs of solid parts that share space with no joint cut for it. */
export function hiddenOverlaps(project: Pick<YardProject, "panels">): string[] {
  const ps = project.panels.filter(solidPart);
  const out: string[] = [];
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      if (jointCutFor(a, b) || !solidsOverlap(a, b)) continue;
      out.push(`${a.name} runs into ${b.name} with no joint cut for it`);
    }
  return out;
}

const longAxis = (p: Panel) => AX.reduce((m, a) => (p.size[SZ[a]] > p.size[SZ[m]] ? a : m), "x" as Ax);
/** The pin runs through the part: the pin's centre line passes inside the part's box. */
function pierces(pin: Panel, p: Panel): boolean {
  const L = longAxis(pin);
  const cross = AX.filter((a) => a !== L);
  if (!cross.every((a) => { const c = pin.position[a] + pin.size[SZ[a]] / 2; return c > p.position[a] && c < p.position[a] + p.size[SZ[a]]; })) return false;
  return pin.position[L] < p.position[L] + p.size[SZ[L]] - 0.01 && p.position[L] < pin.position[L] + pin.size[SZ[L]] - 0.01;
}

/** Parts that slide on purpose (abacus beads) or swing on hinges are not rotors. */
const notRotor = (p: Panel, slides: Set<string>) => !!p.hinged || [...slides].some((s) => s.toLowerCase() === p.name.toLowerCase() || s.toLowerCase() === p.name.replace(/ \d+$/, "").toLowerCase()) || /\b(?:lid|door|flap|bed face|leaf)\b/i.test(p.name);

export type RotorReport = { pin: string; parts: string[]; play: number; stops: [string | null, string | null] };

/** Every rotor (parts that turn together on one pin) with its free play along the pin and its two stops. */
export function rotorAssemblies(project: Pick<YardProject, "panels">, slides: Set<string> = new Set()): { rotors: RotorReport[]; loose: string[] } {
  const ps = project.panels;
  const pins = ps.filter(isPin);
  const turning = ps.filter((p) => p.turns && !isPin(p) && !notRotor(p, slides));
  const rotors: RotorReport[] = [];
  const seen = new Set<Panel>();
  for (const pin of pins) {
    const L = longAxis(pin);
    const seeds = turning.filter((p) => !seen.has(p) && pierces(pin, p) && !insideOpening(pin, p));
    if (!seeds.length) continue;
    // The assembly: every turning part joined to the seeds by real contact.
    const group = new Set<Panel>(seeds);
    for (let grew = true; grew; ) {
      grew = false;
      for (const p of turning) if (!group.has(p) && [...group].some((g) => shapeTouch(p, g, 0.04))) { group.add(p); grew = true; }
    }
    group.forEach((p) => seen.add(p));
    // Faces that could bump a stop: the parts the pin runs through.
    const riders = [...group].filter((p) => pierces(pin, p));
    const lo = Math.min(...riders.map((p) => p.position[L])), hi = Math.max(...riders.map((p) => p.position[L] + p.size[SZ[L]]));
    const fixed = ps.filter((p) => p !== pin && !group.has(p) && !turning.includes(p) && pierces(pin, p));
    const left = fixed.filter((p) => p.position[L] + p.size[SZ[L]] <= lo + 0.01).sort((a, b) => b.position[L] + b.size[SZ[L]] - (a.position[L] + a.size[SZ[L]]))[0];
    const right = fixed.filter((p) => p.position[L] >= hi - 0.01).sort((a, b) => a.position[L] - b.position[L])[0];
    const gl = left ? lo - (left.position[L] + left.size[SZ[L]]) : Infinity, gr = right ? right.position[L] - hi : Infinity;
    rotors.push({ pin: pin.name, parts: [...group].map((p) => p.name), play: gl + gr, stops: [left?.name ?? null, right?.name ?? null] });
  }
  return { rotors, loose: turning.filter((p) => !seen.has(p)).map((p) => p.name) };
}

/** I27: a rotor slides more than 1/4" along its pin, or a turning part rides on no pin. */
export function rotorPlayFailures(project: Pick<YardProject, "panels">, slides?: Set<string>, maxPlay = 0.25): string[] {
  const { rotors, loose } = rotorAssemblies(project, slides);
  const out = rotors.filter((r) => !(r.play <= maxPlay + 1e-6)).map((r) => `${r.parts[0]} can slide ${Number.isFinite(r.play) ? `${Math.round(r.play * 16) / 16}"` : "off"} along the ${r.pin}: nothing holds it ${r.stops[0] && r.stops[1] ? "close" : "on one side"}`);
  for (const n of loose) out.push(`${n} turns but rides on no axle`);
  return out;
}

export const COLLAR_NAME = /\b(?:collar|spacer|washer)s?\b/i;

export type RotorLink = { on: string[]; how: "rests" | "side"; collar?: "fixed" | "free"; pin: string };

/**
 * How each rotor goes together on its pin, read from the geometry. The axle is glued in its first carrier
 * (the one at the high end), so everything threads on from the free low end, in order along the axle:
 * - the collar against the first carrier goes on first and is glued to the axle;
 * - then each rotor part in turn, from the high end down: a part the axle passes through slides onto it;
 *   every part is fixed to the parts it really touches that are already on (a spoke to its hub and rim face,
 *   a paddle to the rim it butts);
 * - last the collar at the free end, a card's thickness off the wheel.
 * Only rotors of more than one part, or with a collar, are listed (a lone wheel on an axle keeps its rule).
 */
export function rotorChain(panels: Panel[]): Map<string, RotorLink> {
  const out = new Map<string, RotorLink>();
  const turning = panels.filter((p) => p.turns && !isPin(p) && !notRotor(p, new Set()));
  const taken = new Set<Panel>();
  for (const pin of panels.filter(isPin)) {
    const L = longAxis(pin);
    const lo = (p: Panel) => p.position[L], hi = (p: Panel) => p.position[L] + p.size[SZ[L]];
    const seeds = turning.filter((p) => !taken.has(p) && pierces(pin, p) && !insideOpening(pin, p));
    if (!seeds.length) continue;
    const group = new Set<Panel>(seeds);
    for (let grew = true; grew; ) {
      grew = false;
      for (const p of turning) if (!group.has(p) && [...group].some((g) => shapeTouch(p, g, 0.04))) { group.add(p); grew = true; }
    }
    const collars = panels.filter((p) => !p.turns && COLLAR_NAME.test(p.name) && pierces(pin, p));
    if (group.size < 2 && !collars.length) continue;
    group.forEach((p) => taken.add(p));
    const gHi = Math.max(...[...group].map(hi)), gLo = Math.min(...[...group].map(lo));
    const fixedCollar = collars.filter((c) => lo(c) >= gHi - 0.05);
    const freeCollar = collars.filter((c) => hi(c) <= gLo + 0.05);
    const on = new Set<Panel>();
    for (const c of fixedCollar) { out.set(c.id, { on: [pin.id], how: "rests", collar: "fixed", pin: pin.id }); on.add(c); }
    const order = [...group].sort((a, b) => hi(b) - hi(a) || Number(pierces(pin, b)) - Number(pierces(pin, a)));
    for (const p of order) {
      const touch = [...on].filter((q) => shapeTouch(p, q, 0.04)).map((q) => q.id);
      const rides = pierces(pin, p) && !insideOpening(pin, p);
      out.set(p.id, { on: rides ? [pin.id, ...touch] : touch.length ? touch : [pin.id], how: rides ? "rests" : "side", pin: pin.id });
      on.add(p);
    }
    for (const c of freeCollar) {
      const near = [...group].filter((p) => pierces(pin, p)).sort((a, b) => lo(a) - lo(b))[0];
      out.set(c.id, { on: [pin.id, ...(near ? [near.id] : [])], how: "side", collar: "free", pin: pin.id });
    }
  }
  return out;
}
