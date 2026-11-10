/**
 * Assembly order, from the part boxes only.
 *
 * Start from the written order. Move a step only when a part it places, tests, or hangs
 * is still ahead of a part that box contact says it rests on, butts into, or is fastened
 * under, and the move adds no new fault. A cut, level, or glue step stays put. A step that
 * places several parts stays put. Anything two-way or unclear stays in the written order.
 */
import { getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import type { AssemblyStep, Panel, Vec3, YardInstance, YardProject } from "./types";

const GAP = 1 / 16;
const STACK = 0.08;
const BEAR = 0.25;
const FROZEN =
  /^(?:confirm|cut|read|lay out|do not|print|count|mark|level|seal|splice|prep|label|glue up|join sheet|drill|sand|finish|paint|before)\b/i;
const TEST = /\bopen\/close\b|\btest\b/i;
const HANG_ALL = /^hang it\b/i;
const STOP = new Set([
  "top",
  "back",
  "side",
  "edge",
  "face",
  "floor",
  "wall",
  "base",
  "part",
  "door",
  "rail",
  "post",
  "leg",
  "lid",
  "seat",
  "box",
  "step",
  "end",
  "foot",
  "feet",
  "arm",
  "shelf",
  "board",
  "panel",
  "frame",
  "apron",
  "riser",
  "tread",
]);
const SIDE = /^(?:left|right|front|back|center|centre)\s+/i;

type Aabb = {
  name: string;
  min: [number, number, number];
  max: [number, number, number];
  turns: boolean;
};
type Fault = {
  kind: "geom" | "test" | "hang" | "edge" | "names";
  part: string;
  on: string;
  at: number;
};

const overlap = (a: Aabb, b: Aabb, k: number) =>
  Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]);
const gapOf = (a: Aabb, b: Aabb, k: number) =>
  Math.max(a.min[k], b.min[k]) - Math.min(a.max[k], b.max[k]);
const longest = (b: Aabb) => {
  const e = [0, 1, 2].map((k) => b.max[k] - b.min[k]);
  return e.indexOf(Math.max(...e));
};

/** A short plate on the floor (a caster), fastened under whatever sits on it. */
function isPad(b: Aabb): boolean {
  return (
    b.min[1] <= 0.15 &&
    b.max[1] - b.min[1] <= 3.25 &&
    b.max[0] - b.min[0] <= 4 &&
    b.max[2] - b.min[2] <= 4
  );
}

function panelBox(p: Panel): Aabb | null {
  if (p.type === "drawer" || p.polygon || p.strut || Math.abs(p.yaw ?? 0) > 1e-3) return null;
  const { x, y, z } = p.position;
  const { width: w, height: h, depth: d } = p.size;
  return { name: p.name, min: [x, y, z], max: [x + w, y + h, z + d], turns: !!p.turns };
}

const vsub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const vdot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const vcross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const vnorm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

function stickAabb(project: YardProject, inst: YardInstance): Aabb | null {
  if (!inst.from || !inst.to) return null;
  const item = getCatalogItem(inst.catalogId) ?? getCatalogItem(project.primaryMaterialId);
  if (!item) return null;
  const prim = toPrimitive(item, inst.cutLength);
  const d = vnorm(vsub(inst.to, inst.from));
  const span = Math.hypot(
    inst.to.x - inst.from.x,
    inst.to.y - inst.from.y,
    inst.to.z - inst.from.z,
  );
  const disc =
    inst.round ?? (item.shape === "ball" ? (item.dims.diameter ?? prim.width) : undefined);
  const L = disc ? span : Math.max(span, inst.cutLength ?? 0);
  let f = inst.face
    ? vnorm(inst.face)
    : Math.abs(d.y) < 0.9
      ? { x: 0, y: 1, z: 0 }
      : { x: 1, y: 0, z: 0 };
  f = vnorm(vsub(f, { x: d.x * vdot(f, d), y: d.y * vdot(f, d), z: d.z * vdot(f, d) }));
  const w = vnorm(vcross(d, f));
  const half: [number, number, number] = disc
    ? [Math.max(L, item.shape === "ball" ? disc : 0) / 2, disc / 2, disc / 2]
    : inst.section
      ? [L / 2, inst.section.width / 2, inst.section.height / 2]
      : prim.radius != null && !inst.section
        ? [L / 2, prim.width / 2, prim.width / 2]
        : [L / 2, prim.width / 2, prim.height / 2];
  const c = [
    (inst.from.x + inst.to.x) / 2,
    (inst.from.y + inst.to.y) / 2,
    (inst.from.z + inst.to.z) / 2,
  ];
  const axes = [d, w, f];
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const signs = [sx, sy, sz];
        const p = [c[0], c[1], c[2]];
        for (let k = 0; k < 3; k++)
          for (let a = 0; a < 3; a++)
            p[a] += signs[k] * half[k] * [axes[k].x, axes[k].y, axes[k].z][a];
        for (let a = 0; a < 3; a++) {
          min[a] = Math.min(min[a], p[a]);
          max[a] = Math.max(max[a], p[a]);
        }
      }
  return { name: inst.role || "member", min, max, turns: false };
}

/** World boxes of the parts a step can place. A turned part (a rotor) is placed, and never a support edge. */
function partBoxes(project: YardProject): Aabb[] {
  if (project.panels.length) return project.panels.map(panelBox).filter((b): b is Aabb => !!b);
  return project.instances.map((i) => stickAabb(project, i)).filter((b): b is Aabb => !!b);
}

// A leg, a base, a body, a wheel, or an axle: contact does not say which one is stood first.
const AMBIGUOUS = /\b(?:legs?|bases?|bod(?:y|ies)|wheels?|axles?)\b/i;

function addEdge(edges: Map<string, Set<string>>, part: string, on: string) {
  if (!part || !on || part === on || AMBIGUOUS.test(part) || AMBIGUOUS.test(on)) return;
  if (!edges.has(part)) edges.set(part, new Set());
  edges.get(part)!.add(on);
}

/**
 * An underside that only kisses an edge (a riser on the back of a tread, a counter on a drawer front).
 * Not enough to move a step. Enough to refuse a move that would stand the upper piece first.
 */
function kissEdges(project: YardProject): Map<string, Set<string>> {
  const boxes = partBoxes(project).filter((b) => !b.turns);
  const edges = new Map<string, Set<string>>();
  const touch = (a: Aabb, b: Aabb, k: number) => overlap(a, b, k) >= -STACK;
  const span = (a: Aabb, b: Aabb, k: number) => overlap(a, b, k) >= BEAR;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      const kiss = (upper: Aabb, lower: Aabb) => {
        const y = upper.min[1] - lower.max[1];
        if (y > STACK || y < -STACK || isPad(lower)) return;
        const full = span(upper, lower, 0) && span(upper, lower, 2);
        const edge =
          (span(upper, lower, 0) && touch(upper, lower, 2)) ||
          (span(upper, lower, 2) && touch(upper, lower, 0));
        if (!full && edge) addEdge(edges, upper.name, lower.name);
      };
      kiss(a, b);
      kiss(b, a);
    }
  }
  for (const [name, ons] of edges) {
    for (const on of [...ons])
      if (edges.get(on)?.has(name)) {
        ons.delete(on);
        edges.get(on)!.delete(name);
      }
  }
  return edges;
}

/** part → names it must already be on the bench for. Mutual contact is dropped. */
export function supportEdges(project: YardProject): Map<string, Set<string>> {
  const boxes = partBoxes(project).filter((b) => !b.turns);
  const edges = new Map<string, Set<string>>();
  // A real bearing overlaps in the plan. A skinny strip (a 3/4" wall cleat) is fastened to the
  // shelf, not a bearer the shelf waits for. An edge kiss is left alone.
  const bearer = (b: Aabb) => b.max[0] - b.min[0] >= 1.25 && b.max[2] - b.min[2] >= 1.25;
  const stack = (upper: Aabb, lower: Aabb) => {
    const y = upper.min[1] - lower.max[1];
    return (
      y <= STACK &&
      y >= -STACK &&
      bearer(lower) &&
      overlap(upper, lower, 0) >= BEAR &&
      overlap(upper, lower, 2) >= BEAR
    );
  };
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      const bear = (upper: Aabb, lower: Aabb) =>
        isPad(lower)
          ? addEdge(edges, lower.name, upper.name)
          : addEdge(edges, upper.name, lower.name);
      if (stack(a, b)) {
        bear(a, b);
        continue;
      }
      if (stack(b, a)) {
        bear(b, a);
        continue;
      }
      for (const axis of [0, 2] as const) {
        const g = gapOf(a, b, axis);
        if (g > GAP || g < -GAP) continue;
        const other = axis === 0 ? 2 : 0;
        if (overlap(a, b, other) < BEAR || overlap(a, b, 1) < BEAR) continue;
        const aLong = longest(a) === axis;
        const bLong = longest(b) === axis;
        // A corner where two peers meet is not an order. A piece butts into a host when it
        // lands on the host's face in from the ends, or the host continues down past it.
        const hosts = (part: Aabb, host: Aabb, contact: 0 | 2) => {
          const hostLong = longest(host);
          if (hostLong === 1) return host.min[1] <= part.min[1] - 0.4;
          const lo = Math.max(host.min[hostLong], part.min[hostLong]);
          const hi = Math.min(host.max[hostLong], part.max[hostLong]);
          const inset = lo > host.min[hostLong] + 0.3 && hi < host.max[hostLong] - 0.3;
          return inset || host.min[1] <= part.min[1] - 0.4;
        };
        if (aLong && !bLong && hosts(a, b, axis)) addEdge(edges, a.name, b.name);
        else if (bLong && !aLong && hosts(b, a, axis)) addEdge(edges, b.name, a.name);
      }
    }
  }
  for (const [name, ons] of edges) {
    for (const on of [...ons])
      if (edges.get(on)?.has(name)) {
        ons.delete(on);
        edges.get(on)!.delete(name);
      }
  }
  return edges;
}

function frozen(step: AssemblyStep): boolean {
  return FROZEN.test(step.title);
}

function places(step: AssemblyStep, known: Set<string>): string[] {
  if (frozen(step) || TEST.test(step.title)) return [];
  const used = (step.partsUsed ?? []).map((s) => s.toLowerCase());
  if (!used.length || used.includes("*") || used.includes("all")) return [];
  return [...known].filter((name) => used.includes(name.toLowerCase()));
}

function placement(steps: AssemblyStep[], known: Set<string>): Map<string, number> {
  const at = new Map<string, number>();
  steps.forEach((step, i) => {
    for (const name of places(step, known)) if (!at.has(name)) at.set(name, i);
  });
  return at;
}

const ANCHOR =
  /\b(?:rests on|fastened to|fasten(?:ed|ing|s)?\b[^.]{0,80}?\bto|screw(?:ed|s|ing)?\b[^.]{0,80}?\b(?:to|into|through)|attach(?:ed|es|ing)?\b[^.]{0,80}?\bto|hang(?:s|ing)?\b[^.]{0,40}?\bon|glue(?:d|s)?\b[^.]{0,60}?\bto|on (?:the|both|each|its)\b)\b/gi;

function phrases(name: string): string[] {
  const family = name
    .replace(/\s+\d+$/, "")
    .trim()
    .toLowerCase();
  const out = new Set<string>();
  const keep = (phrase: string) => {
    const words = phrase.split(/\s+/).filter(Boolean);
    if (!words.length) return;
    if (words.length === 1 && STOP.has(words[0])) return;
    out.add(words.join(" "));
  };
  keep(family);
  const bare = family.replace(SIDE, "");
  if (bare !== family) keep(bare);
  return [...out];
}

/** Part names a support clause points at, besides the parts this step itself places. */
function namedSupports(step: AssemblyStep, known: string[], placing: Set<string>): string[] {
  const text = `${step.title}. ${step.description ?? ""}`.toLowerCase();
  const hits = new Set<string>();
  for (const match of text.matchAll(ANCHOR)) {
    const clause = text.slice((match.index ?? 0) + match[0].length).split(".")[0] ?? "";
    for (const name of known) {
      if (placing.has(name) || hits.has(name)) continue;
      for (const phrase of phrases(name)) {
        const body = phrase
          .split(/\s+/)
          .map((w, i, arr) => (i === arr.length - 1 ? `${w}s?` : w))
          .join("\\s+");
        if (new RegExp(`\\b${body}\\b`, "i").test(clause)) {
          hits.add(name);
          break;
        }
      }
    }
  }
  return [...hits];
}

function keyOf(step: AssemblyStep, fault: Fault): string {
  return `${fault.kind}|${step.title}|${(step.description ?? "").slice(0, 48)}|${fault.part}|${fault.on}`;
}

/** Faults of this order. `names` faults only veto a move; they do not start one. */
export function orderFaults(project: YardProject, steps: AssemblyStep[]): Fault[] {
  const boxes = partBoxes(project);
  const known = new Set(boxes.map((b) => b.name));
  const edges = supportEdges(project);
  const kisses = kissEdges(project);
  const at = placement(steps, known);
  const out: Fault[] = [];
  for (const [part, ons] of edges) {
    const i = at.get(part);
    if (i == null) continue;
    for (const on of ons) {
      const j = at.get(on);
      if (j != null && j > i) out.push({ kind: "geom", part, on, at: i });
    }
  }
  for (const [part, ons] of kisses) {
    const i = at.get(part);
    if (i == null) continue;
    for (const on of ons) {
      const j = at.get(on);
      if (j != null && j > i) out.push({ kind: "edge", part, on, at: i });
    }
  }
  const pads = new Set(boxes.filter(isPad).map((b) => b.name));
  const turned = new Set(boxes.filter((b) => b.turns).map((b) => b.name));
  const canon = new Map([...known].map((n) => [n.toLowerCase(), n]));
  steps.forEach((step, i) => {
    if (frozen(step)) return;
    if (TEST.test(step.title)) {
      for (const name of step.partsUsed ?? []) {
        const who = canon.get(name.toLowerCase());
        const placed = who ? at.get(who) : undefined;
        if (placed != null && placed > i) out.push({ kind: "test", part: who!, on: who!, at: i });
      }
    }
    if (HANG_ALL.test(step.title)) {
      for (const [name, j] of at)
        if (j > i && !pads.has(name) && !turned.has(name))
          out.push({ kind: "hang", part: name, on: name, at: i });
    }
    const placing = new Set(places(step, known));
    for (const on of namedSupports(step, [...known], placing)) {
      const j = at.get(on);
      if (j != null && j > i) out.push({ kind: "names", part: step.title, on, at: i });
    }
  });
  return out;
}

function moved(steps: AssemblyStep[], from: number, to: number): AssemblyStep[] | null {
  if (from === to || frozen(steps[from])) return null;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  for (let i = lo; i <= hi; i++) if (i !== from && frozen(steps[i])) return null;
  const placed = (step: AssemblyStep) =>
    (step.partsUsed ?? []).filter((n) => n !== "*" && n !== "all").length;
  if (placed(steps[from]) > 4) return null;
  const next = steps.slice();
  const [step] = next.splice(from, 1);
  next.splice(to, 0, step);
  return next;
}

function keys(project: YardProject, steps: AssemblyStep[]): Set<string> {
  return new Set(orderFaults(project, steps).map((f) => keyOf(steps[f.at], f)));
}

function motivating(project: YardProject, steps: AssemblyStep[]): Fault[] {
  return orderFaults(project, steps).filter(
    (f) => f.kind === "geom" || f.kind === "test" || f.kind === "hang",
  );
}

/**
 * Permute steps in place-order. Returns the same array when nothing moves, so a plan
 * that was already buildable is byte-identical.
 */
export function orderStepsBySupport(project: YardProject, steps: AssemblyStep[]): AssemblyStep[] {
  // Stick roles share one loose box. Their contact is too blunt to reorder a written sequence.
  if (steps.length < 2 || !project.panels.length || !partBoxes(project).length) return steps;
  let cur = steps;
  for (let guard = 0; guard < steps.length; guard++) {
    const faults = motivating(project, cur);
    if (!faults.length) break;
    const before = keys(project, cur);
    let next: AssemblyStep[] | null = null;
    const known = new Set(partBoxes(project).map((b) => b.name));
    const at = placement(cur, known);
    for (const fault of faults) {
      const late = fault.kind === "geom" ? at.get(fault.on) : at.get(fault.part);
      // Only swap with the very next step, and only when that step is the one this step is waiting on.
      // A hang step that itself places parts must stay: moving it also moves those parts.
      if (late !== fault.at + 1) continue;
      if (
        fault.kind === "hang" &&
        (cur[fault.at].partsUsed ?? []).some((n) => n !== "*" && n !== "all")
      )
        continue;
      for (const candidate of [moved(cur, fault.at, late)]) {
        if (!candidate) continue;
        const after = keys(project, candidate);
        let subset = after.size < before.size;
        for (const k of after) if (!before.has(k)) subset = false;
        if (subset && motivating(project, candidate).length < faults.length) {
          next = candidate;
          break;
        }
      }
      if (next) break;
    }
    if (!next) break;
    cur = next;
  }
  if (cur === steps) return steps;
  if (cur.every((s, i) => s === steps[i])) return steps;
  return cur.map((s, i) => (s.step === i + 1 ? s : { ...s, step: i + 1 }));
}
